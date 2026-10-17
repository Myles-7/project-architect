# Project Architect 重构验收记录

**最新收尾（2026-10-05）**：M0–M7 主体、工具整合与桌面界面已实现，M8 最终真实内容和真人审阅未完成。两条 -12 控制在北京时间2026-10-05约21:58再次遇到429 Individual quota reached，均已暂停并停稳；18次实际调用有15次成功，0新批准、0新最终包、0活跃调用及租约。659项共享槽检查通过，峰值4；142／89份成功收据保留。

完整构建、Schema、164文件／982项测试和4条正式浏览器流程通过。最新真实暂停副本47项检查通过，1280／1440／1920共六张截图已逐张查看；恢复按钮紧随错误提示，输入区和右栏方案无遮挡。启动器新增9项检查通过：占用端口不杀进程，正式编译服务／网页／项目列表实际可访问，原项目文件哈希保持；默认端口现有服务也保持运行。

真实候选仍有公共接口、快照与回滚等契约退化，详见 CANDIDATE_PREVIEW_OBSERVATIONS_20261005_12.md；合法结构输出不等于内容质量通过。最终新包、最终包截图及真人审阅仍待完成。Docker未就绪，目标应用IME／平台／性能及外部Coding Agent落地未验证。 详见[本轮记录](FINAL_REPAIR_EXECUTION_20261005_12.md)、[恢复入口](FINAL_RECHECK_AND_RECOVERY_20261005.md)及[启动检查](launcher-closeout-20261005.json)。API自动审批不能替代真人审阅。

## 自动检查

工具整合、共享正式投影与桌面改进后的统一全量检查，在 Node **24.19.0** 执行如下：

| 检查 | 最新结果 | 原始证据 |
|---|---|---|
| `pnpm build` | 通过，完整正式工作区、模板与 Schema 产物 | [构建](refactor-build-final-contract-20261005.txt) |
| `pnpm schema:check` | 通过，共享 Schema 与活动 B3 JSON 一致 | [Schema](schema-final-contract-20261005.txt) |
| 全量 Vitest | **164 文件、982 项通过，0 失败、0 跳过** | [JSON](refactor-vitest-final-contract-20261005.json) |
| Playwright Chromium | **4 条通过，30.6 秒** | [输出](playwright-final-contract-20261005.txt) |
| 桌面视觉与操作 | **25 截图、17 检查通过、0 pageErrors**，1280／1440／1920 宽度，主题截图为稳定状态 | [报告](ui-20261005/final-feedback-state/report.json)、[逐页分析](UI_VISUAL_REVIEW_20261005.md) |
| 本轮额度恢复 UI | **3幅新截图逐张查看、18检查通过、0 pageErrors／Provider调用**；源树保持、临时服务已退出 | [报告](ui-20261005/quota-recovery-final/report.json)、[说明](QUOTA_RECOVERY_UX_20261005.md) |
| 最新真实暂停 UI | **6幅截图逐张查看、47检查通过**；错误与继续按钮同时可见，原副本源树保持，零Provider调用和页面错误 | [便笺](ui-20261005/actual-paused-notes-12-final-contract/report.json)、[材料](ui-20261005/actual-paused-materials-12-final-contract/report.json) |
| 启动与停止 | **9项通过**；真实编译服务及网页可访问，冲突不终止无关服务，项目字节不变 | [报告](launcher-closeout-20261005.json) |
| `git -c core.safecrlf=false diff --check` | 最新结果见本轮原始输出，未提交、合并或发布 | [记录](diff-check-final-contract-20261005.txt) |

机器汇总：[refactor-summary.json](refactor-summary.json)。旧测试结果保留为历史；当前164／982包含上述功能、草案证据引用前置检查和失效草案显示回归。Playwright使用编译后的正式服务、FixturePlanningProvider和临时项目；本轮暂停UI使用真实项目副本但Provider0，均不能证明最终AI内容质量。

长上下文输入冻结、分页和必读门控由 [独立审查](LONG_CONTEXT_TRANSPORT_INDEPENDENT_REVIEW_20261005.md) 复核。真实 stress 总冻结输入约923180 B，必读22912 B，全部必读范围在20个工具响应中完整可见并精确覆盖；历史约900082 B不是当前必读，因此不声称模型读取全文或完整项目评审通过。Runtime A–E 与收据 origin 降格修复见 [交付](PLANNING_A_E_REPAIR_DELIVERY_20261005.md) 和 [独立审查](RUNTIME_A_E_INDEPENDENT_REVIEW_20261005.md)。7个漏洞反例先失败后通过，8种来源篡改及3条旧兼容通过，扩展322／322；最新完整964项在这些修改及最后UI改进之后通过。完整44项候选职责未放宽，不允许局部漏块绕过验收。

历史／诊断使用共享 `PlanningService.projectSnapshot` 与纯 loaded-record 迁移，保留历史 raw snapshot/state；旧 area 别名、关联问题补键、legacy 部分反馈与 9 个事件边界的独立复核 **133/133** 通过。材料 basis 明确为已提交 inputRefs、integrity unchecked，不把只读轻量诊断冒充材料重哈希或 Provider 探测。详见 [工具交付](TOOLS_API_INTEGRATION_BACKEND_DELIVERY.md)、[独立复核](TOOLS_API_INTEGRATION_BACKEND_INDEPENDENT_REVIEW_20261005.md)。

正式界面收敛为工作台／材料／历史／诊断，旧更多工具中重复文档发布与错误状态写入口退役。桌面增加独立滚动、审批工具栏、目录、筛选搜索、专注阅读、交付锚点与恢复提示；会话草稿不承诺页面关闭后保存。仅参考 GSM 密度与层级，没有复刻；不新增移动端适配。

149文件/774项是本表之前的历史基线；新的797项包含角色消费、旧汇集算法版本、普通修订范围、连续局部修订和上下文投影回归。[范围证据](planning-ordinary-revision.md)、[投影证据](planning-blueprint-context.md)、[独立复核](planning-blueprint-context-review.md)保留失败→通过过程和边界。首次投影构建的两个TypeScript错误记录仍在，不用定向测试冒充构建通过。上述最新构建和完整回归之后，才启动真实便签06恢复及材料质量01。

浏览器覆盖想法、键盘选择、无预选/完整取舍、澄清门控、三阶段审批、任务字段编辑、文档预览/ZIP、局部反馈、委托不误确认、取消后重新运行、损坏 PDF 明示失败、Markdown 与安全链接、剪贴板失败提示。截图：[选择题](workbench-questions.png)、[草案](workbench-draft.png)。

## 已实现能力及确定性回归

| 部分 | 行为和验收依据 |
|---|---|
| 输入与提问 | 原文保存、最多三题/独立键/完整取舍、无预选、结构化答案确认；委托/暂缓/自定义不误确认；完整所选取舍传给后续工作者，历史无键为 unknown |
| 正式状态 | 三阶段蓝图、主题/证据/变更包、部分审批、依赖/Locked/版本/幂等、替代历史；新文件纳入两阶段提交和恢复 |
| 运行 | 多任务及四并发、隔离评审/修订、成功收据与 hash、局部重试/恢复、取消/依据失效、SSE 重放和三次无进展；无费用/总调用/总修订门禁 |
| 材料与工具 | 完整材料索引/范围、受控原图、官方来源/日期/raw hash、SDK v2 stdio、服务生成 Docker 参数/只读独立挂载/隔离网络 |
| 界面 | 对话+当前方案双栏、草案/正式区分、当前问题优先、分组编辑/解锁/审批、真实任务状态及耗时、开发包预览和 ZIP |
| 开发包 | 九份不同 Markdown + tasks.json；完整 staging/hash/版本发布；过期和外改拒绝；v2 执行依赖投影、稳定拓扑及首任务一致；历史 v1 原字节读取 |
| 旧格式迁移 | 合成旧格式源的副本：GET 不写文件、明确关联补键/未关联诊断、旧 readiness 不批准蓝图、待批准清理、Locked 解锁、下一正常提交才持久化、旧 revision 和历史文档保留 |

迁移三条文件回归及失败修复证据：[新回归](legacy-migration-tests.txt)、[修复前](legacy-migration-before-fix.txt)、[合成旧格式 fixture](../../tests/fixtures/legacy-planning.mjs)。另有 [正式 HTTP 副本验收](legacy-migration-http/run-2026-10-04T17-28-27-081Z/REPORT.md)：41/41 项检查、11 次正式 HTTP 请求、Provider 0；源和未操作副本哈希一致，拒绝操作不写盘，正常提交与显式解锁审批、重启后的两阶段回退通过，两台临时服务均已停止。只对操作副本注入恢复故障。这是旧格式兼容验收，不冒称检查过用户真实旧项目内容。

答案关联修复先证明旧实现 9 项回归失败，修复后 Core/Runtime/context 53 项定向通过，并在服务重启/resume 的实际 Fixture 请求检查完整取舍；本表全量与浏览器结果在该修复之后取得。任务 v2 测试包含非任务依赖链、隐藏坏图、拓扑/首项/文档一致、v1 历史读取；投影不补造 AI 未登记的语义前置。

最终审查后的修复也已纳入最新全量构建/761项测试/4条浏览器结果：阶段前置校验拒绝路径不保存 feedback、不撤下问题，同请求重试保持原错误；共享前置图不再指数展开，两个验证入口的确定性工作量回归修复前2失败、修复后通过；原60块/85边合法图单次测量从2646.2ms到0.1ms，记录于[修复前](dependency-graph-before-fix/measurement.json)及[修复后](dependency-graph-before-fix/measurement-rerun.json)，不承诺稳定耗时；旧记录清理部分审批复用原包，同ID/同原文明确选择保留后不因无关输入反复确认。新增两条迁移回归先失败再通过。

容量职责回归覆盖初次设计及旧保存范围，包括正式已有 ID 的候选修改/删除、失责 SUCCESS 及派生草案失效、原结果/收据归档和归档清理中断后的局部恢复。合法兄弟片与拆分结果保留，不能以旧正式内容抵消本轮职责。取消固定时序回归先失败再通过，调用准备期间取消后 Provider 不再启动，运行与槽全部清理：[取消记录](runtime-cancel-preparation.md)。部分审批在待处理组完成前阻断开发包，保存累计审阅来源：[审批记录](2026-10-05-feedback-partial-approval-regression.md)。这些边界均已进入本表全量结果。

最新[正式 HTTP 迁移复验](legacy-migration-http/cleanup-dedup-2026-10-04T17-48-node24/REPORT.md)通过49项、Provider0、服务全部停止，保留此前41项证据；新增检查验证部分审批后剩余分组/目标唯一、连续GET复用同包及所有项目文件原字节不变。

本产品继续使用文件存储，无新增数据库、登录、团队或云同步。`frontend/` 原型隔离；这些限制不强加到目标用户项目。

## 真实能力和全流程证据

[AGY 能力报告](AGY_CAPABILITIES_2026-10-04.md) 保留每轮成功、失败和未执行；[真实控制说明](agy-2026-10-04/real-integration/README.md) 说明 lineage、收据和 public resume。

| 真实检查 | 当前结果及限制 |
|---|---|
| 模型/协议 | 本机实际目录确认 Flash/high；CLI终态 structured_output 校验、流日志与实际调用记录；不从自然文本恢复 ERROR |
| 原图/中文路径 | 原图随机文字 Q7M4-8261、左蓝矩形、右橙红圆和精确 hash；native viewer 记录；中文目录真实调用。材料修订全流程仍待完成 |
| 官方读取 | 真实分页覆盖、来源/日期/raw hash/候选证据校验；失败控制保留。候选摘要 hash 不能冒充网页原始字节 hash |
| 隔离试验 | 早前 Node/Python/Chromium 真实执行与 live inspect 通过；退出7、缺镜像和当前 Docker 不可用仍为失败/未执行。Linux 环境不证明其他平台 |
| 便签三阶段与关键变更 | `flash-vague-resume-20261005-06` 完成初始与七天回收修订包；本段18调用/4次API自动批准/56结构检查，ZIP165项，正式HTTP/UI20项；独立语义复核有缺陷 |
| v2 确定性编译与 UI | 上述冻结蓝图经 public HTTP 编译/浏览器下载，88检查通过、10任务保留、Provider0、原manifest未改；首任务 task-foundation-and-storage。不表示质量修订完成 |
| 全局并发 | 当前冻结组 `flash-m8-recovered-20261005-02` 峰值4、377项检查通过，含两条-06停稳控制；所有控制零活跃调用/租约。报告为该组 `global-provider-slots/flash-m8-recovered-20261005-02/shared-provider-verification.json`；旧组保持历史证据 |

上述阶段批准都是脚本化 API 自动验收，不能替代真人审阅。不同 resume 控制分别记录新调用与继承收据，总数不能混为某次 Run 调用数。

## 正在完成的质量修订

当前没有活动真实调用。最新便笺 `flash-vague-draft-final-20261005-06` 两次新调用失败；材料 `flash-materials-final-20261005-06` 四次新调用中research成功一次，design未完成。两者0新批准／0新质量包，130／72份成功收据保持，全部调用和租约释放。材料公共接口已补回，但阶段复核及跨块顺序仍待完成；便笺缺口及预审发现见本报告开头。仍须取得completed manifest、独立内容通过、新包/HTTP/浏览器一致性，之后真人审阅。以下更早额度、控制和中间内容结果仅为历史。

01:10 UTC 的 Opus 短探測曾成功，但随后两条完整控制因额度阻塞：材料 2 调用、便笺 4 调用，均 0 新批准／0 新包、源和继承 Run 不变、零活跃调用／零租约；42 项共享槽检查通过。01:37 UTC 的 Gemini 3.1 探测失败保留，01:56 UTC 新探测成功单独记录，不改写旧失败。服务预计恢复时间只是当时估计。

- 配额暂停是历史结果：`flash-vague-quality-20261005-01` 保存45份成功收据，`flash-materials-chinese-resume-20261005-02` 保存20份。之后实际恢复时，设计和验证又遇到单次输出上限；ERROR 中的非空结构输出继续拒绝，未用于批准新方案。
- 首轮容量新控制暴露正式已有块的职责遗漏风险后，`flash-vague-quality-resume-20261005-03` 和 `flash-materials-chinese-resume-20261005-04` 通过公开 cancel/shutdown 正常冻结。成功收据累计47和23，均0审批/0活跃调用/0租约；精确输入、角色 Schema、启动构建及哈希保存，成功拆分任务保留。
- 最后统一自动检查通过后，`flash-vague-quality-resume-20261005-04` 和 `flash-materials-chinese-resume-20261005-05` 在新构建继续，显式使用 Flash High/high 和共享四槽，从前述冻结源恢复。便签继续自动质量反馈；材料先完成300ms需求修订，再执行冻结的自动质量反馈。
- 原质量反馈与冻结产物不改。最终检查便签的平台/归档删除/并发/原子导入/索引/离线/性能/任务依赖，以及材料的300ms自动展示/清空取消/IME/启动/安全/可执行验证方法。当前仍没有最终独立质量通过结论。
- [恢复计划](agy-2026-10-04/real-integration/quota-recovery-plan.json) 保留历史服务预计恢复时间及后续实际调用，时间估计不当作可用性证明。

最终质量包必须有独立跨契约内容复核，再检查冻结包的ZIP、版本/hash、正式HTTP和真实浏览器读取。`blockers=[]`、覆盖检查、API接受和ZIP完整性均不能独自证明内容可开发。

默认 Opus 的早期额度/复杂 Schema 失败保留为历史，未使用Flash结果宣称Opus复验通过。当前Docker未就绪，不擅自重启、不把未执行试验写成通过。

## 真人审阅与实践边界

真实自动流程及独立质量复核完成后，用户仍需检查选项是否易懂、是否重复/多余提问、AI是否承担普通细节、全功能流程/接口/任务/验收是否完整、未验证事项与批准范围是否明确，以及开发入口是否可理解。开发实现、自动回归、真实自动验收、真人审阅分别记录。

本轮不要求外部Coding Agent实际完成目标项目，其落地效果保留为后续实践验证；不声称已经证明用户全部痛点解决。

