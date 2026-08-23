# Project Architect V1 — Phase 1：Core Engine 收口审查报告 (Closure Review)

> **文档状态**：Official Phase 1 Closure & Sign-off  
> **审查对象**：Phase 1 交付的代码库（`packages/contracts`, `packages/core`, `packages/agent`, `apps/server`, `checklists/`, `tests/`）  
> **审查目标**：固化 Core Engine 架构边界，审查冲突裁决权归属，登记技术债务，并正式冻结 Phase 1。

---

## 1. 架构职责边界审查 (Architecture Boundary Review)

为确保系统的单向数据流与单一事实来源（SSOT）不被侵蚀，对 Core Engine、Agent Layer 及未来 UI 的职责边界进行严格判定与固化：

### 1.1 职责分配矩阵 (Responsibility Matrix)

| 能力领域 / 操作项 | Core Engine (`packages/core`) | Agent Layer (`packages/agent`) | UI Layer (`apps/web`) | 规则与约束说明 |
| :--- | :---: | :---: | :---: | :--- |
| **状态事实管理 (State SSOT)** | **Yes (唯一)** | No | No | 所有规范事实存储于本地 `state/*.json`，UI 与 Agent 严禁维护独立事实副本。 |
| **两阶段 Commit 与版本控制** | **Yes (唯一)** | No | No | 状态变更必须通过 `StateCommitManager`，`stateRevision` 单调递增，崩溃自动恢复。 |
| **Locked 决策保护** | **Yes (唯一)** | No | No | 锁定的决定具有物理保护，Agent 建议无法直接覆盖，UI 编辑触发版本替代。 |
| **语义理解与自然语言推理** | No | **Yes (唯一)** | No | Core 严禁进行 LLM 语义猜测；所有意图理解与发散均由 Agent 完成。 |
| **缺口发现 (Gap Discovery)** | No | **Yes (主要)** | No | Agent 结合 Checklist 与材料发现未决需求；Core 仅提供静态 Hints 提取。 |
| **问题生成与优先级排序** | No | **Yes (唯一)** | No | 根据 B2.1 宪法生成符合预算的问题与推荐，Core 不硬编码业务问答逻辑。 |
| **确定性排他冲突检测** | **Yes (辅助)** | **Yes (主要)** | No | Core 仅执行字面硬排他检测；复杂权衡与架构冲突由 Agent 进行语义裁决。 |
| **Overview 视图投影计算** | **Yes (数据)** | No | **Yes (渲染)** | Core 提供 `OverviewState` 结构映射；UI 负责视图交互与状态呈现。 |
| **用户授权与意图提交** | No | No | **Yes (唯一)** | 用户陈述、问题回答与直接编辑通过 UI 发送给 API，AI 无权直接将建议标记为 Confirmed。 |

---

## 2. 冲突裁决权审查 (Conflict Responsibility Review)

在 Phase 1 中实现了 `LightweightConflictDetector`。本审查明确 Core 与 Agent 在冲突检测上的权力划分：

```text
┌─────────────────────────────────────────────────────────────┐
│                    Conflict Authority Rule                  │
├──────────────────────────────┬──────────────────────────────┤
│ Core Engine 允许且仅限：      │ Agent Layer 独占负责：       │
│ - 字面明确排他的硬约束检测   │ - 复杂语义与体验冲突判断     │
│   (如: Desktop Only vs Mobile)│   (如: 离线体验下降、同步延迟)│
│ - 格式与状态冲突检测         │ - 架构复杂度与取舍 (Tension) │
│   (如: 已 Locked 决定被重复写)│ - 潜在安全与合规风险 (Risk)  │
└──────────────────────────────┴──────────────────────────────┘
```

### 2.1 核心禁止项
- **禁止 Core 进行语义判断**：Core 严禁推断诸如“该方案实现复杂度过高”、“用户体验较差”、“可能存在安全隐患”等主观结论。此类推断 100% 属于 Agent 的职责范畴（输出为 `tensions` 或 `risks`）。
- **Strict Conflict 纯粹性**：只有两条已确认/已锁定的硬约束发生不可调和的逻辑互斥时，才允许成立 `Conflict`。普通技术选择冲突应降级为 `Tension`。

---

## 3. Phase 1 技术债务登记 (Technical Debt Register)

Phase 1 已顺利达成全部验收标准，但为保证 Phase 2 与后续迭代的可持续演进，正式登记以下 5 项技术债务：

### TD-01: 确定性冲突检测器的正则边界硬编码
- **描述**：`LightweightConflictDetector` 目前使用静态正则表达式匹配排他约束（如离线 vs 云同步）。
- **风险**：语言表述多样性可能导致偶发漏检或需要持续维护正则字典。
- **处置策略**：**Non-blocking**。Core 中的检测器仅作为底线安全网，Phase 2 统一由 B2.1 Agent 执行全量语义级别的 Conflict 发现。

### TD-02: 状态 Schema 版本迁移机制 (Schema Migration)
- **描述**：当前各 JSON 状态文件均包含 `schemaVersion: 1`，但尚未编写自动化跨版本 Migration 工具。
- **风险**：若后续 Schema 字段发生 Breaking Change，旧项目文件需要手动迁移。
- **处置策略**：**Phase 3 前处理**。Phase 2 严格保持契约稳定，优先复用现有 Schema，避免 Breaking Change。

### TD-03: 超大项目多材料上下文的性能基准验证
- **描述**：`ContextManager` 已实现字符上限截断，但尚未针对 50+ 输入文件的极端项目进行性能与关键信息保留率压测。
- **风险**：超长材料截断时可能略过深层细节。
- **处置策略**：**Phase 2.4 纳入集成测试**，通过 Benchmark 验证上下文提取的召回率。

### TD-04: Antigravity CLI 真实进程集成测试的本地自动化
- **描述**：当前 CI/Vitest 自动化测试默认使用 `MockAIProvider` 保证毫秒级运行；真实 `agy.exe` 的调用依赖开发者本地环境安装。
- **风险**：本地环境 PATH 缺失或 CLI 版本变更可能影响端到端真实调用。
- **处置策略**：**Phase 2.5 覆盖**。保留独立运行脚本 `pnpm run test:real-provider`，不阻塞日常单元测试。

### TD-05: 前端原型 (frontend/) 与正式 API 的契约适配
- **描述**：原 `frontend/` 目录仍保留部分本地 Mock 逻辑与双重 `locked` 字段定义。
- **风险**：直接使用会导致前后端状态模型不匹配。
- **处置策略**：**Phase 3 实施**。已在 `17_PROTOTYPE_MIGRATION_NOTES.md` 中完成全面审计，Phase 3 时按 API 契约平滑替换。

---

## 4. Phase 1 最终结论与签署 (Final Sign-off)

```text
======================================================================
Phase 1 Status:
Frozen — Ready for Phase 2 (Discovery Intelligence)
======================================================================
```

**结论说明**：
1. **核心引擎完全冻结**：`packages/contracts` 与 `packages/core` 的基础架构与持久化逻辑满足所有设计要求，不再进行基础架构重构。
2. **测试全面达标**：8 个测试套件，18 项单元与集成测试用例 100% 通过。
3. **正式批准进入**：**Phase 2 — Discovery Intelligence（产品缺口发现与智能提问设计）**。
