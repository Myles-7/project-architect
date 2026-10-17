# M8：旧历史 rollback 写入口停用验证

本报告仅验证已复现的旧历史回滚正式状态缺陷。实现保留兼容方法但立即拒绝，不新增历史恢复功能，不修改 TimelineView、API client、旧 readiness 或 documents 流程。

## 实现与契约

- `packages/core/src/engine/ProjectStateEngine.ts`：`rollbackToRevision` 标记废弃并立即抛 `LEGACY_WORKFLOW_RETIRED`。保留方法签名，不读取项目或目标历史文件，不执行 Commit/崩溃恢复。
- `apps/server/src/server.ts`：POST `/api/projects/:id/rollback` 在解析项目位置或处理 revision 前直接返回 HTTP 410，错误码 `LEGACY_WORKFLOW_RETIRED`、`recoverable: false`，没有成功 snapshot/stateRevision。生产、Mock 和注入 orchestrator 采用同一处理器。
- `packages/contracts/src/errors.ts`：登记该错误码。`docs/api/API_V1.md`、`docs/api/PLANNING_API.md`、`docs/blueprint/implementation/12_API_CONTRACT.md` 记录入口退休行为与保留的恢复边界。
- `tests/product-hardening/phase1-5-enhancements.test.ts`：唯一旧成功回滚测试改为拒绝，并比较请求前后的完整加载 snapshot。

`ProjectTrashService.restoreFromTrash` 的完整目录恢复、`StateCommitManager` 两阶段 Commit/崩溃恢复、PlanningRuntime 恢复实现与 GET 历史接口均未修改。

## 独立回归设计

新增 `apps/server/tests/rollback-retirement.test.ts`，Vitest alias 直接加载实际 Core 与 Express 源代码。

先由 Core/PlanningService 在系统临时目录建立项目，实际提出并批准产品 ChangeSet，保存目标 rev.3。随后记录新输入、批准新版产品 ChangeSet，得到当前 rev.6；测试断言两份批准蓝图正文确实不同。每项边界测试复制该完整项目目录到新的临时 workspace，不读取或写入用户项目。

字节检查遍历整个副本：比较目录/文件名清单编码字节、文件集合与每个文件的原始 Buffer。显式确认 `project.json`、全部 11 份规范状态文件及 `state/current.json` 均在比较集合中；历史 revision、manifest 与其他项目文件也全部比较。每次拒绝请求后立即比较，不仅比较版本号或规划投影。

覆盖范围：

| 边界 | 验证 |
|---|---|
| 直接 Core，正常与被篡改的目标 | 连续相同目标、当前目标、不存在的目标一律抛退休错误；storage.readJson、loadProject、recoverIfNeeded 均未调用；完整树字节不变 |
| 直接 Core，不存在项目 | 在 storage.exists 前拒绝 |
| 实际 Express，生产/Mock/注入 orchestrator | 相同 operationId 的重复请求、过期 expectedRevision、当前/不存在的目标、缺少目标参数均为 410；loadProject/getSnapshot/rollbackToRevision/recoverIfNeeded 均未调用 |
| 被篡改的历史 manifest | 改坏历史 metadata 的 manifest hash，先确认 verifySnapshot=false；再验证三种 API 模式均拒绝，篡改文件与当前状态均原样保留 |
| 只读历史 | 三种模式在拒绝后 GET timeline 均为 200、返回当前 rev.6 和创建历史事件；GET 后整个项目树仍逐字节一致 |
| Provider 隔离 | 回归中的 FixturePlanningProvider 调用记录为空；没有启动真实 Provider |

## 执行证据

使用本地已安装的 Node/Vitest，没有安装依赖。先加入新预期，在旧实现上运行同一组测试：**10 项失败**，失败来自旧 Core 恢复成功、旧 API 返回 200，及不存在项目提前读取。fixture 初始化成功，篡改 manifest 的 verifySnapshot=false 检查成功。

随后停用两个写入口并重跑：**10/10 通过，2 个测试文件通过**。旧文件中的另外 5 项按名称过滤，未执行；其中包含 Provider 健康检查，避免超出本次范围。

- 红灯原始输出：`rollback-retirement-before.txt`
- 绿灯原始输出：`rollback-retirement-after.txt`
- 过滤表达式：`Retired historical rollback|Phase 5: Historical rollback`
- 测试文件：`apps/server/tests/rollback-retirement.test.ts`、`tests/product-hardening/phase1-5-enhancements.test.ts`

保留行为检查：**19/19 通过，5 个测试文件通过**，原始输出 `rollback-retirement-preserved.txt`。

- `packages/core/tests/StateCommit.test.ts`：6 项。
- `packages/core/tests/ProjectTrashService.test.ts`：3 项。
- `tests/reliability/02-recovery.test.ts`：4 项。
- `tests/persistence-recovery.test.ts`：1 项。
- `packages/core/tests/TimelineProjection.test.ts`：5 项。

PlanningRuntime 中断日志恢复专项：**1/1 通过**，原始输出 `rollback-retirement-runtime-recovery.txt`。仅选择 `recovers a completed result and event sequence from the interrupted journal`；同文件其他 48 项未执行。该检查采用已有确定性 Fixture Provider，不调用真实 agy。

本次共执行并通过 **30 项**修后检查。未声称完整测试套件或生产 dist 构建通过；统一构建与独立复核由 root 后续执行。现有 UI 回滚按钮与 client 方法按本次范围保留，调用将收到明确退休错误；后续 UI/工具整合另行处理。

所有新增回归副本在 afterEach 中清理；未提交 Git，未改用户项目，未改其他已存在的未提交实现。
