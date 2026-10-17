# 待批准候选的任务上下文

真实材料控制06的评审已收到同ID性能新草案，却引用旧正式正文；便签控制05还出现44→40→3块的普通修订范围遗失。这些原始结果、启动构建与停止原因保留在各自控制目录。不能用本地修改模型产物解决。

`PlanningBlueprintContext` 仅为发给任务的只读投影：依据实际传出的 `currentDraft`、评审 `workerResults.draft`、经角色视图过滤的显式工作者依赖，以及 `unfinishedScopes` 的最近真实候选引用，省略同ID正式旧正文。未覆盖正式块完整保留。最小元数据包含id、stage、kind、title、locked、approvedBy、approvedAt及候选替换/删除动作；冲突动作继续可见。`candidateStatus=pending-user-approval` 明确区分审批状态。

没有生成另一份合并蓝图，没有改写Core状态、冻结basis、canonical result或receipt。完整正式前值仍在审批预览及basis中；本次不声称新增MCP读取正式前值的能力。

正式Locked基线的Runtime回归在修前发现旧正文仍发送，见 `planning-blueprint-context-before.txt`；修后通过，见 `planning-blueprint-context-after.txt`。新增覆盖无候选、明确删除、未完成范围引用、未覆盖正文、冲突动作、不合法角色/暂停结果排除、显式设计依赖和原始哈希不变。定向Runtime/分片/context为97项通过（显式依赖补丁之前）；后续统一全量结果为最新验收依据。

首次统一构建暴露投影返回联合类型的两个TypeScript错误，保留于 `refactor-build-candidate-final.txt`；修正类型收窄后完整构建通过，见 `refactor-build-candidate-fixed.txt`。所有真实控制只在统一回归通过后使用该新构建，旧控制不冒充使用它。
