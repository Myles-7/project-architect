# Planning API：正式规划与审批

日期：2026-10-04。以 `apps/server/src/planning/PlanningRoutes.ts`、`packages/contracts/src/planning.ts` 和 Core 规划服务为实现依据。本文件取代旧 API 中 discovery 写入、自由回答自动确认及旧准备度文档生成的冲突规则，项目、材料和历史读取接口继续兼容。

## 通用规则

JSON 响应为 `{ success, data?, stateRevision?, error? }`。正式写入携带整数 `expectedRevision` 与非空 `operationId`；版本冲突为 HTTP 409。相同操作和相同内容重试幂等，不同内容复用操作 ID 被拒绝。取消、继续及高级配置修改属于运行控制，不增加正式方案版本。

明确的个人订阅额度耗尽保存为 paused 并保留原 error、成功任务及收据，不执行瞬时故障的两次自动重试；普通 429／503／连接故障继续原重试规则。Web 从失败记录时间和服务提供的恢复间隔显示固定估计，缺少间隔明确未知。恢复时间不代表服务一定可用；显式 resume 仍检查正式依据、冻结配置及产物哈希。

旧 `POST /api/projects/:id/rollback` 在所有运行模式统一返回 HTTP 410 / `LEGACY_WORKFLOW_RETIRED`（`recoverable: false`），不读取项目或执行恢复，不修改规范文件与 revision。历史时间线和快照保留读取；回收站目录恢复、Commit 崩溃恢复和本节的运行恢复继续可用。

所有下面的路径均以前缀 `/api/projects/:id` 开始。

| 方法与路径 | 请求 | 结果与行为 |
|---|---|---|
| `GET /planning` | 无 | `PlanningView`：正式蓝图、草案、阶段、运行、中文状态、`coverageIssues` 与服务器计算的 `canGenerateProduct` |
| `POST /planning/inputs` | `raw, expectedRevision, operationId, kind?` | 保存完整原话；返回 snapshot，不自动确认 |
| `POST /planning/runs` | `stage, expectedRevision, operationId, inputRefs?, feedback?, draftChangeSetId?` | HTTP 202，返回登记的 `PlanningRun`；可明确修订有效待批准草案 |
| `GET /planning/runs/:runId` | 无 | 运行与任务状态；服务重启后未结束运行投影为 paused |
| `GET /planning/runs/:runId/events` | `Last-Event-ID` 或 `?after=N` | SSE `progress` 事件，带 `id`；先重放，再按序接续，15 秒心跳 |
| `POST /planning/runs/:runId/cancel` | 无 | 中止该运行并保留成功产物；晚到结果不能应用 |
| `POST /planning/runs/:runId/resume` | 无 | 校验依据、产物 receipt/hash，复用成功任务继续 |
| `POST /questions/answers` | `answers[], expectedRevision, operationId` | 原子处理结构化选择、自定义、委托、暂缓，返回 snapshot |
| `PATCH /planning/changesets/:changeSetId` | `groups[], expectedRevision, operationId` | 编辑尚未批准分组，检查完整性与依赖 |
| `POST /planning/changesets/:changeSetId/approve` | `groupIds[], unlockIds?, expectedRevision, operationId` | 原子部分批准，记录来源与历史，同步阶段及正式蓝图 |
| `POST /planning/changesets/:changeSetId/reject` | `groupIds[], expectedRevision, operationId` | 拒绝指定待审分组，保留记录 |
| `GET /planning/config` | 无 | 当前进程共用的高级运行配置 |
| `PUT /planning/config` | `concurrency, designModel, reviewModel, officialHosts?` | 并发 1–16；显式模型及 HTTPS 官方来源域名列表，保存本地配置 |
| `POST /planning/package` | `expectedRevision, operationId` | 校验批准、覆盖与输入依据后本地编译，原子发布 manifest |
| `GET /planning/package/files/:name` | 包中已登记文件名 | 当前版本正文；集合及哈希不一致则拒绝 |
| `GET /planning/package/export` | 无 | 完整校验后的 `application/zip` |

`stage` 为 `clarify | product | technical | delivery | feedback`。产品阶段要求基于当前依据完成的五项澄清内容明确或委托、无待答题；GET 的 `canGenerateProduct` 与启动操作使用同一个判断，前端据此开放按钮，不按条数或分数猜测。技术阶段要求产品批准；交付阶段要求技术批准。反馈要求已有正式蓝图。每个项目同时只运行一个 Run，一个 Run 可登记多个并发工作任务。

阶段门槛在保存请求附带的 `feedback` 前检查；拒绝请求不会增加正式版本、保存输入、撤下待答题或创建 Run。同请求重试仍返回原先的阶段错误。初次产品设计不能用请求中的新反馈继承已经失效的旧澄清；完整正式产品允许以新反馈开展再设计，仍须审批草案。

### 修订待批准草案

在 `POST /planning/runs` 提交 `draftChangeSetId`、原变更包的 `stage` 和非空 `feedback`，表示继续该草案。启动前校验版本、包存在、状态为 pending/partially-approved、依据仍有效及至少一个 pending 分组；不接受 stale/approved/rejected、跨阶段来源或 clarify 草案。这些拒绝不保存输入或创建运行。有效首个 product 草案可在尚无正式蓝图时按 product 阶段修订；technical/delivery 的前阶段审批门槛仍保持，普通 feedback 请求仍要求正式蓝图。

Run 的 `draftSource` 记录 source ChangeSet/Run、stage、原 basis、完整源对象规范化 hash 和被选 pending 的 groupIds。`draft-source.json` 保存不可变完整原包；只有这些 pending 分组与其证据进入初始候选上下文，已批准/已拒绝分组不重新成为候选。反馈保存后旧包可以因依据改变显示 stale，其原 groups、evidence、approvals 均不改写。新 Run 的最新完整草案优先于冻结候选；评审另有明确标为 previous-pending 的原候选比较基线，正式旧正文仍只按 review 比较基线提供。原 pending 块/删除 ID 登记为必需职责，不能因正式蓝图同 ID 已存在而静默丢弃。

Run 先以 `pendingStart:true`、paused 状态保存 `draft-source.json`、`draft-start-basis.json` 与请求，随后幂等保存反馈、冻结新 basis 并启动。该准备阶段不调用 Provider。输入已提交而最终 Run 写入中断时，相同 operationId/完全相同请求可继续启动，不重复保存输入；继续前重查冻结来源及原依据，只允许该条反馈造成的差异，无关输入/蓝图/材料变化拒绝。取消准备中的运行不会由普通重试自动重启；显式 resume 才能继续。

每次上下文消费、Provider 调用前与返回后（含瞬时失败重试）、同操作重试和服务重启 resume 均校验来源 hash；来源缺失/篡改返回 RESULT_MODIFIED，依据失效返回 STALE_BASIS。取消活动运行即使来源损坏仍先停止任务并保留诊断。任务结果仍经过正常 Schema、角色、证据和独立评审；新包不自动批准。Core.proposeRevision 先以严格 Provider 契约校验新分组，继续拒绝模型传入 locked/批准元数据，再校验冻结来源与当前 Core 中原包的完整对象一致（仅允许顶层状态投影 stale）、来源 hash/stage/basis 和 pending groupIds。Core 仅将原 pending 分组的人工 locked 意图映射到同一稳定块 ID，与新 pending 包及 `draft-locks:<新包ID>` 操作记录在同一版本原子提交；不会先发布无锁包再补写锁。提交前失败不留下新包，提交后响应中断可幂等恢复完整包。不锁定其他新块，不改变已锁定正式内容的显式 unlockIds 审批要求；普通 Core.propose 路径保持原严格契约。

正式 UI 在有效草案旁提供反馈输入及“让 AI 修订当前草案”，按包的原阶段提交。存在未保存编辑时禁用启动，编辑和反馈原文保持；失败不清掉反馈。取消/失败的草案修订可继续原 Run；依据已变化时提示用户查看当前有效草案，不静默丢掉候选从正式蓝图重跑。

有效待答题优先暂停，不执行依赖答案的后续研究。五项澄清已经明确或委托、无阻塞和待答题时结束澄清；技术研究建议保存为 `deferredWork`，只有输入依据一致时才交给设计阶段考虑。设计与开发验证不能无限回流到澄清。

配置先纯校验并规范化，再按工作区串行持久化，最后应用到内存；保存失败保留旧配置。已有配置文件损坏、不可读或无效时启动明确报错，不静默切换默认模型。每个 Run 的 `effectiveConfig` 冻结模型与官方来源，保存新设置不会改变既有 Run；并发数仍是工作区全局调度策略。旧 Run 缺少完整配置时，恢复记录兼容诊断并保留已有任务的模型。

## 答案与审批

```json
{
  "expectedRevision": 12,
  "operationId": "answer-round-2",
  "answers": [
    {"questionId": "q-platform", "kind": "selection", "optionKeys": ["web"]},
    {"questionId": "q-storage", "kind": "delegate"}
  ]
}
```

`selection` 需要有效选项；`custom` 需要文字；`delegate` 和 `defer` 不要求额外文字。自定义、委托、暂缓仅保存原话与主题处理记录，不成为 Confirmed。选择保留 question、decisionKey、来源和替代关系。同批最多三题、精确键/批准别名去重、直接和间接依赖无冲突；已处理主题重问必须有 `reopenReason`。

正式结构化回答在 `QuestionItem.answerKind` 保存提交类型。明确选择还在 `selectedOptionKeys` 保存原始 `optionKeys`，关联该题保存的完整 `options`；自定义、委托和暂缓不保存选择键。现有 `answer` 原文/标签表示、正式决定 statement 与确认边界保持不变，保存重载及暂停恢复保留此关联。

`PATCH /planning/changesets/:changeSetId` 的用户编辑可以设置区块 `locked:boolean`，表示批准后的锁定意图，保存草案不修改正式区块。只有批准才生效，后续替换或删除须显式提交对应 `unlockIds`。用户编辑仍不能设置 `approvedBy` 或 `approvedAt` 等批准来源；Provider 输出契约也继续拒绝锁定与批准元数据。

工作者 `answers` 上下文包含 `questionId`、`decisionKey`、原题和全部 `options`、`answerKind`、原始 `answer`、`selectedOptionKeys` 与按 key 关联的完整 `selectedOptions`（含 `approach/gain/sacrifice/impact/reversibility`）。非选择回答的选择键和所选项为空。历史缺少回答类型，或声称选择却没有有效选择键时标记 `unknown`，保留原题、完整选项与现有正式决定供参考，不按 label 或 statement 猜 key，不迁移原记录或创建新的正式选择。

审批 `groupIds` 不预选。被依赖分组必须已经批准或同时批准，Locked 块/决定需要在 `unlockIds` 明确列出。批准同步修改蓝图、有效决定、主题、证据、来源和阶段，替代项保留历史。只有本次未明确修订的下游阶段失效；完整三阶段反馈包的批准不强迫再次生成已经批准的下游。

## 依据、恢复与开发包

`PlanningBasis` 保存 revision 与规范化内容哈希。正式决定、蓝图、硬约束、输入及材料改变后，旧结果不能应用；本轮题目答案导致的正常续接有受限比较，不忽略无关变化。

分次回答允许保存。仅本轮合法答案改变依据、仍有未答题时，提前继续返回 `INVALID_INTENT` 并保留暂停状态；答完剩余问题后可继续原 Run，不重做已成功调用。界面有待答题时禁用手动继续入口。

初始产品设计需要当前有效的完整澄清。完整的正式产品蓝图可作为后续再设计依据，不要求第一次澄清的整份依据哈希在审批后仍然相同；有未答题时仍不能启动。再次设计只产生草案，不能自动恢复待修订阶段或绕过新输入审批。草案在交付前复用 Core 的分组、依赖和不可变证据检查，错误反馈给登记修订任务。

`BlueprintState.approvedInputHash` 记录最近审批覆盖的原话、约束和材料依据。所有阶段曾经批准不等于新输入已审阅：不匹配时报 `UNREVIEWED_INPUT`，GET 同时给出明确缺口，禁止重新编译旧蓝图。

每个任务 `result.json` 旁保存 `result-receipt.json`，含 taskId、结果 hash、依据 hash、完成时间与来源，Run 记录 `outputHash`。恢复比较 taskId、结果 hash 与已登记 outputHash；依据 hash 记录供追踪，实际依据有效性由冻结快照与 Run 的受限比较保证，合法本轮答案续接允许保留此前成功产物。Provider 结果缺少 receipt 或被外部修改时拒绝，不从自由日志重新推断。取消与过期运行的成果可保留为历史，但不能直接进入正式状态。

服务实际返回输出超限后，Run 登记 `decomposition` 和独占块范围的工作任务。合法片段全部完成后生成 `origin=assembly` 的本地汇集结果，收据带 `children`、各来源哈希及可选 `base` 候选哈希；这不增加 Provider 成功调用数。恢复核对并重构确定性汇集结果。汇集写入中断且缺少收据时，不采信半写的 `result.json`，只能从已登记且收据有效的完整来源重建；源 Provider 收据缺失仍拒绝。

每次实际调用单独保存 `call-N.schema.json`、日志及结果诊断，记录 Schema 路径与哈希，不覆盖历史调用的契约。研究/验证/评审输出职责单独校验；所有非 `decomposition` 调用的 Schema 与接收边界禁止非空 `workItems`，不裁掉非法字段后采纳。验证不能把未来实现后的应用测量当作当前试验。

汇集 v2 的恢复还验证冻结 `knownEvidence` 文件及哈希，隔离不同解释的证据身份并保持正式证据。登记来源和收据来源必须一致，汇集依据不能用 `origin=provider` 绕过验证；未知来源及 v2 来源缺失返回 `RESULT_MODIFIED`，拒绝路径无新 Provider 调用或文件修改。历史缺省来源按登记汇集依据选择原算法复核。已完成且明确依赖的分片提供完整正文给后续片；当前修复问题通过 `repairIssues`/`repairSourceTaskId` 关联，历史观察不直接充当最新独立评审的未解决阻塞。

实际 agy 调用通过本地只读 `planning_context` 工具读取完整冻结输入。初始消息传分区索引；`action=index` 返回条目，`action=read` 返回有 nextOffset 的文本页。条目、全文与读取记录各有哈希和调用归属，材料工具不能提供任意上下文文件路径。独立评审缺少必需记录的连续完整读取时报 `INCOMPLETE_REVIEW_CONTEXT`，冻结输入被修改时报 `CONTEXT_INTEGRITY_FAILED`；这些 Provider 错误按原 Run 暂停与恢复，不绕过审批、也不视为内容通过。

批量传输 `action=scan` 接受可选 `prefix`、条目 `offset`、条目内 `characterOffset` 与评审专用 `requiredOnly`。响应的 `parts` 保留每片段的 key、JSON Pointer、编码、哈希、字符区间及完整长度；用 `nextOffset` 和 `nextCharacterOffset` 续读，前者为null表示本次选择全部读完。JSON文本不超过3900 B，完整MCP响应不超过6000 B，每页最多30片段，没有总页数或总读取量限制。3900 B来自真实CLI可见性失败后的保守传输边界，不是上下文或用量上限。只有已成功审计且实际返回的所有片段才登记读取账本；遗漏、跳页、不同调用复用或冻结内容变化仍阻断评审完成。

Run 的 `deferredQuestions` 保存超出当前三题批次的问题，`unfinishedBlockIds` 保存等待答案的登记范围。恢复不能因主题已有旧答案跳过合法重问，不能因正式蓝图已有同名块而放弃候选修改/删除；交付只接受已实际履行的候选动作。分片正文只供其范围使用，最新完整草案由合法汇集结果提供。

登记范围中的全部 `blockIds` 都必须通过实际候选块或删除动作履行。初次设计和旧任务恢复遵守相同规则；旧 `completed` 标记不能豁免范围检查。调用前文件准备期间收到取消后，不启动新 Provider 调用；取消清理等待实际工作退出并释放并发槽。

后续研究的复用还要求任务 `basisHash` 与当前 Run 依据一致。用户回答改变依据后，同名研究需要重新登记执行；旧产物仍保存供整合参考，不能充当新依据的验证。

开发包在独立 staging 中生成全部文件，校验独特正文、任务覆盖与最终 SHA-256 后发布。manifest 含 sourceRevision、发布 revision、basisHash、operationId、目录和文件列表；编译期间版本变化即失败。预览、重复编译恢复及 ZIP 导出都校验集合和哈希。`USER_NOTES.md` 为显式保留的用户说明区，其他外改作为反馈。

### tasks.json v2：批准蓝图的任务依赖投影

新编译的 `tasks.json` 使用共享契约 `PlanningPackageTaskFile`，`schemaVersion` 为 `2`，顶层包含 `revision`、`blueprintHash`、`tasks` 与 `blueprintReferences`。`tasks` 仅包含 `task` 和 `validation`，保留完整 `DevelopmentTaskSpec`、任务 ID、标题、类型及 `requirementIds`。

每个任务的 `dependsOn` 只引用本文件导出的任务 ID。编译器仅沿批准完整蓝图的 `dependsOn` 递归穿过非任务块，遇到第一个 `task` 或 `validation` 端点即停止；去重后的端点形成任务前置关系。`blueprintDependsOn` 原样保留该任务在批准蓝图中的直接依赖。`requirementIds` 是关联信息，不用于猜测或补造前置关系。

`blueprintReferences` 列出所有非任务块的 `id`、`title`、`kind`、`stage`、原始 `dependsOn` 与 `requirementIds`，供包内解析蓝图关联；这些记录按 ID 排序。任务采用稳定拓扑顺序，同时可执行的任务按 ID 字符串顺序排序。`DEVELOPMENT_PLAN.md` 使用相同任务顺序并同时显示任务前置和蓝图原始依赖，`START_HERE.md` 从同一顺序取首个任务。两份文档说明投影范围：导出不会补造 AI 未登记的语义前置，发现遗漏需提交质量反馈并审阅修订。

投影仅影响导出内容，不修改正式蓝图。历史 `schemaVersion: 1` 文件继续按原 manifest 验证、预览、幂等恢复及 ZIP 导出，不迁移或改写旧包；新的编译操作才生成 v2。

## 主要错误

| HTTP | code | 用户可恢复方式 |
|---|---|---|
| 400 | `INVALID_INTENT` | 修正请求、题目、选项、配置或事件序号 |
| 409 | `STATE_REVISION_CONFLICT`, `STALE_BASIS` | 获取当前状态，按新的依据重新操作/规划 |
| 409 | `IDEMPOTENCY_CONFLICT`, `RUN_CONFLICT` | 使用新的操作 ID，或等待/取消当前运行 |
| 422 | `CLARIFICATION_REQUIRED`, `STAGE_NOT_APPROVED` | 完成澄清或前一阶段审批 |
| 422 | `LOCKED_CONFLICT`, `DEPENDENCY_CONFLICT` | 明确解锁或补齐前置批准 |
| 422 | `UNREVIEWED_INPUT` | 分析新输入影响并批准相关修订 |
| 422 | `RESULT_MODIFIED` | 保留诊断，启动新运行，不接受外改产物 |
| 422 | `PACKAGE_INCOMPLETE`, `PACKAGE_MODIFIED` | 补齐方案，或将外改作为反馈审阅后重新生成 |

生产旧 discovery 写接口返回 410。旧文档生成入口调用同一个正式蓝图 compiler；历史文档仍可读取，无历史产物时不得回退伪生成旧草案。
