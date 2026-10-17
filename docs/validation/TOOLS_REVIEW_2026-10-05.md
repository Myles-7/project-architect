**“更多工具”只读复核 — 2026-10-05（北京时间）**

- 状态：只读代码清点与调整建议，尚未实施功能删除、合并或 UI 修改。
- 工具返回的实际记录时点：2026-10-04 22:00:05 UTC；对应北京时间 2026-10-05 06:00:05（UTC+08:00）。文件名日期按北京时间标注。
- 工作区：`D:\桌面\项目构思`。下文源码路径相对于此工作区，行号按本次读取的工作树记录。
- 依据：正式 `apps/web`、`apps/server`、`packages/core`、`packages/agent` 的真实代码，以及已批准的 `docs/blueprint/13_PLANNING_WORKBENCH.md`。未使用 `frontend/` 原型作为正式事实。
- 方法：只读文件、检索入口和调用链。本轮没有启动界面、调用业务 API、扫描用户代码库或调用模型；尚无真实截图或操作验证。
- 证据边界：没有历史使用频次、点击率、用户研究或性能实测数据。以下“用户价值”和“建议”是基于产品边界与代码行为的判断，不是观测到的历史使用事实。

**源码位置索引**

后文为便于阅读使用部分文件名简写；实际文件位置如下，均为本次只读检索确认的正式代码。

| 简写 | 实际源码位置 |
| --- | --- |
| LeftSidebar | `apps/web/src/components/layout/LeftSidebar.tsx:16` |
| WorkspaceView | `apps/web/src/app/WorkspaceView.tsx:30` |
| PlanningWorkspace | `apps/web/src/features/planning/PlanningWorkspace.tsx:139` |
| HistoricalDocumentsView | `apps/web/src/features/documents/HistoricalDocumentsView.tsx:8` |
| DecisionDAGExplorer | `apps/web/src/features/dag/DecisionDAGExplorer.tsx:251` |
| ArchitectureDiagramsView | `apps/web/src/features/diagrams/ArchitectureDiagramsView.tsx:77` |
| ReadinessView | `apps/web/src/features/readiness/ReadinessView.tsx:92` |
| TimelineView | `apps/web/src/features/timeline/TimelineView.tsx:38` |
| ProviderDiagnosticsPanel | `apps/web/src/features/settings/ProviderDiagnosticsPanel.tsx:56` |
| ProjectDiagnosticsView | `apps/web/src/features/settings/ProjectDiagnosticsView.tsx:39` |
| SpecDriftModal | `apps/web/src/features/audit/SpecDriftModal.tsx:43` |
| API client | `apps/web/src/api/client.ts:631` |
| useGlobalShortcuts | `apps/web/src/hooks/useGlobalShortcuts.ts:11` |
| TopNav | `apps/web/src/components/layout/TopNav.tsx:25` |
| session types | `apps/web/src/types/session.ts:7` |
| server | `apps/server/src/server.ts:111` |
| PlanningRoutes | `apps/server/src/planning/PlanningRoutes.ts:39` |
| ProjectStateEngine | `packages/core/src/engine/ProjectStateEngine.ts:2759` |
| DecisionGraphProjection | `packages/core/src/dag/DecisionGraphProjection.ts:30` |
| MermaidGenerator | `packages/core/src/diagrams/MermaidGenerator.ts:266` |
| ReadinessProjection | `packages/core/src/view/ReadinessProjection.ts:26` |
| TimelineProjection | `packages/core/src/view/TimelineProjection.ts:26` |
| DocumentProjection | `packages/core/src/view/DocumentProjection.ts:15` |
| PlanningService | `packages/core/src/planning/PlanningService.ts:307` |
| SpecDriftAuditor | `packages/core/src/auditor/SpecDriftAuditor.ts:75` |
| AntigravityCliProvider | `packages/agent/src/provider/AntigravityCliProvider.ts:171` |
| ContextManager | `packages/agent/src/context/ContextManager.ts:142` |

建议将高级功能收敛为“历史”和“诊断”，在当前方案中按需查看真实蓝图关系。旧资料兼容仍有价值；新项目不应经过旧准备度准入，也不应得到由固定模板拼成的目标项目架构或未经有效扫描的合规结论。当前问题来自数据来源和行为不匹配，单纯隐藏侧栏按钮不能完成整合。

**现有入口与实际服务对象**

正式入口在 `apps/web/src/components/layout/LeftSidebar.tsx:16–29`，由 `apps/web/src/app/WorkspaceView.tsx:30–60` 路由到六个页面。默认工作台又在 `apps/web/src/features/planning/PlanningWorkspace.tsx:139–143` 提供历史、依赖图、架构图、诊断、旧概览及多组历史折叠区，存在重复入口。

| 入口 | 真实数据来源与服务对象 | 用户价值判断 | 具体问题 | 建议 |
| --- | --- | --- | --- | --- |
| 旧版文档（只读历史） | `HistoricalDocumentsView.tsx:8–30` → GET 旧 documents 投影、旧文档读取；来源是 `snapshot.documents.items`，当前开发包另在 PlanningWorkspace。 | 迁移项目查看原资料、比较旧方案有价值。新项目没有旧文档时仅显示空页面。 | 与当前开发包的入口分离；一律列出会制造无内容入口。此页面已经正确标明只读历史。 | 保留历史读取能力，合并到“历史资料”；仅在确有旧文档时显示旧文档项。当前开发包继续作为主入口。 |
| 决定依赖图 | `DecisionDAGExplorer.tsx:251–298` → `/dag`、`/dag/impact`；`server.ts:831–855` 只传 `snapshot.decisions.items` 给 `DecisionGraphProjection`。 | 查看真实前后依赖、修改影响有价值。 | 它不是当前蓝图/任务依赖图；新审批创建的决定不带蓝图块的 dependsOn。级联文档映射还是旧文档名称，无法表示新开发包影响。 | 将当前蓝图/任务关系并入方案的上下文查看或影响抽屉；旧决定图移入历史资料并标明来源。无需通过额外模型调用猜关系。 |
| 架构拓扑与时序 | `ArchitectureDiagramsView.tsx:77–93` → `/diagrams`；`MermaidGenerator.ts:34–40` 每次生成四幅图，依据旧决定的关键词匹配和固定模板，含 candidate。 | 有明确事实支撑的系统图、业务流程图有价值。 | 当前生成器不读新蓝图，且固定加入网关、鉴权和服务回程。图的外观无法证明目标项目具有这些结构。 | 撤除当前通用自动架构图的产品入口；保留读取真实方案图示的能力，后续只呈现明确蓝图内容或明确标记的候选建议。 |
| 旧版准备度审阅 | `ReadinessView.tsx:60–190` → 旧 readiness 投影、overview 编辑、readiness review/approve；`ReadinessProjection.ts:26–50` 按旧决定/缺口领域计算。 | 旧项目历史评估记录可供参考。 | 页面仍提供写入、采纳通用建议和准入签署；与当前蓝图覆盖、验证任务、三阶段审批无关。签署后跳转到已改为只读历史的 documents 页面。 | 新项目撤除旧准备度准入与写入入口；旧结果仅在历史资料中只读展示。当前状态以默认规划的阶段、覆盖与审批为准。 |
| 演进时间线 | `TimelineView.tsx:38–76` → `/timeline`、`/rollback`；投影读取旧 snapshot 切片和 `runtime/agent-runs.json`。 | 查来源、何时批准、修改了什么以及恢复方案有价值。 | 不读 PlanningRun 和 ChangeSet 审批历史；许多推导事件统一标成当前 stateRevision。现有回滚未恢复新规划状态，见下文。 | 保留并整合成真实规划历史，合并运行、审批、主题、材料与版本来源；先撤出新项目的现有回滚动作，后续恢复必须基于完整状态与可审阅差异。 |
| 诊断与设置 | `WorkspaceView.tsx:53–60` 包含 ProviderDiagnosticsPanel、ProjectDiagnosticsView，后者还嵌套规范漂移审计。 | 模型不可用、资料读取失败、运行恢复、本地路径和配置说明是实用能力。 | 默认模型健康描述被标作底层实际模型，路径由 UI 拼接；轮次和 Token 估算来自旧 Discovery/ContextManager；同时重复默认工作台已有运行设置和历史信息。 | 保留一个清晰的诊断入口，与实际 PlanningRuntime 配置、运行证据和真实项目位置对齐。开发宪法、旧轮次和无依据的预算表移出普通用户流程。嵌套审计另行撤除或严格限定。 |

**需要优先处理的代码事实**

1. **历史回滚无法恢复完整新方案。**

   `apps/web/src/api/client.ts:631` 的回滚请求仅发送 targetRevision；`apps/server/src/server.ts:1747–1753` 直接调用 `engine.rollbackToRevision`，未接收用户视图的 expectedRevision 或 operationId。`packages/core/src/engine/ProjectStateEngine.ts:2759–2853` 仅恢复 metadata、decisions、assumptions、gaps、risks、questions、readiness、overview，没有恢复 planning.json、blueprint.json、changesets.json 或新开发包状态。它内部确实使用 currentRev 做 commit 冲突校验，但这不等于校验用户点击时所见版本。新项目会得到历史决定与仍在当前磁盘上的规划文件混合状态，不能称为准确恢复历史方案。

   建议当前产品入口先停止提供这项恢复动作，保留读取历史。后续如果实现恢复，应展示完整恢复范围与差异，并处理运行依据失效、锁定内容、审批来源、幂等、包失效与文件历史一致性。此项尚未修改或实测。

2. **目标项目架构图包含没有来源的确定结构。**

   `packages/core/src/diagrams/MermaidGenerator.ts:266–309` 固定生成 API Gateway、Authorize & Route 和 HTTP/JSON 返回路径；`142–145` 等处也纳入 candidate。系统上下文和组件图还会在未发现相关决定时补出通用客户端、网关、业务层、存储。一个已选纯浏览器本地 SPA 或 CLI 的项目也会收到这样的时序模板。

   建议撤除这套通用模板在用户项目中的正式架构展示。以后若展示图示，要说明它引用的蓝图块和版本，区分草案、批准事实与未明确关系，并保持候选与正式方案的审批边界。不能只换页面标题后继续把固定推测结构作为当前架构。

3. **旧准备度仍是另一条写入和准入路径。**

   `ReadinessView.tsx:92–128` 的采纳/自定义补齐调用 editOverviewItem；`138–167` 签署旧 readiness 并跳到 documents；`181–190` 可重新体检。`apps/server/src/server.ts:1393–1439` 仍开放 review/approve。`packages/core/src/view/ReadinessProjection.ts:41–49` 以某领域是否有 confirmed/locked 决定及没有 blocking gap 判断领域满意，并提供硬编码的通用推荐文案。该规则未核对新 BlueprintBlock 的具体任务、接口、验收和验证能力。

   已批准契约要求使用待澄清、待设计、可审阅、包含验证任务、已批准等真实状态。旧页面的 Level/score/八领域闭环不能作为当前可开发证明。建议旧评估只读保留；新项目审批、修改和补齐统一回到当前规划工作台。

4. **规范漂移审计存在错误前提和假阳性“合规”。**

   入口为 `ProjectDiagnosticsView.tsx:210–232`，弹窗 `SpecDriftModal.tsx:43–69` 打开后自动审计。`apps/server/src/server.ts:946–956` 在未指定目录时扫描的是工作台项目记录目录，不是已绑定的目标项目源码目录。

   `packages/core/src/auditor/SpecDriftAuditor.ts:75–84` 将 projectTags 中的 local-first 直接等同 Zero-DB，之后会建议移除 SQLite、Prisma 等包。这违反了本地优先项目可以采用本地数据库的事实，也会将本产品自身约束扩散到用户项目。`71–72` 读取 confirmed 和 locked，页面所称“仅比对锁定规约”也不准确。

   该审计只处理 TS/JS 类文件、少量依赖包名单和硬编码的导入模式；文档检查仍读旧 snapshot.documents。不存在目录、读错误、超过扫描上限等情况会被跳过，最终 `311` 仅以 errorCount === 0 返回 isCompliant；没有扫描到源码也可能显示合规。代码没有“扫描完整/不适用/无法验证”的结果契约。以上为静态代码推断，本轮没有执行审计来制造实验结果。

   建议退出通用用户产品入口。若以后保留，应限定为用户明确选择目录、明确支持的结构化检查规则，显示实际覆盖、跳过与失败原因；未绑定源码或未检查不能记通过。单纯保留“pa verify”名称会继续制造超过实际能力的期待。

5. **诊断数据与实际运行不一致。**

   - ProviderDiagnosticsPanel 从通用 health 读取 modelName，`packages/agent/src/provider/AntigravityCliProvider.ts:171–175` 由固定 PLANNING_MODELS 组合默认模型名；它不是当前运行的实际选型。健康探测是目录预检，也不能证明某个能力已经通过实际任务验证。即使审阅 launcher 给 Runtime 传入样例 actualConfig，这个旧诊断字段仍会显示默认模型。
   - `WorkspaceView.tsx:57` 传入 `projects/<id>`；`ProjectDiagnosticsView.tsx:59` 又拼接 `.workspace/projects/<id>` 并称“物理路径”；真正打开目录的 server resolveProjectLocation 使用注册的位置。显示和复制的字符串不能称作真实绝对路径。
   - `ProjectDiagnosticsView.tsx:39–48` 数的是旧 Discovery turns；`server.ts:1841–1871` 的上下文诊断调用旧 orchestrator ContextManager，`ContextManager.ts:142` 固定使用 128000 上下文上限，并以文本估算分项。它没有读取真实 PlanningTask 的上下文或回执，不能当作当前任务的实际预算/消耗。
   - `ProjectDiagnosticsView.tsx:159` 仍宣称“每次 Discovery 操作最多一次主要 LLM 调用”，与已批准的登记多任务运行契约冲突。

   建议普通诊断保留 Provider 可用性、实际配置、当前及最近运行证据、资料可读性、本地目录打开和可行动错误恢复。估算若确实保留，必须标明旧模型估算来源及适用范围；不用开发宪法介绍替代真正状态检查。

6. **图与历史正在读错粒度的数据。**

   `DecisionGraphProjection.ts:30–65` 仅从 DecisionItem.dependsOn 建边；`PlanningService.ts:307` 的新批准决定不复制蓝图块依赖，真正新依赖在 blueprint.blocks。级联影响 `DecisionGraphProjection.ts:14–24,262` 映射的是 01_PRODUCT_BOUNDARY.md、UI_SPEC.md 等旧名称。它不能替代新任务执行依赖或开发包影响分析。

   `TimelineProjection.ts:26–215` 从当前输入、决定、问题、readiness、documents 和可选旧 agent traces 推导事件，多个 sourceStateRevision 使用 currentRevision。`server.ts:807–819` 只加载 runtime/agent-runs.json；没有加载 runtime/planning 运行事件和 ChangeSet.approvals。应合并的真实记录已存在于 `PlanningWorkspace.tsx:134–143`，不应继续维护两套不同含义的“历史”。

**整合时必须同步的关联入口与成本**

- 工作台内重复入口：`PlanningWorkspace.tsx:139–143`。整合工具后应让同一能力只有一处清晰的主要入口，必要的上下文快捷入口跳向同一个真实来源。
- 页面路由与依赖：`WorkspaceView.tsx:5–13,30–60` 静态导入全部旧页面。只隐藏菜单仍保留路由、模块和 Mermaid 初始化；保留的大图能力可在需要时加载。尚未测量实际包体或性能收益，不给节省数字。
- 快捷键和标题：`hooks/useGlobalShortcuts.ts:11–20`、`components/layout/TopNav.tsx:25–43`、`types/session.ts:7–15` 仍列出旧标签。`TopNav.tsx:83,103–106` 在更多工具页额外显示旧 StageBadge、DiscoveryPill 和 WorkflowStepper，来源与新阶段审批不同。调整需同步这些跳转及旧概览/问题修复链接，避免撤掉页面后留下空白或错误目的地。
- 模型设置范围：`server.ts:111` 的 planning-config.json 位于工作区根；`PlanningRoutes.ts:39–46` 更新同一个 Runtime。虽然 URL 中带 projectId，它实际是工作区设置。整合后的文案必须说明配置范围，并从具体运行的 effectiveConfig/任务回执展示实际模型。
- 已有部分 UI 测试（例如 `apps/web/tests/p3-s1-ui.test.ts`）只确认源码包含旧入口与组件，并未验证实际新规划数据或用户流程。不能因旧字符串测试存在就保留错误入口；后续验收应覆盖真实数据来源、空状态、操作结果和保留页面的可用路径。
- 旧文件和旧项目历史是用户资料，不因移除产品入口而删除。当前报告建议的是能力和入口整合，不是对历史状态进行破坏性清理。

**后续顺序与验收边界**

先完成当前 M8 的真实质量恢复与验收，再实施工具功能整合。上述调整建议尚未成为代码变更或功能验收结果，便签控制的最终语义结论仍以修复后新控制的实际最终质量包为准。

工具整合完成后，用户要求的最后一步是逐个截取真实界面截图、分析，再尽可能优化视觉和使用顺手程度。覆盖首页、默认工作区、选择题、草案审批、任务运行、错误恢复、保留的更多工具页面及相关抽屉；先记录优化前截图和具体问题，再实施，再保留优化后截图。需要检查默认状态、内容较多、窄视口、空状态和错误状态的实际使用路径，避免只截静态漂亮页面。此阶段尚未开始，本报告不包含虚假截图、历史使用数据或人工通过记录。
