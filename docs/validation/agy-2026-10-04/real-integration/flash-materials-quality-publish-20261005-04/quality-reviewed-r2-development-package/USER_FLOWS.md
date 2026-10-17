# 真实集成验证-flash-materials-chinese-20261005-01 — 使用与恢复流程

版本：24；批准蓝图：eac57cf23bdead051f55670df14cf9ad4578e4687fbd2c601bffc8797371af23

## 交互流程：实时输入防抖调度、IME会话作废与空值清除旧结果流转

ID：blk-flow-input-display；关联需求：blk-feat-input-display；依赖：blk-feat-input-display

1. 用户光标聚焦在文本输入框并键入或修改字符。
2. 输入事件与输入法会话判定：
   - 若触发 compositionstart，系统递增 activeSessionId 并标记当前会话令牌 currentSessionToken = activeSessionId，置 isComposing 为 true，立即调用 DebounceScheduler.cancel() 挂起防抖；
   - 若处于中文输入法合成期间（isComposing 为 true），挂起防抖定时器，不执行中间草稿校验；
   - 当输入法完成选词上屏触发 compositionend 时，置 isComposing 为 false；系统核验当前事件的会话令牌：若 currentSessionToken !== activeSessionId（说明会话已被清空操作作废），则直接丢弃事件，不调度防抖；若匹配，则调用 DebounceScheduler.schedule(handleDebouncedValidateAndDisplay, 300)；
   - 普通非合成输入（触发 input 且 !isComposing）直接进入 DebounceScheduler.schedule(handleDebouncedValidateAndDisplay, 300)。
3. 防抖调度与任务重置：
   - 系统检查当前是否存在未到期的定时器，若存在则调用 clearTimeout 销毁旧任务，重新启动 300ms 倒计时。
4. 倒计时期间的事件分支：
   - 分支 A（用户继续键入新字符）：重复步骤 3，重置计时器；
   - 分支 B（用户点击清空按钮）：立即调用 DebounceScheduler.cancel()，递增 activeSessionId 作废当前输入法会话，置 isComposing = false，展示区恢复占位符，输入框清空，流程终止；此后即使收到旧输入法 compositionend 事件亦因会话失效而被拦截丢弃；
   - 分支 C（用户停止输入满 300ms）：定时器到期，自动唤醒执行核对逻辑。
5. 定时器唤醒后提取输入框当前文本并执行 trim() 去除首尾空白判断：
   - 分支 C1（空值或纯空白字符）：清除顶部展示区已显示的旧项目名，展示区恢复为灰色占位符“【等待输入核对】”，在输入框正下方挂载红色错误提示“项目名不能为空，请输入有效字符”，输入框边框变红并保持焦点；输入框已输入的字符（含空格）原样完好保留；
   - 分支 C2（有效非空字符）：移除旧错误提示与高亮，通过 Node.textContent 将内容安全更新到顶部展示区，输入框完好保留当前文本供后续微调。
6. 后台标签页与唤醒处理：
   - 若在后台运行期间定时器发生延迟，在唤醒回调中核查会话令牌与定时器句柄；任何清空与新输入均已先行销毁旧句柄，确保仅有最新且未清空的操作可更新界面。
7. 异常防护：若 DOM 操作抛出异常，顶层捕获并在界面顶部以警示条显示，输入框文本完好保留供用户恢复。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 交互流程：清空重置、IME会话失效与防竞态操作流转

ID：blk-flow-reset；关联需求：blk-feat-reset；依赖：blk-feat-reset

1. 用户点击底部橙色圆形清空按钮。
2. 系统立即执行即时直接复位（不弹出阻断确认框）：
   a. 第一优先级调用 DebounceScheduler.cancel()，立即销毁当前排队中的 300ms 待展示防抖任务句柄，将 pendingTimerId 置为 null；
   b. 递增全局输入法会话令牌 activeSessionId（如从 1 递增至 2），将 isComposing 强置为 false，使当前可能处于合成中或排队中的输入法事件完全失效；
   c. 将当前输入框 value 设为空字符串；
   d. 将顶部展示区 textContent 重置为预设占位文字（'【等待输入核对】'）；
   e. 隐藏或移除所有可见的校验错误 DOM 节点，重置边框高亮样式；
   f. 触发 inputElement.focus() 将焦点重置到输入框，等待新一轮输入。
3. 若在点击清空之后，输入法引擎抛出迟到的 compositionend 事件，系统比对事件关联的会话令牌与当前 activeSessionId，因令牌不一致直接忽略，不执行文本写入、不启动 300ms 计时、不产生空值报错。
4. 流程结束，界面完全恢复初始就绪态，且无任何遗留定时器在后台运行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566
