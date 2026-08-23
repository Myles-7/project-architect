# Project Architect Phase 4.5 — Document Quality Stabilization
# 文档质量稳定化阶段开发提示词

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
- Phase 4: Document Compiler ✅

---

# Phase 4.5 总目标

## Document Quality Stabilization

目标：
将 Document Compiler V1 从：
> 可以生成开发文档

升级为：
> 生成可信、可追踪、可维护、适合长期开发使用的项目文档系统。

---

# 核心原则（必须保持）

## 原则 1：Document 不是需求来源
唯一事实来源是 `Project State`。文档只是结构化投影，严禁文档反向修改事实。

## 原则 2：不增加 AI 自由生成范围
重点在于提升可追踪性、一致性与可信度，而非让 AI 随意扩充需求。

## 原则 3：保持确定性优先
`State + Rules + Templates` 优先，而非全靠 LLM 自由生成。

## 原则 4：保持 B2.1 约束
- Candidate 不能变 Confirmed
- Locked 决策不可自动修改
- Assumption 必须明确
- 单 Provider 调用

---

# Phase 4.5 开发拆分

================================================
## Phase 4.5.1 — Source Attribution System
================================================
- 扩展 `packages/contracts/src/documents.ts`:
  - `SourceAttribution`: `'confirmed' | 'locked' | 'assumption' | 'generated-structure'`
  - `DocumentSourceMarker`: `{ type: SourceAttribution; sourceId?: string; description?: string; }`
- 升级 `DocumentRenderer`: 所有关键事实输出来源标签（如 `[Confirmed] ... Source: Decision dec-001`）。
- 升级 `DocumentValidator`: 校验所有事实来源与 State 真实性。
- 测试：`packages/core/tests/DocumentSourceAttribution.test.ts`。

================================================
## Phase 4.5.2 — Knowledge Completeness Readiness Model
================================================
- 新增 `packages/core/src/readiness/KnowledgeChecklist.ts`:
  - 8 大核心领域知识结构：Vision, User, Problem, Scope, Flow, UX, Constraints, Acceptance。
- 重构 `ReadinessEvaluator.ts`:
  - 基于结构化 Knowledge Checklist 评估；
  - 输出 `knowledgeScore` 及成熟度等级（Level 1 Idea ~ Level 5 Stable）。
- 测试：`packages/core/tests/ReadinessKnowledgeModel.test.ts`。

================================================
## Phase 4.5.3 — Document Revision & Diff System
================================================
- 扩展 `DocumentsState`:
  - `DocumentRevision`: `{ documentRevision, sourceRevision, generatedAt, outdated }`
- 新增 `packages/core/src/documents/DocumentDiffEngine.ts`:
  - 检测文档是否过期（`currentStateRevision > doc.sourceRevision`）；
  - 决策修改跨文档影响分析（如修改 Target User 影响 PROJECT/PRODUCT/FLOWS/UX）。
- 测试：`packages/core/tests/DocumentDiffEngine.test.ts`。

================================================
## Phase 4.5.4 — Golden Document Review
================================================
- 建立测试目录：`tests/golden-documents/`
  - Case 1: `space-cleaner.test.ts`（桌面清理工具）
  - Case 2: `ai-knowledge-base.test.ts`（AI 知识库与 AI_SPEC）
  - Case 3: `project-architect.test.ts`（自举 9 份全套文档）

================================================
## Phase 4.5.5 — Phase Stabilization Review
================================================
- 输出验收报告：`docs/reports/PHASE_4_5_COMPLETION_REPORT.md`。
