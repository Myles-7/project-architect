# Pending-draft AI revision：独立审查

审查者：`/root/agy_capabilities`。工作区：`D:\桌面\项目构思`。此报告只覆盖草案修订入口及相关 Core 发布、恢复、上下文和 UI 行为；没有更改实现，没有构建，也没有调用真实 Provider 或运行真实项目 UI。

**规范结论：通过所审查范围。** 审查中发现的人工待审批锁意图半提交问题已修复并由独立回归验证。当前未发现未解决的规范阻断。此结论表示软件边界符合契约，不表示真实 AI 产物的内容质量或用户验收已经通过。

**代码质量结论：通过所审查范围。** 状态仍由 Core 写入，候选与正式蓝图区分完整；新增来源类型兼容旧 Run；Provider 内容先经过严格契约校验，再由 Core 继承受校验的人工元数据。没有新增数据库、账号、云服务或依赖。没有剩余的必要代码质量修改。

## 依据与范围

规范依据为 `AGENTS.md`、`docs/blueprint/13_PLANNING_WORKBENCH.md` 与 `docs/api/PLANNING_API.md:36` 起的草案修订契约。已读并追踪：

- `PlanningDraftRevision.ts` 的捕获、完整源哈希校验、pending 分组投影与提示。
- `PlanningRuntime.ts` 的 start / finishDraftStart / cancel / resume / task scope / context / invoke / proposal 发布路径。
- `PlanningService.ts` 的 get / recordInput / proposeRevision / edit / approve / commit；共享规划类型、API 路由及客户端。
- `PlanningWorkspace.tsx`、`PlanningChangeSet.tsx` 和 `usePlanning.ts` 的原阶段来源提交、编辑互斥、失败反馈保留与恢复入口。
- server / web 的草案修订测试及 Core 的审批与边界测试。许多规划文件为未跟踪文件，审查直接读取当前文件，没有把 git diff 当作完整范围。

## 规范核验

| 要求 | 审查结果与依据 |
|---|---|
| 仅使用有效 pending / partially-approved 来源、同一原阶段、至少一个 pending 分组 | 捕获前检查版本、完整状态与 basis；已批准、已拒绝、stale、跨阶段、缺失来源及无反馈请求均在保存新输入前拒绝。冻结文件保存完整原包，候选只投影 pending groupIds。 |
| 首个尚未批准产品草案可以续修；技术/交付门槛保持 | 有明确合法来源时只豁免 product 的首次澄清门槛。technical 仍要求 product approved，delivery 仍要求 technical approved，普通 feedback 仍要求正式蓝图。HTTP 首次产品修订和两种前序审批拒绝有回归覆盖。 |
| 保留原草案、已批准前缀与审批历史；新结果待批准 | 反馈使旧来源可投影为 stale，但其 groups / evidence / approvals 原样保留。新包无 approvals，所有新 groups 归一为 pending；正式蓝图只在明确批准时变化。 |
| 优先最新候选，不由旧正式正文吞掉候选职责 | currentDraft 优先本 Run 最近完整结果，其次才使用冻结初始源；评审得到显式 previous-pending 基线。原 pending 块及删除 ID 登记为 requiredBlockIds，正式蓝图同 ID 不豁免候选动作。正式旧正文只作标明用途的评审比较。 |
| 反馈提交后中断可恢复且原文只保存一次 | pendingStart Run、请求、完整源和原 basis 先持久化。恢复比较请求及反馈操作 fingerprint，只容许这一条原始反馈新增输入；无关输入及其他正式依据变化拒绝。中断后重启续接和无关输入拒绝均通过。 |
| 准备阶段取消不会由普通重试自动重启 | start 的同操作分支对 cancelled prepared Run 返回原 Run；只有显式 resume 可进入 finishDraftStart。该分支进行了静态追踪，当前测试未单独注入这个准备阶段取消场景。 |
| 来源缺失/篡改拒绝；取消仍先停止活动任务 | 上下文、同操作重试、resume、Provider 调用前及返回后都重新校验冻结源。缺失/篡改源在重启时返回 RESULT_MODIFIED；瞬时失败期间改源不会发起第二次调用。活动取消先 abort，再保存源损坏诊断，不因损坏继续工作。 |
| 人工 pending 锁意图仅作用于相同稳定块；不能由 AI 自动锁定 | Core.proposeRevision 先严格校验 Provider 内容，继续拒绝 locked / approvedBy / approvedAt。完整 frozen source 与当前 Core 原来源一致性检查后，只复制原 pending 块同 ID 的显式 locked 意图；proposal 与 draft-locks 记录在同版本原子发布。正式 Locked 变更仍需 unlockIds。 |
| UI 原文及编辑保护 | 修订表单仅对有效来源显示。提交原 ChangeSet ID、原 stage 和完整反馈原文；busy、未保存编辑或空反馈禁用启动，只有成功返回才清掉反馈。网络失败保留操作 ID，4xx 清掉旧请求以便重新提交。web 回归覆盖入口显示和完整 HTTP 传输；实际交互夹具由实施者另验，本审查未重复浏览器操作。 |

## 发现与修复核验

**已解决 P1：人工锁意图可能在半提交后丢失。** 初版 Runtime 先 propose 不含 locked 的可审批包，再调用 Core.edit 补入原源的锁意图。第二次写入失败仅将 Run 置 paused，已发布 pending 包仍可被批准，从而丢失原草案明确的批准后锁定意图。这不是对已锁定正式块的直接解锁，而是对尚未生效人工意图的丢失。

最终实现改为 `PlanningService.proposeRevision:102` 的单次 Core StateCommit：在发布候选前验证来源及模型内容，一起写入候选、proposal 操作和 draft-locks 操作。Runtime 在 `PlanningRuntime:505` 先重读源，再调用原子边界。回归验证提交前候选不可见且竞争审批拒绝；提交前 EIO 不留下新包；提交后 EIO 可找回完整带锁包并幂等重试；Runtime 恢复仅留下一个带锁的新 pending 包。API 文档已改为这一原子契约。

**重试来源复检已加强。** 初版瞬时重试只复用已经校验的内存上下文。最终在每次调用前及返回后重读冻结源，测试实际改动 retry 期间的源文件并确认没有第二次调用。此变化避免继续处理已损坏来源；仍保留首次失败诊断。

## 独立验证

在实施者明确通知停止源码、测试及 API 编辑后执行：

```text
node node_modules/vitest/vitest.mjs run
  apps/server/tests/planning-draft-revision.test.ts
  apps/web/tests/planning-draft-revision.test.ts
  packages/core/tests/PlanningService.test.ts
  packages/core/tests/PlanningBoundaries.test.ts
```

使用 Node：`C:/Users/Li Cheng Xin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`。Vitest 3.2.7，退出码 0，耗时 24.31 秒。

| 文件 | 通过项 |
|---|---:|
| server planning-draft-revision | 30 |
| web planning-draft-revision | 6 |
| Core PlanningService | 14 |
| Core PlanningBoundaries | 24 |
| 合计 | 74 / 74，4 / 4 文件 |

测试使用模拟 Provider 结果及隔离的临时文件目录；这些结果不能证明真实模型不会遗漏内容，也不能证明目标应用的运行能力。构建、真实副本内容验收及实际 UI 统一验证由 root 继续执行。本次没有接触真实冻结证据、`.workspace` 或其他未提交改动。

## 审查快照

测试前后下列 13 个文件 SHA-256 全部一致。以下 hash 绑定本报告结论的当前工作区版本：

| 文件 | SHA-256 |
|---|---|
| `apps/server/src/planning/PlanningDraftRevision.ts` | `0630952d42f09bce65c06dcb29c09997eb256a18e37056f818a5a971440359da` |
| `apps/server/src/planning/PlanningRuntime.ts` | `0b569e0758a2d1eed2a45526df76124607f8dfaa90c3fb58ee79863e254a85c2` |
| `apps/server/src/planning/PlanningContext.ts` | `bf1b05e481d69628905394c0bcb3bcba99fba4accf77f61eacb4cd47c76f02d6` |
| `packages/core/src/planning/PlanningService.ts` | `621067fb2dbebf6198f557313fe58bf10d78d69f6f807cd227ffeeaaf499c99c` |
| `packages/contracts/src/planning.ts` | `7e5aeb74f29f10fcc68ce000c443a383bc39097cbd17470d5940c4df97d939c7` |
| `apps/web/src/features/planning/PlanningWorkspace.tsx` | `598a21ce42a84635bd0275bf1f8f85b3d122446ab618bfb6858a4dca62686d2b` |
| `apps/web/src/features/planning/PlanningChangeSet.tsx` | `56d63e78a0f3b777271b34f8adca67ad7a9a963e45de4c0ff7ba5d25a3ad8430` |
| `apps/web/src/api/client.ts` | `dd8140f51dbf40f5472a258e9f8f42c60c947c3d9f8385d24c6568b531747763` |
| `apps/server/tests/planning-draft-revision.test.ts` | `b64432394887d1375bbd840def095c1f09f2c2fd2ceaab91b0b4f056caf9f9be` |
| `apps/web/tests/planning-draft-revision.test.ts` | `15030d0bee3bd4174c3b65ecba7c06ccff6e705a5fa066e582965a6d462fb562` |
| `packages/core/tests/PlanningService.test.ts` | `04a7f1bbd8d64b6ef6452e7894efd1436b396c0b7bfa262b135e82b9f7372c42` |
| `packages/core/tests/PlanningBoundaries.test.ts` | `fd4f01333cd48fe6037d4c21218e8858be01d0e581e73ba1c31a858a0cd3cade` |
| `docs/api/PLANNING_API.md` | `02043239037bb48a511bb3a5315bbdd039f8bca30e087aceedf492b83d3315e2` |

