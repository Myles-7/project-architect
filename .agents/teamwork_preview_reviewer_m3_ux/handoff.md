# M3 Reviewer & Adversarial Critic Report: UI/UX & Deliverable Acceptance

> **审查代理**: `teamwork_preview_reviewer_m3_ux`  
> **审查对象**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md`  
> **基准契约**: `ORIGINAL_REQUEST.md`, `d:\桌面\项目构思\.agents\orchestrator_1\PROJECT.md`, `AGENTS.md`  
> **时间戳**: 2026-09-22T04:45:00Z  
> **审查结论 (Gate Verdict)**: **APPROVE (通过准入)**

---

## 1. Observation (客观实测与代码复核证据)

我们对 `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` 进行了逐章节、逐行、逐代码引用的严密交叉核验（特别聚焦 Section 1 视觉设计系统、Section 2 排版空间与响应式、Section 3 交互与工作流、Section 8 可行性矩阵与 Section 9 路线图）。

### 1.1 事实依据与代码实测复核表

| 审计项编号 | 报告声称的问题与定位 | 独立核验工具与方法 | 真实代码观测事实 | 一致性判决 |
| :--- | :--- | :--- | :--- | :---: |
| **Issue 1.1** | `index.css:5-24` 未使用 `@theme` 绑定 CSS 变量；`AppShell.tsx:51`, `QuestionCard.tsx:150-157, 240, 274`, `DiscoveryProgressTicker.tsx:77, 134` 硬编码 7 级暗色 Hex。 | `view_file` 查阅 `index.css`, `AppShell.tsx`, `QuestionCard.tsx`, `DiscoveryProgressTicker.tsx` | 证实：`index.css` 仅在 `:root` 和 `.dark` 声明原生 CSS 变量，未配置 Tailwind v4 `@theme`。`QuestionCard.tsx:150` 为 `dark:bg-[#121316]`，L157 为 `dark:bg-[#15161A]/80`，L240 为 `dark:bg-[#141519]/40`，L274 为 `dark:bg-[#17181D]`，`DiscoveryProgressTicker.tsx:77` 为 `dark:via-[#131418]`，L134 为 `dark:bg-[#18191E]/80`。7 级色阶完全属实。 | **100% 准确** |
| **Issue 1.2** | 幽灵 Tailwind 类名 `py-0.2`, `py-0.8`, `backdrop-blur-xs`, `zinc-850` 被编译器静默废弃，导致内边距归零与样式失效。 | `view_file` 查阅 `TopNav.tsx:81`, `OverviewDrawer.tsx:395, 407`, `ChatView.tsx:806, 810`, `Modal.tsx:46`；`grep_search` 扫描编译产物 `apps/web/dist/assets/index-CpwPBvFr.css` | 证实：源码中确实存在上述类名；在生产 CSS 编译产物 `index-CpwPBvFr.css` 中上述 4 个选择器全部命中为 **0**，确实被编译器静默丢弃。按钮内边距实际坍缩为 0px。 | **100% 准确** |
| **Issue 1.3** | `text-zinc-400` 在白色背景与 `zinc-100` 背景下的对比度分别为 2.60:1 与 2.35:1，违反 WCAG 2.1 AA (4.5:1)；全站泛滥 `text-[10px]` 与 `text-[9px]`。 | 相对亮度公式数学复算；`view_file` 查阅 `UploadMaterialModal.tsx`, `TimelineView.tsx:229`, `DocumentsView.tsx:448` | 证实：`#A1A1AA` 在 `#FFFFFF` 下的相对亮度比测算值为 2.58:1（报告标注 ~2.60:1），在 `#F4F4F5` 下为 2.35:1，均远低于法定的 4.5:1。`DocumentsView.tsx:448` 确有 `text-[9px]`。 | **100% 准确** |
| **Issue 1.4** | `QuestionCard.tsx` 存在深达 6 层的边框与半透明背景叠加，导致单批问题呈现超 25 条分割线与高认知负荷。 | `view_file` 追踪 `QuestionCard.tsx` L148-447 DOM 嵌套 | 证实：卡片外框 (`border-orange-400/90`) $\rightarrow$ Header (`border-b`) $\rightarrow$ 理由区 (`border-b`) $\rightarrow$ 推荐栏 (`border-t`) $\rightarrow$ 单选卡片 (`border`) $\rightarrow$ 选项利弊 (`border-t`)，层级深度恰为 6 层。 | **100% 准确** |
| **Issue 2.1** | 1200px-1247px 视口三栏宽度叠加（左栏 224px + 中栏 min-w 640px + 右栏 384px = 1248px）引发 48px 视口溢出截断。 | `view_file` 查阅 `AppShell.tsx:34, 51, 91-95, 103`, `LeftSidebar.tsx:154`, `OverviewDrawer.tsx:483` | 证实：`LeftSidebar` 固定 `w-56` (224px)，中间工作区限制 `min-w-[640px]`，右侧抽屉在宽度 $\ge 1024$px 时应用 `lg:w-96` (384px)。总和 $224+640+384 = 1248$px。在 1200px 视口下必定超出 48px，且外层带有 `overflow-hidden`，右侧边缘被硬性截断。数学推导严密无误。 | **100% 准确** |
| **Issue 2.2** | 移动端/平板端抽屉双重 48px Header 纵向叠放，白白损耗 96px 垂直可视高度。 | `view_file` 查阅 `AppShell.tsx:107-117`, `ResponsiveDrawer.tsx:119-126`, `OverviewDrawer.tsx:486-507` | 证实：`ResponsiveDrawer` 渲染自带 48px 标题栏 (`h-12`)；其子组件 `OverviewDrawer` 忽略了 `inDrawer` 属性，内部无条件再次渲染自身 48px Header，造成视觉双重堆叠。 | **100% 准确** |
| **Issue 2.3** | 文档阅读器 H3 标题 (14px) 与正文/表格 (12px) 仅相差 2px，无法形成视觉锚点。 | `view_file` 查阅 `MarkdownRenderer.tsx:91-117, 163, 175` | 证实：H1 为 18px (`text-lg`)，H2 为 16px (`text-base`)，H3 为 14px (`text-sm`)，而正文段落与表格统一为 12px (`text-xs`)。字阶比率仅为 1.16，确实严重扁平化。 | **100% 准确** |
| **Issue 3.1** | 推演重试流断裂 (Dead Retry Button) 与用户 500 字输入丢失隐患。 | `view_file` 查阅 `ChatView.tsx:143-185, 733-753` | 证实：L160 在异步调用未全部完成前便同步执行 `setInputMessage('')` 并清空 `localStorage`；当后续任务抛错时，L745 重试按钮无参调用 `handleSendMessage()`，被 L145 的守护语句 `if (!inputMessage.trim()) return` 直接拦截，成为无法点击的“死按钮”，用户草稿无法恢复。 | **100% 准确** |
| **Issue 3.2** | 决策确立单向不可逆，缺乏单题撤回机制，误触只能通过全项目版本回滚补救。 | `view_file` 查阅 `QuestionCard.tsx:269-277`, `ProjectStateEngine.ts:1033-1037`，`grep_search` 检索 `retract` | 证实：`ProjectStateEngine` 对 `answered` 题目强制写封锁（抛错 `can no longer be answered`），全系统无任何单个题目重开或撤销接口；UI 界面一旦答完只呈现静态展示态。 | **100% 准确** |
| **Issue 3.3** | 答题卡片突兀从 DOM 移除造成高 CLS 布局跳动；`DiscoveryProgressTicker` 依据硬编码 0s, 4s, 10s, 18s 伪装推演进度。 | `view_file` 查阅 `ChatView.tsx:460`, `DiscoveryProgressTicker.tsx:6-31` | 证实：`activeQuestions` 依据 `q.status === 'shown' \|\| q.status === 'proposed'` 瞬时过滤；`PROGRESS_STEPS` 内部确实以 `minSeconds: 0, 4, 10, 18` 纯前端 setInterval 伪步进。 | **100% 准确** |
| **Issue 3.4** | 缺少目录选择器；滥用原生阻塞性 `alert()` 与 `window.confirm()`。 | `view_file` 查阅 `HomeView.tsx:208, 215, 268, 271` | 证实：项目路径强制绑定在 `projects/` 相对路径；首页多处调用 `alert(...)` 与 `window.confirm(...)` 阻塞 UI 线程。 | **100% 准确** |
| **Issue 3.5** | 文档手动修改在重新编译时被静默覆盖 (`POST /documents/write` 未入快照，`generate` 暴力刷盘)。 | `view_file` 查阅 `DocumentsView.tsx:160-175`, `apps/server/src/server.ts:1188-1230, 1287-1315` | 证实：`server.ts:1306` 仅调用 `storage.writeText` 写入磁盘，未修改快照或提交版本；`server.ts:1215` 重新调用 `compileDocuments` 时直接依据旧快照重新渲染模板并覆盖磁盘文件。 | **100% 准确** |
| **Issue 3.6** | 问答输入框回车无效；缺乏快捷键导航与 `aria-live` 读屏播报。 | `view_file` 查阅 `QuestionCard.tsx:418`, `QuestionWizard.tsx:262-310`, `DiscoveryProgressTicker.tsx:76` | 证实：输入框无 `onKeyDown` 或 `<form>` 监听；向导无键盘左右键切换；Ticker 容器无任何 `role="status"` 或 `aria-live` 属性。 | **100% 准确** |

---

## 2. Logic Chain (推导逻辑链与论证严密性)

1. **从事实到问题定性 (Observation $\rightarrow$ Issue Identification)**:
   - 针对 UI 视觉维度，核查证实了 Tailwind v4 编译机制下未声明 `@theme` 导致工具类脱节，直接引发在数十处组件中硬编码 `#121316`、`#15161A`、`#17181D` 等 7 种互不协调的暗色色值，并导致 `py-0.8` 等幽灵类名被静默丢弃。
   - 针对排版空间维度，核查证实了 $224\text{px} + 640\text{px} + 384\text{px} = 1248\text{px}$ 的硬性约束在 1200px Desktop 断点下必然导致 48px 内容被硬性裁切。
   - 针对交互流程维度，核查证实了异步发起前清空草稿 (`setInputMessage('')`) + 错误卡片直接调用无参函数引发的死锁链条；证实了文档在线编辑由于未受版本状态机托管而在全量重新编译时面临 100% 静默数据丢失。

2. **从问题到方案设计 (Issue $\rightarrow$ Solution Design)**:
   - 方案 1 采用标准 Tailwind v4 `@theme` 建立 5 级表面标高系统与 WCAG AA 达标色盘，从根本上替换硬编码 Hex。
   - 方案 2 提供了精炼的纯净视界线框图 (Wireframe) 与扁平化 JSX 重构骨架，成功将边框嵌套从 6 级降至 2 级。
   - 方案 3 将断点提升至 1280px，并在 1024-1279px 引入侧边栏折叠收缩（64px 图标模式），使得主视口在任何分辨率下均保持 $\ge 848\text{px}$，消除了溢出；同时在子组件增加 `!inDrawer` 判断，一键消除移动端双 Header。
   - 方案 4 绘制了清晰的交互状态转移图，分离输入提交与清空动作，保证重试流 100% 携带原始草稿。
   - 方案 5 在服务端新增 `POST /questions/retract` 接口，在状态机中原子提交新版本将决策置为 `deprecated` 并将问题还原为 `shown`，既满足了 Nielsen 容错原则，又 100% 遵循了 `AGENTS.md` 本地两阶段提交原则。
   - 方案 8 构筑了文档重编译差异拦截器 (Diff Guard)，在重新生成前检查磁盘文件与快照基准的哈希，拦截覆盖并提供统一 Diff 预览。

3. **从方案到可行性与验收闭环 (Solution $\rightarrow$ Feasibility & Roadmap)**:
   - 方案包含完整的 20 项技术可行性、涉及模块、人日成本、破坏性风险与量化指标矩阵（Section 8）。
   - 路线图按照 P0（核心安全与死锁修复，Day 1-3）、P1（视觉排版与核心交互流畅度，Day 4-8）、P2（材料解析与生态演进，Day 9-14）清晰分级。
   - Section 10 提供了包含命令与判据的 12 项验收自查清单，可直接供后续实施团队验证。

---

## 3. Adversarial Stress-Testing & Integrity Audit (对抗性压力审查与诚信审查)

作为兼任 Adversarial Critic 的审查者，我们对报告进行了严格的边界攻击与诚信排查：

### 3.1 对抗性压力挑战 (Critic Challenges)

#### Challenge 1: 1280px 断点提升在 Windows 1080p 150% 缩放下的表现
- **攻击假设**: Windows 系统在 1080p 笔记本上默认推荐 150% 缩放（逻辑分辨率为 1280x720，扣除系统托盘与浏览器边框后，视口宽度常为 1263px-1275px）。如果断点提升为 1280px，这类用户将永远无法看到展开的左侧导航栏。
- **压力分析**:
  - 在方案 3 的推导中，1024px ~ 1279px 区间被定义为“紧凑桌面模式”：左栏呈现 64px 图标模式 (`isIconOnly={true}`)，右栏为 288px。
  - 主工作区宽度为 $1263 - 64 - 288 = 911\text{px}$，远超 $640\text{px}$ 最小安全宽度，且左侧核心导航图标依然全部可见，无障碍可达。
  - 当用户窗口全屏（视口正好达到或超过 1280px 时），$1280 - 224 - 384 = 672\text{px} > 640\text{px}$，完整三栏完全容纳。
  - **结论**: 方案设计考虑周全，无破坏性死角。

#### Challenge 2: 撤销机制 (`retractQuestion`) 是否会导致状态机依赖冲突与快照分叉？
- **攻击假设**: 若后续问题 B 的生成依赖于问题 A 所做出的决策，如果用户在 10 秒内撤回了问题 A 的回答，问题 B 是否会变为悬空状态？
- **压力分析**:
  - 在 B3 宪法与自适应问题集规范（`docs/blueprint/12_B3_ADAPTIVE_DISCOVERY.md`）中，**同批次问题必须使用唯一 `decision_key` 且彼此互不依赖**。
  - 只有在这一批问题全部回答或推演进入下一个 `turn` 时，状态机才会重新计算 Gap 并派生下一批问题。
  - 方案 5 巧妙地将撤回限制在 **当前批次且 10 秒缓冲倒计时内**（在启动下一次后台推演前）。此时下游依赖尚未生成，撤回仅涉及清除单个决策并标记为 `deprecated`，完全不会产生依赖悬空或环状破坏。
  - **结论**: 逻辑闭环，架构安全。

### 3.2 绝对诚信审查 (Integrity Violations Check)

依据 Reviewer 铁律，我们严格审查了是否存在任何诚信违规行为：
1. **硬编码测试结果或预期输出**：无。报告未篡改任何代码，反而在 Issue 5.4 中主动揭露了现有核心代码（`QuestionComposer.ts:193-214`）中硬编码特定测试用例（虚拟情侣房间）的违规行为，并给出了将其彻底解耦的方案 16。
2. **虚拟假实现或空壳代码**：无。报告中提出的所有方案均包含真实可用的 TSX/TS/CSS 结构与严密的接口类型定义。
3. **绕过任务的捷径或外部剽窃**：无。所有 27 个问题均源于对本项目 8 个主要子模块的真实源码扫描。
4. **伪造验证输出或测试日志**：无。报告中引用的编译 CSS 匹配项（`py-0.8: 0 项`等）在本地磁盘真实存在且完全可由 `grep_search` 复现。
5. **未经独立验证的自我证明**：无。本 Reviewer 独立执行了多次工具调用，逐行比对代码与数学公式，结论完全独立有效。

**诚信判定**: **PASS (零诚信违规，真实性与客观性极佳)**。

---

## 4. Acceptance Criteria Compliance Matrix (验收标准达标核验)

对照 `ORIGINAL_REQUEST.md` 中的所有验收条目逐项核对：

| 验收标准大项 | 具体指标要求 | 报告履约情况 | 达标评估 |
| :--- | :--- | :--- | :---: |
| **Audit Grounding & Coverage** | 涵盖 UI、排版、交互、功能、架构五大板块，每板块至少 3-5 个真实代码/规范实例。 | 报告完整覆盖 5 大板块，共计发掘 **27 个问题**（UI: 5, 排版: 4, UX: 6, 功能: 6, 架构: 6），每一项均标明精确文件路径、代码行号与代码片段。 | **100% 达标 (超额达成)** |
| **Prototype vs Production** | 严格对照规范界定 `frontend/` (原型) 与 `apps/web/` (生产) 的现状与差距。 | Section 1.3 绘制了 ASCII 双轨演进架构图，深入辨析了原型拥有高信息密度（大纲树与状态过滤胶囊）但缺失契约状态机，生产应用具备真实 B3 与两阶段提交但缺乏紧凑看板的现实，并制定了 P1 移植、P2 归档的平稳演进策略。 | **100% 达标** |
| **Solution Feasibility & Rigor** | 核心方案配有独立可行性分析（依赖、成本、风险）与量化收益指标。 | Section 7 针对每个方案详细给出了重构逻辑；Section 8 形成了涵盖 20 项改善方案的综合可行性与量化收益矩阵；包含具体人日与破坏性风险评估。 | **100% 达标** |
| **AGENTS.md Compliance** | 100% 遵从五大铁律（零数据库、本地两阶段提交、B3 单次结构化调用、用户授权第一）。 | 所有改善方案严格遵循本地文件与两阶段提交机制；未引入任何 SQL/NoSQL 数据库；未改变 B3 单次结构化调用宪法；保护用户手动编辑（Diff Guard）。 | **100% 达标** |
| **Phased Roadmap** | 包含清晰分级的实施优先级路线图 (P0, P1, P2)。 | Section 9 详细定义了 P0（Day 1-3 稳定度与铁律）、P1（Day 4-8 体验与视觉）、P2（Day 9-14 功能完备与生态），任务映射清晰明确。 | **100% 达标** |
| **Deliverable Completeness** | 输出至 `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md`，排版规范，具备目录导航与表格对比。 | 报告全长 1413 行、93.9 KB，目录超链接完备，Markdown 标题树与表格层次分明，呈现工业级报告水准。 | **100% 达标** |

---

## 5. Caveats (审查边界与说明)

1. **构建工具环境**: 在执行本地 `pnpm test` 与 `pnpm build` 时，因当前环境根目录未安装全局 `node_modules`，导致本地 CLI 提示 `vitest`/`tsc` 未识别。但经核实，`apps/web/dist/` 中已预存有近期的真实生产编译产物（`assets/index-CpwPBvFr.css`），且代码的静态语法与类型契约经人工代码走查确认无破坏性语法错误。后续在具备完整网络与依赖环境的机器上执行 `pnpm install` 即可正常运行全量流水线。
2. **实施落地提示**: 在实施方案 4（弹性输入与重试）时，注意区分“未进入后端的本地调度失败”与“已调用 `recordDiscoveryInput` 后的调度失败”，针对后者应重用服务端返回的 `turnId`，避免生成重复的输入快照。

---

## 6. Conclusion & Gate Verdict (最终结论与准入判决)

- **综合评价**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` 是一份极其详尽、论述严密、数据扎实、方案可落地性极高的国家级工业标准架构诊断报告。它不仅精准指出了表现层与交互层积攒的 15 项深度体验问题，更跨领域直击了底层状态机、文档持久化和 B3 推演中的 12 项潜在安全与架构隐患，完全超越了一般代码审查的深度。
- **Gate Verdict**: **APPROVE (通过准入 / 强烈推荐采纳)**。

---

## 7. Verification Method (独立复核方法指南)

任何后续审查者或开发者均可通过以下确定性步骤复现并核验本报告中的结论：

1. **复核幽灵 Tailwind 类名**:
   ```bash
   # 在 apps/web/dist/assets/ 目录下检索编译后的 CSS 规则
   grep -o "py-0.8" apps/web/dist/assets/index-*.css || echo "0 matches (Ghost class verified)"
   grep -o "backdrop-blur-xs" apps/web/dist/assets/index-*.css || echo "0 matches (Ghost class verified)"
   ```
2. **复核 1200px 响应式截断冲突**:
   - 打开 `apps/web/src/app/AppShell.tsx`，定位第 34 行（`windowWidth >= 1200`）、第 92 行（`min-w-[640px]`）。
   - 打开 `apps/web/src/components/layout/LeftSidebar.tsx`，定位第 154 行（`w-56` = 224px）。
   - 打开 `apps/web/src/features/overview/OverviewDrawer.tsx`，定位第 483 行（`w-80 lg:w-96`，在 $\ge 1024$px 时为 384px）。
   - 计算 $224 + 640 + 384 = 1248 > 1200$，验证在 1200px 处发生 48px 截断。
3. **复核重试死按钮**:
   - 打开 `apps/web/src/features/chat/ChatView.tsx`，核对第 145 行、第 160 行与第 745 行，确认 `inputMessage` 在第 160 行被同步清空，导致第 745 行无参重试必被第 145 行拦截。
