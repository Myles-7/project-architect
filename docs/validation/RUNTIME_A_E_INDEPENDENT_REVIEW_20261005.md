# Runtime A–E 独立审查（2026-10-05）

## 结论

已完成指定五个文件的只读审查。独立发现一处回执 origin 可将已登记 v2 汇集降格为 Provider 产物的完整性缺口；主代理已修复，8 种异常 origin 和必要历史兼容回归全部通过。当前审查范围未发现尚未修复的缺陷。

正式状态仍由 Core 与用户批准控制；证据隔离、汇集和独立评审只作用于待批准候选。原工作者结果及其回执保持可核对的原内容与哈希。空 review 不能越过 Core 校验、来源核验、必需范围或覆盖检查。

本审查未修改实现、Frontend、原项目或冻结控制目录；使用独立系统临时项目、mock complete 和已有测试夹具，未调用真实 Provider。所有自建临时目录已清理。本报告及此前长上下文独立报告为保留产物。

## 最终审查版本

| 文件 | SHA-256 |
| --- | --- |
| `apps/server/src/planning/PlanningContext.ts` | `d97c686a78be8b0824e67886add64a8cb6747fee68de5dd6012f5f49ff18f02c` |
| `apps/server/src/planning/PlanningTaskPartition.ts` | `d79a4144f873b61f5156c22b7013d339a9462d58f8472578d26247e76c0214dd` |
| `apps/server/src/planning/PlanningAssemblyEvidence.ts` | `e6f0954c42df4bc39c8b9a0fad5ceb68712e877f25e99d9193f37bc6a4173f89` |
| `apps/server/src/planning/PlanningRuntime.ts` | `ef137608a966189dfd7b396f5e7e6f1f6ce7eb6382d6df6213e033ea122856b8` |
| `packages/contracts/src/planning.ts` | `753c21c14d1d91f4d05edde33ab79a3c81847a67b5ae3931b2f361f1be915a25` |

最初完整相关套件运行时 Runtime 哈希为 `cf129b23f34a1e2b91773cf1663c0bfd56ffca0706b38253f9f877a275d7bb98`；其余四个文件与最终表一致。origin 修复后另做针对性回归。已只读确认现有 dist/PlanningRuntime.js 含相同的 registeredAssembly 与 origin 校验逻辑；未自行重建仓库。

## 独立测试结果

1. 首轮相关套件：北京时间 2026-10-05 11:07:51 开始；4 文件、114/114 通过、退出码 0、34.81 秒。
   - planning-context：15。
   - planning-assembly-evidence：7。
   - planning-partition：38。
   - planning-runtime：54。
2. origin 修复后的定向回归：北京时间 2026-10-05 11:15:42 开始；16/16 通过、退出码 0、14.50 秒；该文件另外 31 项明确跳过，没有将跳过项计作通过。
   - 8 类来源降格、缺省、空字符串、null、未知来源和 Provider 被改为 assembly。
   - 旧未版本化回执的完整/缺失/缺省 origin 三种路径。
   - v1 与 v2 缺回执重建两条路径。
   - role0 重建回退。
   - 冻结 Core 依据改动与缺失两条路径。

两轮有部分重叠，不能合并宣称 130 个不同测试。本审查没有因已有测试通过而忽略额外临时探针发现的缺口。

执行方式：bundled Node 运行仓库已有 Vitest，四个首轮文件按上述名称选择；最终仅运行 planning-partition.test.ts，testNamePattern 为：

```text
rejects .*(downgrade|origin|relabeled)|preserves an old unversioned|rebuilds version|frozen Core evidence|restores a hash-registered legacy
```

## 已修复的独立发现：回执来源降格绕过冻结依据验证

修复前用实际已构建模块，在新建系统临时项目通过 mock complete 形成 design 和 integration 汇集，故意让第一次 review 返回失败以暂停运行。随后：

- 登记 task.outputOrigin 保持 assembly、assemblyVersion 保持 2，result 内容及其哈希不改。
- 只将该 design 任务的 result-receipt.json 中 origin 改为 provider。
- 删除同任务 assembly-known-evidence.json。
- 新 Runtime 执行 resume。

**独立实际结果：** resumeError=null，run 最终 reviewable，任务 outputOrigin 被覆盖为 provider；新增 mock complete 一次，真实 Provider 调用零次。说明该已登记汇集跳过了 verifyAssembly 与冻结 Core 依据检查。问题位于先按 receipt.origin 分支、再将其覆盖登记 outputOrigin 的恢复顺序。

**修复后：** 在读取产物、覆盖来源登记之前验证来源枚举和既有登记。partitionTaskIds、版本或证据依据登记会强制选择汇集验证，不能由 provider 回执降格。v2 回执要求明确来源；旧未版本化的缺省 origin 按登记/回执汇集元数据推定，继续验证原来源。定向回归确认异常先报 RESULT_MODIFIED，零新调用，已保存文件字节保持不变；合法历史缺省回执保持原字节并恢复正确来源。

## 其他重点审查结论

| 议题 | 结论及依据 |
| --- | --- |
| 当前问题与历史观察分离 | currentIssues 来源为已登记整任务 repairIssues；拆分者及子任务通过 repairSourceTaskId 指向同一问题集。历史 findings 以内容哈希去重，taskHistory 只引用 findingIds，仍保留原产物与来源 |
| 最新候选恢复 | planningUnfinishedScopes 按真实完成顺序恢复每个缺失 ID 的最近合法 replace/remove，逐条保留 taskId 与动作；不从未验证、暂停任务或支持角色恢复候选，也不拿正式蓝图替代未完成候选 |
| 旧回执兼容 | 原回执存在时按其角色/证据/汇集版本重建并核对输出；无回执时忽略孤立结果字节，以登记哈希选择可重建的历史算法。role1 重建抛出可预期结构错误时仍能尝试合法 role0，原 Provider 结果不会被新算法改写 |
| v2 不可变证据 | Core 正式及既存 ChangeSet 证据冻结为单独文件并登记哈希；与 task 和 receipt 核对。scopeAssemblyEvidence 返回结构克隆，仅重命名冲突候选 ID 并同步本地/继承引用；不改变 Core 原证据的正文、日期、来源、用途或哈希 |
| 证据引用歧义 | 同一工作者内不同版本被拒绝；跨工作者同 ID 不同内容分配独立派生 ID；有明确本地或 base 版本时保持对应含义，无从判定的冲突引用明确失败，不挑选其他工作者的记录 |
| 删除归属 | v2 按内容所有者继承旧组构建前提，删除旧组中的单个废弃成员不会给删除 owner 加上保留成员的所有依赖；完整删除仍保留原审批前提。保留决定关联真实 replacement/actions，旧审批依赖按实际新 owner 转换 |
| 旧阻塞裁定 | 只有确定性检查全部通过，才执行当前独立 review；此时 review.blockers 决定历史观察是否仍是当前阻塞。draft 原 blockers 不被改写，新的修订只持有当前 repairIssues |
| 确定性门禁 | validateQuestionSet、Core draftIssues、clone 上的 verifyTaskEvidence、unfinishedBlockIds 和 blueprintCoverage 均先执行；确定性 issues 非空则不进行独立 review，也不能提出 ChangeSet。已有来源错误回归确认空 review 不会豁免 official-source/material/user 无效来源 |
| 项目状态与契约 | assemblyVersion、assemblyKnownEvidenceHash、repairSourceTaskId 等位于应用登记的 PlanningTask；汇集产物与 ChangeSet 仍为待批准建议，没有传播成 Provider 可写审批字段或直接确认项目事实 |

## 适用边界

本次确认代码行为、来源恢复与建议状态保护，不验证真实模型的方案质量。真实长上下文页可见性另见 `LONG_CONTEXT_TRANSPORT_INDEPENDENT_REVIEW_20261005.md`，其中区分总保存字节与实际必读字节，不能用模拟测试代替真实 agy 能力。主代理继续负责整体构建、运行进程加载版本和最终真实用户场景验证。

