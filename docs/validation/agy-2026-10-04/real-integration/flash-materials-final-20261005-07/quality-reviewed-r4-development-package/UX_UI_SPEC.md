# 真实集成验证-flash-materials-chinese-20261005-01 — 页面、交互与状态

版本：32；批准蓝图：d7d6052422f208b3042fa76c6347a9cc436abc3e1c1985ef56fc0f377f5ce8e2

## 页面职责与参考图空间结构映射（节点物理替换与无障碍属性保留）

ID：blk-page-main-layout；关联需求：blk-prod-scope；依赖：blk-prod-scope

本地单页面原型核对视图（Single Page View），基于 fixture.png 原生像素结构并在删除确认按钮后映射布局，并规范节点物理替换时的页面保真：
1. 视觉底色：纯白底色（#FFFFFF）清爽背景，无多余装饰纹理；
2. 顶部展示区域：映射 fixture.png 上方“Q7M4-8261”视觉层级与相对空间位置，作为核对结果大字展示区（初始显示灰色占位文字，300ms 防抖完成后以高对比黑色大字显示，支持 word-break: break-all 换行防撑破）；
3. 底部操作区域：依据已批准决策彻底移除原 fixture.png 左下蓝色矩形色块（确认按钮已删除），仅保留映射右下方橙色圆形色块的橙色实心圆形【清空】操作按钮（底色 #FF5500）；
4. 输入表单区域：在桌面端位于展示区与底部清空按钮区之间居中排布，提供单行文本输入框；在清空触发输入框节点替换（replaceWith）时，严格保持容器几何尺寸、边框、内边距、字体样式、id、name、label 关联及 WAI-ARIA 属性（aria-label）完全不变，避免界面发生跳动或焦点迷失；
5. 状态覆盖：涵盖就绪初始态（占位灰字）、防抖等待态（草稿输入中/IME选词中）、清空节点替换就绪态（新输入框已就绪回焦，旧节点解耦移出）、正常核对态（大字黑色显示）、错误提示态（红字就地显示）、异常防护态（顶部横幅警示）与纯离线本地加载态。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159
