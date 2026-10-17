# 真实集成验证-flash-vague-20261004-03 — 开发入口

版本：24；批准蓝图：cd386b1e2b6f9264b79c5291dddf1fe1677e246f82ebf66eb4e555be7baf8fe1

阅读 PROJECT → PRODUCT → USER_FLOWS → UX_UI_SPEC → TECHNICAL_GUIDE → DEVELOPMENT_PLAN → ACCEPTANCE → AGENTS。

首个可执行任务：task-foundation-and-storage — 工程基座搭建与 Dexie 存储驱动封装实现任务。按 tasks.json 和 DEVELOPMENT_PLAN 的共同顺序实施，先完成前置验证；未验证事项不能当作能力事实。实现失败时保留证据并向 Project Architect 反馈，修订相关方案后继续。

任务依赖仅沿已批准蓝图的 dependsOn 穿过非任务块，遇到首个 task 或 validation 端点即停止；requirementIds 不推断前置。任务按稳定拓扑顺序排列，同时可执行的任务按 ID 排序。未登记的语义前置不会由导出补造，发现后应提交质量反馈并审阅修订。

这是规划交付，不表示目标项目已经被开发或实测。
