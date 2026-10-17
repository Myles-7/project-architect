# 真实集成验证-flash-materials-chinese-20261005-01 — 功能定义

版本：32；批准蓝图：d7d6052422f208b3042fa76c6347a9cc436abc3e1c1985ef56fc0f377f5ce8e2

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

## 功能特性：一键即时清空、节点物理替换与代际解耦契约

ID：blk-feat-reset；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

提供一键清空与重置功能，帮助用户在完成一轮项目名核对后快速复位界面，通过“清空时替换输入节点＋节点代际闭包隔离”实现物理级事件解耦与防抖取消：
- 节点替换与代际递增机制：
  * 用户点击清空按钮时，系统第一优先级调用 DebounceScheduler.cancel() 递增 schedulerEpoch 并销毁排队中的定时器；
  * 同步递增全局代际 inputGeneration（如由 1 递增至 2）；
  * 创建全新 input 元素并完整复制原有属性（id="project-name-input"、name="projectName"、className、placeholder="请输入待核对的项目名"、aria-label="项目名输入"），初始化 value = ''；
  * 为新节点闭包绑定全新的 bornGeneration（等于递增后的 inputGeneration）、专属 isComposing=false 与 trustedDraft=''；
  * 执行 oldNode.replaceWith(newNode) 将旧节点移出当前文档 DOM 树，将 activeInputNode 指向新节点并自动执行 activeInputNode.focus()；
  * 顶部展示区同步复位为预设占位文字（'【等待输入核对】'），任何正在显示的错误警示被销毁移除。
- 旧节点迟到事件隔离保护：
  * 输入法引擎或浏览器事件循环派发迟到的旧 compositionend、beforeinput 或尾随 input 事件时，由于事件目标为脱离文档的 oldNode，且其闭包中 bornGeneration !== inputGeneration 且 node !== activeInputNode，事件直接在闭包入口被拦截返回；
  * 旧事件完全无法触及 activeInputNode，绝不发生将旧文字写回新输入框、抹除新草稿或误触发空值报错的反例；
  * 不把强制重写新 DOM value 作为拒绝旧事件手段，旧节点与其私有状态随 GC 自然回收。
- 新真实输入无障碍流转：
  * 新节点已就绪并处于 DOM 活跃状态，用户在新输入框中直接敲击物理按键、粘贴文本或启动新的拼音输入法合成，均在新闭包与新代际中正常监听，直接流转 300ms 防抖调度，无需任何额外物理按键解锁；
  * 清空操作具备绝对抢占优先级与幂等性，连续多次点击清空保持节点同步复位，绝不产生异常或错误提示。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159
