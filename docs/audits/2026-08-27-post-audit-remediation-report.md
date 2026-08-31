# Project Architect 复审修复报告

- 日期：2026-08-27
- 范围：P0/P1 安全、状态一致性、B3 契约、异步 Discovery、多问题 UX、发布门禁
- 当前裁决：**代码修复完成；生产发布仍需重新执行真实 Provider Benchmark 与双人人工评审**

## 1. 分阶段修复方案与完成状态

### 阶段 A：P0 文件与状态安全

- ZIP 导出中的 Manifest 路径统一通过 `WorkspaceGuard.assertContained`，阻止 `../` 逃逸项目目录。
- Provider 返回的结构化 Risk 正式进入 Core 提交载荷并持久化，不再在 Orchestrator 到 State Engine 之间丢失。
- Fork 同时迁移数组旧格式和 `{ schemaVersion, turns }` 新格式的 Discovery Turn，重写 `projectId`，并把运行中任务改为 cancelled。
- 文档编译改为先纯渲染，再由 State Engine 校验路径、写入并提交；提交失败时恢复原文件或移除新文件。

### 阶段 B：B3 决策与问题正确性

- Provider 契约中的 Candidate、Assumption、Risk、Gap、Question 全部收紧为 B3 结构化对象；生产运行时拒绝字符串建议和缺失 key 的问题。
- Mock Provider 只在测试层迁移历史夹具，生产 Provider 不提供 B2.1 回退。
- QuestionSelector 不再用“同领域已有决策”误判某个独立 `decisionKey` 已解决；依赖解析优先使用精确 `decisionKey`，排序按严重度、产品区域优先级和稳定分数执行。
- 保存为假设时保留 Question/Gap 的 `area` 与 `decisionKey`；自动假设同样保留语义归属。
- 中文兜底题清理重复标点、命令式重复开头，并用中文引号标出产品领域。

### 阶段 C：异步任务、审计与 Revision

- DiscoveryTurnStore 遇到损坏 JSON 或非法 envelope 时显式报错，不再静默返回空历史。
- 同一 Turn 文件的 append/update 使用本地串行锁，避免并发读改写覆盖。
- Job 的 `acceptedRefs` 改为“任务完成快照减去调度时基线”，只记录本轮新增建议，不再把全部历史建议归给当前 Turn。
- 取消、超时和输出超限的 CLI 子进程立即返回确定状态；Windows 进程树清理不再让测试和后台任务悬挂。

### 阶段 D：多问题中文体验

- Chat 默认展示当前批次全部问题，逐题向导降为可选视图。
- 主操作改为“确认并继续”，直接走快速落盘路径；“立即推演”为次级动作，先保存回答再启动同一个后台任务。
- 跳过与 superseded 分别显示为“已跳过”和“已由新推演替换”，不再混淆用户意图。
- 问题卡片和 Overview 不再直接展示内部 Question/Gap/Decision ref。
- Overview 依据 `item.status` 判断 Candidate/Confirmed/Locked，不再从 ref 前缀猜测状态。
- Provider 诊断对 unknown 使用“无法确认/尚未确认”，区分“声明支持缓存”和“实际观测到缓存命中”。
- 移动端进入窄屏时默认关闭左右抽屉；从抽屉完成导航后自动关闭，避免遮挡主任务。

### 阶段 E：Benchmark 真实性

- 删除自动生成 `Architect_A` / `Architect_B` 满分评分的逻辑。
- Runner 支持 `--manual-reviews-file`，缺失真实证据时发布裁决必为 `NOT READY`。
- 每个 Case 必须有两份独立评审；五个维度各自平均分均需 ≥ 4，任何单项不得低于 3。
- 时延样本必须完整，且 p50 ≤ 30 秒、p95 ≤ 60 秒；报告表格不再硬编码 PASS。
- 原 B3 READY 报告已撤销并标记为不可作为发布证据。

## 2. 关键回归覆盖

- ZIP 路径穿越和工作区外文件写入。
- Risk 持久化、Fork 运行态清理、旧项目字段迁移。
- 同批 `decisionKey` 唯一性、已解决依赖、同领域独立问题并存。
- 每题即时 revision、假设语义保留、文档写入失败回滚。
- Turn Store 损坏检测与并发 append。
- `acceptedRefs` 仅包含本轮增量。
- 中文操作文案、内部 ID 隐藏、Provider unknown 诊断。
- Benchmark 无人工证据、维度低分和时延失败门禁。

## 3. 发布前剩余动作

代码与本地自动化门禁通过后，仍必须执行以下人工/外部验证，不能由单元测试替代：

1. 使用目标生产 Provider 重新运行全部 B3 Initial/Explore/Converge/Readiness 场景。
2. 为每个 Case 收集两份真实、独立、带证据引用的人工评分文件。
3. 确认结构化成功率、契约违规、五维评分和 30s/60s 时延门槛全部通过。
4. 进行真实浏览器的桌面、平板、390px 移动端主路径复验，并补做 NVDA 或同类屏幕阅读器抽查。

在上述证据完成前，产品可以继续内部试用，但不得把 Benchmark 状态标记为 READY。
