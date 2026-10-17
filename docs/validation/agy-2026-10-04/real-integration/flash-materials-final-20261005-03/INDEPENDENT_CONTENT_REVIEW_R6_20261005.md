# 材料 r6 独立内容复核

结论：`contentPassed: false`，需要定向修订。Runtime、Core 自动批准与新 compiler 开发包真实完成；替换前失败的旧会话可编辑问题已改善，但完整规范伪代码的替换后回滚仍留下重复输入框，空白草稿的待校验任务仍丢失。本结论不依赖 Provider 的 `blockers=[]`。

控制 `flash-materials-final-20261005-03` 于 `2026-10-05T00:52:19.792Z` 完成。运行 `run-80094931-1ed4-4b40-bfe3-14a90886e7da` 为 reviewable，四个登记任务全部 completed，四个本轮真实 Provider 调用。审批身份明确为 `API automated acceptance; not human review`，真人审阅 pending。本独立复核未调用 Provider、未修改应用源码、未重写原收据、状态或产物。

## R6-B1 / P1：替换后回滚无法识别已挂载的新节点，留下两个同 ID 输入框

冻结新包 `TECHNICAL_GUIDE.md:384` 的 rollback 依赖 `activeInputNode !== oldNode` 判断替换后的新节点。但 handleReset 在 `:460` 的提交点才将 activeInputNode 指向 newNode；在 replaceWith 已成功、renderPlaceholder / clearInputError / newNode.focus 抛错的实际路径中，activeInputNode 仍是 oldNode。rollback 因而走 `:387` 的 insertBefore，只把 oldNode 插回而不移除已挂载的 newNode。

直接提取完整 JavaScript fence，以保留 parent/child、nextSibling、replaceChild 和 insertBefore 语义的合成 DOM 执行三种故障：render、错误清理、focus。每次得到两个 input、两个 `project-name-input` ID、值分别为 `''` 和 `'Keep me'`。原文确已恢复到 oldNode；但前面的空 newNode 仍可见，向该字段键入得到 **0 个调度任务**，因它不是 activeInputNode。原字段继续编辑和手动删空能工作；撤故障后重试成功仍留下两个输入框。这不满足原子拓扑恢复、单输入布局、label 关联、继续编辑/重试和清空幂等契约。

修订应为事务显式跟踪实际挂载的 replacement 节点和替换阶段，回滚时替换/清除精确节点并恢复原位置；不可用尚未提交的 active 指针猜测。准备、替换前、替换中/后各阶段故障均应断言：仅一个活跃输入框和唯一 ID、原节点/原文/位置恢复、无孤儿监听字段，继续编辑/手动删空/重复重试都有效。同步 flow、page、data、interface、error、task 所有字段、validation 与 acceptance。

## R6-B2 / P2：空字符串或纯空格的待校验任务在回滚时丢失

`TECHNICAL_GUIDE.md:416` 以 `hadPendingTimer && draft.trim().length > 0` 才恢复任务。先成功展示 `'Old displayed value'`，再删除为 `''` 或输入三个空格，此时各有一个等待中的校验任务；让随后清空的 replaceWith 抛错。cancel 清掉原 timer，rollback 对两类草稿均不重新调度。故障撤除并运行全部剩余任务后仍显示旧项目名，没有非空提示，输入框却为空或纯空格。

相同路径下非空 `'New pending draft'` 会正确恢复一个任务并更新展示。因此它是空值特殊条件导致的实际反例，违背 E01、失败恢复任务归属、手动删空清除旧展示和“若存在排队任务则按原草稿恢复”的 data/task 契约。无效草稿同样需要校验；修订须保留完整原文，并明确所有草稿的排队工作与 epoch 归属，而非只为非空内容恢复。增加 empty / whitespace / nonempty 三类故障前后精确验收。

## 另一个同步缺口

flow/error/task 的严重回滚失败兜底要求只读文本框或草稿容器供复制；精确伪代码 `TECHNICAL_GUIDE.md:429` 只将原文拼入普通横幅 textContent。注入替换后呈现失败及回插失败后，合成 DOM 中没有 readonly textarea，active 指针仍指向脱离的旧节点。这条极端恢复路径需要明确可见、保留换行及空白的原文复制机制与如实错误状态，不能以“已完整恢复”或普通布局文字冒称可用编辑器恢复。此项记为同步缺口，前两项已足以阻塞内容验收。

## 保持性、审查输入与导出检查

- 30 个稳定区块 ID 不变，11 个相关区块变更；19 个无关区块剔除批准元数据后逐对象完全相同。
- 前基线 35 个证据完整对象全部保留，新增后共 38 个；既有原始证据没有被相同 ID 改写。
- Provider reviewer 获得 19 个未改正式区块与 11 个完整候选覆盖区块，组合为完整 30 块；11 个旧批准正文作为独立历史基线。组合候选与最终正文逐块一致，历史基线与冻结前状态一致。上下文完整并不代表 reviewer 识别了上述反例。
- 新 compiler 包 `quality-reviewed-r6-development-package`，sourceRevision=40，manifest revision=41；十个文件哈希全部匹配，ZIP 与 manifest 哈希匹配，所有 30 个正文完整投影于新 Markdown。
- 8 个任务，无悬挂依赖或循环；全部 task 字段与 Core 区块投影一致。error-handling 任务合理增加 reset-workflow 前置，原依赖没有移除；实现→打包→三个验证任务顺序保持。
- 300ms 防抖、8080、textContent、经典 defer/IIFE、原生重定向边界和持久属性要求仍保留。新节点成功清空、五类属性复制、旧节点迟到合成事件隔离以及创建/绑定/replaceWith 前失败后的继续编辑、手动删空和重试通过合成检查。
- 目标应用尚未开发。真实浏览器、IME、辅助技术、布局、焦点及性能未执行；性能仍为 requestAnimationFrame 前调度代理目标，不能视为物理绘制或实测通过。规划期 Docker 不可用证据保持；本次规范合成检查不能替代目标测试。

独立检查脚本和结果为 `review-r6-pseudocode.mjs` / `review-r6-pseudocode-results.json`、`review-r6-structure.mjs` / `review-r6-structure-results.json`。脚本直接读取冻结状态；原文件 hash 见结构结果。独立复核身份和分层结论另存 `independent-content-review.json`，冻结控制记录不作修改。
