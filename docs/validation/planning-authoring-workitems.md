# 非拆分角色禁止登记工作项

真实控制反馈指出 scoped design 在 Provider SUCCESS 后返回非空 workItems，实际调用 Schema 仍允许该字段，本地分片校验随后拒绝“工作者不能自行登记子任务”。本次只修改 PlanningSchema.ts、PlanningPrompt.ts 和 planning-role-contract.test.ts，未改 Runtime 路径，未调用真实 Provider。

修复前新增 clarification/design/integration/revision 的 8 项 Schema/接收边界回归均失败：实际 Schema 未声明 workItems.maxItems=0，非空工作项仍验证通过。输出保存在 planning-authoring-workitems-before.txt。

修复为 authoring 角色派生 Schema，保留原完整 groups/questions/evidence/blockers/followUp/clarification 契约，仅限制可选 workItems 为省略或空数组。接收边界使用同 Schema 验证，拒绝而不删除/忽略非法字段。已有 research/validation/review 同样禁止 workItems。Prompt 增补仅登记 decomposition 角色可返回工作范围。

共享 PLANNING_TASK_SCHEMA 没有修改；Runtime 原有 decomposition 独立 partitionSchema 保持至少两个工作范围，不继承 workItems.maxItems=0。role 接收校验与原 validatePartitions 继续保留拆分职责检查。

真实 Core + Runtime 的固定 Provider 回归从每次实际 request.schemaPath 读取 Schema：两个 scoped design 调用均 maxItems=0。完整片段返回空 workItems 时本轮可审阅，完整候选保留，正式蓝图不变；Provider 虚报 SUCCESS 并返回非空 workItems 时本轮暂停，原字段仍在测试输出中，未产生本轮变更包，Project State revision 与正式蓝图均不变。未靠事后裁掉 workItems 接受结果。

修复后角色契约 48/48 passed，输出 planning-authoring-workitems-after.txt。相关角色/拆分/完整 Runtime/共享 Schema 四文件共 117/117 passed，输出 planning-authoring-workitems-regression.txt。`pnpm exec tsc --noEmit -p apps/server/tsconfig.json` exit 0。

代码已停止编辑，等待父任务统一 build 和新的真实控制验证。本记录不声称既有真实控制已经完成全部质量验收。
