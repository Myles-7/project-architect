# Project Architect V1 — Phase 2：数据契约与 Schema 变更审查报告 (Schema Change Review)

> **文档状态**：Official Schema Review & Compatibility Audit  
> **审查对象**：`packages/contracts` 中的 TypeScript 类型与 `experiments/agent-benchmark/schemas/b2-unified.schema.json`  
> **审查结论**：**零 Breaking Change，100% 复用现有契约。**

---

## 1. 契约复用性审查 (Schema Reusability Audit)

针对 Phase 2 的五大核心能力，逐项比对现有 Schema 与类型定义的覆盖度：

| Phase 2 功能模块 | 所需数据结构 | 现有契约支撑 (`packages/contracts`) | 评估结论 |
| :--- | :--- | :--- | :---: |
| **Module 1: Gap Detection** | `gaps`, `conflicts`, `tensions` | `GapsState`, `GapItem`, `ConflictItem`, `TensionItem` | **100% 覆盖**<br>已有 `area`, `severity`, `reason`, `impact`, `shouldAskUser` |
| **Module 2: Question Engine** | `questions`, 优先级, 推荐, 选项 | `QuestionsState`, `QuestionItem`, `QuestionOption`, `QuestionImportance` | **100% 覆盖**<br>已有 `why_now`, `recommendation`, `recommendationReason`, `options` |
| **Module 3: Assumption Policy** | `assumptions`, 状态转换, 溯源 | `AssumptionsState`, `AssumptionItem`, `AssumptionStatus` (`active`/`converted`) | **100% 覆盖**<br>已有 `linkedDecisionRefs`, `reason`, `resolvedAt` |
| **Module 4: Runtime Pipeline** | 单次 `discovery-turn` 结构化输入输出 | `DiscoveryResult`, `AIProviderRequest`, `StructuredResult` | **100% 覆盖**<br>与 `b2-unified.schema.json` 严格一一映射 |
| **Module 5: Readiness Foundation**| 准备度审阅快照、检查领域、问题清单 | `ReadinessState`, `ReadinessSnapshot`, `ReadinessStatus` | **100% 覆盖**<br>已有 `requiredAreas`, `warnings`, `issues`, `userDisposition` |

---

## 2. 结论与变更声明 (Conclusion & Policy)

1. **零新增 Schema**：Phase 2 开发不需要对 `b2-unified.schema.json` 或 `state/*.json` 进行任何增删或修改。
2. **零迁移成本**：由于无需修改 Schema 字段，现有项目与测试用例不需要编写数据迁移脚本（Data Migration Scripts）。
3. **严格保持冻结**：任何关于增加 Agent 自定义输出字段的提议均在此阶段被正式驳回，确保运行时与 B2.1 Benchmark 黄金基准完全对齐。
