# 普通修订请求的完整候选职责

真实控制中出现 3/41 两个局部输出交替补缺的现象。Core 已登记 requiredBlockIds 44 项，但普通 revision 的 Provider prompt 未像 partition 明确列出全部输出职责，任务 goal 中的缺失 ID 容易被理解为本次仅需输出的范围。

最小实现只修改 `apps/server/src/planning/PlanningRuntime.ts` 的 scopePrompt 构造位置：非 clarify、非 partition 的 revision 追加完整职责说明与 `task.requiredBlockIds` JSON 清单。提示明确本任务 goal 是问题清单，不是完整输出范围；本 Run 已修好的候选块和删除动作必须保留，结合 currentDraft/unfinishedScopes 的最近真实候选及来源补齐全部登记 ID，返回完整待批准包。与本次候选无关且未改变的正式块仍不复制。clarify 与 partition 保持原提示边界。

没有本地合并或改造 canonical 正文，没有修改范围登记、回执、Core 状态、角色 Schema、PlanningPrompt 或现有 fixture。

新增独立 `apps/server/tests/planning-ordinary-revision-prompt.test.ts`，直接捕获 Runtime 在真实调用边界构造的 Provider request：

- 同 Run 44 项候选，Provider 桩依次返回 3 项、41 项、完整候选。replacement/removal 两种情况都检查每个普通 revision 请求携带全部 44 项；第二和第三 goal 的缺失问题集合互补，不能取代完整输出范围。
- 验证先前修好候选仍在上下文中；局部原始 result 与 receipt hash 保留，最终提案等于最后实际完整输出，正式 blueprint hash 未改变。
- 先生成一个 44 项候选 Run，再启动仅涉及三项的新 feedback Run；其普通 revision 请求只继承自身三项职责，不继承正式整套蓝图或此前 Run 的候选范围。
- 澄清修复不追加普通完整蓝图职责；revision 超限后的登记分片仍使用自己的 partition prompt。

红绿结果：

- `planning-ordinary-revision-prompt-before.txt`：修前 4 失败、1 通过；四个失败均来自实际普通 request 没有 requiredBlockIds 完整职责清单。
- `planning-ordinary-revision-prompt-after.txt`：修后 **5/5 通过**。

执行命令：

```powershell
& '<bundled node>' 'node_modules/vitest/vitest.mjs' run 'apps/server/tests/planning-ordinary-revision-prompt.test.ts' --reporter=verbose
```

这里的实际 request 是 Runtime 构造并交给本测试 Provider 桩的请求，不是真实 agy 调用。桩的 3/41/完整输出序列独立于提示文本，测试没有用提示关键字改变已有 fixture 响应来取得通过。回归证明完整职责确实进入调用请求；它不证明真实模型必定遵从或真实控制的局部交替已经消失，后续真实复跑由主 Agent执行。

本轮未构建 dist、未调用真实 Provider、未取消或修改控制任务。完成五项定向回归后停止源代码与测试编辑，统一构建和全量验收交回主 Agent。
