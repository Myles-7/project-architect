# 批量上下文传输修复与真实验收

2026-10-05。本项是规划任务等待与上下文传输的修复，不是整份项目方案的内容验收。模型按用户授权使用 `gemini-3.8-flash-high`，思考强度为 high。

## 缺陷与修复

长方案冻结上下文包含大量小记录，旧单条读取产生大量往返。新增 `planning_context action=scan`，返回多个带路径、哈希和字符区间的片段；按 `nextOffset` 与 `nextCharacterOffset` 连续续读。总页数和总读取量没有门禁。

首次真实试验 `flash-context-batch-real-20261005-01` 失败：20次 scan 后账本覆盖完整，流式输出仍缺152条必读范围。确定性只读回放显示4010 B的JSON文本可见，而4393 B及更大的部分文本缺失，即使完整MCP响应仍低于6000 B。不能从账本或模型最终答案正确推断所有内容实际可见。

修复同时约束两层大小：JSON文本≤3900 B、完整MCP响应≤6000 B。3900 B是针对本机真实现象的保守余量，不能宣称是所有CLI版本的固定边界。长记录继续分页，Unicode与转义内容完整保留。批量审计成功后才以单一账本帧登记片段；跳页、篡改、跨调用复用仍不能完成独立评审。

## 证据

- 失败→通过回归：`context-batch-visible-bound-before-20261005.json` 为7/8；`context-batch-visible-bound-targeted-20261005.json` 为28/28。
- 全量源码回归：`refactor-vitest-visible-batch-20261005.json`，164文件、972/972，零失败和跳过。
- 真实复验：`agy-2026-10-04/real-integration/flash-context-batch-real-20261005-02/result.json`，168条必读记录通过18次scan完整可见，账本与可见字符覆盖均无缺口。模型正确返回提示词未提供的随机验证码、候选未批准状态与160条实际记录计数。
- 历史失败控制、原始流、账本和只读字节回放诊断保留，未覆盖成成功结果。实际调用记录与四槽组共用，结束后无活跃调用和租约。
- 使用隔离编译验证新能力，原运行中的生产dist保持。随后通过公开Runtime.cancel与shutdown停止未完任务，正常释放调用与槽，再统一构建。新label精确复制停稳来源，以Runtime.resume复用成功收据；不杀进程、不手改正式状态、不伪造调用区间。
- 统一生产构建、Schema及4条正式浏览器流程通过：`refactor-build-visible-batch-20261005.txt`、`schema-visible-batch-20261005.txt`、`playwright-visible-batch-20261005.txt`。

## 边界

合成压力输入的历史段可检索但不是必读；本项只证明指定必读范围的完整可见传输。不能据此宣称整份历史、两份最终方案、真实目标应用或用户本人审阅通过。便笺与材料的真实内容验收分别继续记录。

## 实际调用说明同步

14:46北京时间Flash真实短调用恢复成功。随后两条 `-07` 控制的日志显示仍逐条读取：Provider追加的 `REGISTERED TOOL ARGUMENTS` 仅列 `index|read`，与已经支持scan的工具Schema冲突。这是生产接入遗漏，不能以合成scan压力实验通过宣称默认任务已经使用批量读取。

新增真实CLI输入回归先失败，再修正Provider的action清单、characterOffset/requiredOnly和分页说明，并同步B3宪法。通过公开Runtime.cancel/shutdown正常停稳 `-07`，成功收据仍保留，历史未覆盖；统一生产构建后新 `-08` 精确复制并resume。两条任务的真实账本已经记录scan调用。后续实际等待和整份内容仍以最终控制的调用、审查、导出证据为准。

相关证据为 `batch-guidance-before-20261005.json`、`batch-guidance-targeted-20261005.json`、`refactor-build-batch-guidance-20261005.txt` 和 `-08` 原始调用日志。读取量无总门禁，逐页可见边界、完整读取和finish gate没有放宽。
