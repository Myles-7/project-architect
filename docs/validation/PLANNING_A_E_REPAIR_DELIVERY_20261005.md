# Planning A–E 修复交付与验证

2026-10-05。执行者：`/root/agy_capabilities`。范围为父任务已授权的 A–E 及必要回归测试；F（把普通修订缩为局部输出）未实施，全部 44 项候选职责仍保留。此报告独立记录本工作者的实现与测试，不把真实 Provider 尚未完成的恢复运行计为通过。

## 原问题的证据与解释

调查依据来自冻结的 `flash-vague-draft-final-20261005-03` 及其 observed-inputs，未改写这些记录。其最后完整候选任务 `task-d612dba5-3ede-4ab0-b208-8c9d87a7c796` 有 43 个块和 1 个明确删除动作，覆盖全部 44 项；随后 `task-c02616e7-84ee-42cb-a389-a189defdb668` 实际触及输出上限并登记 9 个工作范围。

观察到的技术片 `task-e3a05efb-43d4-4b01-87f6-a30beb6c7b8e` 显式依赖已完成产品片 `task-1ace46f4-9db9-4449-9c2f-9f8660e95d19`，但旧 Context 排除了分片依赖正文，仍发送旧完整候选。该产品片的 6 个块都已更新，却没有作为依赖结果进入技术片上下文。

不能把历史问题归因成 Runtime 直接把全部历史 blockers 加入当前 issues。旧 Context 每条历史任务都携带 blockers，模型重复或改写旧观察到当前产物，汇集后再成为下一轮问题。在检查时，48 个历史任务有 366 次 blocker 出现，精确去重后 111 个；当前完整候选的 68 条也是精确唯一文本，语义上仍有重复。Core 的真实覆盖、依赖环和证据身份错误仍然有效，不能一概当作旧警告撤销。

旧依赖环也不是新技术片原始分组主动声明的环：旧 build 分组同时持有保留的实现块及被技术片删除的过时验证块，旧汇集器把删除所有者当作整个 build 的替代所有者，继承了 build 的业务批准前置关系。证据冲突则有 12 个 ID 来自旧基准证据，最新 9 个片没有返回这些记录；其中仅 4 个仍被候选引用，8 个是未引用的基准记录。

## 已实现行为

| 范围 | 最终行为 | 主要实现 |
| --- | --- | --- |
| A | integration/revision 接收显式已完成依赖的完整角色视图，即使依赖是分片。currentDraft 继续表示最近完整候选，分片通过 workerResults 单独提供，不伪装成完整草案。 | `apps/server/src/planning/PlanningContext.ts:73` |
| B | 新修订任务将精确去重后的当前问题存于 repairIssues；拆分计划及子任务用 repairSourceTaskId 引用同一修订来源。目标仅描述工作职责，不复制整段问题。taskHistory 保存 findingIds，historicalFindings 精确去重并保留每个 taskId/kind 来源。保留兼容的 historicalReviewFindings 去重列表。 | `packages/contracts/src/planning.ts:197`；`PlanningContext.ts:46`；`PlanningRuntime.ts:401`、`:559` |
| C | 候选先通过问题、完整范围、Core 结构/证据身份与全图依赖校验，再交独立评审。评审查看完整当前候选及其 blockers；成功评审后，当前语义问题由评审的 blockers 决定，不再追加已裁定的旧观察。原 worker 结果与收据不被清空或改写。另在 clone 上重查证据来源，防止继承的无效官方/材料/用户依据被空评审绕过。 | `PlanningRuntime.ts:530–560` |
| D | v2 区分内容替代所有者和仅删除某个旧成员的所有者。部分删除不会继承旧分组其他保留内容的无关批准前置关系；整个分组删除仍继承原真实前置关系，保留的候选决定仍关联实际动作。完整 Core 循环及缺失依赖检查未放宽。 | `apps/server/src/planning/PlanningTaskPartition.ts:87–117` |
| E | 新汇集使用 assemblyVersion=2。Core 中登记的不可改写证据（批准 evidence 及 changeSets 记录）冻结于任务的 assembly-known-evidence.json，任务与收据保存该内容哈希。基准和工作片一起针对这份依据做身份隔离；正式记录保留原 ID，冲突候选得到确定性派生 ID，其引用随同改映射。未引用且仅来自基准的记录不再进入新候选。 | `PlanningAssemblyEvidence.ts:6`；`PlanningTaskPartition.ts:52`、`:119`；`PlanningRuntime.ts:427`、`:442` |

恢复依据包括算法版本、冻结证据哈希、子结果收据、基准收据及输出哈希。v0/v1 历史产物按原算法复核或重建，不迁移成 v2，不改变旧结果字节或哈希。收据先写完成而 Run 元数据写入中断时，可以从收据补回版本及冻结依据登记；冻结依据缺失或修改会返回 RESULT_MODIFIED，并且不调用 Provider。

## 实际验证

统一源码检查使用 contracts/core/agent 的 source paths，包含 contracts/core/agent/server 共 **119 个源文件，0 个 TypeScript 诊断，exit 0**；未写 dist。

最终扩展回归于本机时间 2026-10-05 11:01:37 启动，**16 个测试文件、313/313 通过，exit 0**。日志：`docs/validation/planning-a-e-regression-20261005.txt`。文件 SHA-256 与验证摘要：`docs/validation/planning-a-e-source-validation-20261005.json`。

| 文件类别 | 文件数 | 通过测试 |
| --- | ---: | ---: |
| A–E 定向：Context、AssemblyEvidence、Partition、Runtime、OrdinaryRevisionPrompt | 5 | 120 |
| Server：API、BlueprintContext、Diagnostics、DraftRevision、RoleContract、Package | 6 | 132 |
| Core：Service、Migration、Inspection、DependencyGraph、Boundaries | 5 | 61 |
| 合计 | 16 | 313 |

新增和加强的行为回归覆盖：

- 显式前置片的全部正文/证据能被后片读取，旧完整候选仍独立提供，原输出哈希不变。
- 当前问题与历史观察分离，精确 finding 去重保留来源；分解任务可以读取当前问题。
- 旧观察已解决时独立评审允许进入待批准状态；真实当前 finding 仍触发修订；官方、材料和用户的无效来源不能由空评审放行。
- 实际输出上限触发拆片；长且重复的评审问题只存一个当前条目，计划/子任务引用它，所有 44 项范围及完整正文仍被汇集，第二片读取已完成的第一片。
- 部分删除不产生虚假技术↔业务循环，整个分组删除继续保留真实批准前置关系，源结果不变。
- 真实批准 Core 证据与基准候选不同解释冲突时，v2 隔离派生身份、保持候选解释及引用、去掉未引用基准记录；Core 正式证据保持原值，未批准的技术块不进入正式蓝图。
- 历史 v0、证据隔离 v1、新 v2 收据及缺收据重建；Run 元数据中断补登记；冻结 Core 依据篡改/缺失在恢复时拒绝；成功子任务的结果、收据与调用记录不重复或改写。
- 外围 API、批准/拒绝、锁定、候选修订、材料依据、迁移、完整依赖图、文档发布和历史读取回归保持通过。

## 交付边界

本工作者未修改 packages/agent、PlanningPrompt.ts、UI、Core 验证器、真实控制/observed-inputs/冻结结果及验收脚本；未调用真实 Provider、生成 dist、提交、重置或删除既存工作树改动。父任务已负责统一构建及新的 Flash/Gemini 恢复进程；这两个进程使用启动时冻结的 dist，不会自动采用以后源码改动。本工作者在收到该冻结通知后只增加测试与本报告，没有继续改生产源码。

独立评审仍依赖真实模型正确判断语义问题。精确文本去重不声称能够合并语义改写的所有同义观察；上下文中的完整候选、登记范围及证据仍可能较大。新的索引/分页 Context 工具、mandatory reads 与真实恢复结果由父任务另行记录，本报告不把本地 fixture 测试视作真实 Provider 端到端通过。

## 独立复核 P1：收据来源降格修复

`/root/core_review` 随后复现了恢复漏洞：保持 Run 中的 assembly/v2 登记，把其收据的 origin 改成 provider，再删除该任务的 assembly-known-evidence.json。旧恢复代码按 receipt.origin 选择分支并覆盖 task.outputOrigin，从而跳过该任务的 verifyAssembly。父任务明确授权修复；两项真实恢复此时已因额度暂停，统一重建后的新控制由父任务负责。本工作者仅修改 PlanningRuntime.ts 的恢复来源核对段及永久回归，没有更改既存真实证据。

修复位于 `apps/server/src/planning/PlanningRuntime.ts:229–256`：

- 覆盖任何登记来源之前，校验 task.outputOrigin 与 receipt.origin 的合法枚举值，并拒绝二者明确不一致。
- 已登记的分片/汇集版本/冻结证据依据，或收据中的 children/base/汇集版本等依据，均不能用 origin=provider 降格。
- v2 及其冻结证据依据的收据必须有明确 origin；删除 origin、空字符串、null 和未知值均返回 RESULT_MODIFIED。
- 合法旧收据没有 v2 登记时可省略 origin。仍存在汇集依据时推导为 assembly，并走完整来源/基准/算法复核；普通旧 Provider 收据推导为 provider。旧收据的字节与哈希不重写。
- 后续读取字段和 verifyAssembly 使用已验证的 outputOrigin，拒绝发生在新 Provider 调用及保存 Run 前。

先写入 7 个永久攻击用例，再执行旧生产代码：**7/7 应拒绝却被接受，exit 1**，原始失败日志保留于 `planning-origin-guard-red-20261005.txt`。修复后相同用例 **7/7 通过，exit 0**，日志 `planning-origin-guard-green-20261005.txt`。随后增加反向来源不一致和旧无 origin 兼容回归，**11/11 通过**，日志 `planning-origin-guard-compatibility-20261005.txt`。全部拒绝场景确认没有新的 Provider 调用，Run 与保存的结果/收据字节保持不变。

本轮 source noEmit 仍为 **119 文件、0 诊断、exit 0**，日志 `planning-origin-guard-typecheck-20261005.txt`。最终扩展回归于本机时间 2026-10-05 11:15:50 启动，**16 文件、322/322 通过，exit 0**，日志 `planning-origin-guard-regression-20261005.txt`：A–E 定向 5 文件 129 项、Server 外围 6 文件 132 项、Core 5 文件 61 项。最新 Runtime 与 Partition 测试的文件哈希和验证摘要记录于 `planning-origin-guard-source-validation-20261005.json`；前面的 313 项日志及初始源码哈希作为先前阶段证据保留。
