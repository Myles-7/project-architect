# 真实集成验证-flash-vague-20261004-03 — 目标项目开发约束

版本：17；批准蓝图：4d7dcf295e11c188d49f91f29fcf74571f2f7b64784572d0b63310b67003d4cd

按已批准蓝图和任务实施。不得把未执行试验写为通过，不得越过任务依赖。需求变化或关键验证失败时提交反馈，等待相关方案修订。

Project Architect 自身的技术栈与存储限制不适用于此项目。

## 轻量 Web 单页灵感工具的功能范围

ID：block-scope-core-boundaries；关联需求：项目目标；依赖：block-outcomes-lightweight-experience

### 功能范围界定（In Scope）
1. **即时灵感捕获（Quick Capture）**：
   - 常驻页面顶部的快速输入卡片，支持多行文本自适应展开。
   - 支持键盘快捷键提交（`Ctrl/Cmd + Enter`）与快捷唤起（`N` 键聚焦）。
   - 支持正文中直接键入 `#标签名` 智能提取标签。
2. **便签流式浏览与多状态视图（Feed & Views）**：
   - 响应式便签卡片流（支持瀑布流/网格与紧凑列表切换）。
   - 便签状态流转：置顶（Pinned）、收藏（Favorite）、活跃（Active）、归档（Archived）、软删除（Deleted）。
   - 视图过滤器：全部灵感、已加星收藏、已归档。
3. **灵活标签组织体系（Tag Organization）**：
   - 标签云侧边栏聚合，自动统计各标签关联便签数量。
   - 支持单标签精准过滤与多标签交集（AND）组合过滤。
   - 支持标签重命名（全局原子更新关联便签）与未使用标签清理。
4. **即时模糊搜索与高亮（Instant Search）**：
   - 前端全文模糊匹配（覆盖便签正文与标签）。
   - 命中关键字动态黄色高亮（`<mark>`），支持 `Esc` 键一键重置。
5. **便签详情与 Markdown 排版（Detail & Markdown Preview）**：
   - 点击卡片展开居中模态弹窗，展示完整便签内容。
   - 支持轻量 Markdown 格式化渲染（标题、列表、待办 Checkbox、外链、代码块语法高亮）。
   - 代码块右上角一键复制，外部超链接安全外跳。
6. **本地数据资产管理与温和防丢提醒（Data Portability & Backup Reminder）**：
   - 一键全量导出为结构化 JSON 备份文件及 Markdown 文档。
   - 支持导入外部备份文件，提供校验与增量合并/全量覆盖策略。
   - 基于已确认决策 dec-b17f49d8-86c3-4a74-baee-856b5d753129，追踪未备份变更数（如超20条）与未备份时间（如超7天），在界面侧边/底部温和显示“未备份”状态点与一键导出快捷入口，对抗宿主存储驱逐与系统清理风险。

来源：evidence-platform-form、evidence-org-model、evidence-capture-modality、evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e、evidence-vite-static-deploy、evidence-mdn-storage-persist-01；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-product-1791130501589

## 明确的非目标与版本功能边界

ID：block-non-goals-exclusions；关联需求：项目目标；依赖：block-scope-core-boundaries

### 本版本明确排除的非目标（Non-Goals）
1. **不做多用户账户体系与云端认证登录**：
   - 不引入 JWT/OAuth/手机号/邮箱注册登录体系，坚决不做远程数据库强制鉴权，避免破坏即开即用特性。
2. **不做复杂树形文件夹体系与无限嵌套目录**：
   - 不设计树形文件夹导航，所有内容完全由扁平便签、多维标签与全文检索承接，避免多层级分类的认知负担。
3. **不做重量级富文本 WYSIWYG 排版编辑器**：
   - 不集成重型富文本编辑器（如复杂的表格编辑、嵌入视频流、实时协同光标画板等），保持编辑器毫秒级加载与极简纯文本/Markdown 体验。
4. **不做多人在线实时协同编辑与冲突解决机制**：
   - 专注单人本地工具属性，不引入 CRDT/OT 复杂的分布式网络协同算法。
5. **不做大体积多媒体二进制云端存储托管**：
   - 不提供图片/音视频的云存储上传服务，仅支持外链图片或文本链接引用。

来源：evidence-platform-form；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-product-1791130501589

## 纯前端轻量 Web 单页应用技术栈与运行环境规范

ID：tech-core-architecture；关联需求：block-scope-core-boundaries、block-outcomes-lightweight-experience；依赖：page-main-workspace、block-scope-core-boundaries

### 核心技术栈与架构基准
1. **视图层与状态管理**：
   - 核心框架：React 19 (19.3) 结合 TypeScript 5.x，全面采用函数式组件与自定义 Hook 架构（引用 React 官方文档 evidence-react-official 与 TypeScript 规范 evidence-typescript）。
   - 响应式状态流：采用 React 纯上下文与事件驱动模型（Context + Dexie.js useLiveQuery 响应式钩子），将 UI 状态与底层存储严格解耦，实现数据变更时的毫秒级视图自动刷新。
2. **构建与打包工具**：
   - 构建工具链：Vite（基于 Rolldown / Rollup 静态优化引擎，官方文档 evidence-vite-official）。
   - 核心特性：ESModule 开发服务器提供毫秒级热重载（HMR < 50ms）；生产环境输出极简纯静态资源包（HTML/JS/CSS），无任何 Node.js 运行时后端依赖。
3. **客户端数据库引擎与持久化保护基准**：
   - 依据已确认决策 dec-22c4d85c-5b93-4fe2-846c-b47a8a67fbca，基于浏览器原生 IndexedDB（引用 W3C evidence-indexeddb-spec 与 MDN evidence-mdn-indexeddb, evidence-mdn-using-indexeddb），采用 Dexie.js 响应式封装库声明强类型 Schema 与复合索引。
   - 宿主持久化保护：应用启动时通过 `navigator.storage.persisted()` 检测持久化模式，并主动调用 `navigator.storage.persist()` 请求浏览器永久存储权限（引用 MDN evidence-mdn-storage-persist-api, evidence-mdn-storage-eviction-policy），有效降低浏览器因磁盘压力对未备份数据的静默 LRU 驱逐概率与 Safari 7 天清理影响。
4. **样式与视觉体系**：
   - CSS 架构：Tailwind CSS，采用原子化 Utility-First 模式，构建期执行类名按需编译与 Tree-shaking，产物 CSS 压缩后预计小于 15KB，零运行时性能负担。
   - 图标集：Lucide React，按需动态引入 SVG 图标组件。
5. **Markdown 解析与安全渲染体系**：
   - 依据已确认决策 dec-d6ff701c-4666-4605-a6da-ef57a741635e，采用 marked + DOMPurify 安全过滤组合，配合 Prism.js 实现轻量语法高亮。
6. **运行环境要求与 Web API 依赖**：
   - 目标浏览器基线：Chrome/Edge >= 109, Firefox >= 115 (ESR), Safari >= 16.4，兼容主流现代移动浏览器（iOS Safari, Android Chrome）。
   - 关键宿主 Web API：
     - `IndexedDB API 2.0/3.0+`：事务级客户端持久化存储。
     - `StorageManager API`：`StorageManager.estimate()` 实时查询 Origin quota 与 usage；`StorageManager.persist()` 与 `persisted()` 进行存储持久化保护。
     - `Clipboard API`（`navigator.clipboard.writeText`）：支持代码块一键复制，环境受限时降级为 `execCommand`。
     - `File API / Blob / URL.createObjectURL`：支持浏览器端纯本地 JSON/Markdown 备份生成与下载触发（引用 W3C evidence-file-api, evidence-mdn-blob-spec）。
7. **未验证试验与基线转移声明**：
   - 规划阶段由于宿主 Docker 守护进程未启动（引用 evidence-exp-docker-env-prep），自动化容器沙盒基准未能执行。所有性能数字（1,000 条便签下全文检索延迟 < 150ms、首屏冷启动 TTI < 1.0s）明确作为待验证目标，完整移入交付阶段在真实浏览器环境中进行实测验收。

来源：evidence-react-official、evidence-vite-official、evidence-typescript、evidence-exp-docker-env-prep、evidence-mdn-storage-persist-api、evidence-mdn-storage-eviction-policy；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

## 客户端持久化存储与模糊检索技术架构

ID：tech-storage-and-search；关联需求：feature-quick-capture、feature-search-filter、feature-tag-organization；依赖：tech-core-architecture

### 客户端持久化存储与模糊检索架构
1. **单一事实来源（Single Source of Truth）**：
   - 所有便签实体、标签聚合关系与备份元数据完全保存在浏览器 IndexedDB 数据库 `SparkNotesDB`（版本 1）中，彻底规避 LocalStorage 的 5MB 限制与同步阻塞问题。
   - 核心对象仓库（Object Store via Dexie.js）：
     - `notes`：主键 `id` (UUID 字符串)；索引：`updatedAt`、`createdAt`、`status`、`*tags`（多值 Multi-entry 索引）、`isPinned`、`isFavorite`。
     - `meta`：主键 `key` (字符串)，存放备份追踪器 `backup_tracker`、存储持久化状态 `storage_status` 与用户偏好设置 `user_preferences`。
2. **宿主存储持久化与配额感知架构**：
   - 初始化挂载：应用首次进入时调用 `StorageManager.persisted()` 检查当前 Origin 是否具备 persistent 授权；若为 false，向用户发起权限申请 `StorageManager.persist()`，并将结果同步记录至 `meta.storage_status`。
   - 配额定期监测：在用户每次新增便签或进入数据管理面板时，异步调用 `navigator.storage.estimate()`，获取当前使用的 `usage` 与总额 `quota`。当 `usage / quota > 0.90` 时激活预警，防止突发写满导致 `QuotaExceededError`。
3. **纯前端全文检索与模糊匹配算法架构**：
   - 内存索引缓存：应用初始化加载时从 IndexedDB 异步读取全部非软删除便签列表放入内存状态；新增、修改、删除时通过 Dexie useLiveQuery 实时同步更新该内存镜像。
   - 检索防抖：输入框挂载 80ms 轻度防抖定时器，确保高频打字流畅无卡顿。
   - 匹配范围与分词：对正文文本、标签数组及日期文本执行不区分大小写的安全模糊匹配（支持空格多词分词逻辑与 `#` 标签精准匹配），命中内容动态生成带 `<mark class="highlight">` 的 Safe HTML 高亮节点。
   - 性能度量目标：在 1,000 条本地便签基准下，端到端检索过滤与 DOM 重排目标时间小于 150ms（含 80ms 防抖）。

来源：evidence-indexeddb-spec、evidence-mdn-indexeddb、evidence-mdn-using-indexeddb、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-mdn-storage-eviction-policy；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890
