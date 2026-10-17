# 真实集成验证-flash-materials-chinese-20261005-01 — 使用与恢复流程

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

## 交互流程：输入事件闭包守卫、快照防抖调度与节点代际流转

ID：blk-flow-input-display；关联需求：blk-feat-input-display；依赖：blk-feat-input-display

1. 用户光标聚焦在当前活跃输入框（activeInputNode）准备键入或编辑文本。
2. 事件感知与闭包前置校验：
   - 当捕获到 input、beforeinput、compositionstart、compositionend 等任何事件时，闭包首先执行有效性判定：
     if (e.currentTarget !== node || node !== activeInputNode || bornGeneration !== inputGeneration || !document.body.contains(node)) return;
   - 若不匹配（如属于已被清空替换的旧节点事件）：立即静默返回，不进行任何 DOM 操作、状态变更或定时器调度。
3. 组合输入（IME）分支流转：
   - 触发 compositionstart：闭包内置 isComposing = true，调用 DebounceScheduler.cancel() 取消排队中的旧防抖任务并使旧调度纪元失效；
   - 合成期间触发 input：核验 isComposing === true，忽略防抖调度，挂起等待；
   - 选词上屏触发 compositionend：闭包内置 isComposing = false，读取 node.value 存入 trustedDraft，调用 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, handleDebouncedValidateAndDisplay, 300)。
4. 普通输入分支流转：
   - 触发原生 input 事件（且 !isComposing && !e.isComposing）：读取当前 node.value 存入 trustedDraft，调用 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, handleDebouncedValidateAndDisplay, 300)。
5. 防抖调度与快照绑定：
   - DebounceScheduler.schedule 内部递增 schedulerEpoch 产生本次唯一的 thisEpoch，并启动 300ms setTimeout；
   - 若在 300ms 倒计时期间收到新输入，旧任务被自动销毁并以新纪元重新倒计时；
   - 若在 300ms 倒计时期间用户点击清空按钮，清空逻辑立即执行 DebounceScheduler.cancel()（递增 schedulerEpoch 废弃任务），递增 inputGeneration 并替换 DOM 节点，倒计时逻辑在到期后因纪元不匹配被无害丢弃。
6. 定时器唤醒与快照校验执行：
   - 300ms 定时器到期唤醒时，首先执行三重守卫：
     if (thisEpoch !== schedulerEpoch || targetGeneration !== inputGeneration || targetNode !== activeInputNode || !document.body.contains(targetNode)) return;
   - 守卫通过后，针对传入的 draftSnapshot 执行校验（不重新读取 targetNode.value）：
     * 分支 A（空值或纯空白字符）：清除顶部展示区已显示的旧项目名，展示区恢复为初始灰色占位符“【等待输入核对】”，在输入框正下方挂载红色错误提示“项目名不能为空，请输入有效字符”，输入框边框变红并保持焦点；输入框已输入的字符（含空格）原样完好保留；
     * 分支 B（有效非空字符）：移除旧错误提示与高亮，通过 Node.textContent 将 draftSnapshot 安全更新到顶部展示区，输入框完好保留当前文本供后续微调。
7. 异常防护：若 DOM 操作抛出异常，顶层 try-catch 捕获并在界面顶部以警示条显示，输入框文本完好保留供用户修改恢复。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 交互流程：清空重置状态事务流转、节点拓扑原子还原与草稿重调度

ID：blk-flow-reset；关联需求：blk-feat-reset；依赖：blk-feat-reset

1. 用户点击底部橙色圆形清空按钮（resetButton）。
2. 执行 ResetController.handleReset() 核心两阶段状态事务流程：
   阶段一：捕获恢复快照（Snapshot Capture）：
   - 调用 ResetController.captureSnapshot() 记录 pre-reset 状态快照：
     * activeInputNode 引用、当前 inputGeneration、schedulerEpoch；
     * 定时器状态（pendingTimerId 是否存在，记录 hadPendingTimer 及原始草稿文本 draft，涵盖非空文本、空字符串与纯空格）；
     * 顶部展示区当前内容 displayContent；
     * 校验错误容器内容 errorContent、样式 display 与输入框错误类名、aria-invalid；
     * 原输入节点在 DOM 树中的 parentNode 及 nextSibling 位置引用。
   阶段二：事务准备与执行（Execution Phase，处于 try 块保护中）：
   - a. 计算下一代际编号：nextGeneration = snapshot.inputGeneration + 1；
   - b. 在内存中实例化全新输入元素：const newNode = document.createElement('input')；
   - c. 遍历 oldNode.attributes，安全复制 5 类持久属性（label 关联、ARIA、tabindex、class/style、data-*），显式过滤排除 value 与瞬态 aria-invalid；设置 newNode.type = 'text'，newNode.value = ''，确保 newNode 无 aria-invalid；
   - d. 调用 InputController.bindInputNode(newNode, nextGeneration) 为新节点绑定专属事件监听闭包（捕获 nextGeneration 作为 bornGeneration，私有 isComposing=false 与 trustedDraft=''）；
   - e. 取消防抖定时器：调用 DebounceScheduler.cancel()，销毁活跃定时器并单调递增调度纪元；
   - f. 执行物理节点替换：oldNode.replaceWith(newNode)；显式记录 mountedReplacementNode = newNode；
   - g. 呈现与错误复位：DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】')，FeedbackBanner.clearInputError(newNode, errorContainer)；
   - h. 焦点转移与恢复：newNode.focus()；
   - i. 事务提交点（Commit Point）：将 activeInputNode 正式指向 newNode，将 inputGeneration 递增为 nextGeneration。至此事务成功完成。
   阶段三：事务异常拦截与原子回滚（Rollback Phase，catch 块保护，解决 R6-B1 与 R6-B2）：
   - 若在阶段二的任何环节（创建/属性复制/事件绑定前失败、replaceWith 抛错、替换后 renderPlaceholder 失败、clearInputError 失败或 focus 失败）发生异常：
     * catch 块捕获异常并调用 ResetController.rollback(snapshot, err, newNode)；
     * DOM 拓扑精准还原（R6-B1 修复）：显式识别 replacement 节点 newNode；若 newNode 已经插入文档树（newNode && newNode.parentNode 存在），执行 newNode.parentNode.replaceChild(oldNode, newNode) 物理回插原节点并彻底移除已挂载的新节点（或 newNode.remove() 并在原 parentNode/nextSibling 插回 oldNode），严禁在 DOM 中残留 newNode，确保页面中输入框数量严格为 1 且 ID 唯一；若 newNode 未挂载且 oldNode 脱离文档，按 snapshot.parentNode 与 nextSibling 插回原位置；
     * 状态指针与代际还原：activeInputNode 重新指向 oldNode，inputGeneration 恢复为 snapshot.inputGeneration；调度纪元单调自增（schedulerEpoch++）确保清空前后的宏任务队列旧定时器无害作废，绝不回退至旧纪元；
     * 输入内容与错误状态还原：oldNode.value 还原为 snapshot.draft；若此前存在错误，恢复 error 类名与 aria-invalid 属性；恢复 displayContent 与 errorContainer 文本与显隐；
     * 原始草稿无差别重调度（R6-B2 修复）：若 snapshot.hadPendingTimer 为 true，无论 snapshot.draft 是非空文本、空字符串 '' 还是纯空格 '   '，无条件按 snapshot.draft 重新调度 DebounceScheduler.schedule(snapshot.draft, oldNode, inputGeneration, handleDebouncedValidateAndDisplay, 300) 产生全新纪元，绝不因 trim 校验为假而跳过重调度；空值与纯空格在 300ms 后忠实执行校验，清除旧项目名展示并呈现红色非空警示，空格原样保留；因 inputGeneration 还原，oldNode 闭包中的 bornGeneration 依然严格等于 inputGeneration，绝不产生失配死锁；
     * 焦点与提示：oldNode.focus() 回焦，界面顶部弹出友好横幅 FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态')；
     * 严重失败只读复制兜底：若回插本身再次发生严重 DOM 异常，定义诚实失败状态：不声称完整恢复，禁止 window.location.reload() 刷新页面，在独立只读 textarea 容器中原样呈现原始 draft（保留换行与空格）供用户手动复制取回。
3. 旧节点迟到事件隔离：
   - 事务成功提交后，脱离 DOM 的 oldNode 接收到迟到 compositionend、beforeinput 或 input 事件时，因 node !== activeInputNode（oldNode !== newNode）且 bornGeneration !== inputGeneration（1 !== 2），旧闭包守卫立即直接 return，完全无法触碰 activeInputNode，不制造空值错误。
4. 顺畅恢复与继续操作：
   - 事务成功后，用户在 newNode 中键入直接流转新 300ms 防抖；事务回滚后，用户在 oldNode 中键入（如键入 'Edited after failure'）同样正常触发 300ms 防抖更新，手动删空与重试清空完全可用，重试成功后依然维持单一输入框。

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287
