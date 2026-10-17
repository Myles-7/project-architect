# 真实集成验证-flash-materials-chinese-20261005-01 — 全阶段开发任务

版本：32；批准蓝图：d7d6052422f208b3042fa76c6347a9cc436abc3e1c1985ef56fc0f377f5ce8e2

任务依赖仅沿已批准蓝图的 dependsOn 穿过非任务块，遇到首个 task 或 validation 端点即停止；requirementIds 不推断前置。任务按稳定拓扑顺序排列，同时可执行的任务按 ID 排序。未登记的语义前置不会由导出补造，发现后应提交质量反馈并审阅修订。

## 交付任务：单按钮精简视觉布局实现与确认按钮样式剔除

ID：blk-deliv-task-layout-styling；关联需求：blk-page-main-layout、blk-tech-stack；任务前置：无；蓝图原始依赖：blk-page-main-layout、blk-tech-stack

依据删除确认按钮的反馈要求，彻底从 styles.css 与 index.html 中移除确认按钮样式与节点，仅保留顶部大字展示区、居中输入表单与底部橙色圆形清空按钮的清爽排布。

目标：依据删除确认按钮的反馈要求，彻底从 styles.css 与 index.html 中移除确认按钮样式与节点，仅保留顶部大字展示区、居中输入表单与底部橙色圆形清空按钮的清爽排布

范围：HTML 语义化节点精简与 CSS 样式表编写，包含白底背景、顶部大字居中折行排布、中部输入框与底部单个橙色圆形清空按钮的定位控制

排除：不保留蓝色矩形确认按钮的任何 CSS 规则，不引入复杂动画库

模块：DisplayRenderer、Styles

正常行为：页面背景为纯白（#FFFFFF），顶部大字展示区字体加粗高对比度（字号≥32px），中部输入框居中排布，底部仅呈现橙色实心圆形【清空】按钮（底色 #FF5500），界面开阔清爽，无多余按键干扰

异常行为：若视口宽度极窄，通过备用系统无衬线字体栈与 word-break: break-all 自适应换行，确保文本不截断不溢出

验证：
- 在桌面不同分辨率（1920×1080、1440×900）下查验页面渲染，确认界面无确认按钮残留且布局协调
- 检查顶部展示区在长文本下是否正常折行（word-break: break-all），无水平滚动条溢出
- 检查橙色圆形清空按钮的外观、背景色及 hover/active 反馈

完成条件：
- 完成 HTML DOM 与 styles.css 的完整样式编写，确认按钮完全移除
- 视觉元素忠实对应白底背景、顶部大字展示与底部橙色圆形清空色块
- 多分辨率下无布局撑破

假设：用户在桌面显示器下查看页面，浏览器支持标准 CSS Flexbox

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 交付任务：输入节点闭包绑定、草稿快照防抖调度与安全渲染交付

ID：blk-deliv-task-input-workflow；关联需求：blk-feat-input-display、blk-tech-module、blk-tech-interface；任务前置：blk-deliv-task-layout-styling；蓝图原始依赖：blk-deliv-task-layout-styling、blk-tech-module、blk-tech-interface

实现文本输入框的事件闭包监听、节点代际四重守卫核验、输入草稿快照捕获、DebounceScheduler 纪元防抖调度、IME 组合态闭包管理，以及 Node.textContent 安全展示逻辑，彻底杜绝到期重读 DOM 或执行作废回调，移除确认按钮专属逻辑。

目标：实现输入框事件闭包绑定、节点代际四重守卫核验、已接受草稿快照捕获、DebounceScheduler 纪元防抖调度、IME 组合态节点级管理及 Node.textContent 安全渲染，移除确认按钮与 Enter 提交专属逻辑

范围：InputController.bindInputNode 与四重守卫核验逻辑、DebounceScheduler.schedule(draftSnapshot, targetNode, targetGeneration, callback, delayMs) 调度实现、DisplayRenderer.renderProjectName 纯文本绑定及失败草稿保留

排除：不引入外部第三方防抖库，不使用 innerHTML，不进行网络请求，不绑定确认按钮与回车表单提交专属逻辑，不假称普通 InputEvent 自带应用自增令牌

模块：InputController、DebounceScheduler、DisplayRenderer、ValidatorModule

正常行为：用户在活跃输入框中键入有效字符，闭包通过 event.currentTarget === node && node === activeInputNode && bornGeneration === inputGeneration && document.body.contains(node) 守卫，在非合成态下捕获 draftSnapshot，传入 DebounceScheduler.schedule；300ms 到期后核验 thisEpoch === schedulerEpoch && targetGeneration === inputGeneration，针对 draftSnapshot 校验通过后使用 Node.textContent 安全渲染大字，输入框完好保留当前草稿供二次微调；拼音合成期间通过闭包私有 isComposing 挂起防抖；脱离 DOM 的旧节点事件在闭包入口被立即返回丢弃

异常行为：若输入恶意标签字符（如 <script>），严格通过 textContent 作为纯文本节点回显；若遇到空值或纯空格，立即清除旧项目名并恢复占位符，输入框内容原样完好保留；若闭包守卫检测到代际或节点不匹配，立即直接 return，绝不修改新节点状态或制造空值错误

验证：
- 在输入框输入常规项目名 'Project-Alpha-01' 停止 300ms，核对顶部大字自动即时显示且输入框文本保留
- 使用中文拼音输入法键入中文，核对拼音输入未确认选词时不发生展示更新，选词上屏后满 300ms 准确展示中文字符
- 模拟在旧节点输入后触发清空生成新节点，随后向旧节点派发迟到的 compositionend 与 input 事件，核对旧事件被拦截丢弃，新节点 value 保持为空，350ms 后无空值错误且展示区保持占位符
- 在新节点输入 'Brand-New' 期间向旧节点派发 compositionend，核对新节点防抖定时器未被取消且草稿未被抹除，满 300ms 后大字正常展示 'Brand-New'
- 在输入框输入 '<img src=x onerror=alert(1)>' 停止 300ms，核对展示区原样输出纯文本标签字符串，无控制台告警或弹窗执行
- 连续快速键入 10 个字符，核对防抖计时器被正确重置，仅在最终停止 300ms 后触发一次展示更新

完成条件：
- 完成 InputController.bindInputNode 与 DebounceScheduler 编码，输入变化等待 300ms 自动展示大字
- 事件前置四重守卫完整生效，非活跃节点事件直接 return，不误操作新节点
- DebounceScheduler 严格接收并使用草稿快照 draftSnapshot，核验 schedulerEpoch 与 targetGeneration
- 输入法合成期间挂起防抖，选词完成后启动 300ms 倒计时
- 顶部大字通过 Node.textContent 作为纯文本节点渲染，恶意字符原样回显
- 展示成功后输入框内容完好保留，方便用户二次编辑微调

假设：浏览器支持标准 Window 定时器与原生 DOM API，主线程事件循环正常调度；用户使用桌面键盘与输入法进行单人单机本地原型核对

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 交付任务：防抖校验拦截、就地提示、旧结果清除与异常保留输入容错交付

ID：blk-deliv-task-error-handling；关联需求：blk-tech-error、blk-tech-interface；任务前置：blk-deliv-task-input-workflow；蓝图原始依赖：blk-deliv-task-input-workflow、blk-tech-error

实现严密的 300ms 防抖非空校验拦截、就地错误警示挂载、旧项目名展示清除，以及发生错误或异常时严格保留用户既有输入的容错机制。

目标：实现严密的 300ms 防抖非空校验拦截、就地错误警示挂载、旧项目名展示清除，以及发生错误或异常时严格保留用户既有输入的容错机制

范围：ValidatorModule 规则校验、FeedbackBanner 挂载与销毁、DisplayRenderer 占位恢复与旧结果清除、全局 window.onerror 兜底防护及输入框草稿保留控制

排除：不进行异步服务端校验，不在空值时粗暴抹除输入框内的既有输入文本

模块：ValidatorModule、FeedbackBanner、AppController、DisplayRenderer

正常行为：当输入为空字符串或全为空白字符（空格、制表符）且停止输入满 300ms 时，防抖回调触发校验未通过，展示区已显示的旧项目名立即被清除并恢复为初始灰色占位文字 '【等待输入核对】'，在输入框下方动态挂载 <div class="error-tip" aria-live="polite">项目名不能为空，请输入有效字符</div>，输入框边框高亮红色，输入框内现存字符（含空格）完全保留不被抹除，光标停留在输入框内；当用户补充键入有效字符并等待 300ms 时，自动移除错误提示并更新展示区

异常行为：若事件处理或 DOM 操作发生意外未捕获异常，顶层 try-catch 拦截并在顶部弹出告警横幅 '系统遇到异常，已为您保留当前输入'，绝不执行重载或清空输入框 value，确保开发者输入不丢失，允许用户继续修改并重试

验证：
- 先输入有效旧项目名 'Old-Alpha' 并等待 300ms 展示成功；接着将输入文字全部删空并等待最新 300ms 防抖任务执行，核对旧项目名被清除，展示区恢复灰色占位符 '【等待输入核对】'，输入框下方呈现红色提示 '项目名不能为空，请输入有效字符'，且输入框保持空值可编辑焦点保留
- 输入三个纯半角空格 '   ' 停止 300ms，核对展示区同样恢复占位符且旧项目名不保留，出现红色错误提示，但输入框内的三个半角空格完好保留未被清空
- 人为模拟 JS 运行时报错，核对错误横幅正常浮现，输入框文本原样保留可继续编辑

完成条件：
- 空值或纯空格防抖结束后产生明确就地可见提示（非原生浏览器气泡），并清除旧结果恢复占位符
- 严格遵守 dec-failure-preserve-input，任何失败场景绝不抹除用户已输入的内容（保留输入空格或字符）
- 具备全局异常拦截与友好提示，页面绝不崩溃白屏

假设：用户在核对过程中可能反复进行空值测试或编辑微调

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

## 交付任务：一键即时清空、输入节点物理替换与焦点恢复交付

ID：blk-deliv-task-reset-workflow；关联需求：blk-feat-reset、blk-tech-module、blk-tech-interface；任务前置：blk-deliv-task-layout-styling；蓝图原始依赖：blk-deliv-task-layout-styling、blk-tech-module、blk-tech-interface

落实底部橙色圆形清空按钮的即时复位逻辑，第一优先级调用 DebounceScheduler.cancel() 废弃排队防抖任务，递增 inputGeneration，创建全新 input 节点替换旧节点（oldNode.replaceWith(newNode)），复位展示区为占位符并移除错误，光标自动回焦新输入框，无二次确认阻断。

目标：落实底部橙色圆形清空按钮的即时复位逻辑，取消待展示防抖任务，递增代际并通过 replaceWith 物理替换输入框节点，解耦旧节点迟到事件，复位展示区，光标自动回焦新输入框，无二次确认阻断

范围：ResetController 编码实现，DebounceScheduler.cancel() 调用、inputGeneration 单调递增、全新 input 节点属性复制与 replaceWith DOM 物理替换、新节点闭包事件绑定、展示区恢复占位文本、历史错误清除与 activeInputNode.focus() 调用

排除：不弹出 window.confirm 或任何阻塞式模态弹窗，不设置撤销等待定时器，不刷新浏览器页面，不把强制清新 DOM 作为拒绝旧事件手段

模块：ResetController、DebounceScheduler、InputController、DisplayRenderer、FeedbackBanner

正常行为：用户点击橙色圆形清空按钮，系统立即调用 DebounceScheduler.cancel() 销毁待展示任务并递增 schedulerEpoch，递增 inputGeneration，创建新 input 元素并完整复制 id、name、class、placeholder、aria-label 属性，为新节点绑定新闭包并执行 oldNode.replaceWith(newNode)，将 activeInputNode 指向新节点，将顶部展示区重置为灰字占位符 '【等待输入核对】'，移除错误高亮和提示节点，并立即执行 activeInputNode.focus() 回焦输入框；旧节点迟到事件只能到达旧闭包并被直接拒绝丢弃，新节点键入、粘贴与新合成直接可用

异常行为：若执行重置逻辑捕获到异常，保留当前页面状态，在控制台打印排查日志并在界面呈现温和提示，页面不崩溃不跳转，用户可手动清空或重试

验证：
- 在已有输入内容和展示结果的状态下点击清空，验证无阻断弹窗，DOM 中 input 节点成功替换，新节点继承属性且 value 为空，页面各区域瞬间恢复初始待命态
- 在键入字符后 150ms 立即点击清空按钮，验证待展示任务被完全取消，后续展示区无文字幽灵回显
- 在输入法拼音输入过程中点击清空按钮，验证当前输入框被替换，此后旧节点派发的迟到 compositionend 及尾随 input 事件不产生任何回填或报错
- 验证点击清空后，键盘光标自动回焦至新输入框内，敲击新按键或启动新输入法合成可直接继续正常防抖录入
- 验证清空前后输入框在页面中的几何布局不发生任何视觉跳动，label 与 aria-label 正常可访问

完成条件：
- 严格遵守 dec-clear-interaction-mode，即时直接清空，无二次确认阻断
- 同步复位输入框、展示区与错误提示，并销毁排队中的防抖任务，递增 schedulerEpoch 使旧回调失效
- 通过 replaceWith 物理替换 input 节点，完整保留 id、name、label 关联、class 样式与 aria-label 属性
- 为新节点绑定独立闭包（bornGeneration=inputGeneration），使旧节点尾随事件完全解耦并被守卫拦截，不制造空值错误
- 光标准确自动回焦至新输入框，后续新输入顺畅恢复正常防抖调度

假设：用户接受误触清空需重新输入的代价（已在决策中确认）；纯客户端内存单向流转，浏览器支持标准 Element.replaceWith DOM API

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 交付任务：静态产物装配、端口契约文档与交付包就绪

ID：blk-deliv-task-package；关联需求：blk-deliv-spec-deployment；任务前置：blk-deliv-task-error-handling、blk-deliv-task-input-workflow、blk-deliv-task-layout-styling、blk-deliv-task-reset-workflow；蓝图原始依赖：blk-deliv-task-layout-styling、blk-deliv-task-input-workflow、blk-deliv-task-reset-workflow、blk-deliv-task-error-handling、blk-deliv-spec-deployment

完成剔除确认按钮后的 index.html、styles.css、app.js 与 README.md 静态装配与交付验证，统一本地 HTTP 服务端口为 8080 并明确启动命令契约与离线前提。

目标：完成剔除确认按钮后的 index.html、styles.css、app.js 与 README.md 静态装配与交付验证，统一本地 HTTP 服务端口为 8080 并明确启动命令契约与离线前提

范围：交付包文件结构组织、无外部 CDN 依赖检查、HTML/CSS/JS 静态关联校验与文档编写，依赖全部底层实现任务完成

排除：不引入任何 npm 打包构建链，不保留确认按钮残留代码，不依赖远程外部网络资源

模块：Packaging、Documentation

正常行为：交付目录下 4 个文件同级放置，index.html 中不含确认按钮，app.js 包含 DebounceScheduler 与经典脚本 defer 加载；双击直接在现代桌面浏览器中正常呈现界面；README 记录 python -m http.server 8080 与 npx serve . --listen 8080，访问 http://localhost:8080 正常核对流转

异常行为：若文件缺失或相对路径错误，README.md 明确同级约束，app.js 进行 DOMContentLoaded 状态断言并在控制台清晰输出报错

验证：
- 检查交付目录下包含 index.html、styles.css、app.js 与 README.md 四个文件且均在同一级目录
- 检查 index.html 与 styles.css 中无任何确认按钮相关元素与类名定义
- 检查 README.md 中记录的本地 HTTP 服务命令为 python -m http.server 8080 与 npx serve . --listen 8080，且访问地址明确为 http://localhost:8080，标注 npx 首次需联网前提
- 双击 index.html 直接打开，验证实时输入 300ms 自动展示与清空取消功能无报错运行

完成条件：
- 所有交付文件就绪且相对路径关联正确，彻底移除确认按钮相关代码
- 支持本地无依赖直接双击运行与轻量服务器启动双模式，本地服务端口统一指定为 8080 且命令与地址一致
- README.md 包含详细的防抖实时反馈操作说明、python/npx 启动命令与离线前提说明

假设：用户在现代桌面操作系统（Windows/macOS/Linux）下获取交付目录；操作系统已安装现代主流桌面浏览器作为默认网页查看器

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-python-http-server-port-official；批准操作：api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566

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

## 交付前置验证任务：本地双击直接运行与多浏览器兼容性实测（原生IME节点替换事件派发）

ID：blk-deliv-val-standalone-runtime；关联需求：blk-tech-deployment、blk-tech-interface；任务前置：blk-deliv-task-package；蓝图原始依赖：blk-deliv-task-package

在现代主流桌面浏览器（Google Chrome、Microsoft Edge、Mozilla Firefox 及 Apple Safari）中，实测验证交付产物在 file:// 本地双击与 http://localhost:8080 托管下的运行一致性，并重点实测各平台原生中文输入法（IME）在清空替换节点时的真实事件派发差异、会话终结行为及焦点/无障碍表现。

目标：在现代主流桌面浏览器（Google Chrome、Microsoft Edge、Mozilla Firefox 及 Apple Safari）中，实测验证交付单页面自包含产物在 file:// 协议本地双击直接运行与 http://localhost:8080 托管下的运行一致性，并重点实测各平台原生中文输入法（IME）在清空替换节点时的真实事件派发差异、会话终结行为及焦点/屏幕阅读器无障碍表现。

范围：覆盖 Windows 10/11、macOS 12+ 宿主环境下 Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15 的双启动模式加载与原生 IME 节点替换交互测试；当前规划期容器环境无桌面真机与真实 IME，标记为 unexecuted 待开发验证阶段执行。

排除：不使用模拟合成事件替代真实操作系统原生 IME 输入测试；规划期不伪造已通过结论，不作彻底杜绝所有浏览器未定义行为的无证据绝对承诺

模块：InputController、ResetController、Packaging

正常行为：双击 index.html（file://）在各浏览器中直接打开，无 CORS 拦截；在各浏览器中通过原生 IME 录入拼音并点击清空，节点通过 replaceWith 被物理替换，光标正确聚焦新节点，旧输入法组合会话安全中断，无悬挂幽灵字符或空值错误；新节点直接继续中文录入正常流转 300ms 防抖；localhost:8080 下表现完全一致

异常行为：若某浏览器在节点被 replaceWith 移出 DOM 后仍将后续原生 compositionend 事件重定向派发至新活跃节点（极其罕见的原生行为），闭包守卫核对 event.currentTarget 与 bornGeneration 时因 generation 判定丢弃，保障新节点不被污染；若仍发生异常，记录具体浏览器版本与输入法名称，执行退回排查

验证：
- 在 Chrome、Edge、Firefox 桌面浏览器中分别直接双击 index.html 验证打开与正常交互
- 在各浏览器中录制原生拼音输入中途清空的操作，检查新节点 value 为空且展示区无旧结果
- 在 macOS Safari 环境下验证 file:// 协议与原生 IME 输入兼容性
- 对比 file:// 与 http://localhost:8080 表现，核验行为一致

完成条件：
- 在主流现代桌面浏览器（Chrome, Edge, Firefox, Safari）中实测覆盖原生 IME 节点替换与双启动模式
- 形成真机兼容性实测报告，明确各平台表现一致性
- 在当前规划阶段如实标记为 unexecuted 待验证状态

假设：目标应用产物（index.html, styles.css, app.js, README.md）已按照交付规范装配完成；宿主机已安装各目标主流浏览器及对应系统的原生中文拼音输入法（如微软拼音、macOS 原生拼音输入法）

环境：真实桌面 PC 环境（Windows 10/11 与 macOS 12+），已安装 Chrome 稳定版、Edge 稳定版、Firefox 稳定版与 Safari 桌面版，启用系统原生中文输入法

步骤：
- 1. 将交付产物置于 Windows 宿主机本地目录，双击 index.html 在 Chrome、Edge、Firefox 中分别打开，检查控制台 Console 是否 0 报错且地址栏为 file://；
- 2. 在各浏览器中使用系统原生拼音输入法在输入框输入 'xiangmu'（进入原生合成态，输入框显示带下划线的拼音字母组合），保持候选字窗口可见，直接使用鼠标点击底部橙色圆形清空按钮；
- 3. 检查输入框是否完成 DOM 节点替换，新输入框 value 是否为空且光标自动回焦新输入框；
- 4. 观察输入法候选词窗口是否自动关闭或断开连接；敲击 Enter 或向键盘发送确认，验证展示区是否保持 '【等待输入核对】' 占位符且页面不产生空值错误；
- 5. 立即在新输入框中键入 'Brand-New' 或开启全新拼音输入，验证 300ms 防抖倒计时正常触发，展示区大字正常呈现；
- 6. 在 macOS 真机环境下对 Safari 浏览器重复上述步骤 1 至 5，验证跨平台表现一致性；
- 7. 启动 python -m http.server 8080 或 npx serve . --listen 8080，在各浏览器访问 http://localhost:8080 重复上述验证，比对与 file:// 下表现的一致性。

通过标准：
- Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100 在 file:// 协议下直接双击打开正常，0 控制台错误；
- 各浏览器原生 IME 合成期间点击清空，节点成功替换，输入框复位且回焦新节点，后续无旧文本回显且无空值错误；
- 新节点无需额外解锁按键即可直接键入并正常流转 300ms 防抖展示；
- Safari ≥ 15 在 macOS 真机环境下行为一致；
- localhost:8080 与 file:// 表现完全一致。

证据：各浏览器开发者工具控制台截图、DOM 审查器节点引用变化记录及原生 IME 测试操作录屏或步骤日志

失败后：若在特定浏览器下发现原生 IME 在节点替换后产生异常事件流，根据实测日志优化 InputController 守卫规则（如在替换节点前主动触发 blur() 明确中断原生输入法会话），修复后重新在各平台执行全量回归。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-320443a6-461c-4976-9039-908598ac05f0、evidence-a2a11c7f-8620-4074-85d7-e1fd95310612、evidence-8978eaa8-d822-4c9c-a5c5-c60e914c2a91、evidence-f7c8f543-aa2f-4d11-bcf6-eb506e933aba；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

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
