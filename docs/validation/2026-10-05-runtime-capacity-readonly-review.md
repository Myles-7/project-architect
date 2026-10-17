# 容量恢复修复只读复审

只读核查了 Runtime、TaskPartition、PlanningContext 及 partition 回归。`pnpm exec vitest run apps/server/tests/planning-partition.test.ts`：19/19 passed。未调用真实 Provider、未改 Runtime 或测试、未提交代码。

已核对的修复：候选中的既有修改/删除跨问题回答保留；最终范围守卫从 candidate 实际 block/remove 动作判断，不从正式蓝图 ID 判断；汇集 result 写完而 receipt 未写时只从已登记且逐一验证的 children/base 重建，并拒绝 Provider 无收据结果；合法 reopenReason 的第四道重提问题不因 topic 旧答案丢失。单并发路径在父 Provider 调用的 finally 中释放 slot 后才登记和执行拆分，不持有父 slot 等待子任务。原失败调用保留，错误 structuredOutput 没有入候选或 assembly 来源。

仍有一个首次 authoring 拆分遗漏，已报告父任务重新修复：`PlanningRuntime.splitWork` 建立 child 的 `requiredBlockIds` 时过滤正式已有 ID，只要求 parent/base 已列为必需或全新 ID。因此初次拆分明确登记要修改已有 notes，工作者空输出仍可完成；旧正式内容使 coverage 合格，最终方案变成可审阅。

用实际 compiled Runtime + 真实 Core 在临时项目复现后删除临时目录：先批准完整 product 旧蓝图，重新生成 product；Provider 容量错误后登记两个 scope，a 保持 target，b 修改已有 notes 的保存失败恢复行为；b 合法结构化返回空 groups。实际结果：

```json
{
  "status": "reviewable",
  "unfinishedBlockIds": [],
  "registered": [
    {"goal": "保持目标", "blockIds": ["target"], "requiredBlockIds": []},
    {"goal": "修改已有notes保存失败恢复行为", "blockIds": ["notes"], "requiredBlockIds": []}
  ],
  "candidateBlocks": ["target"],
  "notesContent": "新增笔记、编辑标题与正文、手动保存，并在失败时保留编辑内容。"
}
```

建议要求全部已登记 scope blockIds 都被实际候选修改/保留/删除动作覆盖，并新增首次 authoring 拆分中正式修改/删除空输出的回归。此记录是修复前反例，之后应附父任务的修复与终验结果。

## 后续修复复核

planning_ui 已修复首次 authoring 拆分，使全部 scope blockIds 成为必需 candidate 动作，并补旧 hash 一致 SUCCESS 失责片的恢复。只读核对 scope-rejection-plan 先保存完整失效集合再逐个归档/清理；中断重启验证任务身份、attempt 与归档哈希，并失效全部派生草案/评审。原兄弟片和拆分登记收据保留。未发现新的实质阻断。

随后新增 Provider 调用准备期间取消守卫（详见 runtime-cancel-preparation.md）。完整 Runtime/partition 回归共 68/68 passed，其中 partition 24/24；包括首次正式块 modify/delete、历史失责片以及 after-reference/after-cleanup 两处恢复。完整 stdout 在 `runtime-cancel-preparation-full.txt`。原反例已修复，此前 JSON 保留为修复前证据。
