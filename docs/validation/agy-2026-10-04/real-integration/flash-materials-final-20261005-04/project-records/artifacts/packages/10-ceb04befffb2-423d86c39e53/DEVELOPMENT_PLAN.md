# 真实集成验证-flash-materials-chinese-20261005-01 — 全阶段开发任务

版本：10；批准蓝图：ceb04befffb2b189662f4785067b15a396095e468c64c83460bfcc2465bac71c

## 开发任务：输入框、校验器与安全展示区联动实现

ID：blk-task-input-display；关联需求：blk-feat-input-display；依赖：blk-flow-input-display

实现单页面内的项目名输入控件、客户端非空校验逻辑、基于 Node.textContent 的安全大字渲染以及提交异常保留输入机制。

目标：完成单页面内项目名输入框、校验器与顶部大字展示区的双向联动与状态保护，落实空值校验提示、XSS 防护及提交失败保留输入机制

范围：纯客户端 DOM 状态管理、输入文本去空格校验、Node.textContent 安全回显、错误提示挂载与提交异常保护

排除：不连接任何后端 API，不进行远程唯一性校验，不引入大型重型表单校验框架，不重载页面

模块：InputComponent、DisplayComponent、Validator

正常行为：输入非空有效项目名并点击确认（或按 Enter 提交）后，调用 event.preventDefault() 拦截默认刷新，通过 Node.textContent 安全更新顶部展示区大字文本，隐藏旧有错误提示，输入框保持当前文本以便后续微调

异常行为：输入空值或全空白字符时，拦截展示区更新，在输入框下方挂载可见红色提示 '项目名不能为空，请输入有效字符'，焦点保留在输入框内，不抹除已有输入；若 DOM 渲染或交互脚本发生意外异常，捕获错误并在界面展示轻量警报条，输入框文本原样保留，页面不崩溃不跳转，用户可修正后重试

验证：
- 在现代桌面浏览器（Chrome/Edge/Firefox）直接加载单页面，输入正常项目名（如 'AiRDUO-Project-01'），验证顶部展示区文本一致且字体高对比醒目
- 输入包含 HTML 标签或特殊字符（如 '<script>alert(1)</script>'、'<div>Test&</div>'），验证展示区通过 Node.textContent 忠实作为纯文本回显，无弹窗且无 DOM 注入风险
- 输入空值或连续半角/全角空格点击确认，验证展示区不更新，输入框下方出现红色明确警示，且输入框内已有空格完好保留
- 模拟 DOM 挂载或运行时抛错，验证错误提示条出现，输入框内的所有字符原样保留且可继续编辑

完成条件：
- 非空有效输入提交后展示区文本与输入内容一致，字体醒目高对比
- 空值提交就地显示红色警示，展示区不刷新，且输入框字符不被强制清空
- 任意 HTML/特殊字符作为纯文本安全渲染，无脚本执行与 DOM 注入风险
- 运行时异常发生时页面不白屏不跳出，输入框文本完好保留供用户恢复重试

假设：运行于现代桌面浏览器（支持 ES6+、标准 DOM API 与 CSS 标准）；用户使用标准键盘与鼠标进行单人本地交互，页面通过 file:// 或本地轻量静态服务器加载

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety、evidence-mdn-event-prevent-default；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 开发任务：一键清空与组件回焦控制

ID：blk-task-reset；关联需求：blk-feat-reset；依赖：blk-flow-reset

实现清空按钮的事件绑定、各组件状态统一重置以及光标自动回焦机制。

目标：实现全局视图状态一键复位与输入框自动回焦控制

范围：清空按钮事件监听、输入框与展示区复位逻辑、错误状态清理与回焦机制

排除：不重载网页，不清除控制台调试日志，不重置浏览器配置

模块：ResetController、StateManager

正常行为：点击底部右侧橙色清空按钮后，无需阻断式二次确认弹窗，立即将输入框 value 设为空字符串，顶部展示区恢复为灰色占位文本 '【等待输入核对】'，隐藏并移除所有现存的校验错误提示，同时调用 inputElement.focus() 自动将光标聚焦回输入框

异常行为：若清空或回焦逻辑抛出未捕获异常，捕获该错误并保留当前视图，向控制台输出错误日志并弹出友好错误提示 '重置失败，请重试'，绝不导致页面崩溃或白屏，用户可手动清空输入框或刷新页面

验证：
- 在已展示有效项目名且有遗留空值警告的状态下点击清空按钮，验证无弹窗阻断、展示区即时恢复占位文字且警告提示彻底消除
- 验证点击清空后输入框内容为空，且键盘光标自动聚焦在输入框内可直接键入
- 验证连续多次点击清空按钮表现稳定，无运行时报错或无预期状态残留

完成条件：
- 点击清空后展示区重置为初始占位符，输入框完全清空且处于聚焦状态
- 前次操作遗留的错误警示彻底清除，页面恢复初始干净就绪态
- 重置逻辑具备异常捕获保护，异常时不发生页面崩溃

假设：所有组件状态均为纯客户端内存受控状态，无异步数据竞争

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 技术开发任务：纯前端原型核对架构与健壮容错实现

ID：blk-tech-task-impl；关联需求：blk-task-input-display、blk-task-reset；依赖：blk-tech-module、blk-tech-interface、blk-tech-error

全面实现纯前端单页面的 DOM 构建、事件绑定、非空校验拦截、Node.textContent 安全展示、清空复位与异常输入保留容错机制。

目标：完成纯原生单页面本地原型核对界面的完整编码实现，建立高内聚模块与健壮的输入保留容错机制

范围：单页面静态 HTML/CSS/JS 编写，包含输入表单、展示大字容器、确认与清空按钮的布局绘制、事件监听、DOM 纯文本渲染、校验拦截与异常捕获防护

排除：不引入 React/Vue/Angular 等前端重型框架，不引入打包构建器（如 Webpack/Vite）强制编译步骤，不引入任何后端 API 与 LocalStorage 存储

模块：AppController、InputController、ValidatorModule、DisplayRenderer、ResetController、FeedbackBanner

正常行为：用户输入非空有效字符串并点击确认（或在输入框内按 Enter 键），系统调用 event.preventDefault() 拦截默认提交行为，调用 ValidatorModule.validate() 通过后，使用 Node.textContent 将内容赋值至顶部大字展示区，清除旧有错误提示，输入框保持原内容供后续微调；用户点击清空按钮后，直接重置展示区为预设占位符，清空输入框并自动触发 inputElement.focus() 回焦光标

异常行为：若输入空值或空白字符，拦截展示更新并在输入框下方就地挂载红色警报提示，严格保留输入框现有文本与焦点；若交互或渲染过程发生未知运行时异常，顶层 try-catch 捕获错误并于界面顶部弹出告警横幅，严格保护输入框内的草稿文本不丢失，页面不白屏不跳出，用户可微调后重试

验证：
- 在主流桌面现代浏览器（Chrome/Edge/Firefox）直接加载 index.html，输入正常字符串并确认，校验顶部大字渲染且输入框文本完好保留
- 输入 '<script>alert(1)</script>' 与 '<div>Safe&Test</div>' 并确认，验证展示区原样纯文本回显，无弹窗且无 DOM 节点注入
- 输入全空格点击确认，验证展示区不刷新，出现明确红色警示，输入框空格完好保留且光标留在输入框内
- 点击清空按钮，验证无二次弹窗，展示区即时恢复灰色占位文字，错误提示消除，输入框清空且光标重新聚焦输入框

完成条件：
- index.html、styles.css、app.js 静态文件构建完成，在桌面现代浏览器中双击直接可用
- 输入有效项目名后点击确认或按 Enter，顶部展示区即时切换大字文本且输入框保持当前文本
- 输入包含 HTML 标签或脚本字符时，作为纯文本安全回显，无弹窗且杜绝 XSS 执行风险
- 空值或纯空白字符提交时，展示区不刷新，输入框就地出现红色错误提示，已有字符完整保留不被清空
- 点击清空按钮无需确认弹窗，展示区立即恢复占位文本，输入框清空且光标自动回焦输入框

假设：页面运行于现代桌面浏览器，完全支持 ES6+、标准 DOM API 与 CSS Flexbox 规范；用户单人单机操作，使用标准桌面键盘与鼠标进行本地原型核对交互

来源：evidence-mdn-htmlinputelement、evidence-mdn-keyboardevent-key、evidence-mdn-document-queryselector、evidence-mdn-node-textcontent-official；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

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

## 交付任务：静态产物装配与免构建交付包就绪

ID：blk-deliv-task-package；关联需求：blk-deliv-spec-deployment；依赖：blk-deliv-spec-deployment

装配标准纯静态代码产物并编写完整自述验证指南，确保个人开发者下载或解压后即可直接使用，无需安装 Node.js/Python 依赖即可直接双击运行。

目标：完成 index.html、styles.css、app.js 与 README.md 的静态装配与交付验证

范围：交付包文件结构组织、无外部 CDN 依赖检查、HTML/CSS/JS 静态关联校验与文档编写

排除：不引入任何 npm 打包或编译工具链，不引入外部第三方字库或远程图标

模块：Packaging、Documentation

正常行为：文件树结构清晰，所有路径均使用相对路径引用；在本地直接双击 index.html 即可在默认桌面浏览器中正常呈现完整的核对界面并完成逻辑加载

异常行为：若文件缺失或相对路径错误导致资源 404，在 README.md 明确提示目录同级约束，并在 app.js 中加入 DOMContentLoaded 状态断言检查，控制台清晰输出缺失资源提示

验证：
- 检查交付目录下包含 index.html、styles.css、app.js 与 README.md 四个核心文件且均在同一级目录
- 检查 HTML 文件中无任何以 http:// 或 https:// 开头的外部资源链接，实现完全本地自包含
- 通过双击 index.html（file:// 协议）与静态服务器（http:// 协议）两种方式分别打开页面，确认样式与逻辑正常装载无控制台报错

完成条件：
- 所有交付文件就绪且相对路径关联正确，无死链或跨域加载限制
- 支持本地无依赖直接双击运行与轻量服务器启动双模式
- README.md 包含详细的启动、核对操作与用例说明

假设：用户在现代桌面操作系统（Windows/macOS/Linux）下获取交付目录；操作系统已安装现代主流桌面浏览器作为默认网页查看器

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付任务：视觉布局结构还原与控件空间排布实现

ID：blk-deliv-task-layout-styling；关联需求：blk-page-main-layout、blk-tech-stack；依赖：blk-page-main-layout、blk-tech-stack

基于 fixture.png 原生像素结构实现单页面 CSS Flexbox 布局，精准还原白底外观、顶部大字展示区、居中输入表单以及底部左蓝矩形、右橙圆形的控件排布映射。

目标：还原 fixture.png 视觉空间映射，实现纯白背景、顶部高对比大字展示、中部输入框与底部蓝矩形/橙圆形按钮排布

范围：HTML 语义化节点结构编写与 CSS 样式表实现，包含桌面端响应式居中容器、按钮外观、焦点状态与换行防溢出控制

排除：不引入复杂的动画库或三方 CSS 预处理器（Sass/Less），不将截图中的文字作为写死业务约束

模块：DisplayRenderer、Styles

正常行为：页面背景为纯白（#FFFFFF），顶部大字展示区字体加粗高对比度（字号≥32px），中部输入表单宽度适中居中排布，底部左侧呈现蓝色实心矩形【确认】按钮（底色 #2F65F6），底部右侧呈现橙色实心正圆形【清空】按钮（底色 #FF5500），操作动线直观明晰

异常行为：若视口宽度极窄或字体加载异常，通过 CSS 备用系统无衬线字体栈（system-ui, -apple-system, sans-serif）与 auto-wrap 规则自适应换行，确保文本不截断不溢出

验证：
- 在 1920×1080、1440×900 与 1024×768 分辨率下查验页面渲染，确认各控件相对位置与 fixture.png 空间排布忠实对应
- 检查顶部展示区在长文本下是否正常折行（word-break: break-all; overflow-wrap: anywhere），无水平滚动条溢出
- 检查确认按钮与清空按钮的矩形与圆形外观、背景色及 hover/active 视觉反馈

完成条件：
- 完成 HTML DOM 与 styles.css 的完整样式编写
- 视觉元素忠实对应 fixture.png 的白底、上部展示区与下部双操作色块映射
- 多分辨率下无布局撑破，长文本自动换行折行

假设：用户在桌面显示器（标准 DPI 或高 DPI 屏幕）下查看页面；浏览器支持标准 CSS Flexbox 与 CSS 自定义属性

来源：evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-css-flexbox；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付任务：项目名输入录入、快捷键监听与安全纯文本展示交付

ID：blk-deliv-task-input-workflow；关联需求：blk-feat-input-display、blk-tech-module、blk-tech-interface；依赖：blk-deliv-task-layout-styling、blk-tech-module、blk-tech-interface

实现输入框与确认按钮交互逻辑，绑定 Enter 键快捷提交（含中文输入法 isComposing 防误触保护），强制使用 Node.textContent 安全渲染，防范 XSS 漏洞，并在确认后保留输入框文本供微调。

目标：实现输入录入、Enter 快捷键触发、Node.textContent 安全展示及输入草稿完好保留逻辑

范围：InputController 与 DisplayRenderer 编码实现，事件监听、输入法合成防误触与 DOM 文本节点安全赋值

排除：不引入富文本编辑器，不使用 innerHTML 解析用户输入，不进行网络请求

模块：InputController、DisplayRenderer、ValidatorModule

正常行为：用户在输入框键入有效项目名，点击确认按钮或在非输入法合成状态下按下键盘 Enter 键（event.key === 'Enter' && !event.isComposing），拦截默认页面刷新，校验通过后调用 displayElement.textContent 安全赋值，顶部即时高对比呈现该项目名，旧错误提示自动消失，输入框完好保留当前文本供后续微调

异常行为：若输入含恶意标签或特殊字符（如 <script>、<img>），严格经由 textContent 转化为纯字符回显，不解析为 DOM 节点，杜绝脚本执行；若遇到空值则移交校验拦截，不抹除输入文本

验证：
- 在输入框输入常规项目名 'Project-Alpha-01' 并回车，核对顶部大字即时显示且输入框文本保留
- 在输入框输入 '<img src=x onerror=alert(1)>' 并点击确认，核对展示区原样输出标签字符串，无控制台告警或弹窗执行
- 在中文输入法状态下输入拼音并按回车确认候选词，核对界面不提前触发提交操作
- 输入包含连续空格与特殊符号的复杂项目名（如 ' #@%& Test Project_2026 '），核对展示区内容完整展示

完成条件：
- 支持点击按钮与键盘 Enter 键双通道确认提交，且中文输入法选词时不发生误提交
- 顶部大字通过 Node.textContent 安全渲染，从根本杜绝 XSS 注入
- 提交成功后输入框内容完好保留，方便用户二次编辑

假设：浏览器事件循环机制正常，支持标准 KeyboardEvent 与 click 事件

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety、evidence-mdn-event-prevent-default、evidence-mdn-keyboardevent-key；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付任务：一键即时直接清空与焦点自动恢复交付

ID：blk-deliv-task-reset-workflow；关联需求：blk-feat-reset、blk-tech-module、blk-tech-interface；依赖：blk-deliv-task-layout-styling、blk-tech-module、blk-tech-interface

落实用户已确认的“即时直接清空”决策，点击清空按钮立即复位状态并回焦输入框，无二次确认阻断。

目标：实现底部右侧橙色圆形清空按钮的即时复位逻辑与光标自动回焦

范围：ResetController 编码实现，输入框 value 清空、展示区恢复占位文本、历史错误清除与 inputElement.focus() 调用

排除：不弹出 window.confirm 或任何阻塞式模态弹窗，不刷新浏览器页面

模块：ResetController、InputController、DisplayRenderer、FeedbackBanner

正常行为：用户点击橙色圆形清空按钮，系统立即清空输入框文本（value = ''），将顶部展示区重置为灰字占位符 '【等待输入核对】'，移除输入框错误高亮和错误提示节点，并立即执行 inputElement.focus() 使光标恢复至输入框内，等待下一轮核对

异常行为：若执行重置逻辑时捕获到异常，保留当前页面状态，在控制台打印排查日志并在界面呈现温和提示，页面不崩溃不跳转，用户可手动清空或刷新

验证：
- 在已有输入内容和展示结果的状态下点击清空，验证无阻断弹窗，页面各区域瞬间恢复初始待命态
- 验证点击清空后，无需手动用鼠标再次点击输入框即可直接通过键盘键入新文本（自动回焦生效）
- 连续快速点击 5 次清空按钮，验证无 JavaScript 报错，保持稳定幂等性

完成条件：
- 严格遵守 dec-clear-interaction-mode，无二次确认阻断
- 一键同步复位输入框、展示区与错误提示
- 光标准确自动回焦至输入框

假设：用户接受误触清空需重新输入的代价（已在决策中确认）

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 交付任务：校验失败拦截、就地提示与异常保留输入容错交付

ID：blk-deliv-task-error-handling；关联需求：blk-tech-error、blk-tech-interface；依赖：blk-deliv-task-input-workflow、blk-tech-error

落实“失败时保留输入”核心决策与空值校验提示机制，提供端到端健壮容错，杜绝在校验拦截或异常时抹除用户输入。

目标：实现严密的非空校验拦截、就地错误警示节点挂载，以及发生错误或异常时严格保留用户既有输入的容错机制

范围：ValidatorModule 规则校验、FeedbackBanner 挂载与销毁、全局 window.onerror 兜底防护及输入框状态锁定控制

排除：不进行异步表单校验，不在空值时直接清空输入框内容

模块：ValidatorModule、FeedbackBanner、AppController

正常行为：当输入为空字符串或全为空白字符（如空格、制表符）时，点击确认或按回车被拦截，在输入框下方动态挂载 <div class="error-tip" aria-live="polite">项目名不能为空，请输入有效字符</div>，输入框边框高亮红色，输入框内现存字符完全保留不被抹除，光标停留在输入框内；当用户补充键入有效字符并提交时，自动移除错误提示并更新展示区

异常行为：若在事件处理或 DOM 操作中发生意外未捕获异常，顶层 try-catch 拦截并在顶部弹出告警横幅 '系统遇到异常，已为您保留当前输入'，绝不执行重载或清空输入框 value，确保开发者输入不丢失，允许用户继续修改并重试

验证：
- 输入空字符串点击确认，核对输入框下方出现红色明确提示，展示区不刷新，且输入框焦点保留
- 输入 '   '（纯空格）点击确认，核对出现红色提示，且输入框内的空格完好保留未被清空
- 人为模拟 JS 运行时报错（如向不存在的元素写属性），核对错误横幅正常浮现，输入框文本原样保留可继续编辑

完成条件：
- 空值提交产生明确就地可见提示（非原生浏览器气泡，可控可达）
- 严格遵守 dec-failure-preserve-input，任何失败场景绝不抹除用户输入内容
- 具备全局异常拦截与友好提示，页面绝不崩溃白屏

假设：用户在核对过程中可能反复进行空值测试或编辑微调

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-event-prevent-default；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

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
