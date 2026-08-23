# Project Architect V1 — Phase 1：Core Engine（本地状态引擎）交付报告

> **报告时间**：2026-08-22  
> **报告阶段**：Phase 1 — Core Engine  
> **阶段结论**：**Ready for Phase 2 — Discovery Intelligence**  
> **自动化测试结果**：8 个测试套件，18 项测试用例全部 100% 通过（Vitest）。

---

## 1. 已完成模块与核心成果

| 模块 / 分包 | 职责与交付物 | 达成标准 |
| :--- | :--- | :---: |
| **Monorepo Foundation** | `pnpm-workspace.yaml`, `tsconfig.base.json`, `package.json`, `vitest.config.ts` | ✅ 规范多包管理，独立编译，严格类型模式 |
| **`packages/contracts`** | 共享契约库：`TypedRef` 语法糖与解析器、`ProjectMetadata`、`DecisionsState`、`AssumptionsState`、`GapsState`、`QuestionsState`、`OverviewState`、`ReadinessState`、`DocumentManifest`、`DiscoveryResult`、`ErrorCode`、API DTOs | ✅ 全系统单一类型事实源，零重复类型定义 |
| **`packages/core`** | 确定性状态引擎：<br>1. `FileStorage`（本地目录结构与原子 I/O）<br>2. `StateCommitManager`（**两阶段 State Commit 与 Crash Marker 自动恢复**）<br>3. `ProjectStateEngine`（创建项目、重载、确认 Candidate、转化 Assumption、锁定/解锁 Decision、Overview 动态投影、材料管理）<br>4. `ChecklistSelector`（通用与领域 Checklist 筛选与去重）<br>5. `LightweightConflictDetector`（硬约束排他性冲突检测） | ✅ 本地 JSON 持久化，版本单调递增，无数据库依赖 |
| **`packages/agent`** | AI 编排与 Provider 适配层：<br>1. `AIProvider` 抽象接口<br>2. `AntigravityCliProvider`（基于 Benchmark 验证的 `agy.exe` 结构化子进程调用）<br>3. `MockAIProvider`（用于确定性离线与自动化测试）<br>4. `ContextManager`（Relevant Context 组装与 Token 长度预算裁剪）<br>5. `AIOrchestrator`（`discovery-turn` 编排、B2.1 宪法装配与 State 提交流程） | ✅ 单次主要调用，消费 `structured_output`，AI 失败零污染状态 |
| **`apps/server`** | 本地 Node.js/Express API 服务：<br>提供项目创建、打开、快照读取、输入上传、决定确认/锁定、Overview 编辑、AI Discovery 发起等标准 REST 接口 | ✅ 规范单向数据流与 Revision 冲突防护 |
| **Checklists 规则库** | `checklists/universal.json` 及 6 大领域专项 Checklist（`desktop-app`, `web-app`, `ai-product`, `developer-tool`, `local-first`, `utility-tool`） | ✅ 静态规则驱动，支持按标签组合 |

---

## 2. 实际工程目录结构

```text
project-architect/
├── AGENTS.md                                # 仓库自身开发顶级指导原则 (红线与约束)
├── package.json                             # 根 Monorepo 配置
├── pnpm-workspace.yaml                      # Workspace 分包定义
├── tsconfig.base.json                       # 统一 strict 编译配置
├── tsconfig.json                            # 顶层 Project References
├── vitest.config.ts                         # 统一自动化测试入口
│
├── apps/
│   └── server/                              # [Phase 1.4] 本地 API 服务
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── server.ts                    # Express 应用与 API 路由
│       │   └── index.ts                     # 入口启动与服务导出
│       └── tests/
│           └── api.test.ts                  # HTTP API 集成测试
│
├── packages/
│   ├── contracts/                           # [Phase 1.2] 共享契约包
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── refs.ts                      # TypedRef (<kind>:<id>) 定义与工具函数
│   │   │   ├── project.ts                   # ProjectMetadata, InputRef, Stage
│   │   │   ├── decisions.ts                 # DecisionItem, DecisionStatus (candidate/confirmed/locked)
│   │   │   ├── assumptions.ts               # AssumptionItem, AssumptionStatus
│   │   │   ├── gaps.ts                      # GapItem, ConflictItem, TensionItem, RiskItem
│   │   │   ├── questions.ts                 # QuestionItem, QuestionOption
│   │   │   ├── overview.ts                  # OverviewSection, Maturity, ProjectSnapshot
│   │   │   ├── readiness.ts                 # ReadinessSnapshot, ReadinessState
│   │   │   ├── documents.ts                 # DocumentManifest, CoreDocumentName
│   │   │   ├── provider.ts                  # AIProviderRequest, StructuredResult, DiscoveryResult
│   │   │   ├── errors.ts                    # ErrorCode 枚举与 ApiErrorPayload
│   │   │   ├── api.ts                       # API 请求/响应 DTOs
│   │   │   ├── checklists.ts                # ChecklistItem, MergedChecklistHint
│   │   │   ├── config.ts                    # AppRuntimeConfig 与默认参数
│   │   │   └── index.ts                     # 统一导出
│   │   └── tests/
│   │       └── refs.test.ts                 # TypedRef 单元测试
│   │
│   ├── core/                                # [Phase 1.3] 确定性核心状态引擎
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── storage/FileStorage.ts       # 本地文件读写与原子操作
│   │   │   ├── commit/StateCommitManager.ts # 两阶段 Commit 与 Marker 故障恢复
│   │   │   ├── checklists/ChecklistSelector.ts # 标签匹配、去重与预算截断
│   │   │   ├── conflicts/LightweightConflictDetector.ts # 确定性排他冲突检测
│   │   │   ├── engine/ProjectStateEngine.ts # 核心状态管理与业务逻辑
│   │   │   └── index.ts                     # 统一导出
│   │   └── tests/
│   │       ├── StateCommit.test.ts          # 两阶段 Commit 与崩溃恢复测试
│   │       ├── ProjectStateEngine.test.ts   # 项目生命周期、决策状态与锁定测试
│   │       └── ChecklistSelector.test.ts    # 规则选择与过滤测试
│   │
│   └── agent/                               # [Phase 1.5] AI 编排与 Provider 适配
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── provider/AIProvider.ts       # Provider 抽象契约
│       │   ├── provider/AntigravityCliProvider.ts # 权威 CLI Provider 实现
│       │   ├── provider/MockAIProvider.ts   # 离线与单元测试 Mock Provider
│       │   ├── context/ContextManager.ts    # 最小上下文提取与预算截断
│       │   ├── orchestrator/AIOrchestrator.ts # 统一 Discovery 调度
│       │   └── index.ts                     # 统一导出
│       └── tests/
│           └── AIOrchestrator.test.ts       # 编排与状态写入测试
│
├── checklists/                              # 静态规则库
│   ├── universal.json                       # 通用产品质量底线
│   └── types/                               # 领域专项 Checklist (desktop, web, ai, devtool, local-first, utility)
│
├── tests/                                   # 跨包端到端集成测试
│   ├── persistence-recovery.test.ts         # 进程重启/重载一致性测试
│   └── multi-turn.test.ts                   # 5 轮多轮交互状态流转测试
│
└── docs/blueprint/                          # 系统设计蓝图与规范
    ├── PHASE_1_CORE_ENGINE_PROMPT.md        # Phase 1 开发提示词归档
    └── PHASE_1_CORE_ENGINE_REPORT.md        # 本交付报告
```

---

## 3. 核心数据流说明 (Data Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户 / Frontend
    participant Server as apps/server
    participant Orch as AIOrchestrator
    participant Provider as AIProvider (Antigravity/Mock)
    participant Core as ProjectStateEngine
    participant Commit as StateCommitManager
    participant Disk as 本地文件系统 (state/*.json)

    User->>Server: 1. 发起动作 (如 POST /api/projects/:id/discovery)
    Server->>Orch: 2. 调度单次 Discovery Turn
    Orch->>Core: 3. 读取当前 ProjectSnapshot
    Orch->>Orch: 4. ContextManager 组装最小上下文 + Checklist Hints
    Orch->>Provider: 5. 发起单次调用 (B2.1 Constitution + Context + Schema)
    Provider-->>Orch: 6. 返回 StructuredResult (structured_output)
    Orch->>Core: 7. applyDiscoveryTurn(snapshot, result, expectedRevision)
    Core->>Core: 8. 校验 Locked 保护、分类映射、冲突检测
    Core->>Commit: 9. commit(targetRevision, candidateFiles)
    Commit->>Disk: 10. Phase 1: 写入 state/.commit_staging/ 与 commit_marker.json
    Commit->>Disk: 11. Phase 2: 提升至 state/*.json 并原子更新 project.json.stateRevision
    Commit->>Disk: 12. 清理 staging 与 marker
    Commit-->>Core: 13. Commit 成功
    Core-->>Orch: 14. 返回最新 ProjectSnapshot
    Orch-->>Server: 15. 返回 DiscoveryResponse
    Server-->>User: 16. 200 OK + 新 snapshot + stateRevision (单调递增)
```

---

## 4. 后端 API 接口清单 (API Endpoints)

所有接口均通过 `@project-architect/server` 暴露，遵循统一响应封套 `ApiResponse<T>`：

| 接口端点 | HTTP 方法 | 请求体说明 | 响应说明 | 状态版本影响 |
| :--- | :---: | :--- | :--- | :---: |
| `/api/health` | `GET` | 无 | 服务健康状态与时间戳 | 无 |
| `/api/projects` | `POST` | `{ name, idea, projectTags, projectPath }` | 初始化创建项目，返回 `projectId`, `projectPath`, `snapshot` | 初始化为 1 |
| `/api/projects/open` | `POST` | `{ projectPath }` | 校验故障 Marker 并重载已有项目完整快照 | 保持原版本 |
| `/api/projects/:id` | `GET` | 无 | 获取当前项目的最新 `ProjectSnapshot` | 无 |
| `/api/projects/:id/inputs` | `POST` | `{ kind, filename, content }` | 保存文件到 `inputs/`，记录抽取信息 | `+1` |
| `/api/projects/:id/decisions/confirm` | `POST` | `{ targetRef, expectedRevision }` | 用户确认 Candidate 或转化 Assumption | `+1` |
| `/api/projects/:id/decisions/lock` | `POST` | `{ decisionRef, expectedRevision }` | 显式锁定已确认的决定（防 AI 篡改） | `+1` |
| `/api/projects/:id/decisions/unlock` | `POST` | `{ decisionRef, expectedRevision }` | 用户解锁决定 | `+1` |
| `/api/projects/:id/overview/edit` | `POST` | `{ sectionId, itemRef, newStatement, expectedRevision }` | 用户直接编辑 Overview 文本并生成决定 | `+1` |
| `/api/projects/:id/discovery` | `POST` | `{ userMessage, questionAnswer, expectedRevision }` | 触发单次 B2.1 统一推理并提议状态变更 | `+1` |

---

## 5. 状态 Schema 与 Typed References 说明

### 5.1 Typed References 寻址规范
全系统彻底废弃字符串随意耦合，采用强类型前缀：
- `decision:<id>`：指向 `state/decisions.json`
- `assumption:<id>`：指向 `state/assumptions.json`
- `gap:<id>`：指向 `state/gaps.json`
- `conflict:<id>`：指向 `state/gaps.json` 的 `conflicts`
- `tension:<id>`：指向 `state/gaps.json` 的 `tensions`
- `risk:<id>`：指向 `state/risks.json`
- `question:<id>`：指向 `state/questions.json`
- `input:<id>`：指向 `project.json` 的 `inputRefs`

### 5.2 决策生命周期状态 (DecisionStatus)
- `candidate`：AI 建议，未获用户确认。
- `confirmed`：用户明确确认（`confirmedBy: 'user'`）。
- `locked`：用户显式锁定，AI 严禁覆盖。
- `superseded`：用户通过直接编辑产生新决定，原决定保留历史引用。
- `rejected`：用户明确废弃。

---

## 6. 自动化测试结果 (Test Results)

执行命令：`pnpm test`（Vitest 3.2.7，Node ES2022）：

```text
✓ packages/contracts/tests/refs.test.ts (5 tests)
  - identifies valid TypedRefs
  - rejects invalid TypedRefs
  - correctly parses valid TypedRefs
  - throws on parsing invalid TypedRef
  - creates TypedRefs reliably

✓ packages/core/tests/ChecklistSelector.test.ts (3 tests)
  - selects universal checklist hints for any project
  - merges domain checklist hints when matching tags are provided
  - filters out areas whose maturity is clear or locked

✓ packages/core/tests/StateCommit.test.ts (2 tests)
  - performs clean atomic commit and cleans staging + marker
  - recovers cleanly if crash occurred before visible project.json revision bump

✓ packages/agent/tests/AIOrchestrator.test.ts (1 test)
  - runs discovery-turn and updates project state with candidates, assumptions, and questions

✓ tests/persistence-recovery.test.ts (1 test)
  - persists project state and restores identical state after process restart

✓ tests/multi-turn.test.ts (1 test)
  - completes 5-turn flow: Idea -> Discovery -> Confirm -> Lock -> Conflict Detection

✓ apps/server/tests/api.test.ts (1 test)
  - handles project creation, state retrieval, and actions via HTTP API

✓ packages/core/tests/ProjectStateEngine.test.ts (4 tests)
  - creates project with all mandatory state files and initial Revision 1
  - supports confirming candidates and converting assumptions with revision bump
  - handles locking and unlocking decisions with state revision protection
  - rejects stale revision requests with STATE_REVISION_CONFLICT

Test Files  8 passed (8)
     Tests  18 passed (18)
  Duration  1.19s
```

---

## 7. 遇到的问题与解决方案

1. **TypeScript 严格模式下的未用变量检测**：
   - *问题*：配置了 `noUnusedLocals: true` 和 `noUnusedParameters: true`，部分中间转换参数被编译器报错。
   - *解决*：规范使用下划线前缀（如 `_gaps`、`_decisionsState`）并清理多余的导入类型。
2. **多轮流转中确定性冲突检测的正则覆盖**：
   - *问题*：初始排他性正则未包含 `pure offline` 与 `auto cloud sync` 组合。
   - *解决*：在 `LightweightConflictDetector` 中扩充了关于离线 vs 云同步、桌面 vs 移动端的特征词匹配，通过了 5 轮严苛流转测试。
3. **Vitest 多包解析路径映射**：
   - *问题*：顶层 `tests/` 目录直接跨包 import 时无法通过 node 默认解析未发布包。
   - *解决*：在 `vitest.config.ts` 中配置了标准 alias 指向各子包的 `src/index.ts`，实现秒级热编译与断言。

---

## 8. 阶段就绪度评定

```text
======================================================================
Phase 1 Status:
A — Ready for Phase 2 (Discovery Intelligence)
======================================================================
```

**结论说明**：
- 核心状态事实层（`packages/core`）已完全建立并具备极高稳定性；
- 两阶段 Commit 与崩溃自动恢复已通过测试验证；
- AI Orchestrator、Context Manager 与 Provider Adapter 已经无缝就绪；
- 单向数据流与 Revision 保护通过了 5 轮多轮交互流转验证；
- **完全具备支撑 Phase 2 深度 Discovery 推理与后续 UI 接入的能力。**
