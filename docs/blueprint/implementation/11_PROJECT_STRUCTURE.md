# Project Architect V1：正式代码仓库结构与职责定义

> 文档状态：Phase 0 Engineering Blueprint  
> 范围：正式开发的目标代码仓库布局（Monorepo）、各分包职责与历史资产边界。  
> 注意：Phase 0 不进行物理文件大搬家，本文件定义未来开发的标准工程骨架。

---

## 1. 目标仓库架构 (Monorepo Layout)

Project Architect 采用轻量清晰的 pnpm/npm workspace 结构组织代码：

```text
project-architect/
├── AGENTS.md                       # 本代码仓库自身开发的 Coding Agent 指南
├── package.json                    # 根工程配置与 Monorepo Scripts
├── pnpm-workspace.yaml             # Workspace 分包定义
│
├── apps/
│   ├── web/                        # [正式] React 19 前端应用 (三栏 Workspace + Home)
│   └── server/                     # [正式] 本地 Node.js Backend API 服务 (轻量协调器)
│
├── packages/
│   ├── contracts/                  # [正式] 唯一共享契约库 (TS Types, Schemas, DTOs, Enums)
│   ├── core/                       # [正式] 确定性核心引擎 (State Engine, Storage, Commit, Checklist)
│   └── agent/                      # [正式] AI 编排与 Provider 适配器 (B3, Context, Adapter)
│
├── checklists/                     # [正式] 静态规则库 (universal.json & types/*.json)
│   ├── universal.json
│   └── types/
│
├── docs/
│   └── blueprint/                  # 系统技术蓝图与工程设计文档
│       └── implementation/
│
├── experiments/
│   └── agent-benchmark/           # B3 活动基准与 B2.1 历史实验证据
│
├── prototypes/
│   └── frontend-ui/                # [原型] 原 frontend/ 目录 (作为交互与视觉设计参考)
│
└── tests/                          # [测试] 跨包集成测试与端到端多轮流转测试
```

---

## 2. 各目录与子分包详细职责

### 2.1 `packages/contracts`（共享契约包）
- **职责**：全系统的唯一数据与类型事实源。所有跨进程/跨包数据流动必须引用此包。
- **内容**：
  - TypeScript 类型定义（`ProjectState`, `Decision`, `Gap`, `Readiness`, `TypedRef` 等）。
  - JSON Schema 文件与运行时校验工具（如 `ajv` 校验器）。
  - API 请求/响应 DTO 接口与标准错误码（`ErrorCode`）。
  - 共享枚举（`Stage`, `ItemStatus`, `ImportanceLevel`, `UserDisposition`）。
- **依赖限制**：零内部包依赖，仅依赖轻量 Schema 库。

### 2.2 `packages/core`（确定性核心引擎包）
- **职责**：负责所有无 AI 参与的确定性状态管理、文件 I/O、两阶段 Commit 与规则投影。
- **内容**：
  - `ProjectStateEngine`：状态读写、合法状态迁移、Locked 保护、用户授权审计。
  - `FileStorage`：本地项目目录创建、`inputs/` 文件存储与提取结果管理。
  - `StateCommitManager`：两阶段 Commit Marker 写入、原子更新 `stateRevision` 与启动故障回滚。
  - `ChecklistSelector`：根据项目 Tags 进行 Checklist 合并、去重与优先级截断。
  - `OverviewProjector`：基于 `state/decisions.json` 动态投影生成面向用户的 Overview 结构。
- **依赖限制**：依赖 `packages/contracts`。严禁调用 Provider 或 AI 模块。

### 2.3 `packages/agent`（AI 编排与适配包）
- **职责**：负责 AI 任务编排、最小上下文组装、统一 Provider 适配与结构化解析。
- **内容**：
  - `Active Assets`：生产运行时引用 B3 Constitution 与 `b3-discovery.schema.json`；B2.1 资产只读归档。
  - `ContextManager`：Relevant Context Selection 算法、任务级上下文裁剪与 Token 预算控制。
  - `AIOrchestrator`：`discovery-turn`、`readiness-review`、`document-plan` 的单次调度器。
  - `ProviderLayer`：统一 Provider 抽象接口及 Antigravity CLI Adapter 实现。
- **依赖限制**：依赖 `packages/contracts`。不直接落盘状态文件。

### 2.4 `apps/server`（本地 Backend 服务）
- **职责**：作为本地守护进程/HTTP/IPC 服务，负责 Frontend 与 Core/Agent 之间的请求路由与协调。
- **内容**：
  - 轻量 API 路由（Projects、Inputs、State Actions、Discovery、Readiness、Documents）。
  - 任务调度与调用诊断日志捕获。
- **依赖限制**：依赖 `packages/contracts`, `packages/core`, `packages/agent`。

### 2.5 `apps/web`（正式前端应用）
- **职责**：为个人开发者提供安静、高效、高可信的三栏构思工作台。
- **内容**：
  - 基于 React 19 + Tailwind CSS + Lucide Icons 构建。
  - 消费 `packages/contracts` 中的统一类型。
  - 仅通过 API 与 Backend 通信，不直接操作底层文件系统。
- **依赖限制**：依赖 `packages/contracts`。

---

## 3. 历史资产与外部目录说明

1. **`experiments/agent-benchmark/`**：
   - **性质**：权威实验资产库。包含 B3 Constitution、14 个测试 Case、评测脚本及历史 B2.1 报告。
   - **保护规则**：不可删除、不可修改既有 Prompt 与历史报告，作为未来任何 Prompt 回归的基准。
2. **`antigravity-provider-poc/`**：
   - **性质**：早期概念验证代码与历史记录。已被后续 `experiments/agent-benchmark/src/antigravity-provider.mjs` 的成功运行证据所取代。
   - **处理方式**：保留作为历史参考，在正式开发中直接采用 `experiments` 中验证成熟的 Provider Adapter 模式。
3. **`chatgpt-private-mcp/`**：
   - **性质**：非 Project Architect 产品代码。
   - **处理方式**：明确置于 Project Architect 工程范围之外，后续开发不予引用。
