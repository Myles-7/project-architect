# Project Architect V1：Technical Blueprint Review

> 历史归档：本文记录 Phase 0 蓝图审查历史，涉及 B2.1 的预算与单题描述不属于当前生产运行时契约。当前唯一活动契约见 [12_B3_ADAPTIVE_DISCOVERY.md](12_B3_ADAPTIVE_DISCOVERY.md)。
> 审查对象：[01_PRODUCT_BOUNDARY.md](01_PRODUCT_BOUNDARY.md) 至 [08_DEVELOPMENT_PLAN.md](08_DEVELOPMENT_PLAN.md)，以及必要修订契约 [10_INPUT_MATERIAL_CONTRACT.md](10_INPUT_MATERIAL_CONTRACT.md)  
> 审查范围：B2.1 一致性、复杂度、个人自用适配性与开发可指导性。  
> 审查方式：文档一致性与架构契约审查；不重新设计 Prompt、不修改现有 Blueprint。

## 1. Executive Summary

Blueprint 以本地 Project State 为中心，保留 B2.1 的单 Agent、单次结构化推理和产品先于技术原则，并避免了 Multi-Agent、企业协作和复杂 Dashboard。

审查提出的四项必要修订现已完成：材料输入、跨文件 Commit、问题预算与 Readiness 例外处置均已有明确契约和对应的 Roadmap 验收标准。

**最终结论：Ready。**

Blueprint 可以冻结并开始 Milestone 1：Core Engine。

## 2. 审查结果

| 检查项 | 结论 | 依据与观察 |
| --- | --- | --- |
| 是否符合 B2.1 Agent 原则？ | **Ready** | 03、04、05 明确保留单一专门 Agent、单次主要调用、`structured_output`、用户授权、Capability Before Mechanism、Conflict Strict 与 Product First。 |
| 是否过度工程化？ | **Ready** | 没有引入 Multi-Agent、复杂需求图、企业权限、远程协作、自动 Coding 或完整技术规划系统。文件状态、一个 Provider Adapter、固定文档和三栏 Workspace 都是 V1 闭环所需的最小结构。 |
| 是否引入不必要复杂度？ | **Ready** | 材料输入和跨文件 Commit 已补齐为小型本地契约，避免用临时实现补洞；未引入额外服务或持久化系统。 |
| 是否适合个人开发者自用？ | **Ready** | 首页、单项目三栏 Workspace、最小导航、Gap-first 问题和本地文件目录均服务于单人项目定义，不依赖团队或商业化能力。 |
| 是否可以直接指导开发？ | **Ready** | 核心模块、状态提交、材料输入、问题预算、Readiness 例外、验收门槛与 Roadmap 已形成可执行契约。 |

## 3. B2.1 一致性审查

### 3.1 已正确保留的原则

| B2.1 原则 | Blueprint 落点 | 结论 |
| --- | --- | --- |
| Single Agent / Single Call | 02 的 AI Orchestrator、03 的 Runtime 不变量、05 的 Provider Request。 | 一致。逻辑 Task 不被解释为多调用链。 |
| Structured Output | 02、03、04、05 都要求 JSON Schema 与 `structured_output`；State 不依赖普通文本回复。 | 一致。 |
| Capability Before Mechanism | 01 的产品先于技术、03 的跨字段约束、04 的状态写入校验。 | 一致。没有通过 Risk、Recommendation 或 Document Plan 绕开门控。 |
| Conflict Strict | 01 的分类、03 的 Task 契约、04 的双约束引用和 07 的文档处理。 | 一致。Conflict 不等同于风险、复杂度或 Scope 问题。 |
| User Authority | 01、04、06、07 均将 Confirmed / Locked 升级交给用户。 | 一致。Agent 仅提出建议。 |
| Gap-first / Product First | 01、03、06 和 08 将 Gap 排序、问题治理与个人决策流作为主路径。 | 一致。 |

### 3.2 需要避免的实现偏差

开发时不得因为实现方便而做以下改变：

- 将 `gap-analysis`、`question-generation` 串成同一用户动作的多次 Provider 调用。
- 把 Provider 的普通文本字段作为结构化状态来源。
- 让直接编辑绕过用户来源、锁定保护或影响检查。
- 为文档“补全”未确认的产品事实。
- 让具体实现机制通过 Risk、Tension、Recommendation 或文档字段重新进入 Discovery。

这些不是新增要求，而是 Blueprint 已明确的 B2.1 保护边界。

## 4. 已做对的简化

以下设计应保持，不建议在 V1 中扩展：

- 一个 Project Architect Agent，而不是多个角色协作。
- 一个默认 Provider Adapter，而不是同时实现多个模型接入。
- 文件式 Project State，而不是引入复杂持久化系统。
- 固定核心 Markdown 文档，而不是无限制文档库。
- Recent Projects 与单项目 Workspace，而不是项目运营 Dashboard。
- Files、Documents、Settings 的最小导航，而不是文件管理、知识库或团队控制台。
- Readiness 的 Warning-first 策略，而不是自动阻止或自动开始编码。

这些取舍使系统更适合个人自用，并与现有 Agent Benchmark 的单次调用成本结论一致。

## 5. 必要修订验证

### R-01：文件和图片输入契约

**状态：Resolved。**

新增 [10_INPUT_MATERIAL_CONTRACT.md](10_INPUT_MATERIAL_CONTRACT.md)，并同步更新 04 与 08。V1 现在定义了本地 `inputs/` 目录、稳定 `inputRef`、支持类型、大小限制、`saved / ready / failed / excluded` 状态、图片可分析条件、失败处理、Context 选用规则与 Files 区可见性。

材料不会自动成为 Confirmed 事实，且不会为了处理材料增加隐藏 Agent 调用，符合 B2.1 和单次调用约束。

### R-02：多文件 State Commit 与恢复

**状态：Resolved。**

04 已增加 State Commit Contract：先生成并校验完整候选状态，再写入 staging 与 Commit Marker，最后以 `project.json.stateRevision` 作为可见提交点。启动时根据 Marker、文件清单和备份恢复最后一个完整 Revision；恢复失败时只读打开，不进行猜测性合并。

该规则保持文件存储，不引入数据库、ORM 或复杂事务服务。

### R-03：普通问题数量的 B2.1 预算

**状态：Resolved。**

03 现明确 V1 Runtime 的唯一预算：High / Critical 一个，最多一个直接依赖问题；Normal 最多两个紧密相关问题；Low 默认不打扰用户。06 与 08 已同步明确 UI 不得放宽此预算。

恢复 3–5 个普通问题属于未来 B2.1 行为变更，必须重新 Benchmark。

### R-04：Readiness 的 Warning、High Issue 与 Critical Conflict 处置

**状态：Resolved。**

03、04、06、07 与 08 已采用同一三档规则：无 Critical Issue 可批准；High Issue / High Risk 需逐项确认后以 `approved-with-known-issues` 生成；Open Critical Conflict 默认不生成，只有逐项确认后才可用 `approved-with-critical-conflicts` 例外处置。

例外处置不把问题标记为已解决。相关 Markdown 必须保留 Issue、Risk 或 Conflict，Critical Conflict 作为首要限制项。

### R-05：跨文件引用和 Overview 直接编辑的寻址规则

**状态：Resolved (Phase 0)。**

04 现已正式建立 Typed Reference 契约（`decision:<id>`, `assumption:<id>`, `gap:<id>`, `conflict:<id>`, `tension:<id>`, `risk:<id>`, `question:<id>`, `input:<id>`）。Overview `itemRefs`、Conflict `decisionRefs` 和 Readiness 追溯均使用统一前缀寻址，避免跨文件数据漂移与寻址混乱。

### R-06：Context 与成本保护的初始基线

**状态：Resolved (Phase 0)。**

已在 `implementation/15_RUNTIME_CONFIG.md` 中建立基线配置表，基于 B2.1 Benchmark 实测数据（平均 Total Tokens ≈ 28.8k，平均耗时 ≈ 37.8s）定义了任务级字符上限、条目上限、Warning 阈值与 Hard Guardrail，支持后续灵活调参。

## 6. 过度工程化审查

Blueprint 的主要实现风险已经从“缺少契约”转为“是否严格执行契约”。R-01 与 R-02 已通过小型本地规则解决，不需要增加服务或产品模块。

当前模块数量是合理的：

- Frontend、Backend、State Engine、AI Orchestrator、Provider Layer 和 Document Compiler 的职责彼此不重叠。
- Task Prompt、Context Manager、Schema 不是额外服务，而是同一次 Agent Runtime 请求的组成部分。
- `overview.json`、`decisions.json` 等文件按用户可理解的状态域拆分，不是完整需求管理图。

不建议在修订时加入新的 Agent、状态服务、规则引擎、全文索引、协作权限、模板市场或可视化 Dashboard。

## 7. 个人自用适配性审查

Blueprint 很适合个人开发者的真实工作方式：一个项目、一份可见 Overview、一条对话主线，以及在准备完成后输出文档。

特别正确的选择包括：

- Recent Projects 只承担恢复项目，不承担跨项目管理。
- Chat 是决策工作区，不是无限制聊天记录。
- Overview 可编辑和可锁定，但不是 Jira 式需求系统。
- Readiness 解释风险，不替用户做最终决定。
- Documents 是状态派生产物，修改需求必须回到状态，而不是维护两套事实。

建议保持这一边界。任何“模板中心”“项目分析报表”“团队评论”“自动开发”和“云同步”都不应进入当前 Roadmap。

## 8. 是否可直接指导开发

Blueprint 现在可以直接指导开发，因为它已经具备：

- 明确产品边界和不做事项。
- 模块责任、单次 AI 调用和结构化 Provider 契约。
- 文件化 Project State、生命周期、用户确认和文档追溯。
- 前端信息架构、关键界面行为和状态边界。
- 固定文档系统、`AGENTS.md` 入口和四个有验收门槛的 Milestone。

R-05 与 R-06 是低风险实现细化项，可在 Milestone 1 / 2 开始时纳入配置与状态契约，不阻塞当前 Blueprint 冻结。

## 9. 最终结论

### Ready

架构方向正确，B2.1 原则保留完整，且没有出现 Multi-Agent、企业化或 Dashboard 驱动的过度设计。

四项必要修订已落实并同步到输入、状态、Runtime、前端、文档系统和 Roadmap。Blueprint 已具备开始实施所需的产品边界、模块职责、状态契约、Agent 约束、失败边界、验收标准和交付顺序。

**Recommended next stage: Milestone 1 — Core Engine.**
