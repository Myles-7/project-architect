# 真实集成验证-flash-materials-chinese-20261005-01 — 开发入口

版本：40；批准蓝图：b4d67494b2c801973621da35a43d36697eb9de0d93f6d5b38e0cec7616f3ddc3

阅读 PROJECT → PRODUCT → USER_FLOWS → UX_UI_SPEC → TECHNICAL_GUIDE → DEVELOPMENT_PLAN → ACCEPTANCE → AGENTS。

首个可执行任务：blk-deliv-task-layout-styling — 交付任务：单按钮精简视觉布局实现与确认按钮样式剔除。按 tasks.json 和 DEVELOPMENT_PLAN 的共同顺序实施，每个任务满足其前置条件后才开始；可独立执行的能力试验可以先验证，依赖实现或打包的集成验证须在相应任务完成后执行。未验证事项不能当作能力事实。实现或验证失败时保留证据并向 Project Architect 反馈，修订相关方案后继续。

任务依赖仅沿已批准蓝图的 dependsOn 穿过非任务块，遇到首个 task 或 validation 端点即停止；requirementIds 不推断前置。任务按稳定拓扑顺序排列，同时可执行的任务按 ID 排序。未登记的语义前置不会由导出补造，发现后应提交质量反馈并审阅修订。

这是规划交付，不表示目标项目已经被开发或实测。
