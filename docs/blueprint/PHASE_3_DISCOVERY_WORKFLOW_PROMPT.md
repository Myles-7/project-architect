# Project Architect Phase 3 — Discovery Workflow Integration
# 超详细分阶段开发任务提示词

## 项目背景

当前项目：
Project Architect

目标：
构建一个帮助用户在 AI Coding 前明确项目构思的 AI 项目规划工作台。

当前已完成：
- Phase 0: 蓝图收口与架构设计冻结
- Phase 1: Core Engine（本地状态引擎、两阶段 Commit、文件持久化、崩溃恢复、REST API）
- Phase 2: Discovery Intelligence（Gap 发现、Question 优先级与受控预算、Assumption/Decision Policy、运行时集成、B2.1 黄金用例回归）

---

# Phase 3 总目标

## Discovery Workflow Integration

目标：
将已有模块组合成真正可运行的 Project Architect Discovery 工作流。
从“多个核心模块存在”升级为“用户输入一个 Idea，可以经过多轮交流，形成稳定 Project State”。

---

# Phase 3 核心原则（必须遵守）

## 原则 1：保持 Single Agent Runtime
禁止：
- Multi-Agent
- Agent 互相讨论
- 多角色轮流执行

保持：
```text
Project Architect Agent
         │
     Agent Mode
         │
Antigravity Provider
```

## 原则 2：保持 B2.1 行为冻结
不得修改：
- Structured Output 契约
- 两阶段 State Commit
- AI 不能静默 Confirmed
- Locked Decision 保护
- 已回答问题不能重复询问

## 原则 3：不要提前开发 UI
Phase 3 重点：Backend Workflow 完整性。
暂不实现：React 页面、三栏布局、Overview 视觉设计。

## 原则 4：所有新增能力必须可测试
每增加 Router、Workflow、State 变化、Mode 切换，必须增加对应测试。

---

# Phase 3 分阶段计划

================================================
## Phase 3.1 — Agent Mode Router 基础实现
目标：让系统能够根据当前状态决定“现在应该执行什么类型的 Agent 行为”。
================================================

### 开发任务
- 新增：`packages/agent/src/router/AgentModeRouter.ts`
- 职责：根据 ProjectState、UserInput、CurrentStage、PendingQuestions、OpenGaps、Readiness 状态返回 `AgentMode`。
- `AgentMode` 支持：
  - `'idea-analysis'`
  - `'gap-analysis'`
  - `'question-generation'`
  - `'decision-review'`
  - `'readiness-review'`
  - `'document-compile'`
- Router 规则：
  - 新项目首次输入（无 Overview/Decision/Gap）-> `'idea-analysis'`
  - 已有 Overview 但存在 Gap -> `'gap-analysis'`
  - 存在 High/Critical Gap 需要用户输入 -> `'question-generation'`
  - 用户修改已有结论（修改目标用户、平台、MVP 等）-> `'decision-review'`
  - 用户请求开发准备度审查 -> `'readiness-review'`
  - 用户批准生成文档 -> `'document-compile'`
- 测试要求：`AgentModeRouter.test.ts`

================================================
## Phase 3.2 — Context Profile 系统
目标：让不同 Agent Mode 使用不同针对性上下文。
================================================

### 开发任务
- 新增：`packages/agent/src/context/profiles/`
  - `IdeaAnalysisContext.ts`
  - `GapAnalysisContext.ts`
  - `QuestionContext.ts`
  - `DecisionReviewContext.ts`
  - `ReadinessContext.ts`
- 规则：每个 Mode 拥有独立 Context 构建逻辑与预算控制。

================================================
## Phase 3.3 — AIOrchestrator Workflow 重构
目标：形成正式模块化 Workflow Pipeline。
================================================

### 开发任务
- 修改：`packages/agent/src/orchestrator/AIOrchestrator.ts`
- 拆分方法：
  - `selectMode()`
  - `buildContext()`
  - `executeAgentMode()`
  - `validateOutput()`
  - `applyPolicy()`
  - `commitState()`

================================================
## Phase 3.4 — 完整多轮 Discovery 闭环
目标：验证 Project Architect 核心价值。
================================================

### 真实测试场景（AI 知识管理工具）：
- Round 0: 用户输入 Idea -> Candidate 理解 + Unknown + Initial Gap
- Round 1: 发现 Target User unclear -> 生成 Question -> 用户回答 -> Target User Confirmed
- Round 2: 发现 MVP Scope unclear -> 提问 -> 确认 -> 生成 Overview v0.x
- 测试要求：`full-discovery-flow.test.ts`

================================================
## Phase 3.5 — Overview Synchronization & Affected Sections
目标：确保 Decision 真正改变项目状态，并检测修改决策带来的联动影响。
================================================

### 开发任务
- 决策确认自动同步至 Overview 对应 Section。
- 决策修改产生影响检测（例如目标用户从个人变更到小团队，触发 Features/UX/Pricing 影响警告）。

================================================
## Phase 3.6 — Golden Project Evaluation
目标：使用真实项目验证 Agent 质量。
================================================

### 案例库 (`tests/golden-projects/`)：
- Case 1 (简单项目): Todo App（验证不会过度提问）
- Case 2 (中等项目): AI 知识库（验证 Gap 质量）
- Case 3 (复杂项目): Project Architect 自身（验证复杂需求拆解）
- 记录指标：Gap 质量、Question 质量、Token 消耗、交互轮数。

================================================
## Phase 3.7 — Phase Review
================================================

- 输出：`docs/reports/PHASE_3_COMPLETION_REPORT.md`
- 验证所有验收标准。
