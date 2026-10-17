# Assembly evidence scope independent review — 2026-10-05

结论：**规范与代码复核无剩余阻塞；相关测试 3 文件、68 项通过，exit 0**。本轮独立发现的两项边界问题均已由主任务修复；本 agent 先使用相同只读反例确认关闭，再按追加授权补充两项真实文件存储与 Runtime 重启恢复的集成回归。测试使用模拟 Provider 和临时项目，不是实际 agy 或真实冻结 control 恢复。

## 范围与规范依据

审阅 `PlanningAssemblyEvidence.ts`、`PlanningTaskPartition.ts` 的 optional evidenceScopeVersion、`PlanningRuntime.ts` 的 TaskReceipt/verifyAssembly/assembleWork、`PlanningTask` 契约与 assembly-evidence 回归测试。先读 AGENTS.md、已批准 `docs/blueprint/13_PLANNING_WORKBENCH.md`，再核对 `12_B3_ADAPTIVE_DISCOVERY.md`、`docs/api/PLANNING_API.md` 和正式 planning 类型。采用 code-review-and-quality 技能，覆盖正确性、可读性、架构、安全与性能。

审阅阶段只读取实现和测试，在内存中执行真实函数及原样 selector。追加授权后仅编辑 `apps/server/tests/planning-partition.test.ts`，在系统临时目录创建隔离测试项目并调用模拟 Provider；测试清理临时项目。没有修改实现源码、真实冻结 control、真实 Provider 结果/收据、原蓝图或 manifest；没有调用真实 Provider、执行工程 build、批准或提交。新增文件为本报告。

规范要求 Core 唯一权威、AI 结果保持建议、只能使用结构化终态、所有任务和来源可追踪。汇集是 application-derived 产物，收据必须记录 children/hash/base，并从有效来源确定性重建；不能借用孤儿 result.json 或改写历史来源。本次身份隔离只改变派生候选中的证据 ID 与对应本地引用，不对不同完整记录作语义合并，不影响人工审批边界。

## 规范核对

| 要求 | 复核结果 |
| --- | --- |
| 不同 worker 同 ID 不同完整记录均保留 | 对完整记录 hash 区分版本；派生记录除 id 外全部字段保留，包括 source/date/hash/location/environment/outcome/applicability |
| base 与原 Provider 来源不可改写 | base 相同副本保留原 ID，输入 structured objects/hash 不变；结果消费采用 clone，runtime 写新 parent 派生文件 |
| block/decision 引用一致映射 | 根据本 worker 自带完整记录优先，或可证明的 base 完整记录映射；两个引用数组都同步 |
| 同 worker 多个冲突版本拒绝 | INVALID_STRUCTURED_RESULT；不存在任意选择最后一条记录 |
| 无 local/base 证明的冲突 ID 引用拒绝 | INVALID_STRUCTURED_RESULT；不借其他 worker 版本猜测引用语义 |
| 派生 ID 确定性且避开保留命名空间 | 由原完整记录 hash 生成，按稳定顺序处理；保留全部 record ID 和 base/worker 的全部 block/decision evidenceIds |
| 新版本可恢复，历史 hash 不变 | Runtime 新汇集显式 scope1，task 注册和 receipt 均记录；既有 receipt 的版本权威；缺 receipt 的历史 task 无 scope 字段从 scope0 起步 |
| EIO 孤儿只使用有效已登记来源 | source receipts 先核对，丢弃 orphan 的信任；候选重构只有匹配已登记 outputHash 才可选 |
| 取消与冻结依据保护 | 新隔离模块无状态写入；assembleWork 保留发布前 context/frozen source 检查，交付前 abort/依据检查与 invalidation 路径保留 |

`assemblePartitions` 的 evidenceScopeVersion 默认 0 保留历史直接调用语义。生产新汇集由 Runtime 明确传入 1；合法历史重构使用声明/选择的版本。本次没有把 v0 替换成“同样含义”的新对象。

## 发现一：引用保留 ID 被派生 ID 占用（已关闭）

初版只 reserved `EvidenceRecord.id`，未 reserved 仅在 block/decision 中引用的 ID。

只读反例：A/B 各返回同 `shared` ID 的不同完整记录；第三 worker 无本地/base 记录而引用 `assembly-evidence:<hash(A原记录)>`。初版恰好生成该 ID，第三 worker 原引用因此悄悄获得 A 的证据含义。实际函数输出 `unprovenReferenceNowAliasesWorkerA=true`，所有输入 hash 未变。这违反证据身份边界，不能因最终“引用能解析”就认为合法。

主任务修复：`PlanningAssemblyEvidence.ts:9–20` 将 base 与所有 role view 的 block/decision evidenceIds 一并纳入 reserved。

关闭证据：同一反例中 A 的派生 ID 追加 `:scoped`，第三 worker 的原引用不改写、不再绑定 A。额外保留两个显式 record IDs 与一个 base 引用形成连续占位时，派生 ID 追加三个 `:scoped`，仍避免碰撞；worker 顺序反转后的输出等于原结果反转。对应回归已加入 assembly-evidence 测试。

## 发现二：新版重构先抛错使合法旧版回退不可达（已关闭）

原 missing-receipt 路径先调用角色视图版本 1，再比较登记 hash 并回退旧版本。如果第一次 assemble 先抛 INVALID_STRUCTURED_RESULT，比较/回退代码不会执行。

只读合法历史反例：base 的 `candidate` 分组含一个待批准 scope decision；design child 用同 `candidate` 分组更新 block、没有重复该 decision；旧 research child 的 `legacy-support` 分组含替代 decision。历史 role0/scope0 汇集合法，hash 为 `b63c9fb8b2335206f1ac8dbccc50918777b1b92fd3e6273235766fe028fb6c7a`。先试 role1 过滤 research 后，base decision 需保留，因 candidate 分组 ID 已被 design 使用而先报“修订分组与需保留的原分组 ID 冲突”。base、design、legacy support 和旧汇集四个对象均通过实际 assertTaskResult 广义契约；这不是非法结构探针。

主任务修复：`PlanningRuntime.ts:289–310` 在 orphan 且有登记 outputHash 时依次尝试登记版本、历史 scope0、role0/scope0，去除重复候选；只对 INVALID_STRUCTURED_RESULT 继续尝试，其他异常直接抛出；最终只接受登记 hash 匹配的候选，没有匹配返回 RESULT_MODIFIED。存在 receipt 时仍采用该 receipt 的声明版本，不对历史已收据产物重新选择算法。缺 scope 版本的旧 receipt/task 采用 scope0，避免将等价历史重构误标为新算法。

关闭证据：直接抽取**最新 Runtime 原样 selector**，只包围所需函数 bindings 并使用已有 TypeScript 转译；同一历史反例选中 role0/scope0，hash 保留。new scope1 孤儿选中 role1/scope1，legacy role1 孤儿保留 scope0；登记 hash 被替换为不匹配值时返回 RESULT_MODIFIED。输入源对象不变。此处是原样函数级内存检查；随后增加的磁盘恢复证据见下节，仍未运行真实控制。

## 追加磁盘恢复集成回归

`apps/server/tests/planning-partition.test.ts:208`：两个模拟 worker 返回同证据 ID、不同完整记录，并在 block 与 decision 中各自引用该 ID。实际 Runtime 汇集生成 scope1 后，模拟 review 返回环境失败暂停；冻结全部源 result/receipt 及已发生 call/schema 文件字节、源 attempts/hash、两个 assembly result 字节和登记 hash。删除 design parent 与 integration 两份 receipt，模拟 result 已写而 receipt 未写的孤儿窗口；创建全新 FileStorage、ProjectStateEngine 和 Runtime 后 resume。断言两个 assembly result 字节、登记 hash、完整派生记录和本地 block/decision 引用均保持；恢复 receipt 记录 role1/scope1 与原 children hashes；所有源文件字节和源 attempts/hash 不变，恢复仅新增一次 review 调用。正式 blueprint 为空，产物仍为 pending proposal、approvals=[]。

`apps/server/tests/planning-partition.test.ts:278`：在现有隔离历史恢复 fixture 模式上构造合法旧 Provider base/legacy support 来源与 role0/scope0 收据；所有完整对象先通过 assertTaskResult。base 分组 ID 与 design 候选分组相同，旧 support 提供替代 decision，先明确断言 role1 重构报“原分组 ID 冲突”，证明回归触发了原故障。将 role0 汇集 hash、children/base 注册到临时 run 后，冻结来源文件字节并删除 integration receipt，再用全新 Runtime 从磁盘 resume。断言恢复完整旧输出和登记 hash，receipt 不新增两个 v1 字段，children/base hashes 保留，来源文件字节不变、base attempts=1，仅重试 review；正式 blueprint 为空，待批准包无 approvals。

两项新增测试单独执行：**2 passed、30 skipped、exit 0**。随后执行全部 `planning-assembly-evidence.test.ts`、`planning-partition.test.ts`、`planning-draft-revision.test.ts`：**3 文件、68 passed、exit 0，32.08 秒**。现有取消/basis-change、完整/截断 orphan、Provider 缺 receipt、旧已收据字节保留与草案冻结来源检查也在同次运行中通过。

此处实际使用磁盘和正式恢复方法，但 Provider 是 fixture；删除收据模拟写窗口，不声称制造了操作系统真实 EIO，也不证明真实九分工 agy 行为。真实冻结 controls 未被读取用于测试输入或改写。

## 代码质量核对

- 正确性：完整记录身份与引用同步有明确边界；既存 evidenceScope0 冲突仍拒绝，新 scope1 不覆盖 base。两项发现均已关闭；未见剩余内容丢失或 hash 回归。
- 可读性：独立纯模块使身份隔离与 assembly 生命周期分开；role view 与 evidence scope 两个版本独立传递。恢复版本尝试有界且只对指定契约错误续试，登记 hash 是唯一选中条件。
- 架构与安全：没有新依赖、数据库或远程服务；没有扩大 Provider 权限、推断自然语言状态或绕过 Core 的候选/审批。task 字段标为 application-only，Provider 输出 Schema 仍不接纳该 Runtime 元数据。
- 性能：记录和引用以 Map/Set 索引，一次来源扫描、确定性排序与 clone；碰撞循环受现存保留 ID 链限制。没有新的无界 Provider 调用、预算门禁或全状态持久化流程。
- 恢复与保护：parent 的来源/hash/version 注册先 save，再写 result 和 receipt；缺 receipt 不采信 result 字节，Provider 缺 receipt 仍拒绝。现有取消、冻结 basis/source、scope 完整性与派生来源 hash 检查未移除。

建议后续真实九分工便签仅在**新副本**中 resume，核对全部旧 Provider 文件/receipt bytes/hash 保留、新 assembly receipt 的两个版本、派生引用及正式状态保护；禁止改原冻结 control 来制造成功。真实恢复是主任务的后续验证，本报告没有执行。

## 验证边界与证据

本 agent 的只读内存检查已确认：完整字段保留、原输入/base hash 不变、本地 block/decision 引用一致、已知 base 引用保留、未知冲突引用拒绝、同 worker 冲突拒绝、worker 顺序稳定、显式 record 与 reference-only 保留 ID 链避碰、旧 role0 异常后回退成功、新 scope1 重构、legacy role1 scope0 与不匹配 hash 拒绝。

本 agent 已完成上述最终定向运行，结果是 68 passed、exit 0；新增磁盘回归补齐 scope1 双收据孤儿恢复与 throw-before-fallback 路径。没有扩大为全库测试、工程 build 或真实 Provider 实测。

最终文件版本（2026-10-05T00:40:49.523Z）：

- `apps/server/src/planning/PlanningAssemblyEvidence.ts`：`4686e913304bb315aa41368cce1858ff27c7da7653c8f0add8ca4abdb3afb72d`
- `apps/server/src/planning/PlanningTaskPartition.ts`：`d8a5ef62722aa8bbd55b4b22163360f674dd66e9bc883e181256d0db7b1ebf50`
- `apps/server/src/planning/PlanningRuntime.ts`：`f7b32ac901276a4baa26219afa26a436691b05898c10fce945f033d8663528af`
- `packages/contracts/src/planning.ts`：`b122722b531739e5468239781b654cf66f582c64ad6ba0f29f3d6aa0d15e1d5a`
- `apps/server/tests/planning-assembly-evidence.test.ts`：`bf79ab3a2a7b90f5e46c2c5e908d8aa1ae7fb5c4c0d677b5daab84f1ecb5be8f`
- `apps/server/tests/planning-partition.test.ts`：`a1a3755b886f1081d543759747776a0495ef2e1d923ef840202754defc1b98e0`

原样 selector SHA256：`170075af7f25162ea454b46f28f2f0bd3593e3080d968905b674b4d8a29fadb7`；该 selector 在最终 Runtime 文件中再次核对相同。下面内存检查保存当时 Runtime 文件 hash，最终全文件 hash 见上表。

### 内存证据摘要

```json
{
  "scope": {
    "checkedAt": "2026-10-05T00:22:13.619Z",
    "method": "Actual scopeAssemblyEvidence / assemblePartitions TypeScript functions, Node strip-types with relative .js-to-.ts resolution; existing unchanged Core hash utility. In-memory synthetic contract checks only.",
    "inputsUnchanged": true,
    "completeWorkerRecordsPreservedExceptId": true,
    "localBlockAndDecisionReferencesExact": true,
    "reverseWorkerOrderExact": true,
    "baseRecordExact": true,
    "knownBaseReferenceRetained": true,
    "sameWorkerAmbiguity": {
      "code": "INVALID_STRUCTURED_RESULT",
      "message": "同一工作者的证据 ID 含多个不同记录：shared"
    },
    "unresolvedConflictingReference": {
      "code": "INVALID_STRUCTURED_RESULT",
      "message": "证据引用有歧义，请工作者提供完整来源：shared"
    },
    "legacyAlgorithmCollision": {
      "code": "INVALID_STRUCTURED_RESULT",
      "message": "拆分证据 ID 内容冲突：shared"
    },
    "referenceOnlyCollisionPrevented": true,
    "reservedRecordsAndBaseReferencesPreventChainCollision": true
  },
  "recovery": {
    "checkedAt": "2026-10-05T00:28:28.237Z",
    "method": "Verbatim current PlanningRuntime selector wrapped only with surrounding function bindings and transpiled by existing TypeScript; real scope/partition functions; all objects in memory. No end-to-end disk EIO run.",
    "selectorSourceSha256": "170075af7f25162ea454b46f28f2f0bd3593e3080d968905b674b4d8a29fadb7",
    "legacyRole0ThrowBeforeFallbackClosed": {
      "role": 0,
      "scope": 0,
      "hashPreserved": true,
      "contractValid": true
    },
    "newScope1OrphanSelection": {
      "role": 1,
      "scope": 1,
      "hashPreserved": true
    },
    "legacyRole1VersionRetained": {
      "role": 1,
      "scope": 0,
      "hashPreserved": true
    },
    "mismatchedRegisteredHashRejected": {
      "code": "RESULT_MODIFIED",
      "message": "汇集登记哈希不符合任何有效历史来源"
    },
    "sourceObjectsUnchanged": true,
    "runtimeFileSha256": "6d700f3a5a5d2e56b6c81ac1a4c72c07f7e8ab1cbcd461aee0989f4a8641c6ea"
  }
}
```

