# 普通修订的登记范围与最近候选来源

普通非澄清 revision 以本轮此前完整候选登记 `assemblyBaseTaskId`，登记范围包含此前候选块、明确删除 ID 和未完成范围。若最近原始候选只是局部结果，范围 anchor 沿已登记来源保留完整候选。新反馈运行只继承自身运行内的候选，不把正式蓝图整套内容变成必须重复输出的范围。分片任务在创建时即带 partition，避免继承普通全局修订范围。

角色与形状合法的普通局部结果按原样保存并保留 receipt/hash；遗漏的登记 ID 进入确定性 issues，触发已登记自动修订，在补齐之前不会交给独立评审或提交提案。合法 questions 可以先等待用户回答，明确 removeBlockIds 可以完成对应 ID 的候选职责。resume 在验证来源后恢复旧普通修订的范围元数据，不改写来源产物。

范围 anchor 与内容来源分开：`unfinishedScopes` 的缺失 ID 参考从本轮已有验证结果 map 中的 completed design/integration/revision 按完成时间、登记顺序取最近真实动作；包含已经合法完成的登记分片，研究、验证、评审、paused 或缺验证结果的任务不能供正文。完整 anchor 仍承担登记范围职责。`previousCandidateSources` 为每个参考动作记录 `{ blockId, taskId, action: 'replace' | 'remove' }`，来源统一时兼容保留 `previousCandidateTaskId`。同一原始产物中的冲突动作仍可见，不在本地裁决。

这只是任务上下文中的真实结果引用，没有拼接或改写 canonical output、receipt、正式 state，也没有创建第二套方案模型。`currentDraft` 仍是最近原始候选，局部稿的缺失正文从 `unfinishedScopes` 获取。Prompt 中将它称为“唯一最新完整草案”的表述已另行报告给主 Agent；本补丁没有修改 Prompt，也没有实现正式旧正文屏蔽。

修改位置：

- `apps/server/src/planning/PlanningRuntime.ts`：普通修订范围登记、resume 回填、分片创建边界、合法局部输出保存与确定性修复。
- `apps/server/src/planning/PlanningContext.ts`：缺失 ID 的最近真实候选引用与精确来源。
- `apps/server/tests/planning-runtime.test.ts`：完整 18 → 局部 4 → 自动修复；合法问题与 restart（已登记/旧元数据）；明确删除与新反馈范围；连续 18 → 局部 A 交付 4 → 局部 B 产品 8 → 完整修复 18。
- `apps/server/tests/planning-context.test.ts`：最近 replacement/removal 与混合来源，排除支持/paused/缺验证结果任务，原结果及哈希不变。
- `apps/server/tests/planning-partition.test.ts`：三个旧遗漏用例改为自动修复路由与预期，仍检查范围、候选修改/删除和正式状态；旧 unversioned assembly 测试补齐共享 per-call Schema/hash 一致性。

红绿与回归证据：

- `planning-ordinary-revision-before.txt`：最初四个范围用例 4 失败。
- `planning-ordinary-revision-after.txt`：范围实现后 4/4 通过。
- `planning-ordinary-revision-regression.txt`：首轮五文件 135 通过、3 失败；三个失败来自旧 fixture 未响应自动修复，随后更新 fixture 保留原范围断言。
- `planning-ordinary-revision-partition.txt`：受影响分片与旧 assembly 用例 5/5 通过。
- `planning-ordinary-revision-unified.txt`：连续局部修订补丁之前，五文件 138/138 通过。
- `planning-ordinary-revision-latest-before.txt`：新增连续局部内容来源用例 3 失败，确认旧完整 anchor 会遮掉先前局部新内容/删除动作。
- `planning-ordinary-revision-latest-after.txt`：内容来源修复后 3/3 通过。
- `planning-ordinary-revision-final.txt`：最终五文件 **141/141 通过**，context 13、partition 30、role contract 48、runtime 49、shared Schema 1。
- 最后源代码改动后执行 server `tsc --noEmit -p apps/server/tsconfig.json`，退出码 0。

最终回归命令：

```powershell
& '<bundled node>' 'node_modules/vitest/vitest.mjs' run 'apps/server/tests/planning-context.test.ts' 'apps/server/tests/planning-partition.test.ts' 'apps/server/tests/planning-role-contract.test.ts' 'apps/server/tests/planning-runtime.test.ts' 'tests/planning-schema.test.ts' --reporter=verbose
```

角色消费修复与旧 receipt 算法兼容记录见 `planning-role-consumption.md`。上述测试仅使用临时项目与 fixture Provider；本次没有调用真实 Provider、构建 dist、取消真实任务、改动冻结控制产物或提交 Git。完成验证后交回主 Agent，停止编辑。
