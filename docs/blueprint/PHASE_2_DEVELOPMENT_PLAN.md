# Project Architect V1 — Phase 2：Discovery Intelligence 开发计划 (Development Plan)

> **文档状态**：Official Phase 2 Development Plan  
> **前置条件**：Phase 1 Core Engine 已冻结且测试 100% 通过  
> **目标**：将 Phase 2 拆分为 5 个清晰、可独立测试与验收的工程开发子阶段。

---

## 1. 子阶段拆分概览

```text
Phase 2.1: Gap Engine (缺口发现与 Checklist 深度融合)
     ↓
Phase 2.2: Question Engine (7 级优先级与受控提问预算)
     ↓
Phase 2.3: Assumption Policy (假设分类与防技术泄漏策略)
     ↓
Phase 2.4: Discovery Integration (端到端单次调用流转与上下文预算)
     ↓
Phase 2.5: Regression Validation (Benchmark 黄金用例回归与行为验证)
```

---

## 2. 子阶段详细规划

### Phase 2.1 — Gap Engine（缺口发现引擎）

#### 目标
实现 Universal Checklist、领域专项 Checklist 与 LLM 动态缺口分析的确定性合并、去重与状态过滤。

#### 输入与输出
- **输入**：`ProjectSnapshot`、`projectTags`、`checklists/universal.json`、`checklists/types/*.json`。
- **输出**：结构化的 `GapItem[]`（包含 `area`, `severity`, `reason`, `impact`, `shouldAskUser`），持久化至 `state/gaps.json`。

#### 验收测试
- 单元测试：验证多 Tag 项目能正确合并对应领域的 Checklist 条目并基于 `id` 强去重。
- 状态测试：验证当某个产品领域在 Overview 中已达 `clear` 或 `locked` 成熟度时，相关条目被自动过滤。

---

### Phase 2.2 — Question Engine（提问与优先级引擎）

#### 目标
落地 B2.1 严格的 7 级提问优先级算法与冻结的问题预算门控（Critical/High 1 个，Normal 最多 2 个，Low 0 个）。

#### 输入与输出
- **输入**：`state/gaps.json` 中的当前未决条目（Open Gaps, Conflicts, Tensions）。
- **输出**：结构化的 `QuestionItem[]`，包含完整 `question`, `reason`, `recommendation`, `recommendationReason`, `options` 与 `allowFreeInput: true`。

#### 验收测试
- 预算截断测试：当 AI 或多个 Gaps 试图生成 > 2 个问题时，引擎强制按 7 级优先级截断并仅保留最高优先级问题。
- 字段完整性测试：验证所有输出问题均具备产品级推荐理由与选项影响说明。

---

### Phase 2.3 — Assumption Policy（假设与可逆性策略）

#### 目标
实现低风险细节自动记录为 Assumption、中风险由用户确认、高风险强制升级为 Question 的分级流转机制，坚决杜绝技术机制泄漏。

#### 输入与输出
- **输入**：Agent 输出的 `assumptions` 与未闭合的低风险产品细节。
- **输出**：`state/assumptions.json` 中的 `AssumptionItem[]`（`status: 'active'` 或 `'converted'`）。

#### 验收测试
- 行为断言测试：验证 Assumption 中绝不包含具体数据库名（如 SQLite）、前端框架名（如 React）或特定协议。
- 状态转换测试：用户一旦显式确认某条 Assumption，系统原子生成 `Confirmed Decision` 并将该 Assumption 标记为 `converted`。

---

### Phase 2.4 — Discovery Integration（统一运行时集成）

#### 目标
完成 `apps/server`、`AIOrchestrator`、`ContextManager`、`AntigravityCliProvider` 与 `ProjectStateEngine` 的端到端多轮流转联调。

#### 输入与输出
- **输入**：用户连续提交的自然语言陈述、问题选项回答与上传材料。
- **输出**：两阶段 Commit 后的最新 `stateRevision` 与更新后的 `ProjectSnapshot`。

#### 验收测试
- 大上下文测试：在 10+ 附件材料与多轮历史累积下，验证 ContextManager 严格受控于 32,000 字符预算，无上下文爆炸。
- 错误隔离测试：模拟 Provider 超时或格式非法，验证 `state/*.json` 物理文件 100% 零修改。

---

### Phase 2.5 — Regression Validation（Benchmark 黄金用例回归）

#### 目标
使用 `experiments/agent-benchmark` 中的权威测试套件对集成后的系统执行行为回归，确保 B2.1 宪政无衰退。

#### 重点回归用例
1. **Case-01 (Blurry Initial Idea)**：验证对极其模糊的 Idea 先输出结构化首次理解，不直接抛出连环问卷。
2. **Case-03 (Strict Hard Conflict)**：验证仅对两条确认的排他硬约束产生 Conflict，普通取舍不误报。
3. **Case-05 (Technical Leakage Trap)**：验证在用户提出业务需求时，Agent 坚守 `Capability Before Mechanism`，零技术框架/数据库提前泄漏。
4. **Case-08 (Rich Input Materials)**：验证上传 PRD/文档材料后，关键业务事实被精准抽取与关联。
5. **Case-09 (Reversible Assumptions)**：验证常规可逆细节被正确归入 Assumption 而不打扰用户。

#### 验收门槛
- 10 大 Benchmark Cases 全部 100% 结构化输出成功。
- 技术泄漏违规率（Mechanism Leakage）= **0**。
- 重复提问率（Repeated Questions）= **0**。
