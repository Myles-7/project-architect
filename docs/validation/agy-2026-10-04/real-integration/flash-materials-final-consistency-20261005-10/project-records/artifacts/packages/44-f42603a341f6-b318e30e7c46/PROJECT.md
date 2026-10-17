# 真实集成验证-flash-materials-chinese-20261005-01 — 目标与边界

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

## 目标用户与使用场景

ID：blk-prod-target；关联需求：项目目标；依赖：无

面向个人开发者本地独立开发与核对测试场景。用户需要在桌面浏览器中快速核对原型项目名的输入与即时视觉反馈，桌面优先，单人单机使用，无需跨设备同步、无多用户协作与无身份认证。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 核心问题与痛点分析

ID：blk-prod-problem；关联需求：项目目标；依赖：blk-prod-target

解决个人开发者在本地进行轻量原型验证时缺乏即时、低干扰核对界面的问题。痛点包括：常规测试页面常依赖网络请求或复杂脚手架，难以进行秒级纯客户端反馈；在空值或异常提交时若缺乏提示或粗暴清空用户输入，会导致重复录入测试数据，严重降低核对效率。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 非目标与排除能力

ID：blk-prod-non-goals；关联需求：项目目标；依赖：blk-prod-scope

明确排除以下所有能力扩张：
1. 服务端支持：不引入任何后端 API、Node.js 服务端运行时或网络请求；
2. 数据库与持久化：不依赖 IndexedDB/LocalStorage/远程数据库作为长期数据仓库；
3. 用户鉴权与权限：无登录、注册、Token 管理或鉴权逻辑；
4. 协同与支付：无多人协作、链接分享或商业化计费体系；
5. 不将 fixture.png 中的示例文字“Q7M4-8261”转为业务需求或固定业务约束。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 产品功能与边界范围（输入节点替换与代际闭包隔离）

ID：blk-prod-scope；关联需求：项目目标；依赖：blk-prod-outcomes

本产品严格限定为纯前端单页面应用。包含：
1. 单个文本输入框（用于输入项目名，监听实时输入变化与中文输入法合成事件）；
2. 300ms 防抖自动展示调度机制（输入变化等待 300ms 自动触发非空校验、XSS 安全纯文本渲染并展示大字，输入法合成期间不触发，选词上屏后计时，输入框内容完好保留）；
3. 顶部高对比项目名展示区域（支持纯文本安全渲染、初始灰字占位与超长文本自动折行换行）；
4. 清空重置按钮（一键复位界面状态、立即取消未完成的 300ms 待展示防抖任务，并自动回焦输入框；采用清空时替换输入节点与节点代际闭包隔离机制彻底作废旧节点事件与旧定时器）；
5. 就地错误警示展示与异常保留输入机制（空值校验失败清除旧项目名展示并恢复占位符，输入框既有内容原样保留）；
6. 基于 fixture.png 的白底与控件空间排布映射（依据已确认决策彻底移除确认按钮及其专属逻辑，仅保留白底背景、顶部大字展示与底部橙色圆形清空操作控件）。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 预期产品成效与真实衡量口径目标（节点代际隔离与性能闭合）

ID：blk-prod-outcomes；关联需求：项目目标；依赖：blk-prod-problem

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

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-d686fe73-a405-4933-a3a6-7da164ea5c01、evidence-7a463cf7-74f1-4627-b9b3-24784ae3a9bc、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 已批准关键决定

- 严格限定为纯前端单页面应用，桌面优先，无服务端、无数据库、无用户登录与无协作支付，所有状态仅在客户端内存运行时维护。（dec-product-scope-boundary；来源 change-c463e392-91bc-4076-b7fb-514ce507bc3f-delivery-1:api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096）
- 在空值提交或任何意外运行时异常时，严格保留输入框内的既有输入文本，仅就地呈现醒目提示，绝不强制抹除用户输入。（dec-failure-preserve-input；来源 change-c463e392-91bc-4076-b7fb-514ce507bc3f-delivery-1:api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096）
- 采用受控的单向客户端纯内存状态模型管理页面生命周期，不引入任何本地持久化存储。（dec-tech-in-memory-state；来源 change-61512c88-a371-461b-be4a-0a18237f2b2e-delivery-0:api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340）
- 关于页面视觉布局映射与确认按钮的存在形式，是否采纳需求变更提议彻底删除蓝色确认按钮并重构为单按钮实时反馈排布？
彻底移除确认按钮，重构为单清空按钮纯实时反馈布局（推荐）：采纳用户需求变更材料提议，从 HTML DOM、CSS 样式与交互控制器中彻底删除确认按钮，仅保留顶部大字展示区、居中输入框与底部右侧橙色圆形清空按钮，完全通过 300ms 防抖触发自动展示。（dec-visual-layout-mapping；来源 answer:simulated-answer-flash-materials-chinese-resume-20261005-05-1791147651373）
- 技术架构采用纯原生 HTML5 + CSS3 + 现代原生 JavaScript（标准经典脚本搭配 defer 属性与 IIFE 命名空间闭包隔离），支持本地双击（file://）零配置直接运行，并兼容本地轻量静态 HTTP 服务器托管；不引入外部重型前端框架与打包工具。（dec-tech-stack-native-classic-defer；来源 change-e7a309b3-95fb-462f-82b1-222e72e31a5e-delivery-0:api-automated-acceptance-flash-materials-quality-20261005-01-feedback-1791151879316）
- 项目名展示区必须使用 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML；恶意标记等特殊字符必须以纯文本原样回显，失败与校验异常时保留输入。该约束严格限定于项目名展示节点的纯文本渲染，不作为全应用杜绝 DOM XSS 的绝对证明。（dec-safe-text-rendering；来源 change-17d98e59-12ea-4a62-8cdf-8b4e2911cd23-delivery-1:api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566）
- 交付标准纯静态单页面自包含产物（index.html, styles.css, app.js, README.md），模式 A 支持本地无依赖直接双击运行（file:// 协议，无前提纯离线）；模式 B 支持本地轻量静态 HTTP 服务器托管（固定端口 8080，使用 python -m http.server 8080 或 npx serve . --listen 8080 访问 http://localhost:8080），明确 npx 工具首次需联网的前提，不新增任何服务端业务代码。（dec-tech-deployment-zero-server；来源 change-17d98e59-12ea-4a62-8cdf-8b4e2911cd23-delivery-1:api-automated-acceptance-flash-materials-quality-resume-20261005-03-feedback-1791153974566）
- 在点击清空按钮时，采用即时直接清空、清空状态事务（Reset Transaction）与节点物理替换＋代际闭包隔离及失败原子拓扑回滚机制：清空操作定义为具备快照准备、替换提交与原子回滚的两阶段状态事务。点击清空时首先捕获包含活跃节点、代际、调度纪元、草稿与DOM位置的快照，并显式记录 replacement 状态；在替换成功与新状态就绪前不提前递增全局代际；若在创建、属性复制、replaceWith、展示复位、错误清理或焦点恢复任意阶段抛出异常，立即触发原子回滚（物理回插原节点并彻底移除已挂载的新节点，恢复单一输入框合法DOM拓扑与唯一ID，消除双输入框缺陷R6-B1；还原代际/纪元与草稿，针对原始草稿无差别重新调度防抖，消除丢失空值/纯空格任务缺陷R6-B2），原闭包契约严格自洽（bornGeneration === inputGeneration），用户可继续输入、手动删空与重试；事务完全提交后递增代际，旧节点迟到事件因代际与节点失配被旧闭包守卫丢弃，新节点顺畅流转 300ms 防抖；严重回滚失败在独立只读 textarea 容器中原样呈现草稿供手动选中复制，提示诚实且绝不刷新页面；规划期蓝图以模块接口参数、状态所有权与提交/回滚后置条件为权威契约，内部代码示例降级为非执行参考示意。（dec-clear-interaction-mode；来源 change-c4b3c93d-c8f4-45f9-9233-3b60120ec026-delivery-0:api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287）
