# 真实集成验证-flash-vague-20261004-03 — 目标项目开发约束

版本：24；批准蓝图：cd386b1e2b6f9264b79c5291dddf1fe1677e246f82ebf66eb4e555be7baf8fe1

按已批准蓝图和任务实施。不得把未执行试验写为通过，不得越过任务依赖。需求变化或关键验证失败时提交反馈，等待相关方案修订。

Project Architect 自身的技术栈与存储限制不适用于此项目。

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

## 轻量 Web 单页灵感工具的功能范围

ID：block-scope-core-boundaries；关联需求：项目目标；依赖：block-outcomes-lightweight-experience

### 功能范围界定（In Scope - 响应 7 天回收区生命周期变更）
1. **即时灵感捕获（Quick Capture）**：
   - 常驻页面顶部的快速输入卡片，支持多行文本自适应展开。
   - 支持键盘快捷键提交（`Ctrl/Cmd + Enter`）与快捷唤起（`N` 键聚焦）。
   - 支持正文中直接键入 `#标签名` 智能提取标签。
2. **便签流式浏览与多状态视图（Feed & Views）**：
   - 响应式便签卡片流（支持瀑布流/网格与紧凑列表切换）。
   - 便签状态流转：置顶（Pinned）、收藏（Favorite）、活跃（Active）、归档（Archived）、回收区暂存（Trashed）。
   - 视图过滤器：全部灵感、已加星收藏、已归档、回收区（Recycle Bin）。
3. **灵感回收区生命周期与 7 天保留保护（Recycle Bin & 7-Day Retention）**：
   - 删除便签不再直接丢弃或仅提供短时撤销，而是统一移入独立【回收区】暂存，标记 `status='trashed'` 与移入时间戳 `trashedAt`。
   - 回收区便签默认保留 7 天，期间支持用户一览查看、随时一键还原至原活跃状态与关联标签。
   - 超期提示与永久清理（依据已确认决策 dec-cd105627-1e53-4251-9f8e-9422bdfbbd5c）：侧边栏回收区入口展示过期预警状态点；用户切换至回收区视图时，顶部常驻琥珀色提示横幅“有 X 条便签已超过 7 天保留期限”，提供【清空已过期便签】与【一键彻底清空】按钮，经二次确认弹窗后执行物理删除。
4. **灵活标签组织体系（Tag Organization）**：
   - 标签云侧边栏聚合，自动统计各标签关联便签数量（严格排除处于回收区的便签，防止污染活跃标签池）。
   - 支持单标签精准过滤与多标签交集（AND）组合过滤。
   - 支持标签重命名（全局原子更新关联便签）与未使用标签清理。
5. **即时模糊搜索与高亮（Instant Search）**：
   - 前端全文模糊匹配（主工作区全局检索默认仅覆盖活跃与归档便签，回收区便签隔离于常规搜索结果之外；切换至回收区视图时限定在回收区内搜索）。
   - 命中关键字动态黄色高亮（`<mark>`），支持 `Esc` 键一键重置。
6. **便签详情与 Markdown 排版（Detail & Markdown Preview）**：
   - 点击卡片展开居中模态弹窗，展示完整便签内容。
   - 支持轻量 Markdown 格式化渲染（标题、列表、待办 Checkbox、外链、代码块语法高亮）。
   - 代码块右上角一键复制，外部超链接安全外跳。回收区便签进入详情弹窗时提供只读保护与【还原】/【彻底删除】入口。
7. **本地数据资产管理与温和防丢提醒（Data Portability & Backup Reminder）**：
   - 一键全量导出为结构化 JSON 备份文件及 Markdown 文档（JSON 备份默认包含回收区暂存便签并提供排除选项）。
   - 支持导入外部备份文件，提供校验与增量合并/全量覆盖策略，导入后自动识别超期回收便签并触发预警。
   - 基于已确认决策 dec-b17f49d8-86c3-4a74-baee-856b5d753129，追踪未备份变更数（如超20条）与未备份时间（如超7天），在界面侧边/底部温和显示“未备份”状态点与一键导出快捷入口。

来源：evidence-platform-form、evidence-org-model、evidence-capture-modality、evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e、evidence-vite-static-deploy、evidence-mdn-storage-persist-01、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be、evidence-aa854fb0-c683-487b-9f19-90974f40bc8e；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 纯前端轻量 Web 单页应用技术栈与运行环境规范

ID：tech-core-architecture；关联需求：block-scope-core-boundaries、block-outcomes-lightweight-experience；依赖：page-main-workspace、block-scope-core-boundaries

### 核心技术栈与架构基准（支持回收区生命周期）
1. **视图层与状态管理**：
   - React 19 结合 TypeScript 5.x，全面采用函数式组件与自定义 Hook 架构。
   - 响应式状态流：React Context + Dexie.js `useLiveQuery`，数据变更毫秒级自动刷新视图。
2. **构建与打包工具**：
   - Vite 静态构建优化，输出零服务端运行时依赖的纯前端产物。
3. **客户端数据库引擎与回收区索引基准**：
   - 基于浏览器原生 IndexedDB，采用 Dexie.js 响应式封装库。
   - `notes` 对象仓库声明复合索引：`id, updatedAt, createdAt, status, trashedAt, *tags, isPinned, isFavorite`。
   - 引入 `trashedAt` 索引专用于回收区便签的时间范围查询与 7 天保留到期筛选（`Date.now() - trashedAt > 7 * 86400 * 1000`）。
   - 宿主持久化保护：应用启动调用 `navigator.storage.persisted()` 与 `persist()` 申请浏览器持久化授权，辅以 `StorageManager.estimate()` 监控配额。
4. **样式与 Markdown 体系**：Tailwind CSS + Lucide React + marked + DOMPurify + Prism.js。
5. **未验证试验与基线转移声明**：规划阶段宿主 Docker 容器未启动（引用 evidence-exp-docker-env-prep），性能指标（1,000 条便签基准下检索延迟 < 150ms、首屏冷启动 TTI < 1.0s、超期便签批量清理延迟）作为待验证目标，移入交付阶段在真实浏览器中实测验收。

来源：evidence-react-official、evidence-vite-official、evidence-typescript、evidence-exp-docker-env-prep、evidence-mdn-storage-persist-api、evidence-mdn-storage-eviction-policy、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 客户端持久化存储与模糊检索技术架构

ID：tech-storage-and-search；关联需求：feature-quick-capture、feature-search-filter、feature-tag-organization、feature-note-card-view；依赖：tech-core-architecture

### 客户端持久化存储与模糊检索架构（回收区索引与隔离）
1. **单一事实来源与回收区复合索引**：
   - 所有便签实体完整保存在 IndexedDB 数据库 `SparkNotesDB`（版本 1）中。
   - `notes` 核心对象仓库声明复合索引：`id, updatedAt, createdAt, status, trashedAt, *tags, isPinned, isFavorite`。
   - `trashedAt` 索引专用于回收区时间范围查询与 7 天保留到期筛选。
   - 7 天过期查询规范：
     `db.notes.where('status').equals('trashed').and(note => note.trashedAt != null && (Date.now() - note.trashedAt > 7 * 86400 * 1000)).toArray()`。
   - 彻底删除批量事务：
     `db.transaction('rw', db.notes, async () => { await db.notes.bulkDelete(expiredIds); })`。
2. **宿主存储持久化与配额感知架构**：
   - 应用启动探测 `StorageManager.persisted()` 与 `persist()`；
   - 异步调用 `navigator.storage.estimate()` 监控配额。
3. **纯前端全文检索与回收区范围隔离架构**：
   - 内存索引缓存：内存中维护便签镜像；常规检索只对 `status !== 'trashed'` 便签进行比对；回收区视图只对 `status === 'trashed'` 便签进行比对。
   - 检索防抖 80ms，安全正则转义，在 1,000 条便签基准下检索过滤与 DOM 重排端到端时间目标小于 150ms。

来源：evidence-indexeddb-spec、evidence-mdn-indexeddb、evidence-mdn-using-indexeddb、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-mdn-storage-eviction-policy、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046
