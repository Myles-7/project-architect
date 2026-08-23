# Project Architect V1 — Phase 2.3：Assumption / Decision Policy 交付报告

> **报告时间**：2026-08-22  
> **所属阶段**：Phase 2 — Discovery Intelligence (Sub-phase 2.3)  
> **阶段结论**：**Phase 2.3 Complete & Verified — Ready for Phase 2.4 (Discovery Runtime Integration)**  
> **自动化测试**：11 个测试套件，33 项用例 100% 通过（新增 6 项 Decision Policy 专项用例）。

---

## 1. Phase 2.3 交付成果清单

| 交付项 | 路径 | 核心能力说明 |
| :--- | :--- | :--- |
| **假设与决策策略引擎** | `packages/core/src/policy/DecisionPolicyEngine.ts` | 实现了三级风险分流、低风险自动 Assumption 录入、中风险 Candidate 等待确认、Assumption 转化为 Confirmed Decision、Locked 决策保护与冲突自发生成。 |
| **核心包导出更新** | `packages/core/src/index.ts` | 统一向外部提供 `DecisionPolicyEngine` 接口。 |
| **专项单元测试套件** | `packages/core/tests/DecisionPolicy.test.ts` | 覆盖低风险自动 Assumption、中风险 Candidate 确认、Assumption 转为 Decision、Locked 决策防篡改、互斥冲突自动生成与直接编辑历史替代。 |

---

## 2. 核心机制设计

```text
┌─────────────────────────────────────────────────────────────┐
│                 Decision & Assumption Policy Engine         │
├─────────────────────────────────────────────────────────────┤
│ 输入：AI Discovery Suggestions (candidates & assumptions)    │
│       ProjectSnapshot (当前项目 decisions, locked, status)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ↓
                   [ 1. 风险与影响分级评估 ]
      ┌────────────────────────┼────────────────────────┐
      ↓                        ↓                        ↓
[ Low Risk ]              [ Medium Risk ]          [ High Risk ]
(常规可逆细节/默认配置)   (功能范围/次要流程)      (破坏性/架构排他/隐私)
      ↓                        ↓                        ↓
自动录入为 Assumption     录入为 Candidate         提升为 Question
(status: 'active')        (等待用户授权确认)       (强制用户显式决策)
      │                        │
      └──────────────┬─────────┘
                     ↓
         [ 2. 用户显式授权升级 ]
  - Assumption 确认 -> status: 'converted' + 生成 Confirmed Decision
  - Candidate 确认  -> status: 'confirmed' (confirmedBy: 'user')
  - Confirmed 锁定  -> status: 'locked' (物理防篡改)
                     ↓
         [ 3. Locked 保护与冲突产生 ]
  - 若新建议与 Locked 决定互斥 -> 锁定项不变，自动创建 Critical ConflictItem
```

---

## 3. 自动化测试结果 (Vitest)

```powershell
$ pnpm test

 ✓ packages/contracts/tests/refs.test.ts (5 tests)
 ✓ packages/core/tests/GapDetection.test.ts (4 tests)
 ✓ packages/core/tests/QuestionEngine.test.ts (5 tests)
 ✓ packages/core/tests/DecisionPolicy.test.ts (6 tests)
   - 1. Low-risk suggestions are routed to active assumptions without user interruption
   - 2. Medium-risk suggestions are routed to candidates awaiting confirmation
   - 3. Promoting an assumption creates a confirmed decision and marks assumption converted
   - 4. Promoting a candidate upgrades it to confirmed with user origin
   - 5. Locked decision protection & automatic conflict generation on mutual exclusion
   - 6. Direct edit on locked decision marks old item superseded and creates new confirmed decision
 ✓ packages/core/tests/ChecklistSelector.test.ts (3 tests)
 ✓ packages/core/tests/StateCommit.test.ts (2 tests)
 ✓ packages/agent/tests/AIOrchestrator.test.ts (1 test)
 ✓ tests/persistence-recovery.test.ts (1 test)
 ✓ apps/server/tests/api.test.ts (1 test)
 ✓ tests/multi-turn.test.ts (1 test)
 ✓ packages/core/tests/ProjectStateEngine.test.ts (4 tests)

 Test Files  11 passed (11)
      Tests  33 passed (33)
   Duration  1.34s
```

---

## 4. Phase 2.3 审查结论与下一步

- **Phase 2.3（Assumption / Decision Policy）开发完成且 100% 通过测试**。
- 严格落实了“AI 不是事实源”与用户授权第一原则。
- **已停止进一步编码**，等待您审查本报告后下发 **Phase 2.4（Discovery Runtime Integration）** 开发指令！
