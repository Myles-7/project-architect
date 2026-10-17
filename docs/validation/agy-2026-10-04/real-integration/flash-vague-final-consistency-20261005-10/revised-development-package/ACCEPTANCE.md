# 真实集成验证-flash-vague-20261004-03 — 验收场景

版本：23；批准蓝图：cd386b1e2b6f9264b79c5291dddf1fe1677e246f82ebf66eb4e555be7baf8fe1

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

## 便签卡片展示、回收区 7 天生命周期与清空验收标准

ID：acceptance-note-card-view；关联需求：feature-note-card-view、flow-note-card-actions；依赖：task-note-card-view

### 便签卡片展示、回收区 7 天生命周期与清空验收标准（Given / When / Then）

- **场景 1：瀑布流与紧凑列表切换自适应**
  - **Given** 便签列表中存在多条长短不一的卡片，
  - **When** 用户点击视图切换按钮，
  - **Then** 页面在 100ms 内平滑重排为紧凑列表，刷新页面后仍保持紧凑列表视图。
- **场景 2：便签移入回收区与保留 7 天状态展示**
  - **Given** 用户在某便签卡片上点击垃圾桶“删除”图标，
  - **When** 卡片从活跃流淡出，
  - **Then** 底部弹出“便签已移入回收区（保留7天）”提示，侧边栏【回收区】徽标 +1；用户切入回收区视图，卡片展示“还剩 7 天”状态胶囊。
- **场景 3：回收区便签一键还原无损恢复**
  - **Given** 回收区中存在一条带有 `#React` 标签且处于置顶状态的便签，
  - **When** 用户在回收区点击【还原】按钮，
  - **Then** 该便签从回收区移出，侧边栏回收区计数 -1，便签在活跃流顶部置顶区域恢复展示，`#React` 标签完整可见。
- **场景 4：回收区超过 7 天常驻横幅与二次确认清空**
  - **Given** 回收区中存在 3 条驻留超过 7 天的便签，
  - **When** 用户点击侧边栏【回收区】入口，
  - **Then** 侧边栏入口显示琥珀色过期预警圆点，回收区顶部常驻琥珀色提示横幅“有 3 条便签已超过 7 天保留期限”，提供【清空已过期便签】按钮；用户点击该按钮，弹出二次确认模态弹窗，确认后该 3 条便签被物理永久删除，横幅自动消失。
- **场景 5：单条彻底删除二次确认保护**
  - **Given** 用户在回收区点击某便签的【彻底删除】按钮，
  - **When** 系统弹出模态确认对话框，
  - **Then** 只有在用户点击“确认彻底删除”后才执行物理删除；若用户点击“取消”，对话框关闭，便签完好保留在回收区。
- **场景 6：写入异常失败回滚保护**
  - **Given** 数据库处于模拟配额满或受限状态，
  - **When** 用户尝试执行还原或彻底删除，
  - **Then** 界面弹出“操作失败，已恢复原状”，卡片状态完整回滚，数据零丢失。

来源：evidence-platform-form、evidence-org-model、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be、evidence-aa854fb0-c683-487b-9f19-90974f40bc8e；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 多维标签聚合与筛选验收标准

ID：acceptance-tag-organization；关联需求：feature-tag-organization、flow-tag-organization；依赖：task-tag-organization

### 多维标签聚合与筛选验收标准（Given / When / Then）

- **场景 1：标签云聚合排除处于回收区的便签**
  - **Given** 数据库中存在 3 条包含 `#React` 标签的活跃便签，另有 1 条打有 `#React` 标签的便签处于回收区，
  - **When** 用户查看左侧边栏“标签”面板，
  - **Then** 面板显示的标签为 `#React (3)`，处于回收区的便签被严格排除不计入。
- **场景 2：便签还原后标签统计恢复**
  - **Given** 回收区中的该条 `#React` 便签被用户点击【还原】，
  - **When** 还原操作成功完成，
  - **Then** 侧边栏 `#React` 标签的计数无缝更新为 `(4)`。
- **场景 3：标签批量重命名事务回滚保护**
  - **Given** 用户对标签发起重命名操作，
  - **When** 批量写入遭遇模拟配额中断，
  - **Then** 事务自动完整回滚，便签保留原标签，弹窗提示失败并建议导出备份。

来源：evidence-org-model、evidence-indexeddb-spec、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 即时全文模糊检索验收标准

ID：acceptance-search-filter；关联需求：feature-search-filter、flow-search-filter；依赖：task-search-filter

### 即时全文模糊检索验收标准（Given / When / Then）

- **场景 1：关键词即时模糊过滤与防抖响应**
  - **Given** 列表中存在多条活跃便签，
  - **When** 用户在顶部搜索框输入 `indexeddb`，
  - **Then** 在 80ms 防抖后列表即刻刷新，仅展示包含该词的活跃卡片。
- **场景 2：回收区便签常规检索隔离**
  - **Given** 数据库中存在一条包含“架构评审”的回收区便签，
  - **When** 用户在【全部灵感】视图搜索“架构评审”，
  - **Then** 搜索结果中不出现该回收区便签，常规流保持纯净。
- **场景 3：回收区内部定向检索**
  - **Given** 用户在【回收区】视图中，
  - **When** 用户在搜索框键入“架构评审”，
  - **Then** 搜索结果精准列出处于回收区的该条便签并高亮关键词，支持一键点击【还原】。
- **场景 4：特殊字符防崩与 Esc 清除还原**
  - **Given** 用户在搜索框键入连续正则特殊符号并按 `Esc`，
  - **When** 触发清空，
  - **Then** 页面零崩溃，搜索框清空失焦，卡片流完整恢复显示。

来源：evidence-org-model、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 便签详情与 Markdown 编辑验收标准

ID：acceptance-note-detail-edit；关联需求：feature-note-detail-edit、flow-note-detail-edit；依赖：task-note-detail-edit

### 便签详情与 Markdown 编辑验收标准（Given / When / Then）

- **场景 1：Markdown 格式化排版与代码一键复制**
  - **Given** 某便签正文中包含 JavaScript 代码块与列表，
  - **When** 用户点击进入详情弹窗并点击代码块复制按钮，
  - **Then** 正文清晰呈现层级排版，代码纯文本被写入剪贴板并提示“已复制”。
- **场景 2：回收区便签只读保护与快捷还原**
  - **Given** 用户在回收区视图中点击某条便签卡片，
  - **When** 详情模态弹窗居中展开，
  - **Then** 弹窗顶部呈现警示条提示“处于回收区不可编辑”，文本域不可直接修改；用户点击弹窗中的【还原便签】按钮，便签即刻还原，警示条消失并切入正常编辑模式。
- **场景 3：编辑模式保存失败草稿保留**
  - **Given** 用户在编辑弹窗中修改了灵感长文，
  - **When** 用户点击保存但本地存储抛出配额超限异常，
  - **Then** 详情模态弹窗保持打开不予关闭，用户修改的全部草稿文本在编辑器中完整保留，顶部展示红色错误警告与“重试保存”按钮。

来源：evidence-capture-modality、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 宿主浏览器端持久化容量与全文检索性能实测验证任务

ID：val-browser-storage-and-search-perf；关联需求：block-outcomes-lightweight-experience、feature-search-filter、feature-data-portability、feature-note-card-view；依赖：tech-storage-and-search、interface-service-contracts

由于规划阶段宿主 Docker 容器环境不可用（引用 evidence-exp-docker-env-prep），性能指标（如 1,000 条便签基准下检索端到端延迟 < 150ms、首屏冷启动 TTI < 1.0s、超期便签批量查询与清空延迟）不能宣称已实测通过。本验证任务正式明确未验证能力、实测环境、度量方式、数据规模及失败处理，移交交付阶段在真实浏览器中闭环验证。

目标：在真实宿主浏览器中实测验证 IndexedDB (Dexie.js) 本地持久化稳定性、1,000 条便签基准下的全文检索端到端延迟（含 80ms 防抖）、回收区 7 天超期便签批量清理性能及配额满载状态保留机制。

范围：覆盖 Chrome、Edge、Firefox 真实浏览器；利用测试脚本自动批量注入 1,000 条便签样本集（涵盖活跃、归档及处于回收区的超期便签）；执行检索、高亮、回收区清理性能及稳定性检验。

排除：排除服务端性能测试（无后端架构），排除网络往返延迟（纯本地离线持久化）

模块：StorageService、SearchEngine、BackupManager、WorkspaceUI

正常行为：批量灌入 1,000 条便签耗时 < 800ms；键入检索词后端到端渲染延迟稳定在 150ms 以内；超期便签批量查询与清空流畅无卡顿；首屏冷启动 TTI < 1.0s。

异常行为：若实测检索响应时间超过 250ms，触发长列表虚拟滚动优化；若超期便签查询慢，加固 trashedAt 复合索引；若配额异常未捕获，加固存储事务失败监听

验证：
- 使用 Chrome DevTools Performance 面板测量键盘事件至重新排版完成的真实时间戳
- 调用 StorageManager.estimate() 校验配额估算与拦截流程
- 测试脚本核对超期便签批量删除前后数据一致性

完成条件：
- 1,000 条便签基准下，10 次搜索的平均响应时间小于 150ms（含 80ms 防抖）
- 页面冷启动至首屏卡片交互时间 TTI 实测小于 1.0 秒
- 回收区超 7 天便签查询（listExpiredTrashedNotes）执行时间 < 50ms
- 配额超限注入时输入框与编辑弹窗文本保留率达到 100%

假设：测试硬件不低于常规个人电脑基准（4核 CPU，8GB 内存）；应用运行于标准安全上下文（localhost 或 HTTPS）

环境：主流桌面 PC（Windows 11 / macOS 14 / Ubuntu 22.04），Chrome 120+ / Edge 120+ / Firefox 122+ 真实浏览器环境

步骤：
- 1. 运行构建命令并在真实 Chrome 浏览器中启动本地预览页面
- 2. 执行基准数据灌入脚本，批量生成 1,000 条混合格式便签（含 100 条回收区便签，部分超 7 天）写入 IndexedDB
- 3. 开启 Performance 性能分析，记录关键词检索时间与回收区切换时间
- 4. 测试 listExpiredTrashedNotes 与 purgeExpiredTrashedNotes 执行耗时与事务原子性
- 5. 模拟存储配额满状态，验证输入框与编辑弹窗文本保留情况

通过标准：
- 10 次复合关键词搜索平均端到端延迟 <= 150ms
- 回收区超期便签批量删除事务通过率 100%
- 配额超限注入时文本 100% 完整保留未丢失

证据：Chrome DevTools Performance 性能面板记录分析文件；控制台自动化基准测试脚本运行耗时日志截图与数据文本；回收区批量清理事务回滚测试报告

失败后：若性能未达标，将检索算法升级为基于内存倒排索引，并引入分页虚拟滚动；若配额异常处理失败，补齐跨标签页存储状态同步。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 存储驱动与持久化基座验收标准

ID：acceptance-foundation-and-storage；关联需求：tech-core-architecture、data-model-core-entities、interface-service-contracts；依赖：task-foundation-and-storage

### 存储驱动与持久化基座验收标准（Given / When / Then）

- **场景 1：数据库 Schema 初始化与回收区索引**
  - **Given** 应用主进程启动并挂载 StorageService，
  - **When** IndexedDB 成功创建名为 `SparkNotesDB` 的数据库，
  - **Then** `notes` 仓库成功创建包含 `updatedAt`、`createdAt`、`status`、`trashedAt`（时间戳索引）、`*tags`、`isPinned`、`isFavorite` 的复合索引。
- **场景 2：便签移入回收区与一键还原数据一致性**
  - **Given** 数据库中存在一条活跃便签，
  - **When** 调用 `trashNote(id)`，随后调用 `restoreNote(id)`，
  - **Then** 移入回收区后 `status` 变为 `'trashed'` 且 `trashedAt` 被赋予当前时间戳；还原后 `status` 恢复为 `'active'` 且 `trashedAt` 为 `null`，原标签与置顶收藏字段分毫不差。
- **场景 3：驻留超 7 天过期筛选与批量清理事务回滚**
  - **Given** 数据库中存有 5 条处于回收区的便签（其中 2 条 `trashedAt` 距今超过 7 天，3 条未超期），
  - **When** 调用 `listExpiredTrashedNotes(7)`，
  - **Then** 精准返回该 2 条超期便签；当调用 `purgeExpiredTrashedNotes(7)` 时，若中途模拟注入异常，事务自动完整回滚，所有便签完整保留在数据库中。
- **场景 4：配额超限受控异常与持久化感知**
  - **Given** 数据库处于模拟写满状态，
  - **When** 尝试执行便签写入，
  - **Then** StorageService 准确捕获底层的 QuotaExceededError 并转换为应用层受控异常 `StorageQuotaExceededError`，未完成的事务自动完整回滚。

来源：evidence-indexeddb-spec、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 真实宿主浏览器端存储基准与全文检索性能交付验证任务

ID：val-storage-and-search-benchmark；关联需求：block-outcomes-lightweight-experience、feature-search-filter、feature-data-portability、val-browser-storage-and-search-perf、feature-note-card-view；依赖：task-foundation-and-storage、task-search-filter、task-data-portability

### 真实宿主浏览器端存储基准与全文检索性能交付验证任务

由于规划阶段宿主 Docker 容器环境不可用（引用 evidence-exp-docker-env-prep），性能指标（如 1,000 条便签基准下全文检索端到端延迟 < 150ms、首屏冷启动 TTI < 1.0s、超期便签批量查询与清空延迟）不能宣称已实测通过。本验证任务正式明确未验证能力、实测环境、度量方式、数据规模及失败处理，在交付阶段真实浏览器环境中闭环实测验收。

1. **未验证能力与性能目标界定**：
   - **检索性能**：在灌入 1,000 条混合格式便签（含常规及处于回收区的便签）的数据规模下，连续执行 10 次模糊搜索，测量从击键结束、经过 80ms 防抖、到检索计算完成及 DOM 重新排版渲染完成的真实端到端时间，验证平均耗时是否小于 150ms。
   - **回收区超期查询与批量清空性能**：在 100 条回收区便签规模下，验证 `listExpiredTrashedNotes` 执行耗时是否小于 50ms，验证清空超期便签批量删除事务耗时是否小于 200ms。
   - **首屏加载**：在无本地 HTTP 缓存状态下，应用冷启动加载至首屏 6 块骨架屏消失且便签列表可交互时间（TTI）实测验证是否小于 1.0 秒。
   - **存储满载状态保留**：模拟存储满载异常抛出，验证输入框与编辑弹窗在报错横幅出现后的文本草稿保留情况，确保文本保留在输入区域未被清空且弹窗维持开启。

目标：在真实浏览器环境中实测验证 1,000 条便签规模下的全文检索端到端响应时间、回收区 7 天超期清理事务耗时、首屏冷启动 TTI 及存储配额满载状态保留机制。

范围：覆盖主流桌面浏览器；利用脚本自动注入 1,000 条测试样本（含超 7 天回收区便签）；执行检索、高亮、回收区清理、导出导入及配额防御全链路检验。

排除：排除服务端性能测试（无后端架构），排除网络往返延迟（纯本地离线持久化）

模块：StorageService、SearchEngine、BackupManager、WorkspaceUI

正常行为：批量灌入 1,000 条便签耗时 < 800ms；全文检索端到端平均延迟 < 150ms；超期便签批量清理事务 < 200ms；首屏可交互 TTI < 1.0s。

异常行为：检索延迟若超 250ms 引入虚拟滚动；回收区查询若超时优化 trashedAt 索引复合条件；配额异常捕获失败加固全局错误监听

验证：
- 使用 Chrome DevTools Performance 面板测量键盘事件至重新排版完成的真实时间戳
- 调用 StorageManager.estimate() 校验配额估算与拦截流程
- 通过测试脚本核对回收区清理事务数据一致性

完成条件：
- 1,000 条便签基准下，10 次搜索平均端到端响应时间小于 150ms（含 80ms 防抖）
- 回收区超期便签筛选与清空事务执行时间小于 200ms
- 页面冷启动至首屏卡片交互时间 TTI 实测小于 1.0 秒
- 模拟存储配额满载时，输入框与编辑弹窗文本保留在输入区未被清空，弹窗维持开启

假设：测试宿主机器为常规 PC（4核 CPU，8GB 内存以上）；测试浏览器为最新稳定版 Chrome / Edge / Firefox

环境：主流桌面 PC（Windows 11 / macOS / Ubuntu），Chrome 120+ / Edge 120+ / Firefox 122+ 真实浏览器，标准安全上下文

步骤：
- 1. 执行 npm run build 并通过本地静态服务器启动应用
- 2. 运行基准脚本注入 1,000 条便签（含超期回收便签）并验证写入完成
- 3. 开启 Performance 性能记录，连续执行 10 组搜索，记录耗时
- 4. 测量回收区超期便签常驻横幅渲染及清空事务耗时
- 5. 测量冷启动 TTI 与配额超限注入时的文本保留情况

通过标准：
- 10 次复合关键词搜索平均端到端延迟 <= 150ms
- 超期便签批量清理事务执行稳定且无数据遗失
- 配额超限异常注入时文本完整保留未丢失

证据：Chrome DevTools 性能录制与度量数据报告；自动化测试脚本控制台输出耗时日志；回收区清理事务前后数据一致性核对报告

失败后：若检索耗时在 150~250ms 之间，分析瓶颈并引入 React.memo 与 useDeferredValue；若超 250ms，重构为倒排索引并加入虚拟滚动。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 真实浏览器性能基准与配额防御验收标准

ID：acceptance-storage-and-search-benchmark；关联需求：val-storage-and-search-benchmark、block-outcomes-lightweight-experience；依赖：val-storage-and-search-benchmark

### 真实浏览器性能基准与配额防御验收标准（Given / When / Then）

- **场景 1：1,000 条便签规模全文检索响应耗时达标**
  - **Given** 数据库中批量灌入了 1,000 条真实便签样本，
  - **When** 用户在顶部搜索框输入复合关键词（含防抖 80ms），
  - **Then** 从击键结束到视图卡片列表重新排版完成的端到端耗时实测平均小于 150ms，页面无卡顿掉帧。
- **场景 2：回收区超期便签批量清理耗时与事务原子性**
  - **Given** 回收区中存在 50 条驻留超过 7 天的超期便签，
  - **When** 用户点击【清空已过期便签】并确认，
  - **Then** 批量删除事务在 200ms 内完成，视图无卡顿刷新，未超期便签 100% 完整保留。
- **场景 3：冷启动首屏交互时间（TTI）达标**
  - **Given** 浏览器处于未缓存首次打开状态，
  - **When** 用户导航访问应用主页面，
  - **Then** 骨架屏脉冲动画在 1.0 秒内消失，首屏卡片流平滑呈现并可立即响应点击与输入。
- **场景 4：模拟配额超限下输入文本保留与防关闭**
  - **Given** 注入配额超限异常，
  - **When** 用户在快速捕获输入框或详情编辑弹窗中触发保存，
  - **Then** 输入框与编辑弹窗文本完整保留在输入区域未被清空，弹窗维持开启，界面浮现琥珀色告警并提供重试与导出入口。

来源：evidence-exp-docker-env-prep、evidence-storage-estimate、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 数据备份导出与恢复（含回收区数据策略）验收标准

ID：acceptance-data-portability；关联需求：feature-data-portability、flow-data-portability；依赖：task-data-portability

### 数据备份导出与恢复（含回收区数据策略）验收标准（Given / When / Then）

- **场景 1：标准 JSON 导出默认包含回收区便签与排除选项**
  - **Given** 本地数据库存有 15 条活跃便签与 5 条处于回收区的便签，
  - **When** 用户在数据面板点击“导出 JSON 备份”（默认勾选“包含回收区便签”），
  - **Then** 导出的 JSON 文件中完整包含 20 条记录，其中 5 条具备 `status: 'trashed'` 与有效的 `trashedAt` 时间戳；若用户取消勾选后导出，文件中仅包含 15 条活跃便签。
- **场景 2：损坏文件与非法 Schema 导入拦截防污染**
  - **Given** 用户尝试上传一份缺少 `schemaVersion` 或单条记录缺失 `id` 的损坏 JSON 文件，
  - **When** 系统执行文件格式与 Schema 强校验，
  - **Then** 弹窗明确显示红色错误“导入失败：备份文件格式不符合规范”，底层存储拦截阻断，本地现有便签数据完整无损。
- **场景 3：增量智能合并恢复与回收区便签超期预警即时激活**
  - **Given** 用户本地有 10 条便签，上传的备份文件中包含 2 条移入回收区已超 7 天的便签，
  - **When** 用户选择“智能增量合并”并点击确认，
  - **Then** 系统批量写入事务顺利提交，提示导入成功；侧边栏【回收区】入口立即点亮琥珀色过期预警圆点；切换至回收区视图，顶部常驻琥珀色提示横幅“有 2 条便签已超过 7 天保留期限”，提供清空操作。
- **场景 4：累计20条变更或7天未备份温和状态点亮与一键导出**
  - **Given** 用户在日常记录中累计执行了 20 次便签的新增、编辑、移入回收区或删除，
  - **When** 达到第 20 次操作完成时，
  - **Then** 侧边栏底部温和点亮琥珀色小圆点并展示微文案“有未备份灵感 [立即导出]”，不弹出任何打断式模态框；点击“立即导出”后直接触发下载并将提示点复位。

来源：evidence-platform-form、evidence-file-api、evidence-6ddb77ee-acc4-4ae3-a560-e67f902a47ad、evidence-cdc2a53a-bffa-464b-8462-2e4714cea48d；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046
