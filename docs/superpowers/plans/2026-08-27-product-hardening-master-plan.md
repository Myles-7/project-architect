# Project Architect Product Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Project Architect 从“可用 Beta”提升为状态语义一致、用户输入不丢失、AI 建议可追溯、问题真正可回答、准备度可信、文档可安全交付的本地产品。

**Architecture:** 继续采用单 Agent、单次主要 Provider 调用、结构化输出、本地文件状态和两阶段提交。先用统一领域注册表消除 Gap、Question、Decision、Overview、Readiness 与 Document Compiler 的语义分叉，再建立持久化 Discovery Turn 和引用式状态转换，最后在稳定契约上完成问题质量、项目安全、响应式体验、性能与质量基准。

**Tech Stack:** TypeScript 5、React 19、Vite 6、Express 4、Vitest 3、pnpm workspace、本地 JSON/Markdown 文件、Antigravity CLI Provider。

---

## 1. 报告用途与执行规则

本报告依据 2026-08-27 的代码审计、浏览器实测、全量构建和测试结果编写。执行者应把它视为跨阶段总计划，而不是一次性大改提示词。

执行规则：

1. 每次只实施一个阶段。当前阶段未通过验收，不得进入下一阶段。
2. 不覆盖用户工作区中的未提交修改；开始前必须运行 `git status --short`，逐文件合并。
3. B3 是唯一生产 Discovery 契约；B2.1 资产只保留为历史证据。
4. 一个 `discovery-turn` 最多一次主要 Provider 调用。
5. AI 只能创建 Candidate、Assumption、Gap、Risk、Tension 与 Question；不得直接创建 Confirmed 或 Locked 决策。
6. 用户输入、回答、手动编辑必须先持久化，再启动 AI 任务。
7. Locked 决策不能被 AI、迁移、文档编译或后台任务覆盖。
8. 不引入数据库、账号、登录、云同步、团队权限或 Multi-Agent。
9. 所有状态变更来自结构化数据或显式用户操作，不从自然语言展示文本反向解析。
10. 每个阶段先写失败测试，再实现，再执行定向测试、全量构建和低并发全量测试。

推荐分支命名：`codex/product-hardening-phase-N`。

## 2. 当前基线

审计时基线：

- Workspace build：通过。
- Vitest：80 个测试文件、268 项测试通过。
- 回答问题：可立即落盘，实测 revision 从 2 增加到 3。
- B3 中文真实样本：单次约 43,993ms，总 Token 53,176，`cache_read_tokens` 16,322。
- 当前最终中文可读性报告只覆盖 `case-01`，人工相关性、决策价值、独立可回答性评分为空。
- 390px 窄屏下左右栏同时存在，主内容不可使用。

完成全部阶段后，以上数据只能作为旧基线，不得继续作为发布结论。

## 3. 审计问题追踪表

| ID | 问题 | 风险 | 归属阶段 |
|---|---|---|---|
| A01 | Overview、Readiness、Gap 使用不同领域 ID | 决策丢失、成熟度错误、文档漏写 | 1 |
| A02 | 四项创建引导被合并为一个 `project_overview` 决策 | 已输入信息仍被重复提问 | 1 |
| A03 | `trust_safety` 等决策没有 Overview 投影 | 确认数量增加但用户找不到内容 | 1 |
| A04 | Candidate 默认写入 `mvp_scope`，Assumption 默认写入 `technical_boundary` | 用户授权语义被破坏 | 2 |
| A05 | 自由输入先清空，只保存在内存 Job | 调度失败或重启时丢失用户输入 | 2 |
| A06 | Risk 和原始 Discovery 结果刷新后消失或被重建 | 历史不可追溯 | 2 |
| A07 | “采纳推荐”把解释性文本直接写成 Confirmed | 产生空泛或错误决策 | 3 |
| A08 | Checklist 兜底题统一使用“缩小/扩大范围” | 问题不可具体回答 | 3 |
| A09 | 核心问题、Gap、题目数量口径不同 | 用户不知道还差什么 | 3 |
| A10 | Provider Health 永远返回 ready，并声称隐私零外流 | 信任和隐私承诺失真 | 4 |
| A11 | Fork 只修改 `project.json`，其他状态仍可能引用原项目 | 副本状态污染 | 4 |
| A12 | 删除为永久递归删除，Registry 先于目录更新 | 数据不可恢复或 Registry 孤儿 | 4 |
| A13 | Readiness 八领域与 Overview 不一致，所有批准动作同时展示 | 准入判断不可信 | 5 |
| A14 | 默认界面混用英文术语与原始引用 ID | 非技术用户理解困难 | 6 |
| A15 | 窄屏三栏布局不可用 | 小窗口和移动设备无法操作 | 6 |
| A16 | 创建输入无关联 label，问题选项为不可键盘操作的 div | 可访问性不合格 | 6 |
| A17 | 下一步、分析、问题、输入、Overview 同时竞争注意力 | 主任务不清晰 | 6 |
| A18 | Wizard“暂不回答”没有真正写入 dismissed | 下一批仍被阻塞 | 3 |
| A19 | 设置页未接入 Provider、路径、隐私、缓存与故障诊断 | 无法自助恢复 | 4、6 |
| A20 | 材料缺少删除、替换、重提取、失败重试 | 材料生命周期不完整 | 6 |
| A21 | 文档数量文案错误，缺少版本差异和原子导出 | 交付可信度不足 | 5 |
| A22 | B3 最终报告仅一个真实用例，人工评分为空 | 质量结论不足 | 7 |
| A23 | 单次真实调用约 44 秒、53k Token | 等待成本和费用偏高 | 7 |
| A24 | 正式文档和测试名称仍残留 B2.1 活动语义 | 后续 Agent 可能接回旧契约 | 0 |

## 4. 阶段总览

| 阶段 | 名称 | 主要产物 | 进入条件 |
|---|---|---|---|
| 0 | 基线冻结与契约清理 | 回归测试骨架、B3 文档边界 | 当前分支可构建 |
| 1 | 统一领域模型与结构化创建 | `AreaRegistry`、迁移、初始决策映射 | 阶段 0 通过 |
| 2 | 引用式授权与持久化 Discovery | Candidate/Assumption 转换、Turn 历史、用户消息先落盘 | 阶段 1 通过 |
| 3 | 问题质量与批次闭环 | 推荐选项键、Checklist 模板、真实跳过、统一计数 | 阶段 2 通过 |
| 4 | Provider 与项目数据安全 | 真实健康检查、安全 Fork、可恢复删除、诊断中心 | 阶段 3 通过 |
| 5 | 准备度与文档交付可信化 | 八领域 Readiness、允许动作、文档版本与原子导出 | 阶段 4 通过 |
| 6 | 中文 UX、响应式与可访问性 | 单栏窄屏、渐进披露、键盘操作、材料生命周期 | 阶段 5 通过 |
| 7 | 性能、B3 Benchmark 与发布门槛 | 14 场景验证、阶段测试、缓存证据、发布清单 | 阶段 6 通过 |

---

# 阶段 0：基线冻结与契约清理

## 0.1 目标

建立后续重构的失败测试和唯一活动契约边界，不改变用户数据格式和运行行为。

## 0.2 文件范围

**Create:**

- `tests/product-hardening/audit-regressions.test.ts`
- `docs/reports/PRODUCT_HARDENING_BASELINE.md`

**Modify:**

- `tests/b2-1-regression.test.ts`，改名为 `tests/discovery-safety-regression.test.ts`
- `docs/blueprint/11_CHECKLIST_ENGINE.md`
- `docs/blueprint/04_PROJECT_STATE_MODEL.md`
- `docs/blueprint/09_BLUEPRINT_REVIEW.md`
- `docs/blueprint/implementation/15_RUNTIME_CONFIG.md`

历史阶段报告可以保留 B2.1，但必须在文件顶部标记“历史归档，不属于生产运行时”。

## 0.3 任务

### Task 0.1：冻结审计回归事实

- [ ] 新建 `tests/product-hardening/audit-regressions.test.ts`，先写能够暴露以下现状的测试：
  - `CANONICAL_B3_AREAS` 与 Overview 固定区域不一致。
  - `trust_safety` 无法投影到 Overview。
  - Fork 后至少一个状态文件仍保留原 `projectId`。
  - Checklist 兜底题的两个选项在不同 decision key 下完全相同。
  - Provider Health 在 CLI 不存在时仍返回 ready。
- [ ] 运行：

```powershell
pnpm exec vitest run tests/product-hardening/audit-regressions.test.ts --maxWorkers=1
```

预期：测试失败，并分别指向上述五个事实，而不是因为导入或 TypeScript 错误失败。

### Task 0.2：清理活动 B2.1 语义

- [ ] 将生产回归测试文件重命名为 `tests/discovery-safety-regression.test.ts`。
- [ ] 保留单次调用、结构化输出、用户授权和 Locked 保护断言，删除对旧问题预算和旧 Schema 文件名的活动依赖。
- [ ] 在仍需保留的旧报告头部添加：

```markdown
> 历史归档：本文记录 B2.1 阶段实现，不属于当前生产运行时契约。当前唯一活动契约见 `docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md`。
```

### Task 0.3：记录可复验基线

- [ ] 在 `PRODUCT_HARDENING_BASELINE.md` 记录构建命令、测试数量、真实 B3 样本路径、时延、Token 和审计截图目录。
- [ ] 运行：

```powershell
pnpm build
pnpm exec vitest run --maxWorkers=2
```

预期：构建通过，除新增的审计失败测试外，原测试全部通过。

## 0.4 验收

- 生产代码只引用 B3 Prompt 和 B3 Schema。
- 历史资产没有被删除，也没有运行时回退开关。
- 五个审计回归测试以明确原因失败，成为后续阶段的红灯。

## 0.5 阶段提示词

```text
你正在实施 Project Architect Product Hardening 阶段 0：基线冻结与契约清理。

先完整阅读：
1. AGENTS.md
2. docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md
3. docs/superpowers/plans/2026-08-27-product-hardening-master-plan.md 的阶段 0
4. experiments/agent-benchmark/prompts/constitution-b3.md
5. experiments/agent-benchmark/schemas/b3-discovery.schema.json

本阶段不得改变运行行为、状态 Schema 或用户界面。目标是把审计问题变成可重复失败的测试，并确保 B3 是唯一活动契约。

严格执行：
- 先运行 git status --short，保留全部用户未提交修改。
- 新建 tests/product-hardening/audit-regressions.test.ts。
- 测试必须分别证明：领域 ID 分叉、trust_safety 无投影、Fork projectId 不一致、Checklist 兜底选项重复、Provider 假健康。
- 将 tests/b2-1-regression.test.ts 重命名为 tests/discovery-safety-regression.test.ts，只保留仍适用于 B3 的安全断言。
- 旧报告可保留历史内容，但顶部必须明确它不是生产契约。
- 不接入 B2.1 回退，不改 Prompt，不改 Schema，不改 Core 行为。

验证：
pnpm build
pnpm exec vitest run tests/product-hardening/audit-regressions.test.ts --maxWorkers=1
pnpm exec vitest run --maxWorkers=2

最终报告必须列出：修改文件、五个预期失败测试、原有测试结果、仍未解决的阶段 1 问题。不要因为审计测试失败而伪造全绿结论。
```

---

# 阶段 1：统一领域模型与结构化创建

## 1.1 目标

让 Input、Gap、Question、Decision、Overview、Readiness 和 Document Compiler 使用同一套稳定领域 ID；让四项创建引导从第一次 commit 起就形成正确的用户决策。

## 1.2 领域契约

新增 `packages/contracts/src/areas.ts`：

```ts
export const PROJECT_AREA_IDS = [
  'project_overview',
  'target_user',
  'mvp_scope',
  'core_features',
  'user_flows',
  'page_structure',
  'ux_ui_direction',
  'technical_boundary',
  'delivery_plan',
] as const;

export type ProjectAreaId = typeof PROJECT_AREA_IDS[number];

export const CORE_DISCOVERY_AREA_IDS = PROJECT_AREA_IDS.filter(
  (id): id is Exclude<ProjectAreaId, 'project_overview'> => id !== 'project_overview',
);

export interface ProjectAreaDefinition {
  id: ProjectAreaId;
  title: string;
  readinessTitle: string;
  aliases: readonly string[];
  documentPaths: readonly string[];
  countsForDiscovery: boolean;
}
```

别名至少覆盖：

| 旧/Provider area | 新 area |
|---|---|
| `core_problem`、`problem`、`target_audience` | `target_user` |
| `ux_ui`、`user_interface` | `ux_ui_direction` |
| `trust_safety`、`privacy_policy`、`platform_context` | `technical_boundary` |
| `acceptance`、`success_signal` | `delivery_plan` |
| `product_identity`、`value_outcome`、`general` | `project_overview` |

未知 area 不得静默进入任意业务区域。统一映射到 `project_overview` 时必须保留 `sourceArea` 并产生诊断计数。

## 1.3 文件范围

**Create:**

- `packages/contracts/src/areas.ts`
- `packages/core/src/areas/AreaRegistry.ts`
- `packages/core/src/migrations/ProjectStateMigration.ts`
- `packages/core/tests/AreaRegistry.test.ts`
- `packages/core/tests/ProjectStateMigration.test.ts`
- `tests/product-hardening/structured-create.test.ts`

**Modify:**

- `packages/contracts/src/index.ts`
- `packages/contracts/src/api.ts`
- `packages/contracts/src/project.ts`
- `packages/contracts/src/decisions.ts`
- `packages/contracts/src/gaps.ts`
- `packages/contracts/src/readiness.ts`
- `packages/core/src/engine/ProjectStateEngine.ts`
- `packages/core/src/gaps/GapDetectionEngine.ts`
- `packages/core/src/questions/QuestionBatchPolicy.ts`
- `packages/core/src/view/ProjectOverviewProjection.ts`
- `packages/core/src/view/ReadinessProjection.ts`
- `packages/core/src/documents/DocumentRenderer.ts`
- `apps/web/src/app/HomeView.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/src/api/client.ts`

## 1.4 API 契约

```ts
export interface InitialProjectIntent {
  targetUser: string;
  coreProblem: string;
  desiredOutcome: string;
  constraints?: string;
}

export interface CreateProjectRequest {
  name: string;
  idea?: string;
  initialIntent?: InitialProjectIntent;
  projectId?: string;
  projectPath?: string;
  projectTags?: string[];
}
```

校验规则：`idea` 和 `initialIntent` 至少存在一个。结构化入口必须提交 `initialIntent`，自由长文本入口继续提交 `idea`。

结构化创建原子生成：

- `desiredOutcome` → `project_overview` Confirmed。
- `targetUser` 与 `coreProblem` → 两条 `target_user` Confirmed。
- 非空 `constraints` → `technical_boundary` Confirmed。
- 原始四项文本仍写入 Initial Idea Input，作为 evidence。

## 1.5 迁移规则

- 旧项目加载时仅在内存执行领域归一化。
- 下一次正常用户提交时随两阶段 commit 写入新 Schema。
- 不单独扫描或批量改写用户项目。
- Locked 决策只迁移 `area`，不得改写 statement、status、evidenceRefs。
- `sourceArea` 只在旧 area 与新 area 不同或未知时保存。

## 1.6 任务

### Task 1.1：先写 AreaRegistry 失败测试

- [ ] 断言九个投影区域唯一，八个 Discovery 核心区域唯一。
- [ ] 断言所有别名映射结果。
- [ ] 断言未知 area 返回带诊断的 `project_overview`，不是随机业务区。
- [ ] 断言 `trust_safety` 决策出现在技术边界 Overview。

### Task 1.2：实现共享领域契约

- [ ] 创建 `areas.ts` 和 `AreaRegistry.ts`。
- [ ] 删除 `ReadinessProjection`、`QuestionComposer`、`DocumentRenderer` 内各自维护的重复 area 映射。
- [ ] 所有展示标题由 Registry 获取。

### Task 1.3：实现结构化创建

- [ ] 为 API Client、Server、Engine 增加 `initialIntent`。
- [ ] Engine 在同一次首次 commit 中创建多条用户 Confirmed 决策与 trace。
- [ ] HomeView 不再拼接 Markdown 作为唯一 Decision。

### Task 1.4：实现旧项目内存迁移

- [ ] 在 `loadProject()` 完成 JSON 读取后调用 `ProjectStateMigration.migrateInMemory(snapshot)`。
- [ ] 增加 `migrationDiagnostics`，至少记录 normalizedAreas、unknownAreas、legacySchemaFiles。
- [ ] 下一次正常 commit 写入统一区域和新 schemaVersion。

### Task 1.5：修复所有投影与文档映射

- [ ] Gap、Question 和 Decision 在进入 Core 时统一 normalize。
- [ ] Overview、Readiness、DocumentRenderer 和 DocumentDiffEngine 使用 Registry。
- [ ] 删除 `core_problem`、`ux_ui`、`acceptance` 作为正式区域 ID 的运行时依赖。

## 1.7 测试

```powershell
pnpm exec vitest run packages/core/tests/AreaRegistry.test.ts packages/core/tests/ProjectStateMigration.test.ts tests/product-hardening/structured-create.test.ts --maxWorkers=1
pnpm exec vitest run packages/core/tests packages/contracts/tests apps/server/tests apps/web/tests --maxWorkers=2
pnpm build
pnpm exec vitest run --maxWorkers=2
```

验收数据：填写四项创建引导后，Overview 至少有 `project_overview`、`target_user`、`technical_boundary` 三个非空区域；Readiness 不得继续把目标用户显示为未探索。

## 1.8 阶段提示词

```text
你正在实施 Product Hardening 阶段 1：统一领域模型与结构化创建。

先阅读 AGENTS.md、B3 规范和总计划阶段 1。只实施阶段 1，不提前改 Candidate、Discovery Turn、响应式或 Provider。

核心结果：全系统只有一套 ProjectAreaId。Overview 有 project_overview 加八个核心区域；Readiness 的八个核心区域必须与 B3 QuestionBatchPolicy 使用的区域完全相同。

必须完成：
1. 新建 packages/contracts/src/areas.ts，定义 PROJECT_AREA_IDS、CORE_DISCOVERY_AREA_IDS、ProjectAreaDefinition。
2. 新建 packages/core/src/areas/AreaRegistry.ts，集中维护中文标题、别名、文档映射和是否计入 Discovery。
3. 新建 ProjectStateMigration，只在内存迁移旧项目，下一次正常提交时持久化。
4. CreateProjectRequest 增加 initialIntent。四项引导不得再被拼成一个 Markdown Decision。
5. 结构化创建必须原子生成 project_overview、target_user、technical_boundary 用户决策，并引用同一 Initial Idea Input。
6. trust_safety/privacy/platform 映射到 technical_boundary；acceptance/success_signal 映射到 delivery_plan；ux_ui 映射到 ux_ui_direction。
7. Locked 只允许迁移 area，不允许改 statement 或 status。
8. 删除各模块重复的 area title/mapping 表。

测试先行。先让 AreaRegistry、结构化创建和旧项目迁移测试失败，再写最小实现。完成后运行阶段 1 指定测试、workspace build 和低并发全量测试。

最终报告给出：统一后的 area 表、旧 area 迁移表、四项创建后的实际 Snapshot 摘要、未知 area 诊断、测试结果和未进入本阶段的后续问题。
```

---

# 阶段 2：引用式授权与持久化 Discovery

## 2.1 目标

所有 AI 建议都通过稳定引用转换；用户自由输入先持久化；每次 Discovery 的原始输入、原始输出、接受/丢弃结果和诊断可在刷新后准确恢复。

## 2.2 契约变更

新增 `packages/contracts/src/discovery.ts`：

```ts
export type DiscoveryTurnStatus =
  | 'recorded'
  | 'queued'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'stale';

export interface DiscoveryTurnRecord {
  id: string;
  projectId: string;
  inputRef?: string;
  sourceRevision: number;
  status: DiscoveryTurnStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  providerResult?: DiscoveryResult;
  acceptedRefs: string[];
  discardedCounts: Record<string, number>;
  diagnostics?: AgentRunDiagnostics;
  errorCode?: string;
}
```

新增结构化建议：

```ts
export interface CandidateSuggestion {
  decision_key: string;
  area: ProjectAreaId;
  statement: string;
  rationale: string;
}

export interface AssumptionSuggestion {
  decision_key: string;
  area: ProjectAreaId;
  statement: string;
  reason: string;
}

export interface RiskSuggestion {
  risk_key: string;
  area: ProjectAreaId;
  statement: string;
  impact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}
```

Discovery Turn 日志写入 `runtime/discovery-turns.json`。它是不可变运行证据，不是 Confirmed 事实来源。用户自由输入同时作为普通 Input 持久化，保证服务重启后不会丢失。

## 2.3 文件范围

**Create:**

- `packages/contracts/src/discovery.ts`
- `packages/core/src/discovery/DiscoveryTurnStore.ts`
- `packages/core/tests/DiscoveryTurnStore.test.ts`
- `tests/product-hardening/discovery-persistence.test.ts`
- `tests/product-hardening/suggestion-transition.test.ts`

**Modify:**

- `experiments/agent-benchmark/schemas/b3-discovery.schema.json`
- `experiments/agent-benchmark/prompts/constitution-b3.md`
- `packages/contracts/src/provider.ts`
- `packages/contracts/src/decisions.ts`
- `packages/contracts/src/assumptions.ts`
- `packages/contracts/src/api.ts`
- `packages/core/src/policy/DecisionPolicyEngine.ts`
- `packages/core/src/engine/ProjectStateEngine.ts`
- `packages/agent/src/orchestrator/AIOrchestrator.ts`
- `apps/server/src/DiscoveryJobManager.ts`
- `apps/server/src/server.ts`
- `apps/web/src/features/chat/ChatView.tsx`
- `apps/web/src/features/chat/DiscoveryResultCard.tsx`
- `apps/web/src/state/ProjectSessionContext.tsx`
- `apps/web/src/api/client.ts`

## 2.4 转换语义

`confirmDecision(targetRef)` 必须支持：

- `decision:<candidate-id>`：把 Candidate 提升为 Confirmed，保留同一 ID 或建立 replacementRef。
- `assumption:<id>`：创建 Confirmed Decision，将 Assumption 标记 resolved 并保存 `resolvedDecisionRef`。
- 已 Confirmed/Locked：幂等返回，不重复创建。
- rejected/superseded/resolved：返回 422 明确错误。

前端回调只能传 `TypedRef`，禁止按 statement 文本匹配。

## 2.5 用户消息顺序

自由输入发送流程：

1. `POST /projects/:id/discovery/inputs` 保存输入并增加 revision。
2. 返回 `inputRef`、`turnId`、`snapshot`。
3. 前端确认成功后清空草稿。
4. `POST /projects/:id/discovery/jobs` 只提交 `turnId` 和保存后的 revision。
5. Job 从 Turn 读取输入，不接收临时 `userMessage`。

如果 Job 取消、失败或 stale，Input 与 Turn 仍保留，用户可点击“按最新状态重试”。

## 2.6 任务

### Task 2.1：升级 B3 建议对象

- [ ] 先写 Schema 测试，拒绝字符串 Candidate、无 area Assumption 和无 key Risk。
- [ ] 更新 Constitution，要求所有用户可转换建议都带稳定 key 和 canonical area。
- [ ] 更新 MockProvider 与 B3 Runner fixture。

### Task 2.2：实现引用式 Candidate/Assumption 转换

- [ ] 为 `DecisionPolicyEngine` 保存 canonical area、decisionKey、rationale。
- [ ] Engine 的 `confirmDecision` 支持 Candidate 和 Assumption。
- [ ] ChatView 删除 `mvp_scope` 和 `technical_boundary` 默认写入逻辑。
- [ ] DiscoveryResultCard 使用 ref 调用转换 API。

### Task 2.3：实现用户消息先落盘

- [ ] 新增 `recordDiscoveryInput()`，复用 Input 安全限制和两阶段 commit。
- [ ] Schedule API 不再接受未持久化 `userMessage`。
- [ ] 只有保存成功才清空 `localStorage` 草稿。

### Task 2.4：实现不可变 Discovery Turn 历史

- [ ] TurnStore 使用临时文件 + rename 原子写入。
- [ ] 每次状态变化附带时间和 sourceRevision。
- [ ] Provider 原始结构化结果、Policy 接受 refs、丢弃计数和诊断写入同一 Turn。
- [ ] 打开项目时显示真实最近 Turn，禁止用当前 Snapshot 伪造旧输出和当前时间。

### Task 2.5：持久化 Risk

- [ ] RiskSuggestion 经 Policy 校验后写入 `risks.json`。
- [ ] 相同 `risk_key` 更新同一风险，不重复堆积。
- [ ] 重新打开项目仍能看到当时风险和对应 Turn。

## 2.7 测试

必须覆盖：

- 调度失败后用户输入仍存在。
- 服务重启后 Turn 和输入仍可恢复。
- stale/cancelled/failed 不写入建议状态，但保留输入和失败证据。
- Candidate 转换进入声明 area，原 Candidate 不继续计数。
- Assumption 转换后不再 active。
- 相同 statement、不同 ref 不会误转换。
- Risk 刷新后不消失。
- Locked 不被任何 Turn 覆盖。

```powershell
pnpm exec vitest run tests/product-hardening/discovery-persistence.test.ts tests/product-hardening/suggestion-transition.test.ts apps/server/tests/discovery-job.test.ts --maxWorkers=1
pnpm exec vitest run packages/core/tests packages/agent/tests apps/server/tests apps/web/tests --maxWorkers=2
pnpm build
pnpm exec vitest run --maxWorkers=2
```

## 2.8 阶段提示词

```text
实施 Product Hardening 阶段 2：引用式授权与持久化 Discovery。阶段 1 必须已通过。

本阶段的不可妥协结果：
- 用户自由输入先进入本地状态，再启动 Provider。
- Candidate、Assumption、Risk 都有稳定 key、canonical area 和稳定 ref。
- 转为决策只能通过 TypedRef，不允许按文本匹配，不允许默认塞入 mvp_scope 或 technical_boundary。
- 每个 Discovery Turn 在 runtime/discovery-turns.json 中保留真实输入引用、sourceRevision、原始结构化输出、接受引用、丢弃计数、状态和时间。
- AI 失败、取消、stale 不污染 Project State，但不能丢掉用户输入。

先升级 B3 Schema 和 Constitution，再同步 contracts、MockProvider、Policy、Engine、Server 与 Web。保持一次用户操作最多一次主要 Provider 调用。

TurnStore 必须原子写入；用户事实仍以 Project State/Input 为准，Turn 只是不可变运行证据。不得把 Provider 文本直接升级为 Confirmed。

测试顺序：先写 suggestion-transition 和 discovery-persistence 失败测试；实现最小路径；补取消、失败、重启、stale、Locked、重复 statement 测试；运行定向测试、build 和全量低并发测试。

最终报告必须展示一条完整链路：用户消息保存 revision → Turn queued/running/completed → Provider 输出 → Policy 接受 refs → Snapshot revision；同时展示取消和 stale 时哪些文件保持不变。
```

---

# 阶段 3：问题质量与批次闭环

## 3.1 目标

确保每道题都能被普通用户理解、选项真正回答问题、影响明确、推荐绑定真实选项；批次进度和跳过语义只有一个口径。

## 3.2 Question 契约

```ts
export interface QuestionOption {
  key: string;
  label: string;
  impact: string;
  tradeoffs?: string;
  reversibility?: 'easy' | 'moderate' | 'hard';
}

export interface QuestionItem {
  // 保留既有字段
  recommendedOptionKey?: string;
}
```

B3 Schema 使用 `recommended_option_key`。它必须引用同题 options 中存在的 key。`recommendation` 改为推荐说明，不再作为可提交答案。

## 3.3 Checklist 模板

新增 `packages/core/src/questions/ChecklistQuestionTemplates.ts`。至少为所有当前 Checklist key 提供具体模板，包括：

- `chk-localfirst-ownership`
- `univ-mvp-boundary`
- `univ-primary-flow`
- `univ-platform-choice`
- `univ-success-signal`

模板结构：

```ts
export interface ChecklistQuestionTemplate {
  question: (gap: GapItem) => string;
  reason: (gap: GapItem) => string;
  options: QuestionOption[];
  recommendedOptionKey?: string;
}
```

示例：平台选择题必须提供 Windows、Web、macOS/跨平台或自由输入，而不是“范围清晰/覆盖更多”。数据所有权题必须明确“人类可读文件直接拥有”和“应用管理格式但提供完整导出”的真实差异。

## 3.4 统一进度投影

由 Server/Core 返回：

```ts
export interface DiscoveryProgressView {
  blockingDecisionCount: number;
  openGapCount: number;
  deferredGapCount: number;
  activeBatchQuestionCount: number;
  answeredBatchQuestionCount: number;
  dismissedBatchQuestionCount: number;
  remainingBatchQuestionCount: number;
  canGenerateNextBatch: boolean;
  nextAction: 'answer' | 'dismiss' | 'organize' | 'review-readiness';
}
```

NextBestAction、QuestionWizard、批次按钮和顶部状态全部消费该 View，前端不再各自计算。

## 3.5 文件范围

**Create:**

- `packages/core/src/questions/ChecklistQuestionTemplates.ts`
- `packages/core/src/view/DiscoveryProgressProjection.ts`
- `packages/core/tests/ChecklistQuestionTemplates.test.ts`
- `packages/core/tests/DiscoveryProgressProjection.test.ts`
- `tests/product-hardening/question-quality.test.ts`

**Modify:**

- B3 Schema 与 Constitution
- `packages/contracts/src/questions.ts`
- `packages/contracts/src/views.ts`
- `packages/core/src/questions/QuestionComposer.ts`
- `packages/core/src/questions/QuestionSelector.ts`
- `apps/server/src/server.ts`
- `apps/web/src/features/chat/QuestionCard.tsx`
- `apps/web/src/features/chat/QuestionWizard.tsx`
- `apps/web/src/features/chat/ChatView.tsx`
- `apps/web/src/features/chat/NextBestActionBanner.tsx`

## 3.6 任务

### Task 3.1：推荐选项引用

- [ ] Schema 拒绝不存在的 recommended key。
- [ ] Core 接收 Agent 问题时验证 option key 唯一。
- [ ] “采纳推荐”只选中推荐 option，并显示预览；用户仍需点击确认决策。
- [ ] 删除把 recommendation prose 直接传入 `answerQuestion` 的路径。

### Task 3.2：重写 Checklist 问题

- [ ] 为每个已知 key 编写中文具体题、2–4 个互斥选项、具体影响和可逆性。
- [ ] 未知 Checklist key 没有安全模板时只允许自由输入题，并标记 `templateMissing` 诊断；禁止使用通用扩范围/缩范围选项。
- [ ] 修复标点组合、内部英文 area 和“Checklist 标准检查项”用户文案。

### Task 3.3：真实跳过

- [ ] Wizard 将 `onSkipQuestion` 连接到单题 dismiss API。
- [ ] 按钮文案拆分为“稍后再想”和“跳过本题”；前者只导航，后者持久化 dismissed。
- [ ] 跳过后 revision 增加，不创建 Decision 或 Assumption。

### Task 3.4：统一批次进度

- [ ] 新增 Projection 和 API。
- [ ] 删除前端对 Gap/Question 数量的重复推导。
- [ ] 下一批只在本批全部 answered/dismissed/superseded 时允许。
- [ ] 旧批次仍有 active 问题时显示恢复入口，不隐藏问题。

### Task 3.5：问题可访问性

- [ ] 选项使用原生 radio 或 `role="radiogroup"` + `role="radio"`。
- [ ] 支持 Tab、Space、Enter 和方向键。
- [ ] 选择状态具有文本与 `aria-checked`，不能只靠颜色。

## 3.7 质量门槛

- 问题正文优先不超过 60 个中文字符；专业术语首次出现有短解释。
- reason 不重复 question。
- 每个 option 明确“得到什么”和“付出什么”。
- 同题 option key 唯一，recommended key 必须存在。
- 同批 decisionKey 唯一，无直接或传递依赖。
- 初始有效独立 Gap ≥ 8 时选择 8–12 题；不足时不填充低价值题。

## 3.8 阶段提示词

```text
实施 Product Hardening 阶段 3：问题质量与批次闭环。不要修改 Provider 隐私、项目 Fork、Readiness 或整体视觉风格。

目标：每道题都必须是用户能直接做出的一个决策。推荐必须绑定真实 option key，解释文字不能直接成为 Confirmed。Checklist 题不能继续使用通用的“边界清晰/覆盖更多场景”。

完成以下内容：
- QuestionOption 增加 key、tradeoffs、reversibility；Question 增加 recommendedOptionKey。
- 更新 B3 Schema/Constitution 并验证推荐 key 存在。
- 新建 ChecklistQuestionTemplates，为当前全部 Checklist key 编写具体中文模板。
- 未知 key 只能生成清晰自由输入题，并记录模板缺失诊断。
- 新建 DiscoveryProgressProjection，统一阻塞决策、开放 Gap、本批题目、已答、已跳过、剩余与 nextAction。
- Wizard 的“跳过本题”必须调用 dismiss API；“稍后再想”只导航。
- 下一批必须等待本批全部进入终态。
- 问题选项改成键盘可操作的 radio 语义。

先写失败测试，覆盖推荐 prose 不可提交、推荐 key 错误、五类 Checklist 题、真实 dismiss、进度一致、旧批次恢复和键盘语义。完成后执行阶段测试、build、低并发全量测试。

最终报告展示至少五道改造前后问题对比，并逐项说明每个选项选择后的范围、时间、体验、风险和可逆性影响。
```

---

# 阶段 4：Provider 与项目数据安全

## 4.1 目标

让用户准确知道 AI 是否可用、哪些数据会离开本机；让复制和删除操作具备完整性与恢复能力；让设置页成为真正的诊断中心。

## 4.2 Provider Health 契约

```ts
export interface ProviderHealthView {
  status: 'ready' | 'degraded' | 'unavailable';
  providerName: string;
  modelName?: string;
  inferenceLocation: 'local' | 'remote' | 'unknown';
  sendsProjectContextOffDevice: boolean | 'unknown';
  structuredOutput: 'supported' | 'unsupported' | 'unknown';
  promptCache: 'supported' | 'observed' | 'unsupported' | 'unknown';
  checkedAt: string;
  executable?: string;
  lastSuccessAt?: string;
  lastFailureCode?: string;
  guidance?: string;
}
```

`AIProvider` 增加只读 `healthCheck()`。Antigravity 实现检查 CLI 可执行、版本、最小非敏感结构化响应能力；不得发送项目数据。Health 不能硬编码 ready。

## 4.3 安全 Fork

新增 Core `forkProject(sourcePath, targetPath, newProjectId, newName)`：

1. 复制到同级临时目录。
2. 重写所有规范状态文件的 `projectId`。
3. 清理运行中 Job、旧 Turn 运行状态和不适用于新 revision 的 Readiness 批准。
4. 保留 Decision、Input、Locked 和来源关系。
5. 生成 `forkedFrom` 元数据。
6. 通过完整加载验证。
7. 原子 rename 为目标目录。
8. 最后更新 Registry。

## 4.4 可恢复删除

删除项目默认移动到 `<workspace>/.trash/<projectId>-<timestamp>/`。Registry 保存 `trashedAt` 和 `trashPath`。新增 Restore API；真正永久清理必须是独立动作，并再次确认。

## 4.5 文件范围

**Create:**

- `packages/core/src/projects/ProjectForkService.ts`
- `packages/core/src/projects/ProjectTrashService.ts`
- `packages/core/tests/ProjectForkService.test.ts`
- `packages/core/tests/ProjectTrashService.test.ts`
- `apps/web/src/features/settings/ProviderDiagnosticsPanel.tsx`
- `tests/product-hardening/provider-trust.test.ts`

**Modify:**

- `packages/agent/src/provider/AIProvider.ts`
- `packages/agent/src/provider/AntigravityCliProvider.ts`
- `packages/agent/src/provider/MockAIProvider.ts`
- `packages/contracts/src/provider.ts`
- `packages/contracts/src/api.ts`
- `packages/contracts/src/project.ts`
- `apps/server/src/server.ts`
- `apps/web/src/features/home/ProviderHealthModal.tsx`
- `apps/web/src/app/HomeView.tsx`
- `apps/web/src/app/WorkspaceView.tsx`
- `apps/web/src/api/client.ts`

## 4.6 任务

- [ ] Provider CLI 不存在时返回 unavailable。
- [ ] CLI 存在但最小探测失败时返回 degraded，不泄露原始 stderr。
- [ ] 删除首页“隐私零外流”“零数据泄露”，替换为“项目文件保存在本地；AI 推理可能向配置的 Provider 发送选定上下文”。
- [ ] 设置页显示实际路径、Provider、模型、推理位置、数据发送、缓存证据、最近错误与重试。
- [ ] Fork 验证每个 JSON 的 projectId、Manifest、Turn、Readiness、Registry。
- [ ] 删除改为 Trash，支持恢复；永久清理路径必须经过 WorkspaceGuard 精确校验。
- [ ] 任何文件操作失败时 Registry 与目录状态必须可恢复或保持原状。

## 4.7 测试

```powershell
pnpm exec vitest run packages/core/tests/ProjectForkService.test.ts packages/core/tests/ProjectTrashService.test.ts tests/product-hardening/provider-trust.test.ts apps/server/tests/server-security.test.ts --maxWorkers=1
pnpm exec vitest run tests/reliability apps/server/tests packages/agent/tests --maxWorkers=2
pnpm build
pnpm exec vitest run --maxWorkers=2
```

额外人工验证：关闭/重命名 `AGY_CLI` 配置后，首页必须显示不可用而不是 ready；不得运行真实项目 Prompt 作为健康检查。

## 4.8 阶段提示词

```text
实施 Product Hardening 阶段 4：Provider 与项目数据安全。

本阶段重点是信任，不是增加新 AI 功能。

必须完成：
1. AIProvider.healthCheck() 返回真实 ready/degraded/unavailable，并说明推理位置、是否向设备外发送上下文、结构化输出和 prompt cache 证据。
2. Antigravity 健康检查不得携带项目数据，不得把 CLI 存在等同于模型可用。
3. 删除“隐私零外流”等未经验证的绝对承诺。
4. 新建 ProjectForkService，在临时目录重写所有 projectId、重置旧批准和运行状态、完整加载验证后原子提交。
5. 新建 ProjectTrashService，默认删除进入 workspace/.trash，可恢复；Registry 最后更新。
6. 设置页接入真实 Provider、路径、最近错误、缓存与隐私说明。

保持单 Agent、无数据库、无登录、无云同步。不要在本阶段重做页面布局。

测试必须覆盖 CLI 缺失、探测失败、错误清洗、Fork 中途失败、所有状态 projectId、一键恢复、永久清理 WorkspaceGuard 和 Registry 原子性。完成后执行安全定向测试、build 和全量测试。

最终报告必须明确区分“本地存储”和“本地推理”，并展示一次 CLI 不可用状态和一次安全 Fork 后的状态一致性证明。
```

---

# 阶段 5：准备度与文档交付可信化

## 5.1 目标

Readiness 只评估统一八领域；批准只对当前 revision 生效；前端只显示当前允许动作；文档包数量、来源、版本和导出结果准确可验证。

## 5.2 Readiness View

```ts
export interface ReadinessActionView {
  disposition: UserDisposition;
  label: string;
  description: string;
  enabled: boolean;
  requiredAcknowledgementRefs: string[];
  blockedReasons: string[];
}

export interface ReadinessView {
  basisRevision: number;
  currentRevision: number;
  isStale: boolean;
  coverage: ReadinessCoverageMetric;
  credibilityScore: number;
  areas: ReadinessAreaView[];
  actions: ReadinessActionView[];
}
```

规则：

- Coverage 只表示八领域是否有 Confirmed/Locked 证据。
- Credibility 单独考虑 Assumption、Critical Gap、Conflict 和来源质量。
- Assumption 不能增加分数。
- 修改任何项目事实后，旧批准立刻 stale。
- 前端只显示 `actions` 中 enabled 或需要解释的动作，不自行决定批准等级。

## 5.3 文档交付

固定核心文档总数是 8，包含 `AGENTS.md`：

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/PRODUCT.md`
4. `docs/USER_FLOWS.md`
5. `docs/UX_UI_SPEC.md`
6. `docs/TECHNICAL_GUIDE.md`
7. `docs/DEVELOPMENT_PLAN.md`
8. `docs/ACCEPTANCE.md`

新增 Manifest 字段：

```ts
export interface DocumentManifest {
  id: string;
  projectId: string;
  sourceRevision: number;
  readinessReviewId: string;
  readinessBasisRevision: number;
  generatedAt: string;
  documents: DocumentManifestItem[];
  warnings: string[];
  sourceCoverage: {
    confirmed: number;
    locked: number;
    assumptions: number;
    generatedStructure: number;
  };
}
```

## 5.4 文件范围

**Create:**

- `packages/core/src/readiness/ReadinessActionPolicy.ts`
- `packages/core/tests/ReadinessActionPolicy.test.ts`
- `packages/core/src/documents/DocumentExportService.ts`
- `packages/core/tests/DocumentExportService.test.ts`
- `tests/product-hardening/readiness-document-trust.test.ts`

**Modify:**

- `packages/contracts/src/readiness.ts`
- `packages/contracts/src/views.ts`
- `packages/contracts/src/documents.ts`
- `packages/core/src/readiness/KnowledgeChecklist.ts`
- `packages/core/src/readiness/ReadinessEvaluator.ts`
- `packages/core/src/readiness/ReadinessGate.ts`
- `packages/core/src/view/ReadinessProjection.ts`
- `packages/core/src/documents/DocumentPlanner.ts`
- `packages/core/src/documents/DocumentRenderer.ts`
- `packages/core/src/documents/DocumentValidator.ts`
- `packages/core/src/documents/DocumentDiffEngine.ts`
- `apps/web/src/features/readiness/ReadinessView.tsx`
- `apps/web/src/features/documents/DocumentsView.tsx`
- `apps/web/src/features/documents/AgentPromptModal.tsx`
- `apps/server/src/server.ts`

## 5.5 任务

- [ ] Readiness 使用 `CORE_DISCOVERY_AREA_IDS`，删除第二套 canonical 常量。
- [ ] Area 标题全部中文；原始 refs 收进可展开详情。
- [ ] `ReadinessActionPolicy` 返回允许动作、所需确认和阻断原因。
- [ ] 批准时验证 `basisRevision === currentRevision`。
- [ ] 任何 Decision/Input/Assumption/Gap 状态变化都使旧批准 stale。
- [ ] 修正文档数量文案和 Agent Prompt。
- [ ] 文档编译要求当前 revision 的有效批准。
- [ ] 每个文档保存内容 hash、来源统计和生成 revision。
- [ ] ZIP 由 Server/Core 一次性原子生成，任何文件读取失败则整体失败并返回具体文件列表。
- [ ] 接入 DocumentDiffEngine，重新编译前展示新增、删除、变化章节。
- [ ] Agent Prompt 根据实际 warnings、assumptions、known issues、文档列表和 revision 动态生成，不再声称“完整收敛”。

## 5.6 测试

- 统一八领域与 Overview 完全一致。
- Assumption 增加时 credibility 不得上升。
- revision 变化后批准失效。
- Critical Gap 未确认时不展示完全批准为可用动作。
- 固定文档恰好 8 份；动态专项文档不计入核心数量。
- Python、云服务、桌面工具、AI 应用文档没有无来源机制偏见。
- ZIP 任一文件失败时不返回“部分成功”。

```powershell
pnpm exec vitest run packages/core/tests/ReadinessActionPolicy.test.ts packages/core/tests/DocumentExportService.test.ts tests/product-hardening/readiness-document-trust.test.ts tests/document-compiler tests/golden-documents --maxWorkers=2
pnpm build
pnpm exec vitest run --maxWorkers=2
```

## 5.7 阶段提示词

```text
实施 Product Hardening 阶段 5：准备度与文档交付可信化。

前提：阶段 1 的 AreaRegistry 已是唯一领域事实，阶段 2 的 Discovery Turn 和引用式转换已完成。

本阶段要求：
- Readiness 的八领域与 CORE_DISCOVERY_AREA_IDS 完全一致。
- coverage 与 credibility 分离；Assumption 只能降低或保持可信度，不能加分。
- 所有批准绑定 basisRevision；任何事实变化后旧批准立即 stale。
- Server 返回允许的 disposition actions、所需确认和阻断原因，Web 不自行猜测。
- 固定文档总数严格为 8，包含 AGENTS.md。
- 文档必须保存 sourceRevision、readiness review、hash 和来源覆盖统计。
- 原子导出失败时整体失败，不报告部分成功。
- Agent 交接提示根据实际 warning、assumption、known issue 和 revision 动态生成，不得宣称完整收敛。

先写 ReadinessActionPolicy、revision stale、文档数量、来源覆盖、ZIP 原子性和跨技术栈黄金测试。实现后运行文档与 Readiness 定向测试、build、全量测试。

最终报告给出一个 not-ready、一个 ready-with-warnings、一个 ready 项目的实际可用动作对比，并展示 revision 变化如何使旧批准和文档失效。
```

---

# 阶段 6：中文 UX、响应式、可访问性与材料生命周期

## 6.1 目标

让普通中文用户在桌面和窄窗口中都能明确知道当前任务、下一步和操作影响；完成键盘、标签、焦点、状态播报和材料管理的基础可用性。

## 6.2 布局策略

- ≥ 1200px：三栏，但 Overview 默认可收起，中心最小宽度 640px。
- 768–1199px：左侧栏变图标导航，Overview 为覆盖抽屉。
- < 768px：单栏；左右栏都使用 Modal Drawer，不能占据文档流宽度。
- 任意宽度不得把主内容压缩到 320px 以下。
- 切换抽屉时保留当前题目、滚动位置和草稿。

## 6.3 信息层级

对话主页面默认只展示：

1. 当前阶段和唯一下一步动作。
2. 当前问题或当前批次概览。
3. 可折叠的最近 Discovery 摘要。
4. 输入框。

完整 Candidate、Assumption、Gap、Risk、诊断和 refs 放入“查看本轮推演详情”。

## 6.4 中文词汇表

| 内部术语 | 默认界面 |
|---|---|
| Candidate | 建议 |
| Assumption | 待验证假设 |
| Confirmed | 已确认 |
| Locked | 已锁定 |
| Unexplored | 未探索 |
| Mostly Clear | 基本清晰 |
| Readiness Gate | 开发准备度 |
| Engineering Blueprints | 开发文档 |
| Disposition | 处理结论 |

B3、revision、decision_key、refs 等仅在“技术详情”中显示。

## 6.5 文件范围

**Create:**

- `apps/web/src/components/layout/ResponsiveDrawer.tsx`
- `apps/web/src/components/common/TechnicalDetails.tsx`
- `apps/web/src/features/settings/ProjectDiagnosticsView.tsx`
- `apps/web/src/features/files/MaterialActions.tsx`
- `apps/web/tests/responsive-workspace.test.ts`
- `apps/web/tests/accessibility-semantics.test.ts`

**Modify:**

- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/app/HomeView.tsx`
- `apps/web/src/components/layout/LeftSidebar.tsx`
- `apps/web/src/components/layout/TopNav.tsx`
- `apps/web/src/components/common/StatusBadge.tsx`
- `apps/web/src/components/common/Toast.tsx`
- `apps/web/src/features/chat/ChatView.tsx`
- `apps/web/src/features/chat/DiscoveryResultCard.tsx`
- `apps/web/src/features/chat/QuestionCard.tsx`
- `apps/web/src/features/chat/QuestionWizard.tsx`
- `apps/web/src/features/overview/OverviewDrawer.tsx`
- `apps/web/src/features/readiness/ReadinessView.tsx`
- `apps/web/src/features/documents/DocumentsView.tsx`
- `apps/web/src/features/files/FilesView.tsx`
- `apps/web/src/features/files/UploadMaterialModal.tsx`
- `apps/web/src/styles/index.css`

## 6.6 任务

### Task 6.1：响应式布局

- [ ] 先建立 390×844、768×900、1024×768、1280×720、1440×900 五个视口测试。
- [ ] 实现断点布局和抽屉焦点陷阱。
- [ ] Escape 关闭抽屉，关闭后焦点返回触发按钮。
- [ ] 抽屉打开时背景不可键盘访问。

### Task 6.2：表单和问题可访问性

- [ ] 四项创建输入使用 `label htmlFor`，错误说明用 `aria-describedby`。
- [ ] Question radio 支持键盘和 `aria-checked`。
- [ ] Toast 使用 `aria-live`；错误不自动快速消失。
- [ ] 图标按钮具有 aria-label，不依赖 title。
- [ ] 最小触控目标 44×44px；正文辅助文字默认不低于 12px。

### Task 6.3：中文化和技术详情

- [ ] 替换默认中英混排。
- [ ] 原始 refs、英文 area、Token、B3 诊断放入 TechnicalDetails。
- [ ] 专业术语首次出现给出一句短解释。

### Task 6.4：渐进披露

- [ ] DiscoveryResultCard 默认展示中文摘要和计数。
- [ ] 回答过程中自动折叠已读分析，但用户可恢复展开。
- [ ] NextBestAction 只显示一个主动作。
- [ ] 已回答问题集中在“本批已完成 N 项”抽屉，不重复展示。

### Task 6.5：材料生命周期

- [ ] 增加删除到 Trash、替换、重新提取和失败重试。
- [ ] 上传前展示扩展名、可提取性和是否会进入 AI 上下文。
- [ ] 展示实际提取字符数、截断状态、引用 Decision 和引用 Turn。
- [ ] 图片仅保存未分析时必须在选择文件后、提交上传前明确告知。

### Task 6.6：恢复体验

- [ ] 记住最近打开项目和最后 Tab，但启动时允许用户返回首页。
- [ ] 项目 Registry 在每次规范 commit 后更新 stage 和 updatedAt。
- [ ] 草稿恢复提示说明恢复来源和时间。

## 6.7 验证

```powershell
pnpm exec vitest run apps/web/tests/responsive-workspace.test.ts apps/web/tests/accessibility-semantics.test.ts apps/web/tests/ux-enhancements.test.ts --maxWorkers=1
pnpm --filter @project-architect/web build
pnpm build
pnpm exec vitest run --maxWorkers=2
```

浏览器人工路径：创建项目 → 查看初始分析 → 选择问题 → 键盘确认 → 跳过问题 → 打开 Overview → Readiness → Documents → Settings → Materials。每个关键状态保存截图；390px 和 1280px 必须各跑一次。

## 6.8 阶段提示词

```text
实施 Product Hardening 阶段 6：中文 UX、响应式、可访问性与材料生命周期。

不要改变 Core 决策语义、B3 Prompt 或 Provider 调用次数。本阶段只消费阶段 1–5 已稳定的 View/API。

必须实现：
- ≥1200px 三栏且中心不小于 640px；768–1199px Overview 覆盖抽屉；<768px 单栏双抽屉。
- 390×844 下主任务完整可读可操作，不能出现中心竖条。
- 四项输入有真实 label；问题选项有 radio 语义与完整键盘操作；Toast 有 aria-live；抽屉有焦点陷阱和焦点返回。
- 默认界面中文化，B3、refs、revision、Token、英文 area 收入技术详情。
- 对话页只保留一个下一步主动作，完整分析渐进披露。
- 材料支持排除、删除到 Trash、替换、重新提取、失败重试和解析能力预检。
- Registry 跟随规范 commit 更新，恢复最近项目和草稿时给出清晰提示。

先写响应式和语义测试，再修改组件。完成后运行 Web 定向测试、Web build、workspace build、全量测试，并使用浏览器在 390、768、1024、1280、1440 宽度验证关键路径。

最终报告必须附桌面与窄屏关键截图，列出键盘路径、焦点顺序、仍需真实屏幕阅读器或颜色对比工具验证的限制。
```

---

# 阶段 7：性能、完整 B3 Benchmark 与发布门槛

## 7.1 目标

用真实证据证明 B3 在四阶段下的问题质量、独立性、安全性、中文可读性、缓存行为和时延达到发布门槛。

## 7.2 Benchmark 设计

离线结构测试：

- 四阶段严格执行 12/8/4/2 上限。
- 依赖链、未知依赖、循环依赖、重复 key。
- 旧决策防重复、Locked 保护、revision stale。
- 推荐 key 与 option key 一致。

真实 Provider 测试：

- 现有 14 个 fixture 全部执行 initial。
- 选择至少 4 个 fixture 继续执行 explore、converge、readiness 快照。
- 每个用户操作只调用一次 Provider。
- 并发度 1，记录 duration、input/output/thinking/cache tokens。

人工评分：

```ts
export interface ManualQuestionReview {
  relevance: number;
  decisionValue: number;
  independentAnswerability: number;
  clarity: number;
  impactUsefulness: number;
  notes: string;
}
```

每项 1–5 分，至少两轮独立复核；有分歧时保留两份评分，不用平均值掩盖问题。

## 7.3 性能优化顺序

1. 将稳定 Constitution、Schema 指令和固定规则放在稳定 Prompt 前缀。
2. 动态项目状态、用户输入和 Gap 放在后缀。
3. Question Context 只包含相关 Locked、相关 area 决策、开放 Gap 和本轮 Input。
4. 已回答历史通过摘要和 decisionKey 防重复，不发送完整旧卡片。
5. Provider 报告真实 cache capability 和 cache read tokens；不伪造应用级缓存。
6. 相同 revision、相同 mode、相同输入 hash 可复用已完成 Turn；任何状态变化立即失效。

## 7.4 文件范围

**Create:**

- `experiments/agent-benchmark/src/b3-quality-evaluator.mjs`
- `experiments/agent-benchmark/src/b3-stage-fixtures.mjs`
- `experiments/agent-benchmark/reports/B3_RELEASE_VALIDATION_REPORT.md`
- `tests/product-hardening/b3-stage-contract.test.ts`
- `tests/product-hardening/discovery-cache.test.ts`

**Modify:**

- `experiments/agent-benchmark/src/b3-runner.mjs`
- `experiments/agent-benchmark/package.json`
- `packages/agent/src/context/profiles/BaseContextProfile.ts`
- `packages/agent/src/context/profiles/QuestionContext.ts`
- `packages/agent/src/orchestrator/AIOrchestrator.ts`
- `packages/agent/src/provider/AntigravityCliProvider.ts`
- `packages/contracts/src/provider.ts`
- `docs/blueprint/05_AI_PROVIDER.md`
- `docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md`
- `docs/blueprint/implementation/14_TEST_STRATEGY.md`
- `docs/blueprint/implementation/15_RUNTIME_CONFIG.md`

## 7.5 自动门槛

- Structured output success：100%。
- 用户授权越权：0。
- Locked 覆盖：0。
- 单次操作多 Provider 调用：0。
- 问题预算违规：0。
- 重复 decision key：0。
- 同批依赖冲突：0。
- 推荐 key 不存在：0。
- 默认问题字段非中文：0；允许的英文只限专业术语与固有名词。
- 绝对隐私声明与 Provider 实际能力矛盾：0。
- 实现机制泄漏检测不能只靠关键词；人工复核必须记录结果。

## 7.6 人工门槛

- 相关性平均 ≥ 4/5，且无单题低于 3。
- 决策价值平均 ≥ 4/5。
- 独立可回答性平均 ≥ 4/5。
- 清晰度平均 ≥ 4/5。
- 选项影响有用性平均 ≥ 4/5。
- initial 项目有足够独立 Gap 时生成 8–12 题；不足时不凑数。

## 7.7 性能门槛

先记录真实 p50/p95，再用证据确定目标。首轮建议门槛：

- p50 ≤ 30 秒。
- p95 ≤ 60 秒。
- Question Context ≤ 12,000 字符。
- 输入 Token 相比 2026-08-27 基线下降至少 25%。
- 稳定前缀场景能观察到 cache read tokens；不支持缓存时 UI 明确显示 unsupported/unknown。
- 取消后 2 秒内 UI 进入 cancelled，任何晚到结果不提交。

## 7.8 发布清单

```powershell
pnpm build
pnpm exec vitest run --maxWorkers=2
pnpm --dir experiments/agent-benchmark run b3:validate
```

发布报告必须包含：Git revision、环境、Provider、模型、全部 case、失败 case、原始结果路径、人工评分、时延分布、Token 分布、缓存证据和未解决风险。任何门槛不满足，报告结论必须是 NOT READY。

## 7.9 阶段提示词

```text
实施 Product Hardening 阶段 7：性能、完整 B3 Benchmark 与发布门槛。

不要为了让报告通过而放宽 Schema、删除失败 case、降低评分门槛或隐藏异常。真实 Provider 每个 case 只允许一次主要调用，并发度 1。

完成：
- 扩展 b3-runner，覆盖 14 个 initial fixture，并为至少 4 个 fixture 构造 explore、converge、readiness 状态。
- 自动检查四阶段预算、重复 key、直接/传递依赖、推荐 option key、中文字段、用户授权、Locked 和调用次数。
- 增加独立人工评分数据结构，相关性、决策价值、独立可回答性、清晰度、影响有用性全部填写，禁止 null。
- 调整 Context：稳定规则前缀与动态后缀分离；Question Context 保持 12,000 字符上限；只发送相关决策、Gap 和本轮输入。
- 验证 Provider prompt cache，不把 cache_read_tokens 的一次出现误写成稳定支持。
- 统计 p50/p95、Token、cache、取消时延和 stale 丢弃。
- 生成 B3_RELEASE_VALIDATION_REPORT.md。任何门槛失败时结论为 NOT READY，并列出下一步。

先运行离线结构测试，再运行真实 Provider benchmark，最后运行 workspace build 和 maxWorkers=2 全量测试。

最终答复只报告可复验结果，提供原始与 normalized 结果路径。不得用“结构化成功率 100%”替代人工质量结论。
```

---

# 5. 阶段间兼容与提交策略

建议提交粒度：

```text
phase 0: test baseline / docs archive markers
phase 1: area contracts / migration / structured create / projections
phase 2: suggestion schema / transitions / durable input / turn history
phase 3: question contract / checklist templates / progress / skip / accessibility
phase 4: provider diagnostics / fork / trash / settings
phase 5: readiness policy / document manifest / diff / atomic export
phase 6: responsive shell / localization / accessibility / materials
phase 7: context performance / benchmark / release report
```

每个提交应只包含一个可解释的状态变化，测试文件与实现文件一起提交。不要把格式化整个仓库与功能修改混在同一提交。

# 6. 全局完成定义

全部阶段完成必须同时满足：

- 四项创建输入正确进入至少三个领域。
- 任意 Confirmed/Locked 决策都能在 Overview 或明确的跨领域视图找到。
- Candidate/Assumption 转换使用稳定引用且不留下重复活跃状态。
- 用户自由输入在 Provider 启动前已持久化。
- 刷新后能看到真实 Discovery Turn、Risk 和时间，不重建伪历史。
- 推荐只能选择真实 option。
- Wizard 真正跳过会写入 dismissed。
- Provider 状态和隐私说明与实际能力一致。
- Fork 所有规范文件 projectId 一致；删除可恢复。
- Readiness 八领域与 Overview/B3 完全一致，批准绑定当前 revision。
- 固定文档准确为 8 份，Manifest 可追溯，导出原子化。
- 390px 单栏可完成核心路径；桌面中心宽度不被挤压。
- 表单、选项、抽屉、Toast 具备基本键盘和语义支持。
- 14 个真实场景与阶段 Benchmark 达标，人工评分无空值。
- `pnpm build` 和 `pnpm exec vitest run --maxWorkers=2` 全部通过。

# 7. 自审检查

执行本计划前后都要核对：

- 每个 A01–A24 是否有明确阶段和测试。
- 新类型名称在 contracts、core、server、web 和 benchmark 中一致。
- 没有新增数据库、登录、云同步或 Multi-Agent。
- 没有通过多次 Provider 调用提高表面质量。
- 没有把 AI 建议直接变成 Confirmed。
- 没有为了兼容旧项目而静默破坏 Locked。
- 没有把本地存储宣传成本地推理。
- 没有仅凭截图宣称完整可访问性合规。

