# 真实集成验证-flash-materials-chinese-20261005-01 — 功能定义

版本：28；批准蓝图：d88723381aade9fdb287a00e97e1ce0a7889d2446777332f40e541b0933d4fff

## 功能特性：输入 300ms 防抖实时反馈、全链路会话隔离与空值清除旧结果契约

ID：blk-feat-input-display；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

支持在桌面端输入框中录入项目名文本，采用 300ms 防抖实时反馈机制替代确认按钮，并建立完备的全链路输入会话隔离、尾随事件守卫与空值旧结果清除契约：
- 正常输入状态：用户在输入框中键入有效非空字符，在活跃会话（sessionState === 'active'）且非输入法合成状态下，系统监听原生 input 事件并启动 300ms 防抖倒计时；倒计时到期后自动触发校验并通过 Node.textContent 安全渲染至顶部大字展示区，清除旧错误提示，输入框保持现有输入文本供随时微调。
- 中文输入法（IME）合成态挂起：通过 isComposing 标记管理拼音输入会话。在 compositionstart 至 compositionend 期间挂起防抖计时；选词上屏（compositionend）后核对当前会话有效性，若处于活跃态则启动 300ms 倒计时，避免未完成拼音草稿提前上屏。
- 清空操作、会话作废与全链路尾随事件守卫：
  * 当用户点击清空按钮时，系统第一优先级销毁排队中的防抖任务，递增活跃会话令牌 activeSessionId 与代际 inputGeneration，将会话状态机置为 'quarantined'（清空隔离态），置 isComposing 为 false，将受信任草稿 lastAcceptedDraft 重置为 ''，并将输入框 DOM value 设为 ''；
  * 在 'quarantined' 隔离态期间，任何未伴随新用户物理意图的旧会话残余事件（包括迟到的 compositionend、beforeinput 以及尾随 noncomposing input 事件），均被判定为作废会话的尾随事件并无条件丢弃，绝不重新调度 300ms 防抖、绝不制造空值错误；
  * 若浏览器或输入法引擎在清空后派发的尾随事件试图将旧草稿写回输入框 DOM（value 被赋非空值），守卫在拦截尾随事件的同时立即强制将 input.value 纠正复位为空字符串，彻底阻断旧草稿幽灵覆写；
  * 真实新输入意图的恢复：当用户重新产生主动输入行为（触发物理按键 keydown、用户粘贴 paste、或发起新的 compositionstart），系统检测到真实用户意图，立即解除隔离（sessionState 恢复为 'active'），接纳后续合法 input 事件正常启动新的 300ms 防抖调度；
- 空值与纯空格输入彻底清掉旧结果：当用户将输入文本全部删空或输入全为空白字符（空格、制表符）且停止 300ms 时，防抖回调判定校验未通过，展示区已显示的旧项目名立即被清除并恢复为初始灰色占位文字“【等待输入核对】”，在输入框正下方就地显示红色警示“项目名不能为空，请输入有效字符”；输入框内的既有字符（包括空格）原样完好保留，光标保持在输入框内。
- 后台标签页节流与唤醒优先级：300ms 防抖调度测量以可见前台（document.visibilityState === 'visible'）为基准；若标签页处于后台，浏览器可能对定时器产生节流延迟（≥1s）。当切回前台或延迟定时器到期时，系统通过会话状态机和排队句柄进行有效性判定；清空操作与后发新输入始终具备最高抢占与取消优先级，杜绝过期货幽灵文本覆写。
- 真实环境差异与待验证状态：原生 IME 与不同主流浏览器的事件派发顺序与尾随行为差异列为开发阶段真机实测用例，不作彻底杜绝所有原生竞态的无证据绝对承诺。初始打开展示区显示灰色占位文字“【等待输入核对】”，支持纯离线本地加载运行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-quality-20261005-06-feedback-1791155700105

## 功能特性：一键即时清空、尾随事件隔离守卫与防抖任务销毁契约

ID：blk-feat-reset；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

提供一键清空与重置功能，帮助用户在完成一轮项目名核对后快速复位界面，并与 300ms 防抖调度器及全链路输入会话建立严密联动与尾随隔离：
- 立即取消、会话作废与尾随隔离机制：用户点击清空按钮时，系统第一优先级调用 DebounceScheduler.cancel() 立即销毁排队中的防抖定时器；同时递增 activeSessionId 与 inputGeneration，将会话状态机置为 'quarantined'（清空隔离态），置 isComposing = false，将受信任草稿 lastAcceptedDraft 重置为 ''；来自旧会话的迟到 compositionend、beforeinput 及尾随 input 事件一律丢弃，若尾随事件试图写回 DOM 则立即强制纠正为 value = ''，杜绝幽灵覆写与清空后误触发空值报错。
- 正常即时复位：依据用户已确认决策（即时直接清空），点击清空按钮后系统立即执行复位，不弹出阻断式确认弹窗。顶部展示区复位为初始灰色占位提示（'【等待输入核对】'），输入框内容清空（value = ''），任何正在显示的校验报错信息被移除，光标自动重新聚焦在输入框内（.focus()），方便立即开始新一轮输入。
- 新输入意图恢复机制：当用户在清空后重新输入（物理 keydown、新拼音合成 compositionstart 或粘贴 paste）时，隔离态自动解除并无缝转入活跃状态，新输入正常开启 300ms 防抖流转，不造成永久阻断。
- 优先级与幂等性：清空操作对任何排队任务和后台延迟定时器拥有绝对抢占和取消优先级；在空页面状态下重复点击清空保持纯状态复位，无异步排队，绝不因重复点击产生空值错误提示。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-quality-20261005-06-feedback-1791155700105
