# 真实集成验证-flash-vague-20261004-03 — 全阶段开发任务

版本：17；批准蓝图：4d7dcf295e11c188d49f91f29fcf74571f2f7b64784572d0b63310b67003d4cd

## 宿主浏览器端持久化容量与全文检索性能实测验证任务

ID：val-browser-storage-and-search-perf；关联需求：block-outcomes-lightweight-experience、feature-search-filter、feature-data-portability；依赖：tech-storage-and-search、interface-service-contracts

由于规划阶段宿主 Docker 容器环境不可用（引用 evidence-exp-docker-env-prep），性能指标（如 1,000 条便签基准下检索端到端延迟 < 150ms、首屏冷启动 TTI < 1.0s、StorageManager.persist() 权限表现）不能宣称已实测通过。本验证任务正式明确未验证能力、实测环境、度量方式、数据规模及失败处理，移交交付阶段在真实浏览器中闭环验证。

目标：在真实宿主浏览器中实测验证 IndexedDB (Dexie.js) 本地持久化稳定性、StorageManager.persist() 持久化申请行为、1,000 条便签基准下的全文模糊检索端到端延迟（含 80ms 防抖）及存储配额满载告警与状态保留机制。

范围：覆盖 Chrome、Edge、Firefox 真实浏览器；利用测试脚本自动批量注入 1,000 条便签样本集（涵盖单行、多行、代码块、丰富标签）；执行全文检索、动态高亮、JSON/Markdown 导出与导入合并全链路性能及稳定性检验；验证持久化申请与防丢提醒阈值逻辑。

排除：排除服务端性能测试（无后端架构），排除网络往返延迟（纯本地离线持久化）

模块：StorageService、SearchEngine、BackupManager、WorkspaceUI

正常行为：批量注入 1,000 条便签耗时 < 800ms；键入检索词后，包含 80ms 防抖整体端到端 UI 渲染完成延迟稳定在 150ms 以内；全量导出 1,000 条便签生成的 JSON/Markdown 文件校验无损耗；首屏冷启动 TTI < 1.0s；StorageManager.persist() 在支持环境成功返回 true。

异常行为：若实测检索响应时间超过 250ms，触发长列表虚拟滚动（Virtual Scroll）优化与前缀索引重构；若配额异常未捕获，加固存储事务失败监听并降级使用 LocalStorage 草稿应急保护；若持久化权限被拒，降级为温和防丢提醒加强模式

验证：
- 使用 Chrome DevTools Performance 面板测量键盘事件至重新排版完成的真实时间戳
- 调用 StorageManager.estimate() 与 StorageManager.persist() 校验配额估算与持久化授权拦截流程
- 通过测试脚本核对导入导出便签集合的双向深度相等（Deep Equal）

完成条件：
- 在 1,000 条便签基准下，10 次搜索的平均响应时间小于 150ms（含 80ms 防抖）
- 页面冷启动至首屏卡片交互时间 TTI 实测小于 1.0 秒
- 模拟存储配额满载时，快速捕获输入框与详情编辑弹窗文本保留率达到 100%
- StorageManager.persist() 授权流及超20条变更/超7天防丢提醒触发判定实测符合预期

假设：测试机器硬件不低于常规个人电脑基准（4核 CPU，8GB 内存）；浏览器运行于标准安全上下文（localhost 或 HTTPS）

环境：主流桌面 PC（Windows 11 / macOS 14 / Ubuntu 22.04），Chrome 120+ / Edge 120+ / Firefox 122+ 真实浏览器环境

步骤：
- 1. 运行构建命令并在真实 Chrome 浏览器中启动本地预览页面
- 2. 在浏览器控制台执行基准数据灌入脚本，批量生成 1,000 条混合格式便签并写入 IndexedDB
- 3. 开启 Performance 性能分析，输入 10 组包含中文、英文、符号及 #标签 的查询词，记录从击键到界面渲染完成的时间差
- 4. 触发全量 JSON 与 Markdown 导出，检验生成文件哈希与便签结构，随后执行增量合并导入比对一致性
- 5. 模拟存储配额满状态，执行便签提交，验证错误横幅展示与输入框内容保留情况
- 6. 检验 StorageManager.persist() 调用与超20条变更温和防丢状态点点亮逻辑

通过标准：
- 10 次复合关键词搜索平均端到端延迟 <= 150ms
- 批量写入 1,000 条数据无丢损，导出并重新导入后条目数与字段校验一致性达 100%
- 配额超限异常注入时，输入框及编辑弹窗内文本 100% 完整保留未丢失
- StorageManager 持久化与防丢提醒触发无未捕获异常

证据：Chrome DevTools Performance 性能面板记录分析文件；控制台自动化基准测试脚本运行耗时日志截图与数据文本；全量 JSON 导出与覆盖导入前后数据 MD5 一致性核对报告

失败后：若性能未达标，将检索算法升级为基于内存倒排索引或 Trie 树索引，并引入分页虚拟滚动；若配额异常处理失败，补齐跨标签页存储状态同步与本地草稿自动暂存机制。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-mdn-storage-persist-api；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

## 工程基座搭建与 Dexie 存储驱动封装实现任务

ID：task-foundation-and-storage；关联需求：tech-core-architecture、data-model-core-entities、interface-service-contracts、error-architecture-and-recovery；依赖：tech-core-architecture、data-model-core-entities、interface-service-contracts

### 基础工程脚手架与 Dexie.js 存储驱动实现规范

1. **工程基座与工具链初始化**：
   - 采用 React 19 + TypeScript 5.x + Vite 初始化纯前端工程，严格启用 TypeScript `strict: true` 配置与 ESLint 规范，杜绝 `any` 类型泛滥。
   - 配置 Tailwind CSS 原子化类名编译，配置 Lucide React 图标按需加载。
   - 依赖集成：安装 `dexie` 与 `dexie-react-hooks`，安装 `marked`、`dompurify` 与 `@types/dompurify`，安装 `prismjs` 与 `@types/prismjs`。

2. **IndexedDB 强类型 Schema 与 Dexie 实例封装**：
   - 创建数据库类 `SparkNotesDB extends Dexie`，声明对象仓库：
     - `notes`: `id, updatedAt, createdAt, status, *tags, isPinned, isFavorite`（其中 `*tags` 声明为多值索引 Multi-entry Index，支撑标签高效单键查询）。
     - `meta`: `key`（主键，存储备份追踪、存储持久化模式与用户偏好）。
   - 实现 `IStorageService` 完整方法集，确保所有更新时间戳 `updatedAt` 均在服务层自动注入，规避时序不一致。

3. **StorageManager API 配额感知与持久化授权**：
   - 实现 `requestPersistence()`：在应用初始化时调用 `navigator.storage.persisted()` 检查当前 Origin 是否获得永久存储许可；若为否，调用 `navigator.storage.persist()` 申请浏览器持久化授权，并将状态落盘至 `meta.storage_status`。
   - 实现 `getStorageQuota()`：调用 `navigator.storage.estimate()`，返回 `{ usage, quota, percentUsed }`，并在用量达 90% 时激活预警标志。

4. **异常防御与数据库事务原子性保证**：
   - 针对多便签批量写入与标签批量更新，统一采用 `db.transaction('rw', db.notes, async () => { ... })` 事务包裹；若中途失败，事务自动回滚，不破坏既有数据。
   - 底层抛出 `QuotaExceededError` 时统一封装为强类型受控错误 `StorageQuotaExceededError`，向上层抛出供界面状态保留。

目标：完成 React 19 + TypeScript 5.x + Vite 工程搭建，实现基于 Dexie.js 的强类型客户端持久化存储服务及 StorageManager 配额与持久化模式探测。

范围：项目脚手架配置、Dexie.js Schema 定义与数据库初始化、IStorageService 接口全部 CRUD 方法实现、配额查询与持久化申请封装、受控异常体系定义。

排除：不包含具体的页面 UI 渲染与样式，不包含外部备份文件解析算法

模块：StorageService、SparkNotesDB

正常行为：应用冷启动时自动建立 IndexedDB 数据库连接；调用 CRUD 接口读写响应毫秒级；配额与持久化状态准确查询并持久化至 meta 仓库。

异常行为：当存储超限时抛出结构化受控异常 StorageQuotaExceededError，不破坏既有数据；当事务中断时自动执行 IndexedDB Rollback，保持数据原子性

验证：
- 使用 fake-indexeddb 执行 StorageService 单元测试，覆盖 CRUD、复合条件筛选及批量标签更新
- 测试配额满载抛错与事务回滚拦截逻辑
- 验证 StorageManager.persisted() 与 persist() 授权调用分支处理

完成条件：
- StorageService 基础 CRUD 及多值索引检索单元测试通过率 100%
- TypeScript 严格编译无报错，无隐式 any
- 浏览器 DevTools 可见 SparkNotesDB 实例与完整索引定义

假设：运行环境为具备标准 IndexedDB 2.0+ 与 StorageManager API 的现代浏览器；应用运行于标准安全上下文（HTTPS 或 localhost）

来源：evidence-vite-official、evidence-indexeddb-spec、evidence-mdn-indexeddb、evidence-storage-estimate、evidence-mdn-storage-persist-api；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 快速捕获组件与标签即时提取开发任务

ID：task-quick-capture；关联需求：feature-quick-capture、flow-quick-capture、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-quick-capture、flow-quick-capture

### 秒级灵感极速捕获组件与交互实现规范

1. **组件设计与自适应交互**：
   - 实现 `QuickCaptureCard` 组件，常驻主工作区最顶部。
   - 输入框初始为单行文本域（高度约 44px），带占位提示“随手记下新灵感... 按 Ctrl+Enter 保存，输入 #添加标签”。
   - 随输入行数自适应增高（最大限制展开至 8 行约 200px），超出后内部平滑滚动。
   - 全局快捷键监听：当视口未处于其他表单输入焦点时，按下 `N` 键平滑滚动至顶部并自动聚焦捕获输入框。

2. **智能行内标签提取算法**：
   - 用户输入文本时支持就地键入 `#标签名`（如“调研 Rolldown 静态编译 #打包 #构建”）。
   - 提交时通过正则 `/(?:^|\\s)#([\\w\\u4e00-\\u9fa5-]+)/g` 动态匹配提取所有标签名，自动去除 `#` 前缀并执行去重处理。
   - 输入框下方动态展示当前提取到的标签预览胶囊，同时展示最近使用的高频标签胶囊，点击即可一键追加。

3. **快捷键提交与状态联动**：
   - 监听键盘组合键 `Ctrl + Enter`（Windows/Linux）或 `Cmd + Enter`（macOS），或点击右下角“记录灵感”按钮触发提交。
   - 空文本拦截：去除首尾空白字符后若长度为 0，阻止提交，触发输入框左右轻微抖动动画（CSS Shake 300ms），焦点保持不变。
   - 成功提交：构造 `Note` 实体（生成 UUID v4、注入当前时间戳、设置 status='active'、isPinned=false、isFavorite=false），调用 `StorageService.saveNote()`；成功后输入框清空并平滑折叠回单行状态，列表首部以淡入下移动效插入新卡片，未备份变更计数器 `unbackedChangesCount` 递增 1。

4. **异常防御与输入保留机制**：
   - 若本地持久化层写入抛出 `StorageQuotaExceededError`（存储配额满）：
     - 输入框内的正在编辑的文本与提取标签完全保留，组件保持展开状态，不予清空。
     - “记录灵感”按钮恢复可点击态，输入卡片顶部浮出醒目琥珀色告警横幅：“本地存储空间已满，灵感未能保存，请清理空间或立即导出备份”。
     - 横幅内提供“一键导出备份”快捷操作，用户处理完毕后可再次点击保存，确保正在键入的内容不丢失。

目标：实现单页应用顶部的随手灵感极速捕获功能，完成输入自适应、快捷提交、智能标签提取及存储写入失败状态保留。

范围：QuickCaptureCard 组件开发、键盘事件监听（N 键与 Ctrl/Cmd+Enter）、正文标签提取算法、空输入校验与轻微抖动、写入 StorageService 及未备份计数器联动。

排除：不包含便签长文的详情模态阅读，不包含卡片拖拽排版

模块：QuickCaptureCard、NoteService、StorageService

正常行为：打开页面或按 N 键自动聚焦输入框；输入多行平滑撑开；按 Ctrl/Cmd+Enter 瞬间提取正文与 #标签，生成实体并持久化，输入框清空复位，列表头部插入新卡片，未备份计数 +1。

异常行为：提交遇配额满或写入异常时，输入框内容与标签完整保留在文本域中，卡片不关闭，弹出错误横幅与立即备份入口，按钮恢复可点击状态供重试

验证：
- 单元测试验证 #标签 正则提取算法准确性（中英文、数字、非法字符过滤）
- 组件测试验证快捷键提交与空内容拦截抖动
- 注入存储失败模拟，验证输入框文本不被清空且错误横幅正确渲染

完成条件：
- 快速捕获交互、快捷键提交与标签提取单元测试通过率 100%
- 输入内容为空时抖动拦截率 100%
- 存储满载注入测试中文本保留在文本域中不被清空，输入域不关闭不重置

假设：用户具备常规键盘与点击输入环境；浏览器支持标准 DOM Focus 与 Input 事件

来源：evidence-user-inp-01、evidence-capture-modality、evidence-mdn-storage-estimate-01；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 便签卡片流与生命周期状态流转开发任务

ID：task-note-card-view；关联需求：feature-note-card-view、flow-note-card-actions、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-note-card-view、flow-note-card-actions

### 便签流多视图展示与卡片状态流转实现规范

1. **双布局形态与持久化记忆**：
   - 实现 `NoteFeed` 容器组件与 `NoteCard` 单卡片组件。
   - 布局支持 **瀑布流网格（Card Grid）** 与 **紧凑列表（Compact List）** 两种形态切换。
   - 布局偏好通过 `meta.user_preferences` 保存在本地存储中，页面刷新后自动还原。
   - 卡片排版层次：顶部图钉/收藏状态点与相对时间戳（“刚刚”、“10分钟前”），正文展示最多 5 行（超出渐变截断并提示展开），底部展示标签胶囊与悬停快捷操作栏。

2. **多维生命周期状态管理**：
   - **置顶（Pinned）**：便签卡片流划分为“置顶区域”与“常规流区域”。点击图钉按钮，便签 `isPinned` 状态翻转，即时平滑升至首部容器。
   - **加星收藏（Favorited）**：点击星标，`isFavorite` 状态翻转，图标呈现金色高亮与 150ms 缩放微动效。
   - **归档（Archived）**：点击归档按钮，便签状态更新为 `status='archived'`，从常规视图淡出，侧边栏归档箱计数 +1，未备份变更计数 +1。
   - **软删除与 5 秒撤销机制（Soft Delete & Undo）**：
     - 点击垃圾桶删除图标，卡片以缩小渐变动效从 DOM 中移除，在内存中标记为待删除暂存态。
     - 界面底部立即弹出浮动 Toast：“便签已移除 [撤销]”，启动 5 秒倒计时计时器。
     - **撤销分支**：若用户在 5 秒内点击“撤销”，倒计时终止，便签恢复活跃态并在原位置平滑插回。
     - **确认分支**：若 5 秒倒计时结束无撤销，执行 `StorageService.deleteNote(id, hard=false)` 写入软删除状态，未备份计数 +1。

3. **状态更新失败回滚机制**：
   - 若置顶、收藏或归档持久化抛错，卡片状态立刻回滚至点击前状态，并弹出提示“操作未能保存至本地”。
   - 若软删除超时后写入 IndexedDB 失败，界面弹出“删除同步失败，已恢复显示”，便签重新呈现在列表中，卡片内容完好保留在活跃列表中。

目标：交付便签流的双布局展现、置顶区分隔、加星收藏、归档流转及带 5 秒撤销保护的软删除交互能力。

范围：NoteFeed 与 NoteCard 组件实现、双视图切换逻辑、置顶与收藏状态即时持久化、软删除回收池与 5 秒撤销倒计时 Toast、失败回滚机制。

排除：不包含卡片内的 Markdown 重型排版渲染（由模态弹窗承载），不包含多用户协作光标

模块：NoteFeed、NoteCard、NoteService、WorkspaceUI

正常行为：便签按置顶在先、时间在后排版；点击图钉即时置顶；点击星标收藏；点击归档移出主视图；点击删除弹出 5 秒撤销通知，撤销立即恢复，超时持久化软删除。

异常行为：状态持久化失败时立即回滚界面状态至点击前，并弹出轻量错误提示；软删除持久化异常时卡片自动恢复显示，确保数据保留在活跃列表中不丢失

验证：
- 组件交互测试验证置顶排序及置顶区域隔离渲染
- 测试 5 秒撤销倒计时各分支（撤销成功/超时确认/写入失败恢复）
- 测试双视图（Grid/Compact）切换偏好持久化

完成条件：
- 便签双布局切换、置顶排序与收藏过滤测试通过率 100%
- 软删除 5 秒防误触撤销全链路（撤销/超时提交/写入异常回滚）验证全部通过
- 在主流分辨率下卡片流自适应排版无横向溢出滚动条

假设：客户端计时器机制（setTimeout / clearTimeout）正常工作

来源：evidence-platform-form、evidence-org-model；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 多维标签聚合、交集筛选与全局重命名开发任务

ID：task-tag-organization；关联需求：feature-tag-organization、flow-tag-organization、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-tag-organization、flow-tag-organization

### 多维标签聚合、交集筛选与全局重命名实现规范

1. **侧边栏标签聚合与统计**：
   - 实现 `TagRail` 侧边栏组件。
   - 监听数据库便签变更，利用 Dexie 多值索引或聚合管道统计所有非软删除便签中的标签频次，按关联便签数降序排列展示（如 `#灵感 (12)`, `#前端 (8)`）。
   - 标签栏支持快速关键字搜索过滤，便于标签较多时毫秒级定位目标标签。

2. **单标签与多标签交集（AND）组合过滤**：
   - **单选模式**：单击某一标签，状态机更新 `activeTags = ['tagA']`，主便签流仅展示包含该标签的条目，顶部浮现 `标签: #tagA [×]` 筛选胶囊。再次单击该标签取消过滤。
   - **多标签交集模式**：按住 `Ctrl` 或 `Cmd` 键点击更多标签，状态机更新为 `activeTags = ['tagA', 'tagB']`，便签流应用严格交集逻辑（便签必须同时包含所有选中标签）。
   - 若交集过滤无匹配结果，主内容区呈现“暂无同时包含选中标签的灵感”，并提供“一键重置筛选”按钮。

3. **标签全局重命名事务与失败回滚**：
   - 鼠标悬停标签提供“编辑”操作，触发就地重命名输入框。
   - 用户输入新名称并提交后：
     - 若新旧名称一致：直接退出。
     - 若与已有另一标签同名：弹出确认弹窗“已存在同名标签，是否合并关联便签？”，用户确认后合并。
     - 核心事务：通过 `db.transaction('rw', db.notes, async () => { ... })` 开启事务，批量遍历包含 `oldTag` 的所有便签，将其替换为 `newTag` 并持久化。
     - **失败回滚**：若批量更新事务因配额或底层异常中断，事务自动整体回滚，所有便签保留原有标签名称，弹窗提示“重命名未完成，已恢复原标签”，绝不产生半修改脏数据。
   - 当某标签关联的所有便签均被移除该标签或删除时，该标签自动从聚合面板中淡出。

目标：实现侧边栏标签聚合云、多标签单选/交集过滤及事务级全局标签批量重命名与异常回滚机制。

范围：TagRail 组件开发、标签全局聚合与排序、单标签过滤与 Ctrl 多标签交集算法、标签重命名事务逻辑、同名标签合并二次确认与异常回滚。

排除：不设计树状多层级文件夹与无限嵌套标签（遵循已确认的扁平多维组织模型）

模块：TagRail、NoteService、StorageService

正常行为：侧边栏实时汇总所有标签及对应便签数；点击单标签过滤列表；Ctrl+点击多标签呈现交集匹配；重命名标签时事务批量更新关联便签并在 UI 实时反映。

异常行为：标签重命名或批量合并事务失败时，底层事务自动回滚，便签保持原标签不变，界面提示错误并恢复原状，关联数据无损

验证：
- 单元测试验证多标签交集（AND）逻辑运算准确性
- 测试 Dexie 事务中 batchUpdateTags 的原子性与回滚机制
- 测试同名标签合并交互流程

完成条件：
- 标签聚合统计与交集筛选单元测试通过率 100%
- 标签全局重命名原子性与事务回滚验证通过率 100%
- 标签增删时侧边栏统计数毫秒级响应更新

假设：便签的 tags 属性为规范的字符串数组，无重复项

来源：evidence-org-model、evidence-indexeddb-spec；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 全文模糊检索引擎与关键词高亮开发任务

ID：task-search-filter；关联需求：feature-search-filter、flow-search-filter、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-search-filter、flow-search-filter

### 全文模糊检索引擎与关键词高亮实现规范

1. **即时无延迟检索与防抖管道**：
   - 实现 `SearchBar` 顶部搜索框组件与 `SearchEngine` 内存全文检索引擎。
   - 搜索输入框挂载 80ms 轻度防抖定时器，确保连续按键输入时流畅无卡顿，防抖结束后触发模糊匹配过滤。
   - 检索范围：覆盖便签正文纯文本、所含标签名称、创建时间等元信息。支持多词空格拆分逻辑与不区分大小写匹配。

2. **关键词动态黄色高亮（`<mark>`）安全渲染**：
   - 匹配到的便签在卡片摘要及详情中，正文中命中搜索词的所有片段被自动包裹在 `<mark class=\"highlight\">` 标签中以微黄色背景高亮突出。
   - **防 XSS 注入与正则安全**：对用户输入的检索关键字严格执行正则转义 `term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')`，杜绝非法正则字符导致 JavaScript 执行报错崩溃；高亮生成管道采用安全文本节点分割拼接，严禁直接拼接未经清洗的 innerHTML。

3. **快捷键唤醒与快捷重置交互**：
   - 全局快捷键 `/`：当页面未处于文本输入状态时，按下键盘斜杠键 `/`，光标瞬间聚焦至顶部搜索框并全选已有内容。
   - 快捷重置：搜索框右侧常驻清空按钮 `×`，点击该按钮或按下键盘 `Escape` 键，立即清空检索文本并失焦，便签流平滑恢复完整展示。

4. **组合检索与空状态引导**：
   - 搜索过滤与侧边栏的当前视图（全部/收藏/归档）及已选标签自动形成逻辑与（AND）叠加过滤。
   - 当无匹配记录时，主工作区展示友好空状态：“未找到与 ‘xxx’ 相关的灵感”，附带“清空搜索内容”与“创建包含该词的便签”快捷动作。

目标：实现顶部全局即时全文模糊检索与关键词动态高亮功能，提供 80ms 轻度防抖、快捷键唤醒/退出及空状态友好指引。

范围：SearchBar 顶部组件开发、SearchEngine 模糊匹配与分词算法实现、关键词高亮安全 HTML 生成、Esc 与 / 快捷键绑定、空状态占位处理。

排除：不引入重量级服务端检索引擎（如 Elasticsearch），纯前端轻量内存匹配

模块：SearchBar、SearchEngine、WorkspaceUI

正常行为：输入检索词后经 80ms 防抖即时过滤卡片流；正文命中词高亮显现；按 / 快速聚焦并全选；按 Esc 立即清空并恢复原列表；支持与侧边栏视图/标签条件叠加过滤。

异常行为：输入超长特殊字符或非法正则表达式时自动安全转义，页面零崩溃；无匹配结果时展示清晰占位引导与一键清空按钮

验证：
- 单元测试覆盖各类中英文、标点、连续特殊符号的搜索转义与匹配
- 测试防抖延迟与 UI 刷新频率
- 测试高亮渲染输出防 XSS 注入

完成条件：
- 模糊匹配与关键词高亮算法单元测试通过率 100%
- 连续正则特殊符号搜索输入零崩溃验证通过
- Esc 清除与 / 键聚焦全链路交互测试通过

假设：待检索便签常驻内存状态镜像，内存规模受控在浏览器常规限制内

来源：evidence-org-model；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 详情模态弹窗与 Markdown 编辑器开发任务

ID：task-note-detail-edit；关联需求：feature-note-detail-edit、flow-note-detail-edit、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-note-detail-edit、flow-note-detail-edit

### 详情模态弹窗与轻量 Markdown 编辑器实现规范

1. **沉浸式模态弹窗与交互设计**：
   - 实现 `NoteDetailModal` 组件，点击卡片正文平滑居中弹出，背景呈现轻度半透明毛玻璃遮罩。
   - 交互控制：支持点击遮罩外部或敲击键盘 `Escape` 键平滑关闭退出。
   - 顶部提供【阅读预览 / 快速编辑】切换按钮，双击正文区域亦可直接切入编辑模式。

2. **marked + DOMPurify 安全排版管道**：
   - 集成 `marked` 解析 GitHub Flavored Markdown (GFM) 语法（标题、引用、加粗、无序/有序列表、行内代码、多语言代码块、任务清单复选框）。
   - 管道后置处理：严格通过 `DOMPurify.sanitize()` 白名单过滤，过滤恶意脚本注入（XSS）、`javascript:` 伪协议等。
   - 外链安全补丁：自动为所有识别到的外部链接注入 `target=\"_blank\"` 与 `rel=\"noopener noreferrer\"` 属性，保护原页面上下文。

3. **Prism.js 代码语法高亮与一键复制**：
   - 多语言代码块通过 Prism.js 进行语法着色高亮，呈现清爽等宽字体。
   - 代码块右上角悬浮“复制”按钮：点击后调用 `navigator.clipboard.writeText()` 将纯文本写入剪贴板，按钮图标变为绿色对勾提示“已复制 √”（2秒后复原）。
   - 降级支持：若运行于受限环境导致 Clipboard API 报错，降级使用 `document.execCommand('copy')` 方案。

4. **GFM 任务清单勾选与编辑草稿保护**：
   - 任务清单（`- [ ]` 与 `- [x]`）在阅读模式下直接呈现可点击复选框；用户点击时就地翻转完成状态，自动更新正文字符串并异步调用 `StorageService.saveNote()` 持久化。
   - **编辑保存与草稿保留**：
     - 编辑模式提供带行号与自适应滚动的等宽多行编辑器，支持正文及标签实时修改，支持 `Ctrl/Cmd + S` 快捷保存。
     - 若本地持久化层写入抛出 `StorageQuotaExceededError`：弹窗保持打开不予关闭，正在编辑的文本草稿完整保留在编辑域中，弹窗顶部显示红色警告“本地保存失败：存储配额超限，请检查空间或导出备份”，并提供“重试保存”按钮，确保编辑内容完整保留。

目标：交付便签详情阅读与实时编辑模态弹窗，集成轻量 Markdown 安全排版、代码块语法高亮、剪贴板一键复制及失败防丢草稿保护。

范围：NoteDetailModal 组件开发、MarkdownRenderer 安全管道实现、Prism.js 高亮集成、代码一键复制与权限降级、Todo 复选框状态翻转、编辑与自动保存拦截机制。

排除：不集成重型富文本 WYSIWYG 排版画板或复杂表格公式协同编辑

模块：NoteDetailModal、MarkdownRenderer、NoteService、WorkspaceUI

正常行为：点击卡片平滑弹出详情弹窗；展示排版整洁的 Markdown 与高亮代码；点击代码复制写入剪贴板；点击任务清单翻转勾选状态并保存；切入编辑模式修改后按 Ctrl+S 瞬间保存退出。

异常行为：编辑保存发生存储异常时，弹窗绝对不关闭，编辑文本完整保留在编辑域中，界面呈现错误提示并保留重试按钮；剪贴板受阻时降级为 execCommand 提示手动复制

验证：
- 使用 DOMPurify 白名单防 XSS 注入测试（测试脚本注入、非法属性攻击）
- 测试 Todo Checkbox 点击翻转及正文持久化更新
- 测试剪贴板权限受阻时的降级机制
- 模拟存储满载测试编辑草稿保留与弹窗防关闭拦截

完成条件：
- Markdown 安全解析排版与 DOMPurify 白名单过滤测试通过率 100%
- 任务清单复选框交互与正文持久化更新通过验证
- 保存失败场景下弹窗防关闭与草稿保留完整在文本域中

假设：浏览器宿主环境支持基本的 DOM 模态对话框事件与剪贴板接口

来源：evidence-capture-modality、evidence-react-official；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 数据备份导出、智能合并恢复与防丢提醒开发任务

ID：task-data-portability；关联需求：feature-data-portability、flow-data-portability、interface-service-contracts、error-architecture-and-recovery；依赖：task-foundation-and-storage、feature-data-portability、flow-data-portability

### 本地数据备份导出、智能合并恢复与防丢提醒实现规范

1. **标准 JSON Schema v1 与 Markdown 打包导出**：
   - 实现 `BackupManager` 核心服务与 `DataManagementModal` 弹窗。
   - **JSON 备份导出**：异步读取当前全部便签实体，构造包含 `app: \"SparkNotes\"`, `schemaVersion: 1`, `exportedAt`, `notesCount`, `notes` 的结构化 Payload；通过 `new Blob([jsonStr], { type: 'application/json' })` 与虚拟 `<a>` 标签触发下载，文件命名为 `spark-notes-backup-YYYY-MM-DD.json`。
   - **Markdown 打包导出**：将所有便签整理转换为带 YAML FrontMatter 元数据头（id, tags, pinned, favorite, createdAt, updatedAt）的 Markdown 整合文档或压缩包。

2. **备份文件强校验与智能增量合并**：
   - 导入支持拖拽上传与文件选择器，利用 FileReader 或 `File.text()` 读取。
   - **格式强校验**：对导入内容执行严格结构校验（必须包含合法 schemaVersion、notes 数组，数组元素必须具备合法 id、content 与时间戳）。若校验失败，明确弹窗拦截报错并显示具体错误条目，绝对不向数据库写入任何脏数据，本地现有便签保持原样。
   - **冲突消解策略**：
     - **智能增量合并（默认推荐）**：逐条对比便签 ID 与 `updatedAt` 时间戳；ID 不存在则新增，已存在则保留更新时间较新的一方，不覆盖较新数据。
     - **全量覆盖恢复**：强制弹出二次确认弹窗；在全量清空旧数据前先自动生成临时内存快照，若覆盖写入发生异常立即利用快照安全回滚，保证旧数据不被意外抹除。

3. **温和防丢备份提醒（对抗宿主清理与静默驱逐）**：
   - 在 `meta.backup_tracker` 中维护 `lastBackupAt`（上次导出时间戳）与 `unbackedChangesCount`（未备份变更计数）。
   - 每次新增、编辑、归档、删除便签时，变更计数自增 1。
   - 触发条件：当 `unbackedChangesCount >= 20` 或 `Date.now() - lastBackupAt > 7 * 86400 * 1000` 时，侧边栏底部温和点亮琥珀色提示小圆点，并展示微文案“有未备份灵感 [立即导出]”。
   - 交互规范：采用非模态低侵入设计，绝不弹出阻塞性弹窗；用户点击“立即导出”直接触发下载，下载成功后计数器清零，提示点恢复微弱灰色。

4. **无痕隐私浏览模式感知与数据清空保护**：
   - 应用加载时探测是否处于隐身模式（如通过配额异常偏低或临时存储特征判定）；若处于隐身模式，顶部浮现轻量温和提示横幅，提示用户会话关闭后数据可能被浏览器清除，建议及时导出备份。
   - 提供“清空所有本地数据”的高级选项，点击后强制弹出红色警示弹窗，要求用户在输入框准确键入 `CLEAR` 确认方可执行物理删除，严防误触。

目标：实现全量本地数据的 JSON/Markdown 规范导出、外部备份强校验与智能增量合并导入、超20条或超7天温和防丢提醒及无痕模式感知。

范围：BackupManager 服务与 DataManagementModal 开发、Blob/FileReader 纯前端文件处理、JSON Schema 格式校验器、增量合并与全量覆盖事务、未备份变更追踪与侧边栏提醒点、无痕浏览模式探测。

排除：不搭建远程云端中心化存储同步，保持纯客户端离线数据自主掌控

模块：BackupManager、DataManagementModal、StorageService、WorkspaceUI

正常行为：点击导出即刻生成标准 JSON 文件并触发下载，未备份计数归零，提醒点熄灭；导入合法备份文件时展示合并/覆盖选项，增量合并按时间戳更新，视图无刷新热更新；变更达20条或超7天时侧边栏点亮温和提示点。

异常行为：导入损坏文件时强行拦截报错，不写入任何脏数据；导入中断事务自动回滚还原；导出受阻时保持面板并展示重试提示，数据完整保留在本地存储中

验证：
- 单元测试验证合法及各类畸形/缺字段 JSON 备份文件的校验拦截
- 测试智能增量合并比对算法（新增插入、旧版更新、冲突保留较新版）
- 测试变更计数递增与导出后复位清零
- 测试无痕模式检测逻辑

完成条件：
- JSON Schema v1 导出与强校验单元测试通过率 100%
- 智能增量合并比对算法验证通过率 100%
- 未备份计数自增与超阈值状态点亮逻辑测试全部通过

假设：浏览器支持 W3C Blob, File 与 URL.createObjectURL API

来源：evidence-platform-form、evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e、evidence-6ddb77ee-acc4-4ae3-a560-e67f902a47ad、evidence-file-api、evidence-mdn-storage-eviction-01；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 真实宿主浏览器端存储基准与全文检索性能交付验证任务

ID：val-storage-and-search-benchmark；关联需求：block-outcomes-lightweight-experience、feature-search-filter、feature-data-portability、val-browser-storage-and-search-perf；依赖：task-foundation-and-storage、task-search-filter、task-data-portability

### 真实宿主浏览器端存储基准与全文检索性能交付验证任务

由于规划阶段宿主 Docker 容器环境不可用（引用 evidence-exp-docker-env-prep），性能指标（如 1,000 条便签基准下全文检索端到端延迟 < 150ms、首屏冷启动 TTI < 1.0s、StorageManager.persist() 权限表现）不能宣称已实测通过。本验证任务正式明确未验证能力、实测环境、度量方式、数据规模及失败处理，在交付阶段真实浏览器环境中闭环实测验收。

1. **未验证能力与性能目标界定**：
   - **检索性能**：在灌入 1,000 条混合格式便签（含单行、多行、代码段、多标签）的数据规模下，连续执行 10 次模糊搜索，测量从击键结束、经过 80ms 防抖、到检索计算完成及 DOM 重新排版渲染完成的真实端到端时间，验证平均耗时是否小于 150ms。
   - **首屏加载**：在无本地 HTTP 缓存状态下，应用冷启动加载至首屏 6 块骨架屏消失且便签列表可交互时间（TTI）实测验证是否小于 1.0 秒。
   - **宿主持久化保护行为**：在标准 HTTPS / localhost 安全上下文下，调用 `StorageManager.persist()` 与 `persisted()`，验证授权流拦截与状态保存逻辑。
   - **存储满载状态保留**：模拟存储满载异常抛出，验证输入框与编辑弹窗在报错横幅出现后的文本草稿保留情况，确保文本完整保留在输入区域且弹窗不被强制关闭。

2. **验证实施步骤与度量标准**：
   - 步骤详见 task 内部定义，采用 Chrome DevTools Performance 面板与自动化测试脚本真实度量，杜绝伪造数字。

目标：在真实浏览器环境中实测验证 1,000 条便签规模下的全文检索端到端响应时间、首屏冷启动 TTI、StorageManager 持久化申请与存储配额满载时的状态保留机制。

范围：覆盖 Chrome、Edge、Firefox 真实浏览器；利用测试脚本自动批量注入 1,000 条便签样本集（涵盖单行、多行、代码块、丰富标签）；执行全文检索、动态高亮、JSON/Markdown 导出与导入合并全链路性能及稳定性检验；验证持久化申请与防丢提醒阈值逻辑。

排除：排除服务端性能测试（无后端架构），排除网络往返延迟（纯本地离线持久化）

模块：StorageService、SearchEngine、BackupManager、WorkspaceUI

正常行为：批量灌入 1,000 条便签耗时 < 800ms；全文检索端到端（含防抖与 DOM 重绘）平均延迟 < 150ms；首屏卡片可交互 TTI < 1.0s；导出后重新导入数据一致性 100%；StorageManager.persist() 授权流正常执行。

异常行为：若实测检索响应时间超过 250ms，触发长列表虚拟滚动（Virtual Scroll）优化与前缀索引重构；若配额异常未捕获，加固存储事务失败监听；若持久化权限被拒，降级为温和防丢提醒加强模式

验证：
- 使用 Chrome DevTools Performance 面板测量键盘事件至重新排版完成的真实时间戳
- 调用 StorageManager.estimate() 与 StorageManager.persist() 校验配额估算与持久化授权拦截流程
- 通过测试脚本核对导入导出便签集合的双向深度相等（Deep Equal）

完成条件：
- 1,000 条便签基准下，10 次搜索的平均响应时间小于 150ms（含 80ms 防抖）
- 页面冷启动至首屏卡片交互时间 TTI 实测小于 1.0 秒
- 模拟存储配额满载时，快速捕获输入框与详情编辑弹窗文本保留在输入区未被清空，弹窗维持开启
- StorageManager.persist() 授权流及超20条变更/超7天防丢提醒触发判定实测符合预期

假设：测试宿主机器为常规 PC（4核 CPU，8GB 内存以上）；测试浏览器为最新稳定版 Chrome / Edge / Firefox

环境：主流桌面 PC（Windows 11 / macOS / Ubuntu），Chrome 120+ / Edge 120+ / Firefox 122+ 真实浏览器，标准安全上下文（localhost 或 HTTPS）

步骤：
- 1. 执行 npm run build 并通过本地静态服务器启动应用
- 2. 在控制台运行自动化测试脚本注入 1,000 条多样化测试便签并验证写入完成
- 3. 开启 Performance 性能记录，连续执行 10 组包含中文、英文、标签的搜索，记录总耗时
- 4. 测量页面强制刷新后的首次内容绘制（FCP）与可交互时间（TTI）
- 5. 触发全量 JSON 导出并计算 SHA256，清空后全量导入比对数据哈希与实体一致性
- 6. 模拟存储配额打满，在快速捕获与编辑弹窗中键入文本并提交，验证文本保留在输入区与错误提示展示
- 7. 测试累积 20 条变更后侧边栏防丢提示点的激活与复位

通过标准：
- 10 次复合关键词搜索平均端到端延迟 <= 150ms
- 批量写入 1,000 条数据无丢损，导出并重新导入后条目数与字段校验一致性达 100%
- 配额超限异常注入时，输入框及编辑弹窗内文本完整保留在输入区域未被清空，弹窗维持开启
- StorageManager 持久化与防丢提醒触发无未捕获异常

证据：Chrome DevTools 性能录制与度量数据报告；自动化测试脚本控制台输出耗时日志；备份导入导出双向核对校验数据

失败后：若实测检索响应时间超过 150ms 但在 250ms 内，分析渲染瓶颈并引入 React.memo 与 useDeferredValue；若超过 250ms，重构为倒排索引并加入虚拟滚动；若配额异常捕获失败，修订 StorageService 异常拦截器。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-mdn-storage-persist-api；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 静态构建打包与本地离线部署任务

ID：task-build-and-deploy；关联需求：deployment-and-build-specification、tech-core-architecture；依赖：task-foundation-and-storage、task-quick-capture、task-note-card-view、task-data-portability

### 纯前端静态构建优化与部署交付规范

1. **Vite 生产构建优化配置**：
   - 生产构建命令：`npm run build`（调用 `vite build`），编译输出 `dist/` 纯静态文件夹。
   - **代码拆分（Code Splitting）策略**：
     - `vendor-react`: 拆分 `react`, `react-dom`。
     - `vendor-storage`: 拆分 `dexie`, `dexie-react-hooks`。
     - `vendor-markdown`: 拆分 `marked`, `dompurify`, `prismjs`。
     - `vendor-icons`: 拆分 `lucide-react`。
   - **静态资源相对路径**：配置 `base: './'`，确保产物既可部署在任意子路径域名下，亦可在本地直接使用文件协议或静态服务器运行，规避绝对路径导致的 404 资源加载异常。
   - **体积控制基准**：全量静态产物经 gzip 压缩后总体积控制在 150KB 以内，保障 3G 弱网或常规宽带下首屏加载能在 300ms 内完成。

2. **多形态部署方案落地**：
   - **本地开箱运行**：提供 `npm run preview` 启动本地静态测试服务，开箱即用。
   - **纯静态免服务端托管**：直接支持推送到 GitHub Pages、Cloudflare Pages、Vercel 或 Netlify，零服务端配置，具备天然的高并发与极低运维成本。
   - **PWA 脱机访问就绪**：配置标准 Web App Manifest，为用户提供“安装到桌面”与全脱机离线缓存基础。

3. **安全上下文与依赖检查**：
   - 生产部署环境强制启用 HTTPS 或在本地使用 `localhost` 访问，确保现代浏览器 StorageManager API 与 Clipboard API 完整可用。

目标：完成 Vite 生产构建优化与打包配置，输出纯静态无后端依赖产物包，支持本地即开即用与免服务器静态托管部署。

范围：vite.config.ts 构建优化配置、生产打包产物验证、本地预览脚本配置、单页静态路由与静态资源相对路径测试。

排除：不包含服务端 Dockerfile 编写与后端运维编排（坚持纯前端单页架构）

模块：ViteBuildConfig、DeploymentScripts

正常行为：执行 npm run build 极速完成打包；输出 dist/ 静态目录；资源引用使用相对路径；使用 npm run preview 或静态服务器启动后应用完整可用且无离线报错。

异常行为：构建若遇到 TypeScript 类型错误或未解析依赖时，构建命令立即阻断并输出明确错误行号，不输出半成品损坏产物

验证：
- 执行 npm run build 检查构建产物与 exit code
- 检查 dist/ 目录产物体积报告（确保 gzip 压缩后总体积 < 150KB）
- 使用本地静态服务加载产物验证功能完整性与控制台零报错

完成条件：
- 生产构建 0 错误 0 告警顺利通过
- 输出产物完全可在纯静态 HTTP 服务器下独立运行
- 首屏资源在无缓存本地加载耗时 < 300ms

假设：构建环境具备 Node.js 18+ 与 npm / pnpm

来源：evidence-vite-official、evidence-vite-static-deploy；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040
