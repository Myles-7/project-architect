# Project Architect — 前端 Mock 迁移与真实 API 对接计划
# (Frontend Mock Removal & Real API Migration Plan)

> **文档状态**：已冻结 (Phase 4.9.4 Specification)  
> **适用对象**：负责将 `frontend/` 原型资产迁移至正式前端应用（`apps/web`）的前端工程师与 AI Agent。  
> **权威依据**：`docs/api/API_V1.md`、`packages/contracts/src/views.ts` 与 `packages/contracts/src/api.ts`。

---

## 1. 核心迁移原则与数据流铁律 (Core Invariants)

1. **单向数据流与派生视图**：
   - **Project State 是唯一事实来源（SSOT）**。前端视图模型（Read Model）纯为只读派生投影，前端严禁在本地维护第二份持久化状态。
2. **严禁本地篡改状态权威**：
   - 前端**绝不能在本地直接制造或修改** `Confirmed` 决策、`Locked` 约束、`Readiness` 评分或 `Approved` 准入状态。
   - 所有变更必须以结构化意图（Intent Request，携带必填的 `expectedRevision`）发送至后端 API，由后端原子快照引擎完成校验并返回最新状态版本。
3. **正式应用归属 (`apps/web`)**：
   - `frontend/` 目录为早期的交互原型与视觉参考资产。正式的前端工程将位于 `apps/web/`，直接依赖 `@project-architect/contracts`，逐步替换 Mock 数据。在迁移验收通过前，**严禁提前删除或破坏 `frontend/` 原型代码**。

---

## 2. Mock 文件清单与真实 API 来源映射 (Mock-to-API Mapping)

| 原型 Mock 文件 | 包含的主要 Mock 数据 | 未来真实数据来源 (API Endpoint & DTO) | 触发的变更意图 (Mutating Intents) |
| :--- | :--- | :--- | :--- |
| **`mockProjects.ts`** | `MOCK_RECENT_PROJECTS`<br>最近项目列表卡片 | `GET /api/projects`<br>➡️ `ListRecentProjectsResponse`<br>`GET /api/projects/:id`<br>➡️ `ProjectSnapshot` | - `POST /api/projects` (创建新项目)<br>- `POST /api/projects/open` (打开指定项目) |
| **`mockOverview.ts`** | `INITIAL_OVERVIEW_SECTIONS`<br>Overview 各 Section 与决策项 | `GET /api/projects/:id/overview`<br>➡️ `ProjectOverviewView` | - `POST /api/projects/:id/overview/edit`<br>- `POST /api/projects/:id/decisions/confirm`<br>- `POST /api/projects/:id/decisions/lock`<br>- `POST /api/projects/:id/decisions/unlock` |
| **`mockReadiness.ts`** | `INITIAL_READINESS_DATA`<br>完备度状态、雷达指标、Issues | `GET /api/projects/:id/readiness`<br>➡️ `ReadinessView` | - `POST /api/projects/:id/readiness/review`<br>- `POST /api/projects/:id/readiness/approve` |
| **`mockDocuments.ts`** | `MOCK_DOCUMENTS`<br>9 篇 Markdown 文档结构与内容 | `GET /api/projects/:id/documents`<br>➡️ `DocumentListView`<br>`POST /api/projects/:id/documents/read`<br>➡️ `ReadDocumentResponse` | - `POST /api/projects/:id/documents/generate` (编译生成全套 Markdown) |
| **`mockTimeline.ts`** | `INITIAL_TIMELINE_MESSAGES`<br>推演消息、审计流、分析卡片 | `GET /api/projects/:id/timeline`<br>➡️ `TimelineView` | - `POST /api/projects/:id/discovery` (执行单轮推演，单次 Provider 调用) |
| **`mockQuestions.ts`** | `PRIMARY_GAP_QUESTION`<br>`SECONDARY_GAP_QUESTION` | `GET /api/projects/:id`<br>➡️ `snapshot.questions.items` | - `POST /api/projects/:id/questions/answer` (提交问题回答与审计追踪) |

---

## 3. 分阶段替换顺序 (Phased Migration Roadmap)

为了保证系统平稳渐进演进，前端对接必须严格按以下 8 个阶段顺序执行：

```
Step 1: API Client SDK
   │
   ▼
Step 2: Home Page & Recent Projects
   │
   ▼
Step 3: Project Overview Panel & Mutation Actions
   │
   ▼
Step 4: Chat / Discovery Turn & Question Answering
   │
   ▼
Step 5: Files & Input Materials Upload
   │
   ▼
Step 6: Readiness Review & Approval Gate
   │
   ▼
Step 7: Document Compilation, Stale Detection & Viewer
   │
   ▼
Step 8: Timeline / Activity History
```

### 阶段 1：API Client SDK 封装 (`apps/web/src/api`)
- 封装标准 TypeScript HTTP 客户端，基于 Fetch API。
- 自动处理统一 `ApiResponse<T>` 响应解包。
- 维护当前活跃项目的 `currentRevision`，并在发起写请求时自动填充 `expectedRevision`。
- 全局捕获 `409 Conflict`、`422 Unprocessable`、`502/504 Provider Error` 并抛出强类型错误。

### 阶段 2：首页与项目恢复 (Home Page & Projects)
- **目标**：首页“输入 Idea 创建项目”与“最近项目卡片”完全对接真实接口。
- **调用**：`GET /api/projects` 获取列表；`POST /api/projects` 创建新项目；`POST /api/projects/open` 打开已有项目。
- **UI 状态**：实现项目加载 Skeleton 骨架屏、空列表 Empty State、网络错误重试提示。

### 阶段 3：Overview 看板与决策操作 (Overview Panel)
- **目标**：右侧看板从 `mockOverview.ts` 切换为消费 `GET /api/projects/:id/overview`。
- **交互**：
  - 点击“确认推荐” ➡️ 调用 `POST /api/projects/:id/decisions/confirm`；
  - 点击“锁定约束” ➡️ 调用 `POST /api/projects/:id/decisions/lock`；
  - 手动编辑表述 ➡️ 调用 `POST /api/projects/:id/overview/edit`；
- **版本更新**：操作成功后，利用后端返回的最新 `snapshot` 或 `ProjectOverviewView` 更新界面并自增 `stateRevision`。

### 阶段 4：中栏对话、单轮推演与问题交互 (Chat & Discovery)
- **目标**：中栏对话流对接真实 Discovery 运行时。
- **调用**：
  - 发送消息 ➡️ 调用 `POST /api/projects/:id/discovery`，展示加载动效（等待单次 Provider 响应）；
  - 回答单选/自由输入澄清问题 ➡️ 调用 `POST /api/projects/:id/questions/answer`。
- **安全拦截**：若后端返回 `502/504`，展示温和重试卡片，严禁白屏崩溃。

### 阶段 5：材料上传与提取管理 (Files & Materials)
- **目标**：左侧 Files 标签对接输入材料管理。
- **调用**：`POST /api/projects/:id/inputs`。
- **约束保障**：前端在选择文件时提前校验 20MB 文件大小与 10 个文件上限；图片诚实展示“不可视觉分析”状态提示。

### 阶段 6：完备度评估与用户批准门禁 (Readiness Review & Approval)
- **目标**：Readiness 标签页消费 `GET /api/projects/:id/readiness`。
- **交互**：
  - 点击“开始完备度评估” ➡️ 调用 `POST /api/projects/:id/readiness/review`；
  - 用户审阅后点击“批准生成” ➡️ 调用 `POST /api/projects/:id/readiness/approve`（携带 `disposition: "approved"` 与已知问题确认）；
  - 用户点击“退回补充” ➡️ 调用 `POST /api/projects/:id/readiness/approve`（携带 `disposition: "returned-to-discovery"`）。

### 阶段 7：文档编译器交付物与 Markdown 预览 (Documents Center)
- **目标**：Documents 标签页消费 `GET /api/projects/:id/documents` 与 `POST /api/projects/:id/documents/read`。
- **交互**：
  - 点击“编译生成开发文档包” ➡️ 调用 `POST /api/projects/:id/documents/generate`；
  - 若未获批准调用则妥善捕获 `422` 并提示用户先完成 Readiness 审批；
  - 点击文档列表项 ➡️ 读取并渲染 Markdown 正文与 Mermaid 架构图；
  - 当项目状态更新后，文档卡片自动根据 `isStale: true` 展示“文档已过期，需重新编译”角标。

### 阶段 8：活动时间线与审计追踪 (Timeline View)
- **目标**：消费 `GET /api/projects/:id/timeline`。
- **呈现**：以时间流形式清晰展现项目从创建、材料添加、推演、问题回答到文档编译的完整演进记录。

---

## 4. 页面验收条件与 Mock 删除门槛 (Acceptance Criteria & Removal Gates)

在正式移除某个 Mock 数据文件或将其置为完全废弃前，必须严格满足以下全部门槛：

```
[ Mock Removal Gate Checklist ]
 1. [ ] 对应的后端真实 API Endpoint 已经实现并通过自动化契约测试。
 2. [ ] 前端组件已完备处理以下 4 种状态：
        - 加载中态 (Loading / Skeleton)
        - 空数据态 (Empty State)
        - 异常错误态 (Error Banner / Retry)
        - 乐观锁冲突态 (409 Conflict Modal / Reload Snapshot)
 3. [ ] 完整的用户交互流（操作 ➔ API 发送 ➔ State 更新 ➔ UI 刷新）已通过自动化或端到端验证。
 4. [ ] 界面视觉无退化：保持 Linear 风格低饱和暖中性色（Warm Neutral）、无多余花哨动效。
```

### 各页面验收标准

| 页面 / 组件 | 验收条件 (Acceptance Criteria) |
| :--- | :--- |
| **首页 (Home)** | 1. 成功从后端拉取最近项目列表，卡片展示名称、更新时间与阶段；<br>2. 输入 Idea 提交后，能成功在本地工作区创建目录，并跳转进入 Workspace；<br>3. 服务端不可达时，显示本地服务离线提示。 |
| **Overview 看板** | 1. 准确展示各 Section 成熟度标签（Unexplored / Mostly-Clear / Clear / Locked）；<br>2. 点击确认/锁定按钮后，能即时向后端发起请求并根据响应刷新徽章；<br>3. 遇到 `409 Conflict` 时弹出提示并拉取最新状态。 |
| **Chat 推演工作流** | 1. 发送输入能正确触发单次 Provider 调用，并按 9 大数组结构化结果渲染候选卡片；<br>2. 提问卡片支持点击选项与自由文本输入，提交后生成审计 Trace。 |
| **Readiness 评审** | 1. 正确展示 Level 1~5 评级与核心维度满足情况；<br>2. 存在未确认的 Critical Conflict 时，显式提示阻断；<br>3. 只有用户提交 Approved 处置后，才点亮“生成文档”按钮。 |
| **Documents 交付物** | 1. 生成成功后，能列出 9 篇核心 Markdown 规范文档清单；<br>2. 点击任意文档可安全读取并完整渲染正文；<br>3. 状态前进后，文档列表中显式出现 Stale 提醒。 |

---

## 5. 迁移计划签署 (Sign-off)

- **迁移目标应用路径**：`apps/web/`
- **原型参考路径**：`frontend/` (保持现状，不做破坏性变更)
- **执行规范**：严格遵循 `docs/api/API_V1.md` 契约与本迁移计划推进。
