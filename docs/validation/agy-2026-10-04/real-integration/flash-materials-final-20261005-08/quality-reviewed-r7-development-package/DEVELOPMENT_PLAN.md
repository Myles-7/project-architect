# 真实集成验证-flash-materials-chinese-20261005-01 — 全阶段开发任务

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

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

## 交付任务：一键即时清空、输入节点五类持久属性复制与状态事务原子拓扑回滚交付

ID：blk-deliv-task-reset-workflow；关联需求：blk-feat-reset、blk-tech-module、blk-tech-interface；任务前置：blk-deliv-task-layout-styling；蓝图原始依赖：blk-deliv-task-layout-styling、blk-tech-module、blk-tech-interface

实现一键即时直接清空、五类持久属性完整复制、瞬态属性重置、输入节点物理替换（replaceWith）、两阶段状态事务提交与失败原子拓扑回滚（彻底移除新节点保真单输入框、原始草稿无差别重调度），彻底隔离旧节点迟到事件。

目标：实现一键即时直接清空、五类持久属性完整复制、瞬态属性重置、输入节点物理替换（replaceWith）、两阶段状态事务提交与失败原子拓扑回滚（彻底移除新节点保真单输入框、原始草稿无差别重调度），彻底隔离旧节点迟到事件

范围：ResetController 模块实现，包含两阶段提交、持久配置复制、DOM 拓扑回插与新节点清理、snapshot.draft 无差别重调度、以及 FeedbackBanner 联动

排除：不引入模态确认弹窗，不设置二次撤销条，不破坏已批准单按钮极简交互，不使用 innerHTML 渲染草稿

模块：ResetController、InputController、DebounceScheduler、DisplayRenderer、FeedbackBanner

正常行为：点击清空捕获包含原节点、代际、纪元、草稿与 DOM 位置的快照；在内存实例化新节点并复制 5 类持久属性，绑定新闭包；取消防抖调度并执行 oldNode.replaceWith(newNode)；复位展示区为占位符并清除错误；新节点获取焦点；原子提交更新 activeInputNode 与 inputGeneration；旧节点迟到事件被入口守卫拦截丢弃

异常行为：若清空流程在准备期、替换过程或后续呈现/清理/聚焦阶段抛错，catch 立即触发原子拓扑回滚：显式移除 replacement 节点并回插原节点，确保 DOM 树中单一输入框且 ID 唯一；还原代际与活跃节点；针对 snapshot.draft（涵盖 empty/whitespace/nonempty）无差别重调度防抖；顶部呈现友好横幅，用户可继续编辑重试；严重回滚失败在只读 textarea 容器中呈现原文供复制，坚决不刷新页面

验证：
- 在输入框含有项目名时点击清空，核对展示区立即显示占位符，输入框被替换且内容为空，焦点自动移入新输入框，无二次确认弹窗
- 查验清空替换后新输入框的 id, name, aria-label, aria-describedby, aria-required, tabindex, class, style, data-test 完好保留，value 严格为空且无 aria-invalid 属性
- 在创建新节点或属性复制阶段注入异常，验证 catch 触发回滚，activeInputNode 仍为原节点，代际未增，草稿与焦点保留
- 在 replaceWith 成功后注入 renderPlaceholder 异常，验证 rollback 显式移除 newNode 并回插 oldNode，断言 document.querySelectorAll('#project-name-input').length === 1，document.querySelectorAll('input').length === 1，0 replacement 残留，草稿完好且获得焦点
- 在输入三个空格产生防抖任务后清空并注入 replaceWith 失败，验证回滚后重新调度 300ms 任务，满 300ms 后展示区旧项目名被清除并恢复占位符，输入框下方出现红色非空提示，三个空格完好保留
- 注入严重回插失败，验证页面未发生刷新（window.location.reload 未被调用），界面在只读 textarea 容器中原样呈现原始 draft 供复制

完成条件：
- ResetController.handleReset 完整实现两阶段清空状态事务，提交前与回滚后状态严格自洽
- 持久配置复制安全保留 label 关联、ARIA、tabindex、class/style、data-* 全部 5 类持久属性，单独重置 value 与瞬态校验状态
- 替换后发生异常时回滚准确移除 replacement 节点并回插原节点，断言文档中有且仅有单一输入框（0 replacement 残留，0 重复 ID）
- 若发起清空时有排队任务，回滚无差别针对 snapshot.draft 重新调度防抖，空值与纯空格在 300ms 后清除旧展示并展示非空提示，空格原文保留
- 严重回滚失败在独立只读 textarea 容器中原样呈现原始 draft 供复制，坚决不刷新页面

假设：现代主流桌面浏览器支持标准 DOM 操作方法（replaceWith, replaceChild, remove）与严格模式 IIFE 闭包；用户使用键盘与鼠标进行单人单机本地原型核对，无多标签同步状态诉求

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

## 交付任务：防抖校验拦截、就地提示、旧结果清除、清空事务拓扑回滚与只读草稿复制容错交付

ID：blk-deliv-task-error-handling；关联需求：blk-tech-error、blk-feat-reset；任务前置：blk-deliv-task-input-workflow、blk-deliv-task-reset-workflow；蓝图原始依赖：blk-deliv-task-input-workflow、blk-deliv-task-reset-workflow、blk-tech-error

实现空值/纯空格校验拦截、旧结果彻底清除、输入保留、清空事务三阶段异常原子拓扑回滚（单 DOM 节点保真、草稿无差别重调度）、以及严重失败独立只读草稿复制兜底容器呈现。

目标：实现防抖校验拦截、就地提示、旧结果清除、清空事务拓扑回滚与只读草稿复制容错交付

范围：ValidatorModule 纯函数、FeedbackBanner 就地提示与全局横幅、只读 textarea 兜底容器装配、与 ResetController 回滚协同

排除：不使用模态弹窗，不静默降低输入保留标准，不使用刷新页面掩盖严重失败，不依赖系统剪贴板异步写入权限

模块：ValidatorModule、FeedbackBanner、ResetController、DisplayRenderer

正常行为：300ms 到期后校验：有效字符通过 Node.textContent 安全渲染；空值或纯空格清除旧展示恢复灰色占位，就地红字提示，空格保留；清空回滚时按原草稿重调度，空值/纯空格同样在 300ms 后清除旧展示并出红字警示

异常行为：清空各阶段失败触发拓扑回滚，清除新节点并回插原节点，恢复原草稿并无差别重新调度；若回插严重失败，在只读 textarea 中原样呈现原始 draft 供复制，提示诚实说明未恢复，禁止刷新页面

验证：
- 先录入有效项目名并等待展示成功，随后将输入文字全部删空停止 300ms，验证旧项目名被清除，展示区恢复占位符，就地呈现红色提示且输入保持空值可编辑
- 在输入框中输入三个半角空格停止 300ms，验证旧项目名被清除并恢复占位符，就地显示红色提示，三个空格完好保留且输入框保持焦点
- 在清空替换后步骤注入异常，验证错误被捕获，replacement 节点被彻底移除，页面仅保留 1 个输入框且原草稿完好
- 在纯空格输入调度期间清空并注入失败，验证回滚后重新调度 300ms 任务，到期清除旧展示并展示错误提示，空格保留
- 注入严重回插失败，验证页面未被重新加载，只读草稿容器安全呈现原文供手动复制

完成条件：
- ValidatorModule 正确校验空值与纯空格，防抖回调触发时立即清除已展示的旧项目名并恢复占位符，就地红色提示醒目显示，原始输入（含空格）完好保留
- FeedbackBanner 具备 showInputError、clearInputError、showGlobalError 与 showSevereFallbackDraft 完整实现
- 清空流程三阶段异常均被捕获并原子回滚，显式移除 replacement 节点，DOM 树中有且仅有单一输入框，草稿无差别重调度有效工作
- 严重回滚失败在独立只读 textarea 容器中呈现原始草稿，禁止全局刷新

假设：遵循 DOM 规范与严格异常处理原则，输入框下方预留就地错误展示节点容器；单页面本地轻量运行，无服务端接口抛错干扰

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287

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
