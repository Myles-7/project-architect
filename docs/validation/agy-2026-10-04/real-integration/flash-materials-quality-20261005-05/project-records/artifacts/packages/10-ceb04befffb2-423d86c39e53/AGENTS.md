# 真实集成验证-flash-materials-chinese-20261005-01 — 目标项目开发约束

版本：10；批准蓝图：ceb04befffb2b189662f4785067b15a396095e468c64c83460bfcc2465bac71c

按已批准蓝图和任务实施。不得把未执行试验写为通过，不得越过任务依赖。需求变化或关键验证失败时提交反馈，等待相关方案修订。

Project Architect 自身的技术栈与存储限制不适用于此项目。

## 产品功能与边界范围

ID：blk-prod-scope；关联需求：项目目标；依赖：blk-prod-outcomes

本产品严格限定为纯前端单页面应用。包含：
1. 单个文本输入框（用于输入项目名，支持键盘 Enter 快捷提交）；
2. 确认提交按钮（触发非空校验、XSS安全过滤与大字展示）；
3. 顶部高对比项目名展示区域（支持纯文本安全渲染与超长文本自动换行）；
4. 清空重置按钮（一键复位界面状态与自动回焦）；
5. 就地错误警示展示与异常保留输入机制；
6. 基于 fixture.png 的白底与控件空间排布映射。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-mdn-textcontent-xss-safety；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 非目标与排除能力

ID：blk-prod-non-goals；关联需求：项目目标；依赖：blk-prod-scope

明确排除以下所有能力扩张：
1. 服务端支持：不引入任何后端 API、Node.js 服务端运行时或网络请求；
2. 数据库与持久化：不依赖 IndexedDB/LocalStorage/远程数据库作为长期数据仓库；
3. 用户鉴权与权限：无登录、注册、Token 管理或鉴权逻辑；
4. 协同与支付：无多人协作、链接分享或商业化计费体系；
5. 不将 fixture.png 中的示例文字“Q7M4-8261”转为业务需求或固定业务约束。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096

## 技术栈选型与运行规范

ID：blk-tech-stack；关联需求：blk-prod-scope、blk-prod-outcomes；依赖：blk-prod-scope

技术栈选型严格遵守已批准的纯前端单页面边界约束，采用纯原生 HTML5、CSS3 与现代原生 JavaScript（ES2022+ 标准）：
1. 标记层（HTML5）：采用标准语义化标签（<main>, <section>, <form>, <input>, <button>），通过 WAI-ARIA 属性（如 aria-live="polite"）辅助就地错误提示展示，不依赖任何第三方 UI 库；
2. 表现层（CSS3）：采用 CSS Flexbox 弹性布局规范，通过现代 CSS 自定义属性管理主题色（如确认按钮底色 #2F65F6、清空按钮底色 #FF5500），配置全局盒模型 box-sizing: border-box 与文本折行规则 word-break: break-all，实现忠实还原 fixture.png 的白底与高对比度排布；
3. 交互与控制层（ES2022+）：采用纯原生现代 JavaScript（ESM 模块化），使用原生 DOM API（Document.querySelector, Node.textContent, HTMLElement.focus）与原生事件模型（addEventListener, Event.preventDefault），零外部 npm 运行时依赖，完全支持离线本地直接运行；
4. DOM 安全输出：全面采用 W3C/WHATWG 标准 Node.textContent 属性进行纯文本绑定，严禁使用 innerHTML，从根本上杜绝 DOM 型 XSS 漏洞；
5. 运行环境兼容：兼容主流现代桌面浏览器（Chrome ≥ 100, Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15），零需转译即可原生执行。

来源：evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-mdn-htmlinputelement、evidence-mdn-document-queryselector、evidence-mdn-css-flexbox、evidence-mdn-node-textcontent-official；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-technical-1791130980340
