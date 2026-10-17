# 历史结果的角色消费边界

历史回执仍按原始结果检查哈希。`PlanningResultView` 只供上下文和新的本地汇集消费，不替换 `active.results`，不改写 canonical result、receipt 或来源哈希。新的 Provider 输出仍先接受完整角色 Schema 校验，不能借视图消除非法字段后取得成功。

研究、验证、评审历史的 groups/questions/clarification 不进入新的工作者消费视图；研究和验证的证据、阻塞及必要 followUp 保留，评审 followUp 不传播。普通 authoring 的设计、问题、澄清、证据、阻塞和 followUp 保留，但旧 workItems 不传播；登记 decomposition 的 workItems 仍可见。

新汇集 receipt 写入 `assemblyRoleViewVersion: 1`。没有该字段的旧汇集按原算法重构校验，不能因为新角色过滤改变了重构哈希而误报修改。汇集缺 receipt 时只从验证过的登记来源重建：先尝试新算法，若不符合登记 outputHash，再尝试旧算法；两者都不符时仍拒绝。重建旧算法结果的 receipt 保留旧版本语义，不改变登记输出哈希。

回归覆盖：旧支持正文与设计同 ID 时不覆盖、不冲突，支持新增正文和问题不进入新候选；证据、阻塞及合法补证保留；完整 authoring 保留；从实际 Core/Runtime 临时文件恢复旧合法支持结果后，原 result/receipt/Schema/call 文件字节及 hash 不变；含旧支持正文的历史汇集在完整 receipt 和缺 receipt 两种恢复点都可继续。

验证：

- `planning-context.test.ts` + `planning-partition.test.ts`：41/41 通过。
- `planning-role-contract.test.ts` + `planning-runtime.test.ts` + `planning-schema.test.ts`：93/93 通过；完整输出见 `planning-role-consumption-runtime.txt`。
- server `tsc --noEmit`：通过。

本次没有操作真实 Provider、冻结控制产物或在运行的真实任务，也没有修改 Prompt。此记录是角色消费修复完成时的验证；后续范围修复另行记录。
