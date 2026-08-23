# Project Architect Repository — Coding Agent Guidelines

> **适用对象**：负责参与 Project Architect 本代码仓库开发的 AI Coding Agent 及人类开发者。  
> **注意**：本文档是开发 Project Architect 软件自身的指引，不是 Project Architect 为用户项目生成的 `AGENTS.md`。

---

## 1. 唯一事实来源 (Source of Truth)

1. **技术蓝图与工程契约**：
   - 总体架构与数据模型：`docs/blueprint/01_PRODUCT_BOUNDARY.md` 至 `11_CHECKLIST_ENGINE.md`
   - 正式实现契约：`docs/blueprint/implementation/`（包含 API、Error、Contracts、Test Strategy、Config 等）
2. **冻结的 Discovery Agent**：
   - 提示词宪法：`experiments/agent-benchmark/prompts/constitution-b2-1.md`
   - 统一输出契约：`experiments/agent-benchmark/schemas/b2-unified.schema.json`
3. **权威 Provider 证据**：
   - `experiments/agent-benchmark/src/antigravity-provider.mjs`

---

## 2. 绝对不可违背的开发铁律 (Absolute Rules)

1. **保持 B2.1 冻结**：
   - 严禁修改 `constitution-b2-1.md`，严禁擅自扩展或弱化 `b2-unified.schema.json` 字段。
   - 严禁引入 Multi-Agent、角色轮流讨论或自监督流水线。
2. **严格单次调用与结构化输出**：
   - 一个用户操作对应的 `discovery-turn` 最多触发一次主要 Provider 调用。
   - 严禁通过连续发起“分析”、“找 Gap”、“提问”等多次隐蔽调用欺骗上层。
   - 状态变更必须 100% 来自 `structured_output`，严禁从自然语言文本中爬取推断。
3. **用户授权第一与状态保护**：
   - AI 结果永远只能作为建议（Candidate/Gap/Risk/Tension/Assumption）。
   - 只有用户陈述、明确回答或手动编辑才能成为 `Confirmed` 或 `Locked`。AI 严禁越权直接写入。
   - Project State（`packages/core`）是唯一的规范事实，Frontend 仅为投影与意图提交者。
4. **自用优先，拒绝过度工程化**：
   - **禁止引入数据库**（如 SQLite、PostgreSQL、Prisma、TypeORM 等），全系统采用本地文件目录 + 两阶段 State Commit。
   - **禁止引入登录系统**、账号体系、License 授权门禁、团队协作与企业权限。
   - **禁止引入云同步**与远程中心化服务。
5. **原型与正式代码隔离**：
   - 当前 `frontend/` 目录为交互原型，其内部 Mock 数据与 `setProject()` 逻辑不是正式规范。
   - 正式开发必须严格遵守 `packages/contracts` 定义的类型与单向数据流。

---

## 3. 开发阶段与推荐阅读路径

开发严格遵循以下里程碑推进（参见 `docs/blueprint/08_DEVELOPMENT_PLAN.md`）：

```text
Milestone 1: Core Engine (packages/core, packages/contracts, file I/O, commit/recovery)
     ↓
Milestone 2: AI Integration (packages/agent, context manager, provider adapter)
     ↓
Milestone 3: Workspace UI (apps/web, apps/server, API client, UI interaction)
     ↓
Milestone 4: Document Generation (document compiler, AGENTS.md & 8 core markdown docs)
```

**阅读顺序**：
1. `docs/blueprint/01_PRODUCT_BOUNDARY.md`（产品边界）
2. `docs/blueprint/02_SYSTEM_ARCHITECTURE.md`（系统总体架构）
3. `docs/blueprint/03_AGENT_RUNTIME.md`（Agent 运行机制）
4. `docs/blueprint/04_PROJECT_STATE_MODEL.md`（状态数据模型）
5. `docs/blueprint/implementation/16_SHARED_CONTRACTS.md`（共享类型契约）
6. `docs/blueprint/implementation/12_API_CONTRACT.md`（API 规范）
7. `docs/blueprint/implementation/14_TEST_STRATEGY.md`（测试策略）
