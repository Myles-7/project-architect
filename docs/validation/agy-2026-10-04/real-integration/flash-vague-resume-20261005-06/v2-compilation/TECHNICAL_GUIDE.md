# 真实集成验证-flash-vague-20261004-03 — 技术与接口

版本：24；批准蓝图：cd386b1e2b6f9264b79c5291dddf1fe1677e246f82ebf66eb4e555be7baf8fe1

## 静态构建打包、本地运行与静态托管部署规范

ID：deployment-and-build-specification；关联需求：block-scope-core-boundaries、block-outcomes-lightweight-experience；依赖：tech-core-architecture

### 静态构建打包、本地运行与静态托管部署规范

1. **工程构建与输出配置**：
   - 构建命令：`npm run build`（调用 `vite build`）。
   - 输出目录：`dist/` 纯静态文件夹。
   - 产物优化策略：
     - 代码分割（Code Splitting）：将 React 运行时、Lucide 图标包、Markdown 编译核心分块打包，消除冗余依赖。
     - 资源相对路径：配置 `base: './'`，使得构建产物可直接在任意子目录或本地文件协议下免服务器直接启动。
     - 压缩基准：全量生产产物 gzip 压缩后总体积控制在 150KB 以内，确保在常规网络环境下首屏加载能在 300ms 内完成。
2. **多形态部署方案**：
   - **方案 A：个人本地快速启动（开发与日常）**：
     - 开发模式：`npm run dev`（Vite 极速开发服务，冷启动耗时 < 300ms）。
     - 本地预览：`npm run preview`（轻量本地 HTTP 静态服务器）。
   - **方案 B：纯前端无服务器静态托管（GitHub Pages / Cloudflare Pages / Vercel / Netlify）**：
     - 零服务端配置，将 `dist/` 静态文件夹推送到静态托管平台即可。
     - 配置单页路由重定向规则（SPA Fallback），保障刷新不出现 404。
   - **方案 C：浏览器离线缓存（PWA 演进就绪）**：
     - 引入轻量 Web App Manifest 与 Service Worker 资源预缓存机制，首次加载后完全支持在断网脱机状态下极速拉起应用。
3. **环境安全上下文与存储权限要求**：
   - 生产部署必须配置 HTTPS 协议或本地使用 `localhost` 访问，以保障浏览器 StorageManager API (`persist()`, `persisted()`) 与 Clipboard API 等关键特性的完整可用性（非安全上下文浏览器将禁用持久化申请与现代剪贴板）。

来源：evidence-vite-official、evidence-typescript、evidence-mdn-storage-persist-api；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

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

## 系统核心模块划分与职责边界规范

ID：module-system-decomposition；关联需求：block-scope-core-boundaries、page-main-workspace；依赖：tech-core-architecture

### 模块划分与职责解耦设计（包含回收区服务能力）
系统划分为高内聚、低耦合的六大核心服务与展现模块：

1. **存储驱动服务模块 (`StorageService`)**：
   - **职责**：基于 Dexie.js 封装 IndexedDB 连接、强类型 Schema 与复合索引；提供便签生命周期 CRUD、移入回收区（`trashNote`）、还原便签（`restoreNote`）、单条彻底删除（`hardDeleteNote`）、超期便签查询（`listExpiredTrashedNotes`）、批量清理过期便签（`purgeExpiredTrashedNotes`）及清空回收区（`emptyTrash`）；所有多记录变更采用事务包裹；封装 StorageManager 配额与持久化接口。
2. **便签领域业务模块 (`NoteService`)**：
   - **职责**：处理便签核心业务逻辑，计算回收区剩余保留天数（`7 - floor((now - trashedAt)/86400000)`），协调 StorageService 执行事务，并在便签移入回收区、还原或清理成功后递增未备份变更计数器 `unbackedChangesCount`。
3. **即时检索与高亮引擎 (`SearchEngine`)**：
   - **职责**：维护内存搜索索引镜像；根据当前视图作用域自动隔离数据源（常规视图自动排除 `status === 'trashed'`，回收区视图限定检索回收区便签）；执行 80ms 防抖模糊比对与正则安全黄色高亮。
4. **备份管理与数据便携模块 (`BackupManager`)**：
   - **职责**：执行全量数据打包与 JSON / Markdown 导出下载，默认包含回收区暂存便签并支持排除选项；解析并校验外部备份文件，导入恢复时还原 `trashed` 状态与 `trashedAt`，并即时触发超期便签检测；维护备份追踪器。
5. **Markdown 安全解析与渲染模块 (`MarkdownRenderer`)**：
   - **职责**：采用 marked + DOMPurify 安全编译，Prism.js 高亮代码块，提供回收区详情只读保护。
6. **主工作区交互与展现模块 (`WorkspaceUI`)**：
   - **职责**：包含顶部操作栏、左侧导航（含回收区入口与过期预警点）、便签流主展区、回收区视图（`RecycleBinView`）、常驻过期提示横幅（依据 dec-cd105627-1e53-4251-9f8e-9422bdfbbd5c）、彻底删除二次确认对话框及详情只读弹窗。

来源：evidence-react-official、evidence-vite-official、evidence-indexeddb-spec、evidence-mdn-storage-persist-api、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be、evidence-aa854fb0-c683-487b-9f19-90974f40bc8e；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

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

## 客户端持久化数据模型与实体关系架构（回收区生命周期）

ID：data-model-core-entities；关联需求：feature-quick-capture、feature-note-card-view、feature-data-portability；依赖：tech-storage-and-search

### 客户端持久化数据模型与实体关系架构（回收区生命周期）

1. **便签实体定义 (`Note`)**：
```typescript
export type NoteStatus = 'active' | 'archived' | 'trashed';

export interface Note {
  id: string;               // 唯一主键，UUID v4 格式，如 "550e8400-e29b-41d4-a716-446655440000"
  content: string;          // 便签正文纯文本，包含行内 Markdown 语法与标签
  tags: string[];           // 标签名称数组，去除 "#" 前缀，元素去重，单标签字符长度 1~20
  isPinned: boolean;        // 是否置顶展示，默认 false
  isFavorite: boolean;      // 是否加星收藏，默认 false
  status: NoteStatus;       // 生命周期状态：活跃(active)、已归档(archived)、回收区暂存(trashed)
  createdAt: number;        // 创建时间戳（毫秒级整型，Date.now()），生成后不可变更
  updatedAt: number;        // 最后修改时间戳（毫秒级整型），任何正文、标签或状态变动时更新
  trashedAt: number | null; // 移入回收区时间戳，活跃/归档状态时为 null，超 7 天过期计算基准
  version: number;          // 实体结构版本号，当前基准为 1
}
```

2. **应用全局元数据实体 (`AppMeta`)**：
```typescript
export interface AppMeta {
  key: string;              // 主键标识符，如 "backup_tracker", "user_preferences", "storage_status"
  value: any;               // 强类型配置对象
  updatedAt: number;        // 更新时间戳
}

export interface BackupTrackerMeta {
  lastBackupAt: number;          // 上次成功导出备份的时间戳
  unbackedChangesCount: number;  // 累计未备份变更次数（新增/编辑/归档/移入回收区/还原/清空均 +1）
  isPrivateModeDetected: boolean;// 是否检测到处于无痕隐身模式
}
```

3. **外部备份文件传输契约 (`BackupPayload`)**：
```typescript
export interface BackupPayload {
  app: 'SparkNotes';             // 固定应用标识符
  schemaVersion: 1;              // 备份协议版本号
  exportedAt: string;            // ISO 8601 标准时间字符串
  notesCount: number;            // 包含的便签总记录数
  notes: Note[];                 // 便签完整数据数组（包含 status 与 trashedAt）
}
```

4. **实体生命周期状态机流转与约束规范**：
- **创建**：初始状态为 `status = 'active'`, `isPinned = false`, `isFavorite = false`, `trashedAt = null`。
- **置顶/收藏切换**：字段取反，`updatedAt = Date.now()`。
- **归档**：`status = 'archived'`, `updatedAt = Date.now()`。
- **移入回收区**：`status = 'trashed'`, `trashedAt = Date.now()`, `updatedAt = Date.now()`, 未备份变更计数自增 1。
- **还原便签**：`status = 'active'`, `trashedAt = null`, `updatedAt = Date.now()`, 保留原 `isPinned`、`isFavorite` 与 `tags`。
- **超期判定条件**：`Date.now() - trashedAt > 7 * 86400 * 1000` (604,800,000 毫秒)。
- **彻底清除**：用户二次确认后，从 IndexedDB 执行物理主键删除（`db.notes.delete(id)`）。

来源：evidence-indexeddb-spec、evidence-file-api、evidence-typescript、evidence-mdn-blob-spec、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 模块服务接口、契约定义与数据流转规范

ID：interface-service-contracts；关联需求：feature-quick-capture、feature-search-filter、feature-data-portability、feature-note-detail-edit、feature-note-card-view；依赖：module-system-decomposition、data-model-core-entities

### 核心服务契约与接口定义（包含回收区方法集）

1. **存储服务接口 (`IStorageService`)**：
```typescript
export interface IStorageService {
  // 数据库生命周期
  init(): Promise<void>;
  close(): Promise<void>;

  // 持久化保护与配额
  requestPersistence(): Promise<boolean>;
  isPersisted(): Promise<boolean>;
  getStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }>;

  // 便签基础 CRUD
  getNoteById(id: string): Promise<Note | null>;
  listNotes(filter?: {
    status?: NoteStatus;
    isFavorite?: boolean;
    isPinned?: boolean;
    tags?: string[];
  }): Promise<Note[]>;
  saveNote(note: Note): Promise<void>;

  // 回收区 7 天生命周期专用接口
  trashNote(id: string): Promise<void>;                       // 标记为 trashed 并记录 trashedAt
  restoreNote(id: string): Promise<void>;                     // 还原为 active 并清空 trashedAt
  hardDeleteNote(id: string): Promise<void>;                  // 物理彻底删除单条便签
  listTrashedNotes(): Promise<Note[]>;                        // 获取所有处于回收区的便签
  listExpiredTrashedNotes(retentionDays?: number): Promise<Note[]>; // 查询驻留超 7 天的超期便签
  purgeExpiredTrashedNotes(retentionDays?: number): Promise<{ purgedCount: number }>; // 批量清空已超期便签（事务保证）
  emptyTrash(): Promise<{ purgedCount: number }>;             // 一键彻底清空回收区所有便签（事务保证）

  // 批量操作
  batchUpdateTags(oldTag: string, newTag: string): Promise<{ affectedCount: number }>;
  batchImportNotes(notes: Note[], mode: 'merge' | 'overwrite'): Promise<{ inserted: number; updated: number }>;
  clearAllData(): Promise<void>;

  // 元数据管理
  getMeta<T>(key: string): Promise<T | null>;
  setMeta<T>(key: string, value: T): Promise<void>;
}
```

2. **备份服务接口 (`IBackupService`)**：
```typescript
export interface IBackupService {
  exportJsonBackup(options?: { includeTrash?: boolean }): Promise<{ blob: Blob; fileName: string; count: number }>;
  exportMarkdownBundle(): Promise<{ blob: Blob; fileName: string; count: number }>;
  validateBackupFile(rawJsonText: string): { valid: boolean; errorReason?: string; payload?: BackupPayload };
  executeImport(payload: BackupPayload, mode: 'merge' | 'overwrite'): Promise<{ success: boolean; insertedCount: number; updatedCount: number }>;
  checkBackupReminderNeeded(tracker: BackupTrackerMeta): boolean;
  detectPrivateMode(): Promise<boolean>;
}
```

来源：evidence-indexeddb-spec、evidence-file-api、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-mdn-blob-spec、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 全局错误类型体系、降级策略与状态恢复机制

ID：error-architecture-and-recovery；关联需求：feature-quick-capture、feature-note-card-view、feature-data-portability、feature-note-detail-edit；依赖：interface-service-contracts

### 全局错误体系、降级策略与状态恢复规范（包含回收区操作）

1. **结构化受控错误字典与回收区保护**：
   - `StorageQuotaExceededError`（配额超限错误）：快速捕获输入框与详情编辑弹窗绝对不清空用户输入的文字，弹窗保持开启，展示顶部警告与导出入口。
   - `TrashOperationError`（回收区操作异常）：
     - **移入回收区失败**：卡片保留在原活跃列表中，弹出 Toast 错误提示，不丢失便签内容。
     - **便签还原失败**：便签保留在回收区中，弹出“还原未能保存至本地，已恢复原状”，原标签及置顶收藏状态完整保留。
     - **彻底删除与清空超期便签失败**：底层 IndexedDB 读写事务自动回滚（Rollback），未完成物理删除的便签完整保留在回收区中，绝不产生部分删除的不一致脏状态。
     - **二次确认拦截机制**：单条彻底删除与一键清空回收区必须经由模态确认对话框由用户二次确认后方可执行，防止误触导致不可逆损失。
   - `TransactionRollbackError`（批量操作事务中断）：批量重命名标签或增量导入中断时整体回滚，不破坏现有数据。
   - `BackupValidationError`（备份文件解析与校验失败）：非法文件彻底拦截报错，严禁写入脏数据。

2. **明确的失败后行为承诺矩阵**：
   - 便签移入回收区失败：保留在活跃列表，按钮恢复可用。
   - 回收区还原失败：保留在回收区，不丢弃数据。
   - 清空回收区失败：事务回滚，全部便签保留在回收区。
   - 快速捕获提交失败：输入框文本完整保留，光标不丢失。
   - 便签编辑保存失败：详情弹窗禁止自动退出，保留草稿于编辑域。
   - 绝不使用“永不丢失”“100%保证”等无证据绝对化用语，严格以事务隔离与状态保留机制为准则。

来源：evidence-indexeddb-spec、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-mdn-storage-eviction-policy、evidence-f54d9512-0313-47b4-b89b-a75fa782b2be；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-feedback-1791131947046

## 可行性证据

- answer-dec-0b4e5bce-aff8-45b1-8491-8edf7c4b150d：轻量 Web 单页应用（浏览器即开即用）；来源 question:run-c2d38ebc-b4ee-41c1-98cd-a4ab1be01fdf-delivery-0-q-platform-form；日期 2026-10-04T14:59:10.732Z；适用范围 product.platform_form；结果 参考证据；哈希 未提供。
- answer-dec-b17f49d8-86c3-4a74-baee-856b5d753129：标准 JSON 导入导出 + 温和防丢备份提醒（推荐）；来源 question:run-b43fc7a4-b1c0-4938-a16a-87ed154de2c2-delivery-1-q-backup-restore-strategy；日期 2026-10-04T15:21:48.751Z；适用范围 product.backup_restore_strategy；结果 参考证据；哈希 未提供。
- evidence-user-inp-01：我想做一个帮自己整理随手灵感的小工具。；来源 input:inp-01；日期 2026-10-04T14:57:46.356Z；适用范围 用户对小工具核心意图与随手灵感整理需求的原始表达。；结果 passed；哈希 45c08b7f2b5c515d8c6b0ef80008a07ae6cd96861d4442b60f14b59e76dff25a。
- evidence-9975e4b4-1b57-4bdc-97ac-d58bef07a4fe：我想做一个帮自己整理随手灵感的小工具。；来源 material:input:inp-01；日期 2026-10-04T15:22:22.783Z；适用范围 通过 material_index 与 material_read 验证并记录的原始需求材料。；结果 passed；哈希 45c08b7f2b5c515d8c6b0ef80008a07ae6cd96861d4442b60f14b59e76dff25a。
- evidence-platform-form：轻量 Web 单页应用（浏览器即开即用）：开发本地运行或静态托管的轻量 Web 应用，通过浏览器书签或常驻标签页随手记录与整理。；来源 question:run-c2d38ebc-b4ee-41c1-98cd-a4ab1be01fdf-delivery-0-q-platform-form；日期 2026-10-04T14:59:10.732Z；适用范围 用户已确认的产品形态约束：纯前端轻量 Web 单页应用，本地即开即用，无必须登录或重型后端约束。；结果 passed；哈希 e0f9e95b7ad6b9509952566c852515c7a16e3e44f794c1b48992fda8b578d391。
- evidence-org-model：模拟用户输入：此问题明确委托 AI 拟定，设计结果仍待批准。；来源 question:run-c2d38ebc-b4ee-41c1-98cd-a4ab1be01fdf-delivery-0-q-organization-model；日期 2026-10-04T14:59:10.732Z；适用范围 用户授权委托 AI 拟定灵感组织整理模型，设计结果保持待批准状态。；结果 passed；哈希 8c86a241e61bf71f069b541c6228f7f088029468c2f35b8247020927d2d2e686。
- evidence-capture-modality：模拟用户输入：此问题明确委托 AI 拟定，设计结果仍待批准。；来源 question:run-c2d38ebc-b4ee-41c1-98cd-a4ab1be01fdf-delivery-0-q-capture-modality；日期 2026-10-04T14:59:10.732Z；适用范围 用户授权委托 AI 拟定灵感记录形态，设计结果保持待批准状态。；结果 passed；哈希 8c86a241e61bf71f069b541c6228f7f088029468c2f35b8247020927d2d2e686。
- evidence-c6993bbe-7ff2-4381-81dc-f2ff5195709e：标准 JSON 导入导出 + 温和防丢备份提醒（推荐）：提供标准的 JSON 导出与导入校验能力，同时在前端追踪自上次备份以来的新增/修改灵感数量与时间；当积累较多未备份内容（如新增超20条或超7天未备份）时，在侧边/底部状态栏温和显示‘未备份’状态点与一键导出快捷操作。；来源 question:run-b43fc7a4-b1c0-4938-a16a-87ed154de2c2-delivery-1-q-backup-restore-strategy；日期 2026-10-04T15:23:11.556Z；适用范围 用户已确认的数据备份与恢复策略：标准 JSON 导入导出结合温和防丢备份提醒。；结果 passed；哈希 fe4f366ff7ed84af6cdcab8d547c6bde9cdc964dde1dd7ba314fa66d4a888a55。
- evidence-vite-static-deploy：Deploying a Static Site | Vite. You are using the default build output location (dist)... package.json: {"scripts": {"build": "vite build", "preview": "vite preview"}}... vite preview is intended for previewing the build locally and not meant as a production server. NOTE: These guides provide instructions for performing a static deployment.；来源 https://vite.dev/guide/static-deploy.html；日期 2026-10-04T15:06:25.412Z；适用范围 Vite 官方文档证实 React/Vite 现代单页应用原生支持纯前端静态编译构建（vite build 输出 dist 目录），并支持本地静态预览（vite preview）及静态托管，完全符合纯前端本地单页应用的技术可行性。；结果 passed；哈希 2209c7da1f6ddf8bcd8e20842e99f25d4536cec06f64fe589e9ac8ed32abb32b。
- evidence-e39b4151-a862-4d7d-ad80-2460bfce59db：MDN官方文档指出：Web Storage (localStorage) 每个域名通常被严格限制在约 5 MiB，且为同步阻塞调用，超限时抛出 QuotaExceededError。相比之下，IndexedDB 采用动态配额系统：Chromium 允许使用高达磁盘 60% 空间，Firefox 允许 10%（上限 10 GiB，持久化后可达 50%），Safari 约 60%。但默认在 best-effort 模式下受 LRU 存储压力驱逐，且 Safari 在开启防追踪时若连续 7 天无用户交互会主动清除脚本数据。可通过 navigator.storage.persist() 申请常驻存储保护数据，并通过 navigator.storage.estimate() 获取使用量与配额。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria；日期 2026-10-04T15:06:12.051Z；适用范围 为本地持久化方案选型提供官方标准依据：主存储应选 IndexedDB 以突破 5MB 限制并避免阻塞，需结合 persist() 申请与外部 JSON 备份提醒防范浏览器缓存驱逐。；结果 passed；哈希 a47182c320ef508003bba9bfbebda838ded8982e4a1992679aa56293edd55a6c。
- evidence-6ddb77ee-acc4-4ae3-a560-e67f902a47ad：MDN官方文档指出：Blob 接口表示不可变的原始数据类文件对象，可通过 Blob([data], {type: 'application/json'}) 在浏览器内存中构建 JSON 导出数据，并配合 a.download / URL.createObjectURL 触发本地文件下载；通过 FileReader 或 File.text() 异步读取用户导入的本地 JSON 文本，实现无需服务端参与的本地数据备份与导入恢复闭环。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Blob；日期 2026-10-04T15:06:39.851Z；适用范围 证明纯前端基于 Blob 与 a.download 导出 JSON 备份及基于 File.text() 读取校验导入在 Web 标准下完全可行。；结果 passed；哈希 bc8bddd1332c0cf7b69e8ce90ba6d014009294c62a36d7fc8509b19d03c134a4。
- answer-dec-22c4d85c-5b93-4fe2-846c-b47a8a67fbca：Dexie.js 响应式封装库（推荐）；来源 question:run-a28bf7b6-44c3-4461-be52-0f24fe6081f4-delivery-0-q-tech-storage-driver；日期 2026-10-04T15:32:23.849Z；适用范围 technical.storage_driver；结果 参考证据；哈希 未提供。
- evidence-react-official：React v19.3 The library for web and native user interfaces. Create user interfaces from components. React components receive data and return what should appear on the screen.；来源 https://react.dev/；日期 2026-10-04T15:26:31.473Z；适用范围 前端核心视图层框架与组件化状态驱动技术依据；结果 参考证据；哈希 e56a65d65c8b4f9115e45db799de1554e4f38ef965169ecc4d235d0601b341e7。
- evidence-vite-official：Vite is a blazing fast frontend build tool powering the next generation of web applications. Instant Server Start, Lightning Fast HMR, Rich Features Out of the Box, Optimized Build powered by Rolldown.；来源 https://vite.dev/；日期 2026-10-04T15:26:34.493Z；适用范围 现代前端轻量单页构建与零服务端静态部署规范依据；结果 参考证据；哈希 04797a62b5b7e1b71ca542a734ee9196e33473412e97f205ae9986c004ab9764。
- evidence-indexeddb-spec：Indexed Database API 3.0 W3C Working Draft. This document defines APIs for a database of records holding simple values and hierarchical objects. Each record consists of a key and some value. The database maintains indexes over records it stores. Transactions lifecycle, Object store storage operation, retrieval, clear.；来源 https://www.w3.org/TR/IndexedDB/；日期 2026-10-04T15:26:44.746Z；适用范围 客户端本地持久化存储、主键索引与事务回滚的核心规范依据；结果 参考证据；哈希 c3a5c1e003fc2f7fa8d27ea2dc6b2e2e097b49aa81d8b138543c8725004e8536。
- evidence-mdn-indexeddb：IndexedDB is a low-level API for client-side storage of significant amounts of structured data, including files/blobs. This API uses indexes to enable high-performance searches of this data. IndexedDB is a JavaScript-based object-oriented database that supports transactions.；来源 https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API；日期 2026-10-04T15:26:08.417Z；适用范围 浏览器端本地持久化存储与事务保障技术选型依据；结果 参考证据；哈希 7c3f3a504f93e96a3872db9d63cf716267a09fa8e2618f0b4ef554e0416e9a78。
- evidence-mdn-using-indexeddb：IndexedDB is a way to persistently store data inside a user's browser, enabling applications to work both online and offline. The pattern involves opening a database, creating an object store, starting transactions, and executing requests.；来源 https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB；日期 2026-10-04T15:26:57.181Z；适用范围 客户端离线运行与本地事务模式设计依据；结果 参考证据；哈希 918e85e2b819f56bdbf566cb52d95940a593164dfe7898f38acdff41e36c6c87。
- evidence-storage-estimate：The estimate() method of the StorageManager interface asks the Storage Manager for how much storage the current origin takes up (usage), and how much space is available (quota). Unit is byte.；来源 https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate；日期 2026-10-04T15:27:17.679Z；适用范围 本地存储空间估算与配额超限预警技术实现依据；结果 参考证据；哈希 35346bb4f2f91eab4ed505353267c21a4f0cf57896e95d2ae79a722dc80f3207。
- evidence-file-api：File API W3C Working Draft. A Blob interface, which represents immutable raw binary data. A File interface. A FileReader interface, which provides methods to read a File or a Blob, and an event model to obtain the results of these reads. A URL scheme for use with binary data such as files.；来源 https://www.w3.org/TR/FileAPI/；日期 2026-10-04T15:26:52.407Z；适用范围 客户端无服务端依赖下的 JSON 备份导出（Blob 机制）与文件读取导入（FileReader）官方规范；结果 参考证据；哈希 975b6f12f51320b7f90af2b97e38a80358b5964bc274caafb5d126b3f3881efc。
- evidence-typescript：TypeScript: JavaScript With Syntax For Types. TypeScript adds additional syntax to JavaScript to support a tighter integration with your editor. Catch errors early in your editor. TypeScript code converts to JavaScript, which runs anywhere JavaScript runs: In a browser, on Node.js.；来源 https://www.typescriptlang.org/；日期 2026-10-04T15:27:13.993Z；适用范围 类型安全定义便签数据结构、导入导出格式强校验与编译期防错基石；结果 参考证据；哈希 405cee3660db50249ce28e111779ed8613819653ebecfd91b621cd6eb8e4efcb。
- evidence-exp-docker-env-prep：Docker daemon connection failed (The system cannot find the file specified). Node.js container environment unavailable for automated runtime benchmarks.；来源 experiment:prepare-eff1ef3a-50c0-4749-b41f-54de3acbb135；日期 2026-10-04T15:54:40.000Z；适用范围 宿主 Docker 容器环境不可用记录，指引将性能基准与配额边界测试移交至开发前置验证任务；结果 unexecuted；哈希 未提供。
- evidence-f6a799ab-824c-4197-bcce-744889c62ef3：我想做一个帮自己整理随手灵感的小工具。；来源 material:input:inp-01；日期 2026-10-04T15:59:31.804Z；适用范围 用户对随手灵感记录与整理的核心诉求；结果 参考证据；哈希 45c08b7f2b5c515d8c6b0ef80008a07ae6cd96861d4442b60f14b59e76dff25a。
- evidence-user-input-inp-01：用户原始输入：“我想做一个帮自己整理随手灵感的小工具。” 明确表达了自用、轻量、随手记录与敏捷整理的核心诉求，无复杂的云端团队协同或复杂多级目录要求。；来源 material:input:inp-01；日期 2026-10-04T15:59:06.881Z；适用范围 作为产品定位、目标用户画像及核心功能范围界定的基础事实依据。；结果 参考证据；哈希 45c08b7f2b5c515d8c6b0ef80008a07ae6cd96861d4442b60f14b59e76dff25a。
- evidence-mdn-storage-estimate-01：MDN 官方文档阐明 StorageManager.estimate() 方法以异步 Promise 形式返回当前 origin 的 usage 与 quota。该特性仅在安全上下文 (HTTPS/localhost) 可用，当浏览器存储空间不足时 IndexedDB 会抛出 QuotaExceededError 异常，用于客户端应用的配额监控与防爆仓保护。；来源 https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate；日期 2026-10-04T15:59:28.180Z；适用范围 用于产品与技术架构中的存储容量感知、配额不足预警横幅及写入失败保护设计。；结果 参考证据；哈希 35346bb4f2f91eab4ed505353267c21a4f0cf57896e95d2ae79a722dc80f3207。
- evidence-mdn-storage-persist-01：MDN 官方文档阐明 StorageManager.persist() 方法用于申请持久化存储权限。浏览器默认将数据存储为 best-effort 模式，遇到存储压力时会依据 LRU 策略被静默驱逐；若获得 persistent 权限，存储数据仅在用户显式操作时才会被清除。Safari 与 Chromium 根据站点交互历史自动决策，Firefox 弹出权限弹窗。；来源 https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist；日期 2026-10-04T15:59:41.186Z；适用范围 用于分析纯客户端 IndexedDB 存储在浏览器环境下面临的驱逐风险，确立温和防丢提醒与定期导出 JSON 备份的核心产品机制。；结果 参考证据；哈希 61e3a1ce74716d1ff6ffe010c45422c4b77e11db823c23e7ee5b0e5b6222f625。
- evidence-mdn-storage-eviction-01：MDN 存储配额与驱逐准则官方文档：设备存储压力下浏览器按 LRU 顺序驱逐 best-effort 模式站点数据；Safari 具备主动驱逐机制，若某站点在最近 7 天内无用户点击交互，脚本创建的数据将被主动删除；无痕/隐身模式下数据在会话结束时即被彻底清除；数据驱逐为整站全量抹除，无法局部保留。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria；日期 2026-10-04T15:59:50.210Z；适用范围 用于指导异常使用场景（无痕模式、Safari 7天未用驱逐、磁盘满载）与可行性风险防控，明确单页应用必须具备温和防丢导出提醒与导入恢复策略。；结果 参考证据；哈希 a47182c320ef508003bba9bfbebda838ded8982e4a1992679aa56293edd55a6c。
- evidence-mdn-storage-persist-api：MDN 官方文档确认 StorageManager.persist() 方法在安全上下文（HTTPS）中运行，向浏览器请求持久化存储权限。若授予则 bucket 模式转为 persistent，在存储空间紧张时不会被浏览器根据 LRU 规则自动驱逐，仅在用户显式操作时清理。；来源 https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist；日期 2026-10-04T16:15:42.340Z；适用范围 用于纯前端持久化防护设计，对抗浏览器静默驱逐与 Safari 7 天清理机制；结果 passed；哈希 61e3a1ce74716d1ff6ffe010c45422c4b77e11db823c23e7ee5b0e5b6222f625。
- evidence-mdn-storage-eviction-policy：MDN 官方关于 Storage quotas and eviction criteria 规范明确说明不同浏览器管理网站本地数据的配额与清理策略：当磁盘空间压力增大时浏览器会根据 LRU 驱逐策略删除非 persistent 站点的数据，Safari 亦有 7 天无交互清理机制。故单页离线应用须配备持久化申请与主动备份机制。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria；日期 2026-10-04T16:16:13.451Z；适用范围 用于技术架构中解释为什么需要温和防丢提醒与定期全量导出；结果 passed；哈希 a47182c320ef508003bba9bfbebda838ded8982e4a1992679aa56293edd55a6c。
- evidence-mdn-blob-spec：MDN 官方关于 Blob 对象的规范说明，纯前端可通过 Blob 构造器封装文本（JSON、Markdown），结合 URL.createObjectURL 和 HTMLAnchorElement 触发本地无服务器文件下载保存。；来源 https://developer.mozilla.org/en-US/docs/Web/API/Blob；日期 2026-10-04T16:16:58.189Z；适用范围 用于纯前端无后端依赖的本地 JSON 与 Markdown 备份导出实现；结果 passed；哈希 bc8bddd1332c0cf7b69e8ce90ba6d014009294c62a36d7fc8509b19d03c134a4。
- answer-dec-cd105627-1e53-4251-9f8e-9422bdfbbd5c：回收区常驻提示横幅 + 用户主动确认一键清空（推荐）；来源 question:run-65c5ee22-af96-4d2c-b6f2-d2b4e9126daf-delivery-0-question-trash-expiry-trigger-mode；日期 2026-10-04T16:33:02.774Z；适用范围 product.trash_expiry_behavior；结果 参考证据；哈希 未提供。
- evidence-f54d9512-0313-47b4-b89b-a75fa782b2be：模拟用户需求变更：删除灵感改为进入回收区，保留七天且可以还原，超过七天必须提示并执行永久删除。更新受影响功能、流程、数据、接口、错误恢复、任务和验收；保留无关块稳定 ID。此原文不是直接批准。；来源 input:2fde8c14-93b9-4137-b3f2-6c7d624c77c0；日期 2026-10-04T16:33:55.747Z；适用范围 用户针对灵感删除提出需求变更，要求改为进入回收区暂存并保留7天支持随时还原，超过7天必须明确提示并执行永久删除。；结果 参考证据；哈希 f0c439fa3fa85f208b947a5b0a7dbfd49193656a6c0d6195a93b13c95d9a07c4。
- evidence-cdc2a53a-bffa-464b-8462-2e4714cea48d：模拟用户输入：此问题明确委托 AI 拟定，设计结果仍待批准。；来源 input:5d86418e-11a0-4c96-bf09-e20d92886503；日期 2026-10-04T16:33:58.248Z；适用范围 用户明确委托 AI 拟定在导出数据备份时对回收区便签的处理策略。；结果 参考证据；哈希 8c86a241e61bf71f069b541c6228f7f088029468c2f35b8247020927d2d2e686。
- evidence-aa854fb0-c683-487b-9f19-90974f40bc8e：在回收区便签超过 7 天保留期限时，您偏好哪种提示时机与永久删除触发机制？用户选择：回收区常驻提示横幅 + 用户主动确认一键清空（推荐）：在侧边栏“回收区”入口展示过期预警状态点；用户切换至回收区视图时，顶部常驻琥珀色提示横幅“有 X 条便签已超过 7 天保留期限”，提供【清空已过期便签】与【一键彻底清空】按钮，经二次确认弹窗后执行物理删除。；来源 question:run-65c5ee22-af96-4d2c-b6f2-d2b4e9126daf-delivery-0-question-trash-expiry-trigger-mode；日期 2026-10-04T16:34:37.917Z；适用范围 用户已确认回收区超过7天保留期限时的常驻提示横幅与确认清理机制；结果 参考证据；哈希 13764ccf62aea032a99ca9a2d83ddb33a05d5feb13024105e919dc12f639c5a4。
