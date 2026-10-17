# 真实集成验证-flash-materials-chinese-20261005-01 — 使用与恢复流程

版本：28；批准蓝图：d88723381aade9fdb287a00e97e1ce0a7889d2446777332f40e541b0933d4fff

## 交互流程：实时输入防抖调度、IME尾随事件隔离与新输入意图恢复流转

ID：blk-flow-input-display；关联需求：blk-feat-input-display；依赖：blk-feat-input-display

1. 用户光标聚焦在文本输入框并准备键入或修改字符。
2. 输入事件感知与会话状态机判定：
   - 若触发 compositionstart：递增 activeSessionId 并标记 currentSessionToken = activeSessionId，置 isComposing 为 true，会话状态机标记为 sessionState = 'active'，立即调用 DebounceScheduler.cancel() 挂起防抖；
   - 若处于中文输入法合成期间（isComposing 为 true）：防抖定时器挂起，不执行中间草稿校验；
   - 若触发 compositionend：置 isComposing 为 false；若当前处于清空隔离态（sessionState === 'quarantined'）或 currentSessionToken !== activeSessionId，判定为已作废旧会话的尾随事件，直接丢弃且检查复位 input.value = ''，不调度防抖；若会话合法有效，则调用 DebounceScheduler.schedule(handleDebouncedValidateAndDisplay, 300)；
   - 用户主动输入意图识别与隔离解除：当用户触发物理按键 keydown（排除纯修饰键 Shift/Ctrl/Alt/Meta 等）、用户执行 paste 粘贴、或通过 compositionstart 发起新会话时，状态机立即解除隔离，置 sessionState = 'active'；
   - 原生 input 事件到达：
     * 分支 A（处于清空隔离态 sessionState === 'quarantined'）：判定为已作废会话的尾随 input 事件，直接丢弃，不调度防抖；若 inputElement.value 被旧事件写回非空，立即强置 inputElement.value = ''；
     * 分支 B（处于活跃态 sessionState === 'active' 且 !isComposing && !e.isComposing）：读取当前 inputElement.value 记录为 lastAcceptedDraft，调用 DebounceScheduler.schedule(handleDebouncedValidateAndDisplay, 300)。
3. 防抖调度与任务重置：
   - 系统检查当前是否存在未到期的定时器，若存在则调用 clearTimeout 销毁旧任务，重新启动 300ms 倒计时。
4. 倒计时期间的事件分支：
   - 分支 1（用户继续键入新字符）：重复步骤 3，重置计时器；
   - 分支 2（用户点击清空按钮）：立即调用 DebounceScheduler.cancel()，递增 activeSessionId 与 inputGeneration，将会话状态机切换至 sessionState = 'quarantined'，置 isComposing = false，展示区恢复占位符，输入框清空，流程终止；此后所有旧会话尾随事件均被隔离丢弃；
   - 分支 3（用户停止输入满 300ms）：定时器到期，自动唤醒执行核对逻辑。
5. 定时器唤醒后提取输入框当前文本并执行 trim() 去除首尾空白判断：
   - 分支 3.1（空值或纯空白字符）：清除顶部展示区已显示的旧项目名，展示区恢复为灰色占位符“【等待输入核对】”，在输入框正下方挂载红色错误提示“项目名不能为空，请输入有效字符”，输入框边框变红并保持焦点；输入框已输入的字符（含空格）原样完好保留；
   - 分支 3.2（有效非空字符）：移除旧错误提示与高亮，通过 Node.textContent 将内容安全更新到顶部展示区，输入框完好保留当前文本供后续微调。
6. 后台标签页与唤醒处理：
   - 若在后台运行期间定时器发生延迟，在唤醒回调中核查会话状态与定时器句柄；任何清空与新输入均已先行销毁旧句柄，确保仅有最新且未清空的操作可更新界面。
7. 异常防护：若 DOM 操作抛出异常，顶层捕获并在界面顶部以警示条显示，输入框文本完好保留供用户恢复。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-quality-20261005-06-feedback-1791155700105

## 交互流程：清空重置、会话隔离作废与防尾随覆写操作流转

ID：blk-flow-reset；关联需求：blk-feat-reset；依赖：blk-feat-reset

1. 用户点击底部橙色圆形清空按钮。
2. 系统立即执行即时直接复位（不弹出阻断确认框）：
   a. 第一优先级调用 DebounceScheduler.cancel()，立即销毁当前排队中的 300ms 待展示防抖任务句柄，将 pendingTimerId 置为 null；
   b. 执行 InputController.quarantineSession()：递增全局输入法会话令牌 activeSessionId（如从 1 递增至 2），递增代际 inputGeneration，将会话状态机切换为 sessionState = 'quarantined'，强置 isComposing = false，将受信任草稿 lastAcceptedDraft 重置为 ''；
   c. 将当前输入框 value 设为空字符串（inputElement.value = ''）；
   d. 将顶部展示区 textContent 重置为预设占位文字（'【等待输入核对】'）；
   e. 隐藏或移除所有可见的校验错误 DOM 节点，重置边框高亮样式；
   f. 触发 inputElement.focus() 将焦点重置到输入框，等待新一轮输入。
3. 尾随事件拦截与 DOM 保护：
   若在点击清空之后，输入法引擎或浏览器事件循环派发迟到的 compositionend、beforeinput 或尾随 noncomposing input 事件：
   - 系统检测到 sessionState === 'quarantined'，直接判定该事件属于已作废会话并静默丢弃；
   - 守卫同时检查 inputElement.value，若检测到该事件将旧草稿写回到 DOM，立即强制重置 inputElement.value = ''；
   - 系统不执行文本写入、不启动 300ms 计时、不产生空值报错。
4. 新输入恢复流转：
   当用户在输入框中发生真实输入动作（触发非修饰物理 keydown、触发 paste 或启动新 compositionstart）时，InputController 自动将 sessionState 切回 'active'，随后到来的 input 事件正常读取最新 DOM 文本并启动 300ms 防抖倒计时。
5. 流程结束，界面完全恢复初始就绪态，且无任何遗留定时器在后台运行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-quality-20261005-06-feedback-1791155700105
