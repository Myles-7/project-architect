# 真实集成验证-flash-materials-chinese-20261005-01 — 功能定义

版本：24；批准蓝图：eac57cf23bdead051f55670df14cf9ad4578e4687fbd2c601bffc8797371af23

## 功能特性：输入 300ms 防抖实时反馈、IME会话失效与空值清除旧结果契约

ID：blk-feat-input-display；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

支持在桌面端输入框中录入项目名文本，采用 300ms 防抖实时反馈机制替代确认按钮，并建立完备的输入法会话失效与空值旧结果清除契约：
- 正常输入状态：用户在输入框中键入有效非空字符，系统监听原生 input 事件并启动 300ms 防抖倒计时；倒计时到期后自动触发校验并通过 Node.textContent 安全渲染至顶部大字展示区，清除旧错误提示，输入框保持现有输入文本供随时微调。
- 中文输入法（IME）会话隔离与防误触：通过 activeSessionId 会话令牌与 isComposing 状态标记管理拼音输入会话。在 compositionstart 至 compositionend 期间挂起防抖计时；选词上屏（compositionend）后核对会话令牌有效性，若会话未被清空作废则启动 300ms 倒计时，避免未完成拼音草稿提前上屏。
- 清空操作与会话彻底失效：若在输入法合成期间或防抖倒计时期间用户点击清空按钮，系统立即销毁待执行定时器并递增 activeSessionId，彻底作废当前输入法会话。任何来自旧会话的迟到 compositionend 事件均被静默丢弃，绝不重新拉起防抖计时、绝不回填旧文本，更不自动制造空值错误。
- 空值与纯空格输入彻底清掉旧结果：当用户将输入文本全部删空或输入全为空白字符（空格、制表符）且停止 300ms 时，防抖回调判定校验未通过，展示区已显示的旧项目名立即被清除并恢复为初始灰色占位文字“【等待输入核对】”，在输入框正下方就地显示红色警示“项目名不能为空，请输入有效字符”；输入框内的既有字符（包括空格）原样完好保留，光标保持在输入框内。
- 后台标签页节流与唤醒优先级：300ms 防抖调度测量以可见前台（document.visibilityState === 'visible'）为基准；若标签页处于后台，浏览器可能对定时器产生节流延迟（≥1s）。当切回前台或延迟定时器到期时，系统通过会话令牌和排队句柄进行有效性判定；清空操作与后发新输入始终具备最高抢占与取消优先级，杜绝过期货幽灵文本覆写。
- 初始与离线状态：首次打开展示区显示灰色占位文字“【等待输入核对】”，支持纯离线本地加载运行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 功能特性：一键即时清空、IME会话作废与防抖任务销毁契约

ID：blk-feat-reset；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

提供一键清空与重置功能，帮助用户在完成一轮项目名核对后快速复位界面，并与 300ms 防抖调度器及输入法会话形成严密联动：
- 立即取消与会话作废机制：用户点击清空按钮时，系统第一优先级调用 DebounceScheduler.cancel() 立即销毁排队中的防抖定时器，并递增 activeSessionId 使当前输入法合成会话立即作废，置 isComposing = false；来自旧会话的迟到 compositionend 事件一律丢弃，杜绝幽灵覆写与清空后误触发空值报错。
- 正常即时复位：依据用户已确认决策（即时直接清空），点击清空按钮后系统立即执行复位，不弹出阻断式确认弹窗。顶部展示区复位为初始灰色占位提示（'【等待输入核对】'），输入框内容清空（value = ''），任何正在显示的校验报错信息被移除，光标自动重新聚焦在输入框内（.focus()），方便立即开始新一轮输入。
- 优先级与幂等性：清空操作对任何排队任务和后台延迟定时器拥有绝对抢占和取消优先级；在空页面状态下重复点击清空不会产生任何副作用或错误，绝不因重复点击产生空值错误提示。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566
