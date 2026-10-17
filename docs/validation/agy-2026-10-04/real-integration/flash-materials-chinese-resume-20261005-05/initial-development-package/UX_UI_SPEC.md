# 真实集成验证-flash-materials-chinese-20261005-01 — 页面、交互与状态

版本：10；批准蓝图：ceb04befffb2b189662f4785067b15a396095e468c64c83460bfcc2465bac71c

## 页面职责与参考图空间结构映射

ID：blk-page-main-layout；关联需求：blk-prod-scope；依赖：blk-prod-scope

本地单页面原型核对视图（Single Page View），基于 fixture.png 原生像素信息进行视觉与空间布局映射：
1. 视觉底色：纯白底色（#FFFFFF）清爽背景，无多余装饰纹理；
2. 顶部展示区域：映射 fixture.png 上方“Q7M4-8261”视觉层级与相对空间位置，作为核对结果大字展示区（初始显示灰色占位文字，确认后以高对比黑色大字显示，支持 break-word 换行防撑破）；
3. 底部主操作控件：映射 fixture.png 下方左侧蓝色矩形色块，呈现为蓝色实心矩形外观的【确认】主操作按钮；
4. 底部辅助操作控件：映射 fixture.png 下方右侧橙色圆形色块，呈现为橙色实心圆形外观的【清空】辅助操作按钮；
5. 输入表单区域：在桌面端位于展示区与底部按钮区之间居中排布，提供单行文本输入框，保持操作动线自上而下流畅连贯；
6. 状态覆盖：涵盖就绪初始态（占位灰字）、正常核对态（大字黑色显示）、错误提示态（红字就地显示）、异常防护态（顶部横幅警示）与纯离线本地加载态。

来源：evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f；批准操作：api-automated-acceptance-flash-materials-chinese-20261005-01-product-1791130586096
