# 真实集成验证-flash-materials-chinese-20261005-01 — 验收场景

版本：24；批准蓝图：eac57cf23bdead051f55670df14cf9ad4578e4687fbd2c601bffc8797371af23

## 验收标准：清空重置与任务销毁 Given-When-Then

ID：blk-acc-reset；关联需求：blk-feat-reset；依赖：blk-flow-reset

Scenario 1: 正常即时清空复位与回焦
Given 顶部展示区正在展示 'Project-Test'，输入框包含 'Project-Test'，界面无错误
When 用户点击底部橙色清空按钮
Then 页面不弹出任何二次确认框，顶部展示区立即恢复为灰色占位文本 '【等待输入核对】'，输入框文本变为空字符串，输入光标自动聚焦在输入框内。

Scenario 2: 防抖倒计时中清空彻底取消异步任务
Given 用户刚键入 'New-Test'，当前处于 100 毫秒计时窗口
When 用户点击清空按钮
Then 输入框清空，定时器被销毁，等待 500 毫秒后查验展示区依然保持 '【等待输入核对】'，无任何旧文字回显。

Scenario 3: 清除历史错误提示
Given 页面因前次操作正在显示 '项目名不能为空，请输入有效字符' 红色警告
When 用户点击清空按钮
Then 红色警告提示立刻从 DOM 移除，输入框错误高亮取消，页面恢复至干净初始态。

Scenario 4: 空页面重复点击清空幂等性
Given 页面处于初始空白状态
When 用户连续多次点击清空按钮
Then 页面无任何异常抛出，展示区保持占位提示，输入框保持聚焦。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316

## 端到端安全防范与极端边界验收规范 Given-When-Then

ID：blk-deliv-acc-security-edge；关联需求：blk-feat-input-display、blk-tech-error、blk-prod-outcomes；依赖：blk-deliv-task-package

Scenario 1: 恶意标记纯文本安全回显（非 HTML 解析执行）
Given 页面处于就绪状态
When 用户在输入框中输入 `<script>window.__xss_flag = true; alert('XSS');</script><svg onload=alert(1)>` 并停止满 300 毫秒
Then 顶部展示区将上述字符完整作为纯文本安全显示，控制台 window.__xss_flag 值为 undefined，页面不弹出任何系统警报框，DOM 树中展示区子节点仅包含纯 Text 节点，无 HTML 元素被创建。

Scenario 2: 极端超长字符串输入排版防护
Given 用户在输入框中粘贴包含 1000 个连续无空格英文字符的超长项目名（如 'A' 重复 1000 次）
When 停止输入满 300 毫秒防抖触发
Then 展示区正常呈现该超长字符串，受 word-break: break-all 规则约束自动折行显示，展示区与主容器宽度不被撑破，页面不产生异常横向滚动条。

Scenario 3: 特殊实体字符原样保留回显
Given 用户输入包含 HTML 预留实体的项目名 `&amp; <test> "quotes" 'single'`
When 停止输入满 300 毫秒防抖触发
Then 展示区忠实显示 `&amp; <test> "quotes" 'single'` 原文，不发生双重转义或截断。

Scenario 4: 运行时错误保护与草稿不丢失
Given 开发者在输入框中录入了重要的待核对项目名草稿
When 触发意外 DOM 操作异常或脚本错误
Then 界面顶部呈现全局轻量容错通知，输入框中的草稿文字完好保留，页面不重载不刷新，开发者可直接复制或继续微调该文本。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety；批准操作：api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316

## 交付前置验证任务：本地双击直接运行与多浏览器兼容性实测

ID：blk-deliv-val-standalone-runtime；关联需求：blk-deliv-spec-deployment、blk-tech-deployment；任务前置：blk-deliv-task-package；蓝图原始依赖：blk-deliv-task-package

实测在标准桌面操作系统环境下双击直接运行（file:// 协议）与跨浏览器无报错兼容性，验证零门槛免环境运行能力。

目标：实测验证交付产物在彻底移除确认按钮后，在无需任何 HTTP 服务支持下直接本地双击（file://）成功加载，300ms 防抖实时反馈与清空任务取消在现代主流桌面浏览器中均零报错兼容

范围：在 Chrome、Edge、Firefox 桌面最新版下分别测试 file:// 协议本地双击加载、DOM 解析、300ms 防抖定时器执行与清空取消交互行为；明确标注 Safari 测试状态

排除：不测试淘汰的 IE 浏览器及移动端内置 WebView，不伪造未具备环境的测试结果

模块：AppController、Packaging、DebounceScheduler

正常行为：直接双击 index.html，浏览器在 file:// 协议下瞬时加载页面，无任何跨域拦截或 MIME 错误，DOM 中无确认按钮，实时输入与清空逻辑顺畅执行

异常行为：若某款浏览器在 file:// 下报安全限制或脚本未执行，检查 script 标签属性，保持自包含 defer 经典脚本模式，排查后重新测试

验证：
- 在本地文件系统中直接双击 index.html，查验 DevTools Console 是否有报错
- 在 Chrome、Edge 与 Firefox 分别执行输入 300ms 防抖展示与清空操作，查验交互行为一致性
- 断开网络连接后重新双击 index.html，验证页面离线独立可用

完成条件：
- 支持的现代主流桌面浏览器在 file:// 协议下冷加载均零控制台报错
- 离线状态下全部输入核对与清空逻辑功能完整
- 记录各浏览器实测结果到交付验证报告中，Safari 明确标注待验证与真机环境要求

假设：测试宿主机安装有至少一款现代主流桌面浏览器（版本 ≥ 100）；测试执行前确认产物自包含无需外部网络

环境：现代桌面操作系统（Windows 10/11 或 macOS 或 Ubuntu Desktop），安装 Chrome 100+、Edge 100+、Firefox 100+，本地文件系统（file:// 协议）及轻量 HTTP 服务；Safari 标明需要 macOS 宿主环境进行真机验证

步骤：
- 1. 将交付产物目录（包含 index.html, styles.css, app.js, README.md）置于本地桌面测试路径；
- 2. 断开当前设备外网连接，确保测试处于离线状态；
- 3. 在 Windows 宿主机中分别使用 Google Chrome、Microsoft Edge 和 Mozilla Firefox 通过文件管理器直接双击打开 index.html（file:// 协议）；
- 4. 按 F12 打开浏览器开发者工具 Console 面板，核查是否有任何脚本错误、CORS 跨域告警或资源未找到提示（确认 0 错误）；
- 5. 分别在三款浏览器中输入 'StandAlone-Test-01' 停止 300ms，核对展示区自动呈现结果并检查输入保留状态；
- 6. 点击清空按钮，核对即时复位及光标自动回焦；
- 7. 对 Safari 浏览器执行静态代码 ES2022 语法兼容性审查，并在交付验证报告中记录其需要 macOS 真机环境的待验证状态；
- 8. 将 Chrome/Edge/Firefox 的实测截图与控制台状态记录归档至交付报告。

通过标准：
- Chrome/Edge/Firefox 浏览器 Console 面板 0 报错、0 警告；
- 300ms 防抖输入自动展示、空值提示、即时清空回焦功能在测试浏览器中表现一致；
- 离线状态下完全无功能降级；
- Safari 列出明确代码兼容审查结论与真机验证前置条件。

证据：Chrome/Edge/Firefox 三款浏览器在 file:// 协议下的 Console 截图与交互动作用例记录表；Safari 静态代码兼容审查记录

失败后：若发现特定浏览器抛错，调整 app.js 的脚本兼容性与 defer 组织方式，修复后重新执行测试直至全部通过。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612；批准操作：api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316

## 验收标准：300ms 防抖实时反馈、IME会话作废与旧结果清除 Given-When-Then

ID：blk-acc-input-display；关联需求：blk-feat-input-display；依赖：blk-flow-input-display

Scenario 1: 正常输入 300ms 防抖自动核对展示
Given 页面已在本地桌面浏览器正常加载且处于待命状态
When 用户在输入框中键入 'AiRDUO-Project-01' 并停止输入超过 300 毫秒
Then 页面顶部展示区自动显示 'AiRDUO-Project-01'，字体醒目大字高对比，输入框保留 'AiRDUO-Project-01'，页面无错误提示，全程无需点击任何确认按钮。

Scenario 2: 中文输入法（IME）拼音合成态防误触
Given 用户聚焦输入框并使用中文拼音输入法键入拼音 'xiangmu'
When 用户在候选字列表选词暂停（处于 compositionstart 与 compositionend 之间，isComposing 为 true）
Then 顶部展示区不展示未完成的拼音字母 'xiangmu'，防抖计时挂起；当用户选择候选词确认上屏 '项目' 并停止输入满 300 毫秒后，顶部展示区一次性更新呈现 '项目'。

Scenario 3: 输入法合成中点击清空彻底作废旧会话
Given 用户在输入框中通过中文拼音输入法键入拼音，当前处于合成状态（isComposing 为 true）
When 用户直接点击底部橙色圆形清空按钮
Then 输入框立即清空，顶部展示区保持占位符，且当前输入法会话被标记失效；此后当用户在系统输入法候选条中取消或迟到触发 compositionend 时，展示区始终保持占位文本，输入框保持空值，页面绝不误触发空值报错或回写旧拼音。

Scenario 4: 先有旧项目名展示成功后全部删空防抖拦截与旧结果清除
Given 页面顶部展示区正在展示此前核对成功的项目名 'Old-Alpha-Project'，输入框包含 'Old-Alpha-Project'
When 开发者使用 Backspace/Delete 键将输入框文字全部删空并停止输入满 300 毫秒
Then 顶部展示区原旧项目名 'Old-Alpha-Project' 立即被清除并不再显示，展示区恢复为初始灰色占位文字 '【等待输入核对】'，输入框正下方就地呈现红色警示 '项目名不能为空，请输入有效字符'，输入框边框变红，输入框保持空值可编辑焦点，绝不残留旧结果。

Scenario 5: 纯空格输入防抖拦截、旧结果清除与空格保留
Given 页面顶部展示区正在展示 'Old-Alpha-Project'
When 开发者在输入框中输入三个半角空格 '   ' 并停止输入满 300 毫秒
Then 顶部展示区旧项目名立即被清除并恢复为灰色占位文字 '【等待输入核对】'，输入框正下方出现红色明确提示 '项目名不能为空，请输入有效字符'，输入框内输入的三个半角空格完好保留，光标保持在输入框内。

Scenario 6: 倒计时期间清空立即取消待展示任务
Given 用户在输入框中键入了 'Draft-Text'
When 用户在 150 毫秒内立即点击橙色圆形清空按钮
Then 输入框瞬间清空，处于待执行状态的 300ms 定时器被立即销毁，在 300 毫秒时间到达后，顶部展示区绝不出现 'Draft-Text'，始终保持初始占位文字。

Scenario 7: 运行时异常保留输入
Given 用户在输入框中输入了测试项目名
When 异步回调触发未知运行时错误
Then 页面顶部显示友好错误横幅，输入框内的所有字符完好保留，页面不重载，允许用户修改或重试。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 端到端集成验收规范：防抖实时核对、旧结果清除与输入保留 Given-When-Then

ID：blk-deliv-acc-full-e2e；关联需求：blk-feat-input-display、blk-feat-reset、blk-tech-error；依赖：blk-deliv-task-package

Scenario 1: 标准项目名输入 300ms 实时核对全流程
Given 页面处于初始待命状态，展示区显示灰色占位文字 '【等待输入核对】'，界面无确认按钮
When 用户在输入框键入 'Project-Beta-2026' 并停止输入满 300 毫秒
Then 页面顶部展示区自动大字呈现 'Project-Beta-2026'，字体为加粗高对比度样式，输入框内完好保留 'Project-Beta-2026'，页面无任何错误警示，无需点击确认按钮。

Scenario 2: 中文输入法（IME）拼音输入与防抖展示
Given 开发者在输入框中通过拼音输入法键入中文
When 拼音字母输入期间未选字上屏
Then 展示区保持原内容或占位符，不展示中间拼音字母；当选词完成（'测试项目'）且输入停止满 300 毫秒后，展示区更新呈现 '测试项目'。

Scenario 3: 删空文本防抖拦截与旧项目名清除
Given 页面顶部展示区正呈现此前核对成功的项目名 'Project-Beta-2026'，输入框包含对应文字
When 开发者将输入框文字全部删除并停止输入满 300 毫秒
Then 顶部展示区原旧项目名 'Project-Beta-2026' 立即被清除，恢复为初始灰色占位文字 '【等待输入核对】'，输入框下方即时呈现红色警示文字 '项目名不能为空，请输入有效字符'，输入框边框变红，输入框保持空值可编辑状态，光标保持在输入框内。

Scenario 4: 纯空格防抖拦截、旧结果清除与原始空格保留
Given 页面顶部展示区正呈现项目名
When 开发者在输入框中输入三个半角空格 '   ' 并停止输入满 300 毫秒
Then 顶部展示区原项目名被清除并恢复为占位提示，输入框下方呈现红色警示，且输入框内的三个半角空格完好保留，光标保持在输入框内。

Scenario 5: 补充有效输入后错误自动恢复
Given 界面正处于 Scenario 3 或 4 的错误提示状态
When 开发者在输入框中键入 'New-Project' 并停止满 300 毫秒
Then 红色错误警示节点立即从 DOM 树中移除，输入框边框恢复正常，展示区即时更新呈现 'New-Project'，输入框保留当前完整输入。

Scenario 6: 输入法合成中点击清空彻底作废旧会话
Given 开发者在输入框中通过拼音输入法键入拼音，处于合成会话中
When 开发者直接点击底部橙色圆形清空按钮
Then 输入框瞬时清空，展示区恢复占位符；此后输入法会话结束触发迟到 compositionend 时，展示区始终保持占位文本，不发生旧文本回显，页面绝不弹出空值错误。

Scenario 7: 键入期间立即清空防幽灵回显
Given 页面正在展示 'Old-Project'，开发者快速键入 'Temporary-Draft'
When 在键入后 150 毫秒内立即点击底部橙色圆形清空按钮
Then 待展示任务立即销毁，展示区恢复为 '【等待输入核对】'，输入框变为空，在 300 毫秒到达后展示区始终保持占位文本，不出现 'Temporary-Draft'。

Scenario 8: 一键即时清空与自动回焦
Given 页面展示区正呈现 'New-Project'，输入框内有对应文本
When 用户点击底部橙色圆形清空按钮
Then 页面无任何确认弹窗拦截，展示区立即恢复为灰字 '【等待输入核对】'，输入框 value 变为空字符串，错误状态全部清除，光标自动重新聚焦在输入框内。

Scenario 9: 空白状态下重复清空幂等性
Given 页面处于干净待命状态
When 用户连续点击 3 次清空按钮
Then 页面无任何异常报错，展示区保持占位文字，输入框持续保持聚焦状态，不产生任何空值错误提示。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 验收标准：交付包自包含性、端口契约与本地启动模式 Given-When-Then

ID：blk-deliv-acc-package；关联需求：blk-deliv-spec-deployment；依赖：blk-deliv-task-package

Scenario 1: 本地文件系统直接双击启动 (file:// 协议)
Given 开发者将交付文件 index.html, styles.css, app.js, README.md 置于本地同一目录
When 在文件资源管理器中双击 index.html
Then 现代桌面浏览器成功打开页面，地址栏显示 file:// 协议，页面呈现白底背景、顶部灰字占位提示、居中输入框及底部单个橙色圆形清空按钮（DOM 与视图中无确认按钮），控制台无任何 CORS 错误或资源加载失败报错。

Scenario 2: 纯离线断网自包含验证
Given 宿主设备处于完全断开互联网连接的纯离线环境，交付文件已存在本地磁盘
When 重新加载本地 index.html
Then 页面布局完整渲染，所有样式正常生效，实时输入防抖核对与清空逻辑正常运行，无任何远程资源超时或请求挂起。

Scenario 3: 本地轻量静态 HTTP 服务器托管启动（端口 8080 契约一致性）
Given 开发者在交付目录执行 `python -m http.server 8080` 或 `npx serve . --listen 8080`（前提：已安装对应环境，npx 首次已缓存依赖）
When 浏览器访问 `http://localhost:8080`
Then 页面与 file:// 协议下行为完全一致，各项功能及交互响应完全一致，服务监听端口与访问地址严格对应 8080。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-python-http-server-port-official；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 交付前置验证任务：首屏 DOM 就绪与实时防抖响应性能基准实测（5轮均值闭合）

ID：blk-deliv-val-perf-benchmark；关联需求：blk-prod-outcomes；任务前置：blk-deliv-task-package、blk-deliv-val-standalone-runtime；蓝图原始依赖：blk-deliv-task-package、blk-deliv-val-standalone-runtime

实测首屏 DOM 解析就绪耗时（目标 5 轮均值 ≤ 300ms）、300ms 防抖实时反馈调度延迟（目标 5 轮总耗时均值 ≤ 350ms，其中调度延迟均值 ≤ 50ms）及清空响应指标（目标 5 轮均值 ≤ 50ms），建立真实精确且指标闭合的测量基准。

目标：实测验证轻量纯原生单页面的首屏 DOM 就绪耗时（目标 5 轮均值 ≤ 300ms）、300ms 输入防抖实时展示与清空交互响应延迟（防抖处理至重绘前调度总耗时 5 轮均值 ≤ 350ms，其中纯计算与重绘前调度延迟 5 轮均值 ≤ 50ms，清空重置耗时 5 轮均值 ≤ 50ms）的性能设计目标

范围：使用浏览器标准 Performance Navigation Timing API 与 Performance.now() 进行 DOM 就绪及实时防抖至重绘前回调打点测量，严格区分 DOM 解析就绪与物理绘制完成，统一 5 轮采样与均值通过边界

排除：不测量网络传输延时（测试在本地文件或本地回环服务下进行），不宣称 requestAnimationFrame 已证明物理像素绘制完毕，不声称尚未实测的数据已通过

模块：AppController、DebounceScheduler、DisplayRenderer、InputController

正常行为：在现代主流桌面浏览器可见前台加载并操作应用时，预期满足各项性能设计目标：首屏 DOM 就绪耗时（domContentLoadedEventEnd - startTime）目标 5 轮均值 ≤ 300ms；输入防抖展示总耗时目标 5 轮均值 ≤ 350ms（其中包含 300ms 定时器等待与 5 轮均值 ≤ 50ms 的 DOM 更新及重绘前调度延迟）；清空重置响应耗时目标 5 轮均值 ≤ 50ms。当前阶段目标应用尚未实现，实际数值待交付验证阶段执行实测，不声称未来测试已通过

异常行为：若实测均值超出阈值，分析是否有强制同步布局或不必要的 DOM 重查，精简 DOM 操作后复测

验证：
- 在 Chrome DevTools Performance 面板录制 5 次冷加载 Trace，查验 DOMContentLoaded 耗时 5 轮均值是否 ≤ 300ms
- 在控制台注入性能测量脚本，连续执行 5 次防抖展示与 5 次清空操作，统计 5 轮交互响应平均耗时是否达标（防抖总耗时均值 ≤ 350ms 且调度延迟均值 ≤ 50ms，清空均值 ≤ 50ms）
- 输出包含设备配置、测试数据规模与 5 轮采样起止记录的性能实测数据表

完成条件：
- 实测数据完整，首屏 DOM 就绪耗时 5 轮均值 ≤ 300ms
- 输入防抖处理至重绘前调度总耗时 5 轮均值 ≤ 350ms（其中 DOM 更新与重绘前调度延迟 5 轮均值 ≤ 50ms）
- 清空重置响应耗时 5 轮均值 ≤ 50ms
- 测试过程中主线程无阻塞的长任务（Long Task > 50ms）
- 形成完整的性能实测归档记录

假设：运行在主流性能配置的桌面计算机（CPU 4核以上，内存 8GB以上）；测试处于可见前台状态（document.visibilityState === 'visible'），测试数据规模为 1~200 字符的典型项目名测试文本

环境：桌面 PC（现代 x86_64 或 Apple Silicon 架构，4 核以上 CPU，8GB 以上内存），Chrome 最新稳定版无痕模式，禁用所有第三方浏览器扩展，可见活动前台标签页，本地 file:// 协议或 localhost

步骤：
- 1. 启动 Chrome 无痕模式并加载交付的 index.html，保持页面处于可见前台标签页（document.visibilityState === 'visible'）；
- 2. 测量首屏 DOM 就绪延迟：执行 const [nav] = performance.getEntriesByType('navigation'); console.log('DOM 就绪耗时:', nav.domContentLoadedEventEnd - nav.startTime)；重复 5 轮冷加载，记录每轮数值并计算 5 轮均值；
- 3. 注入防抖测试打点探针：在 input 与 compositionend 事件监听起始处记录 window.__t_input = performance.now()；在 DisplayRenderer 更新后调用 requestAnimationFrame(() => console.log('防抖全流程耗时:', performance.now() - window.__t_input)) 打印耗时；
- 4. 录入 50 字符典型项目名并停止打字，重复 5 轮测试，记录每轮总耗时与去除 300ms 后的调度延迟，分别计算 5 轮均值；
- 5. 点击清空按钮，在 click 事件打点并在重绘前 requestAnimationFrame 回调打点计算清空耗时，重复 5 轮测试并计算 5 轮均值；
- 6. 汇总 DOM 就绪均值、输入防抖总耗时均值、调度延迟均值与清空耗时均值，比对是否分别符合 ≤300ms, ≤350ms, ≤50ms 与 ≤50ms 的唯一通过边界。

通过标准：
- 首屏 DOM 就绪耗时（domContentLoadedEventEnd - startTime）5 轮均值 ≤ 300ms；
- 输入防抖展示总响应耗时 5 轮均值 ≤ 350ms，其中 DOM 更新与重绘前调度延迟 5 轮均值 ≤ 50ms；
- 清空重置渲染耗时 5 轮均值 ≤ 50ms；
- 测试过程中主线程无长任务卡顿。

证据：Chrome DevTools Performance 跟踪导出的 JSON 记录与控制台打印的 3 项指标各 5 轮耗时数据及均值计算日志

失败后：若某项指标均值超时，审查 styles.css 中的选择器复杂度，检查 app.js 中是否存在频繁的 getComputedStyle 或重复 querySelector，将 DOM 引用缓存化后重新测试。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-d686fe73-a405-4933-a3a6-7da164ea5c01、evidence-7a463cf7-74f1-4627-b9b3-24784ae3a9bc、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 交付前置验证任务：XSS 安全词法审计、确认按钮移除退出码校验与动态回显验收

ID：blk-deliv-val-security-xss-audit；关联需求：blk-tech-stack、blk-deliv-spec-deployment；任务前置：blk-deliv-task-package；蓝图原始依赖：blk-deliv-task-package

对交付产物进行代码级纯文本渲染安全性、确认按钮彻底剔除与无外部依赖静态审计，覆盖普通空白变体，杜绝危险 API 隐式调用，并在目标应用实现后动态验证恶意 Payload 纯文本原样回显。

目标：通过可直接解析执行的 Node.js 源码词法扫描脚本与目标应用动态 Payload 注入测试，核验交付源码中完全不存在 innerHTML、outerHTML、document.write、eval、new Function 等危险调用（覆盖常规空白形式），确认按钮代码 0 残留，并在目标应用实现后动态验证恶意 Payload 纯文本原样回显

范围：审查 index.html、styles.css、app.js 源码全文，覆盖普通空白变体的危险 API 静态扫描；执行确认按钮彻底剔除退出码校验；动态注入 10 种典型 XSS Payload 验证纯文本无害化回显（应用实现后执行）

排除：静态词法扫描不冒充全应用安全绝对证明；目标应用未实现时不伪造动态测试通过结果

模块：DisplayRenderer、ValidatorModule

正常行为：静态审查脚本对 app.js 全文进行扫描，确认 innerHTML、outerHTML、document.write、eval、new Function 等危险调用出现次数为 0（包括带空格变体）；确认按钮相关关键字在 HTML/CSS/JS 中出现次数为 0；目标应用实现后动态注入 10 种 Payload 均仅以纯文本原样回显，无弹窗、无网络外发、无 DOM HTML 元素生成。在当前规划期，目标应用尚未实现，动态测试标记为 unexecuted 待验证状态

异常行为：若静态审查发现任何隐式 HTML 解析、危险 API 或确认按钮残留，命令以 process.exit(1) 立即报错退出，排查改写后复测

验证：
- 执行 Node.js 源码扫描命令，验证其支持带空格变体（如 eval (x)、new Function (x)）并输出退出码 0
- 执行确认按钮残留检查命令，验证在存在残留时以退出码 1 明确报错退出，在 0 残留时退出码为 0
- 目标应用交付后，分别将 '<script>alert(1)</script>'、'<img src=x onerror=alert(1)>'、'javascript:alert(1)' 填入输入框，验证 300ms 后展示区为纯文本无弹窗

完成条件：
- Node.js 静态安全审查命令执行退出码为 0，覆盖常见空白形式，0 处危险 API 调用
- 确认按钮彻底剔除检查命令执行退出码为 0，发现残留明确以退出码 1 报告失败
- 目标应用实现后，全部 10 项 XSS Payload 均纯文本原样回显，无脚本执行与弹窗
- 明确区分静态词法检查与全应用安全证明，动态测试在当前规划期如实标为 unexecuted

假设：遵循 W3C/WHATWG DOM 标准规范，纯前端单页面无服务端接入点；静态词法检查基于已实现的源码文件，动态 Payload 注入测试在目标应用实现后执行

环境：桌面现代主流浏览器，Node.js 运行时执行自动化静态源码审查脚本，本地无网络环境

步骤：
- 1. 在项目根目录执行可直接运行且覆盖空白变体的 Node.js 静态安全审查命令：node -e "const fs = require('fs'); const code = fs.readFileSync('app.js', 'utf8'); const patterns = [{ name: 'innerHTML', regex: /innerHTML/ }, { name: 'outerHTML', regex: /outerHTML/ }, { name: 'document.write', regex: /document\s*\.\s*write/ }, { name: 'eval', regex: /\beval\s*\(/ }, { name: 'new Function', regex: /\bnew\s+Function\s*\(/ }]; const hits = patterns.filter(p => p.regex.test(code)).map(p => p.name); if (hits.length > 0) { console.error('发现禁用危险 API:', hits); process.exit(1); } else { console.log('静态安全检查通过：0 处危险 DOM/执行 API'); }"；
- 2. 执行确认按钮剔除验证命令（发现残留以退出码 1 明确报告失败）：node -e "const fs = require('fs'); const html = fs.readFileSync('index.html', 'utf8'); const css = fs.readFileSync('styles.css', 'utf8'); const js = fs.readFileSync('app.js', 'utf8'); const keywords = ['btn-confirm', 'handleConfirm', '确认']; const hits = keywords.filter(k => html.includes(k) || css.includes(k) || js.includes(k)); if (hits.length > 0) { console.error('发现确认按钮残留关键字:', hits); process.exit(1); } else { console.log('确认按钮代码剔除检查通过：0 残留'); }"；
- 3. 构造 10 组典型跨站脚本 Payload（包括 <script>alert(1)</script>、<img src=x onerror=alert(1)>、<svg onload=alert(1)>、javascript:alert(1) 等）；目标应用尚未实现时标为 unexecuted；
- 4. 待目标应用交付就绪后，依次录入并等待 300ms 防抖展示，检查 DOM 检查器中展示区节点的 children.length 是否始终为 0，是否仅包含纯 TextNode；
- 5. 检查控制台网络面板与 Console，确认无异常网络外发和异常脚本执行报错。

通过标准：
- 静态检查脚本输出通过，退出码为 0，危险 API 出现次数为 0；
- 确认按钮代码剔除检查通过，退出码为 0，残留为 0；
- 10 组 Payload 动态测试均安全显示为纯文本字符串，DOM 中无 HTML 元素被创建，无代码执行行为。

证据：静态代码扫描输出日志（退出码 0）与 10 组 Payload 动态测试的 DOM 节点类型查验证明

失败后：若静态检查发现危险 API 或确认按钮残留，或动态测试发生标签被解析执行，立刻阻断交付，修复为 textContent 纯文本绑定后重新执行全量用例。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-mdn-textcontent-xss-safety、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-nodejs-process-exit-official；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566
