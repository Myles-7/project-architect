# 真实集成验证-flash-materials-chinese-20261005-01 — 功能定义

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

## 功能特性：输入 300ms 防抖实时反馈、节点代际闭包隔离与草稿快照契约

ID：blk-feat-input-display；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

支持在桌面端输入框中录入项目名文本，采用 300ms 防抖实时反馈机制替代确认按钮，并建立严密的“输入节点生命周期＋节点代际闭包隔离＋草稿快照调度”契约：
- 节点代际与闭包绑定规则：
  * 系统维护全局当前活跃输入框节点 activeInputNode 与单调递增的代际计数 inputGeneration（初始为 1）；
  * 每个输入节点在创建与绑定事件时，闭包深度捕获当前节点引用 node 与诞生代际 bornGeneration，并在闭包内维护私有的组合输入状态 isComposing（初始 false）与受信任草稿 trustedDraft（初始 ''）；
  * 任何 input、beforeinput、compositionstart、compositionend 事件回调在执行任何状态变更或调度前，必须严格核验：event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)；若核验不通过，判定该事件来自非活跃节点或已作废旧代际，立即直接 return 丢弃，不得改写当前活跃节点、不得修改新会话状态、不得取消或覆盖新定时器；不宣称普通 InputEvent 自带应用会话令牌。
- 正常输入与草稿快照调度：
  * 用户在活跃输入框中键入字符，通过守卫核验且非输入法合成状态（!isComposing && !e.isComposing）时，系统读取当前 node.value 存入 trustedDraft；
  * 触发 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, callback, 300)，将当前已接受草稿快照、节点引用与代际一并传入；调度器记录本次独立纪元 schedulerEpoch 并启动 300ms 倒计时；
  * 定时器到期时，首先核验当前纪元与代际是否依然有效；若有效则仅针对传入的草稿快照 draftSnapshot 执行 trim() 校验与 Node.textContent 安全渲染，彻底避免到期重新读取可能已被异常事件篡改的 DOM value；输入框既有文本完好保留供后续微调。
- 中文输入法（IME）合成态管理：
  * 在当前活跃节点触发 compositionstart 时，闭包内置 isComposing 为 true，并调用 DebounceScheduler.cancel() 取消排队中的旧防抖任务；
  * 在 compositionstart 至 compositionend 期间，防抖计时挂起，不触发中间草稿校验；
  * 选词上屏触发 compositionend 时，闭包内置 isComposing 为 false，读取 node.value 存入 trustedDraft 并调用 schedule(trustedDraft, node, bornGeneration, callback, 300)；
  * 组合输入状态严格归属于节点闭包，旧节点的 compositionend 永远无法修改新节点的 isComposing 状态。
- 清空与尾随事件隔离行为：
  * 用户点击清空按钮时，系统立即执行清空操作：递增 inputGeneration，取消防抖调度并使 schedulerEpoch 失效，创建全新 input 节点替换旧节点（oldNode.replaceWith(newNode)），在新节点闭包中初始化 bornGeneration 与全新 isComposing，清空展示区为占位符并回焦新节点；
  * 旧节点的任何迟到 compositionend、beforeinput 或尾随 input 事件只能到达旧节点绑定的闭包函数，由于 node !== activeInputNode 且 bornGeneration !== inputGeneration 被第一道前置守卫直接丢弃返回，绝不接触 activeInputNode，绝不制造空值错误，也无需额外按键解锁；
  * 新节点的物理键入、粘贴或新发起的中文拼音输入均直接在新闭包与新代际中正常流转 300ms 防抖。
- 空值与纯空格输入彻底清除旧结果：当用户手动将输入文本全部删空或输入纯空白字符（空格、制表符）且停止 300ms 时，防抖回调针对快照判定校验失败，展示区已显示的旧项目名立即被清除并恢复为初始灰色占位文字“【等待输入核对】”，在输入框正下方就地显示红色警示“项目名不能为空，请输入有效字符”；输入框内的既有字符（包括空格）原样完好保留。
- 待验证状态与环境差异说明：桌面端 Chrome、Edge、Firefox 与 Safari 在原生 IME 输入下替换 DOM 节点的具体事件派发与会话生命周期行为属于开发阶段真机实测用例，不作彻底杜绝所有原生竞态的无证据绝对承诺。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 功能特性：一键即时清空、状态事务回滚与五类持久属性保留契约（单DOM拓扑恢复与草稿无差别重调度）

ID：blk-feat-reset；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

提供一键即时清空与重置功能，帮助用户在完成一轮项目名核对后快速复位界面，通过“清空状态事务＋节点物理替换＋持久配置复制＋失败原子回滚”实现物理级事件解耦、防抖取消、属性保真与失败输入保留：
1. 清空状态事务与提交点契约：
   - 捕获恢复快照（ResetTransactionSnapshot）：用户点击底部橙色清空按钮时，第一优先级捕获当前活跃输入节点 activeInputNode、全局代际 inputGeneration、调度纪元 schedulerEpoch、待执行定时器状态（pendingTimerId、hadPendingTimer）、当前原始草稿 draft（无论非空、空字符串或纯空格）、展示区文本、错误提示以及原节点在 DOM 树中的父节点与相邻兄弟节点位置；
   - 两阶段事务提交（Two-Phase Commit）：在内存预制新节点并安全复制 5 类持久属性，完成事件绑定、取消旧定时器、执行 replaceWith 物理替换、展示区占位复位、错误清除以及 focus 聚焦全部成功后，正式原子提交更新全局 activeInputNode 与 inputGeneration；
   - 失败原子回滚与 DOM 单输入框拓扑保真（R6-B1 修复）：若在准备期（创建/属性复制/事件绑定）、replaceWith 物理替换过程、或替换后展示复位、错误清理、焦点恢复任意阶段抛出异常，立即触发 rollback；显式识别 replacement 节点 newNode：若 newNode 已插入 DOM 树，通过 newNode.parentNode.replaceChild(oldNode, newNode) 物理回插原节点并彻底移除 newNode，或者 newNode.remove() 并在原 parentNode 与 nextSibling 原位插回 oldNode，绝不在 DOM 树中遗留已挂载的 newNode，彻底消除双输入框与同 ID（project-name-input）冲突，确保文档中始终只有单一合法输入框；全局 activeInputNode 与 inputGeneration 严格还原为原节点与原代际，调度纪元单调自增（schedulerEpoch++）以彻底作废旧定时器；
   - 原始草稿无差别重调度（R6-B2 修复）：若清空前存在尚未完成的防抖任务（hadPendingTimer === true），回滚时必须针对原始草稿快照 snapshot.draft（无论非空项目名、空字符串 ''、纯空格 '   '）以全新纪元重新调度防抖校验任务；严禁用 draft.trim().length > 0 等条件跳过空值/纯空格任务；对于删空或纯空格草稿，重新调度后满 300ms 触发校验，严格按原规则清除旧展示并展示红色非空警示，确保旧展示不永久残留，且纯空格文本原样保留；oldNode 闭包的 bornGeneration 与还原后的 inputGeneration 完全自洽，用户可立即继续输入、手动删空或重试清空；
   - 严重回滚失败只读复制兜底：若回滚本身发生 DOM 异常，定义诚实的恢复失败状态：不声称“完整恢复”，坚决禁止刷新页面（禁止 window.location.reload()），不把空输入当作已恢复；在独立只读草稿容器（如 readonly textarea）中原样呈现原始草稿（逐字符保留换行与空格），供用户手动选中复制；提示诚实说明主编辑器未能自动恢复，草稿已在只读文本区中安全保留。
2. 持久配置复制策略与瞬态状态重置：
   - 创建全新 input 元素并完整保留 5 类持久配置：1. label 关联属性（id, name）；2. ARIA 无障碍属性（aria-label, aria-describedby, aria-required 等全部持久 ARIA 配置）；3. 键盘导航属性（tabindex）；4. 表现样式属性（class 类名与 style 内联样式）；5. 测试与自定义属性（data-* 属性，如 data-test）；
   - 单独重置瞬态与编辑状态：重置 value = ''、trustedDraft = ''，显式过滤并移除瞬态校验属性 aria-invalid 与错误高亮；
   - 为新节点闭包绑定全新代际（nextGeneration = inputGeneration + 1）、专属 isComposing=false 与 trustedDraft=''。
3. 旧节点迟到事件隔离保护：
   - 事务成功提交后，输入法引擎或浏览器事件循环派发发往旧节点的迟到 compositionend、beforeinput 或尾随 input 事件，在进入旧闭包时因 node !== activeInputNode 以及 bornGeneration !== inputGeneration 被入口守卫直接拦截返回，完全无法触碰 activeInputNode，绝不将旧文字写回新输入框、绝不修改新组合状态、绝不误报空值错误；
   - 不把强制重写新 DOM value 作为拒绝旧事件手段，旧节点与其私有状态随 GC 自然回收。
4. 新真实输入无障碍流转：
   - 无论事务成功提交还是回滚恢复，当前活跃输入框均处于 DOM 活跃状态与焦点态，敲击物理按键、粘贴文本或启动新拼音合成均在新/原闭包与有效代际中正常监听，顺畅流转 300ms 防抖调度，无需额外按键解锁；清空具备绝对抢占优先级与幂等性。

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287
