# Project Architect V1 — Phase 2.2：Question Engine 交付报告

> **报告时间**：2026-08-22  
> **所属阶段**：Phase 2 — Discovery Intelligence (Sub-phase 2.2)  
> **阶段结论**：**Phase 2.2 Complete & Verified — Ready for Phase 2.3 (Assumption / Decision Policy)**  
> **自动化测试**：10 个测试套件，27 项用例 100% 通过（新增 5 项 Question Engine 专项用例）。

---

## 1. Phase 2.2 交付成果清单

| 交付项 | 路径 | 核心能力说明 |
| :--- | :--- | :--- |
| **契约兼容性增强** | `packages/contracts/src/questions.ts` | 为 `QuestionItem` 补充 `whyNow`, `impact`, `gapRef`, `priority` 别名，100% 保持向后兼容。 |
| **智能提问与优先级引擎** | `packages/core/src/questions/QuestionEngine.ts` | 实现了严格 7 级领域优先级、冻结的提问预算门控、低风险自动 Assumption 生成与防重复提问机制。 |
| **核心包导出更新** | `packages/core/src/index.ts` | 统一向外部提供 `QuestionEngine` 接口。 |
| **专项单元测试套件** | `packages/core/tests/QuestionEngine.test.ts` | 覆盖高优先级单问、普通批量（最多2问）、Low 自动 Assumption、防重复提问与提问元数据完整性。 |

---

## 2. 核心机制设计

```text
┌─────────────────────────────────────────────────────────────┐
│                    Question Engine Pipeline                 │
├─────────────────────────────────────────────────────────────┤
│ 输入：Prioritized GapItem[] (来自 GapDetectionEngine)        │
│       ProjectSnapshot (当前项目决策、已回答问题与成熟度)       │
│       DiscoveryResult.questions (AI 动态生成的推荐问题)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ↓
                   [ 1. 防重复与已闭合过滤 ]
          (过滤已回答问题、已 Confirmed/Locked 的领域)
                               ↓
                   [ 2. 严重度分流与预算控制 ]
      ┌────────────────────────┼────────────────────────┐
      ↓                        ↓                        ↓
[ Critical / High ]        [ Normal ]                 [ Low ]
- 默认 1 个核心问题        - 最多 2 个相关问题        - 0 个提问
- 最多 +1 直接依赖问题     - 同一领域聚焦             - 自动转为 Assumption
      └────────────────────────┬────────────────────────┘
                               ↓
                   [ 3. 提问元数据与推荐强化 ]
       (注入 whyNow, recommendation, reason, option impacts)
                               ↓
              输出 { questions: [], autoAssumptions: [] }
```

### 2.1 严格执行的提问预算 (Frozen Question Budget)
- **Critical / High Gaps**：单次交互严格只提出 **1 个核心问题**（若存在显式 `dependency`，最多允许 +1 个直接依赖问题）。即使存在多个高危缺口，也按 7 级优先级只向用户抛出当前最首要的一个。
- **Normal Gaps**：仅在无 Critical/High 问题时呈现，严格限制在 **最多 2 个紧密相关问题**。
- **Low Gaps**：**绝不向用户发起提问**，自动生成并记录为 `AssumptionItem`（`status: 'active'`）。

### 2.2 提问元数据质量保证
每个生成的 `QuestionItem` 均满足：
1. **`whyNow` / `reason`**：明确说明“为什么现在必须决策（阻塞了什么）”；
2. **`recommendation`**：提供产品级推荐方向（严守 Capability Before Mechanism，绝不泄漏数据库/框架）；
3. **`recommendationReason`**：阐述推荐的权衡考量；
4. **`options`**：提供多选项，且每个选项均具备清晰的 `impact` 影响分析。

---

## 3. 自动化测试结果 (Vitest)

```powershell
$ pnpm test

 ✓ packages/contracts/tests/refs.test.ts (5 tests)
 ✓ packages/core/tests/GapDetection.test.ts (4 tests)
 ✓ packages/core/tests/QuestionEngine.test.ts (5 tests)
   - 1. Critical/High Budget: strictly enforces 1 primary question even when multiple critical gaps exist
   - 2. Normal Batch Budget: returns at most 2 related questions from top normal area
   - 3. Low Risk Auto-Assumption: emits 0 questions and produces AssumptionItem proposals
   - 4. Anti-Repetition: suppresses questions already answered or in clear/locked areas
   - 5. Question Rules: ensures mandatory whyNow, recommendation, and options with impact
 ✓ packages/core/tests/ChecklistSelector.test.ts (3 tests)
 ✓ packages/core/tests/StateCommit.test.ts (2 tests)
 ✓ tests/persistence-recovery.test.ts (1 test)
 ✓ packages/agent/tests/AIOrchestrator.test.ts (1 test)
 ✓ apps/server/tests/api.test.ts (1 test)
 ✓ tests/multi-turn.test.ts (1 test)
 ✓ packages/core/tests/ProjectStateEngine.test.ts (4 tests)

 Test Files  10 passed (10)
      Tests  27 passed (27)
   Duration  1.27s
```

---

## 4. Phase 2.2 审查结论与下一步

- **Phase 2.2（Question Engine）开发完成且 100% 通过测试**。
- 严格遵循了 B2.1 宪政的提问优先级与预算门控。
- **已停止进一步编码**，等待您审查本报告后下发 **Phase 2.3（Assumption / Decision Policy）** 开发指令！
