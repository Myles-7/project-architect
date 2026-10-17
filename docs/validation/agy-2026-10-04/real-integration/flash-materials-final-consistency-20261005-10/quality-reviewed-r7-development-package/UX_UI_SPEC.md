# 真实集成验证-flash-materials-chinese-20261005-01 — 页面、交互与状态

版本：44；批准蓝图：f42603a341f64a8eed7777e47e7491d76a4cb8aead8c749cbb7ee57071234a31

## 页面职责与参考图空间结构映射（节点物理替换、五类持久属性与事务拓扑回滚）

ID：blk-page-main-layout；关联需求：blk-prod-scope；依赖：blk-prod-scope

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

来源：evidence-a8866f76-4ae6-466b-8fab-a69b806b7336、evidence-fc126627-6e55-40e5-8be5-388ef378a21b、evidence-e10045cb-3170-4cb6-9c56-de754c9c69da、evidence-37699c07-e70f-4d97-b809-4d68ad503428、evidence-7fc79de9-07c0-43c1-b09d-641f14530819、evidence-6b1b2275-ff1a-4b49-bb31-827dd7eb8f8e、evidence-17569c8c-1012-4071-8ebe-936b5fe286db、evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261005-04-feedback-1791166110287
