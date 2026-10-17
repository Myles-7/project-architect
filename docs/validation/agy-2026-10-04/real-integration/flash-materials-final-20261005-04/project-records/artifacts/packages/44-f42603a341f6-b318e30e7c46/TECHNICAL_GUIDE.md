# 真实集成验证-flash-materials-chinese-20261005-01 — 技术与接口

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

## 技术栈选型与运行规范（经典脚本 defer、端口规范与安全边界限定）

ID：blk-tech-stack；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

技术栈严格遵守纯前端单页面边界约束，采用纯原生 HTML5、CSS3 与现代原生 JavaScript（标准经典脚本搭配 defer 属性加载与严格模式闭包隔离）：
1. 标记层（HTML5）：标准语义化单页面结构（<main>, <section>, <input>, <button>），彻底移除确认按钮节点，通过 WAI-ARIA 属性（aria-live="polite"）辅助就地错误提示展示；
2. 表现层（CSS3）：CSS Flexbox 弹性布局规范，彻底移除原确认按钮样式，保留白底背景（#FFFFFF）、顶部居中大字展示容器（高对比、word-break: break-all 折行防溢出）与底部橙色圆形清空按钮样式（#FF5500）；
3. 脚本组织与执行（JavaScript）：通过 <script defer src="app.js"></script> 加载自包含脚本，app.js 内部采用严格模式与立即执行函数表达式（IIFE）实现各模块封装与解耦；经典脚本搭配 defer 属性在本地双击（file:// 协议）下无 ES Module 的 CORS 跨域限制，零依赖直接运行，同时完全兼容本地轻量 HTTP 静态托管；
4. DOM 安全输出与适用边界声明：全面采用 W3C/WHATWG 标准 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML，确保用户输入仅以文本节点形式插入展示区 DOM，恶意标签原样纯文本回显；依据证据 evidence-dab40954-74e0-4d24-bb31-1064f5dd626f，明确该机制仅保证项目名文本节点不被浏览器解析为 HTML/脚本，不外推为全系统杜绝所有 DOM XSS 的绝对证明；全应用安全由禁用危险 API 静态审查与动态 Payload 验收共同保障；
5. 平台支持目标：面向 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15 等主流现代桌面浏览器，零转译零构建直接执行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-mdn-textcontent-xss-safety、evidence-mdn-node-textcontent-official、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-mdn-xss-definition-boundary；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 运行环境支持要求、双启动模式、端口契约与离线边界规范

ID：blk-tech-deployment；关联需求：blk-prod-target、blk-prod-scope；依赖：blk-tech-stack

部署与运行方案面向个人开发者的本地无门槛极简运行场景设计：
1. 目标运行环境与支持范围：
   - 操作系统：Windows 10/11、macOS 12+ 或主流 Linux 桌面环境；
   - 浏览器支持目标：现代主流桌面浏览器最新稳定版（Google Chrome ≥ 100, Microsoft Edge ≥ 100, Mozilla Firefox ≥ 100, Apple Safari ≥ 15）；Windows 宿主机下对 Chrome、Edge 与 Firefox 执行本地直接双击与托管实测；Safari 浏览器在开发阶段进行跨平台语法审查，真机实测标明需要 macOS 真实环境的前提，当前规划期容器不可用不冒充已实测；
   - 硬件要求：标准桌面设备，支持 1024×768 及以上分辨率显示器、鼠标与键盘；
2. 双启动模式与端口契约：
   - 模式 A（本地文件直接双击运行）：直接通过文件管理器双击 index.html（file:// 协议加载），无 CORS 跨域拦截，零依赖零服务即开即用，为 100% 自包含纯离线打开模式；
   - 模式 B（本地轻量静态 HTTP 服务托管）：统一绑定固定端口 8080 并访问 http://localhost:8080，命令与地址严格一致：
     * 方案 B1：python -m http.server 8080（前提：宿主机已安装 Python 3 环境）；
     * 方案 B2：npx serve . --listen 8080（前提：宿主机已安装 Node.js/npm 环境；明确工具首次执行需联网拉取 serve 包，若未预先缓存则非无前提离线启动）；
3. 离线能力与缓存边界声明：
   - 本交付产物为纯静态自包含文件（index.html, styles.css, app.js, README.md），不依赖任何 CDN 或远程外部网络资源；
   - 模式 A 在本地磁盘存在交付文件前提下完全支持纯离线打开与运行；
   - 在已打开的页面中断开网络，所有 300ms 防抖实时核对、清空复位与错误提示逻辑均在客户端内存中正常工作；
   - 边界明确：本产品未配置 Service Worker 等离线缓存清单，在模式 B 下若服务进程停止且无浏览器强缓存，断网后无法重新向本地服务拉取页面资源，不作尚未实现的离线应用缓存承诺；
4. 静态产物同级目录组织：
   ├── index.html        # 单页面主入口，语义化 DOM 骨架与 defer 脚本引入
   ├── styles.css        # 视觉样式表，纯白底与单清空按钮排布
   ├── app.js            # 现代原生 JavaScript，IIFE 命名空间模块封装
   └── README.md         # 本地双模式启动、固定 8080 端口与离线前提指南。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-python-http-server-port-official；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 交付产物文件组织、双启动模式、固定 8080 端口与自包含离线规范

ID：blk-deliv-spec-deployment；关联需求：blk-tech-deployment、blk-prod-scope；依赖：blk-tech-deployment

交付产物严格遵循零服务器端业务、零构建工具链依赖的纯静态极简标准，目录由 4 个同级核心文件组成：
1. index.html：语义化单页面 DOM 骨架，彻底剔除确认按钮节点，保留单行文本输入框与底部橙色圆形清空按钮，外链 styles.css，通过 <script defer src="app.js"></script> 加载脚本，无外部 CDN 依赖；
2. styles.css：视觉样式表，彻底剔除确认按钮相关 CSS 规则，保留白底背景（#FFFFFF）、顶部居中大字展示容器（加粗高对比、word-break: break-all 折行防溢出）与底部橙色圆形清空按钮（#FF5500），以及就地红色错误提示（#E53E3E）样式；
3. app.js：现代原生 JavaScript 编写，使用立即执行函数表达式（IIFE）封装各模块，经典脚本 defer 加载消除 file:// 下的 CORS 限制；包含 activeInputNode 与 inputGeneration 节点代际隔离管理、schedulerEpoch 防抖纪元快照防护，彻底移除确认按钮与 Enter 提交，支持 input 与 composition 实时防抖调度，全面采用 Node.textContent 纯文本节点绑定；
4. README.md：极简操作指南，详细记录本地直接双击运行（file:// 协议）与本地轻量静态 HTTP 服务运行模式；HTTP 服务模式固定端口 8080，明确提供 python -m http.server 8080 与 npx serve . --listen 8080 两种方式，访问地址统一为 http://localhost:8080；说明 npx 首次需联网前提、自包含离线前提（文件自包含、无 Service Worker 离线缓存）与核对验证步骤。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-python-http-server-port-official；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 前端系统架构与核心功能模块划分（输入节点闭包绑定与快照调度器）

ID：blk-tech-module；关联需求：blk-prod-scope；依赖：blk-tech-stack

系统划分为高内聚、低耦合的纯前端原生模块，完全在客户端内存运行时运行：
1. DisplayRenderer（展示渲染模块）：
   - 职责：专门管理顶部项目名大字展示区；
   - API：
     * renderProjectName(element, text: string): void（严格使用 Node.textContent 属性进行纯文本节点安全更新，杜绝脚本执行）；
     * renderPlaceholder(element, placeholderText: string): void（复位显示初始灰色占位提示）。
2. InputController（输入管理与代际闭包绑定模块）：
   - 职责：维护当前活跃输入框节点 activeInputNode，为新生成的输入框绑定捕获当前代际的专属事件监听闭包；
   - API：
     * bindInputNode(node: HTMLInputElement, generation: number): void（为指定节点绑定 input、compositionstart、compositionend 闭包监听，捕获 node、bornGeneration、isComposing 与 trustedDraft 私有上下文，前置四重守卫核验拦截迟到事件）；
     * focusInput(): void（保证活跃输入框准确获取光标焦点）；
     * （规范：移除冗余未实现的 getInputText/setInputText 公开接口声明，保持规范与实际返回 API 严格一致）。
3. DebounceScheduler（纪元防抖调度模块）：
   - 职责：管理 300ms 计时器生命周期，采用单调递增的 schedulerEpoch 纪元快照机制与草稿快照防护；
   - API：
     * schedule(draftSnapshot: string, targetNode: HTMLInputElement, targetGeneration: number, callback: Function, delayMs: number = 300): void；
     * cancel(): void（清除当前活跃定时器并递增 schedulerEpoch）。
4. ResetController（重置控制器模块）：
   - 职责：协调清空重置全流程；
   - API：
     * handleReset(): void（调用 DebounceScheduler.cancel()，递增 inputGeneration，创建全新 input 节点并通过持久配置复制策略完整保留 5 类持久配置，重置 value 与瞬态错误，调用 bindInputNode 绑定新闭包并执行 replaceWith 物理替换，更新 activeInputNode，复位展示区为占位符，清除错误提示并回焦）。
5. ValidatorModule（非空与字符校验模块）：
   - 职责：针对传入的草稿快照进行纯函数非空校验；
   - API：
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }。
6. FeedbackBanner（错误警示与异常横幅模块）：
   - 职责：集中管理输入框就地校验错误挂载与全局运行时异常横幅呈现；
   - API：
     * showInputError(inputNode: HTMLInputElement, container: HTMLElement, message: string): void（在 container 中显示错误文本，为 inputNode 添加错误类名并设置 aria-invalid="true"）；
     * clearInputError(inputNode: HTMLInputElement, container: HTMLElement): void（清空 container 文本并隐藏，移除 inputNode 错误样式与 aria-invalid 属性）；
     * showGlobalError(message: string): void（在页面顶部挂载全局警示条，保留输入框内容）。
7. AppController（全局装配与启动协调模块）：
   - 职责：在 DOMContentLoaded 时获取实际 DOM 引用，完成各模块依赖注入与事件初始化装配。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-17569c8c-1012-4071-8ebe-936b5fe286db；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148

## 客户端运行时数据模型与状态结构规范（代际纪元、五类持久配置、挂载替换记录与事务快照模型）

ID：blk-tech-data-model；关联需求：blk-feat-input-display、blk-feat-reset；依赖：blk-tech-stack

在客户端内存运行时维护状态结构，通过代际计数、调度纪元、持久属性复制与事务快照保证单输入框拓扑保真与失败原子回滚：
1. 全局运行时状态模型（GlobalRuntimeState）：
   - activeInputNode: HTMLInputElement | null，指向当前处于 DOM 树中的唯一活跃输入节点；
   - inputGeneration: number，全局单调递增的节点代际计数器，初始为 1；仅在清空事务完全成功提交时递增；
   - schedulerEpoch: number，全局单调递增的防抖调度纪元，初始为 0；在每次新建防抖调度、主动取消或回滚时单调自增；
   - isInitialized: boolean，标记应用初始化完成状态。
2. 节点闭包私有模型（NodeClosurePrivateState）：
   - node: HTMLInputElement，闭包捕获的专属输入节点引用；
   - bornGeneration: number，节点绑定时捕获的代际快照，不可变；
   - isComposing: boolean，私有中文输入法拼音合成状态；
   - trustedDraft: string，闭包内当前已验证接受的最新草稿。
3. 防抖调度任务模型（DebounceTaskModel）：
   - taskEpoch: number，任务被 schedule 时的纪元快照；
   - targetNode: HTMLInputElement，目标节点引用；
   - targetGeneration: number，目标节点诞生代际；
   - draftSnapshot: string，捕获的原始草稿快照（保留空格与换行，涵盖非空、空字符串与纯空格）；
   - timerId: number | null，window.setTimeout 返回的句柄；
   - delayMs: number，固定为 300ms。
4. 清空状态事务快照模型（ResetTransactionSnapshot，解决 R6-B1 与 R6-B2）：
   - activeInputNode: HTMLInputElement，清空发起前的原输入节点；
   - inputGeneration: number，清空发起前的原代际；
   - schedulerEpoch: number，清空发起前的原纪元；
   - hadPendingTimer: boolean，标记清空瞬间是否存在正在排队的防抖任务；
   - pendingTimerId: number | null，原定时器句柄；
   - draft: string，清空发起前的原始草稿快照，涵盖非空、空字符串 '' 与纯空格 '   '；
   - displayContent: string，顶部展示区原文本；
   - errorContent: string | null，原就地错误文本；
   - isErrorVisible: boolean，原错误提示容器显示状态；
   - hadErrorClass: boolean，原输入节点是否包含 error 类名；
   - hadAriaInvalid: boolean，原输入节点是否设置 aria-invalid="true"；
   - parentNode: Node | null，原输入节点的父 DOM 容器；
   - nextSibling: Node | null，原输入节点的后相邻兄弟节点；
   - mountedReplacementNode: HTMLInputElement | null，记录实际挂入 DOM 树的 replacement 节点引用；回滚时若非空且仍在文档树中，作为必须清理移除的目标节点，确保 DOM 树中有且仅有单一原节点；
   - phase: 'pre-replace' | 'replaced' | 'committed' | 'rolled-back'，事务流转阶段标记。
5. 五类持久配置清单模型（PersistentAttributesModel）：
   - id 与 name（label 关联键）；
   - 全部持久 ARIA 属性（aria-label, aria-describedby, aria-required 等）；
   - tabindex（键盘焦点访问序列）；
   - class 与 style（视觉尺寸与定位样式）；
   - data-* 自定义数据属性（如 data-test）。
6. 严重失败只读复制兜底模型（SevereFailureFallbackModel）：
   - readonlyDraft: string，保留换行与空格的原始文本；
   - isFallbackVisible: boolean，兜底区域挂载显示标记；
   - containerType: 'textarea'，声明为只读多行文本域，支持全选复制，杜绝 HTML 解析注入风险。

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

## 组件事件契约与模块调用接口规范（节点代际守卫、清空状态事务与非执行参考示意）

ID：blk-tech-interface；关联需求：blk-feat-input-display、blk-feat-reset；依赖：blk-tech-data-model、blk-tech-module

组件事件契约、模块调用接口定义与状态转换规范。明确本块内部 JavaScript 均为“非执行示意，非CodingAgent直接复制的参考实现”；规划规范的权威定义是接口方法签名、状态所有权、前置守卫与成功提交/失败回滚的后置条件：
1. 模块接口签名契约：
   - InputController:
     * bindInputNode(node: HTMLInputElement, generation: number): void（为输入框绑定事件闭包，捕获私有 node 与 generation 作为 bornGeneration，注册 input、compositionstart、compositionend 等监听并执行四重前置守卫：event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)）；
     * focusInput(): void（聚焦当前活跃输入框）。
   - DebounceScheduler:
     * schedule(draftSnapshot: string, targetNode: HTMLInputElement, targetGeneration: number, callback: Function, delayMs: number = 300): void（记录当前纪元 schedulerEpoch 并启动倒计时，回调执行前核验纪元与代际有效性，仅针对传入的 draftSnapshot 校验并更新展示）；
     * cancel(): void（清除当前活跃定时器并自增 schedulerEpoch 使宏任务队列在途回调失效）；
     * hasPending(): boolean（返回当前是否存在排队中的有效防抖任务）。
   - ResetController:
     * handleReset(): void（执行两阶段清空状态事务：快照捕获 -> 内存预制新节点并复制 5 类持久属性 -> 取消防抖 -> replaceWith 物理替换 -> 占位呈现与错误清理 -> focus 聚焦 -> 原子提交递增代际；任何阶段抛错立即触发 rollback）；
     * captureSnapshot(): ResetTransactionSnapshot（捕获包含 DOM 位置、原草稿、定时器与持久状态的完整恢复快照）；
     * rollback(snapshot: ResetTransactionSnapshot, error: Error, replacementNode?: HTMLInputElement): void（执行原子拓扑回滚：显式识别 replacement 节点，若已挂入文档树则物理回插原节点并彻底移除 replacementNode，断言 DOM 树只有 1 个 input 且 ID 唯一；还原 activeInputNode 与代际；自增 schedulerEpoch；若 snapshot.hadPendingTimer 为真，无差别按 snapshot.draft 重新调度防抖；回焦原节点并提示；严重失败展开只读草稿 textarea 容器，绝不刷新）。
   - DisplayRenderer:
     * renderProjectName(element: HTMLElement, text: string): void（使用 Node.textContent 纯文本绑定安全更新大字，杜绝 HTML/脚本解析）；
     * renderPlaceholder(element: HTMLElement, placeholderText: string): void（复位展示区为灰色占位文本）。
   - FeedbackBanner:
     * showInputError(inputNode: HTMLInputElement, container: HTMLElement, message: string): void（就地呈现红色警示，为 inputNode 挂载 error 类名与 aria-invalid="true"）；
     * clearInputError(inputNode: HTMLInputElement, container: HTMLElement): void（清空错误文本并隐藏，移除 inputNode 的 error 类与 aria-invalid 属性）；
     * showGlobalError(message: string): void（在页面顶部浮现轻量通知横幅）；
     * showSevereFallbackDraft(draftText: string, container: HTMLElement): void（在容器中挂载只读 textarea 呈现原始草稿，供手动复制）。
   - ValidatorModule:
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }（对草稿进行非空校验，空值或纯空白字符判定失败）。
2. 清空状态事务状态转换与后置条件（非执行示意，供设计推导参考）：
   [Ready: oldNode in DOM, generation=G, epoch=E]
         |
         v (click reset -> captureSnapshot)
   [Snapshot Captured: draft, timerState, parentNode, nextSibling]
         |
         v (create newNode, copy 5 persistent attrs, bind newNode with G+1)
   [Replacement Ready in Memory]
         |
         +---> (if throw before replace) ---> [Rollback Phase A: oldNode unchanged, G unchanged, E++, re-schedule draft if hadTimer, banner]
         |
         v (oldNode.replaceWith(newNode))
   [Replaced in DOM: mountedReplacementNode = newNode]
         |
         +---> (if throw during/after replace) ---> [Rollback Phase B: remove newNode, insert oldNode back, DOM input count=1, G unchanged, E++, re-schedule draft if hadTimer, banner]
         |
         v (renderPlaceholder, clearInputError, newNode.focus)
   [View & Focus Reset Ready]
         |
         v (Atomic Commit Point)
   [Committed: activeInputNode = newNode, inputGeneration = G+1, old events safely rejected by guard]
3. 伪代码参考示意（非执行示意，说明 R6-B1/R6-B2 与兜底逻辑）：
```javascript
// 非执行示意，非CodingAgent直接复制的参考实现
function rollback(snapshot, err, replacementNode) {
  try {
    // R6-B1 修复：显式清理已挂载的 replacement 节点，消除双输入框与重复 ID 缺陷
    if (replacementNode && replacementNode.parentNode) {
      replacementNode.parentNode.replaceChild(snapshot.activeInputNode, replacementNode);
    } else if (!document.body.contains(snapshot.activeInputNode)) {
      if (snapshot.parentNode) {
        snapshot.parentNode.insertBefore(snapshot.activeInputNode, snapshot.nextSibling);
      }
    }
    activeInputNode = snapshot.activeInputNode;
    inputGeneration = snapshot.inputGeneration;
    schedulerEpoch++; // 废弃旧在途定时器
    activeInputNode.value = snapshot.draft;
    
    // R6-B2 修复：原始草稿无差别重调度（涵盖 non-empty, empty, whitespace）
    if (snapshot.hadPendingTimer) {
      DebounceScheduler.schedule(snapshot.draft, activeInputNode, inputGeneration, handleDebouncedValidateAndDisplay, 300);
    }
    
    FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态');
    activeInputNode.focus();
  } catch (severeErr) {
    // 严重回滚失败只读草稿复制兜底：禁止刷新，纯文本原样呈现供复制
    FeedbackBanner.showSevereFallbackDraft(snapshot.draft, document.getElementById('error-banner-container'));
  }
}
```

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

## 错误分类、旧结果清除机制、清空状态事务原子回滚与只读草稿复制兜底策略

ID：blk-tech-error；关联需求：blk-feat-reset、blk-feat-input-display；依赖：blk-tech-data-model、blk-tech-interface

错误分类定义、展示复位策略、清空状态事务原子回滚与严重失败只读复制兜底策略：
1. 错误分类与容错行为矩阵：
   - E01（空值与纯空白输入拦截）：用户在输入框中输入空字符串或纯空格（包括删空既有文本）且停止 300ms 时，触发空值拦截；展示区已显示的旧项目名立即被清除并复位为初始占位提示“【等待输入核对】”，在输入框下方呈现红色警示“项目名不能为空，请输入有效字符”，输入框边框高亮变红并保持焦点；输入框内既有文本（包括输入的空格字符）原样完好保留；
   - E02（恶意注入字符与转义防护）：用户录入任何 HTML 实体或脚本标签，均严格通过 Node.textContent 作为纯文本节点解析回显，杜绝 HTML 解析与脚本执行，恶意代码字符原样纯文本安全呈现，不产生阻断性报错；
   - E03（清空状态事务异常与原子回滚，R6-B1 与 R6-B2 核心修复）：清空过程被视为强状态事务；若在准备阶段、物理替换阶段或替换后呈现/错误清理/焦点阶段抛错，catch 块立即执行原子回滚：
     * 针对已挂入 DOM 的 replacement 节点进行显式物理清理，通过 replaceChild 原位回插原节点并彻底移除新节点，确保页面输入框数量严格为 1，杜绝双输入框与同 ID 冲突缺陷（R6-B1）；
     * 还原 activeInputNode 指针与 inputGeneration 代际计数；
     * 单调自增调度纪元（schedulerEpoch++）使清空前后的旧在途定时器无害作废；
     * 针对快照中的原始草稿 snapshot.draft 无差别重新调度 300ms 防抖校验（涵盖非空、空字符串 '' 与纯空格 '   '），严禁用 trim().length > 0 条件跳过校验任务，确保删空或空格草稿在回滚后 300ms 忠实清除旧展示并展示非空警示，空格原文保留，杜绝旧项目名持久残留缺陷（R6-B2）；
     * 界面顶部浮现友好通知横幅，原节点保持聚焦且用户可继续修改或重试清空；
   - E04（严重回滚失败只读草稿复制兜底）：若在回滚回插原节点过程中再次发生严重 DOMException 导致回滚中断：
     * 建立诚实失败状态：不声称“已完整恢复”，坚决禁止调用 window.location.reload() 刷新页面，不把空输入当作已恢复；
     * 系统在页面顶部通知横幅中就地展开独立只读草稿容器（readonly textarea），原样呈现原始 draft 文本（逐字符保留换行与前后空格），允许用户手动选中复制取回文本；提示明确说明主编辑器暂时受限，草稿已安全就地保留；
   - E05（未知运行时异步异常防护）：全局未捕获异常被 window.onerror / unhandledrejection 拦截，界面顶部呈现轻量通知横幅，输入框与展示区既有内容严格保留，页面不重载。
2. 清空状态事务原子回滚与恢复不变式（Invariants）：
   - 不变式 1（输入框唯一性与 DOM 拓扑自洽）：无论事务成功提交还是回滚恢复，页面文档树中有且仅有一个具有 id="project-name-input" 的 HTMLInputElement，0 孤儿节点，0 属性丢失；
   - 不变式 2（代际闭包自洽）：回滚后 activeInputNode.bornGeneration === inputGeneration 恒成立，用户键入新字符能立即正常流转 300ms 防抖；
   - 不变式 3（原始草稿不丢失且校验完整）：回滚后原输入草稿完整还原；若此前有排队任务，无论是空值、纯空格还是有效项目名，均在 300ms 后忠实执行原规则校验；
   - 不变式 4（旧闭包与旧定时器完全作废）：自增 schedulerEpoch 确保旧定时器回调到期直接丢弃，旧节点闭包守卫拦截所有迟到事件。

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

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
- evidence-dab40954-74e0-4d24-bb31-1064f5dd626f：澄清历史安全证据适用边界：MDN 关于 Node.textContent 的规范证实 textContent 将内容作为纯文本节点插入 DOM，不调用 HTML 解析器，因此项目名展示区域可防止 HTML/脚本标签被解析执行。但此机制仅保证特定节点文本绑定的安全性，不能外推为全系统或整个单页面从根本上杜绝所有 DOM 型 XSS。全应用安全依赖无危险 API 调用（如 innerHTML/eval）、无未受信任 URL 导航、静态源码词法检查与端到端动态 Payload 注入验收共同保障。；来源 input:b4da0333-c07a-45a2-b87f-9aeb6453cc95；日期 2026-10-04T22:26:25.313Z；适用范围 安全证据适用边界修订：限定 textContent 为单一文本节点安全渲染，取代历史过宽推断。明确历史 evidence-mdn-textcontent-xss-safety 与 evidence-mdn-node-textcontent-official 中关于“从根本上杜绝DOM型XSS”的适用说明已被本次范围限定取代，当前有效结论仅为用户项目名进入指定 textContent 文本节点时不被解析为 HTML/脚本。；结果 passed；哈希 9037d21be7838160972a03ffdca49815167e42c589c8ca372f558df46692b784。
- evidence-python-http-server-port-official：http.server can also be invoked directly using the -m switch of the interpreter. The following example illustrates how to serve files relative to the current directory: python -m http.server [ OPTIONS ] [ port ]. The server listens to port 8000 by default. The default can be overridden by passing the desired port number as an argument: python -m http.server 9000.；来源 https://docs.python.org/3/library/http.server.html；日期 2026-10-04T22:26:35.289Z；适用范围 规范本地轻量 HTTP 服务启动命令与端口一致性契约：Python http.server 默认监听 8000 端口，若访问 8080 端口必须显式传递端口参数（python -m http.server 8080）。；结果 passed；哈希 4d83e799b7ad96d8441d15486816a37731578026694ba4d11a605d7534955115。
- evidence-nodejs-process-exit-official：The process.exit() method instructs Node.js to terminate the process synchronously with an exit status of code. If code is omitted, exit uses either the 'success' code 0 or the value of process.exitCode if it has been set. To exit with a 'failure' code: exit(1); The shell that executed Node.js should see the exit code as 1.；来源 https://nodejs.org/api/process.html；日期 2026-10-04T22:26:52.902Z；适用范围 指导静态源码审计脚本规范：当发现禁用危险 API 或确认按钮残留关键字时，必须显式调用 process.exit(1) 返回非零失败退出码，不能仅调用 console.warn 后退出 0 导致外部自动验收误判为通过。；结果 passed；哈希 845ec5d06e1f6aeef3ec3be7f262e638263f71683b535216658acc65b3079452。
- evidence-mdn-xss-definition-boundary：A cross-site scripting (XSS) attack is one in which an attacker is able to get a target site to execute malicious code as though it was part of the website... All XSS attacks depend on a website doing two things: Accepting some input that could have been crafted by an attacker; Including this input in a page without sanitizing it: that is, without ensuring that it won't be executable as JavaScript.；来源 https://developer.mozilla.org/en-US/docs/Glossary/Cross-site_scripting；日期 2026-10-04T22:27:22.400Z；适用范围 限定 textContent 的安全适用边界并澄清全应用 DOM XSS 的说明：单一节点的 textContent 赋值仅保证该数据汇点不被解析执行，不能等同于全系统杜绝 DOM XSS，需结合整应用源码审计与动态 Payload 原样回显测试。；结果 passed；哈希 575cf0c159d69f4d2e554c7f0eec6b0ac776f1ad1f78e590068a3c9e5657e1ea。
- evidence-mdn-ime-compositionstart-session：The compositionstart event is fired when a text composition system such as an input method editor starts a new composition session. For example, this event could be fired after a user starts entering a Chinese character using a Pinyin Input method editor.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event；日期 2026-10-04T22:27:37.629Z；适用范围 规范 IME 拼音输入会话的生命周期控制：输入法启动新会话时需维护会话有效性，清空重置时立即使旧会话作废，防止清空后迟到的旧 compositionend 事件触发非预期的防抖调度或空值错误。；结果 passed；哈希 7707d106ca999e77eb09ca5959fe1d88cd77a5ac12ceccf99ca262b08253b098。
- evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9：本轮是自动质量验收反馈，不是真人新增需求，也不是人工批准。核对对象是 flash-materials-quality-publish-20261005-04 的真实 sourceRevision 24 蓝图和 quality-reviewed-r2 开发包，独立证据为 MATERIALS_R2_CORE_INDEPENDENT_REVIEW.md 与 ime-contract-counterexample.json。此前 sourceRevision 20 继承包不代表最新设计，不得用其旧问题覆盖已经正确的 r2 修订。

已经正确并应完整保留：即时单按钮清空、300ms实时展示、旧结果在手动删空时清除、纯空格原文保留、失败保留输入、经典脚本/IIFE与textContent、无确认按钮和Enter专属提交、前台测量、五轮均值唯一边界、明确8080参数和npx首次联网前提、十文件与真实任务DAG、原图SHA256和实际查看记录、历史证据及当前安全边界说明。保持30个当前有效块的稳定ID，仅修改下列两点及其真实相关契约；不要重写已有目标、范围、无关页面或正确的任务细节。普通实现继续委托AI，不新增用户选择题。当前目标应用尚未开发，任何未来浏览器或性能测试仍未执行。

1. 输入法清空后迟到input的契约仍未闭合。blk-tech-interface 当前三个实际事件回调中，compositionend会检查currentSessionToken与activeSessionId，但input仅检查!isComposing && !e.isComposing，完全没有作废会话边界。用原始导出回调执行的合成VM允许：compositionstart→清空（activeSessionId递增、isComposing=false、value=''）→旧compositionend被拒绝→迟到noncomposing input仍schedule→300ms后新造空值错误；如果原生事件已经将旧草稿写回DOM，则又可展示旧文字。这是实际契约的合成反例，不是已经复现的原生浏览器/IME故障。

请拟定可直接指导开发的最小一致策略，覆盖清空时作废输入会话以及相关input/beforeinput/composition尾随事件，不只在compositionend加一次令牌检查。策略需要说明事件如何关联已作废会话、新用户输入怎样恢复正常防抖、何时读取DOM或已接受草稿，以及旧事件对value的写回怎样隔离或恢复。可以选择明确的输入节点生命周期隔离（新节点/旧节点generation与event.target检查）、会话状态机与新输入意图边界，或其他具有具体可观察行为的方案；不要求特定技术，但不能声称普通InputEvent自带应用自增令牌，也不能用单个全局currentSessionToken证明任意旧事件身份。同步data_model、interface、error、相关flow/page、实现任务、验证与验收。保留新真实键入/粘贴/新中文组合输入可正常开始新300ms调度，不能以永远拒绝后续input规避问题。写清“旧会话尾随事件”和“新的用户输入”测试序列；原生IME、浏览器差异及无法在当前环境确认的顺序列为开发阶段实际验证，不写100%或彻底杜绝所有原生竞态的无证据承诺。复用已有官方证据，不重复启动已不可用Docker。

2. 清空性能口径仍有残留。blk-deliv-val-perf-benchmark.passCriteria 写“清空重置渲染耗时”，但其steps测click事件起始→requestAnimationFrame重绘前回调，这只能是清空处理与重绘前调度的代理指标。将该指标在content、goal、normalBehavior、scope、verification、completionCriteria、steps、passCriteria和关联outcomes/acceptance中统一为准确名称，起止一致，保留五轮均值<=50ms及待验证状态，不声称physical paint或用户实际看见已经测得。DOM就绪和输入防抖的五轮均值标准已闭合，不擅自改次数或阈值。目标应用未实现，不能把合成回调测试或官方研究写成目标应用的性能实测通过。；来源 input:f1b903e2-8899-458d-a8cb-d51d9626df64；日期 2026-10-04T23:09:10.488Z；适用范围 自动质量验收反馈依据：指导清空时作废输入会话及尾随 input 事件隔离闭合契约、统一清空重置至重绘前调度延迟性能口径；结果 passed；哈希 1d44377805500c1d2def2e30e44425a573459eaa1f6adae71cb8cf3c5d156b54。
- evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a：MDN 官方规范指出：Element.replaceWith() 方法用一组 Node 对象或字符串替换父节点子列表中的此 Element。该方法自 2018 年起已在主流现代桌面浏览器全面支持，适用于清空时安全替换活跃输入框 DOM 节点。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith；日期 2026-10-04T23:41:10.156Z；适用范围 用于清空操作时替换输入节点（replaceWith / replaceChild），实现节点代际闭包隔离，使旧节点的迟到事件被隔离丢弃，不污染新输入节点。；结果 passed；哈希 2aae27198a28d84070b24d4428e06c1ac390eef3a6417a64dba20d4907da2ee8。
- evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed：本轮是自动质量验收反馈，不是真人新增需求，也不是人工批准。只针对 flash-materials-quality-20261005-06 的 sourceRevision28 / quality-reviewed-r3 最新真实蓝图，旧证据和旧包保留。原生目标应用尚未开发；本轮只有导出契约的静态/合成反例，不能称浏览器实测。现在仅输入节点生命周期/定时器隔离契约仍阻断。请在待批准方案中采用明确的“清空时替换输入节点＋节点代际闭包隔离”作为最小修订建议，AI完成普通实现细节。；来源 input:58d9b19d-41b2-4b33-9b82-848c086d1399；日期 2026-10-04T23:41:22.473Z；适用范围 自动质量验收反馈：关于输入节点生命周期与定时器隔离契约的修订要求，采用清空时替换输入节点与节点代际闭包隔离方案。；结果 passed；哈希 d3e69bb333a4112e32f50bf8a964a2b91959779df5b7eb3907c130386d4b2e88。
- evidence-8978eaa8-d822-4c9c-a5c5-c60e914c2a91：The currentTarget read-only property of the Event interface identifies the element to which the event handler has been attached.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget；日期 2026-10-04T23:41:23.175Z；适用范围 用于事件处理前核验事件监听器绑定的真实节点与当前活跃节点一致性。核对 event.currentTarget 与 node === activeInputNode，确保仅处理直接绑定在当前活跃输入节点上的事件，丢弃已替换作废旧节点的冒泡或尾随事件。；结果 passed；哈希 659cef39146b234aaffd6211e8541383f6c351a197f1434b79fd28a423b928e3。
- evidence-f7c8f543-aa2f-4d11-bcf6-eb506e933aba：The read-only isConnected property of the Node interface returns a boolean indicating whether the node is connected (directly or indirectly) to a Document object.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected；日期 2026-10-04T23:41:31.567Z；适用范围 用于核验事件所属输入节点是否仍在文档树中。清空操作通过 replaceWith() 移出旧节点后，旧节点的 isConnected 变为 false，事件守卫检查 node.isConnected 若为 false 则直接丢弃事件，避免非挂载节点操作界面状态。；结果 passed；哈希 efc23d018757062e345938aca4cfdaaf3ad73cf4ecc99e7a0767cc3e0afb55a5。
- evidence-17569c8c-1012-4071-8ebe-936b5fe286db：本轮是自动质量验收反馈，不是真人新增需求，也不是人工批准。仅修订 flash-materials-final-20261004-01 的最新已批准 source32 / quality-reviewed-r4；原项目仍未开发。本轮三项阻塞来自真实导出内容的静态/合成复核。保留30个稳定块ID、29条基线历史证据完整对象、其余已正确的300ms输入/即时单按钮清空/手动删空/原文保留/失败恢复/textContent/defer-IIFE/端口8080/安装前提/十文件/全部DAG边和五轮均值<=50ms调度代理指标。只改关联内容及字段，不重新设计无关功能，不运行不可用Docker。\n\nR4-B1：blk-deliv-val-standalone-runtime.task.failureBehavior声称旧原生compositionend若重定向到新节点，generation guard会拒绝，这不成立。对新节点派发时currentTarget、active node、bornGeneration、连接检查全部匹配。删除该保证和“极其罕见”的无依据频率判断，所有投影保持一致。合成隔离保证限于旧节点/旧闭包；原生会话终结、重定向、真实焦点/辅助技术保持unexecuted。开发验证须记录Chrome/Edge/Firefox与Safari适用版本、操作系统、IME、原始事件日志；出现重定向/新会话被结束先修订清空策略及回归，不自造原生token、永久隔离、自动通过或全部浏览器竞态保证。\n\nR4-B2：blk-tech-interface完整JavaScript fence没有FeedbackBanner、displayElement、errorContainer的声明/注入/具体装配，正常timer及catch都会ReferenceError；模块方法列表getInputText/setInputText与实际返回API也不符。请明确实际DOM引用、AppController初始化顺序、FeedbackBanner具体方法签名及呈现/清除错误规则；每个使用的变量均定义或通过显式参数注入。可以采用小的初始化工厂并引用安全textContent renderer；完整伪代码应内部自洽，可以仅用明确浏览器DOM/定时器依赖装配。getInputText/setInputText若不是必要公开能力可从方法列表移除，或真正定义其与accepted draft/generation/定时器的一致性，不能只声明未实现。保留已有正确node闭包、capturedDraft、schedulerEpoch、stale callback拒绝及300ms逻辑。该代码是开发规范，合成核验不能称目标应用真实实现已测试。\n\nR4-B3：replaceInputNode仅复制id/name/class/placeholder/aria-label，但flow/acceptance要求全部持久DOM属性与无障碍配置保留，实际丢aria-describedby/aria-required/tabindex/style/data-test。采用明确安全的持久配置复制/clone策略，覆盖label关联、ARIA、tabindex、style及data属性；单独重置value/trustedDraft、瞬态aria-invalid和错误状态、重绑闭包监听与明确焦点行为。保留原属性保留验收，不能删掉要求迎合旧代码。给出这五类配置前后精确断言；实际布局、屏幕阅读器与原生焦点仍待实测。同步相关flow/page/data/interface/error/task全部字段/validation/acceptance；避免正文属性全保留而伪代码仍白名单。\n\n独立review核对三项与其余正确内容保留，普通细节由AI决定，生成待批准修订包。经公开Core脚本审批/新compiler导出仅自动验收，真人审阅pending。保留旧收据、旧产物与原证据；新证据另登记，不用相同ID覆写旧记录。；来源 input:5cc495c6-96a8-4442-8f77-668749156b46；日期 2026-10-05T00:22:12.095Z；适用范围 R4 自动质量验收反馈依据：纠正原生事件重定向无依据保证、补齐伪代码变量定义与组装、落实输入框五类持久属性复制与瞬态重置；结果 not-applicable；哈希 d6b41906e732983af973864801e3783ec129ff0309ac3bcbdbb839aa03567244。
- evidence-exp-docker-env-unavailable-r4：environment_prepare (node) failed to connect to docker API at npipe:////./pipe/dockerDesktopLinuxEngine. Container execution is unavailable.；来源 experiment:prepare-a28f0c43-4808-4937-9b2c-aa54c1c3434b；日期 2026-10-05T08:20:39+08:00；适用范围 记录规划期容器环境（Docker Desktop Linux Engine）不可用状态，确认自动化容器试验无法执行，多浏览器与原生输入法真机兼容性及性能基准实测须如实标为 unexecuted 并移入开发验证任务。；结果 unexecuted；哈希 未提供。
- evidence-37699c07-e70f-4d97-b809-4d68ad503428：合成 DOM 异常注入复核证据：在清空重置 handleReset 中，当 oldNode.replaceWith 或随后的 renderPlaceholder 抛出异常时，若仅提前递增 inputGeneration 而未进行状态事务回滚，会导致原输入框既有闭包的 bornGeneration 与全局代际永久失配，后续键盘事件被守卫丢弃，输入框丧失可编辑性；采纳 captureSnapshot 与 rollbackReset 原子回滚机制后，异常时原节点、草稿文本、闭包代际、调度纪元与拓扑位置完整还原，用户继续键入可正常调度 300ms 防抖更新。；来源 input:1488ed35-6288-4173-b10a-48bcd6cd16a4；日期 2026-10-05T00:42:06.949Z；适用范围 适用于清空重置操作在创建、属性复制、replaceWith、呈现、清理、focus 任意阶段异常时的两阶段提交与原子回滚机制规范；结果 passed；哈希 2591fc223523e85ff1f1bd136a09895acf3d8a28ff1d2a3860d792cefa984907。
- evidence-7fc79de9-07c0-43c1-b09d-641f14530819：Element: replaceWith() method - Web APIs | MDN. The Element.replaceWith() method replaces this Element in the children list of its parent with a set of Node objects or strings. Exceptions: HierarchyRequestError DOMException: Thrown when the node cannot be inserted at the specified point in the hierarchy.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith；日期 2026-10-05T00:40:44.515Z；适用范围 Element.replaceWith 异常抛出与节点替换失败防御依据；结果 not-applicable；哈希 2aae27198a28d84070b24d4428e06c1ac390eef3a6417a64dba20d4907da2ee8。
- evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e：Node: isConnected property - Web APIs | MDN. The read-only isConnected property of the Node interface returns a boolean indicating whether the node is connected (directly or indirectly) to a Document object. Returns false when the node is detached from the document tree.；来源 https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected；日期 2026-10-05T00:41:22.780Z；适用范围 Node.isConnected 节点连接状态检测与回滚验证依据；结果 not-applicable；哈希 efc23d018757062e345938aca4cfdaaf3ad73cf4ecc99e7a0767cc3e0afb55a5。
- evidence-a8866f76-4ae6-466b-8fab-a69b806b7336：R6自动质量验收反馈针对清空事务原子回滚与契约规范提出三项核心修订：1. 交付粒度校正：blk-tech-interface 内部实现代码降级为非执行示意，以模块接口签名、状态所有权与提交/回滚后置条件为权威契约；2. R6-B1/P1：解决 replaceWith 成功后后续步骤抛错回滚导致 DOM 中遗留双输入框缺陷，必须在回滚中彻底移除已挂载的新节点，恢复单一输入框拓扑与唯一 ID；3. R6-B2/P2：解决回滚时 trim 条件导致丢失空值/纯空格待校验任务问题，只要发起清空时有排队任务，回滚均须按原草稿快照重新调度防抖，确保 300ms 后清旧展示并显警示；4. 严重回滚失败在独立只读 textarea 容器中原样呈现草稿供手动复制，提示诚实且禁止刷新。；来源 input:238e3436-8977-448a-8760-831f4163ca8c；日期 2026-10-05T01:53:07.034Z；适用范围 清空状态事务双输入框残留修复、空值任务回滚恢复、代码示意降级与只读复制兜底契约；结果 passed；哈希 fcde54f5664e240f9d81847b417f035a8a60a6e0ab7812d8f8ae52be6c8ccb08。
- evidence-fc126627-6e55-40e5-8be5-388ef378a21b：自动质量验收反馈指出：1. 交付粒度校正：blk-tech-interface 的整段内部 JavaScript 产生与正文不一致的额外偏差，明确降为非执行示意，以接口参数、状态所有权及提交/回滚后置条件为权威；2. R6-B1/P1：替换后回滚在 renderPlaceholder/clearInputError/focus 抛错时，由于 activeInputNode 仍为 oldNode，导致 rollback 仅回插 oldNode 而未移除已挂载的 newNode，在 DOM 中遗留两个同 ID 输入框。回滚必须完整清理已挂载的新节点，恢复单一输入框拓扑。；来源 input:238e3436-8977-448a-8760-831f4163ca8c；日期 2026-10-05T01:47:33.613Z；适用范围 R6质量验收反馈关于代码粒度降级与清空替换后回滚遗留双输入框缺陷；结果 passed；哈希 892aa0fae6479fbb35acb3212a6971c6d50b72bfe14efdc653ad5d6872770b2b。
- evidence-e10045cb-3170-4cb6-9c56-de754c9c69da：清空状态事务失败恢复要求：清空定义为有明确提交点和失败恢复的状态事务，失败前后原node、闭包、代际、草稿、isComposing与任务归属自洽，单调递增纪元防止迟到定时器混入，回滚时正确替换新节点避免残留空节点，确保用户失败后可继续键入、删空与重试。；来源 input:1488ed35-6288-4173-b10a-48bcd6cd16a4；日期 2026-10-05T01:49:24.363Z；适用范围 清空状态事务两阶段提交、DOM拓扑物理回插与防抖单调纪元守卫规则设计依据；结果 passed；哈希 ef2a9f1dbad38746cf2f668cf67a6b621196387e3a41b4ea6149bbb0baa5d288。
- evidence-26818016-03f1-4e6f-87b3-afaa4fdfeb82：在规划期尝试通过受控试验容器执行真实桌面浏览器环境验证，因 Docker 引擎不可用，且目标前端单页面应用尚未进入开发实现阶段，真实桌面浏览器（Chrome, Edge, Firefox, Safari）与目标应用产物缺失，受控试验未执行。如实记录为 unexecuted，此限制属于规划期宿主工具环境限制，非用户项目约束。清空重置状态事务在真实桌面浏览器中的原子回滚真机实测、DOM拓扑单输入框保真与原生 IME 事件流转核验留待开发阶段在具备真实宿主环境与目标产物后执行。；来源 experiment:experiment-0727b182-df3f-476f-9830-7dbe188eb9da；日期 2026-10-05T01:59:44.419Z；适用范围 清空重置状态事务在真实桌面浏览器中的原子回滚真机实测与输入法事件核验适用范围；结果 unexecuted；哈希 fa738af68dcfee597ba1a6994ad37978e640ebe957ef0c0d4780d8da8c4ac974。
