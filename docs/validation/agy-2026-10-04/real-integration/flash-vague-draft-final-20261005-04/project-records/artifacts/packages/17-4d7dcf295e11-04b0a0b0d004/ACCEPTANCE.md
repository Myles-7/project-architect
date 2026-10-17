# 真实集成验证-flash-vague-20261004-03 — 验收场景

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

## 存储驱动与持久化基座验收标准

ID：acceptance-foundation-and-storage；关联需求：tech-core-architecture、data-model-core-entities、interface-service-contracts；依赖：task-foundation-and-storage

### 存储驱动与持久化基座验收标准（Given / When / Then）

- **场景 1：数据库冷启动与 Schema 初始化**
  - **Given** 用户首次在浏览器中访问应用，
  - **When** 应用主进程启动并挂载 StorageService，
  - **Then** IndexedDB 成功创建名为 `SparkNotesDB`（版本 1）的数据库，包含 `notes` 与 `meta` 两个对象仓库，`notes` 仓库成功创建包含 `updatedAt`、`createdAt`、`status`、`*tags`（多值索引）、`isPinned`、`isFavorite` 的全部复合索引。

- **场景 2：便签实体 CRUD 与多值索引标签查询**
  - **Given** 存储服务已初始化，
  - **When** 插入包含 `tags: ['React', '架构']` 的便签实体，并调用按单标签 `React` 过滤查询，
  - **Then** 查询接口毫秒级精准返回该便签，实体包含完整的 UUID、创建时间与自增修改时间戳。

- **场景 3：配额超限受控异常与事务回滚**
  - **Given** 数据库处于极端模拟写满状态，
  - **When** 尝试执行便签写入或批量修改，
  - **Then** StorageService 准确捕获底层的 QuotaExceededError 并转换为应用层受控异常 `StorageQuotaExceededError`，未完成的事务自动完整回滚，数据库中原有数据记录未受任何篡改或损坏。

- **场景 4：StorageManager 持久化与配额感知**
  - **Given** 应用运行在 HTTPS 或 localhost 安全上下文中，
  - **When** 服务启动探测持久化权限，
  - **Then** 成功执行 `StorageManager.persisted()` 与 `persist()` 探测，并准确获取配额占用比例，将授权状态持久化至 `meta` 仓库中。

来源：evidence-indexeddb-spec、evidence-storage-estimate、evidence-mdn-storage-persist-api；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 秒级灵感极速捕获验收标准

ID：acceptance-quick-capture；关联需求：feature-quick-capture、flow-quick-capture；依赖：task-quick-capture

### 秒级灵感极速捕获验收标准（Given / When / Then）

- **场景 1：快捷键唤醒与自适应多行输入**
  - **Given** 用户处于工作区非输入焦点区域，
  - **When** 用户按下键盘字母键 `N`，
  - **Then** 页面自动平滑滚动至顶部，捕获输入框获得焦点并显现高亮外发光；随着多行文本录入，输入框高度平滑扩展。

- **场景 2：正文 `#标签` 智能提取并入库**
  - **Given** 用户在输入框中输入“探索 Vite 静态构建优化 #前端 #构建”，
  - **When** 用户敲击 `Ctrl + Enter`（或 `Cmd + Enter`），
  - **Then** 系统瞬间提取出 `前端` 与 `构建` 两个独立标签；输入框清空收缩为单行，便签流顶部以淡入动效呈现新生成的卡片，正文与标签完整展示，未备份计数器增加 1。

- **场景 3：空内容校验拦截与抖动反馈**
  - **Given** 输入框仅包含空格或换行，
  - **When** 用户尝试点击“记录灵感”或按下组合快捷键，
  - **Then** 提交动作被拦截，输入框外边框执行 300ms 红色警示抖动动画，焦点不丢失，便签流不产生任何空卡片。

- **场景 4：存储异常下的文本保留与回退保护**
  - **Given** 浏览器处于极端配额超限状态，
  - **When** 用户在输入框中输入长文灵感并触发保存，
  - **Then** 写入失败被安全捕获，输入框中的长文与标签完整保留在文本域中不被清空，输入框不关闭、不重置，页面顶部浮出琥珀色告警横幅提示“存储空间已满，灵感未能保存，请清理空间或导出备份”，并提供“立即导出”快捷入口。

来源：evidence-user-inp-01、evidence-capture-modality；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 便签卡片展示与状态流转验收标准

ID：acceptance-note-card-view；关联需求：feature-note-card-view、flow-note-card-actions；依赖：task-note-card-view

### 便签卡片展示与状态流转验收标准（Given / When / Then）

- **场景 1：瀑布流与紧凑列表切换自适应**
  - **Given** 便签列表中存在 10 条不同长短的灵感卡片，
  - **When** 用户点击右上角视图切换按钮（从网格切换为紧凑列表），
  - **Then** 页面在 100ms 内平滑重排为单行高密度列表，关键文本与标签清晰可见；刷新页面后仍保持紧凑列表视图。

- **场景 2：置顶卡片分离置顶与顺序重排**
  - **Given** 用户在列表中间浏览某条便签，
  - **When** 用户点击该卡片上的图钉图标，
  - **Then** 该便签脱离普通流，平滑移动至列表顶部的独立“置顶区域”，图钉图标变为实心高亮，本地数据库 `isPinned` 状态即刻更新为 true。

- **场景 3：收藏与归档视图过滤**
  - **Given** 用户标记了若干条星标便签与归档便签，
  - **When** 用户在侧边栏点击“已收藏”或“已归档”，
  - **Then** 主视图即刻刷新，仅展示对应状态的便签集合，顶部展示状态过滤标签，操作计数徽标与列表数量一致。

- **场景 4：软删除 5 秒防误触撤销与异常回退保护**
  - **Given** 用户点击某便签卡片上的删除按钮，
  - **When** 便签从视图淡出，底部弹出“便签已移除 [撤销]”浮层，
  - **Then** 若用户在 5 秒内点击“撤销”，该便签毫秒级在原位置恢复显示；若 5 秒倒计时结束且持久化写入遇到存储异常，界面弹出“删除同步失败，已恢复显示”，卡片自动回滚重现，内容完全保留。

来源：evidence-platform-form、evidence-org-model；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 多维标签聚合与筛选验收标准

ID：acceptance-tag-organization；关联需求：feature-tag-organization、flow-tag-organization；依赖：task-tag-organization

### 多维标签聚合与筛选验收标准（Given / When / Then）

- **场景 1：标签云实时聚合与数量统计**
  - **Given** 数据库中存在 5 条包含 `#前端` 标签和 3 条包含 `#架构` 标签的活跃便签，
  - **When** 用户查看左侧边栏“标签”面板，
  - **Then** 面板自动列出 `#前端 (5)` 与 `#架构 (3)`，按数量降序排列，数值与实际关联便签条数完全一致。

- **场景 2：单标签与多标签交集精准过滤**
  - **Given** 用户想要查找同时关于前端与架构的便签，
  - **When** 用户单击 `#前端` 标签，随后按住 `Ctrl/Cmd` 单击 `#架构` 标签，
  - **Then** 主视图顶部呈现 `标签: #前端 [×]` 与 `标签: #架构 [×]` 两个过滤胶囊，便签列表仅保留同时打有这两个标签的卡片，非匹配卡片平滑退出。

- **场景 3：标签全局原子重命名与同名合并**
  - **Given** 用户在侧边栏对 `#前端` 标签进行重命名，输入 `#Web开发` 并确认，
  - **When** 批量更新事务提交完成，
  - **Then** 原有打有 `#前端` 的 5 条便签底部的标签胶囊全部自动更新为 `#Web开发`，侧边栏标签统计与筛选无缝同步更新。

- **场景 4：批量修改失败事务回滚保护**
  - **Given** 用户发起标签重命名操作，
  - **When** 批量事务在执行中途遭遇模拟存储中断，
  - **Then** IndexedDB 读写事务自动回滚，原有便签的标签完整保持原名称不变，弹窗提示“更新未完成，已恢复原标签”，不产生半途修改的脏数据。

来源：evidence-org-model、evidence-indexeddb-spec；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 即时全文模糊检索验收标准

ID：acceptance-search-filter；关联需求：feature-search-filter、flow-search-filter；依赖：task-search-filter

### 即时全文模糊检索验收标准（Given / When / Then）

- **场景 1：关键词即时模糊过滤与防抖响应**
  - **Given** 便签列表中存在包含“IndexedDB 本地持久化设计”与“React 并发渲染机制”的多条卡片，
  - **When** 用户在顶部搜索框输入 `indexeddb`，
  - **Then** 在 80ms 防抖后列表即刻刷新，仅展示包含“IndexedDB”的卡片，非匹配卡片移出视口。

- **场景 2：命中文本黄色 `<mark>` 高亮**
  - **Given** 处于搜索过滤状态中，
  - **When** 用户查看匹配卡片的正文预览，
  - **Then** 所有命中关键词的字词均被黄色半透明背景的 `<mark class=\"highlight\">` 标签包裹，文本清晰可读，无多余 HTML 乱码。

- **场景 3：快捷键 `/` 激活与 `Esc` 恢复**
  - **Given** 用户正在浏览便签卡片，光标未在输入框中，
  - **When** 用户按下键盘斜杠键 `/`，
  - **Then** 光标瞬间定位至搜索框并全选已有文本；随后用户敲击 `Escape` 键，搜索框文字被清空，便签列表以平滑动画恢复完整全量显示。

- **场景 4：正则特殊符号安全转义防崩**
  - **Given** 用户在搜索框键入连续复杂的正则特殊符号（如 `.*?+()[]{}^$\\\\`），
  - **When** 防抖结束触发比对，
  - **Then** 检索引擎安全转义所有符号，无任何 JavaScript RegExp 抛错崩溃，页面正常展示“未找到匹配便签”空状态与重置按钮。

来源：evidence-org-model；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 便签详情与 Markdown 编辑验收标准

ID：acceptance-note-detail-edit；关联需求：feature-note-detail-edit、flow-note-detail-edit；依赖：task-note-detail-edit

### 便签详情与 Markdown 编辑验收标准（Given / When / Then）

- **场景 1：Markdown 格式化排版与外部链接安全防跳**
  - **Given** 某便签正文中包含多级标题、列表、代码块及外部链接 `https://vitejs.dev`，
  - **When** 用户点击该卡片进入详情阅读弹窗，
  - **Then** 正文清晰呈现层级排版，外部链接旁边显示小外跳图标，点击该链接在新标签页打开且携带 `rel=\"noopener noreferrer\"` 属性。

- **场景 2：代码块语法高亮与一键复制**
  - **Given** 便签正文中包含一段 JavaScript 代码块，
  - **When** 用户点击代码块右上角的“复制”图标，
  - **Then** 代码纯文本被成功写入系统剪贴板，按钮图标变为绿色对勾并提示“已复制”，2 秒后自动恢复原状。

- **场景 3：GFM 任务清单复选框交互持久化**
  - **Given** 便签中包含 `- [ ] 购买测试域名` 待办项，
  - **When** 用户在阅读模式下直接点击该复选框，
  - **Then** 复选框即刻变为勾选状态，正文字符串同步更新为 `- [x] 购买测试域名` 并写入 IndexedDB 本地持久化。

- **场景 4：编辑模式保存失败草稿保留**
  - **Given** 用户在编辑弹窗中修改了大量灵感内容，
  - **When** 用户点击保存但在写入时底层存储抛出配额超限异常，
  - **Then** 详情模态弹窗保持打开不予关闭，用户修改的全部草稿文本在编辑器中完整保留，弹窗顶部弹出醒目红色错误警告与“重试保存”按钮。

来源：evidence-capture-modality；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 数据备份导出与恢复验收标准

ID：acceptance-data-portability；关联需求：feature-data-portability、flow-data-portability；依赖：task-data-portability

### 数据备份导出与恢复验收标准（Given / When / Then）

- **场景 1：标准 JSON 与 Markdown 备份生成下载及计数清零**
  - **Given** 本地数据库存有 25 条灵感便签，且侧边栏显示琥珀色未备份提醒点，
  - **When** 用户点击“立即导出”或在数据面板点击“导出 JSON 备份”，
  - **Then** 浏览器即刻触发 `spark-notes-backup-YYYY-MM-DD.json` 文件下载，侧边栏琥珀色提示点熄灭，未备份变更计数器复位为 0。

- **场景 2：损坏文件与非法 Schema 导入拦截防污染**
  - **Given** 用户尝试上传一份篡改过的、缺少 `schemaVersion` 或单条记录缺失 `id` 的损坏 JSON 文件，
  - **When** 系统执行文件格式与 Schema 强校验，
  - **Then** 弹窗明确显示红色错误“导入失败：备份文件格式不符合规范”，底层存储执行拦截阻断，本地现有便签数据完整无损，无任何记录被篡改或覆盖。

- **场景 3：智能增量合并无冲突恢复**
  - **Given** 用户本地有 10 条便签，上传的备份文件中包含 15 条便签（其中 5 条为全新记录，2 条的 updatedAt 比本地更新，其余与本地一致或更旧），
  - **When** 用户选择“智能增量合并”并点击确认，
  - **Then** 系统批量写入事务顺利提交，提示“成功新增 5 条，更新 2 条”，主页面工作区无刷新热更新呈现最新的 15 条完整便签。

- **场景 4：累计20条变更或7天未备份温和状态点亮与一键导出**
  - **Given** 用户在日常记录中累计执行了 20 次便签的新增、编辑与删除，
  - **When** 达到第 20 次操作完成时，
  - **Then** 侧边栏底部温和点亮琥珀色小圆点并展示微文案“有未备份灵感 [立即导出]”，不弹出任何打断式模态框；点击“立即导出”后直接触发下载并将提示点复位。

来源：evidence-platform-form、evidence-file-api、evidence-6ddb77ee-acc4-4ae3-a560-e67f902a47ad；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

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

## 真实浏览器性能基准与配额防御验收标准

ID：acceptance-storage-and-search-benchmark；关联需求：val-storage-and-search-benchmark、block-outcomes-lightweight-experience；依赖：val-storage-and-search-benchmark

### 真实浏览器性能基准与配额防御验收标准（Given / When / Then）

- **场景 1：1,000 条便签规模全文检索响应耗时达标**
  - **Given** 数据库中批量灌入了 1,000 条真实便签样本，
  - **When** 用户在顶部搜索框输入复合关键词（含防抖 80ms），
  - **Then** 从击键结束到视图卡片列表重新排版完成的端到端耗时实测平均小于 150ms，页面无卡顿掉帧。

- **场景 2：冷启动首屏交互时间（TTI）达标**
  - **Given** 浏览器处于未缓存首次打开状态，
  - **When** 用户导航访问应用主页面，
  - **Then** 骨架屏脉冲动画在 1.0 秒内消失，首屏卡片流平滑呈现并可立即响应点击与输入。

- **场景 3：模拟配额超限下输入文本保留与防关闭**
  - **Given** 注入配额超限异常，
  - **When** 用户在快速捕获输入框或详情编辑弹窗中触发保存，
  - **Then** 输入框与编辑弹窗文本完整保留在输入区域未被清空，弹窗维持开启，界面浮现琥珀色告警并提供重试与导出入口。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040

## 静态打包构建与部署验收标准

ID：acceptance-build-and-deploy；关联需求：deployment-and-build-specification、tech-core-architecture；依赖：task-build-and-deploy

### 静态打包构建与部署验收标准（Given / When / Then）

- **场景 1：Vite 纯前端静态构建产物体积与分包完整性**
  - **Given** 开发者在终端执行 `npm run build`，
  - **When** Vite 构建流程完成，
  - **Then** 构建进程返回退出码 0，在 `dist/` 目录生成完整的纯静态产物（包含 index.html 及 assets 子目录）；经过 gzip 压缩后总体积严格控制在 150KB 以内；vendor 依赖实现合理代码拆分。

- **场景 2：静态资源相对路径与免后端开箱即用**
  - **Given** 构建生成的 `dist/` 静态产物目录，
  - **When** 开发者通过本地轻量静态 HTTP 服务器（如 `npm run preview` 或 `npx serve`）拉起服务并在浏览器中访问，
  - **Then** 页面正常加载所有样式与脚本，控制台 0 报错，无任何对后端接口的网络请求依赖，应用即开即用。

- **场景 3：静态单页应用刷新路由兼容性**
  - **Given** 应用部署在静态托管平台（如 GitHub Pages、Cloudflare Pages 或 Vercel），
  - **When** 用户在单页应用各状态页面执行浏览器刷新（F5），
  - **Then** 静态服务器正确提供 index.html，页面状态平滑恢复，无 404 页面丢失错误。

来源：evidence-vite-official、evidence-vite-static-deploy；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-delivery-1791131212040
