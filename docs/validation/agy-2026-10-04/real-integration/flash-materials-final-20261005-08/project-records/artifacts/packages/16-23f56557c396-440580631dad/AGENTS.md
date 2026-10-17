# 真实集成验证-flash-materials-chinese-20261005-01 — 目标项目开发约束

版本：16；批准蓝图：23f56557c396d422187a7074a7dcd68399496cf62762ffadf96d429a507f7612

按已批准蓝图和任务实施。不得把未执行试验写为通过，不得越过任务依赖。需求变化或关键验证失败时提交反馈，等待相关方案修订。

Project Architect 自身的技术栈与存储限制不适用于此项目。

## 非目标与排除能力

ID：blk-prod-non-goals；关联需求：项目目标；依赖：blk-prod-scope

明确排除以下所有能力扩张：
1. 服务端支持：不引入任何后端 API、Node.js 服务端运行时或网络请求；
2. 数据库与持久化：不依赖 IndexedDB/LocalStorage/远程数据库作为长期数据仓库；
3. 用户鉴权与权限：无登录、注册、Token 管理或鉴权逻辑；
4. 协同与支付：无多人协作、链接分享或商业化计费体系；
5. 不将 fixture.png 中的示例文字“Q7M4-8261”转为业务需求或固定业务约束。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 产品功能与边界范围

ID：blk-prod-scope；关联需求：项目目标；依赖：blk-prod-outcomes

本产品严格限定为纯前端单页面应用。包含：
1. 单个文本输入框（用于输入项目名，监听实时输入变化与中文输入法合成事件）；
2. 300ms 防抖自动展示调度机制（输入变化等待 300ms 自动触发非空校验、XSS 安全纯文本渲染并展示大字，输入法合成期间不触发，选词上屏后计时，输入框内容完好保留）；
3. 顶部高对比项目名展示区域（支持纯文本安全渲染、初始灰字占位与超长文本自动折行换行）；
4. 清空重置按钮（一键复位界面状态、立即取消未完成的 300ms 待展示防抖任务，并自动回焦输入框）；
5. 就地错误警示展示与异常保留输入机制；
6. 基于 fixture.png 的白底与控件空间排布映射（依据已确认决策 dec-visual-layout-mapping 彻底移除确认按钮及其专属逻辑，仅保留白底背景、顶部大字展示与底部橙色圆形清空操作控件）。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518

## 技术栈选型与运行规范（防抖调度与确认按钮解耦）

ID：blk-tech-stack；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

技术栈严格遵守纯前端单页面边界约束，采用纯原生 HTML5、CSS3 与现代原生 JavaScript（ES2022+ 标准）：
1. 标记层（HTML5）：标准语义化标签（<main>, <section>, <input>, <button>），彻底移除确认按钮节点，通过 WAI-ARIA 属性（aria-live="polite"）辅助就地错误提示展示；
2. 表现层（CSS3）：CSS Flexbox 弹性布局规范，彻底移除原蓝色确认按钮相关样式，保留橙色圆形清空按钮样式（#FF5500），全局盒模型 box-sizing: border-box 与文本折行规则 word-break: break-all，实现清爽白底与高对比排布；
3. 交互与控制层（ES2022+）：纯原生现代 JavaScript，使用原生 DOM API（Document.querySelector, Node.textContent, HTMLElement.focus）与标准定时器 API（setTimeout, clearTimeout），通过原生 input 与 compositionstart/compositionend 事件监听驱动 300ms 防抖调度，零外部 npm 依赖，离线直接运行；
4. DOM 安全输出：全面采用 W3C/WHATWG 标准 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML，杜绝 DOM 型 XSS；
5. 运行环境兼容：兼容现代主流桌面浏览器（Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15），零转译原生执行。

来源：evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-htmlinputelement、evidence-mdn-document-queryselector、evidence-mdn-css-flexbox、evidence-mdn-node-textcontent-official、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e；批准操作：api-automated-acceptance-flash-materials-chinese-resume-20261005-06-feedback-1791149585518
