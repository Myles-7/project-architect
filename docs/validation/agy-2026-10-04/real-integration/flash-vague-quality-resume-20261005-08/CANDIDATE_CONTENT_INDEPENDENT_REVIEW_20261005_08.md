# 便签08最新候选内容独立复核

结论：**不通过，保持 pending；不得将 Provider 评审完成或 blockers=[] 当作十项内容通过。** 本报告只审阅最新候选 task-967cae70-a111-4612-bb6e-a712a3387d92 与仍未被它修改的正式蓝图，不评估旧材料01包，不把已有 initial/revised-development-package 当作本候选的最终批准包。

本次仅新增本报告。未修改模型结果、Project State、冻结证据、源码或 UI；未调用 Provider，未运行应用或浏览器实测，未截图。

**审阅对象与真实控制状态**

- 控制目录：`docs/validation/agy-2026-10-04/real-integration/flash-vague-quality-resume-20261005-08`。
- Run：`run-3a9bf179-44bd-4b09-8bb8-f20e644ac10d`。
- 最新完整候选：`task-967cae70-a111-4612-bb6e-a712a3387d92/result.json`，43 块更新及 1 块显式删除。
- 候选 SHA256：`1F0A6AB3B250A335705BD9FEAAB0D5FB5EA8F89E6FA64376FC5809C2E8F641E8`。冻结证据目录与临时项目对应文件的 SHA256 相同。
- 正式蓝图文件 SHA256：`B6920EE6D4B932B0DEEFC545726805291371F7F1B44C92D900A335CB48CC6E37`，仍有原 44 块。
- Run 的 basis：revision 25，hash `3cd9327f3c8484b331047998723167cb3a47cb375ccbbe465d4e44978fceb6cd`。
- Run.status 为 `reviewable`；真实 Provider review task `task-66242ec0-7d77-4c61-b02d-ad90ce9cb7f5` 已 completed，其结果声称合格、blockers=[]。
- ChangeSet：`change-3a9bf179-44bd-4b09-8bb8-f20e644ac10d-delivery-7`，9 个组全部 pending。manifest.approvals 为 []。
- 控制 manifest.status 为 failed，错误为 `quality-feedback-has-unaffected-blocks`，activeCallsAtShutdown=0。本候选尚未被 API 接受，最终包验收未完成。
- 本候选新增 evidence 为 5 条 official-source、1 条 material、4 条 user，没有浏览器实验结果。官方研究 passed 不能替代应用实测 passed；本报告没有将这些证据标成实测。

下文来源代号：

- C：[最新候选](</D:/桌面/项目构思/docs/validation/agy-2026-10-04/real-integration/flash-vague-quality-resume-20261005-08/project-records/runtime/planning/run-3a9bf179-44bd-4b09-8bb8-f20e644ac10d/tasks/task-967cae70-a111-4612-bb6e-a712a3387d92/result.json>)。用稳定 block ID 与字段定位；附行号为该 ID 行。
- B：[未修改的正式蓝图](</D:/桌面/项目构思/docs/validation/agy-2026-10-04/real-integration/flash-vague-quality-resume-20261005-08/project-records/state/blueprint.json>)。
- F：[原十点质量反馈](</D:/桌面/项目构思/docs/validation/agy-2026-10-04/real-integration/quality-feedback-vague.txt>)。
- R：[真实 Provider 评审结果](</D:/桌面/项目构思/docs/validation/agy-2026-10-04/real-integration/flash-vague-quality-resume-20261005-08/project-records/runtime/planning/run-3a9bf179-44bd-4b09-8bb8-f20e644ac10d/tasks/task-66242ec0-7d77-4c61-b02d-ad90ce9cb7f5/result.json>)，SHA256 `32E27BCBFDF4EA41ACF9A5683D9ECD23753AF2D183BCEE04B63278A483C43B56`。
- M：[冻结控制 manifest](</D:/桌面/项目构思/docs/validation/agy-2026-10-04/real-integration/flash-vague-quality-resume-20261005-08/manifest.json>)。

**关于“必须至少留一块未触及”的控制断言**

图结构检查发现，原正式蓝图从 `block-target-user-scenarios` 沿反向 dependsOn 取得的依赖闭包为全部 44 块，没有图上独立于目标块的块。反馈第1点明确要求修改目标与平台边界，第4、5、6、7、8、9、10点又跨产品、技术、接口、任务与验收。因此，“必须存在至少 1 个未 touched 原块”不是所有这类反馈都能成立的判据，触及全部块不能单独证明越界。

但本候选的 **43 个 content 均与原 content 不同**，也不能用宽闭包为整块全文改写免责。以下原痛点、排除项、具体验收和安全上下文的损失是实际内容回归。应分别记录控制断言的适用性与候选内容缺陷；不建议仅放宽断言就宣布通过。更合适的控制是核对明确无关内容及受影响块内部的原句/字段，而非要求一个任意固定数量的未触及块。

**十点逐项结果**

| 反馈项 | 结果 | 已修正内容 | 未闭合内容 |
| --- | --- | --- | --- |
| 1 目标与平台 | 部分通过 | 面向用户本人；N 与 Ctrl/Cmd+Enter 限页面焦点；移除系统全局热键 | B1 无关痛点改写并新增“回车保存”；B7 安全上下文要求被削弱 |
| 2 归档与触控标签 | 主要通过 | 归档常驻取消归档；触控多选开关；AND 过滤 | B1 原轻量标签范围/验证被删减；B2 标签批量更新未定义 revision 变化 |
| 3 七天回收 | 部分通过 | 删除立即持久化；previousStatus；七天提示与用户确认物理清理；无旧5秒删除逻辑 | B2 并发重复 trash 与编辑/删除竞争；B8 缺刷新、重开与到期跨越的具体验收 |
| 4 编辑并发 | 部分通过 | 保存退出/放弃/继续；失败拦截；revision 与 schemaVersion 分开；三项消解入口 | B2 原子 CAS、强制覆盖边界、缺失记录与其他状态修改；B3 导入后旧会话 |
| 5 备份往返 | 部分通过 | 顶层 schemaVersion:1 统一；notes/meta 同事务示例；明确失败回滚 | B3 元数据往返与 import revision；B4 可执行完整校验、取消、合并规则与草稿导出 |
| 6 IndexedDB 键 | 契约通过 | 删除 boolean 索引；查询后内存过滤；模型/接口/任务/验收未见相反 boolean 索引 | 此处通过为文档契约，不是运行验证 |
| 7 部署离线 | 部分通过 | HTTP/HTTPS 与本地静态服务；禁止 file://；SW 冷重启作为未来项 | B7 一般HTTP与安全上下文混用；已打开页面/仅缓存页面混用及100%离线表述 |
| 8 性能口径 | 不通过 | 检索统一 P95 <=150ms、含80ms；1000条样本与超标失败路径；目标待验证 | B6 冷启动起点改变，P95方法/DOM终点未定义，证据无法唯一复制 |
| 9 浏览器草稿 | 不通过 | Safari17+及独立验证任务明确 unexecuted；草稿改会话暂存；长期实体仍IndexedDB | B5 sessionStorage失效、恢复与隔离缺失；B4未保存草稿并未进入备份导出 |
| 10 任务次序 | 候选图通过，导出待验证 | 8实现/打包task+1validation；build依赖全部业务实现；benchmark在build后；删除重复旧validation | 未批准新START_HERE/tasks.json/开发计划，不能宣称最终导出一致；B1原验证覆盖损失仍阻断 |

**具体阻断 B1：过度改写造成无关需求与验收范围损失**

1. `block-problem-fragmented-ideas`（C:151）原文有4个独立痛点。原第2项是“无序堆积导致灵感沉没与查找困难”，其现状包括“缺乏标签分类、模糊检索与状态标记”，影响包括“记录之后极难回顾，灵感无法形成有效线索”。候选改为3项，整个无序堆积/回顾困难痛点消失，新增浏览器存储清理风险并改写全部表达。十点反馈没有要求删除该痛点。候选还写“行内标签与回车保存”，与其他块统一的 Ctrl/Cmd+Enter 提交不一致。应恢复原痛点精确内容，仅修改确需变动的句子。
2. `block-non-goals-exclusions`（C:180）删除原“**不做复杂树形文件夹体系与无限嵌套目录**”与“**不做重量级富文本 WYSIWYG 排版编辑器**”的明确排除；新“非复杂富媒体图文工作站”不能完整替代两者。虽然 `task-tag-organization.task.exclusions` 仍写“不设计树状层级目录与无限嵌套标签”，但产品级排除应保留，避免不同文件边界强弱不一。
3. `data-model-core-entities`（C:300）保留了“AppMeta”章节名，却删除原 `AppMeta { key, value, updatedAt }` 类型与 `BackupTrackerMeta.isPrivateModeDetected`；`interface-service-contracts`（C:319）删除 `requestPersistence()`、`isPersisted()`、`detectPrivateMode()`、`checkBackupReminderNeeded()`。这些删除并非为加入 revision/schemaVersion 所必需。若需要撤除原能力，应登记明确移除及影响，不能悄然丢失旧契约。
4. `acceptance-note-detail-edit`（C:1086）删除原“Markdown 格式化排版与代码一键复制”验收场景；功能块仍承诺代码高亮/复制。加入关闭与并发场景应保留原可复制验收。
5. `acceptance-storage-and-search-benchmark`（C:1423）删除原50条超期便签批量清理场景（原200ms目标、未超期便签完整保留）；修改检索性能边界并不自动授权删除另一项验收。若该指标需重新评估，作为待批准调整明确说明。
6. `feature-tag-organization`（C:726）删除原标签按关联数量降序、全在回收区时自动隐藏的具体规则与成功重命名覆盖所有便签的具体验收；scope 原“未使用标签清理”也不再列出。需判断每项保留/修订，避免以整块摘要替代局部修复。

**具体阻断 B2：revision 出现了，但并发契约仍无法排除丢失更新**

来源：`data-model-core-entities`（C:300）、`interface-service-contracts`（C:319）、`error-architecture-and-recovery`（C:337）、`feature-note-detail-edit` 与 `acceptance-foundation-and-storage`。

- 接口原文：`saveNote(note: Note, expectedRevision?: number): Promise<SaveNoteResult>`。现有记录更新时 expectedRevision 仍可省略，创建、普通更新、显式强制覆盖没有不同契约。
- 已写对比 `dbNote.revision !== expectedRevision`，但没有要求“读取当前记录→比较→写入新revision”在同一读写事务中完成。仅先读再写的合法解释允许两标签页都读到revision1、都通过比较、随后相互覆盖。现有验收只测试“数据库已经revision2时传1”，不能覆盖同时保存竞争。这是契约缺口推演，未声称实际实现已发生。
- 数据模型只明确移入回收区、还原、取消归档、正文编辑的revision增长；置顶、收藏、归档与批量标签重命名没有统一修订号要求。正文编辑持有旧整条Note时，其他标签页的状态/标签修改能否被检测仍不明确。
- `trashNote(id)` 只写“记录previousStatus与trashedAt”，未规定必须从最新持久化状态读取且拒绝/幂等处理已经trashed的记录。旧标签页再次删除可能覆盖previousStatus；已物理删除记录的旧编辑保存也缺not-found/禁止复活规则。
- “强制覆盖”仅声明用当前草稿覆盖并令revision=dbNote.revision+1，未明确该选择针对哪一个当前版本、再次竞争时是否重新提示。
- 必须补两标签页同时提交、编辑与归档/删除/标签重命名竞争、重复删除与已删除记录保存用例，再承认冲突策略闭合。

**具体阻断 B3：备份覆盖会破坏修订号假设，元数据往返承诺也无输入载体**

来源：`data-model-core-entities`（C:300）、`tech-storage-and-search`、`feature-data-portability`（C:1118）、`acceptance-data-portability`。

- 模型将revision定义为“单条便签单调递增修改修订号”；备份又导出完整Note（包含revision），覆盖导入直接clear/bulkAdd(notes)。未规定导入revision处理或让所有已打开编辑会话失效。
- 可观察风险推演：标签页A持有id=X、revision1的旧草稿；标签页B把X改至revision2；全覆盖导入旧备份使X回到revision1；A的expectedRevision1又匹配而能覆盖导入后的内容。该路径需要会话/库代际失效、强制重新加载等具体规则，不能用单条revision字段本身证明安全。
- `BackupPayload` 只有app、schemaVersion、exportedAt、notesCount、notes，没有AppMeta或BackupTracker；验收却写自导入“元数据完整”，事务示例 `db.meta.put(tracker)` 的tracker来源/值也未定义。需明确元数据是备份往返恢复、保持现值，还是明确重置，并同步Payload与验收。
- 原子导入示例是正向修复；不能将“原子成功/失败”扩大为跨标签页版本/会话自动正确。

**具体阻断 B4：统一版本键后，备份与失败恢复仍缺可执行边界**

来源：`interface-service-contracts`（C:319）、`feature-data-portability`（C:1118）、`flow-data-portability`（C:1135）、`task-data-portability`（C:1154）。

- 版本键已统一，这一项已修正。但“严密Schema校验”只给TypeScript Payload/Note类型与app/schemaVersion检查，没有可复制JSON Schema或等价完整校验表。notesCount与数组长度、重复主键、status/previousStatus/trashedAt一致性、时间戳/revision边界与无previousStatus的trashed记录策略均未明确。
- 保存失败提供【立即导出备份】，而exportJsonBackup只读取已入库便签，未保存的快速捕获/详情草稿不在Note集合。候选没有独立草稿导出契约，val却写可通过“备份导出恢复”草稿。应分别提供复制/下载草稿和已有数据库备份，不让数据库导出按钮暗示已保存失败草稿。
- “合并导入”保留在接口与功能中，流程只实现覆盖；相同ID、不同revision/状态的合并规则没有规定。取消文件选择/覆盖确认、提交前取消、中途事务取消、导入配额失败后的保留与重试入口也未有完整用例。
- 导出步骤在Blob触发下载后立即 `unbackedChangesCount=0`；未说明下载触发与用户最终保存的证据边界。若导出期间有新增修改，整计数清零可隐藏未包含在快照中的变化。需采用快照变更边界与明确“已发起导出”语义，或对变更期间的提醒保持准确。

**具体阻断 B5：sessionStorage 不是无条件成功的草稿恢复机制**

来源：`error-architecture-and-recovery`（C:337）、`block-outcomes-lightweight-experience`（C:166）、quick-capture/detail相关块与 `val-storage-and-search-benchmark`（C:1350）。

- 实际契约只有 `sessionStorage.setItem('spark_draft_active', draftText)`。没有getItem恢复流程、成功保存/主动放弃后的清理、条目noteId与expectedRevision、快速捕获和详情草稿隔离。一个标签页里的多个失败草稿会共用一个key；标签tags也没有草稿数据结构。
- 没有处理sessionStorage拒绝访问或setItem再次失败。应明确会话暂存为best-effort，失败时仍保留组件内存与可选择的纯文本复制/下载，展示会话暂存失败信息，不能让恢复分支再次异常阻断原草稿。
- 应明确刷新可尝试恢复；关闭标签页/窗口后会话结束，不能把它宣传为长期备份。候选虽写“不作零丢稿”，但功能/验收仍无暂存失败与关闭页面的可用性边界。
- 建议具体验收：同时准备新建草稿与Note X编辑草稿→分别模拟IndexedDB失败；再分别模拟sessionStorage成功、拒绝访问、容量不足；验证文本域保留、提示、恢复选择及成功后清理。不需假定草稿一定能写入第二种存储。

官方只读查证：MDN `Window.sessionStorage` 说明页面会话可跨刷新，但关闭标签页/窗口结束该会话，策略拒绝持久化时可抛SecurityError；MDN `Storage.setItem` 明确写入可抛QuotaExceededError。来源URL列于报告末。此查证不是应用运行测试。

**具体阻断 B6：性能数字已统一，测量却不能唯一复现**

来源：`block-outcomes-lightweight-experience`（C:166）、`val-storage-and-search-benchmark.task`（C:1350）、`acceptance-storage-and-search-benchmark`（C:1423）。

- 原正式冷启动验收：用户导航访问→“骨架屏在1.0秒内消失，首屏可响应输入”。候选变为“**骨架屏消失至快速捕获输入框处于可交互状态（TTI）时间<=1.0s**”。新起点排除了导航、资源加载、初始化与骨架屏停留；即使页面加载很久，此区间仍可很短。需恢复从导航/明确启动打点至输入可交互的口径，不能把骨架消失作为冷启动起点。
- 检索已统一含80ms防抖的P95<=150ms；但“击键结束”“DOM重排完成”缺实际打点API、结果提交/渲染边界与任务关联。连续10次样本的P95算法（nearest-rank/插值）、关键词与命中规模、预热与后台状态也未给出。不同实现可计算出不同P95或把渲染完成前时点当终点。
- benchmark.environment只写Intel i5/Apple M1级别或以上及浏览器大版本；记录报告应保存实际CPU/内存/OS/浏览器精确版本/缓存与窗口状态。Safari/WebKit不能只有Chrome DevTools的冷启动步骤。
- evidenceRequired只要求Performance截图/日志，没有提供可复制采集程序与数据列。应先固定测量程序、区间、统计方法和降级结果，再用真实执行记录判断数字目标；目前所有数字保持待验证。

**具体阻断 B7：安全上下文要求丢失，离线范围仍被绝对化**

来源：`tech-core-architecture`（C:245）、`deployment-and-build-specification`（C:1249）、`block-non-goals-exclusions`（C:180）、`task-foundation-and-storage.task.assumptions`、相关页面/成效块。

- 原部署块明确“生产HTTPS或本地localhost”以保障StorageManager与Clipboard；候选仅要求“标准HTTP/HTTPS”，同时foundation仍假设HTTPS或localhost、architecture仍调用persist/persisted、失败恢复承诺剪贴板复制。一般HTTP与安全上下文条件未统一。应保留HTTPS/localhost要求，非安全上下文或权限失败提供可选中文本手动复制及不可申请持久化的诚实降级。
- 经典本地HTTP预览、禁止file://与SW未来项已修正。但non-goals与deployment混用“已打开/缓存的页面”，没有说明只命中HTTP缓存是否足够重新离线打开及资源完整性；另处又将离线冷打开限定本地服务。应统一已完整加载且必要代码资源已取得的页面运行边界。
- 多块仍写“100%离线运行/可用”“零网络报错”；首版Markdown中外链、原允许外链图片等资源边界、懒加载资源是否全已取得没有明确。不要把本地数据核心功能的离线目标扩大为整个页面/所有资源的绝对保证。原图像外链支持若打算删掉，应登记范围变更。
- 官方只读查证MDN Clipboard.writeText：该API要求安全上下文，且可能因权限抛NotAllowedError。来源URL列于报告末；没有执行浏览器权限试验。

**具体阻断 B8：七天生命周期缺刷新/重开与并发相关验收**

删除立即持久化、previousStatus还原、常驻过期横幅与二次确认清理均已修正。仍需按F第3点补足可观察规则：

- 已删除后刷新/关闭再打开，记录仍在回收区且previousStatus正确；
- 页面保持打开跨过7天边界，何时重算过期数量、显示横幅；没有用任何明确事件/调度边界定义；
- exactly七天边界采用现有 `> 7*86400*1000` 与“七天内可还原”文案如何对应；
- 超期但尚未确认清理的便签能否仍还原，当前“一键精准还原”未限期，而“七天内可还原”的承诺未说明超期但未清理状态；
- 清理取消、事务失败重试、同一便签跨标签页再次删除/还原的可执行用例。

这些是待批准的生命周期细节与测试缺口，不能由Provider summary“7天生命周期完整”代替。

**可保留的正确修订**

- 个人使用目标、焦点内快捷键、常驻标签/书签已统一，未见活动系统全局热键契约。
- 归档常驻恢复入口与触控多选开关均贯穿功能、流程、页面、任务、验收。
- previousStatus、立即持久化删除与用户二次确认超期清理取代旧5秒删除混用。
- schemaVersion:1 顶层版本键统一；读写事务notes/meta整体成功或回滚的方向正确。
- IndexedDB Schema不再建立isPinned/isFavorite boolean索引，查询后内存过滤的选型一致。
- 浏览器file://与未来SW边界明显改善；Safari17+/WebKit验证任务在Windows环境明确标unexecuted。
- 候选任务图为8个实现/打包task和1个validation，无重复ID、无悬空dependsOn。
- task-build-and-deploy依赖foundation/capture/view/tag/search/detail/backup全部实现任务。
- val-storage-and-search-benchmark依赖build与真实view/search/backup；正确删除的是 **val-browser-storage-and-search-perf**，不是保留的val-storage-and-search-benchmark。
- 本候选尚未导出，START_HERE/tasks.json/开发计划最终一致性留到正式接受与打包后核验。

**本报告引用的官方边界资料**

此处只是复核用的公开文档，没有写入规划Evidence或改变不可变证据契约。

- MDN Window.sessionStorage：`https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage`；会话生命周期、刷新与关闭边界、SecurityError。
- MDN Storage.setItem：`https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem`；QuotaExceededError。
- MDN Clipboard.writeText：`https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText`；安全上下文与NotAllowedError。
- Dexie.transaction：`https://dexie.org/docs/Dexie/Dexie.transaction()`；事务作用域与自动提交边界。B2的竞争路径是基于候选缺少原子比较写入约束的逻辑推演，不冒充实际执行失败。

复核只完成文档内容与结构检查。Provider独立review已真实成功，但本报告保留上述实质阻断；API批准、最终打包和真实浏览器验证均尚未完成。

