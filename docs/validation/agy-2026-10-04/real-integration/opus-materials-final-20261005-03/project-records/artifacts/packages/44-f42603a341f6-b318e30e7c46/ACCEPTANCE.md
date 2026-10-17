# 真实集成验证-flash-materials-chinese-20261005-01 — 验收场景

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

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

## 验收标准：清空重置状态事务、单DOM拓扑恢复与无差别草稿重调度 Given-When-Then

ID：blk-acc-reset；关联需求：blk-feat-reset；依赖：blk-flow-reset

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
Given 输入框存在重要测试草稿 'Important Draft With\nMultiple Lines   and Spaces'
When 点击清空按钮，replaceWith 执行后抛出异常，且在回插原节点时再次发生严重 DOMException 导致回滚中断
Then 系统捕获严重异常，界面绝不执行 window.location.reload() 刷新页面，界面顶部横幅明确提示 '清空与回滚操作遇到严重异常，主编辑器暂时受限，已为您在下方安全保留草稿'，并在独立只读草稿容器（readonly textarea）中原样呈现原始 draft 文本，包含换行与空格逐字符完全一致，允许用户手动选中文本执行复制取回。

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

## 端到端集成验收规范：防抖实时核对、节点替换隔离、事务拓扑回滚与只读草稿复制 Given-When-Then

ID：blk-deliv-acc-full-e2e；关联需求：blk-feat-input-display、blk-feat-reset、blk-tech-error、blk-prod-outcomes；依赖：blk-deliv-task-package

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

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

## 交付前置验证任务：本地双击直接运行与多浏览器兼容性实测（原生IME事件与事务拓扑回滚）

ID：blk-deliv-val-standalone-runtime；关联需求：blk-tech-deployment、blk-deliv-spec-deployment；任务前置：blk-deliv-task-package；蓝图原始依赖：blk-deliv-task-package

在真实宿主环境验证本地单页面直接双击（file:// 协议）与静态 HTTP 服务模式的可用性，在 Chrome, Edge, Firefox, Safari 主流桌面浏览器实测原生 IME 输入法事件流转、清空事务两阶段提交与替换后各类抛错时的原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）及严重回滚失败只读草稿复制兜底。

目标：在真实宿主环境验证本地单页面直接双击（file:// 协议）与静态 HTTP 服务模式的可用性，在 Chrome, Edge, Firefox, Safari 主流桌面浏览器实测原生 IME 输入法事件流转、清空事务两阶段提交与替换后各类抛错时的原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）及严重回滚失败只读草稿复制兜底

范围：覆盖 Windows 10/11、macOS 12+ 宿主机，在 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15 下实测 file:// 启动、8080 端口静态服务托管、原生 IME 输入法在合成态清空后的事件派发与拦截、清空事务在准备期、replaceWith 过程、替换后步骤抛错时的原子拓扑回滚断言（单 input、0 重复 ID、无 replacement 残留）、空值/纯空格任务重调度断言、以及严重失败只读草稿复制验证

排除：不冒充规划阶段已经实测通过，不把合成 DOM 测试宣称为真实浏览器测试，不把 Docker/Chromium 宿主不可用写成项目约束

模块：AppController、InputController、ResetController、DebounceScheduler、DisplayRenderer、FeedbackBanner

正常行为：双击 index.html 正常打开无报错；原生中文输入法合成期间不触发防抖，选词上屏后 300ms 展示；清空事务正常提交时旧节点迟到事件被隔离拦截；清空事务在替换前、替换中、替换后任意环节注入异常时，均原子回滚恢复单一原节点（0 replacement 残留、0 重复 ID），还原代际，针对 snapshot.draft 重新调度防抖，空值与纯空格在 300ms 后忠实清除旧展示并显警示；用户可继续键入 'Edited after failure' 正常大字呈现；严重回滚失败在只读 textarea 中原样呈现草稿供手动复制，禁止刷新

异常行为：若在多浏览器实测中发现某浏览器在 replaceWith 抛错时未清理 replacement 节点、空值待任务未重新调度、或原生 IME 将迟到事件重定向至新节点，立即报告失败，排查并优化 ResetController 事务状态机与事件监听策略后复测

验证：
- 检查在各浏览器中双击 index.html 均正常启动无报错
- 在控制台执行 DOM 拓扑断言：document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1
- 注入各阶段清空异常，验证单 input 拓扑、草稿无差别重调度、以及严重失败只读复制兜底
- 输出包含操作系统、浏览器版本、IME 引擎及实测结果的跨平台兼容性报告

完成条件：
- 主流桌面浏览器在 file:// 协议与 http://localhost:8080 模式下正常运行，0 报错
- 实测原生 IME 输入法在合成态下清空，旧事件被安全拦截，不污染新节点，不产生空值报错
- 实测清空各阶段异常注入均触发原子拓扑回滚，DOM 树中有且仅有单一输入框（0 replacement 残留，0 重复 ID），原草稿与焦点完好恢复
- 实测空值与纯空格草稿在回滚后无差别重新调度，300ms 后忠实清除旧展示并展示错误提示，空格原文保留
- 实测严重回滚失败在只读 textarea 中原样呈现草稿供手动复制，未发生页面刷新
- 在规划期受控试验环境不可用时如实标记为 unexecuted，所有实测结论由真实浏览器测试日志背书

假设：目标应用产物 index.html, styles.css, app.js, README.md 已开发就绪且处于同一目录；宿主设备具备桌面图形环境与现代主流浏览器（Chrome, Edge, Firefox, Safari），支持物理键盘与原生中文 IME 输入法

环境：桌面 PC 宿主机（Windows 10/11, macOS 12+, Linux），主流现代桌面浏览器稳定版（Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15），真实原生操作系统中文拼音输入法引擎；规划期环境因宿主工具 Docker 不可用且目标产物未实现，实测如实标为 unexecuted，留待 Delivery 实施阶段执行

步骤：
- 1. 在 Windows 宿主机上分别启动 Google Chrome、Microsoft Edge 与 Mozilla Firefox 最新稳定版，直接双击打开 index.html（file:// 协议加载），检查控制台无 CORS 错误与资源加载报错；同时启动 python -m http.server 8080 与 npx serve . --listen 8080，访问 http://localhost:8080 验证两启动模式表现完全一致；
- 2. 在输入框中使用原生拼音输入法输入中文，验证拼音合成期间展示区不更新，选词上屏后满 300ms 正常大字呈现；在合成态期间点击清空，验证新节点 value 保持为空，旧节点迟到事件被丢弃，350ms 后无空值错误；
- 3. 在输入框录入 'Alpha'，点击清空并在创建新节点阶段注入异常，验证 catch 触发回滚，activeInputNode 仍为原节点，代际未增，草稿与焦点保留；
- 4. 在输入框录入 'Beta'，点击清空并在 replaceWith 成功后注入 renderPlaceholder 异常，执行断言：document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，验证已挂载的新节点被彻底移除，原节点原位插回，原草稿完好且保持焦点；
- 5. 在输入框输入三个半角空格 '   '（或删空文本）并发起 input 调度，在 300ms 定时器未到期前点击清空且注入 replaceWith 失败触发回滚，验证回滚后重新调度 300ms 任务，满 300ms 后展示区旧项目名被清除并恢复占位符，输入框下方出现红色非空提示，三个空格完好保留；
- 6. 验证回滚后用户继续键入 'Edited after failure' 正常更新大字，手动删空正常提示，再次清空正常流转且依然保持单输入框；
- 7. 注入严重回插失败，验证页面未被重新加载（window.location.reload 未被调用），界面在只读 textarea 容器中原样呈现原始 draft 供复制。

通过标准：
- file:// 协议与 http://localhost:8080 下主流浏览器（Chrome, Edge, Firefox, Safari）正常渲染无控制台错误；
- 原生 IME 输入法合成期间防抖挂起，选词上屏后 300ms 正常大字呈现；
- 清空替换后旧节点迟到事件不污染新节点，不修改新会话，不制造空值错误；
- 清空事务在替换前、替换中、替换后抛错回滚后，DOM 中有且仅有 1 个 input 节点（document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留），原节点处于聚焦态；
- 空值与纯空格草稿在回滚后无差别重新调度，300ms 后清除旧展示并呈现非空警示，空格原文保留；
- 回滚后用户键入 'Edited after failure' 正常流转 300ms 防抖更新，再清空依然为单输入框；
- 严重回滚失败在独立只读 textarea 中原样呈现草稿，包含换行与空格，支持手动选中复制，无页面刷新。

证据：各浏览器控制台执行输出日志、DOM 树节点数量与 ID 唯一性断言记录（document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留）、空值/纯空格任务 300ms 调度与提示呈现日志、原生 IME 输入法在合成态下触发清空后的迟到事件派发与拦截流转日志、以及只读草稿文本复制验证记录

失败后：阻断交付验收，记录浏览器版本与异常事件日志，修复拓扑回滚或草稿重调度逻辑后全量回归

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-26818016-03f1-4e6f-87b3-afaa4fdfeb82、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-python-http-server-port-official、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287
