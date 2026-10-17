# 长上下文完整传输独立审查（2026-10-05）

## 结论与范围

对下列五个文件的当前版本完成只读审查和 12 类独立临时探针，未发现尚未修复的当前 PlanningRuntime 生产路径缺陷。审查中复现的 Unicode 零进展、JSON Pointer 歧义、审计失败误计读取覆盖、分页预算未包含二次转义问题，均已由主代理修复，并在最终探针中验证。

本结论证明冻结输入、分页传输构造、读取覆盖与门禁的实现行为。另已独立核对主代理真实 AGY 特殊字符探针的原始记录，确认该合成样例必读页直接返回可解析 JSON 且范围完整；这不证明任意用户方案的评审理解或质量。本审查未调用 Provider，也未运行真实模型或修改实现、Frontend、原项目、冻结控制目录。只在系统临时目录复制源码、建立样例并运行探针；临时文件已清理。本报告是本审查唯一保留写入。

审查依据：仓库 AGENTS.md、`docs/blueprint/13_PLANNING_WORKBENCH.md` 所述登记任务与建议状态边界，以及当前 Runtime 的实际调用路径。主代理负责正式测试套件和真实 Provider 验证；本报告不将其测试结果计为独立执行结果。

## 最终审查版本

最终探针开始：2026-10-05 02:59:10.417 UTC（北京时间 10:59:10.417）。
结束：2026-10-05 02:59:12.884 UTC（北京时间 10:59:12.884）。
退出码：0。下表五个源码文件在探针前后的 SHA-256 一致。

| 文件 | SHA-256 |
| --- | --- |
| `packages/agent/src/tools/PlanningContextAccess.ts` | `0cd73986762398204fb81ffa8f491044dff3973add44de778709e4e20ffff9b0` |
| `packages/agent/src/tools/PlanningToolsService.ts` | `83c0e0e7cd1811231fcc07d0acaef57faacd9c185427eb9fed55d6e13f04870e` |
| `packages/agent/src/tools/PlanningToolsMcpServer.ts` | `b754edc64b900548cd7dcfe92d503721904488543fc6d209a76808d4cb133da0` |
| `packages/agent/src/tools/PlanningToolGate.ts` | `f87ae655a7f4663411cfb1ab6a83876a3099fd9554960977289c54d1bca0b36e` |
| `packages/agent/src/provider/AntigravityCliProvider.ts` | `83f64f281c1320d9b20c051ee309c3537ab97675f0dc77a107c714125018aa35` |

探针将三个仅依赖 Node 内置模块的工具源码复制到新建临时目录，把临时副本中的 `./PlanningContextAccess.js` 引用改为 `.ts`，使用已有 bundled Node 的 TypeScript stripping 运行。生成门禁脚本也只在该临时目录执行，未启动 MCP 子进程或 Provider。

## 独立验证证据

| 检查 | 结果与具体证据 |
| --- | --- |
| 大上下文重建、源文件与内容哈希 | 487,827 字节原输入完整冻结；20 条记录；151 页；逐条 SHA-256 一致；重建对象与原对象 deepEqual，含嵌套数组、对象、空数组、空对象、null、布尔值和数字 |
| 完整 MCP 返回包大小 | 大样例所有 index/read 页均不超过 6,000 字节；最大 5,863 字节。计量为 `JSON.stringify({content:[{type:"text",text:JSON.stringify(result)}]})` 的 UTF-8 字节数，包含二次转义 |
| 特殊字符分页 | 反斜杠、控制字符、中文和 emoji 分别完整重建；最大返回包依次为 5,913、5,745、5,743、5,593 字节；每页跟随 nextOffset 且有进展 |
| Unicode 最小页 | `length=1`、offset 在 emoji 高代理项时返回整个 emoji 并推进；offset 在低代理项时明确拒绝；正常顺序分页不返回孤立代理项 |
| JSON Pointer 与结构记录 | 每段正确转义 `/` 和 `~`；真实 `@structure` 字段与合成父结构通过 `encoding` 和父路径区分；样例所有路径唯一 |
| Review 当前证据 | 当前候选引用的 knownEvidence 全部为 requiredForReview；taskHistory 保留可读但不设为必读；所有必读页覆盖后缺失列表为空 |
| 非 review 读取方式 | 带 currentDraft 的非 review 上下文 requiredKeys 为空，继续按需读取 |
| 不完整区间 | 仅末页或首尾不连续读取不能满足必读覆盖 |
| 调用隔离 | 相同内容、不同 requestId 生成不同冻结路径；第一调用完整读取不能满足第二调用的覆盖 |
| 审计失败与门禁 | evidenceRoot 为已有文件导致 2 页审计失败；工具读取均 rejected、reads 日志为空、缺失数为 2、finish deny。成功服务完成审计后提交回执，finish allow |
| 冻结数据篡改 | 改动 source 或 entries 文件后读/覆盖检查报错，finish deny；验证不仅依赖提示词 |
| 超长元数据 | 9,000 字符顶层路径的 index/read 均明确报“metadata exceeds”错误，未生成读取回执；没有把不可见输出当作完整读取 |

最终运行共 12 个具名检查全部通过，未设置总字数、总 Token、总调用数或总读取页数门禁。6,000 字节限制约束的是单页传输包。

## 主代理真实调用记录的独立核对

只读核对目录：`docs/validation/agy-2026-10-04/real-integration/gemini31-indexed-context-probe-20261005-02/`。
读取了 result.json、visible-tool-output-observations.json、expected-input.json、stream.ndjson 和已登记冻结 source/index；没有再次启动 Provider。

- 模型：gemini-3.1-pro-high；Provider status=success、exitCode=0；durationMs=76,179。
- 原输入为 923,180 UTF-8 字节，SHA-256 为 `fd2627c7ff16107d2e636de08cbc83461c1ea2f9c4b0168aff9c05e9480ddd38`，与冻结 source 哈希一致。
- 从原始 stdout 重新解析 20 个 planning_context DONE 工具输出，与保存的 observations 深度一致；必读 read 页均可直接 JSON.parse，内容与冻结记录对应切片逐字一致，7 条 mandatory 全部连续覆盖。最大直接工具输出 3,723 字节；这些 mandatory 返回没有 offload URI 或截断替代内容。
- 末尾随机 marker 与模型 structuredOutput.observedMarker 一致，draftApproved=false。该结果只证明此处取值正确及未把候选当作批准内容。

**证据规模须准确表述：** 923,180 字节是保存的总输入；7 条必读记录的 UTF-8 内容合计仅 22,912 字节，排除的历史记录合计 900,082 字节。该真实探针证明大文件冻结与约 23k 特殊字符必读内容的可见分页传输，不能表述为模型已经读完 923k 全部内容，也不能替代对约 312k 当前方案全部必读页的真实验证。读取覆盖不等于完整方案的语义理解。

## 审查发现与修复复核

1. **Unicode 零进展已修复。** 早期版本在合法的 `length=1` 且当前位置为高代理项时删掉最后一个字符，返回空 content 和不变的 nextOffset。最新实现补齐完整代理对，并拒绝从低代理项中间开始。
2. **路径歧义已修复。** 早期版本未转义顶层键，并使用 `/@structure` 合成路径，与同名真实字段冲突。最新版本统一转义每段，结构记录位于父路径并标记 `encoding="structure"`。
3. **当前引用证据已纳入必读。** `planningWorkerContext` 在 review 路径已经将 knownEvidence 过滤为当前候选引用的证据，不能笼统视为历史记录。最终 requiredKeys 排除项仅保留 taskHistory、historicalReviewFindings；本次样例确认 knownEvidence 必读。
4. **审计失败误计覆盖已修复。** 早期版本先写读取区间，随后 Service 审计错误使 MCP 只返回 isError，但 finish 仍可通过。最终 Service 先纯读取、等待审计成功，再提交经过冻结内容核对的回执；失败探针现为拒绝。
5. **传输大小按完整包装计量。** 早期只约束 content 的一次 JSON 序列化；反斜杠样例最终 MCP 包装达 12,336 字节。最终按完整 MCP 包装缩页，元数据本身过大时明确失败，所有正常分页探针均在限制内。

## 安全、重试与取消审查

- Context 工具只接受索引、已登记 key 和整数范围，没有任意路径参数。冻结 source 和 entries 在每次读、提交回执及完成检查时重新核对哈希。
- Context 读取记录为输入引用，未通过 evidence_record 写成新证据，也未升级项目事实的批准状态。正式 State 仍由既有结构化流程处理。
- 生成的门禁只允许登记的 Project Architect MCP 工具、finish 和已登记真实图片；shell、写文件、任意原生读取与自行启动子 Agent 仍被拒绝。
- 当前 PlanningRuntime 为每个 task 使用独立目录，调用前持久化 attempts，requestId 为 `task.id-attempts`；因此当前路径中的顺序重试不会共享前一调用的读取覆盖，多 task 并发也不会共享固定配置目录。
- Provider 在成功终态接收结构化输出之前再次核对必读区间和冻结完整性。取消结果优先，取消后跳过必读校验，避免把取消改写成上下文缺失失败。本项依据源码审查；没有在本次独立探针中启动 Provider 进行取消测试。

## 结论的适用边界

1. 读取回执能证明工具成功构造并审计了哪些原始范围，不能单独证明下游客户端实际呈现或模型实际理解。本报告已核对上述特定真实样例的页可见性与 marker；更长的当前候选、完整实际方案及其评审质量仍须按实际输入验证。
2. 现有 `Provider.complete` 仅在 planning-tools.json 和注册 MCP server 同时存在时使用冻结索引；缺少任一文件时仍走全文 stdin。本次审查确认当前 PlanningRuntime 始终先 preparePlanningWorkspace，故不是当前生产路径的遗漏。若未来支持绕开 Runtime 的 planning 调用，应明确要求登记配置，避免无校验的全文退路。
3. 同一 cwd 中并发复用同一 Provider 配置、或同一 requestId 重用，不属于当前 Runtime 的调用约定；本次未将这类外部误用当作当前生产阻断项。
4. 超长路径当前会明确失败。若产品将来允许任意长对象键，应采用可分页的路径元数据，或在入口定义受支持的键长度；当前失败不会被错误计为已读。

