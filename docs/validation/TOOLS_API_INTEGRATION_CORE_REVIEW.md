# 工具 API 最小整合建议（只读复核）

依据 `TOOLS_REVIEW_2026-10-05.md`、当前工作树和已批准的 `13_PLANNING_WORKBENCH.md`。本报告只制定当前 M8 验收之后的后续改动，没有修改源码、调用业务 API、模型或用户项目。行号是本次工作树的位置。此前 rollback 退役补丁已单独交付，不能把它算作本报告中的新实现。

## 1. 建议实施范围

最小方案是退役仍在产生旧写入/推断的入口，保留真实历史读取，再增加一个来源明确的 Planning 诊断投影。隐藏按钮不能代替服务端边界；旧 `GET /diagrams` 是即时生成，不是历史读取。

| 方法 / 路由 | 当前实际行为 | 最小后续处理 |
| --- | --- | --- |
| POST `/api/projects/:id/readiness/review` | `server.ts:1393` → `ProjectStateEngine.evaluateReadiness:830`，提交 readiness/history/stage 和正式 revision。缺 expectedRevision 时取服务端最新版本。 | 全模式 410 `LEGACY_WORKFLOW_RETIRED`，在 resolve/load/参数处理之前返回；Core 兼容签名立即拒绝。 |
| POST `/api/projects/:id/readiness/approve` | `server.ts:1418` → `setUserDisposition:912`，写旧 disposition/stage/history；不是蓝图或 ChangeSet 审批。 | 同上；Mock、生产、注入 orchestrator 必须一致。 |
| GET `/api/projects/:id/readiness` | `server.ts:774` → 旧 readiness 投影。 | 保留，标明 `historical` 与旧数据来源，不作为当前方案准入。无需删除持久化旧类型/文件。 |
| GET `/api/projects/:id/diagrams` | `server.ts:868` → `MermaidGenerator.generateDiagrams:34`，每次按旧 decisions 生成四图，包含 candidate 和固定网关/鉴权等默认结构。 | 全模式 410；当前蓝图中的明确图示/用户文件继续通过正常资料读取，不引入新通用猜测生成器。 |
| POST `/api/projects/:id/verify-drift` | `server.ts:946` → `SpecDriftAuditor.audit`，默认扫描工作台记录目录并即时给合规结论。实际没有 `/spec-audit` 路由。 | 全模式 410，在路径解析和扫描之前拒绝。最小范围内不重建扫描器。 |
| GET `/api/projects/:id/diagnostics/context` | `server.ts:1836` → 旧 ContextManager 文本估算/固定 128000。 | 移出普通诊断。若兼容保留，明确 `legacy-discovery-estimate` 来源和不适用于当前 PlanningTask；不能称当前额度。 |
| GET `/api/projects/:id/diagnostics`（新增建议） | 无。 | 从真实项目位置、PlanningRuntime 配置、运行及回执元数据构造只读投影；契约见下文。 |

410 采用现有 rollback 模式：`success:false`、`error.code:LEGACY_WORKFLOW_RETIRED`、`recoverable:false`，没有 snapshot/stateRevision；重复请求、过期 revision、缺项目/参数均不得触发恢复、扫描或旧引擎写入。停用意图明确，不能返回 200 的空“通过”。

## 2. 间接调用必须同步处理

ReadinessView 的四条链仍在正式 UI：`apps/web/src/features/readiness/ReadinessView.tsx:92–132` 的采纳/自定义补齐 → `client.editOverviewItem`；`:138–175` → `client.approveReadiness`；`:181–199` → `client.reviewReadiness`。`WorkspaceView.tsx:46` 仍挂载页面，LeftSidebar 仍有入口。旧建议是 `ReadinessProjection.ts:57` 的硬编码推荐，不是 Provider 证据。只读历史页必须去掉这些写入动作和签署后跳去历史 documents 的流程。

不要顺手移除通用 `/overview/edit`：`server.ts:1082` → `ProjectStateEngine.editOverviewItem:1545` 仍被 `OverviewDrawer.tsx:402` 使用。它会直接创建用户 Confirmed 决定并关闭同领域所有 open gaps，是否继续保留要另行按当前规划意图审查；本方案只移除旧 readiness 快速修复链。

`server.ts:1461–1473` 的旧 `/documents/generate` Mock/注入分支会用 `autoReApprove` 调 `setUserDisposition`，必须去掉该依赖。生产分支 `:1449–1452` 已先走 PlanningPackageCompiler，不能把 Mock 行为当成生产绕过当前审批的证据。`ProjectStateEngine.completeDocumentCompilation:443–511` 还会更新旧 readiness basisRevision/stage；若承诺旧 readiness **全面只读**，要同步隔离旧 AIOrchestrator 发布链，仅保留 `persistFiles=false` 的历史渲染夹具。仅删除两个 readiness API 不足以达到这项承诺。

`server.ts:1650–1658` 的 `/documents/export-html` 另行调用 MermaidGenerator，将即时生成的图加入旧 HTML。必须停止这条新图生成调用；真实已保存文档/HTML仍可读，可向旧导出器传空 diagrams。不要将移除 `/diagrams` 误称为已完全去掉旧图能力。

前端架构图链是 `PlanningWorkspace.tsx:139` / `WorkspaceView.tsx:37` → `ArchitectureDiagramsView.fetchDiagrams:75` → `client.getArchitectureDiagrams:897`。审计链是 `ProjectDiagnosticsView.tsx:208` → `SpecDriftModal.tsx:43`（打开即跑）→ `client.verifySpecDrift:992`。对应入口、快捷键、标题、路由都应同步撤除，避免空页或打开即返回错误。

CLI `scripts/pa.mjs:60` 直接调用 SpecDriftAuditor，绕过服务端；也应退役 `pa verify` 或返回明确 unsupported，不可继续宣传通用合规验证。纯生成器/审计器历史 fixture 可保留，但需明确不能验证当前项目真实结构或全代码合规。

## 3. 新诊断契约和读取方法

建议新增 `GET /api/projects/:id/diagnostics`，沿用 ApiResponse。顶层有 `schemaVersion:1`、`observedAt`、`sourceStateRevision`，每一节均带 `availability:'available'|'partial'|'unavailable'` 和安全的原因；未知值用 null/明确 unavailable，不能折成零。

| 节 | 返回内容与证据边界 |
| --- | --- |
| project | projectId、当前 revision、真实绝对 projectPath。位置必须来自注册项目解析结果；不要用 `projects/<id>` 或 `.workspace/projects/<id>` 拼接。 |
| configuration | `scope:'workspace'`；`PlanningRuntime.getConfig()` 的当前归一化配置，必要时本机配置路径。`server.ts:111` 的 planning-config.json 在工作区根，虽 `/planning/config` URL 带 projectId，实际影响共享 Runtime。 |
| runtime | 活动及最近 Run 的 identity/stage、持久化 status、观测到的 effectiveStatus、有效/失效依据、冻结 `effectiveConfig`（旧 Run 缺失时为 null）。链接现有运行控制，不在 GET 内 resume/repair。 |
| tasks | 登记 taskId/kind/status/dependsOn/model/attempts/outputOrigin，来源是 Run。model 标“请求/登记模型”，没有 backend 证据不能称底层实际模型。 |
| calls | `call-N.json` 的 recordedCalls、status、durationMs、usage、请求模型/推理设置。显示记录完整性；缺回执不能认作零调用。已知 usage 可汇总，但必须附 unknown/incomplete 标识。 |
| materials | snapshot 中的真实输入状态、analysisAvailability、排除和失败信息；仅做明确的轻量可读性检查，不触发提取或模型。 |
| provider | 实际 Runtime Provider 身份（能获取时）；单独保存最近 probe 的时点/范围。未探测标 unchecked。默认 GET 不启动 preflight 或 complete。 |

需要新增一个窄的 Runtime **只读 inspector**，不能复用现有 `list/get` 而承诺不写：`apps/server/src/planning/PlanningRuntime.ts:55–59` 的 list 遇 readdir 错误返回 `[]`，get 会把磁盘 queued/running 改 paused 并写 run.json；`:60` 读 events 还会吞坏行和读错。Inspector 对 active 返回克隆，对磁盘只读取，不改 journal/status；重启中断可以显示 storedStatus=running、effectiveStatus=interrupted/paused，并解释尚未写回。区分目录不存在与 EACCES/坏 JSON，显示 partial/unavailable，不能假装无运行。

`resolveProjectLocation`（`server.ts:189–219`）确实能返回导入/打开项目的注册位置，但 canonical fallback 会 `loadProject` 并登记，因此存在恢复/写入副作用。新诊断必须复用它的**位置事实**，并将非恢复的注册/存在性读取提成窄 helper，或明确在正常项目加载已完成后使用结果；不能把调用现有 resolver 的所有 fallback 说成绝对无写入。真正不存在/不可读项目需返回原始错误，不能捏造 canonical 路径。

当前 UI 在 `WorkspaceView.tsx:57` 传 `projects/<id>`，`ProjectDiagnosticsView.handleCopyPath:55` 再拼 `.workspace/`；新 UI 使用服务端返回的绝对路径复制。现有打开文件夹 API 已在服务端解析位置，可继续使用。

Run.effectiveConfig 在 `PlanningRuntime.ts:88` 创建时冻结，task.model 在 `:288` 分配；实际信号量 `:289` 使用**当前** config.concurrency。诊断必须分别显示冻结模型/研究来源和当前调度并发上限，不能声称历史 Run 的冻结并发决定现在调度。

attempts 在 `:367` 调 Provider 之前加一；回执 `:376` 在调用返回后写。attempts 不是证明已经发起调用的总数，recordedCalls 也不是无缺失的完整总数。`outputOrigin:'assembly'` 是本地组装，不应计 Provider 成功。`ProviderUsage` 允许 `'unavailable'`，不能把未知成本/Token变成零。避免暴露原始 stderr、prompt/envelope、凭据、schema 绝对路径；必要本机项目/配置路径只放专用字段。记录 outputHash 并不等于重新验证文件完整性；昂贵校验另设明确动作，不调用 resume 的变异修复。

旧 `/api/provider/health`（`server.ts:702`）通过旧 orchestrator.getProvider，可能不是注入 Runtime 的 Provider；AntigravityCliProvider.healthCheck `:171` 预检默认目录 PLANNING_MODELS。其 modelName 不是覆盖配置或单次任务模型，catalog ready 不证明视觉、工具或实验执行成功。保留显式健康探测时，标明实际来源和 model-catalog probe 范围；新诊断不能抄这个默认组合当当前模型。

## 4. 兼容边界

保留项目/snapshot、timeline、discovery turns、历史 readiness、旧 DAG/impact（明确仅旧 decisions）、真实已保存文档、Planning run/events/package 的 GET。不删除旧资料、类型和 revision 文件。当前 timeline 不是完整 Planning/ChangeSet 审计；多个事件拿当前 revision 标源，不能当作正确历史快照选择器。新蓝图依赖直接来自已批准 blueprint.blocks.dependsOn/requirementIds，任务关系来自登记 tasks；无需新 Provider 调用。

“兼容读取”不包括 GET 动态图或 POST 新审计。没有已持久化的 SpecDriftReport 历史 GET 可承诺保留；用户真实保存的报告文件照常读。旧 approve request、autoReApprove 字段可先保持类型兼容并显式 deprecated/retired，不能继续成功执行旧写入。

## 5. 必要验收

1. 用 rollback 退役测试模式覆盖上述 410 的生产、Mock、注入模式；重复/过期/缺参/缺项目，所有正式及 runtime 文件 bytes、目录和 revision 不变；无 resolve/load/recovery/readiness/Mermaid/Auditor/Provider 调用。
2. HTML 导出 spy 确认不再调用通用 MermaidGenerator；历史文档与真正保存文件仍可读。生产生成开发包仍按当前 Core 审批，Mock不再自动旧签署。
3. 注册项目在默认工作区之外时，诊断/复制返回真实目录。不能让 fallback recovery混入只读诊断测试。
4. 当前 config 与 Run.effectiveConfig/task.model 不同时显示各自来源；旧 Run 缺 frozen config 必须 unknown。当前并发限额的标签正确。
5. 磁盘 running/queued 不在 active 时，诊断报告中断但不写 run.json；坏 run/call/events、不可读目录、缺失 metrics 都不退化成无任务/零消耗。assembly 不冒充 Provider 回执。
6. 保留 Core commit/recovery/trash、历史投影和真实 package读取测试。迁移 `apps/server/tests/p3-s1-features.test.ts:86`（旧 diagrams 成功）、`p3-s3-features.test.ts:108`（审计成功）、readiness API 用例；`p0-context-diagnostics` 留作旧估算 fixture。p3-s1/p3-s3/p1-visual-layout/p2-remediation 的源字符串断言不能要求保留错误能力。

这是一份待实施建议，没有新增性能/调用费用结论，也没有把静态代码分析写成浏览器复现。
