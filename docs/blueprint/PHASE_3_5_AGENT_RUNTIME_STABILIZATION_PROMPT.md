# Project Architect Phase 3.5 — Agent Runtime Stabilization
# 分阶段开发任务提示词

## 阶段目标

当前状态：
Phase 3 — Discovery Workflow Integration 已完成。

已经实现：
- AgentModeRouter
- Context Profile
- AIOrchestrator Pipeline
- Single Provider Call
- Structured Output
- Policy Engine
- Atomic State Commit
- Decision Trace
- Overview Sync
- Golden Project Tests

当前问题：
虽然 AgentMode 已存在，但目前所有 Mode 仍使用同一个统一的 discovery-turn Prompt 和统一 Schema。
AgentMode 目前主要影响 Context，而没有真正成为完整行为模式。

Phase 3.5 的目标：
> 将 AgentMode 从“流程标签”升级为真正的 Agent Runtime Behavior Profile。

最终架构：
```text
                  AgentMode
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
  Prompt Profile              Schema Profile
        │                           │
        └─────────────┬─────────────┘
                      ▼
               Context Profile
                      ▼
               Policy Profile
                      ▼
            Single Provider Call
                      ▼
                 State Commit
                      ▼
                 Trace Save
```

---

# 重要约束（必须保持）

## 1. 保持 Single Provider Call
禁止：Multi-Agent、多次模型调用、Agent 互相审查。
一次 Workflow 最多 1 次 Provider Call。

## 2. 保持 B2.1 冻结规则
不得破坏：
- AI 不能直接 Confirmed
- Locked Decision 不可自动修改
- Assumption 必须显式记录
- Conflict 必须提示
- State Commit 必须经过 Policy

## 3. 不提前开发 UI
Phase 3.5 只优化：Agent Runtime、Prompt、Schema、Workflow、Trace。暂不开发 UI。

---

# Phase 3.5 开发拆分

================================================
## Phase 3.5.1 — Prompt Profile 系统
================================================
- 新增目录：`packages/agent/src/prompts/`
  - `PromptProfile.ts`
  - `PromptLoader.ts`
  - `profiles/` (`idea-analysis.md`, `gap-analysis.md`, `question-generation.md`, `decision-review.md`, `readiness-review.md`, `document-compile.md`)
- 测试：`packages/agent/tests/PromptProfile.test.ts`

================================================
## Phase 3.5.2 — Schema Profile 系统
================================================
- 新增结构：`packages/agent/src/schemas/`
  - `idea-analysis.schema.json`
  - `gap-analysis.schema.json`
  - `question-generation.schema.json`
  - `decision-review.schema.json`
  - `readiness-review.schema.json`
  - `document-compile.schema.json`
- 更新 Provider 请求契约，支持分 Mode Schema。
- 测试：`packages/agent/tests/SchemaProfile.test.ts`

================================================
## Phase 3.5.3 — Agent Runtime Profile Registry
================================================
- 新增：`packages/agent/src/runtime/`
  - `AgentRuntimeProfile.ts`
  - `AgentRuntimeRegistry.ts`
- 职责：输入 `AgentMode` -> 返回完整的运行配置（Prompt Profile, Schema Profile, Context Profile, Policy Profile）。

================================================
## Phase 3.5.4 — Workflow Trace (AgentRunTrace)
================================================
- 合约扩展：`AgentRunTrace`
- 持久化：`runtime/agent-runs.json` 记录每一次调用的 Mode、Prompt、Context、Token 与版本跃迁。

================================================
## Phase 3.5.5 — Context Profile 验证增强
================================================
- 新增测试：`ContextIsolation.test.ts`，严格断言各模式上下文隔离性。

================================================
## Phase 3.5.6 — AIOrchestrator 最终重构
================================================
- 流程整合：
  `runDiscoveryTurn -> load State -> AgentModeRouter -> RuntimeRegistry -> ContextBuilder -> PromptBuilder -> SchemaResolver -> Single Provider Call -> Validator -> Policy Engine -> State Commit -> Trace Save`

================================================
## Phase 3.5.7 — Regression & Completion Report
================================================
- 全量自动化测试回归与验收报告：`docs/reports/PHASE_3_5_COMPLETION_REPORT.md`。
