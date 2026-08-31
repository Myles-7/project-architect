# Project Architect 产品硬化基线报告 (Product Hardening Baseline)

> **基线时间**：2026-08-27  
> **状态**：阶段 0 已冻结 (Phase 0 Frozen)  
> **依据文件**：`docs/superpowers/plans/2026-08-27-product-hardening-master-plan.md`  
> **目标**：记录硬化重构启动前的构建状态、测试规模、B3 真实推演样本、时延、Token 及审计红灯事实，作为全阶段重构的不可篡改参考。

---

## 1. 工程构建与自动化测试基线

### 1.1 构建命令与结果
- **全工作区构建**：
  ```powershell
  pnpm build
  ```
  - `@project-architect/contracts`: 通过 (TypeScript 5 编译)
  - `@project-architect/core`: 通过 (Node.js ESM 打包)
  - `@project-architect/agent`: 通过 (Orchestrator / Provider 编译)
  - `@project-architect/server`: 通过 (Express 4 服务端打包)
  - `@project-architect/web`: 通过 (React 19 + Vite 6 构建)
- **初始测试套件结果**：
  - 既有测试文件数：80 个
  - 既有测试用例数：268 项全部通过
  - 测试命令：`pnpm exec vitest run --maxWorkers=2`

---

## 2. 真实 B3 发现样本基线数据

数据来源于 2026-08-24 / 2026-08-27 真实 Antigravity CLI Provider 调用记录：

| 指标维度 | 观测基线值 | 来源路径 / 证据文件 |
|---|---|---|
| **评测用例覆盖** | 仅覆盖 `case-01` (vague-cleaner) | `experiments/agent-benchmark/results/b3-zh-readability-final-summary.json` |
| **单次执行耗时 (Duration)** | **43,993 ms (~44s)** | `experiments/agent-benchmark/results/raw/b3-zh-readability-final/case-01__B3__01__single-call.json` |
| **总 Token 消耗 (Total Tokens)** | **53,176 / 40,270** | `experiments/agent-benchmark/results/raw/b3-2026-08-24T18-31-49-903Z/` |
| **输入 Token (Input Tokens)** | **20,555** | 同上 |
| **输出 Token (Output Tokens)** | **19,715** | 同上 |
| **思考 Token (Thinking Tokens)** | **15,131** | 同上 |
| **Prompt Cache Read Tokens** | **16,322 (偶发命中)** | 仅在连续调用场景下观测到，Provider 尚未提供显式 Cache 契约保证 |
| **人工质量评分** | **全空 (`null`)** | `manual_review: { relevance: null, decision_value: null, independent_answerability: null }` |

---

## 3. 审计问题红灯基线 (Phase 0 Expected Failures)

本阶段在 `tests/product-hardening/audit-regressions.test.ts` 中固化了 5 个核心回归测试。在重构启动前，这 5 项测试**必须全部因明确业务断言失败**，成为后续重构的红灯指引：

```powershell
pnpm exec vitest run tests/product-hardening/audit-regressions.test.ts --maxWorkers=1
```

| 测试用例 / 审计 ID | 失败断言事实 | 目标阶段 |
|---|---|---|
| **Regression A01** | `CANONICAL_B3_AREAS` (8项，含 `core_problem`, `ux_ui`, `acceptance`) 与 Overview 固定区域 (9项，含 `core_features`, `ux_ui_direction`, `delivery_plan`) 存在严重领域命名分叉 | Phase 1 |
| **Regression A03** | 用户针对 `trust_safety` 领域创建的确认决策，在 Overview 的全部 Section 投影中完全失踪 (`undefined`) | Phase 1 |
| **Regression A11** | 项目副本复制 (Fork) 后，`state/overview.json` 中的 `projectId` 仍保留为原始项目 ID，副本状态被污染 | Phase 4 |
| **Regression A08** | Checklist 兜底提问对不同的 decisionKey (如 `chk-localfirst-ownership` 与 `univ-platform-choice`) 生成了逐字完全相同的通用选项 (`首发版本先采用边界清晰的方案` / `首发版本覆盖更多使用场景`) | Phase 3 |
| **Regression A10** | 当配置了不存在的 CLI 路径时，`GET /api/provider/health` 仍盲目返回 `status: "ready"`，并宣传“零数据外流” | Phase 4 |

---

## 4. UI 交互与体验审计基线

- **390px 窄屏崩溃**：在 390×844 视口下，左侧导航栏与右侧 Overview 同时占据屏幕，主工作区被压缩至不可用宽度。
- **创建引导单一化**：4 项业务输入引导被强行拼接为一个 Markdown Decision，目标用户与技术约束未能转化为独立领域决策。
- **跳过语义缺失**：向导模式中的“跳过本题”未调用持久化 dismiss API，导致下一批继续阻塞在相同未决点。
- **草稿丢失风险**：用户在自由输入框提交内容后立即清空输入框，但内容仅存于内存 Job；一旦重启或调度失败则用户输入彻底丢失。

---

## 5. 契约清理与后续阶段准入

1. `tests/b2-1-regression.test.ts` 已安全重命名为 `tests/discovery-safety-regression.test.ts`，保留单次调用与防越权断言，剔除对旧 Schema/旧预算的活动依赖。
2. 历史报告文件 (`B2_1_FULL_VALIDATION_REPORT.md` 等) 已统一添加历史归档免责声明，明确指引 `docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md` 为唯一生产运行时。
3. 生产代码中只保留 B3 Prompt 与 B3 Schema 引用，坚决禁止 B2.1 运行时回退。

> **阶段 1 准入结论**：基线已完全冻结，5 项红灯测试已确立，旧契约已完成清理。准予进入 **阶段 1：统一领域模型与结构化创建**。
