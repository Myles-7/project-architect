# Read-only candidate preview: flash-materials-final-contract-20261005-12

No final content verdict is implied. Control=blocked; reviewer=task-6a4c2a99-eb09-4b79-a902-18fada3b4ebc (paused).

Context SHA256=f29552086cfc7280ea21b2f04e4dea32e1f7fed947dca1c26b54b47e188d6208.

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


## blk-deliv-acc-security-edge / acceptance / 安全防护、XSS 注入、四重守卫与严重异常降级验收标准

Stage=delivery; requirements=["req-debounced-display","req-reset-clear"]; dependencies=["blk-deliv-task-error-handling","blk-tech-error"]

1. XSS 防护验收：Given 用户输入带有恶意脚本代码（如 `<img src=x onerror=alert(1)>` 或 `<script>alert('xss')</script>`）；When 300ms 防抖倒计时结束并触发渲染；Then 大字展示区将其严格作为无害纯文本展示，不触发任何脚本执行，DOM 检查确认为 Text 节点。
2. 幽灵代际拦截验收：Given 老节点触发了延迟的 input 事件；When 四重守卫进行核验；Then 由于 generation 不匹配被直接拒绝，不引发状态混乱。
3. 严重故障三分支降级验收：
   - 分支 a（普通回滚）：模拟阶段二异常并触发三阶段回滚成功，Then DOM 节点与文本完全保真，防抖重新排期；
   - 分支 b（严重回滚失败且只读 textarea 挂载成功）：模拟三阶段回滚自身崩溃，Then recoveryDraft 持久记录文本草稿，页面动态挂载只读 textarea 呈现完整草稿，FeedbackBanner 呈现严重错误警示；
   - 分支 c（严重回滚失败且只读 textarea 挂载失败）：模拟降级容器故障，Then 文本草稿完整保留于内存，可见错误提示告知用户，FeedbackBanner 内部捕获异常安全返回，不递归触发 window.onerror 导致循环崩溃，且暴露 retryRenderFallbackDraft() 重试渲染接口。

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


## blk-deliv-task-input-workflow / task / 实现输入事件监听、IME 状态机、防抖调度与安全大字渲染

Stage=delivery; requirements=["req-debounced-display"]; dependencies=["blk-flow-input-display","blk-tech-interface"]

开发并交付输入处理全流程单元：实现 InputController 与 DOM 节点的事件绑定及解绑契约，集成 DebounceScheduler 300ms 定时器管理与 IME 合成状态机，通过 DisplayPresenter 纯文本更新大字展示，确保极端异常下输入框文本完全保真。

Task={
  "assumptions": [
    "浏览器支持标准 EventTarget.addEventListener 与 composition 事件",
    "宿主页面已挂载符合 contract 要求的 input 与 display 容器节点"
  ],
  "completionCriteria": [
    "InputController 具备完整的 bindInputNode 与 unbindInputNode 生命周期接口",
    "四重守卫正确拦截失活代际、销毁状态、非当前挂载节点与未就绪实例",
    "所有输入渲染全链路单元测试通过"
  ],
  "exclusions": "不包含清空按钮交互、两阶段拓扑回滚以及全局错误横幅渲染逻辑（由 reset-workflow 与 error-handling 任务独立承担）",
  "failureBehavior": "遭遇未知输入异常时，InputController 隔离错误，确保当前输入框文本不被清空，通过标准接口上报异常",
  "goal": "实现输入框事件监听注册、代际闭包绑定、四重防抖守卫与安全纯文本大字渲染全流程",
  "modules": [
    "InputController",
    "DebounceScheduler",
    "DisplayPresenter"
  ],
  "normalBehavior": "输入框绑定 input/compositionstart/compositionend 事件；用户输入触发 300ms 防抖计时器；中文输入法合成期间挂起计时；倒计时结束通过 textContent 安全更新大字呈现区域",
  "scope": "覆盖输入框事件监听注册与解绑清理、节点代际闭包私有变量捕获、四重守卫核验拦截、DebounceScheduler 300ms 定时器生命周期管理、中文输入法（IME）合成态挂起防抖以及 Node.textContent 安全纯文本大字渲染的完整实现全流程",
  "steps": [
    "实现 InputController.bindInputNode 与 unbindInputNode",
    "实现 DebounceScheduler 防抖计时与 IME 挂起逻辑",
    "实现 DisplayPresenter.renderProjectName 纯文本更新",
    "编写自动化测试套件验证防抖与 XSS 安全"
  ],
  "verification": [
    "单元测试：防抖时间精确度达到 300ms",
    "单元测试：中文输入合成期间不触发大字刷新",
    "安全测试：XSS 字符（<script>等）被转义渲染为纯文本无注入"
  ]
}


## blk-tech-data-model / data_model / 客户端状态快照、事务上下文与代际闭包数据模型

Stage=technical; requirements=["req-reset-clear"]; dependencies=["blk-tech-interface"]

1. InputSnapshot:
   - node: HTMLInputElement // 目标节点引用
   - draftValue: string // 捕获的文本草稿
   - selectionStart: number | null // 光标起始位置
   - selectionEnd: number | null // 光标结束位置
   - generation: number // 当前代际递增计数器
   - isComposing: boolean // 输入法状态标志
2. TransactionContext:
   - txId: string // 事务唯一标识符
   - snapshot: InputSnapshot // 准备阶段捕获的快照
   - state: 'idle' | 'prepared' | 'committed' | 'rolled_back' | 'severe_fallback'
   - createdAt: number
3. ClonedAttributes:
   - id: string
   - className: string
   - placeholder: string
   - ariaLabel: string | null
   - type: string

Task=null


## blk-tech-error / error / 错误分级体系、非破坏性输入隔离与严重回滚失败降级策略

Stage=technical; requirements=["req-lightweight-prototype"]; dependencies=["blk-tech-interface"]

定义 4 级客户端标准错误处理与恢复契约：
1. E01 (DOM_MOUNT_ERR)：初始化阶段目标 DOM 容器未找到，AppController.init 中止并解绑可能挂载的临时监听器，控制台输出结构化诊断信息。
2. E02 (INPUT_GUARD_REJECT)：输入事件未通过四重守卫核验（失活代际、已销毁、节点失配或未初始化），静默丢弃幽灵回调，不破坏当前 DOM 输入框文本。
3. E03 (TX_ROLLBACK_RECOVERABLE)：清空事务提交阶段发生非致命异常，触发三阶段拓扑回滚，单 DOM 输入框完全保真，原始草稿无差别重调度，FeedbackBanner 显示可恢复提示信息。
4. E04 (TX_SEVERE_FALLBACK_ERR)：三阶段拓扑回滚自身发生崩溃（如父节点被并发移除或内存严重异常），分三分支诚实处理：
   - 分支 a（普通回滚成功）：拓扑恢复成功，文本保真，按 E03 处理；
   - 分支 b（严重回滚失败且只读 textarea 挂载成功）：确保内存草稿持久保留于 recoveryDraft，在页面降级挂载只读 textarea 完整呈现草稿供用户一键复制，FeedbackBanner 显示严重错误警示，内部捕获异常并返回布尔值；
   - 分支 c（严重回滚失败且只读 textarea 挂载失败）：确保内存草稿持久保留，通过可见错误提示通知用户“草稿已保留于内存，界面挂载失败”，FeedbackBanner 安全降级，不递归触发 window.onerror 导致循环崩溃，且暴露 retryRenderFallbackDraft() 重试渲染接口。

Task=null


## blk-deliv-task-reset-workflow / task / 实现清空两阶段提交事务、DOM 物理替换、三阶段拓扑回滚与严重故障兜底

Stage=delivery; requirements=["req-reset-clear"]; dependencies=["blk-flow-reset","blk-tech-error","blk-tech-interface"]

开发并交付清空按钮全流程单元：实现 ResetController 快照捕获、内存节点预制与持久属性克隆、replaceWith 原子替换、Display 与 Feedback 复位、焦点转移与 InputController 重新绑定；集成快照失败保护、三阶段拓扑回滚保真机制；实现严重回滚失败下的内存草稿持久化与只读 textarea 呈现及重试机制。

Task={
  "assumptions": [
    "浏览器支持 Element.replaceWith 与 HTMLInputElement.focus",
    "宿主页面具备可操作的清空按钮节点"
  ],
  "completionCriteria": [
    "ResetController executeReset 完整实现两阶段事务机制与三阶段拓扑回滚",
    "严重故障兜底具备完整的只读 textarea 呈现与 retryRenderFallbackDraft 补偿接口",
    "输入框物理替换无事件泄漏与代际幽灵回调"
  ],
  "exclusions": "不包含输入框常规输入防抖调度与 IME 合成逻辑（由 input-workflow 承担）",
  "failureBehavior": "快照捕获阶段失败：直接抛错终止事务，原有 DOM 及防抖定时器毫发无损；预制/替换/挂载阶段抛错：执行三阶段拓扑回滚，单 DOM 输入框完全保真，重调度未完成的草稿防抖；严重回滚失败（E04 第三分支）：确保内存保留草稿，只读 textarea 全文呈现（挂载失败则通过可见错误提示），通过 FeedbackBanner 警示用户，不递归静默吞没",
  "goal": "实现清空按钮两阶段提交事务、DOM 物理替换、输入保护回滚与严重故障兜底",
  "modules": [
    "ResetController",
    "InputController",
    "DisplayPresenter",
    "FeedbackBanner"
  ],
  "normalBehavior": "用户点击清空按钮，捕获快照，预制新节点并克隆持久属性，取消防抖定时器，调用 replaceWith 替换 DOM 节点，重置大字展示与错误横幅，通过 InputController.bindInputNode 绑定并聚焦新节点，清空撤销栈完成原子提交",
  "scope": "覆盖清空按钮事件监听注册、清空状态事务两阶段提交全流程（快照捕获、内存预制全新 input 节点并复制 5 类持久属性、取消防抖、replaceWith 物理替换、展示与错误复位、焦点转移与原子提交）、快照失败保护、三阶段抛错原子拓扑回滚（单 DOM 输入框保真、原始草稿无差别重调度）以及严重回滚失败内存草稿保留与只读 textarea 全文呈现兜底逻辑实现全流程",
  "steps": [
    "实现 ResetController.executeReset 两阶段提交流水线",
    "实现三阶段拓扑回滚逻辑与代际失效机制",
    "实现严重回滚失败兜底只读 textarea 呈现与 retry 接口",
    "编写覆盖正常事务、回滚保真及极端故障兜底的测试用例"
  ],
  "verification": [
    "单元测试：清空成功后新 input 节点获得焦点且 placeholder/className/id 完全保留",
    "异常测试：注入 replaceWith 异常，验证原有输入框文本完全保真且防抖继续生效",
    "严重异常测试：注入极端双重崩溃，验证只读 textarea 兜底渲染或可见错误提示触发"
  ]
}


## blk-deliv-task-error-handling / task / 实现非破坏性错误分级横幅与输入数据保真控制

Stage=technical; requirements=["req-lightweight-prototype"]; dependencies=["blk-tech-error"]

开发并交付全局错误控制单元：实现 FeedbackBanner 组件渲染、E01-E04 错误分级呈现契约；确保在所有错误发生时遵循非破坏性输入保留原则；实现 FeedbackBanner 内部异常防御与布尔状态返回，杜绝未捕获全局异常引发的页面雪崩。

Task={
  "assumptions": [
    "DOM 容器中存在用于呈现错误提示的挂载点"
  ],
  "completionCriteria": [
    "实现 E01-E04 完整错误分级机制",
    "确保所有错误路径遵循输入非破坏性保留原则",
    "FeedbackBanner 具备内部异常捕获与布尔状态返回契约"
  ],
  "exclusions": "不包含清空事务的主逻辑与物理 DOM 替换执行（由 reset-workflow 承担）",
  "failureBehavior": "FeedbackBanner.showGlobalError 内部捕获异常并返回 false；若在严重故障兜底中通知失败，安全降级记录内存标志，不引发次生未捕获全局异常",
  "goal": "实现非破坏性全局错误横幅、错误隔离分级以及非破坏性输入保留",
  "modules": [
    "FeedbackBanner",
    "InputController",
    "ResetController"
  ],
  "normalBehavior": "业务操作抛出可恢复异常时，FeedbackBanner 呈现对应错误提示；输入框内容不被清空；提示区域提供明确文本；错误自动或手动复位",
  "scope": "覆盖 FeedbackBanner 组件渲染、错误代码分级映射（E01/E02/E03/E04）、错误抛出后当前输入框值的保护隔离、以及严重回滚失败下的内存草稿兜底渲染控制",
  "steps": [
    "实现 FeedbackBanner 组件及 showGlobalError/clear 接口",
    "在 InputController 与 ResetController 中接入错误分级上报",
    "验证各错误场景下用户输入文本完整性与零丢失"
  ],
  "verification": [
    "单元测试：触发 E01/E02/E03 错误，验证输入框当前 value 维持不变",
    "容错测试：FeedbackBanner 抛错时不影响主业务流程继续保真数据"
  ]
}


## blk-deliv-acc-full-e2e / acceptance / 端到端全链路高保真场景集成验收标准

Stage=delivery; requirements=["req-debounced-display","req-reset-clear"]; dependencies=["blk-acc-reset","blk-deliv-acc-security-edge"]

1. 端到端常规流验收：打开页面 -> 输入“Project Alpha” -> 等待 300ms -> 大字展示区同步显示“Project Alpha” -> 点击清空按钮 -> 输入框内容清空，大字复位，焦点留在输入框。
2. 端到端中文输入法流验收：聚焦输入框 -> 键入“xiangmu”并进入合成态 -> 大字展示区保持未输入 -> 空格选词完成合成“项目” -> 300ms 后大字展示区正确显示“项目”。
3. 端到端非破坏性输入流验收：输入“Important Project” -> 注入清空异常并点击清空 -> 错误提示横幅亮起 -> 输入框文本“Important Project”完好无损保留 -> 用户可继续编辑并在修正后重新同步。

Task=null


## blk-deliv-val-standalone-runtime / validation / 纯前端独立运行环境、防抖精度与极限拓扑回滚验证任务

Stage=delivery; requirements=["req-lightweight-prototype"]; dependencies=["blk-deliv-acc-full-e2e"]

在交付阶段执行的纯前端单页面独立运行全量测试规范：覆盖 Chromium、Firefox、WebKit 浏览器环境下的静态启动、300ms 防抖精度实测、IME 合成防抖挂起、DOM 节点替换物理隔离、非破坏性输入保留以及极端严重故障下的只读 textarea 兜底挂载全量用例。

Task={
  "assumptions": [
    "测试环境提供现代主流 Web 标准浏览器",
    "自动化测试驱动工具（如 Playwright/Puppeteer）可访问本地静态页面"
  ],
  "completionCriteria": [
    "在真实浏览器环境中完成全链路独立运行验证",
    "产出覆盖所有边界与异常回滚场景的验证报告",
    "验证通过标准与真实测试结果完全一致"
  ],
  "environment": "现代桌面端 Web 浏览器（Chromium 120+, Firefox 120+, Safari 17+）无构建静态本地运行环境",
  "evidenceRequired": [
    "浏览器自动化测试控制台日志",
    "DOM 节点状态与属性快照",
    "防抖定时器执行时间统计数据"
  ],
  "exclusions": "不包含任何依赖后端 API、数据库或外部认证服务的测试用例",
  "failureBehavior": "当某项验证用例失败时，生成详尽的现场 DOM 快照与事件日志，标明未达标环境与具体断言失败点，不伪造测试通过记录",
  "goal": "在无外部服务端、无构建依赖的标准浏览器环境下验证核心流程",
  "modules": [
    "AppController",
    "InputController",
    "ResetController",
    "DebounceScheduler",
    "DisplayPresenter",
    "FeedbackBanner"
  ],
  "normalBehavior": "通过本地文件或静态 HTTP 服务器在 Chrome/Firefox/Safari/Edge 中打开 index.html，全链路端到端功能运行正常，控制台无脚本错误",
  "onFailure": "记录失败用例的输入参数、期望输出与实际 DOM 状态，归档为回归测试缺陷报告，回退至技术实现阶段修复",
  "passCriteria": [
    "所有端到端测试用例通过",
    "无未处理的 JavaScript 异常报错",
    "高频输入与清空操作下内存维持稳定"
  ],
  "scope": "覆盖纯前端独立运行环境验证、防抖时间精度实测、中文输入法（IME）边界、XSS 注入防护、清空事务异常拓扑回滚、以及极端环境下的只读兜底呈现",
  "steps": [
    "启动本地静态页面",
    "执行常规输入与 300ms 防抖端到端测试",
    "执行中文输入法（IME）合成与防抖挂起测试",
    "执行清空按钮交互与焦点保持测试",
    "注入模拟异常验证输入框非破坏性保留与三阶段拓扑回滚",
    "注入极端异常验证只读 textarea 兜底挂载与呈现",
    "收集并输出环境验证测试套件日志"
  ],
  "verification": [
    "全功能端到端自动化测试套件通过率 100%",
    "防抖耗时测量满足 300ms ± 15ms 统计区间",
    "DOM 节点替换无内存泄漏（Detached Elements 计数为 0）"
  ]
}


## blk-tech-module / module / 纯前端单页分层模块架构划分与职责边界

Stage=technical; requirements=["req-lightweight-prototype"]; dependencies=["blk-prod-problem"]

系统划分为 6 个高内聚、弱耦合的客户端模块：
1. AppController：总装配与初始化中枢，管理 DOM 根节点引用、模块装配流水线、生命周期注册与初始化错误捕获。
2. InputController：负责输入框 DOM 事件绑定、解绑、代际闭包状态捕获以及输入四重守卫核验。
3. DebounceScheduler：防抖时间引擎，封装 300ms 计时器、IME 合成状态机与代际有效性判定。
4. ResetController：清空交互事务管理器，主导两阶段提交、DOM 物理替换、快照维护与三阶段拓扑回滚。
5. DisplayPresenter：大字呈现组件，强制通过 textContent 进行纯文本安全渲染，杜绝 XSS 注入风险。
6. FeedbackBanner：全局错误与非破坏性通知横幅，承载错误分级（E01-E04）呈现与降级警示。

Task=null


## blk-tech-interface / interface / 客户端模块核心接口契约与方法签名规范

Stage=technical; requirements=["req-lightweight-prototype"]; dependencies=["blk-tech-module"]

1. InputController:
   - bindInputNode(node: HTMLInputElement, generation: number): void
   - unbindInputNode(node: HTMLInputElement): void // 清理老节点事件监听，防止内存泄漏与幽灵回调
   - getCurrentDraft(): string
   - setDraft(value: string): void
2. DebounceScheduler:
   - schedule(callback: () => void, delayMs?: number): void
   - cancel(): void
   - isPending(): boolean
3. ResetController:
   - executeReset(): Promise<ResetResult> | ResetResult
   - rollback(snapshot: InputSnapshot): void
   - recoveryDraft: string | null // 严重回滚失败时的内存草稿持久引用
   - retryRenderFallbackDraft(): boolean // 严重故障重试挂载兜底展示
4. DisplayPresenter:
   - renderProjectName(name: string): void
   - clear(): void
5. FeedbackBanner:
   - showGlobalError(code: string, message: string): boolean // 内部捕获异常并返回布尔值，不递归抛出
   - clear(): void
6. AppController:
   - init(elements: PageElements): AppControllerContext // 严格在提交当前上下文前完成焦点设置，初始化失败安全解绑所有监听器

Task=null


## blk-prod-target / target / 目标用户与使用场景

Stage=product; requirements=[]; dependencies=[]

面向个人开发者本地独立开发与核对测试场景。用户需要在桌面浏览器中快速核对原型项目名的输入与即时视觉反馈，桌面优先，单人单机使用，无需跨设备同步、无多用户协作与无身份认证。

Task=null


## blk-prod-problem / problem / 项目名称实时验证与轻量原型交互痛点

Stage=product; requirements=["req-lightweight-prototype"]; dependencies=[]

开发者在本地开发与规划阶段需要频繁核验项目名称或标识符的有效性。传统流程依赖命令行脚本或重型后端服务，存在响应反馈不直观、多语言字符（如中文拼音输入法）易产生无效中间态校验、以及界面发生错误时用户已输入文本被破坏丢失的问题。本项目旨在提供一个零依赖、免服务端的纯前端极轻量交互原型，通过单页面实现低时延、防抖反馈与非破坏性错误保留的高保真交互体验。

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


## blk-prod-outcomes / outcomes / 业务与用户体验产出指标目标定义

Stage=product; requirements=["req-lightweight-prototype"]; dependencies=["blk-prod-problem"]

1. 零服务端依赖：纯前端静态单页运行，支持本地 file:// 协议与标准 HTTP 静态服务器直接启动。
2. 防抖体验一致性：输入停止后 300ms 触发大字呈现，主观无卡顿，有效消除高频无效中间渲染。
3. 数据绝对保真：除用户主动点击“清空”成功外，任何页面交互、网络抖动或运行时异常均不会静默丢弃用户已输入的草稿文本。
4. 焦点自然连续：清空操作完成后焦点无缝保持在输入框中，支持用户连续顺畅键入。

Task=null


## blk-page-main-layout / page / 单页面原型主布局结构与 DOM 容器定义

Stage=technical; requirements=["req-lightweight-prototype"]; dependencies=["blk-tech-module"]

单页面采用简洁清晰的居中卡片布局：
1. 顶部 Header：包含页面标题“项目名称验证原型”及状态指示。
2. 交互操作区（Main Input Group）：横向排列标准 input 元素（带有 placeholder、初始 class 与唯一 id）以及“清空”操作按钮（reset-btn）。
3. 实时大字展示区（Display Container）：居中大字排版容器，默认显示“（未输入）”，在输入防抖完成后高亮展示纯文本项目名称。
4. 错误与告警横幅（Feedback Container）：位于输入组与大字展示区之间，默认隐藏（display: none），发生异常时呈现非破坏性提示信息。
5. 故障降级容器（Fallback Container）：保留在 DOM 结构底部，仅在极端严重故障下动态挂载只读多行文本域（textarea）。

Task=null


## blk-feat-input-display / feature / 项目名称输入与 300ms 防抖同步大字展示

Stage=product; requirements=["req-debounced-display"]; dependencies=["blk-prod-problem"]

在单页面中央提供标准单行文本输入框与同步大字展示区。用户连续键入字符时，系统启动 300ms 防抖调度机制；若在 300ms 窗口内继续键入，重新计算倒计时；输入停止满 300ms 后，自动将去除前后空白字符的最新文本以安全纯文本（textContent）形式渲染至大字展示区。支持中文输入法（IME），在拼音合成阶段（compositionstart 至 compositionend）暂停防抖触发，确保合成完成后仅触发一次合规的大字同步。

Task=null


## blk-flow-input-display / flow / 输入事件捕获、IME 合成状态过滤与防抖流转

Stage=product; requirements=["req-debounced-display"]; dependencies=["blk-feat-input-display"]

1. 监听宿主 input 元素的 input、compositionstart、compositionend 事件。
2. 当 compositionstart 触发时，置 isComposing = true，暂停任何防抖计时器的创建与排队。
3. 当 input 事件触发时，若 isComposing 为 true，仅更新当前内存草稿，不排期展示；若 isComposing 为 false，重置并调度 300ms 定时器。
4. 当 compositionend 触发时，置 isComposing = false，并以最终合成文本立即排期 300ms 防抖展示。
5. 300ms 定时器触发时，核验代际与挂载节点有效性，调用 Presenter 安全更新展示区域。

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


## blk-feat-reset / feature / 清空操作两阶段事务、输入物理重置与焦点自聚焦

Stage=product; requirements=["req-reset-clear"]; dependencies=["blk-feat-input-display"]

在输入框右侧提供“清空”按钮。点击后触发清空两阶段提交事务：
1. 准备阶段：捕获当前输入框完整状态快照（value、selectionStart、selectionEnd、generation），在内存中预制全新 input 节点并复制 5 类持久属性（id、className、placeholder、aria-label、type），同时取消防抖定时器。
2. 提交阶段：通过 Element.replaceWith 完成原生 DOM 节点的原子物理替换，重置大字展示区与错误提示，重新建立事件监听并强制聚焦（focus()）新节点。
3. 若在提交过程中发生抛错，立即执行三阶段拓扑回滚，单 DOM 输入框完全保真，不破坏任何用户既有输入。

Task=null


## blk-flow-reset / flow / 清空操作执行时序、拓扑回滚路径与严重故障兜底流转

Stage=product; requirements=["req-reset-clear"]; dependencies=["blk-feat-reset"]

1. 用户点击清空按钮，进入 ResetController.executeReset()。
2. 取消当前正在排期的防抖计时器，避免已清空后收到延迟渲染回调。
3. 快照捕获：创建 Snapshot 记录当前 inputNode、当前文本草稿、光标位置及代际编号。若快照创建失败，立即终止事务，原有节点与防抖不受任何影响。
4. 内存创建新 input 元素，完全克隆 5 项关键属性，设置 value = ''。
5. 物理替换：调用 oldNode.replaceWith(newNode)。
6. 状态重置：DisplayPresenter.clear()，FeedbackBanner.clear()。
7. 重新绑定：InputController.bindInputNode(newNode, newGen)，并调用 newNode.focus()。
8. 异常捕获与拓扑回滚：若第 5-7 步发生异常，执行三阶段回滚：阶段一核验并恢复老节点挂载；阶段二恢复内存草稿并重新绑定事件；阶段三无差别重新调度 300ms 防抖保证展示一致性。
9. 极端兜底：若三阶段回滚依然发生崩溃，进入严重故障分支，内存持久保存草稿，动态挂载只读 textarea 呈现草稿供用户手动复制，并通过 FeedbackBanner 提示错误，不递归抛出全局异常。

Task=null


## blk-acc-reset / acceptance / 清空交互两阶段事务及属性一致性验收标准

Stage=delivery; requirements=["req-reset-clear"]; dependencies=["blk-flow-reset"]

1. 正常清空验收：Given 输入框中有文本且大字展示同步完成；When 用户点击清空按钮；Then 输入框文本变为空，大字展示区复位为“（未输入）”，新 input 节点获得聚焦焦点，且 id、className、placeholder 属性与原节点严格一致。
2. 快速输入与清空并发验收：Given 用户正在输入拼音或防抖倒计时正在进行；When 用户点击清空；Then 倒计时被立即取消，旧输入的防抖回调不再触发大字更新。
3. 拓扑回滚保真验收：Given 模拟 DOM replaceWith 抛出 DOMException；When 点击清空；Then 输入框保持原始节点挂载，原输入文本与光标完全保留，防抖重新排期并恢复展示。

Task=null
