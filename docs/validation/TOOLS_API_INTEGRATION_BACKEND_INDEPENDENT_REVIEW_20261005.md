# 工具 API 后端整合独立复核

复核日期：2026-10-05。范围为 `TOOLS_API_INTEGRATION_BACKEND_DELIVERY.md` 中的 Core 只读 Inspection、Runtime Inspector、Diagnostics、history/历史文档 API、packageStatus、旧入口及 CLI 退役。依据已批准 `13_PLANNING_WORKBENCH.md`、新增共享契约、实际源码和独立执行结果；未把交付者的测试日志计为本人的验证。

最终结论：两项 P2 已独立确认闭合；后端整合在本次范围内通过。最终一轮 **11 文件、133/133 测试通过**，包括 13 项独立源级临时探针。第 6 节记录修订、剩余反例的进一步修复及实际证据；下面保留初轮发现，不将它们误当作仍未解决的问题。

## 1. [P2] 历史响应并非提交快照原值

位置：`packages/core/src/planning/PlanningInspection.ts:41-43`；经 `apps/server/src/planning/PlanningDiagnostics.ts:28-32` 返回到 history 的 `snapshot` 和 `state`。

`readProjectSnapshotReadOnly` 在读取提交文件后补入 `decisionBasisHash`，或者把 `approved` 阶段改成 `needs-revision`。这没有写盘，但共享契约 `planning-diagnostics.ts:9` 明确说历史投影使用 “an exact committed snapshot”，响应也只带 `sourceStateRevision`，没有说明这两个字段已作当前有效性投影。

独立复现使用全新临时项目和公开 API：

1. `PlanningService.propose/approve` 批准 product。
2. `ProjectStateEngine.addDecision` 手动加入一条 Confirmed 决定，得到 revision 4。
3. 直接读取 `state/revisions/4/blueprint.json`，product 为 `approved`。
4. 调用 `planningHistory`，`sourceStateRevision=4`，但 `snapshot.planning.blueprint.stages.product` 和 `state.blueprint.stages.product` 都为 `needs-revision`。
5. 查询前后整个临时项目的所有文件 SHA-256 一致。

这不是越权落盘；它是历史来源标签与响应内容的偏差。当前有效阶段需要反映决定变化，但应与原提交记录明确分开。建议保留 history 的原提交 snapshot/state；当前有效性投影另行计算并标源，避免把推导状态冒充 revision 4 保存的值。诊断的当前语义 basis 仍应与 PlanningService/Runtime 一致，不能只删除反映逻辑而制造新的 basis 偏差。

## 2. [P2] 可检测的事件缺口没有标为不完整

位置：`apps/server/src/planning/PlanningInspector.ts:58-60`。

日志只校验 seq 严格递增，没有校验从 1 开始连续，也不与 `run.nextEventSeq` 比较。独立临时夹具保存 `nextEventSeq=4`，日志仅有 seq 1、seq 3；读取结果为：

```json
{"runtimeAvailability":"available","runReasons":[],"calls":{"availability":"available","recordedCalls":0,"incomplete":false}}
```

所有 usage 仍为 null，且所有文件字节未改变；问题是已知缺失的事件没有被揭示。当前实现遇到坏 JSON 会给 `event-journal-incomplete`，而同样可判定的缺号却没有该语义。这会把缺失历史显示为完整观测。

建议按 Runtime 的持久化序号规则检查缺口与冻结 `nextEventSeq` 边界，并给 partial/安全原因。活动 Run 在读取期间可能追加事件，边界校验应保留这一并发情况，不能触发修复或误声称已验证完整性。该建议只要求轻量一致性检查，不要求诊断执行 resume 的产物认证。

## 3. 已独立确认的实现

| 项目 | 证据及结果 |
| --- | --- |
| 真实注册位置 | `server.ts:223-239` 等待 registry 初始读取，注册位置模式使用 entry.projectPath；diagnostics/history 在该模式调用。现有定向测试使用默认 projects 目录之外的真实注册目录。损坏 registry 返回安全错误，不回退恢复。 |
| 前置退役 | `server.ts:95-100` 在 JSON parser 前注册 readiness/review、readiness/approve、verify-drift、diagrams 的 410。生产、Mock、注入 orchestrator 均覆盖坏 JSON、坏 ID、缺项目、重复和过期；无加载/扫描/Provider/文件变更。 |
| Core 与旧编译 | 三个旧写入方法立即拒绝；`DocumentCompiler.compile` 默认持久化路径立即拒绝，仅保留显式 false 的历史内存渲染。 |
| 当前文档生成 | 所有模式走 PlanningPackageCompiler；`autoReApprove` 不触发旧签署，重复 operation 幂等。历史 HTML 不调用 MermaidGenerator。 |
| CLI | `pa verify` exit 1，明确 `LEGACY_WORKFLOW_RETIRED`；CLI 源码无 Core 导入或项目扫描。 |
| 正式版本读取 | 当前指针、目录、关键 section 形状验证；指针缺失但版本存在、关键片段缺失、坏指针均拒绝，无恢复或 canonical 修复。来源状态为指针指定版本。第一项发现影响返回值的保真，不影响磁盘只读性。 |
| history 纯读取 | 没有 load/get/list/recover 调用；includeCalls=false 跳过回执目录，GET 内不调用 getConfig。中断 commit staging/marker 和 running Run 的字节保持一致。 |
| 历史文档 | 按 committed documents.items.id 查找；WorkspaceGuard 限制登记 path，raw readFile，不更新保存 hash；返回 historical/committed-legacy-document/unchecked。未登记和穿越路径拒绝。 |
| 缺失 Run | changeSets.runId 及当前 Runtime 的 questions/cancel/proposal 编码与实现对应；引用 Run 或整个 runtime 目录缺失返回 partial/unknown/incomplete。无引用的新项目可为 available 空集。未从任意反馈文本猜 runId。 |
| 模型与调度来源 | 当前配置来自 Runtime.getConfig，冻结配置来自 Run；旧 Run 缺冻结配置为 null；模型只是请求/登记值。provider probe 为 unchecked，没有实际能力通过结论。 |
| 调用与未知用量 | 完整两回执可汇总为 input=20、output=40、total=60；删除 call-1 后 recordedCalls=1/incomplete=true、总 usage 全 null；坏回执及未知字段保持 null。assembly 不冒充 Provider 回执。 |
| 路径边界 | 独立 Windows junction 夹具被拒绝为 unknown/partial；未知 filesystem 原因安全化。 |
| packageStatus | current/stale/missing 按语义 basis；仅 revision 增长仍 current，改变规划依据变 stale，历史目录保留。PlanningView 实际注册该字段。 |

`agy_capabilities` 字面名未出现在本次后端源码范围；这里审查的是父任务指定的“工具 API 后端整合”，没有推断为一个新增同名业务接口。

## 4. 本次实际验证

2026-10-05 08:48:30（Asia/Shanghai）启动；Vitest 3.2.7，**10 个文件、159 个测试通过，exit 0，56.26 秒**。

```text
node ./node_modules/vitest/vitest.mjs run
  packages/core/tests/PlanningInspection.test.ts
  apps/server/tests/planning-diagnostics.test.ts
  apps/server/tests/legacy-tools-retirement.test.ts
  apps/server/tests/rollback-retirement.test.ts
  apps/server/tests/p0-context-diagnostics.test.ts
  apps/server/tests/planning-api.test.ts
  apps/server/tests/planning-package.test.ts
  apps/server/tests/planning-runtime.test.ts
  apps/server/tests/planning-context.test.ts
  apps/server/tests/planning-draft-revision.test.ts
  --reporter=dot
```

执行器为本机 bundled Node：`C:/Users/Li Cheng Xin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`。测试直接使用源码别名；五项额外探针（历史来源、事件缺号、完整 usage、缺回执、junction）使用已 build 的本地模块。额外探针仅创建临时夹具，读取前后比较文件 hash，并在结束后清理。

未调用真实 Provider，未对原项目、冻结控制材料或业务项目目录执行写入。没有修改实现或既有测试；本报告是本次唯一保存的文件。父任务所述统一 build 成功是父任务证据，本报告没有将其记录为本人的重跑。

边界：诊断不认证 result/document hash，不提取材料内容，也不证明实际工具/模型能力；历史导出老路由和旧 context estimate 不属于新增 history 的绝对只读保证。当前旧 context 路由明确标 legacy-discovery-estimate，不能当作当前 Planning usage。

## 5. 复核时源码 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| packages/core/src/planning/PlanningInspection.ts | 5495fb7602bcf39c7473fe37e7e474633a58e8abc683f4988787e401d98e2c90 |
| apps/server/src/planning/PlanningInspector.ts | 1d765c2963c0bfb84e361541967bc45db7d6d821e3e39b0dd92c10ccdafc7ae7 |
| apps/server/src/planning/PlanningDiagnostics.ts | 6cbc5bed74c76a250b4c21765ad337f47f84aa68d1d064ce4c1f1cce5d15c5e7 |
| apps/server/src/planning/PlanningRuntime.ts | f7b32ac901276a4baa26219afa26a436691b05898c10fce945f033d8663528af |
| apps/server/src/server.ts | d6e05d3c524b0a908161e491820adef924d91ca99bd697f90316cb5d809bc467 |
| apps/server/src/planning/PlanningRoutes.ts | b5e0dfa91eae45ed87afe316c96aa2f20167cf53a0d698232600ef8821fcab76 |
| packages/contracts/src/planning-diagnostics.ts | 74c881545e3dddfd88bb785d81874bad3a9f39f2966a74884afd7f4e5dd1c5ef |
| packages/core/src/documents/DocumentCompiler.ts | e19b759f6bd26b4206eff5a9e2145c1ccc983a2fb073f4a76984bad276a2abe7 |
| packages/core/src/engine/ProjectStateEngine.ts | 67361e5eb3c4e309c2fc430f1df8f722f98c8d59a7067a5c1db925c12aeb3e51 |
| scripts/pa.mjs | bf86321928aba5a8f9ee3ff05519f2f8513d6262d50c53b0523546d2780dea80 |

## 6. P2 修订独立复核（已闭合）

2026-10-05 09:30:22（Asia/Shanghai）独立重跑 Core Inspection、HTTP Diagnostics、PlanningService、Planning API/package、legacy retirement：**6 文件、78/78 通过，exit 0，23.45 秒**。这些数字来自本次执行，不是交付者的 29/29 或 73/73 日志。

源码修订已把 history snapshot/state 与 `basisProjection:{source:'effective-planning-projection',revision,hash}` 分开，raw reader 不再修改阶段或补入 decisionBasisHash；Inspector 检查从 1 连续与 nextEventSeq 末尾边界。

另创建并运行源级临时探针，以公开 API 和真实临时磁盘复现，09:35:21 的一轮 **12 项：10 通过、2 失败，exit 1，3.65 秒**。9 个事件边界全部通过：空日志/next=1，seq1,2/next=3；seq1,3、首项seq2、重复seq1；next 小于末尾边界、缺失、0、字符串。异常均 partial/incomplete，recordedCalls 和汇总 usage 未知；查询前后所有临时文件 hash 一致。

历史批准原值也保留正确；但第一版纯 basis helper 只复制决定失效规则，尚遗漏两种既有正式有效性投影：

- 规范 area=`project_overview` 的手动新增决定可匹配 PlanningService；受支持别名 `tech_stack` 则不匹配。保存的决定保持 area=tech_stack，engine.loadProject 的 ProjectStateMigration 在有效投影中规范为 technical_boundary 并增加 sourceArea=tech_stack；planningBasis 包含完整有效决定，这两个 hash 因而不同。原始反例曾使用非规范 area=product，现已替换为明确受支持的别名，避免把错误前提当作普通规范用例。
- 与 `PlanningBoundaries.test.ts:81-89` 同构的旧部分批准反馈记录：已提交三阶段 approved、缺 feedbackReview、仍有 pending 分组。PlanningService.get 恢复其有效审阅投影，删除 approvedInputHash、将阶段标 needs-revision；第一版 Inspection helper 未包含此逻辑，同 revision 11 的 basis 不同。

这两个剩余反例同步实现代理与父任务后，再次修订为共用正式纯投影：`PlanningService.projectSnapshot` 首先完整克隆输入，经共享 `ProjectStateMigration.normalizeLoadedRecords` 和 Area migration，执行与正式 PlanningService.get 相同的决定失效、旧部分反馈及清理建议投影。Engine 的原 additive normalization 也调用该共享入口。`planningInspectionBasis` 调用这个无 I/O 方法后计算 basis，不修改原历史对象。

新增 `basisProjection.materialBasis={source:'committed-input-refs',integrity:'unchecked'}`，明确材料依据仍来自提交 inputRefs；材料字节没有重新哈希。不能把这项检查扩展为外部材料变化下的完整性证明。

### 最终独立执行结果

2026-10-05 09:46:49 源级临时探针 **13/13 通过，exit 0，3.93 秒**。除上述 12 项外，另覆盖旧 Confirmed 决定通过 `question:<id>` 关联时缺 decisionKey：正式载入规范化为 `legacy:q-legacy`，Inspection 与 PlanningService basis 完全一致，而提交决定和查询输入对象未被补写。规范 area、受支持 alias、旧部分反馈三种对照都通过。

09:48:00 的八文件回归曾得到 105 通过、3 失败：两项旧 history strict equals 未纳入新 materialBasis 字段，一项缺 Run 夹具使用了仅含 runId/status 的不完整 ChangeSet。正式测试随后更新来源字段，并以完整的正式 ChangeSet 继续验证 GET 200 和缺 Run unknown/partial；没有将其降为拒绝或跳过。中间源码提取未完成时的缺方法错误不作为最终实现证据。

09:48:48 另外独立执行 ProjectStateMigration 与 PlanningMigration：**2 文件、7/7 通过，exit 0，2.23 秒**。

最终于 **2026-10-05 09:50:56（Asia/Shanghai）**执行以下 11 文件，**133/133 通过，无失败、无跳过，exit 0，29.16 秒**：

```text
node ./node_modules/vitest/vitest.mjs run
  packages/core/tests/PlanningInspection.test.ts
  apps/server/tests/planning-diagnostics.test.ts
  packages/core/tests/PlanningService.test.ts
  packages/core/tests/PlanningBoundaries.test.ts
  packages/core/tests/ProjectStateEngine.test.ts
  packages/core/tests/ProjectStateMigration.test.ts
  packages/core/tests/PlanningMigration.test.ts
  apps/server/tests/planning-api.test.ts
  apps/server/tests/planning-package.test.ts
  apps/server/tests/legacy-tools-retirement.test.ts
  tests/backend-inspection-independent-review.tmp.test.ts
  --reporter=dot
```

其中 13 项为独立新探针，120 项来自正式测试。初轮 159 与最终 133 是不同范围，不相加为独立用例数。

独立探针直接比较提交文件与 history raw snapshot/state，以及 `planningInspectionBasis` 与 `planningBasis(await PlanningService.get())`，并比较整个新临时目录所有文件 hash。事件覆盖两种合法边界和七种缺失/异常边界，未知用量没有折零。原项目与冻结控制均未触碰；没有真实 Provider 调用。

临时探针已在验证后删除，源码存在会话证据中；本代理只留下本报告，没有修改实现、apps/web 或既有测试。实现代理新增的正式 alias/部分反馈/关联问题/material-scope 回归也包含在最终执行中。本轮没有重跑统一 build 或 typecheck，其结果仍归属于负责该检查的父任务/实现代理。

### 最终复核源码 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| packages/core/src/planning/PlanningInspection.ts | eec1888b9edfc89d53f1c90ebde8ac17508cc408a34579b52388c05afb50a159 |
| packages/core/src/planning/PlanningService.ts | 95a9badc7cf53652355a53d140a11a2cae48df426095f53894aef29059e26786 |
| packages/core/src/migrations/ProjectStateMigration.ts | 10871dc8986bd6109343ec9d55ebc0f8db4c26ad6b36ba014d07bef00fd756a6 |
| packages/core/src/engine/ProjectStateEngine.ts | a1be762062be04fae747307df5a7164fb93e230cd9e571a76d18f1913965ad6a |
| apps/server/src/planning/PlanningInspector.ts | df541f4069f467f8918d41fc620a56ba0853bd58882de375aaaa5272f3e1bce2 |
| apps/server/src/planning/PlanningDiagnostics.ts | 210e9cd0420795d43b77e4e61b0c4b2bd3ddd47936fb388453afcc5a9cf2867e |
| packages/contracts/src/planning-diagnostics.ts | 34d7205c2536fd23dc5c72333dd9ab1ec6d9d5e31b4cff921beef0e6424124ab |
