# Project Architect Repository — Coding Agent Guidelines

> **适用对象**：负责参与 Project Architect 本代码仓库开发的 AI Coding Agent 及人类开发者。  
> **注意**：本文档是开发 Project Architect 软件自身的指引，不是 Project Architect 为用户项目生成的 `AGENTS.md`。

---

## 1. 唯一事实来源 (Source of Truth)

1. **技术蓝图与工程契约**：
   - 总体架构与数据模型：`docs/blueprint/01_PRODUCT_BOUNDARY.md` 至 `11_CHECKLIST_ENGINE.md`
   - 正式实现契约：`docs/blueprint/implementation/`（包含 API、Error、Contracts、Test Strategy、Config 等）
2. **活动的 B3 Discovery Agent**：
   - 提示词宪法：`experiments/agent-benchmark/prompts/constitution-b3.md`
   - 统一输出契约：`experiments/agent-benchmark/schemas/b3-discovery.schema.json`
   - 自适应问题集规范：`docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md`（与旧文档冲突时以此为准）
3. **权威 Provider 证据**：
   - 正式适配器：`packages/agent/src/provider/AntigravityCliProvider.ts`
   - 真实能力与失败控制：`docs/validation/AGY_CAPABILITIES_2026-10-04.md`
   - `experiments/agent-benchmark/src/antigravity-provider.mjs` 保留为历史实验依据。

---

## 2. 绝对不可违背的开发铁律 (Absolute Rules)

1. **保持 B3 契约完整**：
   - B3 是唯一生产运行时；B2.1 资产只作为历史实验记录，不得重新接入运行时回退。
   - Core 强制每批最多三题；同批问题必须使用唯一 `decisionKey` 且互不依赖（历史读取兼容 `decision_key`）。
   - 允许由 PlanningRuntime 登记和调度多个 agy 任务、独立评审与自动修订；工作者不得自行启动未登记的子 Agent。
2. **可追踪的多任务与结构化输出**：
   - 一个用户操作可触发多个登记的 Provider 调用；每次调用、工具动作、重试、评审与修订必须有运行记录。
   - 不设置费用、Token、总调用数或总修订轮数门禁；并发默认四个。依据失效、取消、环境错误或连续三次无进展时暂停。
   - AI 状态建议必须来自经校验的终态 `structured_output`，严禁从自然语言输出爬取推断。用户结构化意图与审批由 Core 执行正式状态操作。
3. **用户授权第一与状态保护**：
   - AI 结果永远只能作为建议（Candidate/Gap/Risk/Tension/Assumption）。
   - 只有明确结构化答案、手动编辑或用户批准变更包才能成为 `Confirmed` 或 `Locked`。自由文本保存原文，AI 归纳待批准。AI 严禁越权直接写入。
   - Project State（`packages/core`）是唯一的规范事实，Frontend 仅为投影与意图提交者。
4. **自用优先，拒绝过度工程化**：
   - **禁止引入数据库**（如 SQLite、PostgreSQL、Prisma、TypeORM 等），全系统采用本地文件目录 + 两阶段 State Commit。
   - **禁止引入登录系统**、账号体系、License 授权门禁、团队协作与企业权限。
   - **禁止引入云同步**与远程中心化服务。
5. **原型与正式代码隔离**：
   - 当前 `frontend/` 目录为交互原型，其内部 Mock 数据与 `setProject()` 逻辑不是正式规范。
   - 正式开发必须严格遵守 `packages/contracts` 定义的类型与单向数据流。

---

## 3. 重构阶段与推荐阅读路径

2026-10-04 用户批准的重构规范为 `docs/blueprint/13_PLANNING_WORKBENCH.md`；与旧蓝图、单次调用测试或旧准备度规则冲突时以该规范为准。重构按 M0–M8 推进，保留既存未提交改动。项目自身约束不得传播成用户项目的默认约束。

当前开发按以下顺序推进；`docs/blueprint/08_DEVELOPMENT_PLAN.md` 的旧四里程碑保留为历史背景：

```text
M0 基线与规范 → M1 直接缺陷 → M2 状态与审批 → M3 agy 能力
    → M4 任务调度 → M5 三阶段设计 → M6 正式双栏 UI
    → M7 开发包 → M8 迁移、自动检查、真实能力与用户审阅
```

**阅读顺序**：
1. `docs/blueprint/13_PLANNING_WORKBENCH.md`（已批准目标、边界与实施顺序）
2. `docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md`（活动任务、提问与审批规范）
3. `packages/contracts/src/planning.ts`、`planning-schema.ts`（正式类型与输出 Schema）
4. `docs/api/PLANNING_API.md`（正式规划接口、错误与恢复行为）
5. `docs/blueprint/implementation/14_TEST_STRATEGY.md`（测试策略）
6. `docs/REFACTOR_PROGRESS.md`、`docs/validation/REFACTOR_ACCEPTANCE_2026-10-04.md`（实施与验收边界）
7. 按需读取 `01_PRODUCT_BOUNDARY.md`、`02_SYSTEM_ARCHITECTURE.md`、`03_AGENT_RUNTIME.md`、`04_PROJECT_STATE_MODEL.md` 的兼容背景，冲突以新规范为准。
