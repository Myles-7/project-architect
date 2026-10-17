# Read-only candidate preview: flash-materials-final-20261005-08

No final content verdict is implied. Control=running; reviewer=task-bc3bd22a-1b27-4f47-8bd8-74fb5aa9536a (running).

Context SHA256=f6ae926c6c435d15af57ec679262fb9511e1ef30386534eea568cf7f0e98334b.

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


## blk-deliv-acc-security-edge / acceptance / 端到端安全防范与极端边界验收规范 Given-When-Then

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
Given 用户输入包含 HTML 预留实体的项目名 `&amp; <test> "quotes" 'single'`
When 停止输入满 300 毫秒防抖触发
Then 展示区忠实显示 `&amp; <test> "quotes" 'single'` 原文，不发生双重转义或截断。

Scenario 4: 运行时错误保护与草稿不丢失
Given 开发者在输入框中录入了重要的待核对项目名草稿
When 触发意外 DOM 操作异常或脚本错误
Then 界面顶部呈现全局轻量容错通知，输入框中的草稿文字完好保留，页面不重载不刷新，开发者可直接复制或继续微调该文本。

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


## blk-deliv-task-input-workflow / task / 交付任务：输入节点闭包绑定、草稿快照防抖调度与安全渲染交付

Stage=delivery; requirements=["blk-feat-input-display","blk-tech-module","blk-tech-interface"]; dependencies=["blk-deliv-task-layout-styling","blk-tech-module","blk-tech-interface"]

实现文本输入框的事件闭包监听、节点代际四重守卫核验、输入草稿快照捕获、DebounceScheduler 纪元防抖调度、IME 组合态闭包管理，以及 Node.textContent 安全展示逻辑，彻底杜绝到期重读 DOM 或执行作废回调，移除确认按钮专属逻辑。

Task={
  "assumptions": [
    "浏览器支持标准 Window 定时器与原生 DOM API，主线程事件循环正常调度",
    "用户使用桌面键盘与输入法进行单人单机本地原型核对"
  ],
  "completionCriteria": [
    "完成 InputController.bindInputNode 与 DebounceScheduler 编码，输入变化等待 300ms 自动展示大字",
    "事件前置四重守卫完整生效，非活跃节点事件直接 return，不误操作新节点",
    "DebounceScheduler 严格接收并使用草稿快照 draftSnapshot，核验 schedulerEpoch 与 targetGeneration",
    "输入法合成期间挂起防抖，选词完成后启动 300ms 倒计时",
    "顶部大字通过 Node.textContent 作为纯文本节点渲染，恶意字符原样回显",
    "展示成功后输入框内容完好保留，方便用户二次编辑微调"
  ],
  "exclusions": "不引入外部第三方防抖库，不使用 innerHTML，不进行网络请求，不绑定确认按钮与回车表单提交专属逻辑，不假称普通 InputEvent 自带应用自增令牌",
  "failureBehavior": "若输入恶意标签字符（如 <script>），严格通过 textContent 作为纯文本节点回显；若遇到空值或纯空格，立即清除旧项目名并恢复占位符，输入框内容原样完好保留；若闭包守卫检测到代际或节点不匹配，立即直接 return，绝不修改新节点状态或制造空值错误",
  "goal": "实现输入框事件闭包绑定、节点代际四重守卫核验、已接受草稿快照捕获、DebounceScheduler 纪元防抖调度、IME 组合态节点级管理及 Node.textContent 安全渲染，移除确认按钮与 Enter 提交专属逻辑",
  "modules": [
    "InputController",
    "DebounceScheduler",
    "DisplayRenderer",
    "ValidatorModule"
  ],
  "normalBehavior": "用户在活跃输入框中键入有效字符，闭包通过 event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node) 守卫，在非合成态下捕获 draftSnapshot，传入 DebounceScheduler.schedule；300ms 到期后核验 thisEpoch === schedulerEpoch && targetGeneration === inputGeneration，针对 draftSnapshot 校验通过后使用 Node.textContent 安全渲染大字，输入框完好保留当前草稿供二次微调；拼音合成期间通过闭包私有 isComposing 挂起防抖；脱离 DOM 的旧节点事件在闭包入口被立即返回丢弃",
  "scope": "InputController.bindInputNode 与四重守卫核验逻辑、DebounceScheduler.schedule(draftSnapshot, targetNode, targetGeneration, callback, delayMs) 调度实现、DisplayRenderer.renderProjectName 纯文本绑定及失败草稿保留",
  "verification": [
    "在输入框输入常规项目名 'Project-Alpha-01' 停止 300ms，核对顶部大字自动即时显示且输入框文本保留",
    "使用中文拼音输入法键入中文，核对拼音输入未确认选词时不发生展示更新，选词上屏后满 300ms 准确展示中文字符",
    "模拟在旧节点输入后触发清空生成新节点，随后向旧节点派发迟到的 compositionend 与 input 事件，核对旧事件被拦截丢弃，新节点 value 保持为空，350ms 后无空值错误且展示区保持占位符",
    "在新节点输入 'Brand-New' 期间向旧节点派发 compositionend，核对新节点防抖定时器未被取消且草稿未被抹除，满 300ms 后大字正常展示 'Brand-New'",
    "在输入框输入 '<img src=x onerror=alert(1)>' 停止 300ms，核对展示区原样输出纯文本标签字符串，无控制台告警或弹窗执行",
    "连续快速键入 10 个字符，核对防抖计时器被正确重置，仅在最终停止 300ms 后触发一次展示更新"
  ]
}


## blk-deliv-task-reset-workflow / task / 交付任务：一键即时清空、输入节点五类持久属性复制与状态事务原子拓扑回滚交付

Stage=delivery; requirements=["blk-feat-reset","blk-tech-module","blk-tech-interface"]; dependencies=["blk-deliv-task-layout-styling","blk-tech-module","blk-tech-interface"]

实现一键即时直接清空、五类持久属性完整复制、瞬态属性重置、输入节点物理替换（replaceWith）、两阶段状态事务提交与失败原子拓扑回滚（彻底移除新节点保真单输入框、原始草稿无差别重调度），彻底隔离旧节点迟到事件。

Task={
  "assumptions": [
    "现代主流桌面浏览器支持标准 DOM 操作方法（replaceWith, replaceChild, remove）与严格模式 IIFE 闭包",
    "用户使用键盘与鼠标进行单人单机本地原型核对，无多标签同步状态诉求"
  ],
  "completionCriteria": [
    "ResetController.handleReset 完整实现两阶段清空状态事务，提交前与回滚后状态严格自洽",
    "持久配置复制安全保留 label 关联、ARIA、tabindex、class/style、data-* 全部 5 类持久属性，单独重置 value 与瞬态校验状态",
    "替换后发生异常时回滚准确移除 replacement 节点并回插原节点，断言文档中有且仅有单一输入框（0 replacement 残留，0 重复 ID）",
    "若发起清空时有排队任务，回滚无差别针对 snapshot.draft 重新调度防抖，空值与纯空格在 300ms 后清除旧展示并展示非空提示，空格原文保留",
    "严重回滚失败在独立只读 textarea 容器中原样呈现原始 draft 供复制，坚决不刷新页面"
  ],
  "exclusions": "不引入模态确认弹窗，不设置二次撤销条，不破坏已批准单按钮极简交互，不使用 innerHTML 渲染草稿",
  "failureBehavior": "若清空流程在准备期、替换过程或后续呈现/清理/聚焦阶段抛错，catch 立即触发原子拓扑回滚：显式移除 replacement 节点并回插原节点，确保 DOM 树中单一输入框且 ID 唯一；还原代际与活跃节点；针对 snapshot.draft（涵盖 empty/whitespace/nonempty）无差别重调度防抖；顶部呈现友好横幅，用户可继续编辑重试；严重回滚失败在只读 textarea 容器中呈现原文供复制，坚决不刷新页面",
  "goal": "实现一键即时直接清空、五类持久属性完整复制、瞬态属性重置、输入节点物理替换（replaceWith）、两阶段状态事务提交与失败原子拓扑回滚（彻底移除新节点保真单输入框、原始草稿无差别重调度），彻底隔离旧节点迟到事件",
  "modules": [
    "ResetController",
    "InputController",
    "DebounceScheduler",
    "DisplayRenderer",
    "FeedbackBanner"
  ],
  "normalBehavior": "点击清空捕获包含原节点、代际、纪元、草稿与 DOM 位置的快照；在内存实例化新节点并复制 5 类持久属性，绑定新闭包；取消防抖调度并执行 oldNode.replaceWith(newNode)；复位展示区为占位符并清除错误；新节点获取焦点；原子提交更新 activeInputNode 与 inputGeneration；旧节点迟到事件被入口守卫拦截丢弃",
  "scope": "ResetController 模块实现，包含两阶段提交、持久配置复制、DOM 拓扑回插与新节点清理、snapshot.draft 无差别重调度、以及 FeedbackBanner 联动",
  "verification": [
    "在输入框含有项目名时点击清空，核对展示区立即显示占位符，输入框被替换且内容为空，焦点自动移入新输入框，无二次确认弹窗",
    "查验清空替换后新输入框的 id, name, aria-label, aria-describedby, aria-required, tabindex, class, style, data-test 完好保留，value 严格为空且无 aria-invalid 属性",
    "在创建新节点或属性复制阶段注入异常，验证 catch 触发回滚，activeInputNode 仍为原节点，代际未增，草稿与焦点保留",
    "在 replaceWith 成功后注入 renderPlaceholder 异常，验证 rollback 显式移除 newNode 并回插 oldNode，断言 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留，草稿完好且获得焦点",
    "在输入三个空格产生防抖任务后清空并注入 replaceWith 失败，验证回滚后重新调度 300ms 任务，满 300ms 后展示区旧项目名被清除并恢复占位符，输入框下方出现红色非空提示，三个空格完好保留",
    "注入严重回插失败，验证页面未发生刷新（window.location.reload 未被调用），界面在只读 textarea 容器中原样呈现原始 draft 供复制"
  ]
}


## blk-deliv-task-error-handling / task / 交付任务：防抖校验拦截、就地提示、旧结果清除、清空事务拓扑回滚与只读草稿复制容错交付

Stage=delivery; requirements=["blk-tech-error","blk-feat-reset"]; dependencies=["blk-deliv-task-input-workflow","blk-deliv-task-reset-workflow","blk-tech-error"]

实现空值/纯空格校验拦截、旧结果彻底清除、输入保留、清空事务三阶段异常原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）、以及严重失败独立只读草稿复制兜底容器呈现。

Task={
  "assumptions": [
    "遵循 DOM 规范与严格异常处理原则，输入框下方预留就地错误展示节点容器",
    "单页面本地轻量运行，无服务端接口抛错干扰"
  ],
  "completionCriteria": [
    "ValidatorModule 正确校验空值与纯空格，防抖回调触发时立即清除已展示的旧项目名并恢复占位符，就地红色提示醒目显示，原始输入（含空格）完好保留",
    "FeedbackBanner 具备 showInputError、clearInputError、showGlobalError 与 showSevereFallbackDraft 完整实现",
    "清空流程三阶段异常均被捕获并原子回滚，显式移除 replacement 节点，DOM 树中有且仅有单一输入框，草稿无差别重调度有效工作",
    "严重回滚失败在独立只读 textarea 容器中呈现原始草稿，禁止全局刷新"
  ],
  "exclusions": "不使用模态弹窗，不静默降低输入保留标准，不使用刷新页面掩盖严重失败，不依赖系统剪贴板异步写入权限",
  "failureBehavior": "清空各阶段失败触发拓扑回滚，清除新节点并回插原节点，恢复原草稿并无差别重新调度；若回插严重失败，在只读 textarea 中原样呈现原始 draft 供复制，提示诚实说明未恢复，禁止刷新页面",
  "goal": "实现防抖校验拦截、就地提示、旧结果清除、清空事务拓扑回滚与只读草稿复制容错交付",
  "modules": [
    "ValidatorModule",
    "FeedbackBanner",
    "ResetController",
    "DisplayRenderer"
  ],
  "normalBehavior": "300ms 到期后校验：有效字符通过 Node.textContent 安全渲染；空值或纯空格清除旧展示恢复灰色占位，就地红字提示，空格保留；清空回滚时按原草稿重调度，空值/纯空格同样在 300ms 后清除旧展示并出红字警示",
  "scope": "ValidatorModule 纯函数、FeedbackBanner 就地提示与全局横幅、只读 textarea 兜底容器装配、与 ResetController 回滚协同",
  "verification": [
    "先录入有效项目名并等待展示成功，随后将输入文字全部删空停止 300ms，验证旧项目名被清除，展示区恢复占位符，就地呈现红色提示且输入保持空值可编辑",
    "在输入框中输入三个半角空格停止 300ms，验证旧项目名被清除并恢复占位符，就地显示红色提示，三个空格完好保留且输入框保持焦点",
    "在清空替换后步骤注入异常，验证错误被捕获，replacement 节点被彻底移除，页面仅保留 1 个输入框且原草稿完好",
    "在纯空格输入调度期间清空并注入失败，验证回滚后重新调度 300ms 任务，到期清除旧展示并展示错误提示，空格保留",
    "注入严重回插失败，验证页面未被重新加载，只读草稿容器安全呈现原文供手动复制"
  ]
}


## blk-deliv-acc-full-e2e / acceptance / 端到端集成验收规范：防抖实时核对、节点替换隔离、事务拓扑回滚与只读草稿复制 Given-When-Then

Stage=delivery; requirements=["blk-feat-input-display","blk-feat-reset","blk-tech-error","blk-prod-outcomes"]; dependencies=["blk-deliv-task-package"]

Scenario 1: 正常实时输入 300ms 防抖大字呈现与草稿保留
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

Scenario 4: 清空替换后后续步骤抛错回滚与 DOM 单输入框拓扑保真（R6-B1 验证）
Given 输入框内存在草稿 'Critical Test Draft'，展示区呈现 'Critical Test Draft'
When 点击清空按钮，新节点已通过 replaceWith 挂入 DOM 树，但后续 renderPlaceholder 或 clearInputError 抛出异常
Then catch 块执行 rollback，显式移除已挂入文档树的 replacement 节点并回插原节点，查验 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，DOM 中无残留 replacement 节点；activeInputNode 重新指向原节点，代际还原，原草稿 'Critical Test Draft' 完整保留并保持焦点。

Scenario 5: 空值与纯空格待校验任务清空遇回滚后无差别重新调度（R6-B2 验证）
Given 页面展示区正呈现旧项目名 'Old Title'
When 用户输入三个空格 '   '（或删空文本）并发起 input 调度，在 300ms 定时器未到期前点击清空按钮，且清空流程注入 replaceWith 失败触发回滚
Then rollback 捕获快照并检测到 hadPendingTimer 为 true，无条件针对原纯空格草稿 '   '（或删空草稿 ''）重新调度 300ms 防抖任务；满 300 毫秒后定时器正常唤醒并执行校验，展示区已显示的旧项目名 'Old Title' 立即被清除并恢复为灰色占位文字 '【等待输入核对】'，输入框正下方呈现红色非空警示 '项目名不能为空，请输入有效字符'，输入框内三个半角空格完好保留，旧展示不持久残留。

Scenario 6: 事务回滚成功后用户继续键入、手动删空与幂等清空重试
Given 经历清空失败回滚后，界面恢复原节点 oldNode，草稿为 'Draft Recovered'
When 开发者在输入框中继续键入 'Edited after failure' 并停止 300 毫秒
Then 顶部展示区正常通过 Node.textContent 安全更新为 'Edited after failure'；若随后用户手动删空停止 300 毫秒，旧结果被清除并显示红色错误提示；若再次点击清空按钮，清空流程成功流转，新输入框被挂载，DOM 树中有且仅有 1 个输入框，无重复事件监听。

Scenario 7: 成功清空后旧节点迟到 compositionend、input 与旧 timer 回调安全隔离
Given 用户在 oldNode 中启动拼音输入法合成后点击清空，事务成功提交生成 newNode
When 浏览器向脱离 DOM 的 oldNode 派发迟到的 compositionend 事件与 input 事件，且 oldNode 排队的旧防抖 timer 回调唤醒
Then oldNode 闭包核验 node !== activeInputNode 且 bornGeneration !== inputGeneration 立即直接 return，旧 timer 守卫核验 thisEpoch !== schedulerEpoch 立即退出；newNode 的 value 保持为空，顶部展示区保持占位提示，等待 350ms 后无空值错误，控制台 0 报错。

Scenario 8: 替换后严重回滚失败之只读草稿复制兜底
Given 输入框存在重要测试草稿 'Important Draft With\nMultiple Lines   and Spaces'
When 点击清空按钮，replaceWith 执行后抛出异常，且在回插原节点时再次发生严重 DOMException 导致回滚中断
Then 系统捕获严重异常，界面绝不执行 window.location.reload() 刷新页面，界面顶部横幅明确提示 '清空与回滚操作遇到严重异常，主编辑器暂时受限，已为您在下方安全保留草稿'，并在独立只读草稿容器（readonly textarea）中原样呈现原始 draft 文本，包含换行与空格逐字符完全一致，允许用户手动选中文本执行复制取回。

Scenario 9: 恶意脚本纯文本安全回显验收
Given 开发者在输入框中录入 `<script>alert('XSS')</script><img src=x onerror=alert(1)>` 并停止满 300 毫秒
Then 顶部展示区忠实将上述字符完整作为纯文本安全显示，DOM 树中展示区子节点仅包含纯 Text 节点，无 HTML 元素被创建，无控制台报错或弹窗执行。

Task=null


## blk-deliv-val-standalone-runtime / validation / 交付前置验证任务：本地双击直接运行与多浏览器兼容性实测（原生IME事件与事务拓扑回滚）

Stage=delivery; requirements=["blk-tech-deployment","blk-deliv-spec-deployment"]; dependencies=["blk-deliv-task-package"]

在真实宿主环境验证本地单页面直接双击（file:// 协议）与静态 HTTP 服务模式的可用性，在 Chrome, Edge, Firefox, Safari 主流桌面浏览器实测原生 IME 输入法事件流转、清空事务两阶段提交与替换后各类抛错时的原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）及严重回滚失败只读草稿复制兜底。

Task={
  "assumptions": [
    "目标应用产物 index.html, styles.css, app.js, README.md 已开发就绪且处于同一目录",
    "宿主设备具备桌面图形环境与现代主流浏览器（Chrome, Edge, Firefox, Safari），支持物理键盘与原生中文 IME 输入法"
  ],
  "completionCriteria": [
    "主流桌面浏览器在 file:// 协议与 http://localhost:8080 模式下正常运行，0 报错",
    "实测原生 IME 输入法在合成态下清空，旧事件被安全拦截，不污染新节点，不产生空值报错",
    "实测清空各阶段异常注入均触发原子拓扑回滚，DOM 树中有且仅有单一输入框（0 replacement 残留，0 重复 ID），原草稿与焦点完好恢复",
    "实测空值与纯空格草稿在回滚后无差别重新调度，300ms 后忠实清除旧展示并展示错误提示，空格原文保留",
    "实测严重回滚失败在只读 textarea 中原样呈现草稿供手动复制，未发生页面刷新",
    "在规划期受控试验环境不可用时如实标记为 unexecuted，所有实测结论由真实浏览器测试日志背书"
  ],
  "environment": "桌面 PC 宿主机（Windows 10/11, macOS 12+, Linux），主流现代桌面浏览器稳定版（Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15），真实原生操作系统中文拼音输入法引擎；规划期环境因宿主工具 Docker 不可用且目标产物未实现，实测如实标为 unexecuted，留待 Delivery 实施阶段执行",
  "evidenceRequired": [
    "各浏览器控制台执行输出日志、DOM 树节点数量与 ID 唯一性断言记录（document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留）、空值/纯空格任务 300ms 调度与提示呈现日志、原生 IME 输入法在合成态下触发清空后的迟到事件派发与拦截流转日志、以及只读草稿文本复制验证记录"
  ],
  "exclusions": "不冒充规划阶段已经实测通过，不把合成 DOM 测试宣称为真实浏览器测试，不把 Docker/Chromium 宿主不可用写成项目约束",
  "failureBehavior": "若在多浏览器实测中发现某浏览器在 replaceWith 抛错时未清理 replacement 节点、空值待任务未重新调度、或原生 IME 将迟到事件重定向至新节点，立即报告失败，排查并优化 ResetController 事务状态机与事件监听策略后复测",
  "goal": "在真实宿主环境验证本地单页面直接双击（file:// 协议）与静态 HTTP 服务模式的可用性，在 Chrome, Edge, Firefox, Safari 主流桌面浏览器实测原生 IME 输入法事件流转、清空事务两阶段提交与替换后各类抛错时的原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）及严重回滚失败只读草稿复制兜底",
  "modules": [
    "AppController",
    "InputController",
    "ResetController",
    "DebounceScheduler",
    "DisplayRenderer",
    "FeedbackBanner"
  ],
  "normalBehavior": "双击 index.html 正常打开无报错；原生中文输入法合成期间不触发防抖，选词上屏后 300ms 展示；清空事务正常提交时旧节点迟到事件被隔离拦截；清空事务在替换前、替换中、替换后任意环节注入异常时，均原子回滚恢复单一原节点（0 replacement 残留、0 重复 ID），还原代际，针对 snapshot.draft 重新调度防抖，空值与纯空格在 300ms 后忠实清除旧展示并显警示；用户可继续键入 'Edited after failure' 正常大字呈现；严重回滚失败在只读 textarea 中原样呈现草稿供手动复制，禁止刷新",
  "onFailure": "阻断交付验收，记录浏览器版本与异常事件日志，修复拓扑回滚或草稿重调度逻辑后全量回归",
  "passCriteria": [
    "file:// 协议与 http://localhost:8080 下主流浏览器（Chrome, Edge, Firefox, Safari）正常渲染无控制台错误；",
    "原生 IME 输入法合成期间防抖挂起，选词上屏后 300ms 正常大字呈现；",
    "清空替换后旧节点迟到事件不污染新节点，不修改新会话，不制造空值错误；",
    "清空事务在替换前、替换中、替换后抛错回滚后，DOM 中有且仅有 1 个 input 节点（document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留），原节点处于聚焦态；",
    "空值与纯空格草稿在回滚后无差别重新调度，300ms 后清除旧展示并呈现非空警示，空格原文保留；",
    "回滚后用户键入 'Edited after failure' 正常流转 300ms 防抖更新，再清空依然为单输入框；",
    "严重回滚失败在独立只读 textarea 中原样呈现草稿，包含换行与空格，支持手动选中复制，无页面刷新。"
  ],
  "scope": "覆盖 Windows 10/11、macOS 12+ 宿主机，在 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15 下实测 file:// 启动、8080 端口静态服务托管、原生 IME 输入法在合成态清空后的事件派发与拦截、清空事务在准备期、replaceWith 过程、替换后步骤抛错时的原子拓扑回滚断言（单 input、0 重复 ID、无 replacement 残留）、空值/纯空格任务重调度断言、以及严重失败只读草稿复制验证",
  "steps": [
    "1. 在 Windows 宿主机上分别启动 Google Chrome、Microsoft Edge 与 Mozilla Firefox 最新稳定版，直接双击打开 index.html（file:// 协议加载），检查控制台无 CORS 错误与资源加载报错；同时启动 python -m http.server 8080 与 npx serve . --listen 8080，访问 http://localhost:8080 验证两启动模式表现完全一致；",
    "2. 在输入框中使用原生拼音输入法输入中文，验证拼音合成期间展示区不更新，选词上屏后满 300ms 正常大字呈现；在合成态期间点击清空，验证新节点 value 保持为空，旧节点迟到事件被丢弃，350ms 后无空值错误；",
    "3. 在输入框录入 'Alpha'，点击清空并在创建新节点阶段注入异常，验证 catch 触发回滚，activeInputNode 仍为原节点，代际未增，草稿与焦点保留；",
    "4. 在输入框录入 'Beta'，点击清空并在 replaceWith 成功后注入 renderPlaceholder 异常，执行断言：document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，验证已挂载的新节点被彻底移除，原节点原位插回，原草稿完好且保持焦点；",
    "5. 在输入框输入三个半角空格 '   '（或删空文本）并发起 input 调度，在 300ms 定时器未到期前点击清空且注入 replaceWith 失败触发回滚，验证回滚后重新调度 300ms 任务，满 300ms 后展示区旧项目名被清除并恢复占位符，输入框下方出现红色非空提示，三个空格完好保留；",
    "6. 验证回滚后用户继续键入 'Edited after failure' 正常更新大字，手动删空正常提示，再次清空正常流转且依然保持单输入框；",
    "7. 注入严重回插失败，验证页面未被重新加载（window.location.reload 未被调用），界面在只读 textarea 容器中原样呈现原始 draft 供复制。"
  ],
  "verification": [
    "检查在各浏览器中双击 index.html 均正常启动无报错",
    "在控制台执行 DOM 拓扑断言：document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1",
    "注入各阶段清空异常，验证单 input 拓扑、草稿无差别重调度、以及严重失败只读复制兜底",
    "输出包含操作系统、浏览器版本、IME 引擎及实测结果的跨平台兼容性报告"
  ]
}


## blk-prod-target / target / 目标用户与使用场景

Stage=product; requirements=[]; dependencies=[]

面向个人开发者本地独立开发与核对测试场景。用户需要在桌面浏览器中快速核对原型项目名的输入与即时视觉反馈，桌面优先，单人单机使用，无需跨设备同步、无多用户协作与无身份认证。

Task=null


## blk-prod-problem / problem / 核心问题与痛点分析

Stage=product; requirements=[]; dependencies=["blk-prod-target"]

解决个人开发者在本地进行轻量原型验证时缺乏即时、低干扰核对界面的问题。痛点包括：常规测试页面常依赖网络请求或复杂脚手架，难以进行秒级纯客户端反馈；在空值或异常提交时若缺乏提示或粗暴清空用户输入，会导致重复录入测试数据，严重降低核对效率。

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

Stage=product; requirements=[]; dependencies=["blk-prod-problem"]

1. 实时核对成效：输入项目名每次发生变化后，等待 300ms 防抖计时到期后自动将该名称以高对比大字呈现在顶部展示区，无需手动点击确认按钮；支持中文拼音输入法合成态（IME isComposing）节点闭包隔离，选词上屏后触发 300ms 防抖更新；若合成期间点击清空，系统采用“清空时替换输入节点＋节点代际闭包隔离”机制，递增代际 inputGeneration 并替换活跃 DOM 节点，使旧节点迟到的 compositionend 与尾随 input 事件因代际与节点引用失效被直接丢弃，绝不污染新节点，不产生旧文本回显或制造空值报错；新节点真实输入（键入、粘贴、新合成）顺畅流转 300ms 防抖。
2. 清空即时取消与复位：点击清空按钮时立即取消所有待执行的 300ms 防抖任务（递增 schedulerEpoch 使队列任务失效），即时清除顶部展示区与输入框内容，光标自动回焦新输入框，无二次确认弹窗或撤销延迟。
3. 健壮防错与空值清除旧结果：空值或纯空白字符输入经 300ms 防抖后产生明确就地可见警示，且立即清除已展示的旧项目名并恢复占位符；输入框既有字符（含空格）严格保留，异常或未知错误时不破坏界面状态、不抹除输入。
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
     * 采样端点：从清空按钮 click 事件触发打点 t_click 至 DOM 重置后 requestAnimationFrame 回调执行打点 t_raf（明确为清空处理与重绘前调度的代理指标，不冒充物理可见绘制完成）；
     * 采样次数：测试 5 轮清空重置；
     * 判定边界：5 轮实测均值 ≤ 50ms。

Task=null


## blk-page-main-layout / page / 页面职责与参考图空间结构映射（节点物理替换、五类持久属性与事务拓扑回滚）

Stage=product; requirements=["blk-prod-scope"]; dependencies=["blk-prod-scope"]

本地单页面原型核对视图（Single Page View），基于 fixture.png 原生像素结构并在删除确认按钮后映射布局，并规范节点物理替换与清空事务异常回滚时的页面保真：
1. 视觉底色：纯白底色（#FFFFFF）清爽背景，无多余装饰纹理；
2. 顶部展示区域：映射 fixture.png 上方“Q7M4-8261”视觉层级与相对空间位置，作为核对结果大字展示区（初始显示灰色占位文字，300ms 防抖完成后以高对比黑色大字显示，支持 word-break: break-all 换行防撑破）；
3. 底部操作区域：依据已批准决策彻底移除原 fixture.png 左下蓝色矩形色块（确认按钮已删除），仅保留映射右下方橙色圆形色块的橙色实心圆形【清空】操作按钮（底色 #FF5500）；
4. 输入表单区域：在桌面端位于展示区与底部清空按钮区之间居中排布，提供单行文本输入框；在清空触发输入框节点替换（replaceWith）时，采用持久配置复制策略严格保持 5 类配置：1. label 关联（id, name）；2. ARIA 属性（aria-label, aria-describedby, aria-required 等全部 ARIA 属性）；3. tabindex 键盘导航；4. 表现样式（class 类名与 style 内联样式）；5. 自定义测试属性（data-* 属性）完全不变，仅重置 value 与瞬态校验状态 aria-invalid，避免界面发生跳动或焦点迷失；
5. 清空事务异常回滚视角（Transactional Rollback Fidelity，R6-B1 与 R6-B2）：
   - 当清空重置在准备、节点替换、展示复位、错误清理或焦点恢复任意阶段抛出异常时，视图层通过原节点的 DOM 物理回插并彻底移除已挂载的新节点，严格保证 DOM 树中有且仅有单一输入框（单一 input 元素、唯一 project-name-input ID），绝不出现两个同 ID 输入框或孤儿输入节点；
   - 界面几何布局 0 偏移，输入框保持聚焦，原输入草稿完整呈现，输入框不闪烁不跳动；
   - 无论原草稿是非空、空字符串还是纯空格，若发起清空时有待校验任务，视图层在 300ms 后忠实呈现对应校验结果，旧项目名展示不持久残留，纯空格文本原样保留；
   - 顶部动态浮现轻量容错通知横幅，明确告知用户异常并确认状态已完整保留；
   - 若回滚本身发生异常，页面就地在通知横幅中展开独立只读草稿容器（只读 textarea）供手动选中复制，逐字符保留包括换行和空白的草稿文本，坚决不执行全局页面刷新；
6. 状态全覆盖：涵盖就绪初始态（占位灰字）、防抖等待态（草稿输入中/IME选词中）、清空替换就绪态（新输入框已就绪回焦，旧节点解耦移出）、正常核对态（大字黑色显示）、错误提示态（红字就地显示）、异常防护态（顶部横幅警示）、清空事务回滚就绪态（原节点/草稿还原并可继续编辑）、只读草稿复制兜底态与纯离线本地加载态。

Task=null


## blk-feat-input-display / feature / 功能特性：输入 300ms 防抖实时反馈、节点代际闭包隔离与草稿快照契约

Stage=product; requirements=["blk-prod-scope","blk-prod-outcomes"]; dependencies=["blk-prod-scope"]

支持在桌面端输入框中录入项目名文本，采用 300ms 防抖实时反馈机制替代确认按钮，并建立严密的“输入节点生命周期＋节点代际闭包隔离＋草稿快照调度”契约：
- 节点代际与闭包绑定规则：
  * 系统维护全局当前活跃输入框节点 activeInputNode 与单调递增的代际计数 inputGeneration（初始为 1）；
  * 每个输入节点在创建与绑定事件时，闭包深度捕获当前节点引用 node 与诞生代际 bornGeneration，并在闭包内维护私有的组合输入状态 isComposing（初始 false）与受信任草稿 trustedDraft（初始 ''）；
  * 任何 input、beforeinput、compositionstart、compositionend 事件回调在执行任何状态变更或调度前，必须严格核验：event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)；若核验不通过，判定该事件来自非活跃节点或已作废旧代际，立即直接 return 丢弃，不得改写当前活跃节点、不得修改新会话状态、不得取消或覆盖新定时器；不宣称普通 InputEvent 自带应用会话令牌。
- 正常输入与草稿快照调度：
  * 用户在活跃输入框中键入字符，通过守卫核验且非输入法合成状态（!isComposing && !e.isComposing）时，系统读取当前 node.value 存入 trustedDraft；
  * 触发 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, callback, 300)，将当前已接受草稿快照、节点引用与代际一并传入；调度器记录本次独立纪元 schedulerEpoch 并启动 300ms 倒计时；
  * 定时器到期时，首先核验当前纪元与代际是否依然有效；若有效则仅针对传入的草稿快照 draftSnapshot 执行 trim() 校验与 Node.textContent 安全渲染，彻底避免到期重新读取可能已被异常事件篡改的 DOM value；输入框既有文本完好保留供后续微调。
- 中文输入法（IME）合成态管理：
  * 在当前活跃节点触发 compositionstart 时，闭包内置 isComposing 为 true，并调用 DebounceScheduler.cancel() 取消排队中的旧防抖任务；
  * 在 compositionstart 至 compositionend 期间，防抖计时挂起，不触发中间草稿校验；
  * 选词上屏触发 compositionend 时，闭包内置 isComposing 为 false，读取 node.value 存入 trustedDraft 并调用 schedule(trustedDraft, node, bornGeneration, callback, 300)；
  * 组合输入状态严格归属于节点闭包，旧节点的 compositionend 永远无法修改新节点的 isComposing 状态。
- 清空与尾随事件隔离行为：
  * 用户点击清空按钮时，系统立即执行清空操作：递增 inputGeneration，取消防抖调度并使 schedulerEpoch 失效，创建全新 input 节点替换旧节点（oldNode.replaceWith(newNode)），在新节点闭包中初始化 bornGeneration 与全新 isComposing，清空展示区为占位符并回焦新节点；
  * 旧节点的任何迟到 compositionend、beforeinput 或尾随 input 事件只能到达旧节点绑定的闭包函数，由于 node !== activeInputNode 且 bornGeneration !== inputGeneration 被第一道前置守卫直接丢弃返回，绝不接触 activeInputNode，绝不制造空值错误，也无需额外按键解锁；
  * 新节点的物理键入、粘贴或新发起的中文拼音输入均直接在新闭包与新代际中正常流转 300ms 防抖。
- 空值与纯空格输入彻底清除旧结果：当用户手动将输入文本全部删空或输入纯空白字符（空格、制表符）且停止 300ms 时，防抖回调针对快照判定校验失败，展示区已显示的旧项目名立即被清除并恢复为初始灰色占位文字“【等待输入核对】”，在输入框正下方就地显示红色警示“项目名不能为空，请输入有效字符”；输入框内的既有字符（包括空格）原样完好保留。
- 待验证状态与环境差异说明：桌面端 Chrome、Edge、Firefox 与 Safari 在原生 IME 输入下替换 DOM 节点的具体事件派发与会话生命周期行为属于开发阶段真机实测用例，不作彻底杜绝所有原生竞态的无证据绝对承诺。

Task=null


## blk-flow-input-display / flow / 交互流程：输入事件闭包守卫、快照防抖调度与节点代际流转

Stage=product; requirements=["blk-feat-input-display"]; dependencies=["blk-feat-input-display"]

1. 用户光标聚焦在当前活跃输入框（activeInputNode）准备键入或编辑文本。
2. 事件感知与闭包前置校验：
   - 当捕获到 input、beforeinput、compositionstart、compositionend 等任何事件时，闭包首先执行有效性判定：
     if (e.currentTarget !== node || node !== activeInputNode || bornGeneration !== inputGeneration || !document.body.contains(node)) return;
   - 若不匹配（如属于已被清空替换的旧节点事件）：立即静默返回，不进行任何 DOM 操作、状态变更或定时器调度。
3. 组合输入（IME）分支流转：
   - 触发 compositionstart：闭包内置 isComposing = true，调用 DebounceScheduler.cancel() 取消排队中的旧防抖任务并使旧调度纪元失效；
   - 合成期间触发 input：核验 isComposing === true，忽略防抖调度，挂起等待；
   - 选词上屏触发 compositionend：闭包内置 isComposing = false，读取 node.value 存入 trustedDraft，调用 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, handleDebouncedValidateAndDisplay, 300)。
4. 普通输入分支流转：
   - 触发原生 input 事件（且 !isComposing && !e.isComposing）：读取当前 node.value 存入 trustedDraft，调用 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, handleDebouncedValidateAndDisplay, 300)。
5. 防抖调度与快照绑定：
   - DebounceScheduler.schedule 内部递增 schedulerEpoch 产生本次唯一的 thisEpoch，并启动 300ms setTimeout；
   - 若在 300ms 倒计时期间收到新输入，旧任务被自动销毁并以新纪元重新倒计时；
   - 若在 300ms 倒计时期间用户点击清空按钮，清空逻辑立即执行 DebounceScheduler.cancel()（递增 schedulerEpoch 废弃任务），递增 inputGeneration 并替换 DOM 节点，倒计时逻辑在到期后因纪元不匹配被无害丢弃。
6. 定时器唤醒与快照校验执行：
   - 300ms 定时器到期唤醒时，首先执行三重守卫：
     if (thisEpoch !== schedulerEpoch || targetGeneration !== inputGeneration || targetNode !== activeInputNode || !document.body.contains(targetNode)) return;
   - 守卫通过后，针对传入的 draftSnapshot 执行校验（不重新读取 targetNode.value）：
     * 分支 A（空值或纯空白字符）：清除顶部展示区已显示的旧项目名，展示区恢复为初始灰色占位符“【等待输入核对】”，在输入框正下方挂载红色错误提示“项目名不能为空，请输入有效字符”，输入框边框变红并保持焦点；输入框已输入的字符（含空格）原样完好保留；
     * 分支 B（有效非空字符）：移除旧错误提示与高亮，通过 Node.textContent 将 draftSnapshot 安全更新到顶部展示区，输入框完好保留当前文本供后续微调。
7. 异常防护：若 DOM 操作抛出异常，顶层 try-catch 捕获并在界面顶部以警示条显示，输入框文本完好保留供用户修改恢复。

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

Stage=product; requirements=["blk-prod-scope","blk-prod-outcomes"]; dependencies=["blk-prod-scope"]

提供一键即时清空与重置功能，帮助用户在完成一轮项目名核对后快速复位界面，通过“清空状态事务＋节点物理替换＋持久配置复制＋失败原子回滚”实现物理级事件解耦、防抖取消、属性保真与失败输入保留：
1. 清空状态事务与提交点契约：
   - 捕获恢复快照（ResetTransactionSnapshot）：用户点击底部橙色清空按钮时，第一优先级捕获当前活跃输入节点 activeInputNode、全局代际 inputGeneration、调度纪元 schedulerEpoch、待执行定时器状态（pendingTimerId、hadPendingTimer）、当前原始草稿 draft（无论非空、空字符串或纯空格）、展示区文本、错误提示以及原节点在 DOM 树中的父节点与相邻兄弟节点位置；
   - 两阶段事务提交（Two-Phase Commit）：在内存预制新节点并安全复制 5 类持久属性，完成事件绑定、取消旧定时器、执行 replaceWith 物理替换、展示区占位复位、错误清除以及 focus 聚焦全部成功后，正式原子提交更新全局 activeInputNode 与 inputGeneration；
   - 失败原子回滚与 DOM 单输入框拓扑保真（R6-B1 修复）：若在准备期（创建/属性复制/事件绑定）、replaceWith 物理替换过程、或替换后展示复位、错误清理、焦点恢复任意阶段抛出异常，立即触发 rollback；显式识别 replacement 节点 newNode：若 newNode 已插入 DOM 树，通过 newNode.parentNode.replaceChild(oldNode, newNode) 物理回插原节点并彻底移除 newNode，或者 newNode.remove() 并在原 parentNode 与 nextSibling 原位插回 oldNode，绝不在 DOM 树中遗留已挂载的 newNode，彻底消除双输入框与同 ID（project-name-input）冲突，确保文档中始终只有单一合法输入框；全局 activeInputNode 与 inputGeneration 严格还原为原节点与原代际，调度纪元单调自增（schedulerEpoch++）以彻底作废旧定时器；
   - 原始草稿无差别重调度（R6-B2 修复）：若清空前存在尚未完成的防抖任务（hadPendingTimer === true），回滚时必须针对原始草稿快照 snapshot.draft（无论非空项目名、空字符串 ''、纯空格 '   '）以全新纪元重新调度防抖校验任务；严禁用 draft.trim().length > 0 等条件跳过空值/纯空格任务；对于删空或纯空格草稿，重新调度后满 300ms 触发校验，严格按原规则清除旧展示并展示红色非空警示，确保旧展示不永久残留，且纯空格文本原样保留；oldNode 闭包的 bornGeneration 与还原后的 inputGeneration 完全自洽，用户可立即继续输入、手动删空或重试清空；
   - 严重回滚失败只读复制兜底：若回滚本身发生 DOM 异常，定义诚实的恢复失败状态：不声称“完整恢复”，坚决禁止刷新页面（禁止 window.location.reload()），不把空输入当作已恢复；在独立只读草稿容器（如 readonly textarea）中原样呈现原始草稿（逐字符保留换行与空格），供用户手动选中复制；提示诚实说明主编辑器未能自动恢复，草稿已在只读文本区中安全保留。
2. 持久配置复制策略与瞬态状态重置：
   - 创建全新 input 元素并完整保留 5 类持久配置：1. label 关联属性（id, name）；2. ARIA 无障碍属性（aria-label, aria-describedby, aria-required 等全部持久 ARIA 配置）；3. 键盘导航属性（tabindex）；4. 表现样式属性（class 类名与 style 内联样式）；5. 测试与自定义属性（data-* 属性，如 data-test）；
   - 单独重置瞬态与编辑状态：重置 value = ''、trustedDraft = ''，显式过滤并移除瞬态校验属性 aria-invalid 与错误高亮；
   - 为新节点闭包绑定全新代际（nextGeneration = inputGeneration + 1）、专属 isComposing=false 与 trustedDraft=''。
3. 旧节点迟到事件隔离保护：
   - 事务成功提交后，输入法引擎或浏览器事件循环派发发往旧节点的迟到 compositionend、beforeinput 或尾随 input 事件，在进入旧闭包时因 node !== activeInputNode 以及 bornGeneration !== inputGeneration 被入口守卫直接拦截返回，完全无法触碰 activeInputNode，绝不将旧文字写回新输入框、绝不修改新组合状态、绝不误报空值错误；
   - 不把强制重写新 DOM value 作为拒绝旧事件手段，旧节点与其私有状态随 GC 自然回收。
4. 新真实输入无障碍流转：
   - 无论事务成功提交还是回滚恢复，当前活跃输入框均处于 DOM 活跃状态与焦点态，敲击物理按键、粘贴文本或启动新拼音合成均在新/原闭包与有效代际中正常监听，顺畅流转 300ms 防抖调度，无需额外按键解锁；清空具备绝对抢占优先级与幂等性。

Task=null


## blk-flow-reset / flow / 交互流程：一键即时清空、节点替换与事务拓扑回滚（单DOM恢复与无差别任务重调度）

Stage=product; requirements=["blk-feat-reset"]; dependencies=["blk-feat-reset"]

1. 用户点击底部橙色圆形清空按钮（resetButton）。
2. 执行 ResetController.handleReset() 核心两阶段状态事务流程：
   阶段一：捕获恢复快照（Snapshot Capture）：
   - 调用 ResetController.captureSnapshot() 记录 pre-reset 状态快照：
     * activeInputNode 引用、当前 inputGeneration、schedulerEpoch；
     * 定时器状态（pendingTimerId 是否存在，记录 hadPendingTimer 及原始草稿文本 draft，涵盖非空文本、空字符串与纯空格）；
     * 顶部展示区当前内容 displayContent；
     * 校验错误容器内容 errorContent、样式 display 与输入框错误类名、aria-invalid；
     * 原输入节点在 DOM 树中的 parentNode 及 nextSibling 位置引用。
   阶段二：事务准备与执行（Execution Phase，处于 try 块保护中）：
   - a. 计算下一代际编号：nextGeneration = snapshot.inputGeneration + 1；
   - b. 在内存中实例化全新输入元素：const newNode = document.createElement('input')；
   - c. 遍历 oldNode.attributes，安全复制 5 类持久属性（label 关联、ARIA、tabindex、class/style、data-*），显式过滤排除 value 与瞬态 aria-invalid；设置 newNode.type = 'text'，newNode.value = ''，确保 newNode 无 aria-invalid；
   - d. 调用 InputController.bindInputNode(newNode, nextGeneration) 为新节点绑定专属事件监听闭包（捕获 nextGeneration 作为 bornGeneration，私有 isComposing=false 与 trustedDraft=''）；
   - e. 取消防抖定时器：调用 DebounceScheduler.cancel()，销毁活跃定时器并单调递增调度纪元；
   - f. 执行物理节点替换：oldNode.replaceWith(newNode)；显式记录 mountedReplacementNode = newNode；
   - g. 呈现与错误复位：DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】')，FeedbackBanner.clearInputError(newNode, errorContainer)；
   - h. 焦点转移与恢复：newNode.focus()；
   - i. 事务提交点（Commit Point）：将 activeInputNode 正式指向 newNode，将 inputGeneration 递增为 nextGeneration。至此事务成功完成。
   阶段三：事务异常拦截与原子回滚（Rollback Phase，catch 块保护，解决 R6-B1 与 R6-B2）：
   - 若在阶段二的任何环节（创建/属性复制/事件绑定前失败、replaceWith 抛错、替换后 renderPlaceholder 失败、clearInputError 失败或 focus 失败）发生异常：
     * catch 块捕获异常并调用 ResetController.rollback(snapshot, err, newNode)；
     * DOM 拓扑精准还原（R6-B1 修复）：显式识别 replacement 节点 newNode；若 newNode 已经插入文档树（newNode && newNode.parentNode 存在），执行 newNode.parentNode.replaceChild(oldNode, newNode) 物理回插原节点并彻底移除已挂载的新节点（或 newNode.remove() 并在原 parentNode/nextSibling 插回 oldNode），严禁在 DOM 中残留 newNode，确保页面中输入框数量严格为 1 且 ID 唯一；若 newNode 未挂载且 oldNode 脱离文档，按 snapshot.parentNode 与 nextSibling 插回原位置；
     * 状态指针与代际还原：activeInputNode 重新指向 oldNode，inputGeneration 恢复为 snapshot.inputGeneration；调度纪元单调自增（schedulerEpoch++）确保清空前后的宏任务队列旧定时器无害作废，绝不回退至旧纪元；
     * 输入内容与错误状态还原：oldNode.value 还原为 snapshot.draft；若此前存在错误，恢复 error 类名与 aria-invalid 属性；恢复 displayContent 与 errorContainer 文本与显隐；
     * 原始草稿无差别重调度（R6-B2 修复）：若 snapshot.hadPendingTimer 为 true，无论 snapshot.draft 是非空文本、空字符串 '' 还是纯空格 '   '，无条件按 snapshot.draft 重新调度 DebounceScheduler.schedule(snapshot.draft, oldNode, inputGeneration, handleDebouncedValidateAndDisplay, 300) 产生全新纪元，绝不因 trim 校验为假而跳过重调度；空值与纯空格在 300ms 后忠实执行校验，清除旧项目名展示并呈现红色非空警示，空格原样保留；因 inputGeneration 还原，oldNode 闭包中的 bornGeneration 依然严格等于 inputGeneration，绝不产生失配死锁；
     * 焦点与提示：oldNode.focus() 回焦，界面顶部弹出友好横幅 FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态')；
     * 严重失败只读复制兜底：若回插本身再次发生严重 DOM 异常，定义诚实失败状态：不声称完整恢复，禁止 window.location.reload() 刷新页面，在独立只读 textarea 容器中原样呈现原始 draft（保留换行与空格）供用户手动复制取回。
3. 旧节点迟到事件隔离：
   - 事务成功提交后，脱离 DOM 的 oldNode 接收到迟到 compositionend、beforeinput 或 input 事件时，因 node !== activeInputNode（oldNode !== newNode）且 bornGeneration !== inputGeneration（1 !== 2），旧闭包守卫立即直接 return，完全无法触碰 activeInputNode，不制造空值错误。
4. 顺畅恢复与继续操作：
   - 事务成功后，用户在 newNode 中键入直接流转新 300ms 防抖；事务回滚后，用户在 oldNode 中键入（如键入 'Edited after failure'）同样正常触发 300ms 防抖更新，手动删空与重试清空完全可用，重试成功后依然维持单一输入框。

Task=null


## blk-acc-reset / acceptance / 验收标准：一键即时清空、持久属性保真、事务拓扑回滚与无差别重调度 Given-When-Then

Stage=product; requirements=["blk-feat-reset"]; dependencies=["blk-flow-reset"]

Scenario 1: 正常清空即时直接复位（无确认弹窗）
Given 页面顶部正在展示项目名 'AiRDUO-Project-01'，输入框含有 'AiRDUO-Project-01'
When 用户点击底部橙色圆形清空按钮
Then 顶部展示区立即清除 'AiRDUO-Project-01' 并恢复为初始灰色占位提示 '【等待输入核对】'，输入框被替换为 value 为空的新节点，光标自动回焦新输入框，无任何二次确认弹窗或撤销延迟，控制台 0 报错。

Scenario 2: 清空替换后持久属性严格保真与瞬态状态重置
Given 输入框初始配置包含 id='project-name-input', name='project-name', aria-label='项目名输入框', aria-describedby='input-hint', aria-required='true', tabindex='1', class='input-control error', style='font-size: 16px;', data-test='project-input', aria-invalid='true'
When 用户点击清空按钮
Then 新生成的输入框保留 id, name, aria-label, aria-describedby, aria-required, tabindex, class('input-control'), style, data-test 全部 5 类持久属性，且其 value 严格为 ''，瞬态 aria-invalid 属性与 error 类名被彻底移除，错误提示容器被清空且隐藏。

Scenario 3: 替换前注入异常触发原子回滚与原状态自洽
Given 输入框内存在待核对草稿 'Pre-Replace Draft'，顶部展示区呈现 'Pre-Replace Draft'
When 点击清空按钮，在创建新节点或属性复制阶段注入异常
Then catch 块触发回滚，activeInputNode 仍为原节点，inputGeneration 未被递增，oldNode.value 完好保持为 'Pre-Replace Draft'，界面顶部弹出容错通知横幅，原节点保持聚焦且用户可继续修改或手动删空。

Scenario 4: 物理替换 replaceWith 过程抛错触发原子回滚
Given 输入框内存在草稿 'Draft During Replace'
When 点击清空按钮，在执行 oldNode.replaceWith(newNode) 瞬间抛出 DOMException
Then catch 块捕获异常并执行 rollback，oldNode 被原位插回原父节点与兄弟节点位置，activeInputNode 指向 oldNode，inputGeneration 还原，schedulerEpoch 自增递增废弃旧任务，oldNode.value 完好为 'Draft During Replace'，界面呈现友好横幅，用户可继续输入。

Scenario 5: 替换后后续步骤抛错回滚与 DOM 单输入框拓扑保真（R6-B1 验证）
Given 输入框内存在草稿 'Post-Replace Error Draft'，顶部大字展示 'Post-Replace Error Draft'
When 点击清空按钮，newNode 已成功执行 oldNode.replaceWith(newNode) 挂入 DOM 树，但随后的 DisplayRenderer.renderPlaceholder、clearInputError 或 focus 抛出异常
Then catch 块捕获异常并执行 rollback，系统显式移除已挂入文档树的 newNode 并将 oldNode 原位插回原位置，验证 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，DOM 中无残留 replacement 节点；activeInputNode 还原指向 oldNode，inputGeneration 还原，oldNode.value 完好保留 'Post-Replace Error Draft'，oldNode 获得光标焦点，界面弹出友好提示横幅。

Scenario 6: 删空草稿与纯空格草稿发起清空遇回滚后无差别重新调度校验（R6-B2 验证）
Given 页面展示区正呈现旧项目名 'Old Displayed Value'
When 用户使用 Backspace 将输入框全部删空（或输入三个半角空格 '   '）并发起 input 调度，在 300ms 定时器未到期前点击清空按钮，且清空流程注入 replaceWith 失败触发回滚
Then rollback 捕获快照并检测到 hadPendingTimer 为 true，无条件针对原删空草稿 ''（或纯空格草稿 '   '）重新调度 300ms 防抖任务；满 300 毫秒后定时器正常唤醒并执行校验，展示区已显示的旧项目名 'Old Displayed Value' 立即被清除并恢复为灰色占位文字 '【等待输入核对】'，输入框正下方呈现红色非空警示 '项目名不能为空，请输入有效字符'，输入框内容完好保留（删空状态保持为空，空格草稿保留三个空格），旧项目名不持久残留。

Scenario 7: 回滚成功后继续编辑、手动删空与幂等清空重试
Given 经历清空失败回滚后，界面恢复原节点 oldNode，草稿为 'Draft Recovered'
When 开发者在输入框中继续键入 'Edited after failure' 并停止 300 毫秒
Then 顶部展示区正常通过 Node.textContent 安全更新为 'Edited after failure'；若随后用户手动删空停止 300 毫秒，旧结果被清除并显示红色错误提示；若再次点击清空按钮，清空流程成功流转，新输入框被挂载，DOM 树中有且仅有 1 个输入框，无重复事件监听。

Scenario 8: 成功提交后旧节点迟到 compositionend、input 与旧 timer 回调安全隔离
Given 用户在 oldNode 中启动拼音输入法合成后点击清空，事务成功提交生成 newNode
When 浏览器向脱离 DOM 的 oldNode 派发迟到的 compositionend 事件与 input 事件，且 oldNode 排队的旧防抖 timer 回调唤醒
Then oldNode 闭包核验 node !== activeInputNode 且 bornGeneration !== inputGeneration 立即直接 return，旧 timer 守卫核验 thisEpoch !== schedulerEpoch 立即退出；newNode 的 value 保持为空，顶部展示区保持占位提示，等待 350ms 后无空值错误，控制台 0 报错。

Scenario 9: 替换后严重回滚失败之只读草稿复制兜底
Given 输入框存在重要测试草稿 'Important Draft With\\nMultiple Lines   and Spaces'
When 点击清空按钮，replaceWith 执行后抛出异常，且在回插原节点时再次发生严重 DOMException 导致回滚中断
Then 系统捕获严重异常，界面绝不执行 window.location.reload() 刷新页面，界面顶部横幅明确提示 '清空与回滚操作遇到严重异常，主编辑器暂时受限，已为您在下方安全保留草稿'，并在独立只读草稿容器（readonly textarea）中原样呈现原始 draft 文本，包含换行与空格逐字符完全一致，允许用户手动选中文本执行复制取回。

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

运行环境支持要求、双启动模式、固定 8080 端口契约与离线运行边界规范，面向个人开发者的本地无门槛极简运行场景设计：
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


## blk-tech-data-model / data_model / 客户端运行时数据模型与状态结构规范（代际纪元、五类持久配置、挂载替换记录与事务快照模型）

Stage=technical; requirements=["blk-feat-input-display","blk-feat-reset"]; dependencies=["blk-tech-stack"]

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

Task=null


## blk-tech-error / error / 错误分类、旧结果清除机制、清空状态事务原子回滚与只读草稿复制兜底策略

Stage=technical; requirements=["blk-feat-reset","blk-feat-input-display"]; dependencies=["blk-tech-data-model","blk-tech-interface"]

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

Task=null


## blk-tech-module / module / 前端系统架构与核心功能模块划分（输入节点闭包绑定与快照调度器）

Stage=technical; requirements=["blk-prod-scope","blk-feat-reset"]; dependencies=["blk-tech-stack","blk-tech-data-model"]

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
2. InputController（输入管理与代际闭包绑定模块）：
   - 职责：维护当前处于 DOM 树中的唯一活跃输入框节点 activeInputNode，为输入框节点绑定捕获专属代际的私有监听闭包；
   - API 契约：
     * bindInputNode(node: HTMLInputElement, generation: number): void
       - 入参：目标输入框 DOM 元素 node，该节点所属的单调递增代际编号 generation；
       - 返回类型：void；
       - 正常后置条件：为 node 绑定 input、compositionstart、compositionend 等事件监听，在闭包内私有捕获 node 引用、bornGeneration = generation、isComposing = false 与 trustedDraft = node.value；闭包前置四重守卫核验（event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)），仅核验通过的合法活跃事件才允许更新 trustedDraft 并触发防抖调度；
       - 失败后置条件：若 node 为空或 generation 非正整数，抛出 TypeError 并中止绑定；
       - 调用方职责：由 AppController.init 针对首个初始输入节点调用，或由 ResetController.handleReset 针对内存预制的新输入框 newNode 调用。
     * focusInput(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：若 activeInputNode 存在且挂载于 DOM 树，调用 activeInputNode.focus() 确保光标准确移入活跃输入框；
       - 失败后置条件：若 activeInputNode 不存在或已脱离文档树，安全忽略并不抛出未捕获异常；
       - 调用方职责：由初始化流程、清空成功提交后、或回滚恢复原节点后调用。
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
   - 职责：协调清空重置全流程，实现强两阶段状态事务（Two-Phase Commit）、五类持久属性保真复制与失败原子拓扑回滚；
   - API 契约：
     * handleReset(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：严格执行两阶段状态事务：
         1. 快照阶段：调用 captureSnapshot() 完整记录包含 activeInputNode、inputGeneration、schedulerEpoch、hadPendingTimer、draft（涵盖 empty/whitespace/nonempty）、展示与错误内容及 DOM 位置的恢复快照；
         2. 准备阶段（try 保护）：计算 nextGeneration = inputGeneration + 1；在内存创建全新 input 节点 newNode；安全复制 5 类持久属性（label 关联 id/name、全部 ARIA 属性、tabindex、class/style、data-*），显式过滤 value 与瞬态 aria-invalid；为 newNode 调用 InputController.bindInputNode(newNode, nextGeneration)；
         3. 替换与复位阶段：调用 DebounceScheduler.cancel() 取消防抖；执行 oldNode.replaceWith(newNode) 物理节点替换并记录 mountedReplacementNode = newNode；调用 DisplayRenderer.renderPlaceholder 复位展示区为占位符；调用 FeedbackBanner.clearInputError 清除错误；调用 newNode.focus() 获取焦点；
         4. 原子提交点（Commit Point）：上述步骤全部成功后，正式原子提交：更新 activeInputNode = newNode，inputGeneration = nextGeneration；至此清空事务圆满完成，旧节点迟到事件被入口守卫拦截丢弃；
       - 失败后置条件：若准备、替换过程、呈现复位、错误清理或焦点恢复任意阶段抛出异常，catch 块立即捕获并调用 rollback(snapshot, error, mountedReplacementNode)，确保代际不提前递增（保持原 generation G），原节点与 DOM 单输入框拓扑保真；
       - 调用方职责：由 resetButton 的 click 事件监听器调用。
     * captureSnapshot(): ResetTransactionSnapshot
       - 入参：无；
       - 返回类型：ResetTransactionSnapshot；
       - 正常后置条件：捕获并返回包含当前 activeInputNode、inputGeneration、schedulerEpoch、hadPendingTimer（通过 hasPending() 判定）、draft（activeInputNode.value 原文）、displayContent、errorContent、isErrorVisible、hadErrorClass、hadAriaInvalid、parentNode 及 nextSibling 位置引用的不可变数据快照；
       - 失败后置条件：若 activeInputNode 不存在抛出 Error 并被 handleReset catch 捕获；
       - 调用方职责：由 handleReset 第一优先级调用。
     * rollback(snapshot: ResetTransactionSnapshot, error: Error, replacementNode?: HTMLInputElement): void
       - 入参：恢复快照 snapshot，捕获的异常对象 error，可能已挂载的新节点 replacementNode；
       - 返回类型：void；
       - 正常后置条件：执行原子拓扑回滚：
         1. 显式识别 replacementNode：若 replacementNode 存在且已挂入 DOM（replacementNode.parentNode），执行 replacementNode.parentNode.replaceChild(snapshot.activeInputNode, replacementNode) 并彻底移除 replacementNode，或者 replacementNode.remove() 并在原 parentNode/nextSibling 插回 snapshot.activeInputNode，严格断言 DOM 树中单一合法输入框（querySelectorAll('input').length === 1，0 重复 ID）；
         2. 状态与代际还原：activeInputNode 重新指向 snapshot.activeInputNode，全局 inputGeneration 严格保持为 snapshot.inputGeneration（绝不提前递增），调度纪元单调自增（schedulerEpoch++）彻底废弃旧任务；
         3. 草稿与错误还原：还原 oldNode.value = snapshot.draft；若此前有错误则恢复 error 类与 aria-invalid，恢复 displayContent 与错误容器显隐；
         4. 原始草稿无差别重调度：若 snapshot.hadPendingTimer 为 true，无条件针对 snapshot.draft 重新调度 300ms 防抖任务（无论非空、空字符串 '' 还是纯空格 '   '，严禁用 trim 过滤跳过）；
         5. 回焦与友好横幅：调用 snapshot.activeInputNode.focus()，弹出 FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态')；原闭包 bornGeneration 与 inputGeneration 自洽，用户可继续输入、手动删空或重试清空；
       - 失败后置条件：若回插原节点过程中再次发生严重 DOM 异常，catch 拦截严重错误并进入严重兜底：严禁刷新页面（禁止 window.location.reload()），调用 FeedbackBanner.showSevereFallbackDraft(snapshot.draft, severeFallbackContainer) 在只读 textarea 容器中逐字符原样呈现原始草稿供用户手动复制；
       - 调用方职责：由 handleReset 的 catch 块调用。
5. ValidatorModule（非空与字符校验模块）：
   - 职责：针对传入的草稿快照进行纯函数非空校验；
   - API 契约：
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }
       - 入参：草稿快照字符串 draft；
       - 返回类型：校验结果对象 { isValid: boolean, errorMessage: string | null }；
       - 正常后置条件：若 draft.trim().length === 0（涵盖 null、空字符串 '' 与纯空格字符串），返回 { isValid: false, errorMessage: '项目名不能为空，请输入有效字符' }；若去除首尾空白后包含有效非空字符，返回 { isValid: true, errorMessage: null }；
       - 失败后置条件：若 draft 类型非 string，进行防御性转换或判定为非法，绝不抛出阻断性未捕获异常；
       - 调用方职责：由防抖计时器到期后的 handleDebouncedValidateAndDisplay 流程调用。
6. FeedbackBanner（错误警示与异常横幅模块）：
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
     * showGlobalError(message: string): void
       - 入参：全局警示消息 message；
       - 返回类型：void；
       - 正常后置条件：在页面顶部 error-banner-container 挂载轻量通知横幅，安全呈现纯文本警示，保留页面其余内容，不执行页面重载；
       - 失败后置条件：若横幅容器不存在，在 body 顶部动态创建挂载节点呈现；
       - 调用方职责：由清空异常回滚处理、或 window.onerror 全局异常拦截调用。
     * showSevereFallbackDraft(draftText: string, container: HTMLElement): void
       - 入参：原始草稿文本 draftText，兜底宿主容器 container（通常为顶部 error-banner-container）；
       - 返回类型：void；
       - 正常后置条件：在 container 内安全挂载一个独立只读多行文本域（readonly textarea），将 draftText 原样逐字符赋值给 textarea.value（完整保留换行与所有前后/重复空格），设置 textarea.readOnly = true 与 tabindex="0"，提示文案明确说明“清空与回滚操作遇到严重异常，主编辑器暂时受限，已为您在下方安全保留草稿，请手动选中复制取回”，杜绝 window.location.reload() 刷新，保障输入数据 0 丢失；
       - 失败后置条件：若 container 为空，尝试在 document.body 就地挂载；若挂载完全失败在控制台输出 draftText；
       - 调用方职责：由 ResetController.rollback 的严重失败 catch 块调用。
7. AppController（全局装配与启动协调模块）：
   - 职责：页面主控制器，负责在 DOMContentLoaded 时获取实际 DOM 引用，完成各模块依赖注入与事件初始化装配；
   - API 契约：
     * init(elements: { displayElement: HTMLElement, initialInputNode: HTMLInputElement, errorContainer: HTMLElement, resetButton: HTMLElement, severeFallbackContainer?: HTMLElement }): void
       - 入参：包含页面核心交互元素的对象 elements（displayElement 大字展示区，initialInputNode 初始输入框，errorContainer 就地错误容器，resetButton 清空按钮，以及可选的 severeFallbackContainer 独立只读草稿兜底容器）；
       - 返回类型：void；
       - 前置条件：页面 DOMContentLoaded 触发，四个核心 DOM 元素（displayElement, initialInputNode, errorContainer, resetButton）已就绪并成功由 querySelector/getElementById 获取到真实非空节点引用；
       - 正常后置条件：
         1. 运行时状态初始化：设置全局 activeInputNode = elements.initialInputNode，inputGeneration = 1，schedulerEpoch = 0，isInitialized = true；
         2. 首个节点闭包绑定：调用 InputController.bindInputNode(elements.initialInputNode, 1) 为初始输入框绑定捕获代际 1 的专属 input/composition 事件闭包；
         3. 清空按钮事件注册：为 elements.resetButton 绑定单一 click 事件监听器指向 ResetController.handleReset，确保清空按钮全局仅一次注册监听，不产生重复绑定；
         4. 视觉与提示初态就绪：调用 DisplayRenderer.renderPlaceholder(elements.displayElement, '【等待输入核对】') 初始化展示区为占位符；调用 FeedbackBanner.clearInputError(elements.initialInputNode, elements.errorContainer) 确保错误提示容器初始隐藏且输入框无错误类；
         5. 焦点与兜底容器就绪：调用 InputController.focusInput() 将光标聚焦到初始输入框；若显式提供了 elements.severeFallbackContainer 则保存引用，若未提供则约定在页面顶部 error-banner-container 内部预留就地挂载点，确保严重回滚兜底随时可用；
       - 失败后置条件：若 elements 为空或任一核心依赖（displayElement, initialInputNode, errorContainer, resetButton）为 null/undefined，抛出明确 ReferenceError 并在控制台输出可见错误日志，中断启动流转，不进入可用就绪态，不绑定不完整事件，不清空既有输入，不报告假成功；
       - 调用方职责：由 index.html 引入的经典 defer 主脚本在 DOMContentLoaded 时显式调用一次，全局禁止重复调用。

Task=null


## blk-tech-interface / interface / 组件事件契约与模块调用接口规范（节点代际守卫、清空状态事务与非执行参考示意）

Stage=technical; requirements=["blk-prod-scope","blk-feat-reset"]; dependencies=["blk-tech-module"]

组件事件契约、公共模块调用接口与两阶段状态转换规范。明确本块内部 JavaScript 均为“非执行示意，非CodingAgent直接复制的参考实现”；规划规范的权威定义是接口方法签名、状态所有权、前置守卫与成功提交/失败回滚的后置条件：
1. 模块接口签名与契约清单（完整保持 16 项公共 API，逐项规范入参、返回类型、后置条件与调用方职责）：
   - InputController:
     * bindInputNode(node: HTMLInputElement, generation: number): void
       - 入参：node: HTMLInputElement（目标输入框元素），generation: number（该节点所属代际）；
       - 返回类型：void；
       - 正常后置条件：为 node 绑定 input 与 composition 事件，闭包内私有捕获 node 引用、bornGeneration = generation 与 trustedDraft；执行四重守卫核验（event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node)）；
       - 失败后置条件：若 node 为空或 generation 非正整数，抛出 TypeError 中止绑定；
       - 调用方职责：由 AppController.init 针对首节点调用，或由 ResetController.handleReset 针对预制 newNode 调用。
     * focusInput(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：若 activeInputNode 存在且挂载于 DOM 树，调用 activeInputNode.focus() 回焦输入框；
       - 失败后置条件：若 activeInputNode 脱离文档树或不存在，安全忽略不抛错；
       - 调用方职责：由初始化、清空成功提交或回滚恢复原节点后调用。
   - DebounceScheduler:
     * schedule(draftSnapshot: string, targetNode: HTMLInputElement, targetGeneration: number, callback: Function, delayMs: number = 300): void
       - 入参：draftSnapshot: string（原始草稿快照），targetNode: HTMLInputElement（目标节点），targetGeneration: number（目标代际），callback: Function（防抖到期回调），delayMs: number = 300（延迟毫秒，默认 300ms）；
       - 返回类型：void；
       - 正常后置条件：记录 schedulerEpoch 纪元快照并启动 300ms 定时器；到期核验 taskEpoch === schedulerEpoch && targetGeneration === inputGeneration && targetNode === activeInputNode 通过后执行回调；
       - 失败后置条件：若守卫失配，回调被直接丢弃；
       - 调用方职责：由输入监听闭包或清空回滚草稿无差别重调度流程调用。
     * cancel(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：清除活跃定时器（clearTimeout），自增 schedulerEpoch（schedulerEpoch++）使在途回调失效；
       - 失败后置条件：无（幂等安全）；
       - 调用方职责：由 ResetController.handleReset 在替换前调用，或回滚作废旧任务时调用。
     * hasPending(): boolean
       - 入参：无；
       - 返回类型：boolean；
       - 正常后置条件：返回内存中是否存在排队中的有效防抖任务（pendingTimerId !== null 且纪元有效）；
       - 失败后置条件：无；
       - 调用方职责：由 ResetController.captureSnapshot 检测发起清空瞬间是否存在在途任务。
   - ResetController:
     * handleReset(): void
       - 入参：无；
       - 返回类型：void；
       - 正常后置条件：执行强两阶段清空状态事务（快照捕获 -> 内存预制新节点并复制 5 类持久属性 -> 取消防抖 -> replaceWith 物理替换并记录 mountedReplacementNode -> 占位呈现与错误清理 -> focus 聚焦 -> 原子提交更新 activeInputNode 与递增代际 inputGeneration++）；
       - 失败后置条件：若准备、替换中或替换后任意阶段抛错，catch 立即触发 rollback(snapshot, error, mountedReplacementNode)，代际不提前递增（保持原代际 G）；
       - 调用方职责：由 resetButton 的 click 事件监听器调用。
     * captureSnapshot(): ResetTransactionSnapshot
       - 入参：无；
       - 返回类型：ResetTransactionSnapshot；
       - 正常后置条件：捕获包含 activeInputNode、inputGeneration、schedulerEpoch、hadPendingTimer（通过 hasPending() 判定）、draft（涵盖 empty/whitespace/nonempty）、displayContent、errorContent、DOM 树 parentNode 与 nextSibling 的恢复快照；
       - 失败后置条件：若 activeInputNode 不存在抛出 Error 并被 handleReset catch 捕获；
       - 调用方职责：由 handleReset 第一优先级调用。
     * rollback(snapshot: ResetTransactionSnapshot, error: Error, replacementNode?: HTMLInputElement): void
       - 入参：snapshot: ResetTransactionSnapshot（恢复快照），error: Error（异常对象），replacementNode?: HTMLInputElement（可能已挂载的新节点）；
       - 返回类型：void；
       - 正常后置条件：执行原子拓扑回滚：显式识别 replacement 节点，若已挂入文档树则物理回插原节点并彻底移除 replacementNode，断言 DOM 树中只有 1 个 input 且 ID 唯一；还原 activeInputNode 与代际（保持原 G）；自增 schedulerEpoch；若 snapshot.hadPendingTimer 为真，无差别按 snapshot.draft 重新调度防抖；回焦原节点并提示；
       - 失败后置条件：若回插严重失败进入严重兜底：严禁刷新页面（禁止 reload），在只读 textarea 容器中展开原始草稿供手动复制；
       - 调用方职责：由 handleReset 的 catch 块调用。
   - DisplayRenderer:
     * renderProjectName(element: HTMLElement, text: string): void
       - 入参：element: HTMLElement（展示区容器），text: string（项目名文本）；
       - 返回类型：void；
       - 正常后置条件：使用 Node.textContent 纯文本绑定安全更新大字，杜绝 HTML 解析与脚本执行；
       - 失败后置条件：若 element 无效抛出 TypeError；
       - 调用方职责：由防抖调度完成后的回调函数调用。
     * renderPlaceholder(element: HTMLElement, placeholderText: string = '【等待输入核对】'): void
       - 入参：element: HTMLElement（展示区容器），placeholderText: string（占位文本，默认“【等待输入核对】”）；
       - 返回类型：void；
       - 正常后置条件：使用 Node.textContent 复位展示区为灰色占位文本；
       - 失败后置条件：若 element 无效抛出 TypeError；
       - 调用方职责：由初始化流程、空值校验拦截或清空事务调用。
   - FeedbackBanner:
     * showInputError(inputNode: HTMLInputElement, container: HTMLElement, message: string): void
       - 入参：inputNode: HTMLInputElement（目标输入框），container: HTMLElement（错误容器），message: string（错误提示文案）；
       - 返回类型：void；
       - 正常后置条件：Node.textContent 写入 message 并显示 container，为 inputNode 挂载 error 类名与 aria-invalid="true"；
       - 失败后置条件：若 container 不存在抛出 TypeError；
       - 调用方职责：由空值/纯空格校验失败拦截分支调用。
     * clearInputError(inputNode: HTMLInputElement, container: HTMLElement): void
       - 入参：inputNode: HTMLInputElement（目标输入框），container: HTMLElement（错误容器）；
       - 返回类型：void；
       - 正常后置条件：清空 container 文本并隐藏，移除 inputNode 的 error 类名与 aria-invalid 属性；
       - 失败后置条件：无；
       - 调用方职责：由校验通过、清空成功或初始化流程调用。
     * showGlobalError(message: string): void
       - 入参：message: string（全局通知文案）；
       - 返回类型：void；
       - 正常后置条件：在页面顶部 error-banner-container 挂载轻量通知横幅，安全呈现纯文本警示，不刷新页面；
       - 失败后置条件：若容器缺失在 body 顶部动态挂载呈现；
       - 调用方职责：由清空异常回滚处理或 window.onerror 调用。
     * showSevereFallbackDraft(draftText: string, container: HTMLElement): void
       - 入参：draftText: string（原始草稿文本），container: HTMLElement（兜底宿主容器）；
       - 返回类型：void；
       - 正常后置条件：在 container 内挂载独立只读多行文本域（readonly textarea），原样逐字符呈现 draftText（完整保留换行与空格），说明“主编辑器受限，已为您保留草稿，请手动选中复制”，杜绝 window.location.reload()；
       - 失败后置条件：若挂载失败在控制台输出草稿文本；
       - 调用方职责：由 ResetController.rollback 严重失败分支调用。
   - ValidatorModule:
     * validate(draft: string): { isValid: boolean, errorMessage: string | null }
       - 入参：draft: string（草稿快照文本）；
       - 返回类型：{ isValid: boolean, errorMessage: string | null }；
       - 正常后置条件：若 draft.trim().length === 0（涵盖 null、空字符串与纯空格），返回 { isValid: false, errorMessage: '项目名不能为空，请输入有效字符' }；非空返回 { isValid: true, errorMessage: null }；
       - 失败后置条件：若类型非 string 进行防御性判定，不抛出未捕获异常；
       - 调用方职责：由防抖计时器到期后的 handleDebouncedValidateAndDisplay 流程调用。
   - AppController:
     * init(elements: { displayElement: HTMLElement, initialInputNode: HTMLInputElement, errorContainer: HTMLElement, resetButton: HTMLElement, severeFallbackContainer?: HTMLElement }): void
       - 入参：包含 displayElement, initialInputNode, errorContainer, resetButton 及可选 severeFallbackContainer 的依赖对象；
       - 返回类型：void；
       - 前置条件：页面 DOMContentLoaded 触发，四个核心 DOM 元素成功获取非空引用；
       - 正常后置条件：设置 activeInputNode = initialInputNode，inputGeneration = 1，schedulerEpoch = 0，isInitialized = true；调用 InputController.bindInputNode 为初始节点绑定代际 1 闭包；为 resetButton 注册单一 handleReset 点击事件；DisplayRenderer.renderPlaceholder 初始化展示区；FeedbackBanner.clearInputError 初始化错误提示；initialInputNode 获取焦点；若未显式提供 severeFallbackContainer 则在页面顶部 error-banner-container 内部预留就地挂载点；
       - 失败后置条件：若依赖缺失抛出 ReferenceError 并在控制台可见报错，中断流转，不进入就绪态，不绑定不完整事件，不清空既有输入，不报告假成功；
       - 调用方职责：由主入口经典 defer 脚本在 DOMContentLoaded 时显式调用一次，禁止重复调用。
2. 清空状态事务状态转换与后置条件（非执行示意，供设计推导参考）：
   [Ready: oldNode in DOM, generation=G, epoch=E]
         |
         v (click reset -> captureSnapshot: oldNode, G, E, hadTimer, draft, DOM position)
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
3. 伪代码参考示意（非执行示意，说明 R7-B1/R7-B2 架构契约与回滚机制）：
```javascript
// 非执行示意，非CodingAgent直接复制的参考实现；正式规范权威为接口方法签名、状态所有权与验收用例
const AppController = {
  init(elements) {
    if (!elements || !elements.displayElement || !elements.initialInputNode || !elements.errorContainer || !elements.resetButton) {
      throw new ReferenceError('AppController.init: 缺少必要的核心 DOM 依赖');
    }
    activeInputNode = elements.initialInputNode;
    inputGeneration = 1;
    schedulerEpoch = 0;
    InputController.bindInputNode(activeInputNode, inputGeneration);
    elements.resetButton.addEventListener('click', () => ResetController.handleReset());
    DisplayRenderer.renderPlaceholder(elements.displayElement, '【等待输入核对】');
    FeedbackBanner.clearInputError(activeInputNode, elements.errorContainer);
    InputController.focusInput();
  }
};

const ResetController = {
  handleReset() {
    const snapshot = this.captureSnapshot();
    let mountedReplacementNode = null;
    try {
      const nextGeneration = snapshot.inputGeneration + 1;
      const newNode = document.createElement('input');
      // 安全复制 5 类持久属性并重置瞬态状态...
      InputController.bindInputNode(newNode, nextGeneration);
      DebounceScheduler.cancel();
      snapshot.activeInputNode.replaceWith(newNode);
      mountedReplacementNode = newNode;
      DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】');
      FeedbackBanner.clearInputError(newNode, errorContainer);
      newNode.focus();
      // 原子提交点：全部成功后才递增代际与更新活跃节点引用
      activeInputNode = newNode;
      inputGeneration = nextGeneration;
    } catch (err) {
      this.rollback(snapshot, err, mountedReplacementNode);
    }
  },
  rollback(snapshot, err, replacementNode) {
    try {
      // 显式清理已挂载的 replacement 节点，消除双输入框缺陷
      if (replacementNode && replacementNode.parentNode) {
        replacementNode.parentNode.replaceChild(snapshot.activeInputNode, replacementNode);
      } else if (!document.body.contains(snapshot.activeInputNode) && snapshot.parentNode) {
        snapshot.parentNode.insertBefore(snapshot.activeInputNode, snapshot.nextSibling);
      }
      activeInputNode = snapshot.activeInputNode;
      inputGeneration = snapshot.inputGeneration; // 保持原代际 G
      schedulerEpoch++; // 废弃旧在途定时器
      activeInputNode.value = snapshot.draft;
      if (snapshot.hadPendingTimer) {
        DebounceScheduler.schedule(snapshot.draft, activeInputNode, inputGeneration, handleDebouncedValidateAndDisplay, 300);
      }
      FeedbackBanner.showGlobalError('清空操作遇到异常，已为您完整恢复当前输入与核对状态');
      activeInputNode.focus();
    } catch (severeErr) {
      FeedbackBanner.showSevereFallbackDraft(snapshot.draft, document.getElementById('error-banner-container'));
    }
  }
};
```

Task=null
