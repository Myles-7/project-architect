# 反馈部分审批放行回归

验证范围：真实本地文件 Core、真实 PlanningPackageCompiler、真实 Express HTTP 路由。仅使用固定测试 Provider；未调用真实 Provider，未提交代码。

## 修复前：真实编译失败回归变红

命令：`pnpm exec vitest run apps/server/tests/planning-package.test.ts -t 'blocks compilation until every feedback group'`

测试先批准三个阶段，记录新反馈，提议两组互不依赖、分别覆盖三阶段的修订。仅批准 A 后，请求编译应当被 `STAGE_NOT_APPROVED` 拒绝。实际编译成功并发布了 10 个产物，Vitest 输出：

```text
FAIL apps/server/tests/planning-package.test.ts
Approved development package publication > blocks compilation until every feedback group is reviewed and preserves the approved subset
AssertionError: promise resolved "{ revision: 11, …(5) }" instead of rejecting
Test Files 1 failed (1)
Tests 1 failed | 12 skipped (13)
```

## 修复与边界

ChangeSet 新增可选 Core 审阅来源记录；Provider task JSON Schema 保持严格。首次处理反馈时把同依据的活动反馈候选纳入一个审阅范围，记录原始输入哈希、阶段状态与后续合法审阅依据。部分批准仍提交 A，但存在未处理组时不确认整轮输入，也不解除阶段门控。同依据 sibling 依据失效后只能重新分析或明确拒绝，不自动恢复其批准资格。

完整批准或明确拒绝余项后，从实际已批准的修改累计恢复阶段；产品或技术变化仍按既有下游失效规则处理。新输入或其他依据变化会阻止旧拒绝操作恢复就绪或标记输入已审阅。新完整审阅可替代旧失效历史；拒绝旧历史不会抹掉新批准方案。历史无审阅来源的部分反馈在读取时投影回待审门控。

普通阶段部分批准后拒绝 optional 组仍按 coverage 收尾，并补齐输入审阅哈希。版本冲突、审批来源、操作幂等和显式解锁保持原检查。

覆盖：真实编译阻断与落盘 A 保留、拒绝 B 后真实编译和文档内容、新输入 C、同 basis sibling、重新加载、stale 审批拒绝、顺序批准、先拒绝后批准、完整新重分析不被旧 stale 历史阻塞、旧历史拒绝不改新蓝图、历史部分审批兼容、HTTP 422/200 与重复拒绝幂等，以及已有锁定回归。

## 修复后验证

`pnpm exec tsc -b packages/contracts packages/core`：exit 0。

`pnpm exec vitest run packages/core/tests/PlanningBoundaries.test.ts apps/server/tests/planning-api.test.ts apps/server/tests/planning-package.test.ts packages/core/tests/PlanningService.test.ts`：4 files、63 tests passed。

历史门控最后增加清除已误写的输入审阅哈希后，定点运行 `-t 'legacy partially|finishes a partial package'`：2 tests passed。最终四文件完整输出保存在相邻 `2026-10-05-feedback-partial-approval-final.txt`。

同依据追加反馈包的后续边界回归发现初始化不能覆盖正在审阅的累计批准来源；已改为继承活动同 basis 审阅记录，保留原 baseline 和已批准阶段。新增回归与 same-basis sibling、legacy 共 3 项通过，`tsc -b packages/contracts packages/core` 再次 exit 0。新增用例后四文件测试总数为 64；63 项完整日志在这次最后的局部调整之前生成，最后 3 项输出见 `2026-10-05-feedback-review-lineage-followup.txt`。父任务将执行全量终验。

这些回归确认反馈审批边界，不代表真实 AI 全链路或 M8 人工方案审阅已经完成。
