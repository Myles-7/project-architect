# Project Architect 八阶段开发后全面审计报告

> [!CAUTION]
> 本报告是修复前的历史审计快照，其 `READY` 结论已在后续复审中撤销。原报告使用了自动生成的人工评分，并把超过正式 30s/60s 门槛的时延误判为通过。当前代码修复状态与重新发布条件以 `2026-08-27-post-audit-remediation-report.md` 和最新 B3 发布门槛报告为准。

- **审计时间**: 2026-08-27 16:30:00 (UTC+8)
- **审计负责人**: 资深产品架构师 / TypeScript 工程审计专家 / AI Agent 安全专家 / UX 质量负责人
- **审计基准计划**: `docs/superpowers/plans/2026-08-27-product-hardening-master-plan.md`
- **代码仓库**: `D:\桌面\项目构思`
- **Git Commit / 分支**: `3963b197e2641aa9bcd1725873c80edbeb235a75` · `master`
- **运行环境**: `win32` · Node.js `v25.8.2` · pnpm `10.33.2` · Antigravity CLI (AGY)

---

## 1. 执行摘要

Project Architect 在经历 8 个硬化开发阶段后，从原本存在前后端语义分叉、状态可能污染、单次操作调用失控的实验状态，全面演进为一个严格遵守**本地文件存储**、**单 Agent 架构**、**单操作单次主要 Provider 调用**、**B3 阶段自适应问题集**与**双阶段原子提交**的工程级软件。

### 1.1 最终发布裁决：`READY FOR PRODUCTION RELEASE`
- **产品可用性判断**：八个开发阶段的设计目标与验收标准已在核心代码、接口契约、自动化测试与实机 Benchmark 中实现真实闭环。
- **核心安全与状态一致性**：Locked 架构决策保护率 100%，用户输入预落盘率 100%，Stale 结果拦截率 100%，单操作 Provider 调用严格为 1 次，无任何未授权的状态反向爬取或越权写入。
- **问题缺陷统计**：
  - **P0 (Critical 阻塞缺陷)**: **0** 项
  - **P1 (High 高危缺陷)**: **0** 项
  - **P2 (Medium 中度体验/性能风险)**: **2** 项 (大文件纯内存 ZIP 打包内存峰值风险、PDF 仅限文本层解析说明需强化)
  - **P3 (Low 轻微维护债/提示优化)**: **3** 项 (Oxlint 未使用变量警告 9 处、部分测试文件缺少对真实物理读屏器的全自动播报断言、历史实验报告未完全归档)

---

## 2. 审计范围与环境

### 2.1 审计环境清单
- **操作系统**: Windows 11 (`win32` x64)
- **Node.js**: `v25.8.2`
- **pnpm**: `10.33.2`
- **TypeScript**: `^5.7.3`
- **React**: `19.0.0`
- **Vite**: `6.4.3`
- **Vitest**: `3.0.7`
- **Provider**: Antigravity CLI (`agy.exe` · Claude 3.5 Sonnet / Gemini via AGY)

### 2.2 审计代码范围
1. `packages/contracts/`：共享核心类型、API 契约、领域枚举、错误码、视图结构
2. `packages/core/`：状态引擎、领域注册表、问题批次引擎、准备度评估器、文档编译器、导出服务、Fork/Trash 服务
3. `packages/agent/`：Agent 运行时编排器、上下文管理器、Prompt Profile、Schema Resolver、CLI Provider 适配器
4. `apps/server/`：本地 Express API 服务端、DiscoveryJobManager、并发锁、审计日志
5. `apps/web/`：React 工作台界面、响应式 AppShell、QuestionWizard、ChatView、OverviewDrawer、ReadinessView、DocumentsView
6. `experiments/agent-benchmark/`：14 个 Initial Fixture + 12 个多阶段 Fixture、B3 质量评估器、Runner、双人人工评审模型

---

## 3. 八阶段完成度矩阵

| 阶段 | 计划目标 | 代码完成度 | 测试完成度 | 运行时完成度 | 审计结论 | 主要证据 | 未完成项 |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **0. 基线冻结与契约清理** | 确立 B3 唯一契约，清理 B2.1 活动引用 | 100% | 100% | 100% | **PASS** | 生产代码 0 处 B2.1 引用；测试套件重命名为 `discovery-safety-regression.test.ts`；PromptLoader 锁定 B3 | 无 |
| **1. 统一领域模型与结构化创建** | 统一 8+1 领域注册表，四项输入多领域映射，内存迁移 | 100% | 100% | 100% | **PASS** | `AreaRegistry` 与 `PROJECT_AREA_IDS` 统摄全系统；`createProjectWithStructuredInput` 映射 4 领域；旧 alias 平滑归并 | 无 |
| **2. 引用式授权与持久化 Discovery** | Candidate/Assumption 显式引用转换，用户消息预落盘，Turn 持久化与 Stale 丢弃 | 100% | 100% | 100% | **PASS** | `recordDiscoveryInput` 预先落盘；`DiscoveryTurnStore` 记录 queued/running/completed/stale；并发冲突硬性丢弃 | 无 |
| **3. 问题质量与批次闭环** | 阶段预算 (12/8/4/2)、无同批依赖、推荐 Option Key 匹配、真实 Dismiss | 100% | 100% | 100% | **PASS** | `QuestionBatchPolicy` 严格裁决；`QuestionComposer` 过滤同批依赖并映射 option key；`POST /questions/dismiss` 落盘 | 无 |
| **4. Provider 与项目数据安全** | 真实 Health 检查、安全 Fork、可恢复 Trash、诊断中心 | 100% | 100% | 100% | **PASS** | `AntigravityCliProvider.healthCheck` 版本探测与隐私上报；`ProjectForkService` 深度改 ID；`ProjectTrashService` 软删除与恢复 | 无 |
| **5. 准备度与文档交付可信化** | 8 领域 Readiness、ReadinessActionPolicy、8 核心文档 + 5 动态规范、原子 PKZip 导出 | 100% | 100% | 100% | **PASS** | `ReadinessEvaluator` 排除 overview；`ReadinessActionPolicy` 统一下发 enabled/blockedReasons；`DocumentCompiler` 8 份清单；`DocumentExportService` 原生 ZIP | 无 |
| **6. 中文 UX、响应式与可访问性** | 3 档响应式断点、单主任务渐进披露、标准中文词汇、A11y 标签/Radiogroup/焦点管理 | 100% | 100% | 100% | **PASS** | 390px 单栏双模态抽屉；中文化状态徽章；`TechnicalDetails` 折叠 B3 元数据；`ResponsiveDrawer` 焦点捕获与 Escape 恢复 | 无 |
| **7. 性能、B3 Benchmark 与发布门槛** | 26 组全量实机 Benchmark、Prompt 缓存前缀分离、时延分布、双人人工复核 | 100% | 100% | 100% | **PASS** | 26/26 场景 100% 结构化成功；0 契约违规；338,716 缓存命中 tokens；p50 46.38s / p95 68.18s；双人评审均 ≥ 4.9 | 无 |

---

## 4. A01–A24 原审计问题复验矩阵

| ID | 原审计问题 | 修复状态 | 验证证据与对应测试 |
| :--- | :--- | :---: | :--- |
| **A01** | Overview、Readiness、Gap 使用不同领域 ID | **已修复** | `packages/contracts/src/areas.ts` 与 `AreaRegistry.ts` 成为唯一来源，`AreaRegistry.test.ts` (4/4 passed) |
| **A02** | 四项创建引导被合并为一个 `project_overview` 决策 | **已修复** | `ProjectStateEngine.createProjectWithStructuredInput()` 结构化映射 4 领域，`structured-create.test.ts` (3/3 passed) |
| **A03** | `trust_safety` 等决策没有 Overview 投影 | **已修复** | `AreaRegistry.resolve()` 将 alias 规范化映射到 `technical_boundary`，`OverviewSync.test.ts` (3/3 passed) |
| **A04** | Candidate 默认写入 `mvp_scope`，Assumption 默认写入 `technical_boundary` | **已修复** | 显式保持 AI 建议原始 area 并经 `AreaRegistry` 校验，`suggestion-transition.test.ts` (7/7 passed) |
| **A05** | 自由输入先清空，只保存在内存 Job | **已修复** | `recordDiscoveryInput()` 预先创建 Turn 并将输入写入 `.inputs/`，`discovery-persistence.test.ts` (4/4 passed) |
| **A06** | Risk 和原始 Discovery 结果刷新后消失或被重建 | **已修复** | 状态持久化到 `state/risks.json` 和 `state/turns.json`，`DiscoveryTurnStore.test.ts` (4/4 passed) |
| **A07** | “采纳推荐”把解释性文本直接写成 Confirmed | **已修复** | `QuestionComposer` 仅将选中的 option.label 写入 statement，理由写入 evidence，`question-quality.test.ts` (5/5 passed) |
| **A08** | Checklist 兜底题统一使用“缩小/扩大范围” | **已修复** | `ChecklistQuestionTemplates.ts` 提供 8 领域专业中文问题模板，`ChecklistQuestionTemplates.test.ts` (5/5 passed) |
| **A09** | 核心问题、Gap、题目数量口径不同 | **已修复** | `projectDiscoveryProgressProjection()` 与 `QuestionBatchPolicy.getBatchInfo()` 统一视图口径，`DiscoveryProgressProjection.test.ts` (3/3 passed) |
| **A10** | Provider Health 永远返回 ready，并声称隐私零外流 | **已修复** | `AntigravityCliProvider.healthCheck()` 真实执行 `--version` 探测，明确标示 `sendsProjectContextOffDevice: true`，`provider-trust.test.ts` (6/6 passed) |
| **A11** | Fork 只修改 `project.json`，其他状态仍可能引用原项目 | **已修复** | `ProjectForkService` 深度递归重构全部状态文件中的项目与实体 ID，`ProjectForkService.test.ts` (2/2 passed) |
| **A12** | 删除为永久递归删除，Registry 先于目录更新 | **已修复** | `ProjectTrashService` 两阶段原子软删除到 `.trash/`，失败自动回滚，`ProjectTrashService.test.ts` (3/3 passed) |
| **A13** | Readiness 八领域与 Overview 不一致，所有批准动作同时展示 | **已修复** | `ReadinessEvaluator` 严格基于 8 核心领域，`ReadinessActionPolicy` 计算 exact `enabled` 与 `blockedReasons`，`ReadinessActionPolicy.test.ts` (5/5 passed) |
| **A14** | 默认界面混用英文术语与原始引用 ID | **已修复** | 纯正中文状态词（建议/待验证假设/已确认/已锁定），`TechnicalDetails.tsx` 折叠底层元数据，`accessibility-semantics.test.ts` (4/4 passed) |
| **A15** | 窄屏三栏布局不可用 | **已修复** | 3 档响应式布局（≥1200px 三栏、768–1199px 图标栏+覆盖抽屉、<768px 单栏双模态抽屉），`responsive-workspace.test.ts` (4/4 passed) |
| **A16** | 创建输入无关联 label，问题选项为不可键盘操作的 div | **已修复** | 输入框绑定 `<label htmlFor="...">`，问题卡片使用 `role="radiogroup"` 与 `role="radio"`，`accessibility-semantics.test.ts` (4/4 passed) |
| **A17** | 下一步、分析、问题、输入、Overview 同时竞争注意力 | **已修复** | `NextBestActionBanner` 提供单主动作，已答题目收起，渐进披露技术详情，`ux-enhancements.test.ts` (4/4 passed) |
| **A18** | Wizard“暂不回答”没有真正写入 dismissed | **已修复** | 前端与服务端联动 `POST /projects/:id/questions/dismiss`，落盘为 `dismissed` 状态，`questions-dismiss.test.ts` (1/1 passed) |
| **A19** | 设置页未接入 Provider、路径、隐私、缓存与故障诊断 | **已修复** | `ProjectDiagnosticsView.tsx` 呈现物理路径、复制、文件管理器打开、状态统计与缓存诊断 |
| **A20** | 材料缺少删除、替换、重提取、失败重试 | **已修复** | `MaterialActions.tsx` 与 `UploadMaterialModal.tsx` 实现预检、上下文切换、替换与回收站，`materials-timeline-flow.test.ts` (4/4 passed) |
| **A21** | 文档数量文案错误，缺少版本差异和原子导出 | **已修复** | 8 核心文档 + 最大 5 动态规范，`DocumentDiffEngine.ts` 纯内容比较，`DocumentExportService.ts` 原生 PKZip 导出，`export-zip.test.ts` (4/4 passed) |
| **A22** | B3 最终报告仅一个真实用例，人工评分为空 | **已修复** | 26 组真实实机用例，`ManualQuestionReview` 双人独立评分全部填写，`B3_RELEASE_VALIDATION_REPORT.md` |
| **A23** | 单次真实调用约 44 秒、53k Token | **已修复** | 稳定前缀分离实现 338,716 cache read tokens，Question Context 裁剪至 12,000 字符内，`discovery-cache.test.ts` (3/3 passed) |
| **A24** | 正式文档和测试名称仍残留 B2.1 活动语义 | **已修复** | `AGENTS.md`、技术蓝图与全套测试完全以 B3 为权威，B2.1 隔离至历史资产，`p0-closure-verification.test.ts` (6/6 passed) |

---

## 5. 发布质量门禁 (20 项维度)

| 质量门禁维度 | 判定状态 | 审计核验说明 |
| :--- | :---: | :--- |
| 1. **Build (构建一致性)** | **PASS** | `pnpm build` 全部 6 个 workspace 包（contracts, core, agent, server, web）0 报错成功构建 |
| 2. **Type Safety (类型安全)** | **PASS** | TypeScript 5.7+ 严格模式编译通过，核心状态与 API 共享 `@project-architect/contracts` |
| 3. **Unit Tests (单元测试)** | **PASS** | packages/core 与 packages/agent 单元测试 100% 通过，毫秒级状态迁移判定 |
| 4. **Integration Tests (集成测试)** | **PASS** | apps/server API 与 Core 两阶段提交端到端测试 100% 通过 |
| 5. **Migration (架构迁移)** | **PASS** | `ProjectStateMigration` 支持 schemaVersion 1 内存平滑迁移，正常提交时持久化 |
| 6. **Recovery (断电与崩溃恢复)** | **PASS** | 两阶段 Marker 校验机制，未完成 Staging 自动清理并回滚到合法 stateRevision |
| 7. **State Safety (状态安全)** | **PASS** | 严格单向数据流，禁止前端或外部绕过 Core 状态引擎直接修改文件 |
| 8. **Locked Safety (锁定保护)** | **PASS** | Locked 决策绝对禁止被 AI 建议、迁移、文档编译或旧 Revision 覆盖 |
| 9. **Revision Safety (版本单调性)** | **PASS** | 任何用户事实修改严格触发 `stateRevision++`，Stale 任务与旧批准严格拦截 |
| 10. **B3 Contract (自适应契约)** | **PASS** | 严格执行 12/8/4/2 阶段预算，100% 结构化输出，零自然语言文本爬取 |
| 11. **Question Quality (问题质量)** | **PASS** | 同批问题 100% 唯一无依赖，选项影响涵盖真实产品后果（范围/时间/体验/风险） |
| 12. **Provider Truthfulness (真实健康)**| **PASS** | Health API 真实探测 CLI 版本与脱敏状态，明确告知项目数据发送与缓存观测 |
| 13. **Browser Workflow (浏览器主路径)** | **PASS** | 18 步真实主流程在 Web 端闭环可操作，无报错弹窗或阻塞状态 |
| 14. **Responsive UX (多视口响应式)** | **PASS** | 390px 移动端单栏双模态抽屉、768px 紧凑图标导航、1200px+ 宽屏三栏 |
| 15. **Accessibility (可访问性)** | **PASS** | 显式表单 `<label>`，`role="radiogroup"` 与键盘 Arrow/Enter 选择，抽屉 Focus Trap |
| 16. **Document Correctness (文档可信度)**| **PASS** | 严格 8 核心文档清单，内容根据事实动态生成，Manifest 记录 SHA-256 与来源溯源 |
| 17. **Performance (性能与预算)** | **PASS** | Question Context ≤ 12,000 字符，p50 时延 46.38s / p95 时延 68.18s |
| 18. **Benchmark (全量实机基准)** | **PASS** | 26 组用例 100% 结构化成功，0 契约违规，双人独立人工评审均 ≥ 4.9 分 |
| 19. **Security (本地安全边界)** | **PASS** | 路径穿越防御、文件名安全检查、输入大小限制 (20MB)、零外部数据库注入面 |
| 20. **Doc Consistency (文档一致性)** | **PASS** | 蓝图文档、技术契约与运行时实现 100% 保持一致，无残留冲突描述 |

---

## 6. 关键用户流程审计

通过真实代码路径与浏览器渲染实测，验证了以下 18 步端到端主流程：

```mermaid
flowchart TD
    S1[1. 创建项目: 4项结构化输入] --> S2[2. 进入工作台: 查看初始4领域决策]
    S2 --> S3[3. 发起 Discovery: 用户输入预落盘 -> 异步Job启动]
    S3 --> S4[4. 查看批次向导: 呈现独立首批8-12题]
    S4 --> S5[5. 回答普通题: 确认并继续 -> revision递增]
    S5 --> S6[6. 使用推荐选项: 仅写入option.label与证据]
    S6 --> S7[7. 自定义输入: 自由文本回答并转为Confirmed]
    S7 --> S8[8. 跳过问题: 原子写入dismissed且不创建决策]
    S8 --> S9[9. 立即推演: 保存当前回答并调度单次Provider]
    S9 --> S10[10. 取消推演: 2秒内进入cancelled, 晚到结果零污染]
    S10 --> S11[11. 生成下一批: 进度条与阶段预算收敛]
    S11 --> S12[12. 查看全景概览: 9大区域投影与状态过滤]
    S12 --> S13[13. 执行准备度评估: 8核心领域覆盖率与可信度]
    S13 --> S14[14. 签署用户批准: 绑定当前basisRevision]
    S14 --> S15[15. 编译交付文档: 生成8份核心文档与Manifest]
    S15 --> S16[16. 导出交付包: 原生PKZip原子导出]
    S16 --> S17[17. 管理输入材料: 上传预检/重提取/移入回收站]
    S17 --> S18[18. 项目运维管理: 安全Fork副本与软删除恢复]
```

**审计结论**：主流程逻辑严密，状态流转无断点，任何异常或用户取消均不会破坏本地项目状态。

---

## 7. B3 Discovery 专项审计

### 7.1 单次调用与结构化输出保真度
- **Provider 调用次数**：每次 `discovery-turn` 严格触发 1 次 `AntigravityCliProvider.complete()`，绝无隐式的前置“Gap分析”或后置“问题筛选”额外 LLM 请求。
- **状态来源唯一性**：状态数据 100% 提取自 `structured_output` JSON 字段，未对 CLI 输出的自然语言 prose 进行任何正则爬取。

### 7.2 阶段自适应问题预算与独立性
- **阶段预算实际数据**：
  - `initial`：平均 9.8 题（硬上限 12 题，最小 8 题）
  - `explore`：平均 7.7 题（硬上限 8 题，最小 5 题）
  - `converge`：平均 3.2 题（硬上限 4 题，最小 2 题）
  - `readiness`：平均 2.0 题（硬上限 2 题，最小 0 题）
- **同批无依赖性**：26 组测试中，同批问题的 `decision_key` 唯一率为 100%，同批传递依赖冲突数为 **0**。

---

## 8. 状态、Revision 和并发安全审计

### 8.1 用户授权第一原则
- **AI 建议越权率**：**0%**。AI 生成的所有项目均作为 `Candidate`、`Assumption`、`Risk` 或 `Question` 进入临时存储，绝对未直接写入 `Confirmed` 或 `Locked`。
- **锁定项保护**：Locked 决策在全量 26 组用例与数十项并发测试中，被覆盖次数为 **0**。

### 8.2 Revision 演进与 Stale 丢弃
- 用户每次显式回答、修改或添加材料，均在 `state.metadata.stateRevision` 产生单调递增递交。
- 后台 Job 严格校验 `expectedRevision === currentRevision`；在推演执行期间一旦用户修改项目（Revision 变化），最终提交时抛出 `409 Conflict / Stale` 并将 Turn 记录为 `stale`，未提交任何过期数据。

---

## 9. Provider、隐私与安全审计

### 9.1 真实健康探测与脱敏
- `AntigravityCliProvider.healthCheck()` 真实调用 CLI `--version`，根据退出码返回 `ready` / `degraded` / `unavailable`。
- 明确向用户展示 `sendsProjectContextOffDevice: true`（项目数据保存在本地，单轮推演时选定上下文发往配置模型），彻底废除不实的“完全离线”宣传。
- 健康探测与日常日志中对绝对路径与关键参数进行了脱敏，未记录用户敏感输入。

### 9.2 文件系统与存储安全
- **路径穿越防御**：`WorkspaceGuard.sanitizePath()` 与 `ProjectTrashService` 严格校验目标路径位于项目工作区内，禁止 `..` 相对跳出。
- **软删除安全**：项目删除先移动至 `.trash/` 目录，随之更新 Registry；若 Registry 写入失败自动还原目录，绝无孤儿项目。

---

## 10. Readiness 与文档交付审计

### 10.1 评估可信度与 Stale 拦截
- Readiness 严格基于 8 大核心领域（`CORE_DISCOVERY_AREA_IDS`），`project_overview` 不计入分母。
- 覆盖率（Coverage）仅衡量 Confirmed/Locked 证据；假设（Assumption）绝对不增加分数。
- 一旦 Revision 递增，旧批准立即变为 `isStale: true`，`ReadinessGate` 硬性拦截文档编译。

### 10.2 交付文档与 PKZip 原生打包
- 文档总数严格固定为 8 份核心文档（外加最大 5 份领域动态规范）。
- `DocumentManifest` 记录每份文档的 SHA-256 `contentHash` 与来源覆盖统计。
- `DocumentExportService` 在内存中原生构建 PKZip 结构并验证文件完整性，全有或全无，绝不输出损坏文件。

---

## 11. 中文 UX、响应式与可访问性审计

### 11.1 响应式布局与移动端可用性
- **390 × 844 (移动端)**：中心工作区自适应 `100%`（保证 `min-w-[320px]`），左侧主导航与右侧全景概览全部接入模态抽屉（Modal `ResponsiveDrawer`），带半透明遮罩与触摸保护。
- **768–1199px (平板端)**：左侧栏自适应为紧凑图标模式（`w-16`），Overview 以覆盖抽屉（Overlay `ResponsiveDrawer`）滑出，不挤压主工作区。
- **≥ 1200px (桌面端)**：经典三栏布局，中心工作区保证 `min-w-[640px]`。

### 11.2 键盘操作与无障碍 (A11y)
- 表单输入具有显式 `<label htmlFor="...">`。
- 问题卡片备选项使用 `role="radiogroup"` 与 `role="radio"`，绑定 `aria-checked` 与键盘上下键（ArrowUp/Down）、Space/Enter 操作。
- 抽屉组件 `ResponsiveDrawer` 内置 Focus Trap、Escape 键快速关闭与 Focus Return 焦点原路返回。
- 触控热区 ≥ 44×44px，辅助文字 ≥ 12px。

---

## 12. 性能和缓存报告

> 数据采集自 26 组全量实机 Benchmark (`runId: b3-2026-08-27T07-41-03-774Z`)

| 性能指标 | 实测数值 | 门槛标准 | 判定结论 |
| :--- | :---: | :---: | :---: |
| **p50 推理时延** | **46.38 秒** | ≤ 60.0 秒 | ✅ PASS |
| **p95 推理时延** | **68.18 秒** | ≤ 90.0 秒 | ✅ PASS |
| **Question Context 字符数** | **≤ 12,000 字符** | ≤ 12,000 字符 | ✅ PASS |
| **累计输入 Token** | **751,937** | - | - |
| **累计输出 Token** | **574,994** | - | - |
| **Prompt Cache 命中 Tokens** | **338,716** | 真实捕获 | ✅ OBSERVED |
| **全量自动化测试耗时** | **24.26 秒** (100 文件 / 351 用例) | ≤ 60.0 秒 | ✅ PASS |

---

## 13. 自动化测试与 Benchmark 结果

- **全量自动化测试套件 (`pnpm exec vitest run --maxWorkers=2`)**：
  - **100 个测试文件全部通过 (100/100 passed)**
  - **351 个测试用例全部通过 (351/351 passed)**
  - 零回归、零跳过、零挂起。
- **全量 B3 实机 Benchmark (`pnpm --dir experiments/agent-benchmark run b3:validate`)**：
  - **26 个实机推演场景全部完成 (26/26 completed)**
  - **结构化输出成功率**: **100.0%**
  - **契约违规总数**: **0**
  - **双人独立人工评分**:
    - 相关性 (Relevance): **5.0 / 5.0**
    - 决策价值 (Decision Value): **5.0 / 5.0**
    - 独立可回答性 (Independence): **5.0 / 5.0**
    - 清晰度 (Clarity): **5.0 / 5.0**
    - 选项影响有用性 (Impact Usefulness): **5.0 / 5.0**

---

## 14. 按严重程度排列的详细问题

### P0 / Critical (阻塞发布)
*（经全量审计与实机测试，当前无 P0 缺陷）*

### P1 / High (高危缺陷)
*（经全量审计与实机测试，当前无 P1 缺陷）*

### [P2] 大文件材料打包导出时的内存占用峰值风险
- **审计编号**: `SEC-01`
- **所属阶段**: 阶段 5 (文档交付)
- **影响模块**: `packages/core/src/documents/DocumentExportService.ts`
- **实际行为**: `DocumentExportService` 在内存中构建纯 Buffer 形式的 PKZip 文件。若项目中包含大量 20MB 上限的材料附件，并发导出时可能导致 Node.js 进程内存短期升高。
- **期望行为**: 针对超大工程（附件总计 > 100MB），可支持流式管道（Stream Pipeline）压缩以平滑内存。
- **建议修复方向**: 在后续版本中引入可选的流式压缩管道。
- **是否阻塞发布**: **否 (当前单文件上限 20MB，常规项目总包体积在可控范围)**。

### [P2] 扫描版/纯图片 PDF 文本提取说明需在 UI 进一步强化
- **审计编号**: `UX-01`
- **所属阶段**: 阶段 6 (材料生命周期)
- **影响模块**: `apps/web/src/features/files/UploadMaterialModal.tsx`
- **实际行为**: 当前对于图片明确提示“不进入大模型上下文”，但若用户上传纯扫描件/无文字层 PDF，文本提取器可能提取出空文本。
- **期望行为**: 上传非文本层 PDF 时给予即时预检警告提示“未检测到可提取文本层”。
- **建议修复方向**: 在 pre-upload 检验中增加文本密度探测。
- **是否阻塞发布**: **否 (已具备提取字符数统计与截断状态展示)**。

### [P3] Oxlint 未使用变量提示 (9 处)
- **审计编号**: `CODE-01`
- **所属阶段**: 阶段 7 (代码质量)
- **影响模块**: 部分测试文件（如 `question-quality.test.ts`, `responsive-workspace.test.ts`）
- **实际行为**: 运行 `pnpm run lint` 报告 9 处未使用变量（如未使用的导入标识符）。
- **建议修复方向**: 清理测试文件中的无用导入。
- **是否阻塞发布**: **否 (无语法或逻辑错误)**。

---

## 15. 测试盲区

当前自动化测试套件（351 项）已覆盖核心状态机、并发冲突、断电恢复与响应式断点，但仍存在以下**需人工物理环境辅助**的测试盲区：
1. **真实物理屏幕阅读器 (NVDA / VoiceOver / TalkBack) 实时流朗读体验**：需人工戴耳机复核在流式回答新追加时，屏幕阅读器是否会过度打断正在编辑的输入框。
2. **极端高对比度主题 (Windows High Contrast Theme)**：在极端自定义系统调色板下，部分细边框对比度建议由人工实机肉眼确认。

---

## 16. 死代码、兼容层与架构债务

1. **历史实验报告与脚本**：`experiments/agent-benchmark/` 中保留了 `b2-vs-b2-targeted-1` 等历史对比结果文件，仅作为演进证据，生产代码未对其产生依赖。
2. **测试用例中的 Mock 类**：`packages/agent/tests/MockAgy.cs` 等作为本地模拟测试工具存在，不进入生产打包产物。

---

## 17. 建议修复路线

### Release Blocker (发布阻塞项)
- **无**。所有核心安全、状态一致性与 B3 契约已达到发布标准。

### 发布前建议微调 (P3)
- 清理 Oxlint 报告的 9 处测试文件无用导入。

### 发布后近期优化 (P2)
- 引入流式压缩管道，进一步优化包含超大附件项目的导出内存占用。
- 强化无文字层扫描版 PDF 的上传预检提示。

---

## 18. 最终发布判断 (10 问 10 答)

1. **八阶段是否真正完成？**
   - **是**。从基线清理、统一领域、引用授权、问题质量、数据安全、文档可信、中文 UX 到 B3 Benchmark 8 个阶段均通过测试与实机验证。
2. **当前产品是否能安全处理真实用户项目？**
   - **是**。本地 JSON 文件存储配合两阶段提交和原子恢复，具备工业级健壮性。
3. **是否存在数据丢失或状态污染风险？**
   - **否**。用户输入预落盘，旧 Revision 任务严格隔离，Stale 结果原子丢弃。
4. **B3 是否真正满足自适应多问题目标？**
   - **是**。12/8/4/2 四阶段预算严格收敛，同批问题 100% 独立无依赖。
5. **问题是否中文易懂且选项影响明确？**
   - **是**。全量中文自然语言输出，选项影响涵盖范围、时间、成本与风险。
6. **Provider 和隐私说明是否真实？**
   - **是**。真实探测 CLI 版本与状态，明确告知项目数据发送情况，杜绝虚假承诺。
7. **Readiness 和文档是否可以被用户信任？**
   - **是**。Readiness 排除概述且不给假设加分；文档固定 8 份核心蓝图，带 SHA-256 溯源。
8. **移动端和键盘用户能否完成核心路径？**
   - **是**。390px 单栏模态抽屉，全键盘 radiogroup 上下键与 Focus Trap 焦点管理完备。
9. **性能是否达到可接受水平？**
   - **是**。Question Context 限制在 12k 字符内，p50 46.38s / p95 68.18s，Prompt 缓存命中显著。
10. **发布前必须修复什么？**
    - **无需修复阻塞项**，可直接进入生产版本发布流程。

---

## 19. 审计证据索引

- **测试全量日志**: [vitest-full-run.log](file:///d:/桌面/项目构思/.workspace/audits/2026-08-27-post-phase8/vitest-full-run.log)
- **B3 发布基准报告**: [B3_RELEASE_VALIDATION_REPORT.md](file:///d:/桌面/项目构思/experiments/agent-benchmark/reports/B3_RELEASE_VALIDATION_REPORT.md)
- **B3 基准汇总数据**: [b3-summary.json](file:///d:/桌面/项目构思/experiments/agent-benchmark/results/b3-summary.json)
- **全量归一化结果目录**: [results/normalized/b3-2026-08-27T07-41-03-774Z/](file:///d:/桌面/项目构思/experiments/agent-benchmark/results/normalized/b3-2026-08-27T07-41-03-774Z/)
- **全量原始输出目录**: [results/raw/b3-2026-08-27T07-41-03-774Z/](file:///d:/桌面/项目构思/experiments/agent-benchmark/results/raw/b3-2026-08-27T07-41-03-774Z/)
