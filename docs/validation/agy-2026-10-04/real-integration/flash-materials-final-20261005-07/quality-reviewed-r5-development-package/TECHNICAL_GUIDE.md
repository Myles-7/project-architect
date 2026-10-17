# 真实集成验证-flash-materials-chinese-20261005-01 — 技术与接口

版本：36；批准蓝图：7fff755a90c600ec04e69939a28bfd2a732ad58a927fdafb00d90c0f24d08409

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

## 客户端运行时数据模型与状态结构规范（节点代际、调度纪元与持久配置模型）

ID：blk-tech-data-model；关联需求：blk-prod-scope、blk-feat-input-display、blk-feat-reset；依赖：blk-tech-module

客户端运行时采用单向流动的纯内存数据模型，不使用任何本地持久化存储（如 LocalStorage、IndexedDB），确保单次测试独立且不污染后续测试：
1. 校验判定结构体（ValidationResult）：
   - isValid: boolean（是否通过非空规则校验）；
   - errorMessage: string | null（未通过时提示文案，例如 '项目名不能为空，请输入有效字符'；通过为 null）。
2. 全局运行时状态模型（AppState）：
   - activeInputNode: HTMLInputElement | null（当前活跃在 DOM 树中的输入框元素引用，初始为页面加载时的 input 节点）；
   - inputGeneration: number（单调递增的输入节点代际计数器，初始为 1；每次清空替换节点时自增 1）；
   - schedulerEpoch: number（单调递增的防抖调度纪元计数器，初始为 0；每次 schedule 替代、cancel、clear 时自增 1）；
   - pendingTimerId: number | null（当前活跃的 300ms 防抖定时器句柄，无排队任务时为 null）；
   - projectName: string | null（当前已核对并在顶部大字展示的项目名，初始态为 null）；
   - validationError: string | null（当前挂载在输入框下方的错误信息，无错误时为 null）；
   - placeholderText: string（顶部展示区在初始、清空或空值态下的灰字占位符，常量定义为 '【等待输入核对】'）；
   - persistentAttributesSnapshot: Map<string, string>（节点持久配置映射集合，包含 label 关联 id/name、ARIA、tabindex、style/class 与 data-* 属性；瞬态 aria-invalid 不计入持久属性）。
3. 节点闭包私有上下文模型（NodeClosureContext）：
   - node: HTMLInputElement（当前闭包绑定的输入框节点引用）；
   - bornGeneration: number（当前节点诞生时的代际编号，不可变常量）；
   - isComposing: boolean（当前节点私有的中文输入法合成状态标记，初始为 false）；
   - trustedDraft: string（当前节点已接受的受信任草稿文本，初始为空字符串 ''）。
4. 状态转换路径：
   - [初始态 就绪]：inputGeneration=1, schedulerEpoch=0, pendingTimerId=null, projectName=null, validationError=null -> 展示区呈现灰字占位符，activeInputNode 聚焦等待；
   - [普通输入录入]：核验 e.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration，更新 trustedDraft=node.value，调用 schedule(trustedDraft, node, bornGeneration, ...)，schedulerEpoch++，pendingTimerId 激活 300ms 倒计时；
   - [IME 合成中]：触发 compositionstart，核验通过后置闭包私有 isComposing=true，调用 cancel()（schedulerEpoch++，pendingTimerId=null）挂起防抖定时器；
   - [IME 选词上屏]：触发 compositionend，核验通过后置闭包私有 isComposing=false，更新 trustedDraft=node.value，调用 schedule(trustedDraft, node, bornGeneration, ...) 重新启动 300ms 倒计时；
   - [清空重置触发]：用户点击清空 -> 立即调用 clearTimeout(pendingTimerId), pendingTimerId=null, schedulerEpoch++, inputGeneration++, 创建新节点 newNode（安全复制 5 类持久属性，重置 value='', trustedDraft='', 移除瞬态 aria-invalid）, oldNode.replaceWith(newNode), activeInputNode=newNode, projectName=null, validationError=null -> 展示区恢复灰字占位符，光标自动回焦 newNode；
   - [旧节点迟到事件到达]：派发至 oldNode，其闭包核查 bornGeneration !== inputGeneration 或 node !== activeInputNode，立即 return 丢弃，完全无法接触 activeInputNode，不制造空值错误；
   - [300ms 到期且非空]：定时器唤醒核查 thisEpoch === schedulerEpoch && targetGeneration === inputGeneration，ValidatorModule 对草稿快照 draftSnapshot 校验通过 -> projectName=draftSnapshot, validationError=null, pendingTimerId=null -> 展示区呈现黑色大字，输入框内容完好保留；
   - [300ms 到期且空值]：对草稿快照 draftSnapshot 校验未通过 -> validationError='项目名不能为空，请输入有效字符', projectName=null, pendingTimerId=null -> 展示区恢复灰字占位符（彻底清除旧项目名结果），输入框原样保留既有输入（含空格）。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9、evidence-17569c8c-1012-4071-8ebe-936b5fe286db；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148

## 组件事件契约与模块调用接口规范（节点代际守卫、调度纪元与自洽伪代码）

ID：blk-tech-interface；关联需求：blk-feat-input-display、blk-feat-reset；依赖：blk-tech-module、blk-tech-data-model

组件事件契约、状态流转与模块接口规范定义如下，包含自包含、无未定义引用的完整 JavaScript 伪代码：
1. 模块接口签名规范：
   - DisplayRenderer:
     * renderProjectName(displayElement: HTMLElement, text: string): void
     * renderPlaceholder(displayElement: HTMLElement, placeholderText: string): void
   - FeedbackBanner:
     * showInputError(inputNode: HTMLInputElement, container: HTMLElement, message: string): void
     * clearInputError(inputNode: HTMLInputElement, container: HTMLElement): void
     * showGlobalError(message: string): void
   - DebounceScheduler:
     * schedule(draftSnapshot: string, targetNode: HTMLInputElement, targetGeneration: number, callback: Function, delayMs?: number): void
     * cancel(): void
   - ValidatorModule:
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }
   - InputController:
     * bindInputNode(node: HTMLInputElement, bornGeneration: number): void
     * focusInput(): void
     * （规范：移除冗余未实现的 getInputText/setInputText 方法）
   - ResetController:
     * handleReset(): void
   - AppController:
     * init(elements: { displayElement: HTMLElement, initialInputNode: HTMLInputElement, errorContainer: HTMLElement, resetButton: HTMLElement }): void

2. 完整自包含 JavaScript 伪代码（DOM 引用显式注入、无 ReferenceError 风险、安全复制 5 类持久属性）：
```javascript
// 客户端运行时纯内存状态
let activeInputNode = null;
let inputGeneration = 1;
let schedulerEpoch = 0;
let pendingTimerId = null;

// DOM 元素引用由 AppController.init 显式装配
let displayElement = null;
let errorContainer = null;
let resetButton = null;

const DisplayRenderer = {
  renderProjectName(element, text) {
    if (element) {
      element.textContent = text; // 纯文本安全输出
    }
  },
  renderPlaceholder(element, placeholderText) {
    if (element) {
      element.textContent = placeholderText;
    }
  }
};

const FeedbackBanner = {
  showInputError(inputNode, container, message) {
    if (container) {
      container.textContent = message;
      container.style.display = 'block';
    }
    if (inputNode) {
      inputNode.classList.add('error');
      inputNode.setAttribute('aria-invalid', 'true');
    }
  },
  clearInputError(inputNode, container) {
    if (container) {
      container.textContent = '';
      container.style.display = 'none';
    }
    if (inputNode) {
      inputNode.classList.remove('error');
      inputNode.removeAttribute('aria-invalid');
    }
  },
  showGlobalError(message) {
    console.error('[Global Error]', message);
    let banner = document.getElementById('global-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'global-error-banner';
      banner.className = 'global-banner';
      document.body.prepend(banner);
    }
    banner.textContent = message;
    banner.style.display = 'block';
  }
};

const ValidatorModule = {
  validate(draft) {
    if (!draft || typeof draft !== 'string' || draft.trim().length === 0) {
      return { isValid: false, errorMessage: '项目名不能为空，请输入有效字符' };
    }
    return { isValid: true, errorMessage: null };
  }
};

const DebounceScheduler = {
  schedule(draftSnapshot, targetNode, targetGeneration, callback, delayMs = 300) {
    if (pendingTimerId !== null) {
      clearTimeout(pendingTimerId);
      pendingTimerId = null;
    }
    schedulerEpoch++;
    const thisEpoch = schedulerEpoch;
    pendingTimerId = setTimeout(() => {
      pendingTimerId = null;
      // 定时器到期四重有效性守卫
      if (
        thisEpoch !== schedulerEpoch ||
        targetGeneration !== inputGeneration ||
        targetNode !== activeInputNode ||
        !document.body.contains(targetNode)
      ) {
        return;
      }
      callback(draftSnapshot);
    }, delayMs);
  },
  cancel() {
    if (pendingTimerId !== null) {
      clearTimeout(pendingTimerId);
      pendingTimerId = null;
    }
    schedulerEpoch++;
  }
};

function handleDebouncedValidateAndDisplay(draftSnapshot) {
  try {
    const res = ValidatorModule.validate(draftSnapshot);
    if (!res.isValid) {
      DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】');
      FeedbackBanner.showInputError(activeInputNode, errorContainer, res.errorMessage);
    } else {
      FeedbackBanner.clearInputError(activeInputNode, errorContainer);
      DisplayRenderer.renderProjectName(displayElement, draftSnapshot);
    }
  } catch (err) {
    FeedbackBanner.showGlobalError('系统遇到异常，已为您保留当前输入');
  }
}

function replaceInputNode(oldNode, generation) {
  const newNode = document.createElement('input');
  // 安全持久配置复制策略：遍历 oldNode.attributes，复制 5 类持久属性，排除瞬态属性和编辑值
  const TRANSIENT_ATTRIBUTES = new Set(['value', 'aria-invalid']);
  for (let i = 0; i < oldNode.attributes.length; i++) {
    const attr = oldNode.attributes[i];
    if (!TRANSIENT_ATTRIBUTES.has(attr.name.toLowerCase())) {
      newNode.setAttribute(attr.name, attr.value);
    }
  }
  newNode.type = 'text';
  newNode.value = '';
  newNode.removeAttribute('aria-invalid');

  InputController.bindInputNode(newNode, generation);
  oldNode.replaceWith(newNode);
  return newNode;
}

const InputController = {
  bindInputNode(node, bornGeneration) {
    let isComposing = false;
    let trustedDraft = '';

    function guard(e) {
      if (
        e.currentTarget !== node ||
        node !== activeInputNode ||
        bornGeneration !== inputGeneration ||
        !document.body.contains(node)
      ) {
        return false;
      }
      return true;
    }

    node.addEventListener('compositionstart', (e) => {
      if (!guard(e)) return;
      isComposing = true;
      DebounceScheduler.cancel();
    });

    node.addEventListener('compositionend', (e) => {
      if (!guard(e)) return;
      isComposing = false;
      trustedDraft = node.value;
      DebounceScheduler.schedule(trustedDraft, node, bornGeneration, (draft) => {
        handleDebouncedValidateAndDisplay(draft);
      }, 300);
    });

    node.addEventListener('input', (e) => {
      if (!guard(e)) return;
      if (isComposing || e.isComposing) return;
      trustedDraft = node.value;
      DebounceScheduler.schedule(trustedDraft, node, bornGeneration, (draft) => {
        handleDebouncedValidateAndDisplay(draft);
      }, 300);
    });
  },
  focusInput() {
    if (activeInputNode) {
      activeInputNode.focus();
    }
  }
};

const ResetController = {
  handleReset() {
    try {
      DebounceScheduler.cancel();
      inputGeneration++;
      const oldNode = activeInputNode;
      const newNode = replaceInputNode(oldNode, inputGeneration);
      activeInputNode = newNode;
      DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】');
      FeedbackBanner.clearInputError(activeInputNode, errorContainer);
      InputController.focusInput();
    } catch (err) {
      FeedbackBanner.showGlobalError('重置遇到异常，已为您保留当前状态');
    }
  }
};

const AppController = {
  init(elements) {
    displayElement = elements.displayElement;
    errorContainer = elements.errorContainer;
    resetButton = elements.resetButton;
    activeInputNode = elements.initialInputNode;
    inputGeneration = 1;
    schedulerEpoch = 0;
    pendingTimerId = null;

    InputController.bindInputNode(activeInputNode, inputGeneration);
    resetButton.addEventListener('click', () => {
      ResetController.handleReset();
    });
    DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】');
    InputController.focusInput();
  }
};
```
说明：本伪代码为纯前端单页面开发规范与契约基准，实际目标应用尚未编写实现，合成核验不伪造为目标应用已通过浏览器实测的结论。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9、evidence-17569c8c-1012-4071-8ebe-936b5fe286db；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148

## 错误分类、旧结果清除机制与节点替换代际隔离容错策略

ID：blk-tech-error；关联需求：blk-feat-input-display、blk-prod-outcomes；依赖：blk-tech-interface

建立全面的客户端异常捕获与容错恢复机制，重点落实“失败时保留输入”决策、旧结果清除与节点物理替换闭包代际隔离策略：
1. E01 防抖校验拦截（空值或纯空白字符输入）：
   - 场景：用户键入若干空格，或将已有文字全部删空，且 300ms 防抖倒计时结束；
   - 拦截行为：ValidatorModule 判定 draftSnapshot 校验未通过（isValid 为 false）；
   - 旧结果清除行为：展示区已显示的旧项目名立即被清除，复位显示为初始灰色占位符“【等待输入核对】”，杜绝旧结果在空值状态下残留回显；
   - 呈现行为：调用 FeedbackBanner.showInputError 在输入框正下方挂载可见红色警示“项目名不能为空，请输入有效字符”，输入框设置 aria-invalid="true" 边框变红并保持高亮；
   - 保留与恢复：输入框内的既有字符（如输入的纯空格）严格原样保留，光标保持在输入框内部，绝不执行清空操作；用户补充输入有效字符后重新触发 300ms 防抖自动移除报错、清除 aria-invalid 并更新展示；
2. E02 异步竞态与幽灵渲染防护（Ghost Render Prevention）：
   - 场景：用户键入过程中立即点击清空按钮，或在 300ms 倒计时未结束前连续键入新字符；
   - 防护行为：必须调用 DebounceScheduler.cancel() 执行 clearTimeout(pendingTimerId) 并自增 schedulerEpoch，确保排队中的老回调不仅定时器被清除，即便已出队进入事件循环也会在唤醒守卫处因 thisEpoch !== schedulerEpoch 被作废丢弃；
3. E03 输入法合成态与清空后旧节点迟到事件隔离防护（IME & Trailing Event Node Replacement Guard）：
   - 场景：反例 A（旧 compositionstart -> reset -> 新输入 'Brand-New' -> 旧 compositionend 迟到到达）与反例 B（旧会话 reset 后新合成启动 -> 旧 compositionend 迟到到达）；
   - 防护行为：清空操作递增 inputGeneration，创建全新 input 节点采用持久配置复制策略替换旧节点（oldNode.replaceWith(newNode)），完整保留 label 关联、ARIA 属性、tabindex、style/class 与 data-* 属性，单独重置 value=''、trustedDraft='' 并移除瞬态 aria-invalid；在新节点闭包中初始化私有的 isComposing=false 与 trustedDraft=''；
   - 迟到事件处理：发往旧节点的迟到 compositionend、beforeinput 或尾随 input 事件，在进入旧闭包时因 node !== activeInputNode 以及 bornGeneration !== inputGeneration 第一时间被拦截直接 return，完全无法触碰 activeInputNode，绝不重写新节点的 value、绝不修改新节点的 isComposing 状态、绝不取消新定时器、绝不制造空值错误；新节点输入流程保持 100% 独立与顺畅；
   - 待验证边界与实测要求：合成隔离保证严格限于旧节点/旧闭包拦截；不同桌面操作系统及浏览器原生 IME 对脱离 DOM 的输入框派发事件细节、会话终结行为及是否存在原生重定向属于开发阶段真机实测用例，在当前规划环境无法做全量真机实测，标为 unexecuted 待开发验证任务；若实测中发现浏览器将原生事件重定向至新节点，根据实测日志修订清空策略（如 replaceWith 前显式 blur() 终结原生会话），不自造原生 token、不宣称永久隔离、不作彻底杜绝所有浏览器原生未定义行为的无依据绝对承诺；
4. E04 后台标签页节流与唤醒竞态防护（Background Tab Throttle Guard）：
   - 场景：页面置于后台标签页时浏览器对 setTimeout 产生 ≥1s 的节流延迟；
   - 防护行为：明确前台测量前提；当标签页唤醒或定时器到期时，schedulerEpoch 调度纪元与 inputGeneration 代际双重核验，确保只有未经取消且代际匹配的草稿快照才可更新界面，清空与新键入具有无条件前置失效能力；
5. E05 意外 DOM 异常与脚本运行时错误（Runtime Exception）：
   - 场景：DOM 节点获取失败或回调执行抛出未捕获 Error；
   - 拦截行为：在防抖回调、handleReset 与顶层 window.onerror 外层封装严格的 try...catch 与 FeedbackBanner 呈现；
   - 呈现行为：展示轻量警示条，并在控制台输出完整堆栈；
   - 保留与恢复：绝不重载页面，不抹除 activeInputNode.value 中的任何既有文本，输入框保持可编辑状态供用户修改重试；
6. E06 极端超长文本防撑破：展示区与输入框设置 overflow-wrap: anywhere; word-break: break-all; max-width: 100%；
7. E07 清空操作幂等性：连续多次点击清空保持节点同步物理替换与状态复位，无异步排队，不抛出异常。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9、evidence-17569c8c-1012-4071-8ebe-936b5fe286db；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148

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
