# Materials r2 独立内容复核

复核对象为 `flash-materials-quality-publish-20261005-04/quality-reviewed-r2-development-package` 与该控制目录的 `final-snapshot.json`，不是旧 03 / sourceRevision 20 包。package-manifest 的 sourceRevision=24、发布 revision=25、basisHash=`eac57cf23bdead051f55670df14cf9ad4578e4687fbd2c601bffc8797371af23`。本人重新读取并核对 10 个导出文件的 SHA256，全部与 r2 清单一致。本轮只读检查及新增本报告，未调用 Provider、业务 API或修改源产物。

**结论：内容验收仍有两个具体阻断，不能以 ZIP/HTTP/UI 成功替代内容通过。**

## 1. IME 失效只覆盖 compositionend，没有覆盖尾随 input

`TECHNICAL_GUIDE.md:62–65` / 正式 `blk-tech-interface.content` 的实际契约为：

```js
compositionstart: isComposing = true; currentSessionToken = ++activeSessionId; cancel();
compositionend: isComposing = false; if (currentSessionToken !== activeSessionId) return; schedule(..., 300);
input: if (!isComposing && !e.isComposing) schedule(..., 300);
invalidateSession: activeSessionId++; isComposing = false;
```

具体反例：旧 compositionstart 后 token=1；点击 reset 后 activeSessionId=2、isComposing=false、value=''、错误清除、无 timer；迟到的旧 compositionend 因 1≠2 被拒。但随后来自该作废会话的非合成 input（e.isComposing=false）仍满足两个条件并调度。若此时 value 为空，300ms 后 `handleDebouncedValidateAndDisplay` 产生空值错误；若 DOM 携带旧会话文字，则回调按当前 inputElement.value 回显旧文字。input 不检查令牌，也没有说明如何区分尾随旧事件与真实新输入或恢复受旧事件改写的 DOM。

这直接违背 `blk-feat-input-display`、`blk-feat-reset`、`blk-flow-reset` 的“旧会话不能重新调度、恢复旧文本或自动制造空值错误”承诺。新增全局 token 本身不是每个原生事件的来源标识；不能用变量名称断言所有迟到事件已隔离。`TECHNICAL_GUIDE.md:86` 又声称后台回调有 sessionToken/句柄双重匹配，但 schedule/callback 签名没有保存和检查这两个基准，普通新 input 也不递增 token，必须把这个宣称与实际执行契约对齐。

根代理的 `ime-contract-counterexample.json` 已按导出的确切处理器执行 synthetic VM：仅旧 compositionend 无 pending（通过），再送空值 input 得 empty（失败），再送携带旧文字 input 得 old-composition（失败）。我读取并核对该记录，它明确 `nativeBrowserVerification=unexecuted`。**这证明书面契约允许反例，不证明某浏览器/输入法已发生故障。** 本复核没有启动真实浏览器、实现目标应用或重跑该 VM。

修订应同步数据模型、input/composition 事件规则、reset 流程、后台恢复、实现任务和验收。明确旧会话尾随事件的无效边界、真正新输入的开始条件、文本恢复原则及定时器执行时的有效性基准；不能只把同一 token 判断再加到 compositionend，或无差别丢掉清空后的全部 input 导致正常新输入失效。至少覆盖 reset→旧 end→旧 input、旧事件带旧 value、reset→真实普通新输入、新 IME 输入、后台→reset/新输入→恢复等可观察序列；真实 native IME 仍待具备环境验证。

## 2. 清空性能通过条件仍叫“渲染耗时”

性能任务已统一 5 轮、均值、前台可见和待验证状态。首屏端点已改 `domContentLoadedEventEnd-startTime`；输入是最后 input/compositionend→textContent→pre-repaint rAF 的代理指标；清空步骤明确 click→DOM reset 后 rAF。编造的“50–150ms / 305–325ms / 5–20ms 实测”区间已撤除。

但 `blk-deliv-val-perf-benchmark.task.passCriteria[2]` 仍为“清空重置渲染耗时 5 轮均值 ≤50ms”，并原样导出到 `ACCEPTANCE.md:269`、`DEVELOPMENT_PLAN.md:321`、tasks.json。这里的测量端点位于重绘前，不是绘制完成。轮次数量已闭合，指标语义尚未完全闭合，必须同步改为“click至DOM复位后下一次重绘前回调的调度延迟”或所选等价准确名称，保留 5 轮均值≤50ms，不冒充物理可见耗时。

此外，输入步骤目前用 total−300ms 算残余延迟，它包含 timer实际唤醒晚于300ms的部分，不能把这个差值称“纯计算/纯DOM更新耗时”。可以保留为“扣除约定300ms后的调度及处理残差”，或者另外记录回调实际入口时间并分别输出等待/处理/rAF调度；选定后跨字段一致。此处是口径精度建议，不是已测得性能超标。

## 3. 逐项反馈核对

| round2 要求 | 当前 r2 证据与结果 |
| --- | --- |
| 实际 JSON 解码审计可解析执行，eval/new Function普通空白变体失败 | `decoded-audit-command-probe.json` 明确解析成功；根代理执行 10 合成源码样本，原7项+3项空白变体均按预期退出。不是目标应用安全实测。代码采用词法扫描，任务明确排除全应用安全证明。 |
| 确认按钮残留明确退出1 | tasks 的第二条命令对 HTML/CSS/JS 的 btn-confirm/handleConfirm/确认命中执行 process.exit(1)，无命中退出0；旧“仅警告”已移除。本人静态读取，未独立运行该第二命令。 |
| 动态恶意文字回显、Safari、未实现应用状态诚实 | 安全 task normalBehavior/步骤明确动态unexecuted；standalone-runtime明确 Safari macOS 真机待验证。未见将研究查证当目标应用实测的新结论。 |
| IME清空+后台延迟边界 | 已有 sessionId、旧end拒绝、≥1s后台延迟与前台测量说明；**input尾随事件/实际回调令牌契约未闭合，阻断1。** |
| 空值不留旧结果，纯空格保留输入 | error-handling normalBehavior/verification 改为先显示 Old-Alpha→删空→最新防抖执行→占位+提示；纯空格保持三个空格但清除旧结果。点击reset另走即时路径，不制造校验错误。原“展示区不刷新”已撤除。 |
| 性能次数/统计/目标真实 | 首屏冷加载5轮、有效输入5轮、清空5轮，均值边界300/350/50/50；未再声称虚构区间实测。**清空passCriteria仍“渲染耗时”，阻断2。** |
| 开发入口/任务依赖真实 | START_HERE首任务为layout-styling，改为前置条件满足后才开始；tasks保留4实现→package→security/runtime→perf（perf还依赖runtime）顺序；无伪造spike或无源码验证前置。入口明确目标应用尚未实现。 |
| 启动端口/离线前提 | TECHNICAL_GUIDE:144–168、ACCEPTANCE:217–220、package任务同步 python -m http.server 8080 / npx serve . --listen 8080 和localhost:8080；明确 Node/Python环境、npx首次联网/缓存前提。没有新增业务服务端。 |
| 历史textContent过度结论不得篡改，通过新增说明限定 | 原两份安全证据保留；TECHNICAL_GUIDE:197 新 evidence-dab40954 明确点名旧两ID被当前文本节点范围限定取代，当前stack引用该新证据；还新增 evidence-mdn-xss-definition-boundary。旧passed原值仍是历史记录，不能单独读作当前整应用证明。 |
| 原图/原文/个人单页边界与稳定内容 | 当前metadata原图hash仍为0e4b4b8fa59957ba9320f18df50383c59f4ad40978b0cba304d20c0f85bb14a0；原图证据与文字证据未改。原文字行为权威、Q7M4-8261仍为示例、经典IIFE/defer和纯内存边界仍在。没有新增登录/数据库/持久化/协作/支付/页面。 |

## 4. 变更和历史保护的独立对照

为核对“无关块精确内容保持”，将项目历史 revision20 的 blueprint/planning 与 r2 final snapshot 做只读 canonical JSON 对照；20仅作round2之前的历史基线，不作新包验收对象。蓝图30块→30块，无新增/删除ID；21个受影响块改变，9个无关块的完整对象精确保持：target、problem、non-goals、scope、page-main-layout、task-layout-styling、acc-reset、acc-security-edge、val-standalone-runtime。旧23条 evidence无删除、无任何对象修改；现为28条，新增5条。

根代理保存的包校验记录 status=passed，329 checks均pass；它验证归档结构和交付一致性。本人独立做的10项当前r2文件hash匹配也只证明字节匹配。API自动接受的approvedBy字段、HTTP/UI下载通过、Runtime完成和blockers=[]不能证明这两个行为/语义阻断已解决，也不能当真人批准。r2暂不作为最终内容通过包。
