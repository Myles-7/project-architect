# Runtime 调用准备期间取消

全量 Vitest 原失败位于 `keeps sibling follow-up work registered and cancellable after another task fails`：等待 active 清除超时，随后清理 Hook 也超时。单独运行该测试可通过，不能据此把全量失败解释为单纯负载导致的等待不足。

确定性只读复现拦截缓慢 follow-up 的 attempts=1 运行记录保存，在保存期间取消，再放行保存。旧 Runtime 继续调用 Provider；仅挂未来 abort listener 的测试桩收到已经取消的 signal 后永不完成。复现结果：

```json
{"providerSawAborted":true,"activeAfterCancel":true,"runningCalls":1,"runStatus":"cancelled"}
```

生产 AntigravityCliProvider 的 execute 会先检查 signal.aborted，否则才挂 listener；已取消时杀掉进程树并完成 cancelled，不会因这条路径无限等待。但 complete 的模型目录预检不接受 abort，之后 execute 仍可能先启动已取消的 worker，再立即杀掉。因此 Runtime 也应在异步保存/Schema 准备结束后、实际调用 Provider 前检查取消。

新回归在实际 FileStorage.writeJson seam 上固定取消时序，要求取消后该 Provider 从未被调用、任务 cancelled、active 清除、runningCalls=0。原缓慢 fixture 同时补先处理已有 aborted signal，保持原测试超时。未修改生产 Provider；测试没有真实远程调用。

修改 Runtime guard 前运行 `pnpm exec vitest run apps/server/tests/planning-runtime.test.ts -t 'sibling follow-up|sibling Provider'`：原测试通过，新固定时序测试失败，输出保存于 `runtime-cancel-preparation-before.txt`。失败是预期没有缓慢 Provider 调用，实际记录了 1 次。

修复在 invoke 的 schema/调用准备完成后、provider.complete 正前方追加 `if(active.abort.signal.aborted)throw new Error('Cancelled')`，沿现有 finally 释放并发槽。没有扩大超时，没有改变已运行 Provider 的取消契约。

相同命令修复后：2 passed、42 skipped，原测试 328ms，固定 gate 测试 303ms；输出保存于 `runtime-cancel-preparation-after.txt`。

完整运行 `pnpm exec vitest run apps/server/tests/planning-runtime.test.ts apps/server/tests/planning-partition.test.ts`：Runtime 44、partition 24，共 68/68 passed，25.90s。输出保存于 `runtime-cancel-preparation-full.txt`。测试包括首次 authoring 正式块修改/删除需实际 candidate 动作，以及旧失责片/派生草案在 after-reference 和 after-cleanup 两处中断后的恢复。

同步只读复核新增 scope-rejection-plan：完整失效任务集合在清理任何 canonical 产物前保存；重启检查 runId、taskId、attempts 与唯一性，归档副本和尚存 canonical 文件逐一校验哈希；依赖或隐式 currentDraft 的后续产物一起失效，不把旧 hash 一致的失责 SUCCESS 恢复为有效候选。未发现新的实质阻断；实际 Provider 全链路由父任务另行验证。
