# 真实集成验证-flash-materials-chinese-20261005-01 — 验收场景

版本：36；批准蓝图：7fff755a90c600ec04e69939a28bfd2a732ad58a927fdafb00d90c0f24d08409

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

## 交付前置验证任务：首屏 DOM 就绪与实时防抖响应性能基准实测（5轮均值闭合）

ID：blk-deliv-val-perf-benchmark；关联需求：blk-prod-outcomes；任务前置：blk-deliv-task-package、blk-deliv-val-standalone-runtime；蓝图原始依赖：blk-deliv-task-package、blk-deliv-val-standalone-runtime

实测首屏 DOM 解析就绪耗时（目标 5 轮均值 ≤ 300ms）、300ms 防抖实时反馈调度延迟（目标 5 轮总耗时均值 ≤ 350ms，其中纯计算与重绘前调度延迟均值 ≤ 50ms）及清空重置至重绘前调度延迟（目标 5 轮均值 ≤ 50ms），建立真实精确且指标闭合的测量基准。

目标：实测验证轻量纯原生单页面的首屏 DOM 就绪耗时（目标 5 轮均值 ≤ 300ms）、300ms 输入防抖实时展示与清空交互响应延迟（防抖处理至重绘前调度总耗时 5 轮均值 ≤ 350ms，其中纯计算与重绘前调度延迟 5 轮均值 ≤ 50ms，清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms）的性能设计目标

范围：使用浏览器标准 Performance Navigation Timing API 与 Performance.now() 进行 DOM 就绪、实时防抖至重绘前回调及清空重置至重绘前回调打点测量，严格区分 DOM 解析就绪与物理绘制完成，统一 5 轮采样与均值通过边界

排除：不测量网络传输延时（测试在本地文件或本地回环服务下进行），不宣称 requestAnimationFrame 已证明物理像素绘制完毕，不声称尚未实测的数据已通过

模块：AppController、DebounceScheduler、DisplayRenderer、InputController

正常行为：在现代主流桌面浏览器可见前台加载并操作应用时，预期满足各项性能设计目标：首屏 DOM 就绪耗时（domContentLoadedEventEnd - startTime）目标 5 轮均值 ≤ 300ms；输入防抖展示总耗时目标 5 轮均值 ≤ 350ms（其中包含 300ms 定时器等待与 5 轮均值 ≤ 50ms 的 DOM 更新及重绘前调度延迟）；清空重置至重绘前调度延迟目标 5 轮均值 ≤ 50ms。当前阶段目标应用尚未实现，实际数值待交付验证阶段执行实测，不声称未来测试已通过

异常行为：若实测均值超出阈值，分析是否有强制同步布局或不必要的 DOM 重查，精简 DOM 操作后复测

验证：
- 在 Chrome DevTools Performance 面板录制 5 次冷加载 Trace，查验 DOMContentLoaded 耗时 5 轮均值是否 ≤ 300ms
- 在控制台注入性能测量脚本，连续执行 5 次防抖展示与 5 次清空操作，统计 5 轮交互响应平均耗时是否达标（防抖总耗时均值 ≤ 350ms 且调度延迟均值 ≤ 50ms，清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms）
- 输出包含设备配置、测试数据规模与 5 轮采样起止记录的性能实测数据表

完成条件：
- 实测数据完整，首屏 DOM 就绪耗时 5 轮均值 ≤ 300ms
- 输入防抖处理至重绘前调度总耗时 5 轮均值 ≤ 350ms（其中 DOM 更新与重绘前调度延迟 5 轮均值 ≤ 50ms）
- 清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms
- 测试过程中主线程无阻塞的长任务（Long Task > 50ms）
- 形成完整的性能实测归档记录

假设：运行在主流性能配置的桌面计算机（CPU 4核以上，内存 8GB以上）；测试处于可见前台状态（document.visibilityState === 'visible'），测试数据规模为 1~200 字符的典型项目名测试文本

环境：桌面 PC（现代 x86_64 或 Apple Silicon 架构，4 核以上 CPU，8GB 以上内存），Chrome 最新稳定版无痕模式，禁用所有第三方浏览器扩展，可见活动前台标签页，本地 file:// 协议或 localhost

步骤：
- 1. 启动 Chrome 无痕模式并加载交付的 index.html，保持页面处于可见前台标签页（document.visibilityState === 'visible'）；
- 2. 测量首屏 DOM 就绪延迟：执行 const [nav] = performance.getEntriesByType('navigation'); console.log('DOM 就绪耗时:', nav.domContentLoadedEventEnd - nav.startTime)；重复 5 轮冷加载，记录每轮数值并计算 5 轮均值；
- 3. 注入防抖测试打点探针：在 input 与 compositionend 事件监听起始处记录 window.__t_input = performance.now()；在 DisplayRenderer 更新后调用 requestAnimationFrame(() => console.log('防抖全流程耗时:', performance.now() - window.__t_input)) 打印耗时；
- 4. 录入 50 字符典型项目名并停止打字，重复 5 轮测试，记录每轮总耗时与去除 300ms 后的调度延迟，分别计算 5 轮均值；
- 5. 点击清空按钮，在 click 事件打点并在重绘前 requestAnimationFrame 回调打点计算清空重置至重绘前调度延迟，重复 5 轮测试并计算 5 轮均值；
- 6. 汇总 DOM 就绪均值、输入防抖总耗时均值、调度延迟均值与清空重置至重绘前调度延迟均值，比对是否分别符合 ≤300ms, ≤350ms, ≤50ms 与 ≤50ms 的唯一通过边界。

通过标准：
- 首屏 DOM 就绪耗时（domContentLoadedEventEnd - startTime）5 轮均值 ≤ 300ms；
- 输入防抖展示总响应耗时 5 轮均值 ≤ 350ms，其中 DOM 更新与重绘前调度延迟 5 轮均值 ≤ 50ms；
- 清空重置至重绘前调度延迟 5 轮均值 ≤ 50ms；
- 测试过程中主线程无长任务卡顿。

证据：Chrome DevTools Performance 跟踪导出的 JSON 记录与控制台打印的 3 项指标各 5 轮耗时数据及均值计算日志

失败后：若某项指标均值超时，审查 styles.css 中的选择器复杂度，检查 app.js 中是否存在频繁的 getComputedStyle 或重复 querySelector，将 DOM 引用缓存化后重新测试。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-d686fe73-a405-4933-a3a6-7da164ea5c01、evidence-7a463cf7-74f1-4627-b9b3-24784ae3a9bc、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-quality-20261005-06-feedback-1791155700105

## 验收标准：300ms 防抖实时反馈、节点替换隔离与精确测试用例 Given-When-Then

ID：blk-acc-input-display；关联需求：blk-feat-input-display；依赖：blk-flow-input-display

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

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 验收标准：清空重置、节点替换与五类持久属性保留精确断言 Given-When-Then

ID：blk-acc-reset；关联需求：blk-feat-reset；依赖：blk-flow-reset

Scenario 1: 正常即时清空复位、节点替换与回焦
Given 顶部展示区正在展示 'Project-Test'，输入框包含 'Project-Test'，界面无错误
When 用户点击底部橙色清空按钮
Then 页面不弹出任何二次确认框，旧输入框被新 input 节点物理替换（DOM replaceWith），新节点 value 为空字符串 ''，新节点完整继承持久配置（id 为 'project-name-input'，name 为 'projectName'，aria-label 为 '项目名输入'），顶部展示区立即恢复为灰色占位文本 '【等待输入核对】'，输入焦点自动停留在新输入框内。

Scenario 2: 防抖倒计时中清空彻底取消异步任务
Given 用户刚键入 'New-Test'，当前处于 100 毫秒计时窗口
When 用户点击清空按钮
Then 调度纪元 schedulerEpoch 递增，输入框被替换复位，定时器被销毁，等待 500 毫秒后查验展示区依然保持 '【等待输入核对】'，无任何旧文字回显。

Scenario 3: 清除历史错误提示与瞬态 aria-invalid
Given 页面因前次操作正在显示 '项目名不能为空，请输入有效字符' 红色警告，输入框带有 aria-invalid='true'
When 用户点击清空按钮
Then 红色警告提示立刻从 DOM 移除，新输入框不含有 aria-invalid 属性，输入框错误高亮取消，页面恢复至干净初始态。

Scenario 4: 空页面重复点击清空幂等性与节点持续可用
Given 页面处于初始空白状态
When 用户连续多次点击清空按钮
Then 页面无任何异常抛出，节点依次正常替换，展示区保持占位提示，当前活跃输入框持续保持聚焦状态，不产生任何空值错误。

Scenario 5: 清空替换后五类持久属性与无障碍配置完整保留精确断言
Given 输入框具有完整持久配置：label 关联（id='project-name-input', name='projectName'）、ARIA 属性（aria-label='项目名输入', aria-describedby='project-input-help', aria-required='true'）、键盘导航（tabindex='0'）、样式表现（class='input-control active', style.borderWidth='2px'）、自定义测试属性（data-test='project-input'），且因前次校验失败带有瞬态属性 aria-invalid='true' 与可见错误提示
When 用户点击清空按钮触发 node.replaceWith(newNode) 物理替换
Then 新 input 节点具有以下 6 项精确断言：
1. label 关联保持：newNode.id === 'project-name-input' && newNode.name === 'projectName'；
2. ARIA 配置保持且瞬态重置：newNode.getAttribute('aria-label') === '项目名输入' && newNode.getAttribute('aria-describedby') === 'project-input-help' && newNode.getAttribute('aria-required') === 'true'，而瞬态 newNode.hasAttribute('aria-invalid') 为 false；
3. 键盘导航保持：newNode.tabIndex === 0 && newNode.getAttribute('tabindex') === '0'；
4. 样式表现保持：newNode.className === 'input-control active' && newNode.style.borderWidth === '2px'；
5. data-* 属性保持：newNode.dataset.test === 'project-input' && newNode.getAttribute('data-test') === 'project-input'；
6. 状态重置与回焦：newNode.value === ''，旧节点闭包隔离失效，document.activeElement === newNode。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-17569c8c-1012-4071-8ebe-936b5fe286db；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148

## 端到端集成验收规范：防抖实时核对、节点替换隔离与精确测试用例 Given-When-Then

ID：blk-deliv-acc-full-e2e；关联需求：blk-feat-input-display、blk-feat-reset、blk-prod-outcomes；依赖：blk-deliv-task-package

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
When 开发者使用 Backspace/Delete 键将输入框文字全部删除并停止输入满 300 毫秒
Then 顶部展示区原旧项目名 'Project-Beta-2026' 立即被清除，恢复为初始灰色占位文字 '【等待输入核对】'，输入框下方即时呈现红色警示文字 '项目名不能为空，请输入有效字符'，输入框边框变红并带有 aria-invalid='true'，输入框保持空值可编辑状态，光标保持在输入框内。

Scenario 4: 纯空格防抖拦截、旧结果清除与原始空格保留
Given 页面顶部展示区正呈现项目名
When 开发者在输入框中输入三个半角空格 '   ' 并停止输入满 300 毫秒
Then 顶部展示区原项目名被清除并恢复为占位提示，输入框下方呈现红色警示，且输入框内的三个半角空格完好保留，光标保持在输入框内。

Scenario 5: 补充有效输入后错误自动恢复
Given 界面正处于 Scenario 3 或 4 的错误提示状态
When 开发者在输入框中补充键入有效字符 'Valid-Name' 并停止满 300 毫秒
Then 错误提示自动销毁，aria-invalid 属性被移除，输入框边框恢复正常，顶部展示区大字正常呈现 'Valid-Name'。

Scenario 6: 清空后旧节点迟到 compositionend 与尾随 input 不得重显或造错（反例 A 合成守卫验证）
Given 用户在旧输入框 node_1（bornGeneration=1）中启动拼音输入法合成，尚未完成选词
When 用户直接点击底部橙色圆形清空按钮（触发 node_1.replaceWith(node_2)，inputGeneration 递增为 2），且随后向已脱离 DOM 的 node_1 派发迟到的旧 compositionend 事件与尾随 input 事件
Then node_1 闭包检测到 node_1 !== activeInputNode 且 1 !== 2 立即直接返回，新输入框 node_2 的 value 保持为空字符串 ''，顶部展示区保持占位提示 '【等待输入核对】'；等待 350 毫秒后复查，展示区始终显示 '【等待输入核对】'，页面绝不出现空值错误提示，控制台 0 报错；该项验证合成隔离对旧节点/旧闭包的有效性，原生输入法会话终结及真实表现待真机实测。

Scenario 7: 新节点输入后旧节点 compositionend 不得抹除新草稿或取消新定时器
Given 用户在 node_1 键入拼音后点击清空，系统生成新节点 node_2（bornGeneration=2, inputGeneration=2）
When 用户立即在 node_2 中键入 'Brand-New-2026' 并启动 300ms 防抖，随后向 node_1 派发迟到的旧 compositionend 事件
Then node_1 闭包拒绝执行并不操作 activeInputNode，node_2 的 300ms 防抖定时器未被取消，node_2 的 value 完好保持为 'Brand-New-2026'；满 300 毫秒后顶部展示区大字呈现 'Brand-New-2026'。

Scenario 8: 新节点启动新合成后旧节点 compositionend 不得提前结束新合成（反例 B 合成守卫验证）
Given 用户在 node_1 键入后点击清空生成 node_2，随后用户在 node_2 中启动新的中文输入法拼音输入（node_2 闭包 isComposing 变为 true）
When 向 node_1 派发迟到的旧 compositionend 事件
Then node_1 闭包被守卫拦截直接返回，node_2 闭包中的 isComposing 保持为 true，新拼音草稿不被提前校验，等待新选词上屏后满 300 毫秒正常呈现最终中文项目名。

Scenario 9: 旧定时器已出队后被清空或新输入抢占，旧回调执行作废无效
Given 用户在输入框中键入 'Temporary-Draft'，300ms 定时器即将到期并已出队进入宏任务队列
When 用户在定时器回调执行前瞬间点击清空按钮（触发 schedulerEpoch 递增并清空），或录入新字符
Then 定时器回调执行时检测到 thisEpoch !== schedulerEpoch（或 targetGeneration !== inputGeneration），立即退出返回，不调用 ValidatorModule，不更新 DOM 展示区，展示区保持为 '【等待输入核对】'。

Scenario 10: 极端恶意脚本标签纯文本安全回显（DOM 纯 TextNode 验证）
Given 开发者在输入框中录入包含 XSS 攻击向量的恶意代码 `<script>window.__xss_flag = true; alert('XSS');</script><svg onload=alert(1)>`
When 停止输入满 300 毫秒防抖触发
Then 顶部展示区将上述字符完整作为纯文本安全显示，控制台 window.__xss_flag 值为 undefined，页面不弹出任何系统警报框，DOM 树中展示区子节点仅包含纯 Text 节点，无 HTML 元素被创建。

Scenario 11: 节点物理替换后五类持久属性、可访问性（ARIA）与焦点保留精确验证
Given 输入框具有完整持久配置：label 关联（id='project-name-input', name='projectName'）、ARIA 属性（aria-label='项目名输入', aria-describedby='project-input-help', aria-required='true'）、键盘导航（tabindex='0'）、样式表现（class='input-control active', style.borderWidth='2px'）、自定义测试属性（data-test='project-input'），且带有瞬态属性 aria-invalid='true'
When 用户点击清空按钮触发 node.replaceWith(newNode)
Then 新 input 节点满足以下 6 项断言：
1. label 关联保持：newNode.id === 'project-name-input' && newNode.name === 'projectName'；
2. ARIA 配置保持且瞬态重置：newNode.getAttribute('aria-label') === '项目名输入' && newNode.getAttribute('aria-describedby') === 'project-input-help' && newNode.getAttribute('aria-required') === 'true'，而瞬态 newNode.hasAttribute('aria-invalid') 为 false；
3. 键盘导航保持：newNode.tabIndex === 0 && newNode.getAttribute('tabindex') === '0'；
4. 样式表现保持：newNode.className === 'input-control active' && newNode.style.borderWidth === '2px'；
5. data-* 属性保持：newNode.dataset.test === 'project-input' && newNode.getAttribute('data-test') === 'project-input'；
6. 状态重置与回焦：newNode.value === ''，旧节点闭包隔离失效，document.activeElement === newNode。

Scenario 12: 双模式本地加载自包含性验证（file:// 与 localhost:8080）
Given 开发者将交付产物 index.html, styles.css, app.js, README.md 置于本地同一目录
When 分别通过文件双击（file://）与本地服务（python -m http.server 8080 / npx serve . --listen 8080 访问 http://localhost:8080）打开
Then 两种模式下界面呈现完全一致，无确认按钮，实时防抖核对、清空复位与错误提示逻辑均零网络依赖正常运行，控制台无报错。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-python-http-server-port-official、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9、evidence-17569c8c-1012-4071-8ebe-936b5fe286db；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148

## 交付前置验证任务：本地双击直接运行与多浏览器兼容性实测（原生IME节点替换事件派发）

ID：blk-deliv-val-standalone-runtime；关联需求：blk-tech-stack、blk-tech-deployment；任务前置：blk-deliv-task-package；蓝图原始依赖：blk-deliv-task-package

对交付产物在各桌面现代浏览器环境下的本地直接双击（file://）与轻量本地服务（localhost:8080）兼容性进行实测，核验中文拼音输入法合成与清空替换节点的事件派发与隔离表现，如实记录实测日志与待验证状态。

目标：验证交付产物在桌面端 Chrome、Edge、Firefox 及 Safari 环境下本地双击运行与 HTTP 托管的兼容性，并通过合成事件与真实原生输入法双层测试核验清空替换节点的事件隔离表现

范围：覆盖 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100 的本地 file:// 与 localhost:8080 双模式启动审查；合成反例 A 与反例 B 的事件闭包隔离测试；原生输入法真机测试协议与日志归档；Safari 跨平台语法静态核查与真机待测记录

排除：合成隔离保证严格限于旧节点/旧闭包拦截；坚决删除“旧原生 compositionend 若重定向到新节点 generation guard 会拒绝”的错误推论，删除“极其罕见”无依据主观词；不承诺彻底杜绝所有浏览器未定义原生竞态，不伪造容器测试通过或 Safari 已测记录

模块：AppController、InputController、ResetController

正常行为：在各主流现代桌面浏览器双击 index.html 正常渲染，输入 300ms 自动展示，清空即时复位；合成测试中旧节点事件被旧闭包守卫直接拦截丢弃；原生输入法清空实测记录完整日志，新节点键入输入流转顺畅

异常行为：若合成测试中旧节点事件穿透至新节点，排查闭包引用与代际核验逻辑；在原生真机测试中，若特定浏览器原生输入法将事件重定向派发至新活跃节点（此时 generation guard 无法拦截），或替换节点导致新会话异常中断：如实记录浏览器版本、OS、输入法及完整事件 Trace；执行失败处理预案：优先修订清空策略（例如在 replaceWith 前显式调用 oldNode.blur() 强制终结原生 IME 会话，或在清空瞬间对新节点设立微秒级 IME 重定向时间窗防护），重新执行全量回归用例；不自造原生 token、不宣称永久隔离、不伪造自动通过保证

验证：
- 验证合成事件注入下旧节点事件被闭包守卫拦截（newNode.value === '' && 占位符不变）
- 查验真机实测日志表记录的浏览器、OS 与 IME 信息
- 查验失败处理预案是否明确为真机重定向时修订清空策略并回归，无任何“极其罕见”或“代际守卫可拦截重定向”等错误承诺

完成条件：
- Windows 环境下 Chrome, Edge, Firefox 本地双击 index.html 0 报错直接运行，300ms 防抖与清空重置行为一致
- 合成事件隔离核验通过：旧输入框脱离 DOM 后派发的 compositionend 与 input 被闭包守卫直接拦截，新输入框保持空值且无空值提示
- 原生中文输入法下进行清空真机实测，详细记录测试日志表（包含 Browser, OS, IME, Event Log）；若出现重定向或会话异常中断，启动修订清空策略预案并回归
- Safari 浏览器跨平台代码语法检查通过，真机实测标明需要 macOS 真实环境的前提，当前规划期如实标为 unexecuted

假设：宿主桌面操作系统（Windows 10/11）已安装现代桌面浏览器（Chrome, Edge, Firefox）与原生输入法；macOS 12+ 与 Safari 15+ 真机环境在当前规划期容器中不可用，列为开发阶段真机验证用例

环境：桌面 PC（Windows 10/11，具备 Chrome/Edge/Firefox 最新稳定版与原生输入法；macOS 12+ 配备 Safari 15+ 待开发阶段实测），本地无网络或离线模式，本地 file:// 协议与 localhost:8080

步骤：
- 1. 双击 index.html 打开 Chrome/Edge/Firefox，核对 file:// 协议下界面渲染与 0 报错；
- 2. 在控制台执行合成隔离测试：获取当前 activeInputNode，触发清空生成 newNode；向 oldNode 派发 compositionend 与 input 事件；断言 oldNode 闭包直接返回，newNode.value 保持为空，350ms 后展示区保持占位符，无报错；
- 3. 启动本地中文输入法键入拼音未确认，点击清空，记录原生事件派发流；断言新节点正常聚焦，新键入正常流转；
- 4. 记录 Windows 宿主机下 Chrome, Edge, Firefox 浏览器版本、OS 版本与测试结果；
- 5. 记录 Safari 测试在规划期容器与 Windows 宿主机不可用状态（unexecuted），确立开发阶段 macOS 实测步骤。

通过标准：
- 本地双击 index.html 在 Chrome、Edge、Firefox 控制台 0 报错；
- 合成事件测试中，向脱离 DOM 的旧节点派发 compositionend 与 input，新节点 value 保持为空，350ms 后无空值提示；
- 真实中文输入法清空实测形成规范的日志记录表（含 OS、Browser、IME 及事件序列）；
- Safari 与真机未测项诚实标记为 unexecuted 待开发验证。

证据：Windows 宿主机下 Chrome/Edge/Firefox 双击打开控制台无报错截图与日志导出；原生 IME 清空替换事件捕获日志记录表（包含 browser, os, ime, event_type, target, currentTarget, value, isTrusted）

失败后：若双击发生跨域错误，排查是否混入了 ES Module 或外部外链；若原生 IME 实测出现重定向导致新节点状态异常，根据真机日志修订清空策略并执行端到端回归。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-python-http-server-port-official、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-exp-docker-env-unavailable-r4；批准操作：api-automated-acceptance-flash-materials-final-20261005-02-feedback-1791160237148
