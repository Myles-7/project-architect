# 材料 r7 独立最终内容复核

结论：`contentPassed: false`，需要定向修订。r6 两个精确反例及严重回滚原文兜底已在新契约、接口与故障验收中补齐，内部 JavaScript 已降为非执行短示意；完整新包仍有模块执行顺序冲突和初始化接口丢失。对象保持与结构检查通过，不等于内容契约一致。

控制 `flash-materials-final-20261005-04` 于 `2026-10-05T02:08:31.200Z`（北京时间 2026 年 10 月 5 日 10:08:31）completed。运行 `run-c4b3c93d-c8f4-45f9-9233-3b60120ec026` 为 reviewable，7 个登记任务和 7 次新 Provider 调用，包含两次 review 及一次如实记录为未执行的目标验证。审批身份为 `API automated acceptance; not human review`，真人审阅仍 pending。本独立复核未调用 Provider、未修改应用源码或冻结状态/收据/包。

## R7-B1 / P2：模块 API 的旧顺序与事务提交点冲突

最终新包 `TECHNICAL_GUIDE.md:81`、Core 区块 `blk-tech-module` 的 ResetController.handleReset API 仍明确：

> 调用 DebounceScheduler.cancel()，递增 inputGeneration，创建全新 input 节点

同一新包 `TECHNICAL_GUIDE.md:162`、`blk-tech-interface` 明确采用“快照捕获→预制新节点→取消→replace→复位/清理→focus→原子提交递增代际”。`blk-feat-reset`、`blk-flow-reset`、`blk-tech-data-model` 和 reset task 也要求全部成功前不得递增代际。

这给 CodingAgent 两条不同的权威执行顺序。具体契约反例是：原节点 bornGeneration=G，创建/属性复制或 replaceWith 注入失败时，模块配方已将全局值改为 G+1，而正式事务配方要求该阶段仍为 G。R5 的失败后旧会话守卫失配正是这一类风险。这里记录的是规范矛盾，不冒称目标应用中已经发生故障，也不把短示意当完整可执行目标代码。

须局部同步 `blk-tech-module` 的 ResetController API、状态/调度所有权与恢复职责，统一以全部成功后的提交点递增。其引用到的 flow/page/data/interface/error/task/acceptance 不得保留另一条顺序。既有 bornGeneration 守卫、300ms、空白任务恢复、唯一节点与复制兜底要求保持。

## 保持性分类纠正

此前将 `blk-tech-module` 计入“19 个无关块”不够准确：它明确规定清空顺序，因此实际受 Reset 事务改变影响，属于关联闭包。新报告纠正该分类，旧冻结报告与源文件保持不动。r7 的“19 个对象完全相同”是已经核验的事实；不能用该事实为旧顺序冲突免责。

下一轮关联闭包应为已改的 11 块加 `blk-tech-module`，其余真正无关的 **18 块**完整保留。不能机械要求错误分类的 19 块全部不变；也不能据此扩大业务范围或全面改写模块。

## R7-B2 / P2：精简参考实现时删除了正式初始化接口

r6 新包 `TECHNICAL_GUIDE.md:174` 的 `blk-tech-interface` 明确声明 `AppController.init(elements: { displayElement, initialInputNode, errorContainer, resetButton }): void`，并确定 DOM 依赖装配及初始化顺序。r7 接口列表没有 AppController，也没有 init 的参数契约；`blk-tech-module`（新包 `:92`）只剩“DOMContentLoaded 获取 DOM 引用、完成依赖注入与事件装配”的泛化职责。

短示意降级本身正确，不能以此删除明确初始化接口。当前正常启动时 activeInputNode/代际/调度状态的初始化、事件绑定、显示/错误 DOM 依赖注入以及新只读兜底容器来源缺少同等清晰的装配接口；`showSevereFallbackDraft(draftText, container: HTMLElement)` 与示意引用的 error-banner-container 也没有在初始化接口中闭合来源及可用性。

恢复清晰的 AppController.init 参数与前置/后置条件，保留原四个 DOM 依赖，明确只读兜底容器的提供/创建方式和启动绑定次序。只要求接口、状态与初始化验收，不要求重新写整段完整内部 JavaScript。新增验证应能观察首个真实输入正常进入 300ms 调度、清空按钮有且仅有一次绑定、严重回滚容器已可用；依赖缺失时如实显示失败，不冒称复制成功。

## round7 已正确落实的部分

- R6-B1：replacement 引用与阶段记录明确，替换后 render/clear/focus 失败必须移除 replacement、原位恢复 oldNode，文档仅 1 个 input、唯一 ID、0 残留；继续编辑、手动删空、再次清空有具体验收。
- R6-B2：已明确不得用 trim 条件跳过原排队工作；empty、三个空格、nonempty 三类 snapshot 均重新调度并在 300ms 后校验。空值清除旧展示、空格原文保留和非空展示都有 Given/When/Then。
- 严重回滚：独立只读 textarea 逐字符保留换行与空白、手动选中复制、提示主编辑器未恢复、禁止刷新，有明确接口和验证；真实可视复制仍待目标实现验证。
- 短 JavaScript 仅 28 行，明确为“非执行示意，非CodingAgent直接复制的参考实现”，没有再宣称完整自包含或无 ReferenceError 风险。
- `review-r7-rollback-illustration.mjs` 只给这段非执行示意提供显式合成依赖，检查替换后 active 仍为 old 时 replacement 精准移除、三类原草稿都被转交给调度器、严重回插失败时全文原样传递给兜底接口。三项局部示意检查通过。它不验证未定义的完整应用，不验证真实 300ms、DOM 布局、focus、原生 IME 或浏览器复制行为。

## 结构、证据与新包

30 个稳定 ID 保持，11 个相关区块发生改变，19 个对象剔除批准元数据后完全相同；纠正分类后的 18 个无关对象全部保持。前基线 38 个证据完整对象全部保留，当前共 42 个。最后 reviewer 收到 19 个正式未改块与 11 个完整候选覆盖块，组装为完整 30 块，并另获 11 个旧批准正文比较基线；候选与终态逐块一致，基线与冻结前状态一致。Provider 的 blockers=[] 没有识别以上跨区块冲突。

新 compiler 包 `quality-reviewed-r7-development-package`，sourceRevision=44、manifest revision=45。十个文件及 ZIP hash 全部匹配，30 个完整正文均投影于新 Markdown。8 个任务的全部字段与 Core 投影一致，DAG 无悬挂或环，r6 既有边全部保持；实现→打包→三个验证的顺序不变。300ms、8080、textContent、defer/IIFE、五类属性及性能代理限制保留。

目标应用尚未开发；登记的目标验证因产物/受控环境不可用如实为 unexecuted。真实浏览器、原生 IME、焦点、辅助技术、布局与性能没有由本独立审查执行。性能任务仍说明实测待开发，不将 rAF 前调度代理当物理绘制完成。当前控制沿用冻结启动构建，不据之后的提示词更新宣称本轮已使用新提示段落。

独立结果保存 `review-r7-structure-results.json`、`review-r7-rollback-illustration-results.json` 和 `independent-content-review.json`。下一轮精确反馈保存同级父目录 `quality-feedback-materials-round8.txt`。旧冻结结果不改；本报告不代替真人批准或目标应用验收。
