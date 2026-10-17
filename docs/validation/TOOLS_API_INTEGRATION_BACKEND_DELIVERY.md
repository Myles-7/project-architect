2026-10-05：已按 `TOOLS_API_INTEGRATION_CORE_REVIEW.md` 实施后端最小整合，并补上独立复核发现的历史页只读边界。本子任务未编辑 `apps/web`、未触发真实 Provider、未更改既存真实控制记录，未提交或重置工作树。

| 已完成改动 | 实现位置与行为 |
| --- | --- |
| 旧入口退役 | `apps/server/src/server.ts` 的 readiness/review、readiness/approve、diagrams、verify-drift 在 JSON body parser 和项目解析前统一返回 410 `LEGACY_WORKFLOW_RETIRED`，无 revision/snapshot，recoverable=false；生产、Mock、注入 orchestrator 一致。 |
| Core 与间接文档发布 | `ProjectStateEngine.evaluateReadiness`、`setUserDisposition`、`completeDocumentCompilation` 保留签名并立即拒绝；`DocumentCompiler.compile` 的持久化路径立即拒绝，保留 persistFiles=false 历史内存渲染，删除旧磁盘写入分支。 |
| 当前开发包与旧图/审计 | 所有 documents/generate 模式走 PlanningPackageCompiler，不再 autoReApprove；历史 HTML 导出不再调用 MermaidGenerator；`scripts/pa.mjs verify` 明确失败且无 Core 导入或目录扫描。旧类型、历史读取、恢复器和历史纯渲染 fixture 保留。 |
| 只读状态读取 | `packages/core/src/planning/PlanningInspection.ts` 从 current 指针读取精确已提交 revision，检查基础形状及指针一致性，拒绝损坏/缺少片段与 symlink。正式 revisions 已存在而指针缺失时明确拒绝，不使用 canonical 镜像假装当前，也不恢复或迁移。 |
| 诊断与 Runtime Inspector | 新 `PlanningInspector.ts`、`PlanningDiagnostics.ts` 与 Runtime.inspect；GET diagnostics 从已注册真实项目位置读取当前共享配置、冻结 Run 配置、登记任务、调用回执及材料可读状态。损坏/权限错误保留安全原因，未知 metrics/usage 为 null。磁盘 running/queued 仅投影 interrupted，不写 run.json。 |
| 缺失 Run 来源 | 正式 changeSets.runId 和确定 Runtime 编码的 questions/cancel/proposal operation 键传入 expectedRunIds；引用的 Run/整个目录缺失会 partial、unknown/incomplete。真正无 Run 来源的新项目仍可返回 available 空集合。 |
| 历史只读接口 | GET `/api/projects/:id/planning/history` 返回 PlanningHistoryView 的 snapshot/state/runs/runtime；不读共享配置或调用回执。GET `/planning/history/documents/:documentId` 按已提交 documents.items.id 查登记 path，通过 WorkspaceGuard 后 raw readFile 读取，返回 historical 来源、保存的 hash 和 unchecked 完整性。两者不调用 load/get/list/recover。 |
| 开发包依据状态 | PlanningView.packageStatus 提供 current/stale/missing、原因、当前 basisHash 与 packageBasisHash，以语义依据判断，不用 revision 差代替，也不删除旧产物。 |

新增契约位于 `packages/contracts/src/planning-diagnostics.ts`，已通过 contracts barrel 导出。历史接口形状为 `{sourceStateRevision,snapshot,state,basisProjection,runs:PlanningRunDiagnostic[],runtime:DiagnosticSection}`（依据投影范围见下方最终修订）。历史文档形状为 `{content,documentId,docPath,sourceStateRevision,sourceRevision,storedContentHash,historical:true,source:'committed-legacy-document',integrity:'unchecked'}`。

验证结果：

- 16 个相关测试文件 **81/81 通过**，日志：`tools-api-backend-targeted-tests-20261005.txt`。包括全模式退役、坏 JSON/坏 ID/缺项目/重复与过期、无 Provider/旧引擎/扫描、目录及字节不变、统一批准蓝图编译、幂等及改动文件保护、历史 HTML/CLI、只读诊断、缺失来源 Run、中断提交与历史文档预览。
- 6 个既存 Planning API/runtime/package/context/draft/Core 测试文件 **133/133 通过**。这些回归验证批准、取消、恢复、冻结配置、草案修订、不可变回执与开发包行为仍成立。
- contracts/core/agent/server 源码的统一 TypeScript noEmit 检查 **通过（exit 0）**，日志：`tools-api-backend-typecheck-20261005.txt`。此检查使用 source paths，未写 dist。
- 受退役影响的旧测试已迁移到当前批准 Planning 发布或明确的历史 fixture；没有用跳过测试来维持旧写入行为。

证据边界：诊断仅观察轻量元数据；保存的 outputHash 和文档 hash 没有重新校验，不构成 resume 完整性认证。材料检查仅确认可读/普通文件，不提取内容或重新验证内容 hash。Provider 状态保持 unchecked，不把默认目录健康检查当作模型、视觉、工具或实验能力证明。未知值与缺失回执不会折成零消耗。错误不会包含原始 stderr、prompt/envelope、schema 路径或原始文件系统消息。

交付后本子任务停止修改源码，供 root 做独立统一复核与最终构建。

2026-10-05 复核修订：已处理独立报告中的两项 P2，并迁移全量回归发现的七个旧文档质量测试。

- `readProjectSnapshotReadOnly` 不再补写历史 `decisionBasisHash` 或把已提交 `approved` 投影成 `needs-revision`。原 snapshot/state 保留提交记录，旧字段缺失也原样保留。纯函数 `planningInspectionBasis` 在克隆的 blueprint/stages 上计算决定失效投影，供 Run 与开发包 freshness 比较使用。
- `PlanningHistoryView` 与 `ProjectPlanningDiagnostics` 新增顶层必需 `basisProjection:{source:'effective-planning-projection',revision,hash}`。Run 的 `basisStatus` 按该投影 hash 比较；它不声称历史 snapshot/state 已保存该推导值。Core 回归对照 `PlanningService.get`，确认缺 basis 与决定失效两种情况的当前语义依据一致，同时历史阶段仍为已提交值。
- Inspector 检查 events 序号从 1 连续，并检查 `nextEventSeq` 等于末尾序号加 1。缺口、边界不匹配、旧 Run 缺少该字段分别给 `SEQUENCE_GAP`、`NEXT_SEQUENCE_MISMATCH`、`NEXT_SEQUENCE_UNAVAILABLE` 安全原因，标 partial/incomplete、保留未知汇总 usage，不修改日志或 Run。活动记录可能遇到写入中的边界差异；此次观测保持 partial，不执行修复。
- 七个 document-compiler/golden-documents 测试改用 `tests/fixtures/historical-documents.ts` 的显式 `persistFiles=false` 内存历史渲染，保留 Python/非本地优先偏差、确认来源、锁定来源、动态文档和 freshness 的原质量断言；补充文档内容彼此不同、manifest 源版本正确及整个目录文件 hash 不变的断言。没有将这些质量测试降为旧入口拒绝测试。

本次实际验证：2026-10-05 09:00:30 首轮 **9 文件、36/36 测试通过**，覆盖 Core 只读 10 项、HTTP 诊断/历史 19 项和全部七个历史文档质量测试。加强 `PlanningService.get` 对照断言后，09:03:51 定向重跑 **2 文件、29/29 通过**，日志 `tools-api-inspection-fixes-targeted-20261005.txt`。09:02:13 另跑 legacy-tools-retirement、Planning API/package/Service/boundaries，**5 文件、73/73 通过**，日志 `tools-api-inspection-fixes-regression-20261005.txt`。统一 contracts/core/agent/server source noEmit **118 文件、0 诊断**，日志 `tools-api-inspection-fixes-typecheck-20261005.txt`；未生成 dist。

实现和验证证据已同步 `/root` 与 `/root/core_review`。未修改前端或父任务 Runtime 恢复/组装代码，也未调用真实 Provider、变更真实冻结控制或重置既存工作树。本子任务的修订已完成，供父任务统一构建和复核。

2026-10-05 共享投影最终修订：独立评审随后发现公开 `addDecision(...,'tech_stack',...)` 在 revision 4 的领域别名迁移，以及 revision 11 的旧部分批准反馈规则，会改变正式 `PlanningService.get` 的依据 hash。此前仅复制决定失效规则的 inspector 不足以覆盖正式语义。

- `PlanningService.projectSnapshot` 提取原正式读取后的完整投影规则，在 clone 上执行；`get` 与 `planningInspectionBasis` 共用该入口，不再维护第二套失效或反馈规则。旧部分反馈的 review 归属、阶段变为 `needs-revision`、删除 `approvedInputHash`、过期 ChangeSet 及清理提议都来自正式实现。
- 原 `ProjectStateEngine.loadProject` 的 additive gap/question/decision 规范化原样提取为 `ProjectStateMigration.normalizeLoadedRecords`，保留 loader 原先的执行顺序和 legacy ledger 参数。补 `evidenceRefs`、关联旧问题的 `decisionKey`、topic 记录与诊断规则只有一份；领域别名继续共用既有 `migrateInMemory`。Engine 的材料读取/hash校验、commit与恢复逻辑没有改变。
- 历史 snapshot/state 继续保留精确提交值。`basisProjection` 的完整形状为 `{source:'effective-planning-projection',revision,hash,materialBasis:{source:'committed-input-refs',integrity:'unchecked'}}`。这一 hash 采用已提交 `inputRefs`；inspection 不重新读取材料字节或更新材料状态。正常 `engine.loadProject` 会重新检查外部材料，所以外部材料发生变化时正常 I/O-loaded basis 可能不同。`Run.basisStatus='current'` 仅表示与上述明确范围相同，不证明材料内容完整性或完整的当前运行依据有效。diagnostics 的可读性检查也不替代内容 hash 校验。
- 正式测试新增公开 canonical/alias 决定、真实批准后的旧部分反馈、linked legacy question 与缺 `evidenceRefs` 的对照，并验证历史 JSON 与整个目录 bytes 不变。HTTP 新增外部材料修改用例：保留提交的材料状态和 Run 的范围内依据比较，同时明确返回 unchecked 材料范围。既有缺失 Run 测试改用完整 ChangeSet 夹具，仍验证 GET 200 下缺失来源被报告为 partial/unknown，没有降低原断言。

本轮定向回归在 2026-10-05 09:49:28 完成，Core inspection **14/14**、HTTP diagnostics/history **20/20**，共 **2 文件、34/34 通过**，日志 `tools-api-shared-projection-targeted-20261005.txt`。统一 source noEmit **118 文件、0 诊断**，日志 `tools-api-shared-projection-typecheck-20261005.txt`。独立评审的 **13/13** 临时探针由 `/root/core_review` 单独执行通过；正式扩展回归和最终构建由独立评审及父任务记录。本轮未生成 dist、未调用 Provider、未改 UI、真实验收脚本或冻结证据。
