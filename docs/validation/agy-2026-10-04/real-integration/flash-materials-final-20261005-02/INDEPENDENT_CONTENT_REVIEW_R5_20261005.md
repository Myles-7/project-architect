# 材料 r5 独立内容复核

结论：`contentPassed: false`。真实 Runtime、Core 自动批准和新开发包导出完成；原 R4-B1/B2/B3 已修复，但完整规范伪代码的两条异常路径仍违背失败保留输入及继续编辑契约。

控制 `flash-materials-final-20261005-02` 于 2026-10-05T00:30:38.047Z 完成。新运行 `run-5385470e-f751-4ebb-a405-62174dc63145` 为 reviewable，四个实际 Provider 调用；本轮独立复核未调用 Provider。新包 sourceRevision=36，manifest revision=37，十文件及新 ZIP，非继承 r4 包。审批身份为 `API automated acceptance; not human review`；真人审阅仍 pending。

已核对完整正式区块对象、前批准基线、proposal、review结果和新 compiler 投影：30 个稳定 ID 保持；19 个无关联区块去除批准元数据后逐对象相同；33 个前基线证据完整对象逐一保留（包括要求的原29条）。四个实现任务→打包→三个验证任务的 DAG 保留，无重复或悬挂任务。全部实际目标浏览器、原生 IME 和性能验证仍 unexecuted。原生重定向限制、显式 DOM/模块装配、五类持久属性完整复制已落实。

## R5-B1：替换前异常使保留的旧输入框失去事件能力

`TECHNICAL_GUIDE.md` 的 `ResetController.handleReset()` 先自增 inputGeneration，再创建/绑定/替换节点。向 `oldNode.replaceWith` 注入失败后，旧节点仍连接且 activeInputNode 仍指向旧节点，但闭包 bornGeneration 与全局 generation 不匹配。继续输入 `Edited after failure` 时新增 timer 数为 0，展示停留 `Keep me`。catch 提示“已为您保留当前状态”，却无法继续修改并正常呈现。

这与 `blk-tech-error` E05、“任何失败场景不丢输入并允许修改重试”的错误处理任务、reset任务失败行为不一致。须明确状态事务提交/回滚、session及代际、调度任务归属，故障撤除后仍可输入、手动删空和重试。不得只回退一个数字或重复监听。

## R5-B2：替换后异常没有恢复已清空的原文

在 replaceWith 已完成、activeInputNode 已切为 value='' 的新节点后，让 DisplayRenderer.renderPlaceholder 抛错。原节点已脱离，而 catch 只显示同一保留状态横幅；原文字不在当前编辑器中，没有回滚或可继续的恢复快照。错误清理和 focus 失败同样必须按所处提交阶段处理，不能以泛化 catch 冒称恢复。

须保存原node/位置、原文/session、generation及调度、展示/错误的恢复快照，并为替换前/中/后定义一致语义、精确故障注入验收及恢复失败的原文兜底。相关 flow/page/data/interface/error/task/validation/acceptance 同步。

## 复核边界

`review-r5-pseudocode.mjs` 直接从冻结 final-snapshot 的完整 JavaScript fence 提取规范；使用合成 DOM 与手动调度器检查正常展示、持久属性复制、替换前/后异常。它不是目标应用代码，不证明真实布局、焦点、辅助技术、原生 IME、浏览器兼容性或性能。原 Provider reviewer 的 blockers=[] 未覆盖上述异常反例。

定向反馈已保存为同级父目录 `quality-feedback-materials-round6.txt`。本复核只新增报告与复核脚本，不改冻结 Runtime、状态、原收据或开发包，不自行批准或运行新修订。
