# Read-only candidate preview: flash-materials-final-contract-20261005-12

No final content verdict is implied. Control=running; reviewer=task-a7fea737-043c-4181-b556-b503ac518a90 (running).

Context SHA256=c75edfce44503aaea3a34c25fed01f037055851349a09df8a8a8469c0c1403d2.

## blk-deliv-task-layout-styling / task / 交付任务：单按钮精简视觉布局实现与确认按钮样式剔除

Stage=delivery; requirements=["blk-page-main-layout","blk-tech-stack"]; dependencies=["blk-page-main-layout","blk-tech-stack"]

依据删除确认按钮的反馈要求，彻底从 styles.css 与 index.html 中移除确认按钮样式与节点，仅保留顶部大字展示区、居中输入表单与底部橙色圆形清空按钮的清爽排布。

Task={
  "assumptions": [
    "用户在桌面显示器下查看页面，浏览器支持标准 CSS Flexbox"
  ],
  "completionCriteria": [
    "完成 HTML DOM 与 styles.css 的完整样式编写，确认按钮完全移除",
    "视觉元素忠实对应白底背景、顶部大字展示与底部橙色圆形清空色块",
    "多分辨率下无布局撑破"
  ],
  "exclusions": "不保留蓝色矩形确认按钮的任何 CSS 规则，不引入复杂动画库",
  "failureBehavior": "若视口宽度极窄，通过备用系统无衬线字体栈与 word-break: break-all 自适应换行，确保文本不截断不溢出",
  "goal": "依据删除确认按钮的反馈要求，彻底从 styles.css 与 index.html 中移除确认按钮样式与节点，仅保留顶部大字展示区、居中输入表单与底部橙色圆形清空按钮的清爽排布",
  "modules": [
    "DisplayRenderer",
    "Styles"
  ],
  "normalBehavior": "页面背景为纯白（#FFFFFF），顶部大字展示区字体加粗高对比度（字号≥32px），中部输入框居中排布，底部仅呈现橙色实心圆形【清空】按钮（底色 #FF5500），界面开阔清爽，无多余按键干扰",
  "scope": "HTML 语义化节点精简与 CSS 样式表编写，包含白底背景、顶部大字居中折行排布、中部输入框与底部单个橙色圆形清空按钮的定位控制",
  "verification": [
    "在桌面不同分辨率（1920×1080、1440×900）下查验页面渲染，确认界面无确认按钮残留且布局协调",
    "检查顶部展示区在长文本下是否正常折行（word-break: break-all），无水平滚动条溢出",
    "检查橙色圆形清空按钮的外观、背景色及 hover/active 反馈"
  ]
}


## blk-deliv-acc-security-edge / acceptance / 端到端安全防范与极端边界验收规范 Given-When-Then（三分支诚实容错）

Stage=delivery; requirements=["blk-feat-input-display","blk-tech-error","blk-prod-outcomes"]; dependencies=["blk-deliv-task-package"]

Scenario 1: 恶意标记纯文本安全回显（非 HTML 解析执行）
Given 页面处于就绪状态
When 用户在输入框中输入 `<script>window.__xss_flag = true; alert('XSS');</script><svg onload=alert(1)>` 并停止满 300 毫秒
Then 顶部展示区将上述字符完整作为纯文本安全显示，控制台 window.__xss_flag 值为 undefined，页面不弹出任何系统警报框，DOM 树中展示区子节点仅包含纯 Text 节点，无 HTML 元素被创建。

Scenario 2: 极端超长字符串输入排版防护
Given 用户在输入框中粘贴包含 1000 个连续无空格英文字符的超长项目名（如 'A' 重复 1000 次）
When 停止输入满 300 毫秒防抖触发
Then 展示区正常呈现该超长字符串，受 word-break: break-all 规则约束自动折行显示，展示区与主容器宽度不被撑破，页面不产生异常横向滚动条。

Scenario 3: 特殊实体字符原样保留回显
Given 用户输入包含 HTML 预留实体的项目名 `&amp; <test> \"quotes\" 'single'`
When 停止输入满 300 毫秒防抖触发
Then 展示区忠实显示 `&amp; <test> \"quotes\" 'single'` 原文，不发生双重转义或截断。

Scenario 4: 运行时错误防护、草稿保留与严重失败三分支验收（M7 规范）
Given 开发者在输入框中录入了重要的待核对项目名草稿
When 发生运行时异常时，按以下三个诚实分支分别验收：
  - 分支 A（普通非破坏性 DOM/脚本错误）：输入框草稿完好保留，主输入框保持可编辑与焦点，页面顶部呈现轻量通知横幅，不重载不刷新，开发者可直接复制或继续微调该文本；
  - 分支 B（清空严重回插失败且只读兜底挂载成功）：主输入框受限，页面严禁刷新，在独立只读 textarea 容器中逐字符全文呈现原始草稿，开发者可手动选中复制取回完整文本；
  - 分支 C（清空严重回插失败且只读兜底挂载亦失败）：系统不假造已呈现或已复制，原始草稿由 ResetController.recoveryDraft 稳定在内存持有，界面通过全局通知横幅诚实告知用户草稿保留在内存中但显示不可用，绝不刷新页面，待 DOM 恢复后可通过 retryRenderFallbackDraft 重试呈现。

Task=null


## blk-tech-stack / technology / 技术栈选型与运行规范（经典脚本 defer、端口规范与安全边界限定）

Stage=technical; requirements=["blk-prod-scope","blk-prod-outcomes"]; dependencies=["blk-prod-scope"]

技术栈严格遵守纯前端单页面边界约束，采用纯原生 HTML5、CSS3 与现代原生 JavaScript（标准经典脚本搭配 defer 属性加载与严格模式闭包隔离）：
1. 标记层（HTML5）：标准语义化单页面结构（<main>, <section>, <input>, <button>），彻底移除确认按钮节点，通过 WAI-ARIA 属性（aria-live="polite"）辅助就地错误提示展示；
2. 表现层（CSS3）：CSS Flexbox 弹性布局规范，彻底移除原确认按钮样式，保留白底背景（#FFFFFF）、顶部居中大字展示容器（高对比、word-break: break-all 折行防溢出）与底部橙色圆形清空按钮样式（#FF5500）；
3. 脚本组织与执行（JavaScript）：通过 <script defer src="app.js"></script> 加载自包含脚本，app.js 内部采用严格模式与立即执行函数表达式（IIFE）实现各模块封装与解耦；经典脚本搭配 defer 属性在本地双击（file:// 协议）下无 ES Module 的 CORS 跨域限制，零依赖直接运行，同时完全兼容本地轻量 HTTP 静态托管；
4. DOM 安全输出与适用边界声明：全面采用 W3C/WHATWG 标准 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML，确保用户输入仅以文本节点形式插入展示区 DOM，恶意标签原样纯文本回显；依据证据 evidence-dab40954-74e0-4d24-bb31-1064f5dd626f，明确该机制仅保证项目名文本节点不被浏览器解析为 HTML/脚本，不外推为全系统杜绝所有 DOM XSS 的绝对证明；全应用安全由禁用危险 API 静态审查与动态 Payload 验收共同保障；
5. 平台支持目标：面向 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15 等主流现代桌面浏览器，零转译零构建直接执行。

Task=null


## blk-tech-deployment / deployment / 运行环境支持要求、双启动模式、端口契约与离线边界规范

Stage=technical; requirements=["blk-prod-target","blk-prod-scope"]; dependencies=["blk-tech-stack"]

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

Task=null


## blk-deliv-task-package / task / 交付任务：静态产物装配、端口契约文档与交付包就绪

Stage=delivery; requirements=["blk-deliv-spec-deployment"]; dependencies=["blk-deliv-task-layout-styling","blk-deliv-task-input-workflow","blk-deliv-task-reset-workflow","blk-deliv-task-error-handling","blk-deliv-spec-deployment"]

完成剔除确认按钮后的 index.html、styles.css、app.js 与 README.md 静态装配与交付验证，统一本地 HTTP 服务端口为 8080 并明确启动命令契约与离线前提。

Task={
  "assumptions": [
    "用户在现代桌面操作系统（Windows/macOS/Linux）下获取交付目录",
    "操作系统已安装现代主流桌面浏览器作为默认网页查看器"
  ],
  "completionCriteria": [
    "所有交付文件就绪且相对路径关联正确，彻底移除确认按钮相关代码",
    "支持本地无依赖直接双击运行与轻量服务器启动双模式，本地服务端口统一指定为 8080 且命令与地址一致",
    "README.md 包含详细的防抖实时反馈操作说明、python/npx 启动命令与离线前提说明"
  ],
  "exclusions": "不引入任何 npm 打包构建链，不保留确认按钮残留代码，不依赖远程外部网络资源",
  "failureBehavior": "若文件缺失或相对路径错误，README.md 明确同级约束，app.js 进行 DOMContentLoaded 状态断言并在控制台清晰输出报错",
  "goal": "完成剔除确认按钮后的 index.html、styles.css、app.js 与 README.md 静态装配与交付验证，统一本地 HTTP 服务端口为 8080 并明确启动命令契约与离线前提",
  "modules": [
    "Packaging",
    "Documentation"
  ],
  "normalBehavior": "交付目录下 4 个文件同级放置，index.html 中不含确认按钮，app.js 包含 DebounceScheduler 与经典脚本 defer 加载；双击直接在现代桌面浏览器中正常呈现界面；README 记录 python -m http.server 8080 与 npx serve . --listen 8080，访问 http://localhost:8080 正常核对流转",
  "scope": "交付包文件结构组织、无外部 CDN 依赖检查、HTML/CSS/JS 静态关联校验与文档编写，依赖全部底层实现任务完成",
  "verification": [
    "检查交付目录下包含 index.html、styles.css、app.js 与 README.md 四个文件且均在同一级目录",
    "检查 index.html 与 styles.css 中无任何确认按钮相关元素与类名定义",
    "检查 README.md 中记录的本地 HTTP 服务命令为 python -m http.server 8080 与 npx serve . --listen 8080，且访问地址明确为 http://localhost:8080，标注 npx 首次需联网前提",
    "双击 index.html 直接打开，验证实时输入 300ms 自动展示与清空取消功能无报错运行"
  ]
}


## blk-deliv-acc-package / acceptance / 验收标准：交付包自包含性、端口契约与本地启动模式 Given-When-Then

Stage=delivery; requirements=["blk-deliv-spec-deployment"]; dependencies=["blk-deliv-task-package"]

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

Task=null


## blk-deliv-val-security-xss-audit / validation / 交付前置验证任务：XSS 安全词法审计、确认按钮移除退出码校验与动态回显验收

Stage=delivery; requirements=["blk-tech-stack","blk-deliv-spec-deployment"]; dependencies=["blk-deliv-task-package"]

对交付产物进行代码级纯文本渲染安全性、确认按钮彻底剔除与无外部依赖静态审计，覆盖普通空白变体，杜绝危险 API 隐式调用，并在目标应用实现后动态验证恶意 Payload 纯文本原样回显。

Task={
  "assumptions": [
    "遵循 W3C/WHATWG DOM 标准规范，纯前端单页面无服务端接入点",
    "静态词法检查基于已实现的源码文件，动态 Payload 注入测试在目标应用实现后执行"
  ],
  "completionCriteria": [
    "Node.js 静态安全审查命令执行退出码为 0，覆盖常见空白形式，0 处危险 API 调用",
    "确认按钮彻底剔除检查命令执行退出码为 0，发现残留明确以退出码 1 报告失败",
    "目标应用实现后，全部 10 项 XSS Payload 均纯文本原样回显，无脚本执行与弹窗",
    "明确区分静态词法检查与全应用安全证明，动态测试在当前规划期如实标为 unexecuted"
  ],
  "environment": "桌面现代主流浏览器，Node.js 运行时执行自动化静态源码审查脚本，本地无网络环境",
  "evidenceRequired": [
    "静态代码扫描输出日志（退出码 0）与 10 组 Payload 动态测试的 DOM 节点类型查验证明"
  ],
  "exclusions": "静态词法扫描不冒充全应用安全绝对证明；目标应用未实现时不伪造动态测试通过结果",
  "failureBehavior": "若静态审查发现任何隐式 HTML 解析、危险 API 或确认按钮残留，命令以 process.exit(1) 立即报错退出，排查改写后复测",
  "goal": "通过可直接解析执行的 Node.js 源码词法扫描脚本与目标应用动态 Payload 注入测试，核验交付源码中完全不存在 innerHTML、outerHTML、document.write、eval、new Function 等危险调用（覆盖常规空白形式），确认按钮代码 0 残留，并在目标应用实现后动态验证恶意 Payload 纯文本原样回显",
  "modules": [
    "DisplayRenderer",
    "ValidatorModule"
  ],
  "normalBehavior": "静态审查脚本对 app.js 全文进行扫描，确认 innerHTML、outerHTML、document.write、eval、new Function 等危险调用出现次数为 0（包括带空格变体）；确认按钮相关关键字在 HTML/CSS/JS 中出现次数为 0；目标应用实现后动态注入 10 种 Payload 均仅以纯文本原样回显，无弹窗、无网络外发、无 DOM HTML 元素生成。在当前规划期，目标应用尚未实现，动态测试标记为 unexecuted 待验证状态",
  "onFailure": "若静态检查发现危险 API 或确认按钮残留，或动态测试发生标签被解析执行，立刻阻断交付，修复为 textContent 纯文本绑定后重新执行全量用例。",
  "passCriteria": [
    "静态检查脚本输出通过，退出码为 0，危险 API 出现次数为 0；",
    "确认按钮代码剔除检查通过，退出码为 0，残留为 0；",
    "10 组 Payload 动态测试均安全显示为纯文本字符串，DOM 中无 HTML 元素被创建，无代码执行行为。"
  ],
  "scope": "审查 index.html、styles.css、app.js 源码全文，覆盖普通空白变体的危险 API 静态扫描；执行确认按钮彻底剔除退出码校验；动态注入 10 种典型 XSS Payload 验证纯文本无害化回显（应用实现后执行）",
  "steps": [
    "1. 在项目根目录执行可直接运行且覆盖空白变体的 Node.js 静态安全审查命令：node -e \"const fs = require('fs'); const code = fs.readFileSync('app.js', 'utf8'); const patterns = [{ name: 'innerHTML', regex: /innerHTML/ }, { name: 'outerHTML', regex: /outerHTML/ }, { name: 'document.write', regex: /document\\s*\\.\\s*write/ }, { name: 'eval', regex: /\\beval\\s*\\(/ }, { name: 'new Function', regex: /\\bnew\\s+Function\\s*\\(/ }]; const hits = patterns.filter(p => p.regex.test(code)).map(p => p.name); if (hits.length > 0) { console.error('发现禁用危险 API:', hits); process.exit(1); } else { console.log('静态安全检查通过：0 处危险 DOM/执行 API'); }\"；",
    "2. 执行确认按钮剔除验证命令（发现残留以退出码 1 明确报告失败）：node -e \"const fs = require('fs'); const html = fs.readFileSync('index.html', 'utf8'); const css = fs.readFileSync('styles.css', 'utf8'); const js = fs.readFileSync('app.js', 'utf8'); const keywords = ['btn-confirm', 'handleConfirm', '确认']; const hits = keywords.filter(k => html.includes(k) || css.includes(k) || js.includes(k)); if (hits.length > 0) { console.error('发现确认按钮残留关键字:', hits); process.exit(1); } else { console.log('确认按钮代码剔除检查通过：0 残留'); }\"；",
    "3. 构造 10 组典型跨站脚本 Payload（包括 <script>alert(1)</script>、<img src=x onerror=alert(1)>、<svg onload=alert(1)>、javascript:alert(1) 等）；目标应用尚未实现时标为 unexecuted；",
    "4. 待目标应用交付就绪后，依次录入并等待 300ms 防抖展示，检查 DOM 检查器中展示区节点的 children.length 是否始终为 0，是否仅包含纯 TextNode；",
    "5. 检查控制台网络面板与 Console，确认无异常网络外发和异常脚本执行报错。"
  ],
  "verification": [
    "执行 Node.js 源码扫描命令，验证其支持带空格变体（如 eval (x)、new Function (x)）并输出退出码 0",
    "执行确认按钮残留检查命令，验证在存在残留时以退出码 1 明确报错退出，在 0 残留时退出码为 0",
    "目标应用交付后，分别将 '<script>alert(1)</script>'、'<img src=x onerror=alert(1)>'、'javascript:alert(1)' 填入输入框，验证 300ms 后展示区为纯文本无弹窗"
  ]
}


## blk-deliv-val-perf-benchmark / validation / 交付前置验证任务：首屏 DOM 就绪与实时防抖响应性能基准实测（5轮均值闭合）

Stage=delivery; requirements=["blk-prod-outcomes"]; dependencies=["blk-deliv-task-package","blk-deliv-val-standalone-runtime"]

实测首屏 DOM 解析就绪耗时（目标 5 轮均值 ≤ 300ms）、300ms 防抖实时反馈调度延迟（目标 5 轮总耗时均值 ≤ 350ms，其中纯计算与重绘前调度延迟均值 ≤ 50ms）及清空重置至重绘前调度延迟（目标 5 轮均值 ≤ 50ms），建立真实精确且指标闭合的测量基准。

Task={
  "assumptions": [
    "运行在主流性能配置的桌面计算机（CPU 4核以上，内存 8GB以上）",
    "测试处于可见前台状态（document.visibilityState === 'visible'），测试数据规模为 1~200 字符的典型项目名测试文本"
  ],
  "completionCriteria": [
    "实测数据完整，首屏 DOM 就绪耗时 5 轮均值 ≤ 300ms",
    "输入防抖处理至重绘前调度总耗时 5 轮均值 ≤ 350ms（其中 DOM 更新与重绘前调度延迟 5 轮均值 ≤ 50ms）",
    "清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms",
    "测试过程中主线程无阻塞的长任务（Long Task > 50ms）",
    "形成完整的性能实测归档记录"
  ],
  "environment": "桌面 PC（现代 x86_64 或 Apple Silicon 架构，4 核以上 CPU，8GB 以上内存），Chrome 最新稳定版无痕模式，禁用所有第三方浏览器扩展，可见活动前台标签页，本地 file:// 协议或 localhost",
  "evidenceRequired": [
    "Chrome DevTools Performance 跟踪导出的 JSON 记录与控制台打印的 3 项指标各 5 轮耗时数据及均值计算日志"
  ],
  "exclusions": "不测量网络传输延时（测试在本地文件或本地回环服务下进行），不宣称 requestAnimationFrame 已证明物理像素绘制完毕，不声称尚未实测的数据已通过",
  "failureBehavior": "若实测均值超出阈值，分析是否有强制同步布局或不必要的 DOM 重查，精简 DOM 操作后复测",
  "goal": "实测验证轻量纯原生单页面的首屏 DOM 就绪耗时（目标 5 轮均值 ≤ 300ms）、300ms 输入防抖实时展示与清空交互响应延迟（防抖处理至重绘前调度总耗时 5 轮均值 ≤ 350ms，其中纯计算与重绘前调度延迟 5 轮均值 ≤ 50ms，清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms）的性能设计目标",
  "modules": [
    "AppController",
    "DebounceScheduler",
    "DisplayRenderer",
    "InputController"
  ],
  "normalBehavior": "在现代主流桌面浏览器可见前台加载并操作应用时，预期满足各项性能设计目标：首屏 DOM 就绪耗时（domContentLoadedEventEnd - startTime）目标 5 轮均值 ≤ 300ms；输入防抖展示总耗时目标 5 轮均值 ≤ 350ms（其中包含 300ms 定时器等待与 5 轮均值 ≤ 50ms 的 DOM 更新及重绘前调度延迟）；清空重置至重绘前调度延迟目标 5 轮均值 ≤ 50ms。当前阶段目标应用尚未实现，实际数值待交付验证阶段执行实测，不声称未来测试已通过",
  "onFailure": "若某项指标均值超时，审查 styles.css 中的选择器复杂度，检查 app.js 中是否存在频繁的 getComputedStyle 或重复 querySelector，将 DOM 引用缓存化后重新测试。",
  "passCriteria": [
    "首屏 DOM 就绪耗时（domContentLoadedEventEnd - startTime）5 轮均值 ≤ 300ms；",
    "输入防抖展示总响应耗时 5 轮均值 ≤ 350ms，其中 DOM 更新与重绘前调度延迟 5 轮均值 ≤ 50ms；",
    "清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms；",
    "测试过程中主线程无长任务卡顿。"
  ],
  "scope": "使用浏览器标准 Performance Navigation Timing API 与 Performance.now() 进行 DOM 就绪、实时防抖至重绘前回调及清空重置至重绘前回调打点测量，严格区分 DOM 解析就绪与物理绘制完成，统一 5 轮采样与均值通过边界",
  "steps": [
    "1. 启动 Chrome 无痕模式并加载交付的 index.html，保持页面处于可见前台标签页（document.visibilityState === 'visible'）；",
    "2. 测量首屏 DOM 就绪延迟：执行 const [nav] = performance.getEntriesByType('navigation'); console.log('DOM 就绪耗时:', nav.domContentLoadedEventEnd - nav.startTime)；重复 5 轮冷加载，记录每轮数值并计算 5 轮均值；",
    "3. 注入防抖测试打点探针：在 input 与 compositionend 事件监听起始处记录 window.__t_input = performance.now()；在 DisplayRenderer 更新后调用 requestAnimationFrame(() => console.log('防抖全流程耗时:', performance.now() - window.__t_input)) 打印耗时；",
    "4. 录入 50 字符典型项目名并停止打字，重复 5 轮测试，记录每轮总耗时与去除 300ms 后的调度延迟，分别计算 5 轮均值；",
    "5. 点击清空按钮，在 click 事件打点并在重绘前 requestAnimationFrame 回调打点计算清空重置至重绘前调度延迟，重复 5 轮测试并计算 5 轮均值；",
    "6. 汇总 DOM 就绪均值、输入防抖总耗时均值、调度延迟均值与清空重置至重绘前调度延迟均值，比对是否分别符合 ≤300ms, ≤350ms, ≤50ms 与 ≤50ms 的唯一通过边界。"
  ],
  "verification": [
    "在 Chrome DevTools Performance 面板录制 5 次冷加载 Trace，查验 DOMContentLoaded 耗时 5 轮均值是否 ≤ 300ms",
    "在控制台注入性能测量脚本，连续执行 5 次防抖展示与 5 次清空操作，统计 5 轮交互响应平均耗时是否达标（防抖总耗时均值 ≤ 350ms 且调度延迟均值 ≤ 50ms，清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms）",
    "输出包含设备配置、测试数据规模与 5 轮采样起止记录的性能实测数据表"
  ]
}


## blk-deliv-spec-deployment / deployment / 交付产物文件组织、双启动模式、固定 8080 端口与自包含离线规范

Stage=delivery; requirements=["blk-tech-deployment","blk-prod-scope"]; dependencies=["blk-tech-deployment"]

交付产物严格遵循零服务器端业务、零构建工具链依赖的纯静态极简标准，目录由 4 个同级核心文件组成：
1. index.html：语义化单页面 DOM 骨架，彻底剔除确认按钮节点，保留单行文本输入框与底部橙色圆形清空按钮，外链 styles.css，通过 <script defer src="app.js"></script> 加载脚本，无外部 CDN 依赖；
2. styles.css：视觉样式表，彻底剔除确认按钮相关 CSS 规则，保留白底背景（#FFFFFF）、顶部居中大字展示容器（加粗高对比、word-break: break-all 折行防溢出）与底部橙色圆形清空按钮（#FF5500），以及就地红色错误提示（#E53E3E）样式；
3. app.js：现代原生 JavaScript 编写，使用立即执行函数表达式（IIFE）封装各模块，经典脚本 defer 加载消除 file:// 下的 CORS 限制；包含 activeInputNode 与 inputGeneration 节点代际隔离管理、schedulerEpoch 防抖纪元快照防护，彻底移除确认按钮与 Enter 提交，支持 input 与 composition 实时防抖调度，全面采用 Node.textContent 纯文本节点绑定；
4. README.md：极简操作指南，详细记录本地直接双击运行（file:// 协议）与本地轻量静态 HTTP 服务运行模式；HTTP 服务模式固定端口 8080，明确提供 python -m http.server 8080 与 npx serve . --listen 8080 两种方式，访问地址统一为 http://localhost:8080；说明 npx 首次需联网前提、自包含离线前提（文件自包含、无 Service Worker 离线缓存）与核对验证步骤。

Task=null


## blk-deliv-task-input-workflow / task / 交付任务：输入节点闭包绑定、解绑契约、草稿快照防抖调度与安全渲染交付

Stage=delivery; requirements=["blk-feat-input-display","blk-tech-module","blk-tech-interface"]; dependencies=["blk-deliv-task-layout-styling","blk-tech-module","blk-tech-interface"]

实现文本输入框的事件闭包监听、解绑契约、节点代际四重守卫核验、输入草稿快照捕获、DebounceScheduler 纪元防抖调度、IME 组合态闭包管理，以及 Node.textContent 安全展示逻辑，彻底杜绝到期重读 DOM 或执行作废回调，移除确认按钮专属逻辑。

Task={
  "assumptions": [
    "浏览器支持标准 Window 定时器与原生 DOM API，主线程事件循环正常调度",
    "用户使用桌面键盘与输入法进行单人单机本地原型核对"
  ],
  "completionCriteria": [
    "完成 InputController.bindInputNode 与 unbindInputNode 编码，同节点重复绑定安全解绑，异常时撤销监听",
    "完成 DebounceScheduler 编码，输入变化等待 300ms 自动展示大字",
    "事件前置四重守卫完整生效，非活跃节点事件直接 return，不误操作新节点",
    "DebounceScheduler 严格接收并使用草稿快照 draftSnapshot，核验 schedulerEpoch 与 targetGeneration",
    "输入法合成期间挂起防抖，选词完成后启动 300ms 倒计时",
    "顶部大字通过 Node.textContent 作为纯文本节点渲染，恶意字符原样回显",
    "展示成功后输入框内容完好保留，方便用户二次编辑微调"
  ],
  "environment": "桌面现代主流浏览器运行时环境",
  "evidenceRequired": [
    "输入节点事件闭包绑定与解绑测试日志、防抖 300ms 计时器调度记录、四重守卫拦截迟到事件日志、textContent 纯文本回显查验证明"
  ],
  "exclusions": "不引入外部第三方防抖库，不使用 innerHTML，不进行网络请求，不绑定确认按钮与回车表单提交专属逻辑，不假称普通 InputEvent 自带应用自增令牌",
  "failureBehavior": "若输入恶意标签字符（如 <script>），严格通过 textContent 作为纯文本节点回显；若遇到空值或纯空格，立即清除旧项目名并恢复占位符，输入框内容原样完好保留；若闭包守卫检测到代际或节点不匹配，立即直接 return，绝不修改新节点状态或制造空值错误；若节点监听绑定中途抛错，撤销本次已注册监听并抛出 TypeError",
  "goal": "实现输入框事件闭包绑定、解绑契约、节点代际四重守卫核验、已接受草稿快照捕获、DebounceScheduler 纪元防抖调度、IME 组合态节点级管理及 Node.textContent 安全渲染，移除确认按钮与 Enter 提交专属逻辑",
  "modules": [
    "InputController",
    "DebounceScheduler",
    "DisplayRenderer",
    "ValidatorModule"
  ],
  "normalBehavior": "用户在活跃输入框中键入有效字符，闭包通过 event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node) 守卫，在非合成态下捕获 draftSnapshot，传入 DebounceScheduler.schedule；300ms 到期后核验 thisEpoch === schedulerEpoch && targetGeneration === inputGeneration，针对 draftSnapshot 校验通过后使用 Node.textContent 安全渲染大字，输入框完好保留当前草稿供二次微调；拼音合成期间通过闭包私有 isComposing 挂起防抖；脱离 DOM 的旧节点事件在闭包入口被立即返回丢弃；同节点重复调用绑定时先自动安全解绑旧监听",
  "onFailure": "阻断输入流转验收，排查 InputController 守卫逻辑、unbindInputNode 清理或防抖定时器后复测",
  "passCriteria": [
    "输入文字停止满 300ms 自动显示加粗大字，输入框文本保留；拼音合成态不触发防抖；清空后旧节点迟到事件被有效拦截；重复绑定恰好一次响应，不累加监听"
  ],
  "scope": "InputController.bindInputNode 与 unbindInputNode 逻辑、四重守卫核验、DebounceScheduler.schedule(draftSnapshot, targetNode, targetGeneration, callback, delayMs) 调度实现、DisplayRenderer.renderProjectName 纯文本绑定及失败草稿保留",
  "steps": [
    "编写 InputController 模块，实现 bindInputNode 与 unbindInputNode 方法及内部监听句柄映射表",
    "编写 DebounceScheduler 模块，实现 schedule、cancel 与 hasPending 方法及单调自增 schedulerEpoch",
    "编写 DisplayRenderer 模块，实现 renderProjectName 与 renderPlaceholder 方法",
    "集成输入事件监听、IME 合成状态机与 300ms 防抖调度流转，移除所有确认按钮专属代码"
  ],
  "verification": [
    "在输入框输入常规项目名 'Project-Alpha-01' 停止 300ms，核对顶部大字自动即时显示且输入框文本保留",
    "使用中文拼音输入法键入中文，核对拼音输入未确认选词时不发生展示更新，选词上屏后满 300ms 准确展示中文字符",
    "模拟在旧节点输入后触发清空生成新节点，随后向旧节点派发迟到的 compositionend 与 input 事件，核对旧事件被拦截丢弃，新节点 value 保持为空，350ms 后无空值错误且展示区保持占位符",
    "在新节点输入 'Brand-New' 期间向旧节点派发 compositionend，核对新节点防抖定时器未被取消且草稿未被抹除，满 300ms 后大字正常展示 'Brand-New'",
    "在输入框输入 '<img src=x onerror=alert(1)>' 停止 300ms，核对展示区原样输出纯文本标签字符串，无控制台告警或弹窗执行",
    "连续快速键入 10 个字符，核对防抖计时器被正确重置，仅在最终停止 300ms 后触发一次展示更新",
    "重复调用 bindInputNode 两次，键入字符核对防抖调度仅触发一次，无重复调度"
  ]
}


## blk-tech-data-model / data_model / 客户端运行时数据模型与状态结构规范（代际纪元、五类持久配置、挂载替换记录与事务快照模型）

Stage=technical; requirements=["blk-feat-input-display","blk-feat-reset"]; dependencies=["blk-tech-stack"]

客户端纯内存状态模型与数据结构契约规范：
1. 客户端运行时核心数据契约：
   - activeInputNode: HTMLInputElement | null（指向当前处于页面 DOM 树中的唯一合法活跃输入框）；
   - inputGeneration: number（全局单调递增代际编号，初始化为 1，仅在清空状态事务成功提交点时自增更新）；
   - schedulerEpoch: number（调度纪元计数器，初始化为 0，每次调用 schedule、cancel 或回滚时单调自增，用于使旧定时器安全失效）；
   - isInitialized: boolean（初始化状态标记，初始化为 false，仅在 AppController.init 核心装配步骤全部成功后的提交点置为 true）；
   - registeredResetButton: HTMLElement | null 与 registeredResetHandler: ((e: MouseEvent) => void) | null（记录清空按钮及实际注册监听句柄引用，供 AppController 重试或清理时精准解绑）；
   - registeredInputNode: HTMLInputElement | null（记录初始输入框节点引用，供 AppController.init 异常清理时调用 InputController.unbindInputNode 解绑）；
   - severeFallbackContainer: HTMLElement | null（独立只读草稿容器或其宿主锚点引用）；
   - isComposing: boolean（输入节点闭包私有变量，初始化为 false，指示当前输入节点是否处于拼音输入法合成期间）；
   - trustedDraft: string（输入节点闭包私有变量，缓存当前节点已接受的原始输入文本快照）；
   - recoveryDraft: string | null（ResetController 持久内存恢复状态所有权，在严重回滚失败分支持有原始草稿，生命周期跨事务保留直到下一次成功编辑/清空，禁止刷新、不承诺跨刷新）。
2. 清空状态事务快照数据结构（ResetTransactionSnapshot）：
   - activeInputNode: HTMLInputElement（原输入节点实例引用，保证非空）；
   - inputGeneration: number（原全局代际编号 G）；
   - schedulerEpoch: number（原调度纪元编号）；
   - hadPendingTimer: boolean（发起清空瞬间是否存在在途排队的 300ms 防抖任务，通过 hasPending() 判定）；
   - draft: string（原输入框原始文本内容 activeInputNode.value，完整保留空串、前后及重复空格）；
   - displayContent: string（展示区当前文本内容）；
   - errorContent: string（当前错误提示文本）；
   - isErrorVisible: boolean（错误提示容器当前显隐状态）；
   - hadErrorClass: boolean（原输入框当前是否包含 'error' 类名）；
   - hadAriaInvalid: boolean（原输入框当前 aria-invalid 属性值）；
   - parentNode: Node | null（原输入节点在 DOM 树中的父节点引用）；
   - nextSibling: Node | null（原输入节点在 DOM 树中的后继兄弟节点引用）。
3. 挂载替换记录契约（mountedReplacementNode）：
   - mountedReplacementNode: HTMLInputElement | null（清空事务执行期间显式记录已挂载至 DOM 树的全新输入节点实例，供回滚时精确定位并彻底从 DOM 树移除，消除双输入框缺陷）。
4. 五类持久配置结构（FivePersistentAttributeCategories）：
   - 1. label 关联属性（id, name）；
   - 2. ARIA 无障碍属性（aria-label, aria-describedby, aria-required 等全部持久 ARIA 配置）；
   - 3. 键盘导航属性（tabindex）；
   - 4. 表现样式属性（class 类名与 style 内联样式）；
   - 5. 测试与自定义属性（data-* 属性，如 data-test）；
   - 过滤与重置规则：value 严格重置为 ''，trustedDraft 严格重置为 ''，瞬态 aria-invalid 与错误类名在创建新节点时不予复制并单独移除。
5. 严重回滚失败草稿兜底容器模型（SevereFallbackDraftModel）：
   - 独立多行只读文本框（readonly textarea），value 逐字符绑定已捕获的原始草稿 draftText，readOnly = true，tabindex = "0"，通过纯文本属性赋值杜绝 HTML 解析注入，支持点击与手动选中复制取回；挂载状态由布尔值准确返回，挂载失败时直接转入可见全局错误通知，坚决杜绝 window.location.reload()。

Task=null


## blk-tech-error / error / 错误分类、旧结果清除机制、清空状态事务原子回滚与只读草稿复制兜底策略

Stage=technical; requirements=["blk-feat-input-display","blk-feat-reset"]; dependencies=["blk-tech-data-model"]

系统异常分类标准、旧结果清除机制、清空状态事务原子回滚与只读草稿复制兜底策略：
1. 错误分类与防御规范：
   - E01（空值或纯空白输入校验拦截）：输入框删空或仅录入空格制表符停止 300ms 时，顶部展示区旧项目名立即被彻底清除并恢复为灰色占位提示 '【等待输入核对】'，输入框正下方呈现红色明确提示 '项目名不能为空，请输入有效字符'，输入框内输入的字符（含空格）完好保留，光标保持在输入框内；
   - E02（DOM 节点操作与渲染异常防护）：展示渲染或错误挂载过程中的 DOM 操作异常被局部 try-catch 拦截，输入框文本严格保留，界面顶部呈现轻量警示，不执行刷新；
   - E03（清空状态事务异常与原子拓扑回滚，解决 R6-B1, R6-B2 与 M5, M6）：
     * 快照捕获阶段异常（M5 规范）：处于独立异常保护内，若 activeInputNode 缺失或读取抛错，因尚未发生任何 DOM 或状态修改，直接调用 FeedbackBanner.showGlobalError 呈现可见错误提示，不调用 rollback，原输入框、草稿文本、代际与在途定时任务完全保持，输入框保持可编辑，草稿不丢失；
     * 准备阶段（创建/属性复制/绑定）抛错：catch 执行 rollback(snapshot, error, null)，因 replacement 节点未挂载，原节点 oldNode 完好保留，activeInputNode 仍指向 oldNode，代际保持为原代际 G（未提前递增），草稿与焦点完好；
     * 替换阶段（replaceWith）抛错：catch 执行 rollback(snapshot, error, null)，若 oldNode 脱离则按快照插回原 parentNode 与 nextSibling 原位，确保单一输入框与唯一 ID；
     * 替换后阶段（renderPlaceholder/clearInputError/focus）抛错：catch 执行 rollback(snapshot, error, mountedReplacementNode)，显式识别 replacement 节点 newNode 并从 DOM 树彻底移除（通过 replaceChild 回插 oldNode 或 remove 后回插 oldNode），消除双输入框与同 ID 缺陷；activeInputNode 重新指向 oldNode，代际还原为原 G；schedulerEpoch 单调自增；
     * 原始草稿无差别重调度：若快照中 hadPendingTimer 为 true，无条件针对 snapshot.draft（包括空字符串 ''、纯空格 '   ' 或非空项目名）重新调度 300ms 防抖，空值与纯空格在 300ms 后忠实执行校验，清除旧项目名并出红色警示，空格原文保留；因代际还原，原闭包中 bornGeneration === inputGeneration 完全自洽，用户可继续键入 'Edited after failure' 正常更新展示；
   - E04（严重回插失败内存持有、只读草稿复制兜底与通知通道，M6 规范）：若回插原节点严重失败，定义诚实失败状态：不声称完整恢复，坚决禁止 window.location.reload() 刷新页面；ResetController.recoveryDraft = snapshot.draft 持久在内存持有草稿；调用 FeedbackBanner.showSevereFallbackDraft 挂载独立只读 textarea 容器并逐字符呈现原始 draft 文本（保留换行与所有空格）；若挂载成功，提示说明主编辑器受限，草稿已在只读区安全保留；若挂载失败，绝不声称复制就绪，直接调用 FeedbackBanner.showGlobalError 呈现可见报错，不以 console 代替交互；若全局通知亦失败则诚实标为内存保留、显示不可用，绝不递归触发 window.onerror；
   - E05（应用初始化装配异常安全清理，M4 规范）：若 AppController.init 核心装配抛错，执行安全解绑清理（解除 resetButton 监听与 input 节点监听），保持 isInitialized 为 false，输入框草稿完好保留，呈现可见错误横幅，支持重试。

Task=null


## blk-deliv-task-reset-workflow / task / 交付任务：一键即时清空、输入节点五类持久属性复制与状态事务原子拓扑回滚交付

Stage=delivery; requirements=["blk-feat-reset","blk-tech-interface","blk-tech-module"]; dependencies=["blk-deliv-task-layout-styling","blk-tech-interface","blk-tech-module"]

实现一键即时直接清空、五类持久属性完整复制、瞬态属性重置、输入节点物理替换（replaceWith）、两阶段状态事务提交与失败原子拓扑回滚（彻底移除新节点保真单输入框、原始草稿无差别重调度），彻底隔离旧节点迟到事件。

Task={
  "assumptions": [
    "桌面浏览器支持标准 DOM 操作（replaceWith, insertBefore, replaceChild）与事件绑定机制",
    "用户使用鼠标单机点击底部清空按钮，主线程无长时间不可中断的死循环阻塞"
  ],
  "completionCriteria": [
    "实现一键即时直接清空逻辑，5 类持久属性完整保留，瞬态状态单独重置，无二次确认弹窗",
    "实现清空两阶段状态事务与原子提交点，仅在全部成功后递增代际与更新活跃节点",
    "实现快照捕获失败安全分支，直接呈现可见错误并保持原输入与待任务不变，不调用 rollback",
    "实现针对三阶段异常的原子拓扑回滚，显式彻底移除 replacement 节点并回插原节点，断言单一输入框且 ID 唯一（0 replacement 残留）",
    "实现原始草稿无差别重调度，无论 empty、纯空格还是有效文本均在 300ms 后忠实执行原规则校验，旧展示彻底清除",
    "实现严重回插失败由 ResetController.recoveryDraft 持有草稿，在独立只读 textarea 容器中逐字符呈现原始草稿供用户手动复制；若挂载失败直接呈现可见全局错误，禁止 window.location.reload() 刷新，提供 retryRenderFallbackDraft 重试入口"
  ],
  "environment": "桌面现代主流浏览器运行时环境",
  "evidenceRequired": [
    "清空状态事务两阶段执行日志、五类持久属性复制与瞬态重置断言记录、快照捕获失败可见报错日志、原子回滚单 DOM 节点数量断言记录（querySelectorAll('#project-name-input').length === 1，0 replacement 残留）、原始草稿无差别重调度执行记录、以及严重失败只读 textarea 呈现与挂载失败可见报错记录"
  ],
  "exclusions": "不弹窗二次确认，不引入复杂状态管理库，不使用已废弃的 DOMNodeInserted 变动事件，不使用 window.location.reload() 刷新页面，不假称普通 InputEvent 自带应用自增令牌",
  "failureBehavior": "若清空快照捕获抛错，直接可见报错并保持原状态不动；若清空状态事务在内存预制、replaceWith 替换、占位复位、错误清除或焦点恢复任意阶段抛错，catch 立即触发 rollback 恢复单一原输入框，代际还原为原 G，无差别按原始草稿重新调度防抖，回焦原节点并提示友好横幅；若回插严重失败通过 showSevereFallbackDraft 在只读 textarea 呈现草稿供手动复制取回，将草稿存入 recoveryDraft 内存所有权，挂载失败时直接展示全局可见错误，禁止页面刷新，通知失败不抛错也不递归 window.onerror",
  "goal": "实现一键即时直接清空、五类持久属性完整复制、瞬态属性重置、输入节点物理替换（replaceWith）、两阶段状态事务提交与失败原子拓扑回滚（彻底移除新节点保真单输入框、原始草稿无差别重调度），彻底隔离旧节点迟到事件",
  "modules": [
    "ResetController",
    "InputController",
    "DebounceScheduler",
    "DisplayRenderer",
    "FeedbackBanner"
  ],
  "normalBehavior": "点击底部橙色圆形清空按钮时，调用 captureSnapshot 捕获包含 activeInputNode、代际、纪元、草稿与 DOM 位置的快照；内存创建全新 input 节点并复制 5 类持久属性，绑定新闭包；执行 cancel() 废弃旧任务并使 schedulerEpoch 前进；执行 oldNode.replaceWith(newNode) 物理替换；复位展示区为占位符，清除错误，新节点获取焦点；全部成功后原子提交更新 activeInputNode = newNode 并递增代际 inputGeneration++；脱离 DOM 的旧节点迟到事件因代际和节点引用失配被入口守卫拦截丢弃，不污染新输入框",
  "onFailure": "阻断清空流转验收，排查 ResetController 事务状态机、属性复制、回滚 DOM 操作、重调度或只读草稿兜底逻辑后复测",
  "passCriteria": [
    "点击清空按钮即时清除大字并呈现占位符，输入框被物理替换，5 类持久属性完好保留，瞬态状态单独重置，光标自动回焦新输入框，无二次确认弹窗；旧节点迟到事件被有效隔离；快照捕获失败保持原状态且可见报错；替换中后抛错能原子回滚为单输入框且代际不增；空白任务回滚后能重新调度并清除旧展示；严重回插失败在只读 textarea 呈现草稿供复制，挂载失败直接可见报错，无刷新"
  ],
  "scope": "ResetController 模块编写、两阶段状态事务状态机、快照失败分支保护、5 类持久属性安全复制、瞬态状态重置、原子拓扑回滚逻辑、排队任务无差别重调度、内存恢复草稿所有权与严重失败只读 textarea 复制呈现及可见报错",
  "steps": [
    "编写 ResetController 模块，实现 captureSnapshot、handleReset、rollback 与 retryRenderFallbackDraft 方法",
    "实现两阶段提交逻辑与 commit point 显式更新契约",
    "实现快照捕获失败独立捕获分支，直接调用 FeedbackBanner.showGlobalError 并保持原状态，不调用 rollback",
    "实现 replaceWith 节点替换与三阶段异常回滚，回滚中显式检测并彻底移除 replacementNode，插回 oldNode，断言 DOM 单一输入框与 0 replacement 残留",
    "实现原始草稿无差别重新调度，针对 empty、纯空格与非空草稿均恢复 300ms 防抖调度",
    "实现严重回插失败通过 showSevereFallbackDraft 在只读 textarea 呈现原始草稿并由 recoveryDraft 内存持有，挂载失败直接全局可见报错，禁止 reload"
  ],
  "verification": [
    "点击清空按钮，核对顶部展示区立即清除大字并呈现占位符，原输入框被新节点物理替换，value 为空且瞬态 error/aria-invalid 彻底清除，5 类持久属性完整保留，光标自动回焦新输入框，无确认弹窗",
    "在快照捕获期注入异常，验证直接弹出可见错误，原节点、代际、草稿与排队防抖任务完好保留，未调用 rollback",
    "在准备期注入异常，验证 catch 触发回滚，activeInputNode 仍为原节点，代际未增，草稿与焦点保留",
    "在 replaceWith 成功后注入 renderPlaceholder 异常，验证 rollback 显式移除 newNode 并回插 oldNode，断言 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留，草稿完好且获得焦点",
    "在输入三个空格产生防抖任务后清空并注入 replaceWith 失败，验证回滚后重新调度 300ms 任务，满 300ms 后展示区旧项目名被清除并恢复占位符，输入框下方出现红色非空提示，三个空格完好保留",
    "注入严重回插失败，验证页面未发生刷新（window.location.reload 未被调用），草稿由 ResetController.recoveryDraft 持有，界面在只读 textarea 容器中原样呈现原始 draft 供复制；若容器挂载失败验证弹出明确可见全局错误横幅，且 retryRenderFallbackDraft 可在后续调用"
  ]
}


## blk-deliv-task-error-handling / task / 交付任务：防抖校验拦截、就地提示、旧结果清除、清空事务拓扑回滚与只读草稿复制容错交付

Stage=delivery; requirements=["blk-feat-reset","blk-tech-error"]; dependencies=["blk-deliv-task-layout-styling","blk-deliv-task-reset-workflow","blk-tech-error"]

实现空值/纯空格校验拦截、旧结果彻底清除、输入保留、初始化异常装配清理、清空事务三阶段异常原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）、以及严重失败独立只读草稿复制兜底容器呈现与可见报错。

Task={
  "assumptions": [
    "桌面浏览器已加载视觉样式表与基础骨架，WAI-ARIA 属性支持正常"
  ],
  "completionCriteria": [
    "实现空值与纯空格 300ms 校验拦截、就地红色警示展示、已显示旧项目名彻底清除恢复占位符、原文（含空格）原样保留",
    "实现 AppController.init 初始化异常拦截与安全清理，解绑残余清空与节点监听且不破坏草稿，isInitialized 保持 false 并呈现可见全局报错，支持重试",
    "实现清空事务三阶段异常原子拓扑回滚，彻底移除 replacement 节点并回插原节点，断言单一输入框且 ID 唯一（0 replacement 残留）",
    "实现 empty、三个空格、nonempty 待任务回滚后无差别重新调度与旧展示清除",
    "实现严重回插失败由 ResetController.recoveryDraft 稳定持有草稿，在独立只读 textarea 中逐字符全文呈现与手动选中复制兜底，挂载失败时直接通过全局横幅可见报错，无刷新，通知失败不引发二次异常",
    "实现全局未捕获异常顶部横幅呈现，草稿文本严格保留"
  ],
  "environment": "桌面浏览器运行时环境",
  "evidenceRequired": [
    "输入校验错误呈现与清除日志、AppController.init 装配清理与重试日志、清空回滚单 DOM 拓扑断言记录、空值/纯空格重调度执行日志、以及严重失败只读 textarea 呈现与挂载失败可见报错记录"
  ],
  "exclusions": "不使用 alert 模态弹窗，不使用 window.location.reload() 刷新页面，不强制清空用户已输入的无效字符，不以纯控制台输出替代可见交互，不递归触发 window.onerror",
  "failureBehavior": "若初始化发生异常，安全解绑监听并展示可见错误横幅，草稿完好保留且支持重试；若运行时发生 DOM 或异步异常，顶部横幅可见提示，输入框草稿文本严格保留；若清空回插失败，内存持有草稿并在只读 textarea 就地呈现供手动复制，挂载失败时直接展示全局可见错误，禁止页面刷新，通知失败不抛错",
  "goal": "实现空值/纯空格校验拦截、旧结果彻底清除、输入保留、初始化异常装配清理、清空事务三阶段异常原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）、以及严重失败独立只读草稿复制兜底容器呈现与可见报错",
  "modules": [
    "ValidatorModule",
    "FeedbackBanner",
    "ResetController",
    "DisplayRenderer",
    "AppController"
  ],
  "normalBehavior": "输入空串或纯空格且停止 300ms 时，顶部展示区旧项目名立即被清除并恢复为占位符“【等待输入核对】”，输入框正下方呈现红色非空警示，输入文本完好保留；初始化异常时安全清理并不提前就绪；清空事务遇异常回滚时，页面维持单一合法输入框，代际还原为原 G，原始草稿无差别重新调度防抖；严重回滚失败在内存持有草稿并在只读 textarea 呈现供手动复制，挂载失败直接可见报错，禁止刷新",
  "onFailure": "阻断错误处理验收，排查错误分类、输入保留、拓扑回滚、重调度或只读草稿兜底逻辑后复测",
  "passCriteria": [
    "空值及纯空格输入 300ms 后旧大字彻底清除恢复占位符且出红色提示，输入完好保留；初始化异常安全清理且不提前就绪；清空回滚维持单一输入框、0 replacement 残留且无差别重调度；严重回插失败草稿内存安全驻留并在只读 textarea 呈现，挂载失败直接可见报错，无刷新"
  ],
  "scope": "输入校验逻辑、错误提示展示与清除、旧大字彻底清除、AppController.init 装配清理与重试支持、清空事务三阶段异常回滚（单 DOM 保真、草稿重调度）、以及严重失败只读 textarea 复制呈现与挂载失败可见报错",
  "steps": [
    "编写 ValidatorModule 与 FeedbackBanner 模块，实现空值与纯空格 300ms 防抖拦截并彻底清除旧项目名展示",
    "在 AppController.init 增加依赖校验、安全解绑清理与异常捕获逻辑，装配失败保持 isInitialized=false 并展示可见全局错误，支持重试",
    "在 ResetController.rollback 落实三阶段异常原子拓扑回滚，彻底移除 replacementNode 并回插 oldNode，恢复单一输入框（0 replacement 残留）",
    "在 rollback 落实 hadPendingTimer 原始草稿无差别重调度，确保 empty、纯空格与非空草稿均在 300ms 后忠实执行原规则校验并清除旧展示",
    "在 rollback 实现严重回插失败由 recoveryDraft 内存持有，并通过 showSevereFallbackDraft 在只读 textarea 逐字符全文呈现原始草稿供手动复制，若挂载失败直接调用 showGlobalError 呈现可见错误，禁止 window.location.reload() 刷新"
  ],
  "verification": [
    "输入有效项目名展示成功后，全部删空（或录入三个空格）并停止 300ms，核对旧项目名彻底清除恢复占位符，红色非空警示明确，空格原文完好保留",
    "在 AppController.init 装配期注入异常，核对解绑已注册清空与节点监听，isInitialized 为 false，输入框草稿完好，弹出可见全局错误，重试后正常进入就绪态",
    "清空事务三阶段异常注入（快照期、创建/复制/绑定前、replaceWith 抛错、替换后呈现/清理/焦点失败），断言原节点拓扑还原、单一输入框、0 replacement 残留、代际还原为原 G",
    "empty、三个空格、nonempty 待任务回滚后无差别重新调度与旧展示清除",
    "故障撤除后键入 'Edited after failure' 正常 300ms 更新大字",
    "严重回滚失败 readonly textarea 逐字符全文呈现与手动选中复制，草稿在 ResetController.recoveryDraft 内存保留，挂载失败直接通过可见横幅报错，无刷新"
  ]
}


## blk-deliv-acc-full-e2e / acceptance / 端到端集成验收规范：防抖实时核对、节点替换隔离、事务拓扑回滚与只读草稿复制 Given-When-Then

Stage=delivery; requirements=["blk-feat-reset","blk-tech-error"]; dependencies=["blk-deliv-task-reset-workflow","blk-deliv-task-error-handling"]

Scenario 1: 正常键入 300ms 防抖实时大字展示（无需确认按钮）
Given 页面处于就绪待命状态，展示区显示占位提示 '【等待输入核对】'
When 用户在输入框中录入 'Project-Beta-01' 并停止输入满 300 毫秒
Then 顶部展示区自动显示加粗高对比大字 'Project-Beta-01'，输入框完好保留 'Project-Beta-01'，页面无错误提示，全程无需点击确认按钮。

Scenario 2: 删空文本与纯空格输入防抖拦截、旧结果彻底清除与空格保留
Given 页面顶部正在展示旧项目名 'Project-Alpha'，输入框含有 'Project-Alpha'
When 开发者使用 Backspace 将文字全部删空（或录入三个半角空格 '   '）并停止输入满 300 毫秒
Then 顶部展示区旧项目名 'Project-Alpha' 立即被彻底清除并不再显示，展示区恢复为初始灰色占位提示 '【等待输入核对】'，输入框正下方呈现红色明确提示 '项目名不能为空，请输入有效字符'，输入框内输入的三个半角空格（或删空状态）完好保留，光标保持在输入框内。

Scenario 3: 正常一键即时清空、五类持久属性保留与瞬态重置（无确认弹窗）
Given 页面顶部正在展示 'Project-Beta-01'，输入框配置有完整 5 类持久属性与错误状态
When 用户点击底部橙色圆形清空按钮
Then 顶部展示区立即清除 'Project-Beta-01' 并恢复为占位提示 '【等待输入核对】'，输入框被替换为新节点，value 为空且瞬态 aria-invalid/error 类彻底移除，5 类持久属性完好保留，光标自动回焦新输入框，无任何确认弹窗。

Scenario 4: 应用初始化异常装配清理与幂等重试（M4 验证）
Given 页面正在执行 DOMContentLoaded 启动流转，但某核心 DOM 依赖暂时缺失或节点绑定抛错
When AppController.init 捕获异常
Then 系统安全解绑可能已挂载的清空按钮监听器，并对输入节点执行 unbindInputNode 解绑，保持 isInitialized 为 false，输入框内既有草稿文本完好保留（不清空），顶部横幅弹出可见错误提示；补齐依赖后再次调用 AppController.init，系统顺利完成装配并原子提交 isInitialized=true，清空按钮与输入框无重复注册监听。

Scenario 5: 清空快照捕获期异常保护与原状态无修改保持（M5 验证）
Given 输入框内存在重要草稿 'Preserved Draft'，代际为 G，存在排队中的 300ms 防抖任务
When 用户点击清空按钮，在执行 captureSnapshot() 瞬间注入异常
Then 系统安全捕获该异常，不调用 rollback，页面中 activeInputNode 仍为原节点且挂载原位，代际保持为 G，草稿 'Preserved Draft' 完好保留，在途防抖定时器未被取消并正常到期展示大字，页面顶部横幅呈现可见错误提示 '清空快照捕获遇到异常，已保留原始输入状态供微调重试'，输入框保持可编辑。

Scenario 6: 清空替换后后续步骤抛错回滚与 DOM 单输入框拓扑保真（R6-B1 验证）
Given 输入框内存在草稿 'Critical Test Draft'，展示区呈现 'Critical Test Draft'
When 点击清空按钮，新节点已通过 replaceWith 挂入 DOM 树，但后续 renderPlaceholder 或 clearInputError 抛出异常
Then catch 块执行 rollback，显式移除已挂入文档树的 replacement 节点并回插原节点，查验 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，DOM 中无残留 replacement 节点；activeInputNode 重新指向原节点，代际还原为原 G，原草稿 'Critical Test Draft' 完整保留并保持焦点。

Scenario 7: 空值与纯空格待校验任务清空遇回滚后无差别重新调度（R6-B2 验证）
Given 页面展示区正呈现旧项目名 'Old Title'
When 用户输入三个空格 '   '（或删空文本）并发起 input 调度，在 300ms 定时器未到期前点击清空按钮，且清空流程注入 replaceWith 失败触发回滚
Then rollback 捕获快照并检测到 hadPendingTimer 为 true，无条件针对原纯空格草稿 '   '（或删空草稿 ''）重新调度 300ms 防抖任务；满 300 毫秒后定时器正常唤醒并执行校验，展示区已显示的旧项目名 'Old Title' 立即被清除并恢复为灰色占位文字 '【等待输入核对】'，输入框正下方呈现红色非空警示 '项目名不能为空，请输入有效字符'，输入框内三个半角空格完好保留，旧展示不持久残留。

Scenario 8: 事务回滚成功后用户继续键入、手动删空与幂等清空重试
Given 经历清空失败回滚后，界面恢复原节点 oldNode，草稿为 'Draft Recovered'
When 开发者在输入框中继续键入 'Edited after failure' 并停止 300 毫秒
Then 顶部展示区正常通过 Node.textContent 安全更新为 'Edited after failure'；随后手动删空停止 300 毫秒，展示区旧文本清除并就地出现红色非空警示；再次点击清空按钮，清空事务成功提交，DOM 依然维持单一输入框。

Scenario 9: 事务成功提交后旧节点迟到 compositionend 与尾随 input 拦截隔离
Given 清空事务成功提交，新节点 newNode 代际为 2，原节点 oldNode 已脱离 DOM
When 向脱离的 oldNode 派发迟到的 compositionend 或尾随 input 事件
Then oldNode 闭包前置守卫核验失败（node !== activeInputNode 且 1 !== 2），事件被直接拦截丢弃，newNode 的 value 保持为空，350ms 后展示区无空值报错，新会话完全不受干扰。

Scenario 10: 严重回插失败内存持有、只读草稿容器全文呈现、手动复制兜底与容器挂载失败可见报错（M6 验证）
Given 清空流程在替换后发生异常，且回插原节点过程中再次发生严重 DOM 异常
When 进入严重失败兜底分支
Then 系统坚决禁止 window.location.reload() 刷新页面；ResetController.recoveryDraft 稳定在内存持有原始草稿；若只读容器挂载成功，在独立只读 textarea 容器中逐字符原样呈现原始 draft 文本（包括换行与空格），供用户手动选中复制取回文本，提示明确说明主编辑器暂时受限，草稿已安全就地保留；若只读容器挂载亦发生异常，系统坚决不谎称草稿已呈现或已复制，亦不以纯控制台输出替代交互，直接通过顶部横幅呈现用户可见错误通知：'清空严重异常且草稿容器挂载失败，主编辑器受限，请勿刷新页面，当前草稿已保存在快照中'；若通知挂载亦失败则诚实标为内存保留、显示不可用，绝不递归触发 window.onerror。

Task=null


## blk-deliv-val-standalone-runtime / validation / 交付验证：本地直接双击与静态服务运行模式、原生 IME、清空事务原子拓扑回滚与只读草稿复制兜底实测

Stage=delivery; requirements=["blk-deliv-task-package","blk-tech-deployment"]; dependencies=["blk-deliv-task-package","blk-deliv-task-reset-workflow","blk-deliv-task-error-handling"]

在真实宿主环境验证本地单页面直接双击（file:// 协议）与静态 HTTP 服务模式的可用性，在 Chrome, Edge, Firefox, Safari 主流桌面浏览器实测原生 IME 输入法事件流转、AppController.init 装配与就绪提交点、清空事务两阶段提交与替换后各类抛错时的原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）及严重回滚失败只读草稿复制兜底与可见报错通路。

Task={
  "assumptions": [
    "开发者已按照 TECHNICAL_GUIDE 部署本地运行环境并安装 Node.js/Python",
    "浏览器安全策略允许本地双击打开脚本或通过 localhost 静态服务加载本地资源"
  ],
  "completionCriteria": [
    "完成 file:// 协议与 localhost:8080 两种启动模式的主流现代桌面浏览器兼容性实测（包括资源加载与脚本执行）",
    "完成 Chrome, Edge, Firefox, Safari 下原生中文输入法输入、合成与 300ms 防抖更新实测",
    "实测清空按钮点击后新旧节点物理替换与脱离节点迟到事件隔离",
    "实测清空快照捕获期抛错安全分支，验证直接可见报错且原输入不动，未调用 rollback",
    "实测清空事务在准备期、replaceWith 过程及替换后抛错的三阶段原子拓扑回滚，断言单一合法输入框且 ID 唯一（0 replacement 残留），代际不增，草稿与焦点完整保留",
    "实测空值与纯空格排队任务遇回滚后无差别重新调度，300ms 后展示区旧文本彻底清除恢复占位符且出红色提示，空格原文保留",
    "实测严重回插失败在只读 textarea 逐字符全文呈现草稿供手动复制，挂载失败直接全局横幅报错，禁止刷新，通知失败不引发二次异常",
    "实测 AppController.init 核心装配异常时安全解绑监听，保持 isInitialized=false，草稿保留且支持重试"
  ],
  "environment": "桌面 PC 宿主机（Windows 10/11, macOS 12+, Linux），主流现代桌面浏览器稳定版（Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15），真实原生操作系统中文拼音输入法引擎；规划期环境因宿主工具 Docker 不可用且目标产物未实现，实测如实标为 unexecuted，留待 Delivery 实施阶段执行",
  "evidenceRequired": [
    "各浏览器控制台执行输出日志、DOM 树节点数量与 ID 唯一性断言记录（document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留）、空值/纯空格任务 300ms 调度与提示呈现日志、原生 IME 输入法在合成态下触发清空后的迟到事件派发与拦截流转日志、AppController.init 异常清理与重试日志、以及只读草稿文本复制与挂载失败可见报错记录"
  ],
  "exclusions": "不安排自动化测试工具强行模拟真实浏览器未经验证的底层跨进程行为，不引入外部第三方重型测试框架，不伪造真机测试通过日志，不把合成测试当真实环境实测",
  "failureBehavior": "若在多浏览器实测中发现某浏览器在 replaceWith 抛错时未清理 replacement 节点、空值待任务未重新调度、初始化异常后残留重复监听、或原生 IME 将迟到事件重定向至新节点，立即报告失败，排查并优化 ResetController/AppController 状态机与事件监听策略后复测",
  "goal": "验证本地单页面直接双击（file://）与静态 HTTP 服务运行模式可用性，在 Chrome, Edge, Firefox, Safari 实测原生 IME 合成态事件流转、AppController.init 装配与就绪提交点、清空事务两阶段提交与替换后各类抛错时的原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）及严重回滚失败只读草稿复制兜底与可见报错通路",
  "modules": [
    "ResetController",
    "InputController",
    "DebounceScheduler",
    "DisplayRenderer",
    "FeedbackBanner",
    "AppController"
  ],
  "normalBehavior": "在双启动模式下页面正常加载，输入项目名 300ms 后大字正常展示，中文拼音合成态不触发防抖，选词完成后 300ms 更新大字；清空点击即时重置展示与输入框，无确认弹窗；各阶段异常抛错能正确触发可见报错、原子拓扑回滚恢复单输入框或严重失败只读草稿复制兜底，AppController.init 异常安全解绑并不提前就绪，各主流桌面浏览器行为表现完全一致",
  "onFailure": "阻断交付验证，排查启动配置、状态机逻辑、DOM 回滚、重调度或只读草稿兜底逻辑后回归验证",
  "passCriteria": [
    "双启动模式（file:// 与 http://localhost:8080）下，HTML/CSS/JS 资源均能正常加载渲染，无任何跨域或资源加载错误",
    "在 Chrome, Edge, Firefox, Safari 中，原生中文拼音输入过程不触发防抖，上屏后停止 300ms 均能正常更新展示区大字",
    "点击清空按钮后，DOM 输入框被物理替换，脱离文档树的旧节点迟到事件被有效拦截，不污染新节点",
    "快照捕获期抛错直接可见报错，原输入与排队任务不动，未调用 rollback",
    "替换中及替换后抛错均能原子回滚，页面始终维持单一合法输入框，0 replacement 残留，代际未增，草稿与焦点完整保留",
    "空值与纯空格排队任务遇回滚后无差别重新调度，300ms 后旧展示彻底清除恢复占位符且出红色提示，空格原文保留",
    "严重回插失败在只读 textarea 逐字符呈现草稿供手动复制，挂载失败直接全局横幅报错，禁止刷新，通知失败不引发二次异常",
    "AppController.init 装配异常时安全解绑监听，不提前就绪，草稿保留且支持重试"
  ],
  "scope": "双启动模式（file:// 与本地静态 HTTP 服务）加载验证、四款主流现代桌面浏览器兼容性测试、真实原生 IME 拼音输入法事件流转实测、AppController.init 装配与重试验证、清空物理替换与事件隔离验证、清空事务三阶段异常注入与原子拓扑回滚实测（单 DOM 保真、草稿无差别重调度）、以及严重回插失败只读 textarea 复制呈现与挂载失败可见报错实测",
  "steps": [
    "构建部署包并分别通过本地文件直接双击（file:///.../index.html）以及本地静态 HTTP 服务（npx serve . -l 8080 或 python -m http.server 8080，访问 http://localhost:8080）两种模式打开页面，核对控制台与网络请求",
    "在 Chrome, Edge, Firefox, Safari 桌面浏览器中分别使用原生中文输入法录入拼音并选词上屏，核对 300ms 防抖大字呈现行为",
    "输入项目名展示后点击清空按钮，核对输入节点被物理替换，旧输入框脱离 DOM 树",
    "通过测试脚本向已脱离 DOM 的旧输入框派发迟到的 compositionend 与 input 事件，断言新输入框不受任何影响",
    "在 captureSnapshot 注入异常，断言直接可见报错且原输入未变，未调用 rollback",
    "在准备期注入异常，断言回滚后 activeInputNode 仍为原节点且代际未增",
    "在 replaceWith 成功后注入 renderPlaceholder 异常，断言回滚显式移除 newNode 并回插 oldNode，核验 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留，代际还原为原 G",
    "在输入三个空格产生防抖任务后清空并注入 replaceWith 失败，断言回滚后重新调度 300ms 任务，满 300ms 后展示区旧文本被清除并恢复占位符，输入框下方出现红色非空提示，空格完好保留",
    "注入严重回插失败，断言页面未发生刷新，草稿在 ResetController.recoveryDraft 内存保留，界面在只读 textarea 容器中原样呈现原始 draft 供复制；若容器挂载失败断言弹出明确可见全局错误横幅，且通知失败不抛错",
    "在 AppController.init 装配期注入异常，断言解绑监听且 isInitialized=false，输入框草稿完好，弹出可见全局错误，重试后正常进入就绪态"
  ],
  "verification": [
    "验证双击直接运行（file://）",
    "验证静态 HTTP 服务托管（端口 8080）",
    "验证原生 IME 拼音输入法合成态流转",
    "验证清空物理替换与事件隔离",
    "验证清空事务三阶段异常注入与原子拓扑回滚断言（单 DOM 节点、代际还原）",
    "验证空值与纯空格待任务无差别重调度断言",
    "验证严重回滚失败内存持有草稿、只读草稿全文呈现与手动复制，挂载失败可见报错",
    "验证 AppController.init 装配异常清理与重试"
  ]
}


## blk-tech-module / module / 前端系统架构与核心功能模块划分（输入节点闭包绑定、解绑契约与快照调度器）

Stage=technical; requirements=["blk-feat-input-display","blk-feat-reset"]; dependencies=["blk-tech-stack"]

系统划分为高内聚、低耦合的纯前端原生模块，完全在客户端内存运行时运行，严格与正式状态事务顺序和全量公共 API 契约保持一致：
1. DisplayRenderer（展示渲染模块）：
   - 职责：专门管理顶部项目名大字展示区；
   - API 契约：
     * renderProjectName(element: HTMLElement, text: string): void
       - 入参：展示区容器 DOM 元素 element，待展示项目名文本 text；
       - 返回类型：void；
       - 正常后置条件：严格使用 Node.textContent 将 text 安全赋值到展示区文本节点，以高对比黑色大字呈现，彻底杜绝 HTML 解析与脚本执行；
       - 失败后置条件：若 element 为空或非有效 DOM 节点，抛出 TypeError 并由上层调用方捕获，绝不静默忽略；
       - 调用方职责：由防抖调度完成后的回调函数调用。
     * renderPlaceholder(element: HTMLElement, placeholderText: string = '【等待输入核对】'): void
       - 入参：展示区容器 DOM 元素 element，占位提示文本 placeholderText（默认“【等待输入核对】”）；
       - 返回类型：void；
       - 正常后置条件：使用 Node.textContent 将 element 复位为灰色占位提示文本，清除一切旧项目名大字；
       - 失败后置条件：若 element 无效抛出 TypeError；
       - 调用方职责：由应用初始化流程、空值/纯空格校验失败拦截处理、或清空事务 handleReset 调用。
2. InputController（输入管理、节点监听解绑与代际闭包绑定模块，M4 规范）：
   - 职责：维护当前处于 DOM 树中的唯一活跃输入框节点 activeInputNode，为输入框节点绑定捕获专属代际的私有监听闭包，并提供明确的节点监听解绑契约；
   - API 契约：
     * bindInputNode(node: HTMLInputElement, generation: number): void
       - 入参：目标输入框 DOM 元素 node，该节点所属的单调递增代际编号 generation；
       - 返回类型：void；
       - 正常后置条件：若 node 此前已注册监听，先安全调用 unbindInputNode(node) 避免重复绑定；为 node 绑定 input、compositionstart、compositionend 等事件监听，记录实际注册的监听函数句柄；在闭包内私有捕获 node 引用、bornGeneration = generation、isComposing = false 与 trustedDraft = node.value；闭包前置四重守卫核验（event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)），仅核验通过的合法活跃事件才允许更新 trustedDraft 并触发防抖调度；
       - 失败后置条件：若 node 为空或 generation 非正整数，若绑定中途抛错则撤销本次已注册监听，抛出 TypeError 并中止绑定；
       - 调用方职责：由 AppController.init 针对首个初始输入节点调用，或由 ResetController.handleReset 针对内存预制的新输入框 newNode 调用。
     * unbindInputNode(node: HTMLInputElement): void
       - 入参：目标输入框 DOM 元素 node；
       - 返回类型：void；
       - 正常后置条件：安全解绑 node 上此前由 bindInputNode 注册的 input 与 composition 等全部事件监听器句柄，清理内部监听句柄记录；若 node 未注册过监听则安全幂等返回；
       - 失败后置条件：若 node 无效则安全忽略不抛错；
       - 调用方职责：由 bindInputNode 在同节点重复绑定前调用，或由 AppController.init 在初始化异常清理与重试时调用。
     * focusInput(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：若 activeInputNode 存在且挂载于 DOM 树，调用 activeInputNode.focus() 确保光标准确移入活跃输入框；
       - 失败后置条件：若 activeInputNode 不存在或已脱离文档树，安全忽略并不抛出未捕获异常；
       - 调用方职责：由清空成功提交后、或回滚恢复原节点后调用。
3. DebounceScheduler（纪元防抖调度模块）：
   - 职责：管理 300ms 计时器生命周期，采用单调递增的 schedulerEpoch 纪元快照机制与原始草稿快照防护；
   - API 契约：
     * schedule(draftSnapshot: string, targetNode: HTMLInputElement, targetGeneration: number, callback: Function, delayMs: number = 300): void
       - 入参：草稿快照字符串 draftSnapshot（原样捕获包括空格），目标节点 targetNode，目标节点代际 targetGeneration，防抖回调函数 callback，防抖延迟毫秒 delayMs（默认 300ms）；
       - 返回类型：void；
       - 正常后置条件：自增或记录当前 schedulerEpoch 纪元快照，通过 window.setTimeout 启动 300ms 定时器；定时器到期唤醒时核验 taskEpoch === schedulerEpoch && targetGeneration === inputGeneration && targetNode === activeInputNode，守卫全部满足后将 draftSnapshot 传入 callback 执行；
       - 失败后置条件：若目标失配或纪元过期，回调被直接丢弃，不执行任何视图更新；
       - 调用方职责：由输入框 input 事件监听闭包、或清空回滚时的原始草稿无差别重调度流程调用。
     * cancel(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：清除当前活跃定时器（clearTimeout），并将 schedulerEpoch 单调自增（schedulerEpoch++），使事件队列中所有在途的旧定时器宏任务即使唤醒也因纪元失配而安全失效；
       - 失败后置条件：无；即使无活跃定时器调用亦安全幂等；
       - 调用方职责：由清空状态事务 handleReset 在准备物理替换前调用，或回滚流程作废旧任务时调用。
     * hasPending(): boolean
       - 入参：无；
       - 返回类型：boolean；
       - 正常后置条件：返回当前客户端内存中是否存在排队等待执行的有效防抖计时器（pendingTimerId !== null 且纪元有效）；
       - 失败后置条件：无；
       - 调用方职责：由 ResetController.captureSnapshot 用于检测清空发起瞬间是否存在在途防抖任务。
4. ResetController（清空状态事务控制器模块）：
   - 职责：协调清空重置全流程，实现强两阶段状态事务（Two-Phase Commit）、五类持久属性保真复制、内存恢复草稿所有权（recoveryDraft）与失败原子拓扑回滚；
   - API 契约：
     * handleReset(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：严格执行两阶段状态事务：
         1. 统一 try 保护开启，首先执行快照阶段：调用 captureSnapshot() 捕获包含 activeInputNode、inputGeneration、schedulerEpoch、hadPendingTimer、draft、展示与错误内容及 DOM 位置的不可变快照；
         2. 若 captureSnapshot 抛错（快照失败分支，M5）：catch 拦截后直接调用 FeedbackBanner.showGlobalError 报错并中止，原节点、代际、草稿与排队任务未受任何影响，直接 return，绝不调用 rollback；
         3. 准备阶段：快照捕获成功后，计算 nextGeneration = snapshot.inputGeneration + 1；在内存创建全新 input 节点 newNode；安全复制 5 类持久属性（label 关联 id/name、全部 ARIA 属性、tabindex、class/style、data-*），显式过滤 value 与瞬态 aria-invalid；为 newNode 调用 InputController.bindInputNode(newNode, nextGeneration)；
         4. 替换与复位阶段：调用 DebounceScheduler.cancel() 取消防抖；执行 oldNode.replaceWith(newNode) 物理节点替换并记录 mountedReplacementNode = newNode；调用 DisplayRenderer.renderPlaceholder 复位展示区为占位符；调用 FeedbackBanner.clearInputError 清除错误；调用 newNode.focus() 获取焦点；
         5. 原子提交点（Commit Point）：上述步骤全部成功后，正式原子提交：更新 activeInputNode = newNode，inputGeneration = nextGeneration；至此清空事务圆满完成，旧节点迟到事件被入口守卫拦截丢弃；
       - 失败后置条件：若准备、替换过程、呈现复位、错误清理或焦点恢复任意阶段抛出异常，catch 块立即捕获并调用 rollback(snapshot, error, mountedReplacementNode)，确保代际不提前递增（保持原 generation G），原节点与 DOM 单输入框拓扑保真；
       - 调用方职责：由 resetButton 的 click 事件监听器调用。
     * captureSnapshot(): ResetTransactionSnapshot
       - 入参：无；
       - 返回类型：ResetTransactionSnapshot；
       - 正常后置条件：捕获并返回包含当前 activeInputNode、inputGeneration、schedulerEpoch、hadPendingTimer（通过 hasPending() 判定）、draft（activeInputNode.value 原文）、displayContent、errorContent、isErrorVisible、hadErrorClass、hadAriaInvalid、parentNode 及 nextSibling 位置引用的不可变数据快照；
       - 失败后置条件：若 activeInputNode 不存在抛出 Error 并由 handleReset 安全拦截处理；
       - 调用方职责：由 handleReset 第一优先级调用。
     * rollback(snapshot: ResetTransactionSnapshot, error: Error, replacementNode?: HTMLInputElement): void
       - 入参：非空恢复快照 snapshot，捕获的异常对象 error，可能已挂载的新节点 replacementNode；
       - 返回类型：void；
       - 正常后置条件：执行原子拓扑回滚：
         1. 显式识别 replacementNode：若 replacementNode 存在且已挂入 DOM（replacementNode.parentNode），执行 replacementNode.parentNode.replaceChild(snapshot.activeInputNode, replacementNode) 并彻底移除 replacementNode，或者 replacementNode.remove() 并在原 parentNode/nextSibling 插回 snapshot.activeInputNode，严格断言 DOM 树中单一合法输入框（querySelectorAll('input').length === 1，0 重复 ID）；
         2. 状态与代际还原：activeInputNode 重新指向 snapshot.activeInputNode，全局 inputGeneration 严格保持为 snapshot.inputGeneration（绝不提前递增），调度纪元单调自增（schedulerEpoch++）彻底废弃旧任务；
         3. 草稿与错误还原：还原 oldNode.value = snapshot.draft；若此前有错误则恢复 error 类与 aria-invalid，恢复 displayContent 与错误容器显隐；
         4. 原始草稿无差别重调度：若 snapshot.hadPendingTimer 为 true，无条件针对 snapshot.draft 重新调度 300ms 防抖任务（无论非空、空字符串 '' 还是纯空格 '   '，严禁用 trim 过滤跳过）；
         5. 回焦与友好横幅：调用 snapshot.activeInputNode.focus()，调用 FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态')；原闭包 bornGeneration 与 inputGeneration 自洽，用户可继续输入、手动删空或重试清空；
       - 失败后置条件（严重回插失败，M6 规范）：若回插原节点过程中再次发生严重 DOM 异常，严禁刷新页面（禁止 window.location.reload()），将快照草稿存入 ResetController 持久内存恢复状态 this.recoveryDraft = snapshot.draft；调用 FeedbackBanner.showSevereFallbackDraft(this.recoveryDraft, severeFallbackContainer)；若挂载成功，在只读 textarea 容器中逐字符呈现原始草稿供用户手动复制；若挂载失败，绝不声称草稿已呈现或已复制，调用 FeedbackBanner.showGlobalError('清空严重异常且草稿容器挂载失败，主编辑器受限，请勿刷新页面，当前草稿已保存在内存快照中')，不以 console 输出代替交互；若全局通知亦失败则诚实标为内存保留、显示不可用，绝不递归触发 window.onerror；
       - 调用方职责：由 handleReset 在 snapshot 捕获成功后的异常 catch 块调用。
     * retryRenderFallbackDraft(): boolean
       - 入参：无；
       - 返回类型：boolean；
       - 正常后置条件：若 recoveryDraft 非空，再次尝试将其渲染到当前可用的兜底容器中；成功返回 true，失败返回 false；若当前没有可用通路，绝不声称具备可点按钮；
       - 失败后置条件：安全捕获异常并返回 false；
       - 调用方职责：供宿主环境在修复 DOM 容器后手动或程序化重试呈现已保留的内存草稿。
5. ValidatorModule（非空与字符校验模块）：
   - 职责：针对传入的草稿快照进行纯函数非空校验；
   - API 契约：
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }
       - 入参：草稿快照字符串 draft；
       - 返回类型：{ isValid: boolean, errorMessage: string | null }；
       - 正常后置条件：若 draft.trim().length === 0（涵盖 null、空字符串 '' 与纯空格字符串），返回 { isValid: false, errorMessage: '项目名不能为空，请输入有效字符' }；若去除首尾空白后包含有效非空字符，返回 { isValid: true, errorMessage: null }；
       - 失败后置条件：若 draft 类型非 string，进行防御性转换或判定为非法，绝不抛出阻断性未捕获异常；
       - 调用方职责：由防抖计时器到期后的 handleDebouncedValidateAndDisplay 流程调用。
6. FeedbackBanner（错误警示与异常横幅模块，M6 规范）：
   - 职责：集中管理输入框就地校验错误挂载、全局运行异常通知横幅、以及严重失败只读草稿复制兜底容器呈现；
   - API 契约：
     * showInputError(inputNode: HTMLInputElement, container: HTMLElement, message: string): void
       - 入参：目标输入框 inputNode，错误提示容器 container，错误提示文案 message；
       - 返回类型：void；
       - 正常后置条件：使用 Node.textContent 将 message 安全写入 container 并设置其 display 展现；为 inputNode 添加 'error' 类名并设置 aria-invalid="true"；
       - 失败后置条件：若 DOM 容器不存在，抛出 TypeError 或在控制台记录可见错误；
       - 调用方职责：由空值/纯空格校验失败拦截分支调用。
     * clearInputError(inputNode: HTMLInputElement, container: HTMLElement): void
       - 入参：目标输入框 inputNode，错误提示容器 container；
       - 返回类型：void；
       - 正常后置条件：将 container 的 textContent 清空并设置 display 为 none 隐藏；移除 inputNode 上的 'error' 类名与 aria-invalid 属性；
       - 失败后置条件：无；
       - 调用方职责：由输入校验通过分支、清空成功提交流程、或初始化流程调用。
     * showGlobalError(message: string): boolean
       - 入参：全局警示消息 message；
       - 返回类型：boolean（指示错误是否成功在用户可见 DOM 中挂载呈现）；
       - 正常后置条件：在页面顶部 error-banner-container 挂载轻量通知横幅，安全呈现纯文本警示，不刷新页面，返回 true；若容器缺失则在 body 顶部动态创建挂载节点呈现；
       - 失败后置条件：若动态创建或挂载抛错，方法内部捕获异常并返回 false，绝不再次抛出未捕获异常，绝不递归触发 window.onerror；控制台仅记录诊断日志；
       - 调用方职责：由清空快照失败、清空异常回滚处理、初始化失败、严重挂载失败兜底或 window.onerror 全局异常拦截调用。
     * showSevereFallbackDraft(draftText: string, container: HTMLElement): boolean
       - 入参：原始草稿文本 draftText，兜底宿主容器 container（通常为顶部 error-banner-container）；
       - 返回类型：boolean（指示只读 textarea 是否已成功在 DOM 树中完成挂载并呈现草稿）；
       - 正常后置条件：若 container 有效且挂载成功，在 container 内安全挂载一个独立只读多行文本域（readonly textarea），将 draftText 原样逐字符赋值给 textarea.value（完整保留换行与所有前后/重复空格），设置 textarea.readOnly = true 与 tabindex="0"，提示文案明确说明“清空与回滚操作遇到严重异常，主编辑器暂时受限，已为您在下方安全保留草稿，请手动选中复制取回”，杜绝 window.location.reload() 刷新，保障输入数据 0 丢失，返回 true；
       - 失败后置条件：若 container 无效或 DOM 挂载抛错，方法捕获异常并返回 false；调用方依据 false 状态触发 FeedbackBanner.showGlobalError 呈现可见错误通知，绝不声称草稿已在界面呈现，绝不以纯 console 输出代替交互；
       - 调用方职责：由 ResetController.rollback 的严重失败 catch 块调用。
7. AppController（全局装配与启动协调模块，M4 规范）：
   - 职责：页面主控制器，负责在 DOMContentLoaded 时获取实际 DOM 引用，完成各模块依赖注入与事件初始化装配；
   - API 契约：
     * init(elements: { displayElement: HTMLElement, initialInputNode: HTMLInputElement, errorContainer: HTMLElement, resetButton: HTMLElement, severeFallbackContainer?: HTMLElement }): void
       - 入参：包含页面核心交互元素的对象 elements（displayElement 大字展示区，initialInputNode 初始输入框，errorContainer 就地错误容器，resetButton 清空按钮，以及可选的 severeFallbackContainer 独立只读草稿兜底容器）；
       - 返回类型：void；
       - 前置条件：页面 DOMContentLoaded 触发，四个核心 DOM 元素（displayElement, initialInputNode, errorContainer, resetButton）已就绪并成功由 querySelector/getElementById 获取到真实非空节点引用；
       - 正常后置条件（阶段划分与原子提交点）：
         1. 依赖完整性校验：核查 elements 及其 4 项必要依赖引用非空，若缺失立即抛出 ReferenceError；
         2. 状态幂等检查与历史清理：若已就绪（isInitialized===true）则安全幂等返回；若此前初始化曾中断，先解绑既有 resetButton 上的监听器句柄，并调用 InputController.unbindInputNode(elements.initialInputNode) 清理解除残余节点监听，确保重试时不发生重复监听；
         3. 节点闭包绑定与事件注册：调用 InputController.bindInputNode(elements.initialInputNode, 1) 为初始输入框绑定捕获代际 1 的事件闭包；为 elements.resetButton 绑定单一 resetHandler 监听器并保存句柄引用；记录实际绑定的节点与按钮实例；
         4. 视觉、提示与安全焦点转移：调用 DisplayRenderer.renderPlaceholder(elements.displayElement, '【等待输入核对】') 初始化展示区；调用 FeedbackBanner.clearInputError(elements.initialInputNode, elements.errorContainer) 隐藏错误；直接执行 elements.initialInputNode.focus() 将光标聚焦到初始输入框并核对成功；记录 severeFallbackContainer 引用或预留挂载锚点；
         5. 原子就绪提交点（Commit Point）：上述装配全部成功执行后，正式设置 activeInputNode = elements.initialInputNode，inputGeneration = 1，schedulerEpoch = 0，提交 isInitialized = true，进入完整就绪待命态；
       - 失败后置条件（M4 错误保护与重试机制）：若依赖缺失或装配阶段任意环节抛出异常，catch 块执行全面安全清理：解除实际已注册的 resetButton 监听句柄，调用 InputController.unbindInputNode 解除输入节点监听，保持 isInitialized = false（绝不提前置为 true 导致状态锁死），输入框内既有草稿文本完好保留（不执行清空），通过 FeedbackBanner.showGlobalError 呈现可见错误提示；允许环境修复后再次调用 init() 进行安全幂等重试；
       - 调用方职责：由 index.html 引入的经典 defer 主脚本在 DOMContentLoaded 时显式调用。

Task=null


## blk-tech-interface / interface / 组件事件契约与模块调用接口规范（节点代际守卫、清空状态事务与非执行参考示意）

Stage=technical; requirements=["blk-feat-input-display","blk-feat-reset"]; dependencies=["blk-tech-module"]

组件事件契约、公共模块调用接口与两阶段状态转换规范。明确本块内部 JavaScript 均为“非执行示意，非CodingAgent直接复制的参考实现”；规划规范的权威定义是接口方法签名、状态所有权、前置守卫与成功提交/失败回滚的后置条件：
1. 模块接口签名与契约清单（完整保持全部公共 API，逐项规范入参、返回类型、后置条件与调用方职责）：
   - InputController:
     * bindInputNode(node: HTMLInputElement, generation: number): void
       - 入参：node: HTMLInputElement（目标输入框元素），generation: number（该节点所属代际）；
       - 返回类型：void；
       - 正常后置条件：若 node 已有监听先解绑，为 node 绑定 input 与 composition 事件并记录句柄，闭包内私有捕获 node 引用、bornGeneration = generation 与 trustedDraft；执行四重守卫核验；
       - 失败后置条件：若 node 为空或 generation 非正整数，若中途失败撤销已绑监听，抛出 TypeError；
       - 调用方职责：由 AppController.init 针对首节点调用，或由 ResetController.handleReset 针对预制 newNode 调用。
     * unbindInputNode(node: HTMLInputElement): void
       - 入参：node: HTMLInputElement（目标输入框）；
       - 返回类型：void；
       - 正常后置条件：解绑 node 上此前注册的全部 input/composition 监听器句柄并清理记录，安全幂等；
       - 失败后置条件：安全忽略；
       - 调用方职责：由 bindInputNode 重复绑定前、或 AppController.init 异常清理调用。
     * focusInput(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：若 activeInputNode 存在且挂载于 DOM 树，调用 activeInputNode.focus() 回焦输入框；
       - 失败后置条件：若 activeInputNode 脱离文档树或不存在，安全忽略不抛错；
       - 调用方职责：由初始化、清空成功提交或回滚恢复原节点后调用。
   - DebounceScheduler:
     * schedule(draftSnapshot: string, targetNode: HTMLInputElement, targetGeneration: number, callback: Function, delayMs: number = 300): void
     * cancel(): void
     * hasPending(): boolean
   - ResetController:
     * handleReset(): void
     * captureSnapshot(): ResetTransactionSnapshot
     * rollback(snapshot: ResetTransactionSnapshot, error: Error, replacementNode?: HTMLInputElement): void
     * retryRenderFallbackDraft(): boolean
   - DisplayRenderer:
     * renderProjectName(element: HTMLElement, text: string): void
     * renderPlaceholder(element: HTMLElement, placeholderText: string = '【等待输入核对】'): void
   - FeedbackBanner:
     * showInputError(inputNode: HTMLInputElement, container: HTMLElement, message: string): void
     * clearInputError(inputNode: HTMLInputElement, container: HTMLElement): void
     * showGlobalError(message: string): boolean
     * showSevereFallbackDraft(draftText: string, container: HTMLElement): boolean
   - ValidatorModule:
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }
   - AppController:
     * init(elements: { displayElement: HTMLElement, initialInputNode: HTMLInputElement, errorContainer: HTMLElement, resetButton: HTMLElement, severeFallbackContainer?: HTMLElement }): void

2. 清空状态事务状态转换与后置条件（非执行示意，供设计推导参考）：
   [Ready: oldNode in DOM, generation=G, epoch=E, isInitialized=true]
         |
         v (click reset -> try captureSnapshot: oldNode, G, E, hadTimer, draft, DOM position)
         +---> (if throw in captureSnapshot) ---> [Snapshot Fail: oldNode unchanged, G unchanged, draft/timer intact, visible error, NO rollback called]
         |
   [Snapshot Captured: draft, timerState, parentNode, nextSibling]
         |
         v (create newNode, copy 5 persistent attrs, bind newNode with nextGeneration=G+1)
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

3. 伪代码参考示意（非执行示意，说明 M4, M5, M6 架构契约与回滚机制）：
```javascript
// 非执行示意，非CodingAgent直接复制的参考实现；正式规范权威为接口方法签名、状态所有权与验收用例
let isInitialized = false;
let registeredResetButton = null;
let registeredResetHandler = null;
let registeredInputNode = null;
let activeInputNode = null;
let inputGeneration = 1;
let schedulerEpoch = 0;
let pendingTimerId = null;
let currentSevereFallbackContainer = null;

const InputController = {
  bindInputNode(node, generation) {
    if (!node || typeof generation !== 'number' || generation <= 0) throw new TypeError('Invalid inputNode or generation');
    this.unbindInputNode(node);
    registeredInputNode = node;
    let isComposing = false;
    let trustedDraft = node.value;
    const inputHandler = (e) => {
      if (e.currentTarget !== node || node !== activeInputNode || generation !== inputGeneration || !document.body.contains(node)) return;
      if (isComposing) return;
      trustedDraft = node.value;
      DebounceScheduler.schedule(trustedDraft, node, generation, (draft) => {
        handleDebouncedValidateAndDisplay(draft);
      }, 300);
    };
    const compStartHandler = (e) => {
      if (e.currentTarget !== node || node !== activeInputNode || generation !== inputGeneration || !document.body.contains(node)) return;
      isComposing = true;
      DebounceScheduler.cancel();
    };
    const compEndHandler = (e) => {
      if (e.currentTarget !== node || node !== activeInputNode || generation !== inputGeneration || !document.body.contains(node)) return;
      isComposing = false;
      trustedDraft = node.value;
      DebounceScheduler.schedule(trustedDraft, node, generation, (draft) => {
        handleDebouncedValidateAndDisplay(draft);
      }, 300);
    };
    node.addEventListener('input', inputHandler);
    node.addEventListener('compositionstart', compStartHandler);
    node.addEventListener('compositionend', compEndHandler);
    node._handlers = { inputHandler, compStartHandler, compEndHandler };
  },
  unbindInputNode(node) {
    if (!node || !node._handlers) return;
    node.removeEventListener('input', node._handlers.inputHandler);
    node.removeEventListener('compositionstart', node._handlers.compStartHandler);
    node.removeEventListener('compositionend', node._handlers.compEndHandler);
    delete node._handlers;
    if (registeredInputNode === node) registeredInputNode = null;
  },
  focusInput() {
    if (activeInputNode && document.body.contains(activeInputNode)) activeInputNode.focus();
  }
};

const DebounceScheduler = {
  schedule(draftSnapshot, targetNode, targetGeneration, callback, delayMs = 300) {
    this.cancel();
    const taskEpoch = ++schedulerEpoch;
    pendingTimerId = window.setTimeout(() => {
      pendingTimerId = null;
      if (taskEpoch === schedulerEpoch && targetGeneration === inputGeneration && targetNode === activeInputNode && document.body.contains(targetNode)) {
        callback(draftSnapshot);
      }
    }, delayMs);
  },
  cancel() {
    if (pendingTimerId !== null) {
      window.clearTimeout(pendingTimerId);
      pendingTimerId = null;
    }
    schedulerEpoch++;
  },
  hasPending() {
    return pendingTimerId !== null;
  }
};

const ResetController = {
  recoveryDraft: null,
  handleReset() {
    let snapshot;
    try {
      snapshot = this.captureSnapshot();
    } catch (snapshotError) {
      FeedbackBanner.showGlobalError('清空快照捕获遇到异常，已保留原始输入状态供微调重试');
      return;
    }
    let mountedReplacementNode = null;
    try {
      const nextGeneration = snapshot.inputGeneration + 1;
      const newNode = document.createElement('input');
      copyFivePersistentAttributeCategories(snapshot.activeInputNode, newNode);
      newNode.value = '';
      InputController.bindInputNode(newNode, nextGeneration);
      DebounceScheduler.cancel();
      snapshot.activeInputNode.replaceWith(newNode);
      mountedReplacementNode = newNode;
      DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】');
      FeedbackBanner.clearInputError(newNode, errorContainer);
      newNode.focus();
      activeInputNode = newNode;
      inputGeneration = nextGeneration;
      this.recoveryDraft = null;
    } catch (err) {
      this.rollback(snapshot, err, mountedReplacementNode);
    }
  },
  captureSnapshot() {
    if (!activeInputNode) throw new Error('Active input node not found');
    return {
      activeInputNode,
      inputGeneration,
      schedulerEpoch,
      hadPendingTimer: DebounceScheduler.hasPending(),
      draft: activeInputNode.value,
      displayContent: displayElement ? displayElement.textContent : '',
      errorContent: errorContainer ? errorContainer.textContent : '',
      isErrorVisible: errorContainer ? errorContainer.style.display !== 'none' : false,
      hadErrorClass: activeInputNode.classList.contains('error'),
      hadAriaInvalid: activeInputNode.getAttribute('aria-invalid') === 'true',
      parentNode: activeInputNode.parentNode,
      nextSibling: activeInputNode.nextSibling
    };
  },
  rollback(snapshot, error, replacementNode) {
    try {
      if (replacementNode && replacementNode.parentNode) {
        replacementNode.parentNode.replaceChild(snapshot.activeInputNode, replacementNode);
      } else if (!document.body.contains(snapshot.activeInputNode) && snapshot.parentNode) {
        snapshot.parentNode.insertBefore(snapshot.activeInputNode, snapshot.nextSibling);
      }
      activeInputNode = snapshot.activeInputNode;
      inputGeneration = snapshot.inputGeneration;
      DebounceScheduler.cancel();
      snapshot.activeInputNode.value = snapshot.draft;
      if (displayElement) displayElement.textContent = snapshot.displayContent;
      if (errorContainer) {
        errorContainer.textContent = snapshot.errorContent;
        errorContainer.style.display = snapshot.isErrorVisible ? 'block' : 'none';
      }
      if (snapshot.hadErrorClass) snapshot.activeInputNode.classList.add('error');
      else snapshot.activeInputNode.classList.remove('error');
      if (snapshot.hadAriaInvalid) snapshot.activeInputNode.setAttribute('aria-invalid', 'true');
      else snapshot.activeInputNode.removeAttribute('aria-invalid');
      if (snapshot.hadPendingTimer) {
        DebounceScheduler.schedule(snapshot.draft, snapshot.activeInputNode, snapshot.inputGeneration, (draft) => {
          handleDebouncedValidateAndDisplay(draft);
        }, 300);
      }
      snapshot.activeInputNode.focus();
      FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态');
    } catch (rollbackFatalError) {
      this.recoveryDraft = snapshot.draft;
      const success = FeedbackBanner.showSevereFallbackDraft(this.recoveryDraft, currentSevereFallbackContainer);
      if (!success) {
        FeedbackBanner.showGlobalError('清空严重异常且草稿容器挂载失败，主编辑器受限，请勿刷新页面，当前草稿已保存在内存快照中');
      }
    }
  },
  retryRenderFallbackDraft() {
    if (!this.recoveryDraft) return false;
    try {
      return FeedbackBanner.showSevereFallbackDraft(this.recoveryDraft, currentSevereFallbackContainer);
    } catch (e) {
      return false;
    }
  }
};

const AppController = {
  init(elements) {
    if (!elements || !elements.displayElement || !elements.initialInputNode || !elements.errorContainer || !elements.resetButton) {
      throw new ReferenceError('AppController.init missing required DOM elements');
    }
    if (isInitialized) return;
    currentSevereFallbackContainer = elements.severeFallbackContainer || elements.errorContainer;
    try {
      if (registeredResetButton && registeredResetHandler) {
        registeredResetButton.removeEventListener('click', registeredResetHandler);
      }
      if (registeredInputNode) {
        InputController.unbindInputNode(registeredInputNode);
      }
      InputController.bindInputNode(elements.initialInputNode, 1);
      registeredResetButton = elements.resetButton;
      registeredResetHandler = (e) => ResetController.handleReset();
      registeredResetButton.addEventListener('click', registeredResetHandler);
      DisplayRenderer.renderPlaceholder(elements.displayElement, '【等待输入核对】');
      FeedbackBanner.clearInputError(elements.initialInputNode, elements.errorContainer);
      elements.initialInputNode.focus();
      activeInputNode = elements.initialInputNode;
      inputGeneration = 1;
      schedulerEpoch = 0;
      isInitialized = true;
    } catch (err) {
      if (registeredResetButton && registeredResetHandler) {
        registeredResetButton.removeEventListener('click', registeredResetHandler);
        registeredResetButton = null;
        registeredResetHandler = null;
      }
      InputController.unbindInputNode(elements.initialInputNode);
      isInitialized = false;
      FeedbackBanner.showGlobalError('应用初始化装配遇到异常，已保留输入框草稿，请微调后重试');
    }
  }
};
```

Task=null


## blk-prod-target / target / 目标用户与使用场景

Stage=product; requirements=[]; dependencies=[]

面向个人开发者本地独立开发与核对测试场景。用户需要在桌面浏览器中快速核对原型项目名的输入与即时视觉反馈，桌面优先，单人单机使用，无需跨设备同步、无多用户协作与无身份认证。

Task=null


## blk-prod-problem / problem / 核心问题与痛点分析（异常保护边界限定）

Stage=product; requirements=[]; dependencies=["blk-prod-target"]

解决个人开发者在本地进行轻量原型验证时缺乏即时、低干扰核对界面的问题。痛点包括：常规测试页面常依赖网络请求或复杂脚手架，难以进行秒级纯客户端反馈；在空值提交或轻量异常提交时若缺乏提示或粗暴清空用户输入，会导致重复录入测试数据，降低核对效率。明确界定异常保护边界：普通运行时校验与轻量 DOM 异常下，输入框既有文本完好保留且保持可编辑；在极端的清空两阶段事务严重回插失败下，主编辑器受限，系统通过独立只读草稿容器或内存所有权保障草稿 0 丢失，禁止强制页面刷新，不承诺主编辑器完全恢复。

Task=null


## blk-prod-non-goals / non_goals / 非目标与排除能力

Stage=product; requirements=[]; dependencies=["blk-prod-scope"]

明确排除以下所有能力扩张：
1. 服务端支持：不引入任何后端 API、Node.js 服务端运行时或网络请求；
2. 数据库与持久化：不依赖 IndexedDB/LocalStorage/远程数据库作为长期数据仓库；
3. 用户鉴权与权限：无登录、注册、Token 管理或鉴权逻辑；
4. 协同与支付：无多人协作、链接分享或商业化计费体系；
5. 不将 fixture.png 中的示例文字“Q7M4-8261”转为业务需求或固定业务约束。

Task=null


## blk-prod-scope / scope / 产品功能与边界范围（输入节点替换与代际闭包隔离）

Stage=product; requirements=[]; dependencies=["blk-prod-outcomes"]

本产品严格限定为纯前端单页面应用。包含：
1. 单个文本输入框（用于输入项目名，监听实时输入变化与中文输入法合成事件）；
2. 300ms 防抖自动展示调度机制（输入变化等待 300ms 自动触发非空校验、XSS 安全纯文本渲染并展示大字，输入法合成期间不触发，选词上屏后计时，输入框内容完好保留）；
3. 顶部高对比项目名展示区域（支持纯文本安全渲染、初始灰字占位与超长文本自动折行换行）；
4. 清空重置按钮（一键复位界面状态、立即取消未完成的 300ms 待展示防抖任务，并自动回焦输入框；采用清空时替换输入节点与节点代际闭包隔离机制彻底作废旧节点事件与旧定时器）；
5. 就地错误警示展示与异常保留输入机制（空值校验失败清除旧项目名展示并恢复占位符，输入框既有内容原样保留）；
6. 基于 fixture.png 的白底与控件空间排布映射（依据已确认决策彻底移除确认按钮及其专属逻辑，仅保留白底背景、顶部大字展示与底部橙色圆形清空操作控件）。

Task=null


## blk-prod-outcomes / outcomes / 预期产品成效与真实衡量口径目标（节点代际隔离与性能闭合）

Stage=product; requirements=["blk-prod-target"]; dependencies=["blk-prod-problem"]

1. 实时核对成效：输入项目名每次发生变化后，等待 300ms 防抖计时到期后自动将该名称以高对比大字呈现在顶部展示区，无需手动点击确认按钮；支持中文拼音输入法合成态（IME isComposing）节点闭包隔离，选词上屏后触发 300ms 防抖更新；若合成期间点击清空，系统采用“清空时替换输入节点＋节点代际闭包隔离”机制，递增代际 inputGeneration 并替换活跃 DOM 节点，使旧节点迟到的 compositionend 与尾随 input 事件因代际与节点引用失效被直接丢弃，绝不污染新节点，不产生旧文本回显或制造空值报错；新节点真实输入（键入、粘贴、新合成）顺畅流转 300ms 防抖。
2. 清空即时取消与复位：点击清空按钮时立即取消所有待执行的 300ms 防抖任务（递增 schedulerEpoch 使队列任务失效），即时清除顶部展示区与输入框内容，光标自动回焦新输入框，无二次确认弹窗或撤销延迟。
3. 健壮防错与空值清除旧结果：空值或纯空白字符输入经 300ms 防抖后产生明确就地可见警示，且立即清除已展示的旧项目名并恢复占位符；输入框既有字符（含空格）严格保留；普通非破坏性异常保留主输入可编辑；清空事务严重回插失败时主编辑器受限，通过独立只读草稿容器或内存所有权保障草稿 0 丢失，禁止强制刷新页面。
4. 安全纯文本渲染：用户输入的任何 HTML 实体或脚本标签文本，均严格通过 Node.textContent 作为纯文本节点回显，不被浏览器解析为 HTML 元素或执行脚本，并在验收中验证恶意标记原样纯文本显示；限定为展示节点纯文本安全输出，不外推为全系统安全绝对证明。
5. 真实性能测量口径与待验证设计目标（全部指标以桌面 PC、主流浏览器 Chrome 最新稳定版无痕模式、可见前台 active foreground tab 为测量前提，测试数据为 1 条 1~200 字符典型项目名文本，采样次数与通过判定边界严格闭合）：
   - 指标 1：首屏 DOM 解析与脚本就绪延迟（DOM Ready Latency）
     * 采样端点：Navigation Timing API 之 domContentLoadedEventEnd - startTime（衡量 HTML 完全解析且 defer 脚本执行完毕耗时，作为 DOM 就绪代理指标，不冒充物理像素绘制完成）；
     * 采样次数：测试 5 轮冷加载；
     * 判定边界：5 轮实测均值 ≤ 300ms；
   - 指标 2：输入防抖处理至重绘前调度延迟（Input Debounce to Pre-repaint Dispatch Latency）
     * 采样端点：从最后一次 input/compositionend 事件触发打点 t_input，经过 300ms 定时器回调，至 Node.textContent 赋值及 requestAnimationFrame 回调执行打点 t_raf（明确为防抖等待加处理及下一次重绘前的调度耗时，不冒充物理可见绘制完成）；
     * 构成拆解：300ms 定时器等待 + ≤50ms 的纯计算与重绘前调度延迟，总耗时目标 ≤ 350ms；
     * 采样次数：测试 5 轮有效输入；
     * 判定边界：5 轮实测总耗时均值 ≤ 350ms，且其中 DOM 更新与重绘前调度延迟均值 ≤ 50ms；
   - 指标 3：清空重置至重绘前调度延迟（Reset to Pre-repaint Dispatch Latency）
     * 采样端点：从清空按钮 click 事件触发打点 t_click 至 DOM 重置后 requestAnimationFrame 回调执行打点 t_raf（明确为处理及下一次重绘前调度耗时，不冒充物理像素擦除完成）；
     * 采样次数：测试 5 轮清空交互；
     * 判定边界：5 轮实测均值 ≤ 50ms。
6. 诚实实测状态说明：当前阶段未开发目标代码、Docker 容器与自动化环境未就绪，上述性能与浏览器兼容性指标如实标为待验证设计目标，保留给开发阶段具备真实真机与浏览器环境后实测，不伪造实测通过。

Task=null


## blk-page-main-layout / page / 页面职责与参考图空间结构映射（节点物理替换、五类持久属性与事务拓扑回滚）

Stage=product; requirements=["blk-prod-scope","blk-prod-target"]; dependencies=["blk-prod-scope"]

页面视觉布局与 DOM 空间映射严格基于参考截图 fixture.png 与单按钮实时反馈变更：
1. 页面定位与参考图映射关系：纯前端单页面，基于 fixture.png 视觉映射，白底背景（#FFFFFF），顶部大字展示区、居中输入表单、底部右侧橙色实心圆形清空按钮（#FF5500），彻底移除原蓝色确认按钮。
2. 页面各功能区域职责与 DOM 结构契约：
   - 顶部加粗高对比大字展示区（<div id="project-name-display" ...>）：仅通过 Node.textContent 渲染纯文本；
   - 错误提示与就地容错区（<div id="project-name-error" aria-live="polite">）：位于输入框正下方，显示非空警示；
   - 全局通知与只读草稿复制横幅（<div id="error-banner-container">）：预留独立只读草稿容器宿主 severeFallbackContainer，供严重回滚异常时挂载 readonly textarea 逐字符呈现原始草稿供手动选中复制；若挂载失败亦作为用户可见全局报错通道，不使用纯控制台输出替代交互；
   - 中部输入交互区（<input id="project-name-input" name="projectName" type="text" ...>）：单一受控输入框，包含 5 类持久属性配置（label 关联 id/name、WAI-ARIA 属性、tabindex、class/style、data-*），瞬态校验与错误类名单独重置；
   - 底部辅助操作区：仅包含单一橙色圆形清空按钮（<button id="reset-button">），无二次弹窗。
3. 清空状态事务与 DOM 拓扑唯一性保证：
   - 清空时采用“清空状态事务＋节点物理替换＋持久配置复制＋失败原子拓扑回滚”；
   - 捕获恢复快照并在内存预制 newNode 复制 5 类持久属性，绑定新闭包；若快照捕获失败直接提示可见错误并保持原输入，不调用 rollback；
   - 成功提交点（Commit Point）：replaceWith 替换、占位复位、错误清除、焦点转移全部成功后才递增代际；
   - 失败回滚：若替换或后续步骤抛错，彻底从 DOM 树移除已挂载的 replacement 节点并物理回插原节点，断言文档中有且仅有一个具有 id="project-name-input" 的 HTMLInputElement，0 replacement 残留，唯一 label 映射与焦点保真；
   - 严重回插失败在只读 textarea 容器中原样呈现原始草稿供用户手动复制；若挂载失败直接通过全局横幅可见报错并由 ResetController.recoveryDraft 在内存中持有草稿，禁止 window.location.reload() 刷新。

Task=null


## blk-feat-input-display / feature / 功能特性：输入 300ms 防抖实时反馈、节点代际闭包隔离与草稿快照契约

Stage=product; requirements=["blk-prod-scope","blk-prod-outcomes"]; dependencies=["blk-prod-scope"]

实现文本输入框的 300ms 防抖实时反馈、节点代际闭包隔离与快照调度契约：
- 核心功能概述与触发逻辑：输入框监听 input 事件，每次输入停止 300ms 后自动将输入内容呈现于顶部大字展示区，彻底移除确认按钮与 Enter 提交专属逻辑；
- IME 中文拼音输入法合成态闭包管理：compositionstart 设置 isComposing=true 并 cancel 旧任务；compositionend 结束合成，设置 isComposing=false，捕获 node.value 为 trustedDraft 并调用 schedule 启动 300ms 防抖；组合输入状态私有归属于节点闭包，旧节点 end 无法修改新节点 isComposing；
- 清空状态事务与尾随事件隔离契约：用户点击清空按钮时，系统执行两阶段状态事务：在捕获恢复快照并在内存中预制全新 input 节点（复制 5 类持久属性、绑定新闭包）、取消防抖调度并递增 schedulerEpoch、执行实际 replaceWith 节点物理替换、复位展示区为占位符、清除错误及焦点转移全部成功后，才正式原子提交递增 inputGeneration 并更新活跃节点引用；若快照捕获本身失败则直接呈现可见错误，原节点与待任务保持不动；若替换及后续过程抛错立即原子回滚，原节点、代际与原始草稿（含空值/纯空格排队任务）完整保留。旧节点的迟到 compositionend、beforeinput 或尾随 input 事件在进入旧闭包时，因 node !== activeInputNode 且 bornGeneration !== inputGeneration（旧闭包代际不匹配已提交的新代际，或回滚状态下事件源失配）被入口守卫直接丢弃返回，绝不接触 activeInputNode，绝不制造空值错误，也无需额外按键解锁；新节点的物理键入、粘贴或新发起的中文拼音输入均直接在新闭包与新代际中正常流转 300ms 防抖；
- 空值与纯空格输入彻底清除旧结果：用户手动删空或录入纯空格并停止 300ms 时，防抖校验拦截，立即清除已展示的旧项目名并恢复为初始灰色占位提示“【等待输入核对】”，在输入框正下方就地呈现红色非空警示“项目名不能为空，请输入有效字符”；输入框已输入的字符（含空格）原样完好保留；
- 初始化装配与节点监听清理规范：AppController.init 采用显式依赖注入，提供初始输入节点绑定与单次清空按钮注册，在装配中途或重试时具备明确的解绑与清理所有权，确保恰好一次事件响应与草稿保留；
- 待验证状态与环境差异说明：桌面端 Chrome、Edge、Firefox 与 Safari 在原生 IME 输入下替换 DOM 节点的具体事件派发与会话生命周期行为属于开发阶段真机实测用例，不作彻底杜绝所有原生竞态的无证据绝对承诺。

Task=null


## blk-flow-input-display / flow / 交互流程：输入事件闭包守卫、快照防抖调度与节点代际流转

Stage=product; requirements=["blk-feat-input-display"]; dependencies=["blk-feat-input-display"]

交互流转规范（输入事件闭包守卫、快照防抖调度与节点代际流转）：
1. 页面初始加载流转（AppController.init 事务装配）：DOMContentLoaded 触发，调用 AppController.init 显式传入 4 核心依赖及只读兜底容器来源。执行依赖校验；若此前初始化曾中断，执行安全解绑清理（解除既有 resetButton 监听与 initialInputNode 的既有监听）；调用 InputController.bindInputNode(elements.initialInputNode, 1) 为初始输入节点绑定代际 1 闭包；为 elements.resetButton 绑定单一 resetHandler 监听器并保存句柄引用；调用 DisplayRenderer.renderPlaceholder(elements.displayElement, '【等待输入核对】') 初始化展示区；调用 FeedbackBanner.clearInputError(elements.initialInputNode, elements.errorContainer) 隐藏错误；显式执行 elements.initialInputNode.focus() 将光标聚焦到初始输入框；仅在全部装配步骤成功后，才在原子提交点将 activeInputNode 置为 initialInputNode，设置 inputGeneration=1，schedulerEpoch=0，并提交 isInitialized=true 进入可用就绪态；若初始化中途抛错，执行安全解绑清理且保持 isInitialized=false，不清空既有草稿，展示可见全局错误，支持重试；
2. 用户在输入框中键入字符；
3. 输入事件触发与四重闭包守卫：event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)；
4. IME 拼音输入法状态流转：compositionstart -> cancel 挂起；compositionend -> isComposing=false, schedule(trustedDraft, node, bornGeneration, callback, 300)；
5. 防抖调度与快照绑定：DebounceScheduler.schedule 递增 schedulerEpoch 生成 thisEpoch，启动 300ms setTimeout；若在倒计时期间收到新输入，旧任务被销毁以新纪元重排；若在倒计时期间用户点击清空按钮，清空逻辑立即触发 ResetController.handleReset() 状态事务：在统一 try-catch 保护下调用 captureSnapshot；若快照捕获本身抛错，直接调用 FeedbackBanner.showGlobalError 可见报错，原节点、代际、草稿与在途定时任务完全保持不变，不调用 rollback；若快照成功，在内存中预制新节点并复制 5 类持久属性，绑定新闭包；执行 DebounceScheduler.cancel()（递增 schedulerEpoch 使旧队列任务失效）；执行 oldNode.replaceWith(newNode) 物理替换；完成展示占位复位、错误清除与焦点转移；全部成功后才正式原子提交更新 activeInputNode 并递增 inputGeneration；若替换及后续环节抛错则触发 rollback(snapshot, error, mountedReplacementNode) 原子还原单一原节点并无差别按原始草稿重新调度 300ms 防抖；倒计时逻辑在到期后因纪元或代际失配被无害丢弃；
6. 定时器唤醒与快照校验执行：thisEpoch === schedulerEpoch && targetGeneration === inputGeneration && targetNode === activeInputNode && document.body.contains(targetNode) 通过后，校验 draftSnapshot：
   - 分支 A（空值或纯空白）：清除展示区旧项目名恢复灰色占位符“【等待输入核对】”，就地显示红色警示“项目名不能为空，请输入有效字符”，输入框保持原文（含空格）并保持焦点；
   - 分支 B（有效非空）：清除错误提示，Node.textContent 安全更新大字，输入框完好保留当前文本；
7. 异常防护：DOM 异常由局部 try-catch 拦截并呈现轻量横幅，输入框文本完好保留供用户微调恢复。

Task=null


## blk-acc-input-display / acceptance / 验收标准：300ms 防抖实时反馈、节点替换隔离与精确测试用例 Given-When-Then

Stage=product; requirements=["blk-feat-input-display"]; dependencies=["blk-flow-input-display"]

Scenario 1: 正常输入 300ms 防抖自动核对展示
Given 页面已在本地桌面浏览器正常加载且处于待命状态
When 用户在输入框中键入 'AiRDUO-Project-01' 并停止输入超过 300 毫秒
Then 页面顶部展示区自动显示 'AiRDUO-Project-01'，字体醒目大字高对比，输入框保留 'AiRDUO-Project-01'，页面无错误提示，全程无需点击任何确认按钮。

Scenario 2: 中文输入法（IME）拼音合成态防误触
Given 用户聚焦输入框并使用中文拼音输入法键入拼音 'xiangmu'
When 用户在候选字列表选词暂停（处于 compositionstart 与 compositionend 之间，闭包内 isComposing 为 true）
Then 顶部展示区不展示未完成的拼音字母 'xiangmu'，防抖计时挂起；当用户选择候选词确认上屏 '项目' 并停止输入满 300 毫秒后，顶部展示区一次性更新呈现 '项目'。

Scenario 3: 清空后旧节点迟到 compositionend 与尾随 input 不得重显或造错
Given 用户在旧输入框 node_1（bornGeneration=1）中启动拼音输入法合成，尚未完成选词
When 用户直接点击底部橙色圆形清空按钮（触发 node_1.replaceWith(node_2)，inputGeneration 递增为 2），且随后旧输入法引擎向已脱离 DOM 的 node_1 派发迟到的 compositionend 事件与尾随 input 事件
Then node_1 闭包检测到 node_1 !== activeInputNode 且 1 !== 2 立即直接返回，新输入框 node_2 的 value 保持为空字符串 ''，顶部展示区保持占位提示 '【等待输入核对】'；等待 350 毫秒后复查，展示区始终显示 '【等待输入核对】'，页面绝不出现空值错误提示，控制台 0 报错。

Scenario 4: 新节点输入后旧节点 compositionend 不得抹除新草稿或取消新定时器
Given 用户在 node_1 键入拼音后点击清空，系统生成新节点 node_2（bornGeneration=2, inputGeneration=2）
When 用户立即在 node_2 中键入 'Brand-New-2026' 并启动 300ms 防抖，随后 node_1 派发迟到的旧 compositionend 事件
Then node_1 闭包拒绝执行并不操作 activeInputNode，node_2 的 300ms 防抖定时器未被取消，node_2 的 value 完好保持为 'Brand-New-2026'；满 300 毫秒后顶部展示区大字呈现 'Brand-New-2026'。

Scenario 5: 新节点启动新合成后旧节点 compositionend 不得提前结束新合成
Given 用户在 node_1 键入后点击清空生成 node_2，随后用户在 node_2 中启动新的中文输入法拼音输入（node_2 闭包 isComposing 变为 true）
When node_1 派发迟到的旧 compositionend 事件
Then node_1 闭包被守卫拦截直接返回，node_2 闭包中的 isComposing 保持为 true，新拼音草稿不被提前校验，等待新选词上屏后满 300 毫秒正常呈现最终中文项目名。

Scenario 6: 旧定时器已出队后被清空或新输入抢占，旧回调执行无效
Given 用户在输入框中键入 'Temporary-Draft'，300ms 定时器即将到期并已出队进入宏任务队列
When 用户在定时器回调执行前瞬间点击清空按钮（触发 schedulerEpoch 递增并清空），或录入新字符
Then 定时器回调执行时检测到 thisEpoch !== schedulerEpoch（或 targetGeneration !== inputGeneration），立即退出返回，不调用 ValidatorModule，不更新 DOM 展示区，展示区保持为 '【等待输入核对】'。

Scenario 7: 删空文本防抖拦截与旧项目名清除
Given 页面顶部展示区正在展示此前核对成功的项目名 'Old-Alpha-Project'，输入框包含 'Old-Alpha-Project'
When 开发者使用 Backspace/Delete 键将输入框文字全部删空并停止输入满 300 毫秒
Then 顶部展示区原旧项目名 'Old-Alpha-Project' 立即被清除并不再显示，展示区恢复为初始灰色占位文字 '【等待输入核对】'，输入框正下方就地呈现红色警示文字 '项目名不能为空，请输入有效字符'，输入框边框变红，输入框保持空值可编辑焦点，绝不残留旧结果。

Scenario 8: 纯空格输入防抖拦截、旧结果清除与空格保留
Given 页面顶部展示区正在展示 'Old-Alpha-Project'
When 开发者在输入框中输入三个半角空格 '   ' 并停止输入满 300 毫秒
Then 顶部展示区旧项目名立即被清除并恢复为灰色占位文字 '【等待输入核对】'，输入框正下方出现红色明确提示 '项目名不能为空，请输入有效字符'，输入框内输入的三个半角空格完好保留，光标保持在输入框内。

Scenario 9: 运行时异常保留输入
Given 用户在输入框中输入了测试项目名
When 异步回调触发未知运行时错误
Then 页面顶部显示友好错误横幅，输入框内的所有字符完好保留，页面不重载，允许用户修改或重试。

Task=null


## blk-feat-reset / feature / 功能特性：一键即时清空、状态事务回滚与五类持久属性保留契约（单DOM拓扑恢复与草稿无差别重调度）

Stage=product; requirements=["blk-prod-scope","blk-prod-outcomes"]; dependencies=["blk-feat-input-display"]

一键即时清空、强状态事务（Two-Phase Commit）、五类持久属性保真复制与失败原子拓扑回滚契约：
1. 核心交互与状态事务两阶段提交契约：
   用户点击底部橙色圆形清空按钮时，立即触发 ResetController.handleReset() 状态事务；
   阶段一（快照捕获）：在统一 try 块中执行 captureSnapshot()，若抛错则直接呈现可见全局错误，原输入框、文本、代际与在途定时任务完全保持不变，不触发 rollback；
   阶段二（内存预制）：计算 nextGeneration = G + 1，创建全新 input 节点 newNode 并复制 5 类持久属性，绑定新闭包；
   阶段三（取消防抖）：调用 DebounceScheduler.cancel() 取消在途计时器并使 schedulerEpoch 单调前进；
   阶段四（节点替换）：执行 oldNode.replaceWith(newNode) 并记录 mountedReplacementNode = newNode；
   阶段五（复位与就绪）：DisplayRenderer.renderPlaceholder 复位展示区，FeedbackBanner.clearInputError 清除错误，newNode.focus() 转移焦点；
   阶段六（原子提交 Commit Point）：上述全部成功后，正式原子提交：activeInputNode = newNode，inputGeneration = nextGeneration；
   异常拦截与原子拓扑回滚（解决 R6-B1, R6-B2 与 M5, M6）：
   若在已成功获取快照后的替换前准备、replaceWith 或后续呈现/清理/焦点环节抛错，catch 立即触发 rollback(snapshot, error, mountedReplacementNode)：
   原子拓扑还原：显式识别 replacement 节点，从 DOM 树彻底移除 replacement 节点并插回原节点，断言页面中始终只有单一合法输入框（querySelectorAll('input').length === 1，0 重复 ID）；activeInputNode 还原为原节点，代际还原为原 G（不提前递增）；schedulerEpoch 单调前进废弃旧定时器；
   原始草稿无差别重调度：若此前存在待任务（hadPendingTimer===true），无条件对原始草稿快照 snapshot.draft（涵盖 empty、三个空格、nonempty）重新调度 300ms 防抖，严禁因 trim 过滤跳过；空值或纯空格在 300ms 后忠实执行校验，清除旧项目名展示并呈现红色非空警示，空格原样保留；原闭包 bornGeneration===inputGeneration 依然自洽，用户可继续输入、手动删空或重试清空；
   严重回插失败内存持有、只读复制兜底与通知通道：若回滚本身发生 DOM 异常，建立诚实失败状态：不声称“完整恢复”，坚决禁止刷新页面（禁止 window.location.reload()），不把空输入当作已恢复；将草稿存入 ResetController.recoveryDraft 内存持久持有；调用 FeedbackBanner.showSevereFallbackDraft 在独立只读 textarea 容器中逐字符原样呈现原始草稿供用户手动复制；若挂载成功，提示诚实说明主编辑器受限，草稿已在只读区安全保留；若挂载失败，绝不声称复制就绪，亦不以 console 代替交互，直接通过 FeedbackBanner.showGlobalError 呈现可见错误通知用户；若全局通知亦失败则诚实标为内存保留、显示不可用，绝不递归触发 window.onerror；
2. 持久配置复制策略与瞬态状态重置：5 类持久属性完整复制（label 关联 id/name、WAI-ARIA 属性、tabindex、class/style、data-*）；单独重置瞬态状态：value='', trustedDraft='', 显式移除 aria-invalid 与错误类名；
3. 旧节点迟到事件隔离：事务成功提交后，脱离 DOM 的旧节点收到迟到事件时因 node !== activeInputNode 且 bornGeneration !== inputGeneration 被入口守卫直接丢弃返回，不污染新输入框。

Task=null


## blk-flow-reset / flow / 交互流程：清空状态事务两阶段提交、持久属性保真复制与失败拓扑回滚（单DOM保真与草稿无差别重调度）

Stage=product; requirements=["blk-feat-reset"]; dependencies=["blk-feat-reset"]

清空状态事务全流程与失败回滚流转步骤（涵盖单向提交点、异常拓扑恢复与无快照异常保护）：
1. 用户点击底部橙色圆形清空按钮（resetButton）。
2. 执行 ResetController.handleReset() 核心状态事务流程：
   阶段一：捕获恢复快照（处于独立安全分支保护中）：
   - 尝试捕获 snapshot：记录 activeInputNode 引用、inputGeneration G、schedulerEpoch、hadPendingTimer（通过 hasPending() 判定）、原始草稿 draft（原样捕获包括空串、纯空格与非空）、displayContent、errorContent、显隐与样式状态、DOM parentNode 与 nextSibling 引用；
   - 快照捕获失败分支（M5）：若 captureSnapshot 自身抛错，表明尚未执行任何 DOM 修改或状态变更；catch 块捕获后直接调用 FeedbackBanner.showGlobalError('清空快照捕获遇到异常，已保留原始输入状态供微调重试')，原 activeInputNode、代际 G、草稿内容与排队中的定时任务完全保持不变，直接 return 中止流程，绝不调用需要有效快照的 rollback，亦不谎称执行了回滚；
   阶段二：内存预制与属性复制（快照已成功，原代际未提交）：
   - 计算 nextGeneration = snapshot.inputGeneration + 1；
   - 内存实例化全新 input 节点 newNode；
   - 安全复制 5 类持久属性（label 关联、ARIA、tabindex、class/style、data-*），排除 value 与瞬态 aria-invalid；
   - 为 newNode 调用 InputController.bindInputNode(newNode, nextGeneration)；
   阶段三：取消防抖与使旧任务失效：
   - 调用 DebounceScheduler.cancel()，销毁活跃定时器并使 schedulerEpoch 单调前进；
   阶段四：实际物理节点替换：
   - oldNode.replaceWith(newNode)，显式记录 mountedReplacementNode = newNode；
   阶段五：呈现复位、错误清理与焦点转移：
   - DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】')；
   - FeedbackBanner.clearInputError(newNode, errorContainer)；
   - newNode.focus()；
   阶段六：原子提交点（Commit Point）：
   - 上述步骤全部成功后，正式原子提交：activeInputNode = newNode，inputGeneration = nextGeneration；ResetController.recoveryDraft = null；至此清空事务成功提交；
   异常拦截与原子回滚阶段（Rollback Phase，仅在 snapshot 有效捕获后后续抛错时执行）：
   - 若在准备阶段、replaceWith 抛错、或替换后呈现/清理/焦点失败任意环节抛错，进入 catch 并调用 rollback(snapshot, error, mountedReplacementNode)：
     * 显式识别 replacementNode，若已挂入 DOM 树则物理回插原节点并彻底移除 replacementNode，严禁 DOM 残留，确保 querySelectorAll('input').length === 1 且 ID 唯一；若 replacementNode 未挂载且原节点脱离，按 snapshot.parentNode 与 nextSibling 插回原位；
     * activeInputNode 重新指向 oldNode，inputGeneration 还原为 snapshot.inputGeneration（保持原代际 G，绝不提前递增）；schedulerEpoch 单调前进；
     * oldNode.value 还原为 snapshot.draft；还原错误与展示内容；
     * 若 snapshot.hadPendingTimer 为 true，无条件针对 snapshot.draft（涵盖 empty、三个空格、nonempty，绝不因 trim 校验跳过）重新调度 300ms 防抖；空值或纯空格在 300ms 后忠实执行校验，清除旧项目名并显警示，空格原文保留；因代际还原，oldNode 闭包中 bornGeneration === inputGeneration 依然完全匹配自洽；
     * oldNode.focus() 回焦，横幅呈现 FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态')；
     * 严重失败内存持有与只读复制兜底（M6 规范）：若回插原节点严重失败，定义诚实失败状态：不声称完整恢复，坚决禁止 window.location.reload() 刷新页面；ResetController.recoveryDraft = snapshot.draft（内存持久持有原始草稿）；调用 FeedbackBanner.showSevereFallbackDraft 尝试在独立只读 textarea 容器中逐字符呈现原始 draft 供用户手动复制；若挂载成功，提示草稿已在只读区安全保留；若挂载失败，不得假造复制就绪，直接调用 FeedbackBanner.showGlobalError 告知用户草稿保留在内存快照中且主编辑器受限，不以 console 伪装用户交互；若通知挂载亦失败则诚实标为内存保留、显示不可用，绝不递归触发 window.onerror；
3. 旧节点迟到事件隔离：事务成功提交后，脱离 DOM 的 oldNode 收到迟到事件时因 node !== activeInputNode 且 bornGeneration !== inputGeneration 被入口守卫直接丢弃返回；
4. 顺畅恢复与继续操作：成功后 newNode 正常流转 300ms 防抖；回滚后 oldNode 键入（如 'Edited after failure'）同样正常触发 300ms 防抖，手动删空与重试清空完全可用，重试成功后依然维持单一输入框。

Task=null


## blk-acc-reset / acceptance / 清空交互与状态事务原子回滚验收标准 Given-When-Then（单DOM保真、草稿重调度与只读兜底）

Stage=product; requirements=["blk-feat-reset"]; dependencies=["blk-flow-reset"]

Scenario 1: 正常一键即时直接清空、五类持久属性保留与瞬态重置（无确认弹窗）
Given 页面正在展示项目名 'Project-Alpha'，输入框包含 5 类持久属性且挂载有校验错误提示
When 用户点击底部橙色圆形清空按钮
Then 顶部展示区立即清除旧文本并呈现灰色占位提示 '【等待输入核对】'；原输入框被新节点物理替换，新输入框 value 为空，5 类持久属性完好保留，瞬态 aria-invalid 与错误类名彻底清除；光标自动回焦新输入框，无任何二次确认弹窗或撤销浮条。

Scenario 2: 清空快照捕获阶段抛错保护与原状态无修改保持（M5 验证）
Given 输入框内存在重要草稿 'Preserved Draft'，代际为 G，存在排队中的 300ms 防抖任务
When 用户点击清空按钮，在执行 captureSnapshot() 瞬间注入异常
Then 系统安全捕获该异常，不调用 rollback，页面中 activeInputNode 仍为原节点且挂载原位，代际保持为 G，草稿 'Preserved Draft' 完好保留，在途防抖定时器未被取消并正常到期展示大字，页面顶部横幅呈现可见错误提示 '清空快照捕获遇到异常，已保留原始输入状态供微调重试'，输入框保持可编辑。

Scenario 3: 替换前准备期抛错回滚与原节点自洽保留
Given 输入框内存在草稿 'Draft Before Replace'，代际为 G
When 点击清空按钮，快照捕获成功，但在内存预制 newNode 或复制属性阶段注入异常
Then catch 块执行回滚，因 newNode 未挂载，原节点 oldNode 完好保留在 DOM 原位，activeInputNode 仍指向 oldNode，代际保持为 G（未提前递增），草稿与焦点完好，顶部弹出友好错误横幅。

Scenario 4: 替换执行过程（replaceWith）抛错回滚与 DOM 拓扑还原
Given 输入框内存在草稿 'Draft In Replace'，展示区呈现 'Draft In Replace'
When 点击清空按钮，在执行 oldNode.replaceWith(newNode) 瞬间注入异常
Then catch 块执行回滚，若 oldNode 脱离则将其安全插回原 parentNode 与 nextSibling 位置，确保页面有且仅有 1 个输入框且 ID 唯一，代际还原为 G，草稿与焦点完好保留。

Scenario 5: 替换后后续步骤（renderPlaceholder/clearInputError/focus）抛错回滚与 DOM 单输入框拓扑保真（R6-B1 验证）
Given 输入框内存在草稿 'Critical Test Draft'，展示区呈现 'Critical Test Draft'
When 点击清空按钮，newNode 已挂入 DOM 树，但后续 renderPlaceholder 或 clearInputError 抛错
Then catch 块执行回滚，显式识别 replacement 节点 newNode 并从 DOM 树彻底移除（通过 replaceChild 回插 oldNode 或 remove 后回插 oldNode），断言查验 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留；activeInputNode 重新指向 oldNode，代际还原为 G，原草稿 'Critical Test Draft' 完整保留并保持焦点。

Scenario 6: 空值与纯空格待校验任务清空遇回滚后无差别重新调度（R6-B2 验证）
Given 页面展示区正呈现旧项目名 'Old Title'
When 用户输入三个空格 '   '（或删空文本）并发起 input 调度，在 300ms 定时器到期前点击清空按钮，且清空流程注入 replaceWith 失败触发回滚
Then rollback 检测到 hadPendingTimer 为 true，无条件针对原纯空格草稿 '   '（或删空草稿 ''）重新调度 300ms 防抖任务；满 300ms 后定时器正常唤醒并执行校验，展示区旧项目名 'Old Title' 立即被清除并恢复为占位提示 '【等待输入核对】'，输入框正下方呈现红色非空警示 '项目名不能为空，请输入有效字符'，三个半角空格完好保留，旧展示不持久残留。

Scenario 7: 事务回滚成功后用户继续键入、手动删空与幂等清空重试
Given 经历清空失败回滚后，界面恢复原节点 oldNode，草稿为 'Draft Recovered'
When 开发者在输入框中继续键入 'Edited after failure' 并停止 300ms
Then 顶部展示区正常通过 Node.textContent 安全更新为 'Edited after failure'；随后手动删空停止 300ms，展示区旧文本立即清除并报非空警示；再次点击清空按钮，清空事务成功提交，DOM 依然维持单一输入框。

Scenario 8: 事务成功提交后旧节点迟到 compositionend 与尾随 input 拦截隔离
Given 清空事务成功提交，新节点 newNode 代际为 2，原节点 oldNode 已脱离 DOM
When 向脱离的 oldNode 派发迟到的 compositionend 或尾随 input 事件
Then oldNode 闭包前置守卫核验失败（node !== activeInputNode 且 1 !== 2），事件被直接拦截丢弃，newNode 的 value 保持为空，350ms 后展示区无空值报错，新会话完全不受干扰。

Scenario 9: 严重回插失败内存持有、只读草稿全文呈现、手动复制兜底与容器挂载失败可见报错（M6 验证）
Given 清空流程在替换后发生异常，且回插原节点过程中再次发生严重 DOM 异常
When 进入严重失败兜底分支
Then 系统坚决禁止 window.location.reload() 刷新页面；ResetController.recoveryDraft 稳定在内存持有原始草稿；若只读容器挂载成功，在独立只读 textarea 容器中逐字符原样呈现原始 draft 文本（包括换行与空格），供用户手动选中复制取回文本，提示明确说明主编辑器暂时受限，草稿已安全就地保留；若只读容器挂载亦发生异常，系统坚决不谎称草稿已呈现或已复制，亦不以纯控制台输出替代交互，直接通过顶部横幅呈现用户可见错误通知：'清空严重异常且草稿容器挂载失败，主编辑器受限，请勿刷新页面，当前草稿已保存在快照中'；若全局通知亦失败则诚实标为内存保留、显示不可用，绝不递归触发 window.onerror。

Task=null
