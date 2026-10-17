# Technical Architecture & Blueprint Compliance Review Report

> **Reviewer**: teamwork_preview_reviewer (Technical Architecture & Adversarial Critic)  
> **Target Deliverable**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md`  
> **Parent Conversation ID**: `7c4eeea1-eb14-4ac9-83a6-20550d74235f`  
> **Date**: 2026-09-22  
> **Gate Verdict**: **APPROVE**  
> **Integrity Violation Status**: **CLEAN (0 Violations Detected)**

---

## 1. Observation (客观实证)

通过对代码库各核心包 (`packages/core/`, `packages/contracts/`, `packages/agent/`, `apps/server/`, `frontend/`, `docs/blueprint/`) 的逐行代码级静态审查与交叉验证，针对报告中的核心技术问题进行了 100% 独立实证比对：

### 1.1 Section 4 (业务功能完整性与蓝图规范对齐) 实证
- **Issue 4.1 (文档 Manifest 双重写入与项目根目录状态污染)**:
  - 源码实证 1: `packages/core/src/documents/DocumentCompiler.ts` 第 143 行确实存在 `await this.storage.writeJson(join(projectPath, 'documents.json'), manifest);`，并在第 148 行重复写入 `await this.storage.writeJson(join(manifestDir, 'manifest.json'), manifest);`。
  - 源码实证 2: `packages/core/src/engine/ProjectStateEngine.ts` 第 431-432 行将 `documents.json` 与 `documents/manifest.json` 共同纳入 `publicFiles`。
  - 源码实证 3: `packages/core/src/commit/StateCommitManager.ts` 第 278 行在 `stateFiles` 数组中包含了 `'documents.json'`。
  - 蓝图对齐: `docs/blueprint/04_PROJECT_STATE_MODEL.md §2` 第 40-44 行明确规定根目录下仅允许存在 `documents/manifest.json`，未授权根目录直接存在 `documents.json`。
- **Issue 4.2 (共享契约 `packages/contracts` 重复声明与字段分歧)**:
  - 源码实证 1: `packages/contracts/src/api.ts` 第 77-81 行与第 139-143 行存在完全同名的 `export interface ConfirmDecisionRequest` 重复定义。
  - 源码实证 2: `packages/contracts/src/api.ts` 第 167-175 行声明了包含 `turnId` 与 `intensity` 的 `ScheduleDiscoveryJobRequest`，而在第 264-270 行二次声明了缺失上述两个关键字段的同名接口。
- **Issue 4.3 (二进制办公文档 `.pdf`, `.docx` 解析断点致材料 100% 提取失败)**:
  - 源码实证: `packages/core/src/engine/ProjectStateEngine.ts` 第 2050-2070 行：在 `isDoc` 分支下，硬编码写入 `errorMessage = 'V1 local extractor does not parse binary PDF/DOCX format without external parser.'`，并将 `status` 直接强制标为 `'failed'`。
  - 蓝图对齐: `docs/blueprint/10_INPUT_MATERIAL_CONTRACT.md §2` 第 20 行明确将 `.pdf`、`.docx` 纳入 V1 支持范围。
- **Issue 4.4 (`AreaRegistry` 领域别名缺失导致技术决策误归类与 B3 预算失真)**:
  - 源码实证: `packages/core/src/areas/AreaRegistry.ts` 第 69 行 `technical_boundary.aliases` 仅包含 `['trust_safety', 'privacy_policy', 'platform_context', 'technical_constraints', 'security_boundary']`，缺少 `tech_stack`, `architecture`, `database`, `storage`。第 146-151 行未知区域回退为 `project_overview`（其在第 15 行被声明为 `countsForDiscovery: false`）。在 `QuestionBatchPolicy.ts` 第 18-21 行中，`clearAreaCount` 依赖 `isDiscoveryArea()`，导致技术决策无法累加成熟度，死锁在 `initial/explore` 阶段。
- **Issue 4.5 (API 契约文档与核心文档规划生成的载荷漂移)**:
  - 源码实证: `packages/core/src/documents/DocumentPlanner.ts` 第 18-75 行规划生成的为 8 篇蓝图文档（`AGENTS.md`, `PROJECT.md`, `PRODUCT.md`, `USER_FLOWS.md`, `UX_UI_SPEC.md`, `TECHNICAL_GUIDE.md`, `DEVELOPMENT_PLAN.md`, `ACCEPTANCE.md`）；而 `docs/api/API_V1.md` 第 480-490 行列出了 9 篇历史旧命名（包含 `ARCHITECTURE.md`, `STATE_MODEL.md` 等）。
- **Issue 4.6 (原型至生产的交互断层：大纲折叠树与状态筛选胶囊未接入)**:
  - 源码实证: `frontend/src/components/workspace/OverviewPane.tsx` 第 38-40 行具备 `viewMode: 'cards' | 'outline'` 与 `activeFilter: 'all' | ItemStatus`，而在生产应用 `apps/web/src/features/overview/OverviewDrawer.tsx` 中经全局 grep 检索，`viewMode` 与 `activeFilter` 匹配数均为 0。

### 1.2 Section 5 (系统架构与开发铁律合规性) 实证
- **Issue 5.2 (生产包内残留 6 份废弃 B2 Schema 引发的向后兼容隐患)**:
  - 源码实证: `packages/agent/src/schemas/` 目录下物理存在 `decision-review.schema.json`, `document-compile.schema.json`, `gap-analysis.schema.json`, `idea-analysis.schema.json`, `question-generation.schema.json`, `readiness-review.schema.json` 6 份废弃 B2 文件；而生产运行时 `SchemaResolver.ts` 已全面硬编码收敛至 `b3-discovery.schema.json`。
- **Issue 5.3 (`ProjectStateEngine.applyDiscoveryTurn` 未经预算的问题旁路注入)**:
  - 源码实证: `packages/core/src/engine/ProjectStateEngine.ts` 第 1698-1734 行 `else` 分支直接遍历 `result.questions` 灌入 `snapshot.questions.items`，绕过了 `QuestionSelector` 和 `QuestionBatchPolicy`。
- **Issue 5.4 (兜底问题生成器与评测固件业务文案耦合)**:
  - 源码实证: `packages/core/src/questions/QuestionComposer.ts` 第 194-228 行硬编码了针对虚拟情侣房间固件的特定文案（例如“内置 2-3 套精美默认形象与装扮素材”、“基础双人在线状态与单向高频动作广播”、“情侣两人私密专属空间”）。
- **Issue 5.5 (CLI 命令行参数硬截断 28k 字符与宽容结构化解析风险)**:
  - 源码实证: `packages/agent/src/provider/AntigravityCliProvider.ts` 第 68-71 行对 Windows 平台执行了 `fullPrompt.slice(0, 28000)` 的字符硬截断；第 303-311 行在缺失 `structured_output` 时对 `envelope.response` 进行了宽松的字典解析兜底。
- **Issue 5.6 (Windows 驱动器盘符大小写导致两阶段提交互斥锁失效)**:
  - 源码实证: `packages/core/src/commit/StateCommitManager.ts` 第 84 行 `const key = resolve(projectPath);` 未做大小写归一化，在 Windows 平台下大小写不同的同一物理路径会产生互斥锁分裂。
- **Issue 5.7 (原型目录与正式生产代码缺乏自动化 Monorepo 边界阻断)**:
  - 源码实证: 根目录 `package.json` 仅配置了基本的 `oxlint` 命令，没有任何针对 `frontend/` 目录的 ESLint / Oxlint 导入边界规则或 TypeScript Project References 阻断。

### 1.3 Section 3 关联关键技术问题实证
- **Issue 3.2 (决策确立单向不可逆与单题撤销机制缺失)**:
  - 源码实证: `packages/core/src/engine/ProjectStateEngine.ts` 第 1035-1037 行规定对 `answered` 问题再次作答直接抛出异常；`apps/server/src/server.ts` 只有 `/answer` 和 `/dismiss` 路由，缺少撤回端点。
- **Issue 3.5 (文档手动编辑在重新编译时的静默覆盖灾难)**:
  - 源码实证: `apps/server/src/server.ts` 第 1306 行 `/documents/write` 仅写入物理磁盘，未存入快照；第 1215 行 `/documents/generate` 调用 `DocumentCompiler` 基于快照强制刷写磁盘，将用户手动修改静默抹除。

---

## 2. Logic Chain (推理逻辑链)

1. **事实核验推导**:
   - 上述在 Observation 1.1、1.2、1.3 中记录的全部 14 处技术缺陷与代码定位，均在当前仓库的源代码中找到了 100% 吻合的文件路径、上下文逻辑及行号。
   - 这证明报告中所有的技术问题均来自对代码仓库与工程蓝图的**真实、深入的静态审计**，不存在凭空捏造、模糊臆断或夸大其词的现象。

2. **AGENTS.md 绝对铁律合规性推导**:
   - **铁律 1: 保持 B3 契约完整**: 方案 14 物理归档 6 份遗留 B2 资产，方案 15 强制问题必须通过 Core 本地阶段预算与独立性筛选，方案 16 清理特定情侣固件硬编码文案。所有方案均强化并捍卫了 B3 唯一生产运行时的地位。
   - **铁律 2: 严格单次调用与结构化输出**: 方案 17 将 CLI Provider 改造为 Stdin 流式传输，破除 Win32 32k 限制，防止因截断导致提示词损坏或引发额外轮次；报告坚决杜绝了引入任何 Multi-Agent 讨论、多轮反思或自然语言爬取的旁门左道。
   - **铁律 3: 用户授权第一与状态保护**: 方案 5 提供的 10 秒撤回缓冲（Undo Toast）与状态机撤销协议 (`retractQuestion`)、方案 8 提供的文档重编译差异拦截器 (Diff Guard)，本质上都在极大强化“用户授权第一”的原则，彻底封死系统未经用户许可擅自覆盖其劳动成果的漏洞。
   - **铁律 4: 自用优先，拒绝过度工程化 (零 DB / 本地两阶段)**: 全文 20 个改善方案中，**100% 坚持纯本地文件目录 + 两阶段 State Commit 架构**。方案 11 明确采用纯 JS/TS 库（`pdf-parse` 与 `mammoth`），坚决拒绝引入外部 Python 服务、C++ 插件或微服务架构；方案 18 修复了 Windows 互斥锁的盘符大小写竞态，直接加固了本地两阶段提交机制的原子性与工业级坚固度。报告中**绝对没有引入任何 SQLite、PostgreSQL、Prisma、TypeORM、远程登录系统、授权门禁或云同步机制**。
   - **铁律 5: 原型与正式代码隔离**: 方案 13 仅从 `frontend/` 提取纯视图渲染逻辑（卡片/大纲视图切换与状态过滤），强类型对接 `packages/contracts`；方案 19 在根目录配置机器级 Lint 规则彻底切断依赖可能。

3. **技术可行性与工程实施推导**:
   - 20 个方案的代码修改范围界定清晰，涉及模块粒度合理，改造成本（总计 10-14 人日）与三阶段分步路线图（P0 关键稳定性 $\rightarrow$ P1 核心交互 $\rightarrow$ P2 完备演进）逻辑缜密，具备极高的可操作性与生产落地价值。

---

## 3. Caveats & Adversarial Challenges (局限与对抗性挑战)

本评审人以对抗性挑剔视角对方案进行了深度推演，提出以下 4 项对抗性挑战与防御建议（不影响大局批准，建议作为实施细则补充）：

### 对抗性挑战 1: 方案 17 (CLI Stdin 管道流式通信) 的宿主兼顾性
- **挑战假设**: 假设外部 Antigravity CLI 工具必然支持 `--stdin` 命令行参数。
- **攻击场景**: 如果开发者本地安装的特定旧版本或定制版 `agy` 二进制程序未开启或未编译 Stdin 流式监听能力，直接向其写入 Stdin 可能导致进程悬挂（Hang）或退出报错。
- **防御加固建议**: CLI 适配层在执行 Stdin 传输前，可通过环境变量 (`AGY_STDIN_ENABLED=1`) 控制，或者在初次启动时执行自检；若宿主 CLI 不支持，可降级为受控的安全临时文件模式 (`--file <temp_path>`)，以增强最大向下兼容性。

### 对抗性挑战 2: 方案 18 (Windows 路径大小写互斥锁) 的路径标准化边界
- **挑战假设**: 假设 `resolve(projectPath).toLowerCase()` 即可完全消除路径别名冲突。
- **攻击场景**: 在 Windows 下，除了驱动器盘符大小写外，还可能存在短路径名（如 `PROGRA~1`）、符号链接（Symlink/Junction）或正反斜杠混用（`d:/path` vs `d:\path`）。
- **防御加固建议**: 在生成互斥锁 Key 时，建议采用 Node.js 规范的 `path.normalize(resolve(projectPath)).toLowerCase()`，甚至调用 `fs.realpathSync.native()` 获取系统权威规范物理路径。

### 对抗性挑战 3: 方案 11 (纯 JS PDF/DOCX 文本提取) 的大文件内存防护
- **挑战假设**: `pdf-parse` 和 `mammoth` 可以在任何内存限制下安全运行。
- **攻击场景**: 用户若上传一份高达 20MB、内含数千页文字的超大 PDF，一次性载入 Buffer 并解析可能导致 Node.js 事件循环瞬间卡死或触发 OOM (Out Of Memory)。
- **防御加固建议**: 在调用解析库前，检查文件大小与页数阈值（如最大读取前 50 页或提取前 10 万字符），并设置解析超时守护机制（如 10 秒超时中断）。

### 对抗性挑战 4: 方案 5 (决策撤回协议) 的下游依赖级联完整性
- **挑战假设**: 撤回单个决策仅需重置该题状态与决策标记。
- **攻击场景**: 若用户在回答问题 Q1 后，后续推演生成了深度依赖 Q1 决策的衍生候选决策或次级问题 Q2，撤回 Q1 是否会导致决策拓扑图出现悬空依赖？
- **防御加固建议**: `retractQuestion` 核心逻辑中，应检索是否有以该决策为 `depends_on` 的后续未锁定候选决策，并将其状态提示重置或告警，确保依赖树自洽。

---

## 4. Conclusion (评审结论与 Gate Verdict)

### 4.1 核心裁定: **APPROVE (全面通过)**
- **诚信核查**: **100% 真实独立核查**。无任何硬编码欺骗、门面假实现、自证式伪造或抄袭绕道行为。
- **事实基准**: Section 4 与 Section 5 中指出的 14 项技术缺陷 100% 真实存在于代码库中，行号与上下文准确无误。
- **铁律遵从**: 20 个改善方案 100% 坚守“零数据库、零远程认证、单次结构化 B3、用户授权第一、原型与生产物理隔离”的开发铁律，架构自律性极高。
- **可行性与落地性**: 方案技术路线清晰，成本评估合理，路线图分级得当，完全满足作为工程实施纲领的标准。

---

## 5. Verification Method (独立核验证明)

后续审计人员或编排者可执行以下步骤与代码检索以独立复现本评审结论：

1. **核验 Issue 4.1**:
   - 检查 `packages/core/src/documents/DocumentCompiler.ts` 第 143 行与 148 行。
   - 检查 `docs/blueprint/04_PROJECT_STATE_MODEL.md` 第 26-44 行目录规范。
2. **核验 Issue 4.2**:
   - 检查 `packages/contracts/src/api.ts` 第 77 行与 139 行（`ConfirmDecisionRequest`），第 167 行与 264 行（`ScheduleDiscoveryJobRequest`）。
3. **核验 Issue 4.3**:
   - 检查 `packages/core/src/engine/ProjectStateEngine.ts` 第 2050-2070 行关于 `isDoc` 的错误处理逻辑。
4. **核验 Issue 4.4**:
   - 检查 `packages/core/src/areas/AreaRegistry.ts` 第 69 行别名数组与第 146-151 行未知区域回退逻辑。
5. **核验 Issue 5.3**:
   - 检查 `packages/core/src/engine/ProjectStateEngine.ts` 第 1698-1734 行关于未经预算过滤的直接遍历逻辑。
6. **核验 Issue 5.4**:
   - 检查 `packages/core/src/questions/QuestionComposer.ts` 第 194-228 行关于情侣房间的正则表达式与文案。
7. **核验 Issue 5.5**:
   - 检查 `packages/agent/src/provider/AntigravityCliProvider.ts` 第 68-71 行与 303-311 行。
8. **核验 Issue 5.6**:
   - 检查 `packages/core/src/commit/StateCommitManager.ts` 第 84 行 `withProjectLock` 的 Key 生成逻辑。
9. **失效条件 (Invalidation Conditions)**:
   - 若发现任何一个方案引入了 SQLite/Prisma/PostgreSQL 或外部集中式远程服务，本评审结论即刻作废。
   - 若发现报告引用的任何核心代码行号纯属虚构，本评审结论即刻作废。
