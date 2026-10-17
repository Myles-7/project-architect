# 真实集成验证-flash-materials-chinese-20261005-01 — 使用与恢复流程

版本：16；批准蓝图：23f56557c396d422187a7074a7dcd68399496cf62762ffadf96d429a507f7612

## 交互流程：实时输入防抖调度、自动展示与清空取消流转

ID：blk-flow-input-display；关联需求：blk-feat-input-display；依赖：blk-feat-input-display

1. 用户光标聚焦在文本输入框并键入或修改字符。
2. 输入事件与输入法会话判定：
   - 若处于中文输入法合成状态（event.isComposing 为 true，或在 compositionstart 与 compositionend 之间），挂起防抖定时器，不执行中间草稿校验；
   - 当输入法完成选词上屏（触发 compositionend）或进行普通非合成输入（触发 input 且 !event.isComposing）时，进入防抖调度。
3. 防抖调度与任务重置：
   - 系统检查当前是否存在正在计时的待展示防抖任务：若存在未到期的定时器，调用 clearTimeout(timerId) 立即销毁旧任务；
   - 系统重新启动一个 300ms 的延迟执行定时器。
4. 倒计时期间的事件分支：
   - 分支 A（用户继续键入新字符）：重复步骤 3，重置计时器；
   - 分支 B（用户点击清空按钮）：立即调用 clearTimeout 销毁待展示任务，展示区与输入框同时复位，流程终止；
   - 分支 C（用户停止输入满 300ms）：定时器到期，自动唤醒执行核对逻辑。
5. 定时器唤醒后提取输入框当前文本并执行 trim() 去除首尾空白判断：
   - 分支 C1（空值或纯空白字符）：在输入框下方挂载红色错误提示‘项目名不能为空，请输入有效字符’，输入框边框变红并保持焦点，展示区恢复为灰色占位符，输入框已输入的字符（含空格）原样完好保留；
   - 分支 C2（有效非空字符）：移除可能存在的旧错误提示节点与高亮，通过 Node.textContent 将内容安全更新到顶部大字展示区，输入框完好保留当前文本供后续微调。
6. 异常防护：若 DOM 渲染或执行抛出异常，顶层捕获并在界面顶部以警示条显示，输入框文本完好保留供用户恢复。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 交互流程：清空重置与任务销毁操作流转

ID：blk-flow-reset；关联需求：blk-feat-reset；依赖：blk-feat-reset

1. 用户点击底部橙色圆形清空按钮（对应 fixture.png 下方橙色圆形色块位置）。
2. 系统立即执行即时直接复位（不弹出阻断确认框）：
   a. 调用 DebounceScheduler.cancel()，立即通过 clearTimeout 销毁当前可能存在的 300ms 待展示防抖任务句柄，将 pendingTimerId 置为 null，并重置 isComposing 状态；
   b. 将当前输入框 value 设为空字符串；
   c. 将顶部展示区 textContent 重置为预设占位文字（'【等待输入核对】'）；
   d. 隐藏或移除所有可见的校验错误 DOM 节点，重置边框高亮样式；
   e. 触发 inputElement.focus() 将焦点重置到输入框，等待新一轮输入。
3. 流程结束，界面完全恢复初始就绪态，且无任何遗留定时器在后台运行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518
