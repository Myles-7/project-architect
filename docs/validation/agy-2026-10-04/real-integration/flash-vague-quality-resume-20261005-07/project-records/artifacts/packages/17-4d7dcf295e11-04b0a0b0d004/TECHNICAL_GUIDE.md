# 真实集成验证-flash-vague-20261004-03 — 技术与接口

版本：17；批准蓝图：4d7dcf295e11c188d49f91f29fcf74571f2f7b64784572d0b63310b67003d4cd

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

## 系统核心模块划分与职责边界规范

ID：module-system-decomposition；关联需求：block-scope-core-boundaries、page-main-workspace；依赖：tech-core-architecture

### 模块划分与职责解耦设计
系统划分为高内聚、低耦合的六大核心服务与展现模块：

1. **存储驱动服务模块 (`StorageService`)**：
   - **职责**：基于 Dexie.js 封装 IndexedDB 数据库连接、版本升级、对象仓库 CRUD、事务原子性保证，封装 `StorageManager.estimate()` 配额感知与 `StorageManager.persist()` / `persisted()` 持久化授权探测。
   - **边界**：纯数据访问层，不包含 UI 状态或特定业务逻辑；发生底层配额超限或数据库锁冲突时抛出强类型受控错误。
2. **便签领域业务模块 (`NoteService`)**：
   - **职责**：处理便签核心业务逻辑，包括便签提交校验、正文 `#标签` 智能提取、便签生命周期流转（置顶、加星收藏、归档、软删除与撤销）、标签全局批量重命名。
   - **边界**：协调 `StorageService` 进行事务写入，并在操作成功后向状态总线分发变更事件，同步递增未备份变更计数器。
3. **即时检索与高亮引擎 (`SearchEngine`)**：
   - **职责**：维护内存搜索索引缓存，执行带防抖的关键字分词、模糊匹配算法、多标签交集（AND）组合过滤，并生成关键词黄色高亮标记。
   - **边界**：纯计算无副作用模块，输入查询词与便签列表，输出过滤后便签及高亮位置元数据。
4. **备份管理与数据便携模块 (`BackupManager`)**：
   - **职责**：执行全量便签数据序列化打包与 JSON / Markdown 导出下载触发（Markdown 导出包含 YAML FrontMatter 元数据头）；解析并严格校验外部导入的备份文件 Schema；执行智能增量合并（基于 ID 与时间戳比对）或全量覆盖事务；维护 `lastBackupAt` 与 `unbackedChangesCount` 状态；监测无痕隐身环境与长周期未备份状态。
   - **边界**：保证导入导出的数据原子性，发生错误时自动回滚，不破坏现有本地数据。
5. **Markdown 安全解析与渲染模块 (`MarkdownRenderer`)**：
   - **职责**：采用 marked + DOMPurify 将纯文本便签内容编译为带结构的 HTML，集成白名单过滤防范 XSS，支持 GFM 任务清单复选框交互与 Prism.js 代码块语法高亮。
   - **边界**：提供可复用的渲染组件与工具函数，隔绝未经消毒的第三方字符串。
6. **主工作区交互与展现模块 (`WorkspaceUI`)**：
   - **职责**：包含顶部操作栏、左侧标签云与备份状态区、快速捕获录入卡片、卡片流式主展区及详情模态弹窗；响应键盘全局快捷键（`N` 聚焦捕获、`/` 聚焦搜索、`Ctrl+Enter` 提交、`Esc` 退出）；处理隐身模式温和提示横幅与持久化授权状态反馈。
   - **边界**：通过 React Hook 与 useLiveQuery 消费各服务层能力，管理组件内部交互状态（如骨架屏加载、草稿保留、悬浮反馈）。

来源：evidence-react-official、evidence-vite-official、evidence-indexeddb-spec、evidence-mdn-storage-persist-api；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

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

## 客户端持久化数据模型与实体关系架构

ID：data-model-core-entities；关联需求：feature-quick-capture、feature-note-card-view、feature-data-portability；依赖：tech-storage-and-search

### 客户端持久化数据模型与实体关系架构

1. **便签实体定义 (`Note`)**：
```typescript
export type NoteStatus = 'active' | 'archived' | 'deleted';

export interface Note {
  id: string;               // 唯一主键，UUID v4 格式，如 "550e8400-e29b-41d4-a716-446655440000"
  content: string;          // 便签正文纯文本，包含行内 Markdown 语法与标签，建议上限 100,000 字符
  tags: string[];           // 标签名称数组，去除 "#" 前缀，元素去重，单标签字符长度 1~20
  isPinned: boolean;        // 是否置顶展示，默认 false
  isFavorite: boolean;      // 是否加星收藏，默认 false
  status: NoteStatus;       // 生命周期状态：活跃(active)、已归档(archived)、软删除(deleted)
  createdAt: number;        // 创建时间戳（毫秒级整型，Date.now()），生成后不可变更
  updatedAt: number;        // 最后修改时间戳（毫秒级整型），任何正文、标签或状态变动时更新
  deletedAt: number | null; // 软删除移入回收暂存池时间戳，活跃/归档状态时为 null
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

// 备份追踪器元数据结构 (依据已确认决策 dec-b17f49d8-86c3-4a74-baee-856b5d753129 与防驱逐策略)
export interface BackupTrackerMeta {
  lastBackupAt: number;          // 上次成功导出备份的时间戳
  unbackedChangesCount: number;  // 距上次导出以来累计未备份变更次数（新增/编辑/归档/删除均 +1）
  isPrivateModeDetected: boolean;// 是否检测到处于无痕隐身模式
}

// 存储持久化元数据结构
export interface StorageStatusMeta {
  isPersisted: boolean;          // 是否获得 navigator.storage.persist() 持久化许可
  lastCheckedAt: number;         // 上次检测时间戳
}

// 用户偏好元数据结构
export interface UserPreferencesMeta {
  viewMode: 'grid' | 'compact';  // 便签流布局：瀑布流卡片或紧凑列表
  theme: 'system' | 'light' | 'dark';
}
```

3. **外部备份文件传输契约 (`BackupPayload`) 与 Markdown 导出规范**：
```typescript
export interface BackupPayload {
  app: 'SparkNotes';             // 固定应用标识符
  schemaVersion: 1;              // 备份协议版本号
  exportedAt: string;            // ISO 8601 标准时间字符串，如 "2026-10-04T15:30:00.000Z"
  notesCount: number;            // 包含的便签总记录数
  notes: Note[];                 // 便签完整数据数组
}

// 单条便签导出的 Markdown 格式规范（包含 FrontMatter）
// ---
// id: 550e8400-e29b-41d4-a716-446655440000
// tags: [前端, React]
// pinned: false
// favorite: true
// createdAt: 2026-10-04T15:30:00.000Z
// updatedAt: 2026-10-04T15:35:00.000Z
// ---
// 便签正文 Markdown 内容...
```

4. **实体状态机流转与约束规范**：
- **创建**：初始状态为 `status = 'active'`, `isPinned = false`, `isFavorite = false`, `deletedAt = null`。
- **置顶切换**：`isPinned` 取反，`updatedAt = Date.now()`。
- **收藏切换**：`isFavorite` 取反，`updatedAt = Date.now()`。
- **归档**：`status = 'archived'`, `updatedAt = Date.now()`。
- **软删除**：`status = 'deleted'`, `deletedAt = Date.now()`, 开启 5 秒防误触撤销计时。
- **撤销删除**：`status = 'active'`, `deletedAt = null`，恢复原列表顺序。
- **彻底清除**：倒计时结束后或用户确认清空时，从 IndexedDB 执行物理主键删除。

来源：evidence-indexeddb-spec、evidence-file-api、evidence-typescript、evidence-mdn-blob-spec；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

## 模块服务接口、契约定义与数据流转规范

ID：interface-service-contracts；关联需求：feature-quick-capture、feature-search-filter、feature-data-portability、feature-note-detail-edit；依赖：module-system-decomposition、data-model-core-entities

### 核心服务契约与接口定义

1. **存储服务接口 (`IStorageService`)**：
```typescript
export interface IStorageService {
  // 数据库生命周期
  init(): Promise<void>;
  close(): Promise<void>;

  // 持久化保护与配额
  requestPersistence(): Promise<boolean>;                 // 调用 StorageManager.persist()
  isPersisted(): Promise<boolean>;                        // 调用 StorageManager.persisted()
  getStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }>;

  // 便签 CRUD 操作
  getNoteById(id: string): Promise<Note | null>;
  listNotes(filter?: {
    status?: NoteStatus;
    isFavorite?: boolean;
    isPinned?: boolean;
    tags?: string[];
  }): Promise<Note[]>;
  saveNote(note: Note): Promise<void>;                     // 写入单条，自动更新 updatedAt
  deleteNote(id: string, hard?: boolean): Promise<void>;  // hard=false 为软删除，hard=true 为物理删除
  restoreNote(id: string): Promise<void>;                 // 撤销恢复软删除便签

  // 批量操作
  batchUpdateTags(oldTag: string, newTag: string): Promise<{ affectedCount: number }>; // 事务级批量重命名标签
  batchImportNotes(notes: Note[], mode: 'merge' | 'overwrite'): Promise<{ inserted: number; updated: number }>;
  clearAllData(): Promise<void>;

  // 元数据管理
  getMeta<T>(key: string): Promise<T | null>;
  setMeta<T>(key: string, value: T): Promise<void>;
}
```

2. **检索服务接口 (`ISearchService`)**：
```typescript
export interface SearchQueryOptions {
  query: string;               // 搜索文本，支持正文关键词与 "#tag" 过滤
  activeStatus?: NoteStatus;   // 状态过滤，默认为 'active'
  activeTags?: string[];       // 选中的标签交集过滤列表
  onlyFavorites?: boolean;     // 是否仅筛选已收藏便签
}

export interface SearchHit {
  note: Note;
  matchedFields: ('content' | 'tags')[];
  highlightedContent: string;  // 安全的 HTML 字符串，命中的关键字被 <mark class="highlight"> 包裹
}

export interface ISearchService {
  setIndexSource(notes: Note[]): void;                    // 更新内存索引镜像
  search(options: SearchQueryOptions): {
    results: SearchHit[];
    totalMatched: number;
    searchDurationMs: number;
  };
}
```

3. **备份服务接口 (`IBackupService`)**：
```typescript
export interface IBackupService {
  // 导出
  exportJsonBackup(): Promise<{ blob: Blob; fileName: string; count: number }>;
  exportMarkdownBundle(): Promise<{ blob: Blob; fileName: string; count: number }>; // 导出带 FrontMatter 的 Markdown 整合包

  // 导入与校验
  validateBackupFile(rawJsonText: string): {
    valid: boolean;
    errorReason?: string;
    payload?: BackupPayload;
  };
  executeImport(payload: BackupPayload, mode: 'merge' | 'overwrite'): Promise<{
    success: boolean;
    insertedCount: number;
    updatedCount: number;
  }>;

  // 状态感知
  checkBackupReminderNeeded(tracker: BackupTrackerMeta): boolean; // 变更超20条或超7天
  detectPrivateMode(): Promise<boolean>;                          // 隐身模式检测
}
```

4. **Markdown 解析服务接口 (`IMarkdownService`)**：
```typescript
export interface IMarkdownService {
  renderToSafeHtml(markdownText: string): string; // 解析 Markdown 并经由 DOMPurify 白名单消毒
  extractTagsFromText(text: string): string[];    // 正则提取正文中的 "#标签" 列表
}
```

来源：evidence-indexeddb-spec、evidence-file-api、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-mdn-blob-spec；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

## 全局错误类型体系、降级策略与状态恢复机制

ID：error-architecture-and-recovery；关联需求：feature-quick-capture、feature-note-card-view、feature-data-portability、feature-note-detail-edit；依赖：interface-service-contracts

### 全局错误体系、降级策略与状态保留规范

1. **结构化受控错误字典 (`AppError` 层次体系)**：
   - `StorageQuotaExceededError`（配额超限错误）：
     - **触发条件**：IndexedDB 写入时抛出 `QuotaExceededError` 或 StorageManager 检测到已使用配额超过 95%。
     - **状态保留与恢复**：快速捕获输入框或详情编辑弹窗**绝不清空用户正在编辑的文字**；弹窗保持开启，按钮恢复可点击态；页面顶部浮出琥珀色醒目警示横幅：“本地存储空间已满，无法写入新内容，请立即导出 JSON 备份以释放空间”；提供一键导出快捷操作。
   - `StoragePersistenceDeniedWarning`（持久化授权被拒或不受支持）：
     - **触发条件**：浏览器安全策略拒绝 `navigator.storage.persist()`，或运行于非 HTTPS 环境。
     - **状态保留与恢复**：应用正常降级使用非持久化配额（best-effort），不阻断读写；侧边栏提示点在达到“超20条未备份或超7天”时正常工作，且在数据设置面板注明“当前运行在临时配额模式，请保持定期导出备份以防浏览器清理”。
   - `PrivateBrowsingModeWarning`（无痕隐身模式状态）：
     - **触发条件**：探测到浏览器处于隐身/无痕模式（如配额远低于常规或临时内存模式）。
     - **状态保留与恢复**：页面顶部轻量横幅提示：“您当前处于无痕浏览模式，标签页关闭后本地数据可能被浏览器清除，建议在关闭前导出备份”；横幅支持用户一键关闭，不阻断核心操作。
   - `DatabaseLockOrUpgradeError`（数据库锁与版本冲突错误）：
     - **触发条件**：多标签页并发访问导致数据库升级被阻止或事务锁死。
     - **状态保留与恢复**：系统在 1 秒后自动执行一次指数退避重试；若重试仍失败，弹出非模态 Toast 提示：“检测到其他标签页正在更新存储，请关闭多余页面后刷新重试”。
   - `BackupValidationError`（备份文件解析与校验失败）：
     - **触发条件**：上传的文件非合法 JSON、缺少 `schemaVersion`、`notes` 数组缺失或单条记录缺少必填字段（`id`, `content`, `createdAt`）。
     - **状态保留与恢复**：**严禁向数据库写入任何脏数据**，本地现有数据保持原样不被污染；弹窗展示明确红色错误文案（如“导入失败：第 15 条记录缺少有效 id 字段”），用户点击重试可重新选择有效文件。
   - `TransactionRollbackError`（批量操作事务中断）：
     - **触发条件**：标签全局批量重命名或增量合并导入过程中途发生异常。
     - **状态保留与恢复**：底层 IndexedDB 读写事务自动回滚（Rollback），未完成的局部修改彻底撤销，关联便签全部保持修改前的标签名称，界面提示“操作已安全回滚，未对既有便签产生修改”。
   - `ClipboardPermissionError`（剪贴板访问受阻）：
     - **触发条件**：浏览器安全上下文不支持 `navigator.clipboard` 或用户拒绝剪贴板写入权限。
     - **状态保留与恢复**：无缝降级为调用传统 `document.execCommand('copy')` 方案；若仍被拦截，临时弹出全选文本框并高亮文本，提示用户手动按 `Ctrl/Cmd + C` 复制。

2. **明确的失败后行为承诺矩阵**：
   - **快速捕获提交失败**：输入框保留原文本，光标不丢失，单行展开状态维持，按钮恢复可点击。
   - **便签卡片编辑失败**：详情弹窗禁止自动退出，保留当前修改草稿于内存，弹出“保存失败，请检查空间或重试”。
   - **软删除撤销超时写入失败**：便签从回收池平滑还原至原列表位置，Toast 提示“删除同步失败，便签已恢复显示”，绝不丢弃数据。
   - **全量覆盖导入失败**：必须在原数据导出临时快照后执行清空；若写入中断，立即使用快照回滚还原原有数据。
   - 绝不使用“永不丢失”“100%保证”等无证据绝对化用语，一切以事务隔离与输入框状态保留机制为技术准则。

来源：evidence-indexeddb-spec、evidence-storage-estimate、evidence-mdn-storage-persist-api、evidence-mdn-storage-eviction-policy；批准操作：api-automated-acceptance-flash-vague-resume-20261005-06-technical-1791130874890

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
