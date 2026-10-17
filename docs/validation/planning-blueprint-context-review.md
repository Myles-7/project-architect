# 候选上下文投影与旧 Timeline rollback 的独立只读复核

本轮只读复核实现与调用路径，并在内存及独立临时项目中执行复现。没有修改实现或测试，没有调用真实 Provider、构建 dist、取消任务或操作真实控制项目。此文件是唯一新增报告；主 Agent 的全量验收仍另行执行。

## 候选上下文投影

复核位置：`apps/server/src/planning/PlanningBlueprintContext.ts`、`PlanningRuntime.ts:296–303`、`PlanningContext.ts`、`PlanningResultView.ts`、`PlanningPrompt.ts` 及 `planning-blueprint-context.test.ts`。

当前实现的权限边界成立：

- Helper 只计算本次实际候选覆盖的 ID，过滤 Provider context 中同 ID 的正式旧正文；没有拼接另一个 canonical 蓝图，也没有状态写入。
- 输入来自角色消费视图。research/validation/review 的旧 groups 不供正文；最新草案与未完成范围来源只选有验证结果的 completed authoring。`unfinishedScopes.previousCandidateSources` 保留真实任务 ID 与 replace/remove 动作。
- 同一 ID 同时有 replacement/removal 时，元数据标为 `replacement-and-removal`，原候选数组仍保留两个动作，不在本地裁决。
- 未覆盖正式块完整保留；被遮盖块的 id/stage/kind/title、locked、approvedBy、approvedAt 保留在 `shadowedApprovedBlocks`。
- `candidateStatus: pending-user-approval` 明确候选身份；Prompt 已准确描述 `currentDraft` 可能局部，并说明省略旧正文不等于正式解锁或批准。
- Helper 返回新的上下文数组/对象，没有改变传入正式蓝图、候选或缺失范围引用；Runtime 仍返回完整 `snapshot`，只把投影写入 `contextText`。basis hash、`basis.json`、canonical results、receipts 的写入路径没有被这个 Helper 改动。

独立内存检查 replacement、removal、replacement/removal 冲突、unfinished replacement、unfinished removal、无候选六种情况，均通过；检查了正式输入不变、锁定标记保留、pending 身份与未覆盖正文。

最初发现的 P2 已由主 Agent 修复：design 分片的显式 authoring 依赖正文通过 `workerResults[taskId]` 传入，但旧 Helper 最初只考虑 currentDraft/draft/unfinishedScopes，会重复提供同 ID 的正式旧正文。当前 Runtime 已把实际发送的 role-filtered workerResults 作为 dependencies 传给 Helper，新增测试覆盖真实 authoring 依赖与 legacy support 隔离。本复核读取了修正后的调用及回归，不把此前缺口列为当前未修问题。

验证边界：六种独立检查是 Helper 的只读行为检查；现有 Runtime 回归验证正式蓝图 hash 未改变。它们不能代替主 Agent 的最终全量测试，也不声称已经独立逐个复核所有 basis/receipt 文件字节。静态调用链显示此投影没有触及这些持久化路径。

## 旧 Timeline rollback 的 P1 风险

### P1：提交形成目标旧状态与当前规划状态的混合快照

`packages/core/src/engine/ProjectStateEngine.ts:2821` 的 rollback candidate 只传 metadata/decisions/assumptions/gaps/risks/questions/readiness/overview，漏掉 planning、blueprint、changesets、documents。`StateCommitManager.ts:287–317` 会从当前 canonical 文件继承未传部分，所以新 revision 不等于目标 revision，尽管注释和 UI 声称恢复至该版本状态。

影响包括正式蓝图、输入、主题、证据、审批与变更包仍来自较新版本，而决定和其他状态来自较旧版本；PlanningService 的依据反映/失效投影不能把这种混合状态还原成目标快照。

### P1：旧写接口没有客户端版本与幂等保护

`apps/server/src/server.ts:1747–1753` 只解析 targetRevision；`apps/web/src/api/client.ts:631–640` 只发送该字段；Timeline 确认动作也没有 expectedRevision 或 operationId。

提交层仍有服务器读后的 currentRev CAS，可拒绝这段时间发生的竞态，不能据此声称完全没有并发保护。但在请求开始之前已经过期的确认仍会被当作基于当前状态的 rollback；网络重试或重复提交也会再次创建 revision，可能覆盖第一次 rollback 之后的新操作。这违背正式写入必须携带 expectedRevision/operationId 的重构契约。

### P1：损坏历史可被提升为新的合法快照

`ProjectStateEngine.ts:2760–2789` 只检查目标 metadata 文件存在，然后直接读取目标 JSON，没有调用 `StateCommitManager.verifySnapshot` 校验该目标 manifest/hash。loadProject 验证的是当前 revision；commit 对新写入内容生成新 manifest，不能证明目标历史原内容未被篡改。

因此外改目标历史 JSON 可以通过 rollback 被重新写成一个通过新 manifest 校验的正式版本。

## 临时项目复现

使用 bundled Node 与 Vite SSR source loader 读取 Core 源码（middleware 模式，无监听服务、无构建）。在系统临时目录 `pa-rollback-review-*` 建立 fixture 项目，用真实 Core/PlanningService 的 propose/approve/recordInput 路径生成版本。所有写入及故意修改仅发生在该临时目录；完成后关闭 loader 并校验清理目标位于系统临时目录后删除。

复现输出：

| 观察 | 实际结果 |
| --- | --- |
| 目标 revision | 3 |
| rollback 前当前 revision | 6 |
| 第一次 rollback 新 revision | 7 |
| 目标正式正文 | `TARGET_APPROVED_BODY` |
| rollback 后实际正式正文 | `NEWER_APPROVED_BODY` |
| 目标输入 / rollback 后输入 | 1 / 2 |
| 目标 changeSets / rollback 后 changeSets | 1 / 2 |
| 同 target 重复 rollback | 再生成 revision 8 |
| 故意修改目标 revision 3 的 metadata 后 verifySnapshot | `false` |
| 随后 rollback 新 revision | 9 |
| 新正式 metadata.name | `TAMPERED_HISTORICAL_METADATA` |

这些数值来自独立临时项目的实际执行结果，不来自真实控制任务。现有 `tests/product-hardening/phase1-5-enhancements.test.ts:173` 只检查旧 decision statement 恢复，不能覆盖以上规划状态完整性、目标 hash、客户端版本或重试问题。

## 最小安全处理

当前工具整合阶段停用不完整 rollback 写入口、把历史保留为只读是合理的最小边界：UI 去掉恢复动作，服务器写端点也明确拒绝，避免仅隐藏按钮后仍可直接调用；保留所有现存历史数据。不要把当前不完整接口标成已恢复完整方案，也不临时开发未经设计的完整恢复功能。

以后若正式设计恢复操作，至少明确客户端 expectedRevision/operationId、目标 manifest/hash 验证、完整业务状态的原子恢复、不可回退的操作幂等账本、文档/开发包引用有效性、活动运行边界与可追踪恢复事件。恢复缺失的旧格式字段应基于明确迁移规则，不能默认继承较新的业务状态。
