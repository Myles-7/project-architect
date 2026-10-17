# Materials r4 Core independent content review

结论：**blocked**。最新 r4 的来源、十文件哈希、历史保留与任务执行 DAG 检查通过；内容存在 **3 项阻塞**，不能因运行完成或结构性检查通过而通过内容验收。

## 复核对象与边界

- Control：`docs/validation/agy-2026-10-04/real-integration/flash-materials-final-20261004-01`；最新包：`quality-reviewed-r4-development-package`。
- sourceRevision **32** → 发布/最终 revision **33**；basisHash：`d7d6052422f208b3042fa76c6347a9cc436abc3e1c1985ef56fc0f377f5ce8e2`。
- Run：`run-167084dd-7b42-4c3b-a43c-0fae51d1040a`；control completedAt：`2026-10-04T23:49:55.957Z`。
- 只读取真实最新来源/导出材料，对实际完整代码块执行合成 VM。没有修改目标应用、蓝图、冻结 control、历史产物或收据；没有调用 Provider、构建、批准或提交。新增文件仅本报告和同 control 的 `independent-content-review.json`。
- 静态/合成结果与原生浏览器验证分开。真实 Chrome/Edge/Firefox/Safari、系统 IME 生命周期与重定向、物理布局、屏幕阅读器以及性能全部 **unexecuted**。

## 来源与保留检查

source32 与最终发布 blueprint 文件 SHA256 均为 `c6e977767f1757bd65442cd8b0ebfca0c103c9f56185020bf943184a2e9a99df`。实际 ZIP SHA256 与声明一致：`380f1afbb5c71d9acd75644cce4f81031028b9cfd98ca4b9b2f2d8d54457b789`。十个实际导出文件逐一匹配包清单，最新包 manifest 与 control 最后一项一致，最终 blueprint 等于 source32，并非继承的 source28/r3。

30 个原块 ID 无增删；12 个无关完整块的规范对象与原 JSON 对象字节均完全相同：`blk-prod-target`、`blk-prod-problem`、`blk-prod-non-goals`、`blk-deliv-task-layout-styling`、`blk-deliv-acc-security-edge`、`blk-deliv-task-error-handling`、`blk-tech-stack`、`blk-tech-deployment`、`blk-deliv-task-package`、`blk-deliv-acc-package`、`blk-deliv-val-security-xss-audit`、`blk-deliv-val-perf-benchmark`。基线证据实际为 **29 条**（28 条历史证据加 r3 反馈），不是 28 条；29 个原证据完整对象与原 JSON 对象字节均保留，新总数 33。继承 revision28 的 blueprint/planning/decisions/metadata 四文件与原 control 相同。完整逐项哈希证明在 JSON 中。

八个任务导出 spec 全部字段等于 source `block.task`，任务 content 全部保留在 DEVELOPMENT_PLAN。任务 ID/顺序、全部 `dependsOn`、`blueprintDependsOn` 与 blueprintReference 的依赖边完全保留。两处 `requirementIds` 映射变化另记：standalone-runtime 从 deployment-spec/tech-deployment 改为 tech-deployment/tech-interface；full-e2e 引用把 tech-error 换为 deployment-spec。此前组合比较 `dagExact=false` 包含这些需求映射，不能误报执行 DAG 回归。本轮未新增 DAG 阻塞。

既存五轮均值 ≤50ms 的“清空重置至重绘前调度延迟”代理指标与 performance 任务全部字段保留，outcomes 性能段落原文一致。本轮不改指标，不将其称作物理绘制实测；既存 total−300 包含定时器迟到的精度建议不重开为新 r4 阻塞。

## R4-B1：新节点重定向事件的保证不成立

位置：source `blk-deliv-val-standalone-runtime.task.failureBehavior`；实际导出 `ACCEPTANCE.md:321`、`DEVELOPMENT_PLAN.md:245`、`tasks.json:295`。

该字段称旧原生 compositionend 若被重定向到新活跃节点，闭包守卫会因 generation 丢弃并保障新节点不被污染，且无依据称其“极其罕见”。若事件到达新节点监听器，currentTarget、新 active node、新 bornGeneration 与当前页面连接四项检查均通过，守卫没有旧原生会话身份可用于识别。

原样代码合成探针：旧 composition → clear → 新 compositionstart → 对**新节点**派发 compositionend，epoch 从 **3 到 5**，pending 从 false 到 true，说明新组合态被结束；随后非 composing input 被接受，epoch 到 **7**。这反驳书面保证，**不证明真实浏览器会重定向**。对旧节点/旧闭包的隔离检查另行通过。

r5 修订：删除不成立的 generation 识别保证及无依据的频率判断；将合成保证明确限制到旧节点回调；把重定向、原生会话终结和真实焦点/辅助技术继续列为 unexecuted，保留版本/IME 日志及按实测修订回归策略。不要编造事件 token、自动通过或永久隔离解锁流程。同步 task 字段和全部实际投影。

## R4-B2：完整伪代码装配依赖缺失，公开接口不一致

位置：source `blk-tech-interface.content` 及模块说明；`TECHNICAL_GUIDE.md:108–310`（完整 fence）、`:261–269`、`:298–304`、方法列表 `:56` 与 returned API `:237`。

源与导出完整 JavaScript fence 完全相同，SHA256 `f8fa176b504e798a2955e7d20887b2845f1ce3002f1e4e555b8a2d273b1edcf8`。代码引用 `FeedbackBanner`、`displayElement`、`errorContainer`，但没有定义、声明或具体注入/装配契约。仅提供浏览器 DOM/定时器全局和初始 input 后执行未经改写的完整 fence，有效输入 timer 到期触发 **ReferenceError: FeedbackBanner is not defined**，catch 又引用同一未声明 banner。架构职责文字不足以给出引用声明、装配顺序或 banner 方法契约。方法说明还列出 `getInputText()/setInputText(val)`，实际 returned API 均没有。

此结论针对“完整、内部自洽”的实现契约；目标应用尚未开发，不能宣称已发现目标应用运行时故障。后续 guard probes 显式提供 banner/ref 宿主桩仅为隔离检查，不使完整接口检查通过。

r5 修订：明确 DOM refs、AppController 初始化装配和 FeedbackBanner 方法签名/错误呈现清除契约，保证正常与恢复路径的每个引用可追踪；实现或移除未返回的方法并同步方法列表。保持已正确的节点闭包、accepted snapshot 与 epoch 逻辑，不要求在 review 中开发目标应用。

## R4-B3：全属性保留要求与白名单 copier 冲突

位置：source `blk-flow-reset.content`、`blk-acc-reset.content` Scenario 5、`blk-deliv-acc-full-e2e.content` Scenario 11 与 reset task；实际导出 `TECHNICAL_GUIDE.md:206–213`、`USER_FLOWS.md:44`、`ACCEPTANCE.md:235/296`、`DEVELOPMENT_PLAN.md:123/137`。

实际 replaceInputNode 仅硬编码 type=text 并复制 id/name/className/placeholder/aria-label，而 flow 称复制“全部 DOM 属性与无障碍配置”，验收要求原有可访问属性和几何样式完全一致。包含持久 `aria-describedby`、`aria-required`、`tabindex`、内联 `style`、`data-test` 的合成原节点经过实际替换逻辑后，**五项全部丢失**。原白名单属性与新节点 focus 保留；这不是物理布局或屏幕阅读器实测，未声称观察到视觉跳动。

r5 修订：定义安全且明确的持久属性复制/克隆策略，覆盖 label/ARIA/tabindex/style/data 配置，单独重置 value 与瞬态错误状态；同步代码、flow/page、task 全部字段和 acceptance，不缩减原保留要求。增加明确属性前后断言，真实布局/辅助技术继续保持 unexecuted。

## 原样代码的合成检查

完整代码未重写任何 handler、scheduler、reset 或 renderer。browser-only 模式暴露 R4-B2；guard 模式明确提供未声明的 banner/ref 日志桩作为宿主 scaffolding，共 **9 passed、2 counterexample、1 blocked**：

| 检查 | 结果 |
| --- | --- |
| clear 后旧节点 end/input 不回显、不报空值错、不创建 timer | passed |
| 新输入后旧节点 end/input 不抹新草稿、不取消新 timer | passed |
| 新 composition 后旧节点 end 不结束新组合态 | passed |
| clear/新输入后已出队旧 timer 无效 | passed |
| 替代调度旧回调无效，有效回调使用 accepted snapshot，不重读 DOM | passed |
| compositionstart 使已出队旧 timer 无效 | passed |
| 新键入/粘贴无需解锁键，使用 300ms delay | passed |
| currentTarget 不匹配或节点脱离当前页面时无副作用 | passed |
| 纯空格原文保留，清旧结果并呈现错误 | passed |
| 新节点接收合成 retarget end，四项 guard 通过 | counterexample R4-B1 |
| 持久属性在替换时丢失，白名单属性/新焦点保留 | counterexample R4-B3 |
| 仅浏览器依赖执行完整 fence，缺失应用依赖 | blocked R4-B2 |

`document.body.contains(node)` 有效表达当前页面连接检查，不以缺少字面 `node.isConnected` 为阻塞。scheduler epoch 与捕获 draft 在实际代码中使用；重复递增仍能使旧任务失效，本轮不对此制造阻塞。

复核末尾重新计算 **18 个 source/继承/包文件哈希全部匹配**（2026-10-05T00:06:55.657Z）。详细源码与导出 hash、全部保留对象 raw-span hash、spec 逐字段对照、十二个探针观察和边界在 `independent-content-review.json` 中。

