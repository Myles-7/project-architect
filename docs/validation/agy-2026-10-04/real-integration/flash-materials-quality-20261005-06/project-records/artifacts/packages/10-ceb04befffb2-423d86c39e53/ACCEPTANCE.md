# 真实集成验证-flash-materials-chinese-20261005-01 — 验收场景

版本：10；批准蓝图：ceb04befffb2b189662f4785067b15a396095e468c64c83460bfcc2465bac71c

## 验收标准：输入、展示与输入保留 Given-When-Then

ID：blk-acc-input-display；关联需求：blk-feat-input-display；依赖：blk-task-input-display

Scenario 1: 正常项目名核对展示
Given 页面已在本地桌面浏览器正常加载且处于待命状态
When 用户在输入框中输入 'AiRDUO-Project-01' 并点击确认按钮（或按 Enter 键）
Then 页面顶部展示区立即显示 'AiRDUO-Project-01'，字体醒目大字高对比，输入框保留 'AiRDUO-Project-01'，页面无错误提示。

Scenario 2: 特殊字符安全渲染防 XSS
Given 页面处于就绪状态
When 用户在输入框输入 '<script>alert("XSS")</script>' 并点击确认
Then 顶部展示区将其原样作为纯文本渲染回显，不弹出任何警告框，无脚本执行。

Scenario 3: 空值与纯空格输入阻断校验
Given 用户在输入框中未输入任何字符或仅输入若干连续空格
When 用户点击确认按钮
Then 顶部展示区保持当前状态不更新，输入框下方出现红色可见提示 '项目名不能为空，请输入有效字符'，输入框原有空格或空状态完好保留，光标保持在输入框内。

Scenario 4: 运行时异常保留输入
Given 用户在输入框中输入了测试项目名
When 点击确认提交触发未知运行时错误
Then 页面顶部显示友好错误横幅，输入框内的所有字符完好保留，页面不重载，允许用户修改或重试。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 验收标准：清空重置 Given-When-Then

ID：blk-acc-reset；关联需求：blk-feat-reset；依赖：blk-task-reset

Scenario 1: 正常即时清空复位与回焦
Given 顶部展示区正在展示 'Project-Test'，输入框包含 'Project-Test'，界面无错误
When 用户点击底部右侧橙色清空按钮
Then 页面不弹出任何二次确认框，顶部展示区立即恢复为灰色占位文本 '【等待输入核对】'，输入框文本变为空字符串，输入光标自动聚焦在输入框内。

Scenario 2: 清除历史错误提示
Given 页面因前次操作正在显示 '项目名不能为空，请输入有效字符' 红色警告
When 用户点击清空按钮
Then 红色警告提示立刻从 DOM 移除，输入框错误高亮取消，页面恢复至干净初始态。

Scenario 3: 空页面重复点击清空幂等性
Given 页面处于初始空白状态
When 用户连续多次点击清空按钮
Then 页面无任何异常抛出，展示区保持占位提示，输入框保持聚焦。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 技术验证任务：本地冷启动与交互延迟实测基准验证

ID：blk-tech-val-performance；关联需求：blk-prod-outcomes；依赖：blk-tech-task-impl

建立本地运行性能与交互体验基准的实测验证流程，实测冷启动时间与用户交互响应延迟指标。

目标：验证纯原生轻量单页面的本地冷启动渲染时间（目标≤300ms）及用户交互点击/按键响应延迟（目标≤50ms）

范围：使用浏览器原生 Performance Navigation Timing 与 Performance.now() API 对首屏加载冷启动及确认/清空交互耗时进行精确打点测量

排除：不进行分布式网络高并发压测，不进行跨洲际网络延迟模拟

模块：AppController、DisplayRenderer、InputController

正常行为：在本地浏览器加载 index.html，从页面导航加载至 DOM 完全就绪并完成首屏大字展示区渲染，总耗时控制在 300ms 以内；用户输入字符后点击确认或清空按钮，从事件分发到 DOM 更新并完成首帧重绘，总耗时控制在 50ms 以内

异常行为：若实测性能超出目标阈值，在日志中记录长任务瓶颈阶段与 CSS 重排重绘耗时，分析 DOM 节点结构并定位阻塞点，提供精简优化方案后复测

验证：
- 查验 Performance 面板导出的 JSON 记录，核验 DOMContentLoaded 耗时是否 ≤ 300ms
- 查验控制台输出的 5 次交互测量耗时，核验平均值与峰值是否 ≤ 50ms

完成条件：
- 完成本地冷启动耗时与交互响应延迟的实测验证并记录基准数据
- 冷启动时间与交互响应时间均达到或优于设计衡量指标

假设：测试环境为标准现代桌面 PC，运行现代主流浏览器最新稳定版本；测试数据规模为 1~200 字符的典型项目名测试文本

环境：主流桌面现代浏览器（Chrome 100+ / Edge 100+ / Firefox 100+），本地文件系统或轻量静态 HTTP 服务器托管环境

步骤：
- 1. 打开桌面 Chrome/Edge 浏览器无痕窗口，加载 index.html；
- 2. 通过 performance.getEntriesByType('navigation')[0] 读取 domContentLoadedEventEnd - startTime 作为首屏冷启动渲染耗时；
- 3. 在输入框键入 50 字符的项目名，通过 performance.now() 在 click/keydown 事件起始处打点，并在 requestAnimationFrame 回调中打点，计算两者差值作为交互响应耗时；
- 4. 连续执行 5 次测量，计算平均耗时与最大延迟并记录到验证日志。

通过标准：
- 冷启动耗时（从 navigationStart 到 domContentLoadedEventEnd）实测目标 ≤ 300ms
- 交互响应耗时（从 click/keydown 事件触发至 textContent 赋值与 requestAnimationFrame 重绘完成）实测目标 ≤ 50ms
- 无阻塞主线程的长任务（Long Task > 50ms）产生

证据：浏览器控制台输出的 Performance API 耗时日志及 DevTools Performance 面板 Trace 记录

失败后：若性能未达标，排查冗余的 DOM querySelector 遍历、高频无效样式计算或未解绑事件，重构关键渲染路径并重新测试直到满足指标

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-exp-docker-env-unavailable；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 验收标准：交付包自包含性与本地启动模式 Given-When-Then

ID：blk-deliv-acc-package；关联需求：blk-deliv-spec-deployment；依赖：blk-deliv-task-package

Scenario 1: 本地文件系统直接双击启动 (file:// 协议)
Given 开发者将交付文件 index.html, styles.css, app.js, README.md 置于本地同一目录
When 在文件资源管理器中双击 index.html
Then 现代桌面浏览器成功打开页面，地址栏显示 file:// 协议，页面呈现白底背景、顶部灰字占位提示、输入框及底部蓝橙双按钮，控制台无任何 CORS 错误或资源加载失败报错。

Scenario 2: 纯离线断网自包含验证
Given 宿主设备处于完全断开互联网连接的纯离线环境
When 重新加载本地 index.html
Then 页面布局完整渲染，所有样式正常生效，输入核对与清空逻辑正常运行，无任何远程资源超时或请求挂起。

Scenario 3: 本地轻量静态 HTTP 服务器托管启动
Given 在交付目录执行 `python -m http.server 8080` 或 `npx serve .`
When 浏览器访问 `http://localhost:8080`
Then 页面与 file:// 协议下行为完全一致，各项功能及交互响应完全一致。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 端到端集成验收规范：核心交互与输入保留 Given-When-Then

ID：blk-deliv-acc-full-e2e；关联需求：blk-feat-input-display、blk-feat-reset、blk-tech-error；依赖：blk-deliv-task-input-workflow、blk-deliv-task-reset-workflow、blk-deliv-task-error-handling

Scenario 1: 标准项目名输入核对全流程
Given 页面处于初始待命状态，展示区显示灰色占位文字 '【等待输入核对】'
When 用户在输入框键入 'Project-Beta-2026' 并点击确认按钮（或在输入框按 Enter 键）
Then 页面拦截默认提交，顶部展示区大字呈现 'Project-Beta-2026'，字体为加粗高对比度样式，输入框内保留 'Project-Beta-2026'，页面无任何错误警示。

Scenario 2: 纯空格与空值提交拦截与输入保留
Given 开发者在输入框中输入了三个半角空格 '   '
When 用户点击底部蓝色确认按钮
Then 顶部展示区保持原有内容不变，输入框下方即时呈现红色警示文字 '项目名不能为空，请输入有效字符'，输入框边框变为红色高亮，且输入框内的三个半角空格完好保留，光标保持在输入框内。

Scenario 3: 补充有效输入后错误自动恢复
Given 界面正处于 Scenario 2 的错误提示状态
When 开发者在输入框原有空格后继续键入 'New-Project' 并按下 Enter 键
Then 红色错误警示节点立即从 DOM 树中移除，输入框边框恢复正常，展示区即时更新呈现 '   New-Project'，输入框保留当前完整输入。

Scenario 4: 一键即时清空与自动回焦
Given 页面展示区正呈现 'New-Project'，输入框内有对应文本
When 用户点击底部右侧橙色圆形清空按钮
Then 页面无任何确认弹窗拦截，展示区立即恢复为灰字 '【等待输入核对】'，输入框 value 变为空字符串，错误状态全部清除，光标自动重新聚焦在输入框内（document.activeElement === inputElement）。

Scenario 5: 空白状态下重复清空幂等性
Given 页面处于干净待命状态
When 用户连续点击 3 次清空按钮
Then 页面无任何异常报错，展示区保持占位文字，输入框持续保持聚焦状态。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 端到端安全防范与极端边界验收规范 Given-When-Then

ID：blk-deliv-acc-security-edge；关联需求：blk-feat-input-display、blk-tech-error、blk-prod-outcomes；依赖：blk-deliv-task-input-workflow、blk-deliv-task-error-handling

Scenario 1: XSS 攻击向量纯文本安全转义
Given 页面处于就绪状态
When 用户输入 `<script>window.__xss_flag = true; alert('XSS');</script><svg onload=alert(1)>` 并点击确认
Then 顶部展示区将上述字符完整作为纯文本安全显示，控制台 window.__xss_flag 值为 undefined，页面不弹出任何系统警报框，DOM 树中展示区子节点仅包含纯 Text 节点，无 HTML 元素被创建。

Scenario 2: 极端超长字符串输入排版防护
Given 用户在输入框中粘贴包含 1000 个连续无空格英文字符的超长项目名（如 'A' 重复 1000 次）
When 点击确认提交
Then 展示区正常呈现该超长字符串，受 word-break: break-all 与 overflow-wrap: anywhere 规则约束自动折行显示，展示区与主容器宽度不被撑破，页面不产生异常横向滚动条。

Scenario 3: 特殊实体字符原样保留回显
Given 用户输入包含 HTML 预留实体的项目名 `&amp; <test> "quotes" 'single'`
When 点击确认提交
Then 展示区忠实显示 `&amp; <test> "quotes" 'single'` 原文，不发生双重转义或截断。

Scenario 4: 运行时错误保护与草稿不丢失
Given 开发者在输入框中录入了重要的待核对项目名草稿
When 触发意外 DOM 操作异常或脚本错误
Then 界面顶部呈现全局轻量容错通知，输入框中的草稿文字完好保留，页面不重载不刷新，开发者可直接复制或继续微调该文本。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付前置验证任务：本地双击直接运行与多浏览器兼容性实测

ID：blk-deliv-val-standalone-runtime；关联需求：blk-deliv-spec-deployment、blk-tech-deployment；依赖：blk-deliv-task-package、blk-deliv-spec-deployment

实测在标准桌面操作系统环境下双击直接运行（file:// 协议）与跨浏览器无报错兼容性，验证零门槛免环境运行能力。

目标：实测验证交付产物在无需任何 HTTP 服务支持下直接本地双击（file://）成功加载与交互，并跨现代主流桌面浏览器兼容

范围：在 Chrome、Edge、Firefox 桌面最新版下分别测试 file:// 协议本地双击加载、DOM 解析、脚本执行与交互行为

排除：不测试已被淘汰的 IE 浏览器及非标准移动端内置 WebView

模块：AppController、Packaging

正常行为：直接双击 index.html，浏览器在 file:// 协议下瞬时加载页面，无任何跨域拦截（CORS error）或 MIME 错误，全部输入、展示与清空逻辑均可顺畅执行

异常行为：若某款浏览器在 file:// 下报安全限制或脚本未执行，检查 script 标签属性，移除 type="module" 约束，改为原生自包含 defer 脚本加载模式，并重新测试验证

验证：
- 在 Windows/macOS/Linux 本地文件系统中直接双击 index.html，查验 DevTools Console 是否有报错
- 在 Chrome、Edge 与 Firefox 分别执行输入确认与清空操作，查验交互行为一致性
- 断开网络连接后重新双击 index.html，验证页面离线独立可用

完成条件：
- 三款主流浏览器在 file:// 协议下冷加载均零控制台报错
- 离线状态下全部输入核对与清空逻辑功能完整
- 记录各浏览器实测结果到交付验证报告中

假设：测试宿主机安装有至少一款现代主流桌面浏览器（版本 ≥ 100）

环境：现代桌面操作系统（Windows 10/11 或 macOS 或 Ubuntu Desktop），安装 Chrome 100+、Edge 100+、Firefox 100+，本地文件系统（file:// 协议）

步骤：
- 1. 将交付产物目录（包含 index.html, styles.css, app.js）拷贝至本地桌面测试路径；
- 2. 断开当前设备外网连接，确保测试处于纯离线状态；
- 3. 鼠标右键 index.html 分别使用 Google Chrome、Microsoft Edge 和 Mozilla Firefox 打开；
- 4. 按 F12 打开浏览器开发者工具 Console 面板，核查是否有任何脚本错误、CORS 告警或资源未找到提示；
- 5. 分别在三款浏览器中输入 'StandAlone-Test-01' 并回车，核对展示区呈现结果并检查输入保留状态；
- 6. 点击清空按钮，核对即时复位及光标自动回焦；
- 7. 将各项测试截图与控制台状态记录归档至交付报告。

通过标准：
- 各浏览器 Console 面板 0 报错、0 警告；
- 输入确认显示、空值提示、即时清空回焦功能在三大主流浏览器中表现一致；
- 离线状态下完全无功能降级。

证据：Chrome/Edge/Firefox 三款浏览器在 file:// 协议下的 Console 截图与交互动作录屏或用例记录表

失败后：若发现特定浏览器抛出 SecurityError 或 CORS 错误，调整 app.js 的脚本引入方式为经典自包含脚本，避免动态 import 或 module-specifier 限制，修复后重新执行步骤 1-7 直至全部通过。

来源：evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付前置验证任务：首屏冷启动与交互响应性能基准实测

ID：blk-deliv-val-perf-benchmark；关联需求：blk-prod-outcomes、blk-tech-val-performance；依赖：blk-tech-val-performance、blk-deliv-val-standalone-runtime

实测首屏渲染时间（目标≤300ms）与交互响应延迟（目标≤50ms）指标，建立精确测量基准。

目标：实测验证轻量纯原生单页面的首屏冷启动耗时≤300ms、确认展示与清空交互响应延迟≤50ms 的性能设计目标

范围：使用浏览器标准 Performance Navigation Timing API 与 Performance.now() 进行冷启动与点击交互的精确毫秒级打点测量

排除：不测量网络传输延时（测试在本地文件或本地回环服务下进行）

模块：AppController、DisplayRenderer、InputController

正常行为：打开页面时，从 navigationStart 到 domContentLoaded 耗时实测在 50~150ms 之间（符合 300ms 目标）；点击确认或清空时，从事件触发到微任务执行完毕及 requestAnimationFrame 渲染帧完成，耗时在 5~20ms 之间（符合 50ms 目标）

异常行为：若实测超出阈值，分析是否有强制同步布局（Forced Synchronous Layout）或不必要的 DOM 重查，精简 DOM 操作后复测

验证：
- 在 Chrome DevTools Performance 面板录制 3 次冷加载 Trace，查验 DOMContentLoaded 均值是否 ≤ 300ms
- 在控制台注入性能测量脚本，连续执行 10 次确认提交与 10 次清空操作，统计交互响应平均耗时与最大耗时是否均 ≤ 50ms
- 输出包含设备配置、测试数据规模与测量起止记录的性能实测数据表

完成条件：
- 实测数据完整，冷启动耗时 ≤ 300ms，交互响应耗时 ≤ 50ms
- 无阻塞主线程的长任务（Long Task）
- 形成完整的性能实测归档记录

假设：运行在主流性能配置的桌面计算机（如 4 核以上 CPU，8GB 以上内存）

环境：桌面 PC（现代 x86_64 或 Apple Silicon 架构），Chrome 最新稳定版无痕模式，禁用所有第三方浏览器扩展

步骤：
- 1. 启动 Chrome 无痕模式并加载交付的 index.html；
- 2. 在 Console 执行 `const [nav] = performance.getEntriesByType('navigation'); console.log('冷启动耗时:', nav.domContentLoadedEventEnd - nav.startTime);` 记录冷启动耗时；
- 3. 注入交互测试探针：在 confirmButton 点击监听中记录 `const t0 = performance.now()`，在 `requestAnimationFrame(() => console.log('交互渲染延迟:', performance.now() - t0))` 打印重绘耗时；
- 4. 录入 50 字符项目名并点击确认，重复 5 次取平均值；
- 5. 点击清空按钮，重复 5 次取平均值；
- 6. 汇总冷启动与交互延迟数据，比对是否符合 ≤300ms 与 ≤50ms 指标。

通过标准：
- 冷启动渲染耗时平均值 ≤ 300ms；
- 确认提交渲染耗时平均值 ≤ 50ms，清空重置渲染耗时平均值 ≤ 50ms；
- 测试过程中主线程无卡顿。

证据：Chrome DevTools Performance 跟踪导出的 JSON 记录与控制台打印的 5 轮耗时数据日志

失败后：若某项指标超时，审查 styles.css 中的选择器复杂度，检查 app.js 中是否存在频繁的 getComputedStyle 或重复 querySelector，将 DOM 引用缓存化后重新测试。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-docker-env-prep-delivery；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付前置验证任务：XSS 安全审计与纯原生代码静态规范性检查

ID：blk-deliv-val-security-xss-audit；关联需求：blk-tech-stack、blk-deliv-spec-deployment；依赖：blk-deliv-task-package、blk-deliv-task-input-workflow

对交付产物进行代码级纯文本渲染安全性与无外部依赖静态审计，杜绝 innerHTML 等注入点。

目标：通过静态代码审查与动态渗透注入用例，确保交付产物杜绝 innerHTML 等危险 DOM 写入，确保纯原生标准合规

范围：审查 index.html、styles.css、app.js 源码全文，动态注入 10 种典型 XSS Payload 验证无害化

排除：不进行服务端 SQL 注入等不适用单页面的外部渗透测试

模块：DisplayRenderer、ValidatorModule

正常行为：源码中完全不存在 innerHTML、outerHTML、document.write、eval、new Function 等危险调用；所有输入回显均走 textContent；10 种 XSS Payload 均纯文本原样回显，无弹窗、无网络外发、无 DOM 元素生成

异常行为：若静态审查发现任何隐式 HTML 解析或危险 API，一律替换为安全标准 DOM API（如 createElement + textContent），重构后复测

验证：
- 全局搜索 app.js，确认 innerHTML、outerHTML、document.write、eval 出现次数为 0
- 分别将 `<script>alert(1)</script>`、`<img src=x onerror=alert(1)>`、`javascript:alert(1)`、`<iframe src=data:text/html,...>` 填入输入框确认，验证无弹窗且展示区为纯文本
- 检查 index.html 确认无内联 script 逻辑与无外部远程第三方 JS/CSS 链接

完成条件：
- 代码静态审查 0 处不安全 DOM API 调用
- 全部 10 项 XSS Payload 测试均被安全转义为纯文本回显
- 形成安全审计测试清单并归档

假设：遵循 W3C/WHATWG DOM 标准规范

环境：桌面现代主流浏览器，安全审计检查工具或原生文本搜索

步骤：
- 1. 在交付项目根目录对 app.js 执行文本检索：正则匹配 `innerHTML|outerHTML|document\\.write|eval\\(|new Function`，确认匹配结果为 0 项；
- 2. 打开 index.html，检查 head 与 body，确认引用的 styles.css 与 app.js 为相对路径，且无其他远程 script/link 标签；
- 3. 构造 10 组典型跨站脚本 Payload（包括 script 标签、img/svg 的 onerror 事件、a 标签 javascript 伪协议、iframe 注入等）；
- 4. 逐一录入并点击确认，检查 DOM 检查器中展示区节点的 children.length 是否始终为 0，是否仅包含纯 TextNode；
- 5. 检查控制台网络面板与 Console，确认无异常网络外发和异常脚本执行报错。

通过标准：
- 代码中危险 API 出现次数为 0；
- 所有 Payload 均安全显示为纯文本字符串，无任何代码执行行为；
- 无未经声明的外部网络依赖。

证据：静态代码扫描日志与 10 组 Payload 动态测试的 DOM 节点类型查验证明

失败后：若发现任何潜在注入风险点，立刻追溯代码赋值路径，强制改写为 textContent 纯文本绑定，重新执行全量安全用例。

来源：evidence-mdn-textcontent-xss-safety、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489
