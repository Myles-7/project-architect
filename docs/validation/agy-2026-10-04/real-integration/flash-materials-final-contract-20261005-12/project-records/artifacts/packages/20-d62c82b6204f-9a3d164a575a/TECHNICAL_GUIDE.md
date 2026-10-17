# 真实集成验证-flash-materials-chinese-20261005-01 — 技术与接口

版本：20；批准蓝图：d62c82b6204f98bbcb5bd6c04df36e8cbb71ec00b157e72bf09fd2e173491ec7

## 前端系统架构与核心功能模块划分（引入 DebounceScheduler）

ID：blk-tech-module；关联需求：blk-prod-scope、blk-feat-input-display、blk-feat-reset；依赖：blk-tech-stack、blk-feat-input-display、blk-feat-reset

前端采用低耦合、高内聚的模块化架构，划分为核心应用控制器与 5 个专用功能模块，彻底剔除确认按钮专属模块：
1. AppController（核心应用协调器）：入口装配中心，监听 DOMContentLoaded 就绪事件，挂载全局 window.addEventListener('error') 兜底，协调组件间流转；
2. InputController（输入与输入法监听控制器）：封装 <input type="text"> 的原生 input 事件及 compositionstart、compositionend 事件监听，维护 isComposing 状态标记，提取实时文本，并在非合成态或选词完成后触发 DebounceScheduler 启动防抖；提供 getInputText()、setInputText(val) 与 focusInput() 接口；
3. DebounceScheduler（防抖调度器）：封装 Window.setTimeout 与 Window.clearTimeout，管理 300ms 倒计时生命周期，提供 schedule(task, delayMs)、cancel() 与 isPending() 接口，确保单任务排队执行；
4. ValidatorModule（规则校验器）：无状态纯函数校验模块，执行 trim() 校验，返回 { isValid: boolean, errorMessage: string | null }；
5. DisplayRenderer（安全大字展示渲染器）：负责顶部展示区视图更新，强制使用 Node.textContent 纯文本赋值，严禁 innerHTML；
6. ResetController（清空复位控制器）：响应清空按钮点击，第一优先级调用 DebounceScheduler.cancel() 销毁待展示任务，继而清空输入框、复位展示区为占位符、移除错误提示并回焦输入框；
7. FeedbackBanner（错误提示组件）：管理输入框下方就地红色错误提示节点（aria-live="polite"）与全局异常横幅。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-document-queryselector、evidence-mdn-htmlinputelement、evidence-mdn-node-textcontent-official、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 客户端运行时数据模型与状态结构规范（增加防抖定时器句柄）

ID：blk-tech-data-model；关联需求：blk-prod-scope、blk-feat-input-display、blk-feat-reset；依赖：blk-tech-module

客户端运行时采用单向流动的纯内存数据模型，不使用任何本地持久化存储（如 LocalStorage、IndexedDB），确保单次测试独立且不污染后续测试：
1. 校验判定结构体（ValidationResult）：
   - isValid: boolean（是否通过非空规则校验）；
   - errorMessage: string | null（未通过时提示文案，例如 '项目名不能为空，请输入有效字符'；通过为 null）。
2. 全局运行时状态模型（AppState）：
   - projectName: string | null（当前已核对并在顶部大字展示的项目名，初始态为 null）；
   - inputDraft: string（输入框当前键入的草稿文本，初始态为空字符串 ''）；
   - isComposing: boolean（当前是否处于中文输入法合成态，初始态为 false）；
   - status: 'idle' | 'debouncing' | 'displayed' | 'error'（界面所处交互生命周期状态）；
   - pendingTimerId: number | null（当前活跃的 300ms 防抖定时器 ID，无排队任务时为 null）；
   - validationError: string | null（当前挂载在输入框下方的错误信息，无错误时为 null）；
   - placeholderText: string（顶部展示区在初始或清空态下的灰字占位符，常量定义为 '【等待输入核对】'）。
3. 状态转换路径：
   - [初始态 idle]：projectName=null, inputDraft='', isComposing=false, pendingTimerId=null, validationError=null -> 展示区呈现灰字占位符；
   - [普通输入录入]：用户键入更新 inputDraft，isComposing=false -> status='debouncing', pendingTimerId 激活 300ms 倒计时；
   - [IME 合成中]：触发 compositionstart -> isComposing=true，挂起防抖定时器；
   - [IME 选词上屏]：触发 compositionend -> isComposing=false，更新 inputDraft，激活 300ms 倒计时；
   - [300ms 到期且非空]：ValidatorModule 校验通过 -> status='displayed', pendingTimerId=null, projectName=inputDraft, validationError=null -> 展示区呈现黑色大字，inputDraft 保留；
   - [300ms 到期且空值]：ValidatorModule 校验失败 -> status='error', pendingTimerId=null, validationError='项目名不能为空，请输入有效字符', projectName 恢复占位，inputDraft 保持原样；
   - [一键清空]：触发重置 -> 立即调用 clearTimeout(pendingTimerId), pendingTimerId=null, isComposing=false -> 复位至 [初始态 idle]，所有字段归位，焦点重新绑定至 inputDraft。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 组件事件契约与模块调用接口规范（防抖调度契约）

ID：blk-tech-interface；关联需求：blk-feat-input-display、blk-feat-reset；依赖：blk-tech-data-model

各模块间通过明确的函数签名与原生事件契约进行交互解耦，彻底删除确认按钮专属契约：
1. DebounceScheduler 接口契约：
   - schedule(callback: () => void, delayMs: number = 300): void
     处理：若已存在 timerId 则执行 clearTimeout(timerId)；设置新 setTimeout，在 delayMs 到期后执行 callback 并将 timerId 清空。
   - cancel(): void
     处理：若存在 timerId 则执行 clearTimeout(timerId) 并置 null。
   - isPending(): boolean
     处理：返回 timerId !== null。
2. InputController 与输入法事件契约：
   - inputElement.addEventListener('compositionstart', () => { isComposing = true; DebounceScheduler.cancel(); });
   - inputElement.addEventListener('compositionend', (e) => { isComposing = false; DebounceScheduler.schedule(handleDebouncedValidateAndDisplay, 300); });
   - inputElement.addEventListener('input', (e) => { if (!isComposing && !e.isComposing) DebounceScheduler.schedule(handleDebouncedValidateAndDisplay, 300); });
3. ValidatorModule 接口契约：
   - validate(rawInput: string): { isValid: boolean, errorMessage: string | null }
     处理：执行 rawInput.trim()，若长度为 0 返回 { isValid: false, errorMessage: '项目名不能为空，请输入有效字符' }，否则返回 { isValid: true, errorMessage: null }。
4. DisplayRenderer 接口契约：
   - renderProjectName(targetElement: HTMLElement, text: string): void
     处理：targetElement.textContent = text，移除占位灰字样式，应用黑色加粗高对比展示样式。
   - renderPlaceholder(targetElement: HTMLElement, placeholder: string): void
     处理：targetElement.textContent = placeholder，应用灰色占位展示样式。
5. FeedbackBanner 接口契约：
   - showInputError(inputElement: HTMLElement, containerElement: HTMLElement, errorMsg: string): void
   - clearInputError(inputElement: HTMLElement, containerElement: HTMLElement): void
   - showRuntimeAlert(alertMsg: string): void
6. 清空重置契约：
   - resetButton.addEventListener('click', handleReset) 统一驱动重置，handleReset 内部第一步调用 DebounceScheduler.cancel() 并重置 isComposing = false。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-mdn-htmlinputelement、evidence-mdn-node-textcontent-official、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 错误分类、防抖拦截机制与异步竞态容错策略

ID：blk-tech-error；关联需求：blk-feat-input-display、blk-prod-outcomes；依赖：blk-tech-interface

建立全面的客户端异常捕获与容错恢复机制，重点落实“失败时保留输入”决策与防抖竞态防护：
1. E01 防抖校验拦截（空值或纯空白字符输入）：
   - 场景：用户键入若干空格或将文字全部删空，且 300ms 防抖倒计时结束；
   - 拦截行为：ValidatorModule 判定 isValid 为 false，展示区内容复位为占位符；
   - 呈现行为：调用 FeedbackBanner.showInputError 在输入框正下方挂载可见红色警示“项目名不能为空，请输入有效字符”，输入框边框变红并保持高亮；
   - 保留与恢复：输入框内的既有字符（含空格）严格原样保留，光标保持在输入框内部，绝不执行清空操作；用户补充输入有效字符后重新触发 300ms 防抖自动移除报错；
2. E02 异步竞态与幽灵渲染防护（Ghost Render Prevention）：
   - 场景：用户键入过程中立即点击清空按钮，或在 300ms 倒计时未结束前连续键入新字符；
   - 防护行为：必须无条件调用 DebounceScheduler.cancel() 执行 clearTimeout(pendingTimerId)，确保排队中的老回调彻底作废，杜绝老输入在 300ms 后再次覆盖界面；
3. E03 输入法合成态竞态防护（IME Composition Guard）：
   - 场景：用户输入拼音选词过程中发生防抖计时器误触；
   - 防护行为：通过 isComposing 与 compositionstart/compositionend 双重锁阻断中间未完成拼音字符上屏，杜绝将半截拼音错误作为项目名渲染；
4. E04 意外 DOM 异常与脚本运行时错误（Runtime Exception）：
   - 场景：DOM 节点获取失败或回调执行抛出未捕获 Error；
   - 拦截行为：在防抖回调与 handleReset 外层封装严格的 try...catch 保护；
   - 呈现行为：展示轻量警示条，并在控制台输出完整堆栈；
   - 保留与恢复：绝不重载页面，不抹除 inputElement.value 中的任何既有文本，输入框保持可编辑状态供用户修改重试；
5. E05 极端超长文本防撑破：展示区与输入框设置 overflow-wrap: anywhere; word-break: break-all; max-width: 100%；
6. E06 清空操作幂等性：连续多次点击清空保持纯状态复位，无异步排队，不抛出异常。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-textcontent-xss-safety、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 技术栈选型与运行规范（经典脚本 defer 与纯文本安全绑定）

ID：blk-tech-stack；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

技术栈严格遵守纯前端单页面边界约束，采用纯原生 HTML5、CSS3 与现代原生 JavaScript（标准经典脚本搭配 defer 属性加载与严格模式闭包隔离）：
1. 标记层（HTML5）：标准语义化单页面结构（<main>, <section>, <input>, <button>），彻底移除确认按钮节点，通过 WAI-ARIA 属性（aria-live="polite"）辅助就地错误提示展示；
2. 表现层（CSS3）：CSS Flexbox 弹性布局规范，彻底移除原蓝色确认按钮样式，保留白底背景（#FFFFFF）、顶部居中大字展示容器（高对比、word-break: break-all 折行防溢出）与底部橙色圆形清空按钮样式（#FF5500）；
3. 脚本组织与执行（JavaScript）：通过 <script defer src="app.js"></script> 加载自包含脚本，app.js 内部采用严格模式与立即执行函数表达式（IIFE）实现 AppController、InputController、DebounceScheduler、ValidatorModule、DisplayRenderer、ResetController 与 FeedbackBanner 各模块的封装与解耦；依据 MDN 规范，经典脚本搭配 defer 属性在本地双击（file:// 协议）下无 ES Module 的 CORS 跨域错误拦截，零依赖直接运行，同时完全兼容本地轻量 HTTP 静态托管；
4. DOM 安全输出：全面采用 W3C/WHATWG 标准 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML，确保用户输入仅以文本节点形式插入 DOM，恶意标签与脚本字符原样纯文本回显，防止在展示区域被解析执行；
5. 平台支持目标：面向 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15 等主流现代桌面浏览器，零转译零构建直接执行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-htmlinputelement、evidence-mdn-document-queryselector、evidence-mdn-css-flexbox、evidence-mdn-node-textcontent-official、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612；批准操作：api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316

## 运行环境支持要求、双启动模式与离线边界规范

ID：blk-tech-deployment；关联需求：blk-prod-target、blk-prod-scope；依赖：blk-tech-stack

部署与运行方案面向个人开发者的本地无门槛极简运行场景设计：
1. 目标运行环境与支持范围：
   - 操作系统：Windows 10/11、macOS 12+ 或主流 Linux 桌面环境；
   - 浏览器支持目标：现代主流桌面浏览器最新稳定版（Google Chrome ≥ 100, Microsoft Edge ≥ 100, Mozilla Firefox ≥ 100, Apple Safari ≥ 15）；受控测试环境中由于宿主机为 Windows 系统，在开发与交付阶段对 Chrome、Edge 与 Firefox 执行本地自动化/手动双击实测；Safari 浏览器在开发阶段进行跨平台语法兼容与规范审计，真机实测标明前置前提并作为待验证项，不虚假声称已实测；
   - 硬件要求：标准桌面设备，支持 1024×768 及以上分辨率显示器、鼠标与键盘；
2. 双启动模式规范：
   - 模式 A（本地文件直接双击运行）：直接通过文件管理器双击 index.html（file:// 协议加载），依赖经典脚本 + defer 属性组织，跨主流浏览器无 CORS 限制，零依赖零服务即开即用；
   - 模式 B（本地轻量静态 HTTP 服务）：通过本地已有静态工具托管，例如在项目根目录执行 python -m http.server 8080 或 npx serve .，访问 http://localhost:8080，行为与模式 A 完全一致；
3. 离线能力与缓存边界声明：
   - 本交付产物为纯静态自包含文件（index.html, styles.css, app.js, README.md），不依赖任何 CDN 或远程外部网络资源；
   - 在本地磁盘存在交付文件的前提下，模式 A 本地双击完全支持纯离线打开与运行；
   - 在已打开的页面中断开网络，所有 300ms 防抖实时核对、清空复位与错误提示逻辑均在客户端内存中正常工作；
   - 边界明确：本产品未配置 Service Worker 等离线缓存清单，因此在模式 B（HTTP 服务托管）下若服务进程停止且浏览器未命中强缓存，断网后无法重新向本地服务拉取页面资源，不作尚未实现的离线应用缓存承诺；
4. 静态产物同级目录组织：
   ├── index.html        # 单页面主入口，语义化 DOM 骨架与 defer 脚本引入
   ├── styles.css        # 视觉样式表，纯白底与单清空按钮排布
   ├── app.js            # 现代原生 JavaScript，IIFE 命名空间模块封装
   └── README.md         # 本地双模式启动与验证指南。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612；批准操作：api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316

## 交付产物文件组织、双启动模式与自包含离线规范

ID：blk-deliv-spec-deployment；关联需求：blk-tech-deployment、blk-prod-scope；依赖：blk-tech-deployment

交付产物严格遵循零服务器端业务、零构建工具链依赖的纯静态极简标准，目录由 4 个同级核心文件组成：
1. index.html：语义化单页面 DOM 骨架，彻底剔除确认按钮节点，保留单行文本输入框与底部橙色圆形清空按钮，外链 styles.css，通过 <script defer src="app.js"></script> 加载脚本，无外部 CDN 依赖；
2. styles.css：视觉样式表，彻底剔除确认按钮相关 CSS 规则，保留白底背景（#FFFFFF）、顶部居中大字展示容器（加粗高对比、word-break: break-all 折行防溢出）与底部橙色圆形清空按钮（#FF5500），以及就地红色错误提示（#E53E3E）样式；
3. app.js：现代原生 JavaScript 编写，使用立即执行函数表达式（IIFE）封装 AppController、InputController、DebounceScheduler、ValidatorModule、DisplayRenderer、ResetController 与 FeedbackBanner 各模块，经典脚本 defer 加载消除 file:// 下的 CORS 限制；彻底移除确认按钮与 Enter 键强制提交逻辑，支持 input 与 composition 实时防抖调度，全面采用 Node.textContent 纯文本节点绑定；
4. README.md：极简操作指南，详细记录本地直接双击运行（file:// 协议）与本地轻量静态 HTTP 服务运行模式，说明 300ms 防抖实时展示、清空取消任务与离线前提（文件自包含、无 Service Worker 离线缓存）的操作核对步骤。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612；批准操作：api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316

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
- answer-dec-d722eb63-aa8e-41e8-8ff7-b9698d96b5f0：彻底移除确认按钮，重构为单清空按钮纯实时反馈布局（推荐）；来源 question:run-67045f9a-4c95-4756-b449-fb72f37327b6-delivery-4-ques-visual-layout-confirm-button；日期 2026-10-04T21:00:51.408Z；适用范围 dec-visual-layout-mapping；结果 参考证据；哈希 未提供。
- evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564：模拟用户需求变更：确认按钮改为实时反馈：输入每次变化后等待300毫秒自动展示项目名，清空立即取消待展示任务并清掉结果；空值仍提示。删除确认按钮及其专属逻辑，更新相关流程、页面、接口、任务和验收，保留无关块稳定 ID。此原文不是直接批准。；来源 input:b33f1cd7-dee5-49e5-ab04-da05e30564c5；日期 2026-10-04T16:29:05.113Z；适用范围 用户提出的实时反馈输入与删除确认按钮需求变更原文证据，作为 feedback 阶段设计变更组的依据来源。；结果 参考证据；哈希 62c4629f93646cb40a052290d9aedbddc4637a5ab929d3f4f8fded5c19e04feb。
- evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e：The InputEvent.isComposing read-only property returns a boolean value indicating if the event is fired after compositionstart and before compositionend.；来源 https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/isComposing；日期 2026-10-04T18:56:59.784Z；适用范围 MDN 官方关于 InputEvent.isComposing 规范，明确在输入法合成会话（如中文拼音输入选词）期间 isComposing 为 true，为实时防抖避免未上屏拼音误触发提供了原生规范依据。；结果 参考证据；哈希 c9f8115bf21d853abd938c725286e9458271812e81e32378d9c1d92ba3ac5e75。
- evidence-dea1091c-52e5-4841-bdfe-a040b152fc88：The compositionend event is fired when a text composition system such as an input method editor completes or cancels the current composition session. For example, this event could be fired after a user finishes entering a Chinese character using a Pinyin Input method editor.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event；日期 2026-10-04T20:52:15.620Z；适用范围 MDN 官方关于 compositionend 事件规范，指示当用户完成中文字符选词上屏或取消合成会话时触发，是触发中文项目名最终防抖展示的精确事件契约依据。；结果 参考证据；哈希 2d881555b1a1407e3565829f9be7b36ee90dcd7196fe4991cc3e4560339e7b9a。
- evidence-0fe0ac78-3369-4003-b087-b746e015ce63：failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running；来源 experiment:prepare-472274a9-b1ea-47bc-9de4-3518764a6c3f；日期 2026-10-04T21:29:22.717Z；适用范围 规划环境受控试验 Docker 守护进程未启动导致容器环境不可用，真实 300ms 防抖响应延迟与清除定时器防幽灵渲染需在开发与交付验证任务中由本地现代桌面浏览器实测。；结果 unexecuted；哈希 d2c47bd7c0d6c515f97b1f7514bc193fd029e602af7d8b3234ce951eefebb174。
- evidence-ef42cfd2-ccf5-4af7-bf6b-dc20586786a8：failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running；来源 experiment:prepare-28d4f51d-a7ab-46f7-9f9f-5dc5eaf23c67；日期 2026-10-04T16:29:10.206Z；适用范围 规划环境受控试验沙箱 Docker 守护进程未启动导致环境不可用，真实防抖性能与定时器执行需移入开发与交付验证任务由本地桌面浏览器实测。；结果 unexecuted；哈希 f2d9f23eba4f2d8e216dbe4de0c7a20f8bdbcb6cf3d8cc49527bf04020eb0b09。
- evidence-d686fe73-a405-4933-a3a6-7da164ea5c01：The DOMContentLoaded event fires when the HTML document has been completely parsed, and all deferred scripts have downloaded and executed. It doesn't wait for other things like images, subframes, and async scripts to finish loading.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event；日期 2026-10-04T22:04:41.826Z；适用范围 用于修正性能测量口径：DOMContentLoaded 事件在 HTML 文档完全解析且 defer 脚本执行后触发，不等待绘制完成，因此测量指标界定为首屏 DOM 解析就绪耗时而非绘制完成耗时。；结果 passed；哈希 9b325565454622c9a10a1649160ec3a8714cd9465390ddc69c0805c3907429df。
- evidence-7a463cf7-74f1-4627-b9b3-24784ae3a9bc：The window.requestAnimationFrame() method tells the browser you wish to perform an animation. It requests the browser to call a user-supplied callback function before the next repaint.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame；日期 2026-10-04T22:05:02.539Z；适用范围 用于修正交互响应延迟口径：requestAnimationFrame 回调发生在浏览器执行下一次重绘之前，代表防抖逻辑完成至下一次重绘前的时间戳，不冒充物理像素绘制已完成。；结果 passed；哈希 bc4a512deb613f05d113055298ceeaf8afe3ce63c471d1450229a1989b92bd48。
- evidence-a2a11c7f-8620-4074-85d7-e1fd95310612：defer: This Boolean attribute is set to indicate to a browser that the script is meant to be executed after the document has been parsed, but before firing DOMContentLoaded event. Scripts with the defer attribute will prevent the DOMContentLoaded event from firing until the script has loaded and finished evaluating.；来源 https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script；日期 2026-10-04T22:05:11.082Z；适用范围 用于统一静态脚本组织形态：采用经典脚本配合 defer 属性，在 HTML 解析后触发，既支持本地文件系统 file:// 双击无 CORS 限制直接运行，又兼容本地静态 HTTP 服务模式。；结果 passed；哈希 de8f6b87e834f3158dd54ed7c693dc4eb052d5bf7d5dea7d8fadf037bc778e50。
- evidence-7ec331d7-1d2e-415d-abc5-fecbed731559：MDN 官方文档 Window: setTimeout() 指出：Late timeouts: The timeout can also fire later than expected if the page (or the OS/browser) is busy with other tasks... Currently-executing code must complete before functions on the queue are executed... 且浏览器对非活动标签页存在最低超时节流限制（如 Chrome/Firefox 节流至 1 秒或 1 分钟）。因此 300ms 防抖等待是触发阈值，无法作为所有浏览器绝对精确 300ms 到期执行的实测保证。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout；日期 2026-10-04T22:04:46.667Z；适用范围 适用于 300ms 防抖调度机制与交互响应时间契约。证实浏览器定时器受主线程排队、嵌套节流与后台标签页限制，不可作为绝对 300ms 触发的物理保证，应界定为排队阈值与待验证性能指标。；结果 passed；哈希 e05d53596ebb56f13d18a0b46d631c3bdbec3d1a668c981198fb7ae8afdf05ab。
