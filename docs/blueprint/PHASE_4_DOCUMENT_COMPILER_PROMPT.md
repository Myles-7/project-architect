# Project Architect Phase 4 — Document Compiler
# 开发文档生成系统
# 分阶段详细开发提示词

---

# 项目背景

当前项目：
Project Architect

当前完成状态：
- Phase 0: 产品边界与架构设计 ✅
- Phase 1: Core State Engine ✅
- Phase 2: Discovery Intelligence ✅
- Phase 2.5: Intelligence Refinement ✅
- Phase 3: Discovery Workflow Integration ✅
- Phase 3.5: Agent Runtime Stabilization ✅

---

# Phase 4 总目标

## Document Compiler

目标：
将已经经过 Discovery 流程明确的 Project State，转换成：
> 可以直接交给 Coding Agent 开始开发的软件项目文档包。

核心流程：
```text
Project State
     ↓
Readiness Evaluation
     ↓
Document Planning
     ↓
Document Compilation
     ↓
Markdown Output
     ↓
Coding Agent Input
```

---

# 核心设计原则（必须遵守）

## 原则 1：Document 不是 AI 重新设计项目
Document Compiler 的职责不是重新思考或随意扩充需求，而是：
`Confirmed Decision + Accepted Assumption + Approved Scope -> 结构化表达`。

## 原则 2：文档必须可信
严禁 AI 生成未确认功能、未讨论架构或虚构需求。所有内容必须标记来源（Confirmed, Assumption, Candidate, Generated Recommendation）。

## 原则 3：保持用户最终控制权
文档生成前必须经过：`Readiness Review -> User Approval -> Compile`。

## 原则 4：继续保持 Single Provider Call
一次文档生成最多一次 Provider 调用，禁止 Multi-Agent 辩论或重写流水线。

---

# Phase 4 开发阶段总览

================================================
## Phase 4.1 — Document State Model
================================================
- 新增：`packages/contracts/src/documents.ts`
  - `DocumentType`: `'project' | 'product' | 'user-flow' | 'ux-ui' | 'development-plan' | 'acceptance' | 'agents' | 'custom'`
  - `DocumentStatus`: `'draft' | 'generated' | 'approved' | 'exported'`
  - `DocumentReference`: `{ id, type, path, status, generatedAt, sourceRevision }`
- Project State 增加 `documents` 模块与版本追踪。
- 测试：`packages/contracts/tests/document.contract.test.ts`。

================================================
## Phase 4.2 — Readiness Gate
================================================
- 新增：`packages/core/src/readiness/ReadinessEvaluator.ts`
- 检查维度：
  - 产品：Vision, Target User, Problem, Goal
  - MVP：Core Feature, Out of Scope
  - UX：Main User Flow, Page Structure
  - Development：Platform, Constraints
- 输出：`ReadinessResult`，严格区分阻塞项（Blocking）与非阻塞告警（Warning）。
- 测试：`packages/core/tests/ReadinessEvaluator.test.ts`。

================================================
## Phase 4.3 — Document Compiler Engine
================================================
- 新增模块：`packages/core/src/documents/`
  - `DocumentPlanner.ts`：根据项目类型动态规划文档列表
  - `DocumentRenderer.ts`：模板与状态数据渲染引擎
  - `DocumentValidator.ts`：禁止 Candidate 越权转 Confirmed、校验 Locked 一致性
  - `DocumentCompiler.ts`：编译器主流程协调
- 测试：`packages/core/tests/DocumentCompiler.test.ts`。

================================================
## Phase 4.4 — Markdown Template System
================================================
- 模板库：`packages/core/src/documents/templates/`
  - `AGENTS.md.template`
  - `PROJECT.md.template`
  - `PRODUCT.md.template`
  - `USER_FLOWS.md.template`
  - `UX_UI_SPEC.md.template`
  - `DEVELOPMENT_PLAN.md.template`
  - `ACCEPTANCE.md.template`
- 要求：模板与 Project State 数据动态插值结合。

================================================
## Phase 4.5 — Document Compile Agent Mode
================================================
- 完善 `document-compile` Agent 模式下的 Prompt 与 Schema；
- 上下文隔离，仅注入文档合成所需结构化数据。

================================================
## Phase 4.6 — End-to-End Document Validation
================================================
- 真实黄金项目端到端验证：
  - Case 1: Todo App（极简项目文档包）
  - Case 2: AI Knowledge Base（中等项目动态文档包）
  - Case 3: Project Architect（复杂自举项目文档包）

================================================
## Phase 4.7 — Phase Completion Review
================================================
- 输出：`docs/reports/PHASE_4_COMPLETION_REPORT.md`。
