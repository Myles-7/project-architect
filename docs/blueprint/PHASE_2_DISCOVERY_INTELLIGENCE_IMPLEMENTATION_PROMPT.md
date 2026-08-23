# Project Architect V1
# Phase 2 — Discovery Intelligence Implementation Prompt

## 核心智能层开发阶段

---

# 你的任务

你现在负责实现：

```text
Project Architect V1
Phase 2 — Discovery Intelligence
```

目标：

> 让 Project Architect 从“状态管理系统”升级为“能够理解项目、发现未知、主动引导用户思考”的 AI 产品规划 Agent。

---

# 非目标（必须遵守）

本阶段：

## 不开发：

- UI
- Overview 页面
- Markdown 文档生成
- Coding Agent
- Multi-Agent
- BMAD Workflow
- Requirement DAG
- 知识图谱
- 企业权限系统
- 数据库

---

# 当前系统基础

已经完成：

## Phase 0

- Blueprint
- Architecture
- Contracts
- Agent Runtime Design

## Phase 1

已经实现：

- packages/contracts
- packages/core
- packages/agent
- apps/server

核心能力：

```text
Project State
Persistence
State Commit
AI Provider
Context Manager
AI Orchestrator
REST API
```

---

# Phase 2 总目标

当前：

```text
Idea
↓
AI Analysis
↓
State Update
```

升级为：

```text
User Idea
↓
Discovery Turn
↓
Gap Detection
↓
Question Prioritization
↓
User Answer
↓
Decision Update
↓
Project State Evolution
```

---

# 核心设计原则

## 1. AI不是事实源

AI只能产生：

```text
Candidate
Gap
Risk
Tension
Conflict
Question
Recommendation
```

Core负责：

```text
保存
校验
状态转换
用户确认
```

---

# 2. 继承 B2.1 Rules

必须保持：

## Capability Before Mechanism

禁止主动提出：

- React
- Vue
- PostgreSQL
- SQLite
- API方案
- OAuth
- E2EE
- Zero Knowledge
- CRDT
- WebSocket
- 云架构

除非：用户明确进入技术设计阶段。

---

# 3. Product First

所有 Discovery 优先顺序：

```text
Product Identity
User
Core Problem
Core Workflow
MVP Scope
Trust/Safety Promise
UX Tradeoff
Technical Constraint
```

---

# Phase 2 开发拆分

必须严格按照以下顺序：

```text
Phase 2.1
Gap Detection Engine
↓
Phase 2.2
Question Engine
↓
Phase 2.3
Assumption / Decision Policy
↓
Phase 2.4
Discovery Runtime Integration
↓
Phase 2.5
Regression Validation
```

禁止跳阶段。

---

# =====================================
# Phase 2.1 — Gap Detection Engine
# =====================================

## 目标

实现：

```text
Project State
Checklist
AI Discovery Result
↓
Gap Candidates
```

## 功能要求

### 1. Gap 数据模型

使用已有 contracts。

如果需要扩展：
必须：
- 说明原因；
- 更新 schema；
- 增加 migration。

禁止直接修改。

Gap 包含：
- id
- area
- description / reason
- severity (critical, high, medium, low)
- impact
- dependency
- shouldAskUser
- source ('checklist' | 'ai' | 'user' | 'system')

### 2. Checklist Integration

读取：
- checklists/universal.json
- checklists/types/*.json

根据 `projectTags` 选择匹配规则。
限制：一次进入 AI Context 最多 8~12 条 checklist。禁止全部注入。

### 3. Gap Priority

实现轻量排序，考虑：
Impact + Uncertainty + Irreversibility + Dependency + Stage Relevance。

### 4. 测试与报告

新增：`GapDetection.test.ts`
覆盖：
- 模糊 Idea
- 已明确项目
- MVP范围缺失
- 技术问题不应优先

输出：`docs/reports/PHASE_2_1_GAP_ENGINE_REPORT.md`，完成后停止。

---

# =====================================
# Phase 2.2 — Question Engine
# =====================================

## 目标

实现：
```text
Gap
↓
Priority
↓
Question
```

## Question 数据结构与规则

必须包含：
`id`, `gapRef`, `question`, `reason`, `whyNow`, `priority`, `options`, `recommendation`, `impact`

### Question Budget
严格执行：
- Critical / High: 默认 1 个问题，最多 1 + 直接依赖问题
- Normal: 最多 2 个相关问题
- Low: 不要询问，生成 Assumption

### 防重复机制
检查已有 decisions、已回答 questions、locked items，已回答的禁止再次询问。

### 测试与报告
新增：`QuestionEngine.test.ts`
输出：`docs/reports/PHASE_2_2_QUESTION_ENGINE_REPORT.md`

---

# =====================================
# Phase 2.3 — Assumption / Decision Policy
# =====================================

## 目标

完善：
```text
AI Suggestion → Candidate → User Confirm → Confirmed Decision
```

## 实现内容
- Assumption Manager（创建、查看、确认转为 Decision）
- 自动决定规则（Low Risk 自动 Assumption；Medium 用户确认；High 必须提问）
- Locked 保护（AI 无法覆盖，产生互斥条件时创建 Conflict）

### 测试与报告
新增：`DecisionPolicy.test.ts`
输出：`docs/reports/PHASE_2_3_POLICY_REPORT.md`

---

# =====================================
# Phase 2.4 — Discovery Runtime Integration
# =====================================

## 目标

将各模块无缝连接入统一运行时：
```text
Input → ContextManager → Discovery Turn → Gap Detection → Question Engine → Policy Engine → State Commit → Overview Projection
```

保持单次 Agent 调用（One Agent Call）。

### 测试与报告
新增：`discovery-runtime.test.ts`
输出：`docs/reports/PHASE_2_4_RUNTIME_REPORT.md`

---

# =====================================
# Phase 2.5 — B2.1 Regression Validation
# =====================================

## 目标

验证 Phase 2 没有破坏 B2.1 Agent 行为。

测试用例：
- case-01 (Blurry idea)
- case-03 (Strict conflict)
- case-05 (Technical leakage trap)
- case-08 (Rich materials)
- case-09 (Reversible assumptions)

检查指标：
- Technology Discipline (零机制提前决定)
- Conflict Precision (真正硬冲突)
- Question Quality (为什么现在问、推荐合理、无重复)
- Assumption Safety (低风险默认值可溯源)

输出：`docs/reports/PHASE_2_FINAL_VALIDATION_REPORT.md`
