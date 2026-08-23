# Project Architect V1 — Phase 2.1：Gap Detection Engine 交付报告

> **报告时间**：2026-08-22  
> **所属阶段**：Phase 2 — Discovery Intelligence (Sub-phase 2.1)  
> **阶段结论**：**Phase 2.1 Complete & Verified — Ready for Phase 2.2 (Question Engine)**  
> **自动化测试**：9 个测试套件，22 项用例 100% 通过（新增 4 项 Gap Engine 专项用例）。

---

## 1. Phase 2.1 交付成果清单

| 交付项 | 路径 | 核心能力说明 |
| :--- | :--- | :--- |
| **契约无损扩展** | `packages/contracts/src/gaps.ts` | 为 `GapItem` 补充 `source: 'checklist' \| 'ai' \| 'user' \| 'system'`、`uncertainty` 与 `stageRelevance`，100% 保持向后兼容。 |
| **Gap 发现与融合引擎** | `packages/core/src/gaps/GapDetectionEngine.ts` | 实现了静态 Checklist 规则与 LLM 动态 Gap 输出的合并、去重、状态成熟度过滤与 7 级领域优先级加权算法。 |
| **核心包导出更新** | `packages/core/src/index.ts` | 统一向外部提供 `GapDetectionEngine` 接口。 |
| **专项单元测试套件** | `packages/core/tests/GapDetection.test.ts` | 覆盖模糊初始 Idea、已明确项目过滤、业务优先于技术、以及 Checklist + AI 缺口融合去重。 |

---

## 2. Gap 优先级与融合算法设计

```text
┌─────────────────────────────────────────────────────────────┐
│                   Gap Detection Engine Pipeline             │
├──────────────────────────────┬──────────────────────────────┤
│ 1. 静态 Checklist Hints      │ 2. LLM 动态 Discovery Gaps   │
│    (universal + types/*.json)│    (b2-unified.schema.json)  │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               └──────────────┬───────────────┘
                              ↓
                  [ 3. 状态成熟度过滤 ]
             (过滤 Overview 中已 clear / locked 的领域)
                              ↓
                  [ 4. 7 级 Product First 排序 ]
             (Product Identity > User > Flow > MVP > Trust > UX > Tech)
                              ↓
                  输出规范有序的 GapItem[] 列表
```

### 2.1 7 级领域排序权重分值
1. **Product Identity / Core Problem**（700 分）：产品本体定义与核心痛点
2. **Target User**（600 分）：目标用户画像与使用场景
3. **Core Workflow**（500 分）：端到端主流程与关键操作链路
4. **MVP Scope**（400 分）：首发功能边界
5. **Trust / Safety**（300 分）：数据所有权、隐私与离线可用承诺
6. **UX Tradeoff**（200 分）：体验原则与复杂度权衡
7. **Technical Constraint**（100 分）：底层运行平台与环境底线

---

## 3. 自动化测试结果 (Vitest)

```powershell
$ pnpm test

 ✓ packages/contracts/tests/refs.test.ts (5 tests)
 ✓ packages/core/tests/GapDetection.test.ts (4 tests)
   - 1. Blurry Idea: detects missing target_user and mvp_scope as high priority
   - 2. Well-specified project: filters out already clear/locked areas
   - 3. Product First: Product and User gaps strictly outrank Technical constraints
   - 4. Fuses AI Discovery gaps with Checklist hints and deduplicates cleanly
 ✓ packages/core/tests/ChecklistSelector.test.ts (3 tests)
 ✓ packages/core/tests/StateCommit.test.ts (2 tests)
 ✓ tests/persistence-recovery.test.ts (1 test)
 ✓ packages/agent/tests/AIOrchestrator.test.ts (1 test)
 ✓ apps/server/tests/api.test.ts (1 test)
 ✓ tests/multi-turn.test.ts (1 test)
 ✓ packages/core/tests/ProjectStateEngine.test.ts (4 tests)

 Test Files  9 passed (9)
      Tests  22 passed (22)
   Duration  1.24s
```

---

## 4. Phase 2.1 审查结论与下一步

- **Phase 2.1（Gap Detection Engine）开发完成且全部测试通过**。
- 严格遵循了“先执行 Phase 2.1 → 审查 Gap Engine → 再执行 Phase 2.2”的原则。
- **已停止进一步编码**，等待您审查本报告后下发 **Phase 2.2（Question Engine）** 开发指令！
