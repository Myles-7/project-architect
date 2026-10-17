# 真实集成验证-flash-materials-chinese-20261005-01 — 技术与接口

版本：10；批准蓝图：ceb04befffb2b189662f4785067b15a396095e468c64c83460bfcc2465bac71c

## 技术栈选型与运行规范

ID：blk-tech-stack；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

技术栈选型严格遵守已批准的纯前端单页面边界约束，采用纯原生 HTML5、CSS3 与现代原生 JavaScript（ES2022+ 标准）：
1. 标记层（HTML5）：采用标准语义化标签（<main>, <section>, <form>, <input>, <button>），通过 WAI-ARIA 属性（如 aria-live="polite"）辅助就地错误提示展示，不依赖任何第三方 UI 库；
2. 表现层（CSS3）：采用 CSS Flexbox 弹性布局规范，通过现代 CSS 自定义属性管理主题色（如确认按钮底色 #2F65F6、清空按钮底色 #FF5500），配置全局盒模型 box-sizing: border-box 与文本折行规则 word-break: break-all，实现忠实还原 fixture.png 的白底与高对比度排布；
3. 交互与控制层（ES2022+）：采用纯原生现代 JavaScript（ESM 模块化），使用原生 DOM API（Document.querySelector, Node.textContent, HTMLElement.focus）与原生事件模型（addEventListener, Event.preventDefault），零外部 npm 运行时依赖，完全支持离线本地直接运行；
4. DOM 安全输出：全面采用 W3C/WHATWG 标准 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML，从根本上杜绝 DOM 型 XSS 漏洞；
5. 运行环境兼容：兼容主流现代桌面浏览器（Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15），零需转译即可原生执行。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-htmlinputelement、evidence-mdn-document-queryselector、evidence-mdn-css-flexbox、evidence-mdn-node-textcontent-official；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 前端系统架构与核心功能模块划分

ID：blk-tech-module；关联需求：blk-prod-scope、blk-feat-input-display、blk-feat-reset；依赖：blk-tech-stack、blk-feat-input-display、blk-feat-reset

前端采用低耦合、高内聚的模块化架构，划分为核心协调控制器与 5 个专用功能模块：
1. AppController（核心应用协调器）：应用生命周期管理入口，负责 DOM 树加载就绪检查（DOMContentLoaded）、模块装配与挂载、全局未捕获异常监听（window.addEventListener('error')），协调跨组件状态流转；
2. InputController（输入与键盘监听控制器）：封装 <input type="text"> 的交互监听，处理 input 输入事件与 keydown 按键事件（匹配 event.key === 'Enter' 时代理触发确认流程），提供 getInputText()、setInputText(val) 与 focusInput() 接口；
3. ValidatorModule（规则校验器）：无状态纯函数校验模块，提取输入字符串并执行 trim() 去除首尾空白字符，返回结构化校验判定对象 { isValid: boolean, errorMessage: string | null }；
4. DisplayRenderer（安全大字展示渲染器）：负责顶部结果展示区的视图更新，严格强制使用 Node.textContent 进行文本注入，绝不使用 innerHTML，彻底阻断任何 HTML/Script 脚本注入，并处理初始占位状态与换行防撑破样式；
5. ResetController（清空复位与回焦控制器）：响应底部右侧清空按钮点击，协调调用 InputController 清空文本、DisplayRenderer 复位为占位符、FeedbackBanner 移除错误节点，并调用 input.focus() 自动恢复焦点；
6. FeedbackBanner（错误提示与容错横幅组件）：管理输入框下方就地红色错误提示节点（aria-live="polite"）以及全局意外异常警告横幅的挂载、呈现与清理。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-document-queryselector、evidence-mdn-htmlinputelement、evidence-mdn-node-textcontent-official；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 客户端运行时数据模型与状态结构规范

ID：blk-tech-data-model；关联需求：blk-prod-scope、blk-feat-input-display、blk-feat-reset；依赖：blk-tech-module

客户端运行时采用单向流动的纯内存数据模型，不使用任何本地持久化存储（如 LocalStorage、IndexedDB），确保单次测试独立且不污染后续测试：
1. 校验判定结构体（ValidationResult）：
   - isValid: boolean（是否通过非空规则校验）；
   - errorMessage: string | null（校验未通过时的就地展示提示文案，例如 '项目名不能为空，请输入有效字符'；校验通过为 null）。
2. 全局运行时状态模型（AppState）：
   - projectName: string | null（当前已确认并在顶部大字展示的项目名，初始态为 null）；
   - inputDraft: string（输入框当前正在键入的草稿文本，初始态为空字符串 ''）；
   - status: 'idle' | 'validating' | 'displayed' | 'error'（界面所处交互生命周期状态）；
   - validationError: string | null（当前挂载在输入框下方的错误信息，无错误时为 null）；
   - placeholderText: string（顶部展示区在初始或清空态下的灰字占位符，常量定义为 '【等待输入核对】'）。
3. 状态转换路径：
   - [初始态 idle]：projectName=null, inputDraft='', validationError=null -> 展示区呈现灰字占位符；
   - [输入录入]：用户键入更新 inputDraft，其他状态保持；
   - [有效提交]：ValidatorModule 校验通过 -> status='displayed', projectName=inputDraft, validationError=null -> 展示区高亮呈现黑色大字，inputDraft 保留；
   - [空值提交]：ValidatorModule 校验失败 -> status='error', validationError='项目名不能为空，请输入有效字符', projectName 与 inputDraft 保持原样，展示区不更新；
   - [一键清空]：触发重置 -> 复位至 [初始态 idle]，所有字段归位，焦点重新绑定至 inputDraft。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 组件事件契约与模块调用接口规范

ID：blk-tech-interface；关联需求：blk-feat-input-display、blk-feat-reset；依赖：blk-tech-data-model

各模块间通过明确的函数签名与原生事件契约进行交互解耦：
1. ValidatorModule 接口契约：
   - validate(rawInput: string): { isValid: boolean, errorMessage: string | null }
     入参：用户当前在输入框键入的原始文本；
     处理：执行 rawInput.trim()，若长度为 0 则返回 { isValid: false, errorMessage: '项目名不能为空，请输入有效字符' }，否则返回 { isValid: true, errorMessage: null }。
2. DisplayRenderer 接口契约：
   - renderProjectName(targetElement: HTMLElement, text: string): void
     处理：调用 targetElement.textContent = text，移除占位灰字样式，应用黑色加粗高对比度展示样式；
   - renderPlaceholder(targetElement: HTMLElement, placeholder: string): void
     处理：调用 targetElement.textContent = placeholder，应用灰色占位展示样式。
3. FeedbackBanner 接口契约：
   - showInputError(inputElement: HTMLElement, containerElement: HTMLElement, errorMsg: string): void
     处理：为 inputElement 增加错误边框样式（如 border-color: #E53E3E），在 containerElement 内挂载 <div class="error-tip" aria-live="polite"> 节点并赋值 errorMsg；
   - clearInputError(inputElement: HTMLElement, containerElement: HTMLElement): void
     处理：移除 inputElement 错误边框高亮，查找并销毁现存的 .error-tip 节点；
   - showRuntimeAlert(alertMsg: string): void
     处理：在页面顶部挂载轻量告警横幅，输出友好排查信息。
4. 事件流契约：
   - 确认按钮点击事件（confirmButton.addEventListener('click', handleConfirm)）与输入框回车事件（inputElement.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleConfirm(e); })）统一派发至 handleConfirm；
   - 清空按钮点击事件（resetButton.addEventListener('click', handleReset)）派发至 handleReset，按已批准决策直接清空，无阻断弹窗。

来源：evidence-mdn-htmlinputelement、evidence-mdn-keyboardevent-key、evidence-mdn-event-prevent-default、evidence-mdn-node-textcontent-official；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 错误分类、校验拦截机制与输入保留恢复策略

ID：blk-tech-error；关联需求：blk-feat-input-display、blk-prod-outcomes；依赖：blk-tech-interface

建立全面的客户端异常捕获与容错恢复机制，重点落实“失败时保留输入”决策：
1. E01 校验失败（空值或纯空白字符提交）：
   - 场景：用户未键入字符或仅键入多个空格即点击确认或按 Enter；
   - 拦截行为：ValidatorModule 判定 isValid 为 false，调用 event.preventDefault() 拦截默认动作，展示区内容完全冻结不刷新；
   - 呈现行为：调用 FeedbackBanner.showInputError 在输入框正下方挂载可见的红色警示文本“项目名不能为空，请输入有效字符”，输入框边框变红并保持高亮；
   - 保留与恢复：输入框内的既有字符（包括用户已输入的空格等文本）严格原样保留，光标保持在输入框内部，绝不执行 inputElement.value = '' 清空操作；用户补充输入有效字符后再次提交，自动移除错误提示；
2. E02 意外 DOM 异常与脚本运行时错误（Runtime Exception）：
   - 场景：浏览器极端环境、DOM 节点获取失败或渲染过程抛出未捕获 Error；
   - 拦截行为：在 handleConfirm 与 handleReset 外层封装严格的 try...catch (err) 异常保护；
   - 呈现行为：捕获异常并在页面顶部通过 FeedbackBanner.showRuntimeAlert 展示轻量警示条“操作执行遇到意外异常，已为您保留当前输入内容”，同时在控制台通过 console.error 输出完整堆栈；
   - 保留与恢复：发生任何异常时，绝不重载或重定向页面，不抹除 inputElement.value 中的任何既有文本，输入框保持可编辑状态供用户修改或重新点击提交；
3. E03 极端超长文本输入防撑破（Overflow Protection）：
   - 场景：输入数千至上万字符的超长字符串；
   - 防护行为：展示区与输入框统一样式设置 overflow-wrap: anywhere; word-break: break-all; max-width: 100%，确保长字符串在容器内自动换行折行，杜绝撑破页面布局或横向滚动条失控；
4. E04 清空操作防死锁与幂等性：
   - 场景：连续多次快速点击清空按钮或在初始空状态下点击清空；
   - 行为：清空逻辑为纯状态复位，无异步排队，多次触发保持幂等，不抛出异常。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety、evidence-mdn-node-textcontent-official；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 运行环境版本要求与本地静态部署规范

ID：blk-tech-deployment；关联需求：blk-prod-target、blk-prod-scope；依赖：blk-tech-stack

部署与运行方案面向个人开发者的本地无门槛极简运行场景设计：
1. 目标运行环境版本要求：
   - 操作系统：Windows 10/11、macOS 12+ 或主流 Linux 桌面环境；
   - 目标浏览器：现代主流桌面浏览器最新稳定版（Google Chrome ≥ 100, Microsoft Edge ≥ 100, Mozilla Firefox ≥ 100, Apple Safari ≥ 15）；
   - 硬件要求：标准桌面设备，支持 1024×768 及以上分辨率显示器、鼠标与键盘；
2. 静态部署与启动模式：
   - 模式 A（零安装直接双击运行）：直接通过文件资源管理器双击 index.html（file:// 协议加载），无须启动任何 HTTP 服务；
   - 模式 B（轻量本地服务器托管）：通过本地已有轻量静态服务运行，例如在项目根目录执行 npx serve . 或 python -m http.server 8080，访问 http://localhost:8080；
3. 静态产物组织结构：
   ```
   ├── index.html        # 单页面主入口，包含语义化 DOM 骨架与无障碍标记
   ├── styles.css        # 视觉样式表，实现基于 fixture.png 的白底与控件空间排布映射
   ├── app.js            # 模块化纯原生 JavaScript 脚本（AppController 与各子模块实现）
   └── README.md         # 本地启动、操作说明与验证测试指南
   ```
4. 无后端/无云服务声明：
   本产品不包含任何服务端后端程序、不调用任何云端 API、不进行任何跨域网络请求，完全自主运行在用户本地浏览器沙箱中。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-htmlinputelement；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340

## 交付产物文件组织与双启动模式规范

ID：blk-deliv-spec-deployment；关联需求：blk-tech-deployment、blk-prod-scope；依赖：blk-tech-deployment

交付产物严格遵循零服务器、零构建工具链依赖的极简静态标准，目录结构由 4 个同级核心文件组成：
1. index.html：标准语义化单页面 DOM 骨架，通过 <meta charset="UTF-8"> 与 <meta name="viewport" content="width=device-width, initial-scale=1.0"> 声明规范，外链 styles.css，通过 <script defer src="app.js"></script> 异步延迟加载逻辑，代码内不含任何外部 CDN 资源或远程字体，完全支持离线本地加载；
2. styles.css：基于 fixture.png 映射的样式实现，包含纯白背景（#FFFFFF）、顶部居中大字展示容器（加粗高对比、break-all 自动折行）、底部左侧蓝色主操作矩形按钮（#2F65F6）与底部右侧橙色辅助操作圆形按钮（#FF5500），并包含就地红色错误提示（#E53E3E）与焦点高亮状态；
3. app.js：纯原生现代 JavaScript（ES2022+）编写，采用闭包作用域（IIFE）封装 AppController、InputController、ValidatorModule、DisplayRenderer、ResetController 与 FeedbackBanner 各模块，绑定 DOMContentLoaded 事件就绪检查，全面采用 Node.textContent 进行安全回显，杜绝 innerHTML；
4. README.md：极简操作指南，详细记录本地文件管理器直接双击运行模式（file:// 协议）与本地轻量 HTTP 服务器启动模式（如 python -m http.server 8080 或 npx serve .），并提供完整的自测核对操作步骤。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-delivery-1791131287489

## 可行性证据

- answer-dec-09b0c6bd-21ae-4e5e-8c2b-8e2893cd4c0d：即时直接清空；来源 question:run-c463e392-91bc-4076-b7fb-514ce507bc3f-delivery-0-ques-clear-confirmation；日期 2026-10-04T16:12:46.337Z；适用范围 dec-clear-interaction-mode；结果 参考证据；哈希 未提供。
- evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f：我想做一个给自己用的本地原型核对页面：上传截图仅作布局参考；文字说明负责行为，不自动把图里的示例文字变成业务需求。只做一个输入项目名、点击确认、展示项目名和清空的单页面。目标是快速核对输入反馈，失败时保留输入。浏览器运行，桌面优先；无需服务端、登录、协作或支付。核心验收：输入任意项目名后可确认显示，空值有提示；具体布局请完整查看截图并描述真实内容。其余普通细节明确委托 AI 拟定，设计建议仍待批准。；来源 material:input:inp-01；日期 2026-10-04T16:08:03.059Z；适用范围 用户原始需求、功能范围界定与非目标约束依据；结果 passed；哈希 5feeb9ec9123fa64c0c12e448303eaafebb56333c01fe10738a5af505148d1f3。
- evidence-89fe01db-82bb-475e-9d76-5a379bda0e07：fixture.png 真实像素呈现白底背景，上方居中偏左为黑色无衬线文本“Q7M4-8261”，下方左侧为蓝色矩形色块，下方右侧为橙色圆形色块。布局结构对应为：顶部/上方结果展示区域，底部/下方左侧为主操作区域（确认按钮），底部/下方右侧为辅助操作区域（清空按钮）。；来源 material:input:inp-1791129999124；日期 2026-10-04T16:08:06.988Z；适用范围 参考截图视觉元素与空间结构映射依据；结果 passed；哈希 0e4b4b8fa59957ba9320f18df50383c59f4ad40978b0cba304d20c0f85bb14a0。
- evidence-mdn-textcontent-xss-safety：MDN 官方文档 Node: textContent property 指出：textContent 属性表示节点及其后代的文本内容。MDN 明确建议避免使用 innerHTML 来获取或设置元素内的文本，因为 innerHTML 处理原始 HTML 而非纯文本，容易受到 XSS 攻击；而 textContent 不调用 HTML 解析器，能够保证文本安全地作为纯文本呈现，避免 XSS 漏洞。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent；日期 2026-10-04T16:08:26.012Z；适用范围 可行性与安全防护分析依据：用户输入任意项目名可能包含 HTML 标签、特殊符号或潜在脚本字符串。项目名展示区必须使用 Node.textContent（或同等安全文本绑定）进行回显，从根本上杜绝 DOM 型 XSS 注入风险，确保纯前端展示的安全与鲁棒性。；结果 not-applicable；哈希 fde1787705a45a0ec71c5eab0e9c2a2acb0151d62eaf9a4092593c69e74dfcb8。
- evidence-mdn-event-prevent-default：MDN 官方文档 Event: preventDefault() method 指出：preventDefault() 方法告知用户代理该事件正在被显式处理，其默认行为（如表单提交导致页面刷新跳转、链接导航等）不应执行。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault；日期 2026-10-04T16:08:43.712Z；适用范围 异常处理与交互体验依据：用户在输入框按 Enter 或点击确认提交时，若采用原生 form 或按钮结构，必须调用 preventDefault() 阻止浏览器默认页面刷新行为，从而保证纯前端单页面的即时校验、空值错误提示与失败保留输入得以稳定生效。；结果 not-applicable；哈希 41e832f668dde9a4c32adbb89bedce1b323932d878f57b1bdea773d12da7a877。
- evidence-mdn-node-textcontent-official：MDN 官方文档规范指出：Element.innerHTML 会调用 HTML 解析器处理原始 HTML 字符串，容易受到 XSS 跨站脚本攻击；而 Node.textContent 属性用于获取或设置节点内的纯文本内容，设置 textContent 会用包含指定字符串的单个文本节点替换该节点的所有子节点，不调用 HTML 解析器，因此在渲染不受信任的用户输入时具备天然安全性。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent；日期 2026-10-04T16:17:03.536Z；适用范围 规范项目名安全渲染，证实 Node.textContent 替换纯文本节点且不调用 HTML 解析器，从根本上防止 DOM 型 XSS 漏洞；结果 passed；哈希 fde1787705a45a0ec71c5eab0e9c2a2acb0151d62eaf9a4092593c69e74dfcb8。
- evidence-mdn-htmlinputelement：HTMLInputElement 接口提供操作 <input> 元素的属性与方法，包括 value 属性表示当前输入控件的字符串值，支持直接读写与清空，并在所有现代桌面浏览器中原生广泛支持。；来源 https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement；日期 2026-10-04T16:17:15.241Z；适用范围 适用于纯前端文本输入框的取值、非空校验与清空重置操作。；结果 passed；哈希 0e241134468e95dd8137f1eea7e1d79ff38cde4ad4cba3fe3b436bf1f5870a70。
- evidence-mdn-keyboardevent-key：KeyboardEvent.key 属性标准化返回用户按下的按键值（如 'Enter'），自 2017 年起已在主流现代桌面浏览器全面支持，适用于监听回车快捷键提交。；来源 https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key；日期 2026-10-04T16:17:54.100Z；适用范围 适用于输入框捕获 Enter 回车键并触发核对确认操作。；结果 passed；哈希 b6651158a5339f9a4f31e3c2134ad1f1c02cb201b5a93da584a195e5fed9bf6f。
- evidence-mdn-css-flexbox：CSS Flexible Box Layout（Flexbox）提供一维弹性布局模型，支持主轴与交叉轴的灵活对齐、居中分布与自适应扩展，广泛支持于所有主流现代桌面浏览器。；来源 https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox；日期 2026-10-04T16:18:22.239Z；适用范围 适用于依据参考图排布实现白底居中卡片、顶部展示区与底部按钮的弹性布局。；结果 passed；哈希 44c9f8916fe1fc868263573ca37021e8da27ab5c2a0b1e6ed678898bc1881449。
- evidence-mdn-document-queryselector：Document.querySelector() 方法依据 CSS 选择器返回匹配的第一个 Element，属于标准 DOM API，在所有主流桌面浏览器中原生支持，零框架依赖。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector；日期 2026-10-04T16:18:30.609Z；适用范围 适用于轻量单页面精准获取输入框、按钮和展示容器 DOM 节点并绑定事件。；结果 passed；哈希 c3f2b60284884821f7570e86ae4e52d3acfbb3eea92d85afddab455553840fcf。
- evidence-exp-docker-env-unavailable：在规划环境中通过 environment_prepare 探测 Node.js 受控实验容器运行时，由于 Docker 引擎管道未启动导致容器环境不可用，规划期受控试验未执行。所有 XSS 防护与性能耗时验证已完整编排为后续真实现代桌面浏览器前置验证任务。；来源 environment:prepare-65356e0f-5685-4c49-a2be-b152d9ed0b9b；日期 2026-10-04T16:21:10.000Z；适用范围 记录规划环境受控试验不可用状态，确立交付阶段浏览器真实测试依赖；结果 unexecuted；哈希 未提供。
- evidence-320443a6-461c-4976-9039-908598ac05f0：You need to pay attention to local testing — if you try to load the HTML file locally (i.e., with a file:// URL), you'll run into CORS errors due to JavaScript module security requirements. You need to do your testing through a server. Also, note that you might get different behavior from sections of script defined inside modules as opposed to in classic scripts.；来源 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules；日期 2026-10-04T16:24:04.677Z；适用范围 官方规范查证：用于 delivery 阶段指导纯静态单页面产物采用兼容 file:// 本地双击零服务器直接运行的脚本组织形态，并在交付验证任务中建立 file:// 与 http:// 双模式的端到端验收与验证标准。；结果 passed；哈希 deb285e95e1dca43e123ad6ef9f8eab6dd7bf2a022f373e5cfc37f24d88694e9。
- evidence-docker-env-prep-delivery：environment_prepare (node) failed to connect to docker API at npipe:////./pipe/dockerDesktopLinuxEngine. Container execution is unavailable.；来源 experiment:prepare-f8436798-b32b-41e3-ad57-05fa2786f8a4；日期 2026-10-04T16:24:30.000Z；适用范围 当前规划环境受控运行环境检查：规划宿主机未启动 Docker Desktop Linux Engine，容器执行环境 unavailable。因此端到端全量浏览器测试与性能实测转为交付前置验证任务在个人开发者真实桌面浏览器环境中执行。；结果 unexecuted；哈希 c18a221fca48dd444458f4a7c0f1624c96c4e09886a111a43a054ec99f1c7128。
