# Empirical Dynamic Playwright Verification & Adversarial Stress Testing Report

**Challenger Agent**: `challenger_playwright_e2e`  
**Date**: 2026-09-25  
**Target Codebase**: Project Architect (`apps/web`, `apps/server`, `packages/*`)  
**Active Services**:
- Frontend Dev Server: `http://localhost:5174` (Vite 6.x, PID 25696)
- Backend API Server: `http://127.0.0.1:3001` (Fastify / Node.js, PID 12084)
- Test Workspace Dataset: `proj-1787926467702` (85 decisions, 31 questions, stage: approved)

---

## 1. Executive Summary

As the **Empirical Challenger**, we executed rigorous headless Playwright browser automation sweeps across **Lifecycles 1 through 6** and **multi-viewport layouts** (1440px desktop, 1024px compact desktop, 768px tablet, 375px mobile).

All assertions and findings in this report were verified empirically by executing automated browser scripts, capturing DOM screenshots, monitoring live browser console events, querying calculated CSS layout metrics (`getBoundingClientRect`, `scrollWidth`, `clientWidth`), and testing full user interaction cycles.

### Summary of Empirical Results
- **Lifecycles 1 to 6 Health**: **HEALTHY & OPERATIONAL**. All 6 lifecycle core workflows function end-to-end.
- **Single-File HTML Bundle Export**: Verified functional. Generated a **402,719-byte (~403 KB)** offline specification bundle containing complete project decisions, Mermaid diagrams, and 9 blueprint documents.
- **Document Compilation**: Verified functional. Emitted 9 markdown files (`AGENTS.md` and 8 blueprint docs), with live preview, raw code inspection, in-place textarea editing, and save persistence.
- **Decision DAG Canvas**: Verified interactive Pan/Zoom, layout direction switching (LR vs TD), and SVG node click cascade ripple impact disambiguation.
- **Total Empirical Issues Discovered**: **7 Issues** (4 P1, 3 P2), detailed in Section 4.

---

## 2. Lifecycle 1 to 6 Empirical Verification

### Lifecycle 1: Project Creation & Cold Start
- **Interactions Verified**:
  - Switch between *四项意图引导* (Structured 4-Intent) and *自由长文本输入* (Freeform) modes (`HomeView.tsx:571-610`).
  - Accordion / Tabs navigation between *场景灵感模板* (Scenario Templates) and *架构模式预设* (Architecture Presets). Applying template "AI 播客" pre-filled intent inputs successfully.
  - Modals: *查看本地 AI 引擎状态* (`ProviderHealthModal.tsx`) and *从已有代码逆向建项* (`DirectoryBrowserModal.tsx`) open cleanly with dimmed backdrop.
  - Project search filter: typing `想做` instantly filtered the historical project grid.
- **Artifacts**: `01-home-initial.png`, `02-home-freeform.png`, `02b-home-structured.png`, `03-home-templates-tab.png`, `03b-home-presets-tab.png`, `04-provider-health-modal.png`, `05-directory-browser-modal.png`, `06-home-project-search.png`.

### Lifecycle 2: Discovery Q&A & Cascade Retraction
- **Interactions Verified**:
  - `NextBestActionBanner` dynamically computes and displays current project state guidance and next discovery actions.
  - Dual modes for question handling: **QuestionWizard** (stepper with `#1`, `#2` progress badges, auto-advance, and default expanded cards) vs **QuestionList** (accordion cards with answered/active badges).
  - Answering an active question triggers the **10-Second Cascade Undo Banner** (`[role="status"]` with message `已确立决策: ... (10秒内可按 Ctrl+Z 撤回)` and `撤回 (Ctrl+Z)` button).
  - Invoking retract (via button click or `Ctrl+Z` shortcut) triggers `POST /api/projects/:id/questions/retract`, restoring the question card to active state and refreshing the project snapshot.
- **Artifacts**: `08-chat-view.png`, `08b-chat-wizard-mode.png`, `undo-test/01-expanded-question-card.png`, `undo-test/02-undo-banner-visible.png`.

### Lifecycle 3: Decision Management & Overview Drawer
- **Interactions Verified**:
  - Right `OverviewDrawer` metrics bar accurately aggregates live project metrics: 81 confirmed decisions, 0 locked, 4 candidates, 0 deprecated.
  - Dual view toggle between **Cards View** (`卡片列表视图`) and **Outline Tree View** (`紧凑大纲树视图`).
  - Search filtering by keyword and status pill filters (`全部`, `已确认`, `候选提案`, `已锁定`).
  - Double-clicking any decision card opens the in-place editing textarea (`overview-item-*`). Pressing `Escape` cleanly cancels editing without mutating state.
  - Decision edit modal opens cleanly with category selection, confirmation status, and justification inputs.
- **Artifacts**: `09-overview-outline-view.png`, `09b-overview-cards-view.png`, `09c-overview-filtered-candidates.png`, `09d-overview-search.png`, `09e-modal-edit-overview-item.png`, `09f-overview-inline-editing.png`, `deep/d16-overview-outline-tree.png`, `deep/d17-card-inline-editing.png`.

### Lifecycle 4: Decision DAG Explorer & Architecture Diagrams
- **Interactions Verified**:
  - Tab *决策因果有向图*: Mermaid DAG flowchart renders complex multi-cluster dependency graphs (`delivery_plan`, `user_flows`, `mvp_scope`, `page_structure`).
  - Canvas interactions: Mouse drag panning, mouse wheel zooming, reset zoom, and direction toggling between Left-to-Right (`LR`) and Top-to-Down (`TD`).
  - SVG node interactive inspection: clicking an SVG cluster node (`.node`) triggers `matchNodeFromElementId`, invoking `getDecisionCascadeImpact` and opening the right-side **级联波及分析 (Cascade Impact Inspection)** drawer showing upstream dependencies and downstream blast radius.
  - Tab *架构拓扑与时序*: Correctly renders 5 architecture diagram projections (C4 System Context, Component, Sequence, Data Flow, Deployment).
- **Artifacts**: `10-tab-decision-dag.png`, `10b-dag-cards-view.png`, `10c-dag-canvas-view.png`, `10d-dag-direction-td.png`, `10e-dag-zoomed-in.png`, `10f-dag-canvas-panned.png`, `10g-dag-node-inspected.png`, `10h-dag-raw-dsl.png`, `11-tab-architecture-diagrams.png`, `11b-architecture-diagram-second.png`, `deep/d18-dag-canvas.png`, `deep/d19-dag-node-impact-inspected.png`.

### Lifecycle 5: Readiness Review & Gate Verification
- **Interactions Verified**:
  - Tab *就绪度评估与门禁*: Surfaces the readiness review dashboard displaying score (100/100, Level 3 Approved).
  - 8 core engineering areas breakdown (产品定位与核心价值, MVP 功能边界, 用户核心动线, 数据模型与存储, 系统分层架构, 外部依赖与集成, 安全与合规, 开发与交付计划).
  - Expandable evidence cards with scoring rationales and criteria checkboxes.
  - Blocking issues list, inline recommendation adoption, and advanced approval authorization mode switches.
- **Artifacts**: `12-tab-readiness-review.png`, `12b-readiness-score-details.png`, `12c-readiness-evidence-expanded.png`, `12d-readiness-advanced-modes.png`.

### Lifecycle 6: Document Compilation & Specification Delivery
- **Interactions Verified**:
  - Tab *规格蓝图文档*: Invoking `一键编译生成完整文档包` triggers the document compiler, generating 9 documents:
    1. `AGENTS.md` (Designated with `GATEWAY` badge)
    2. `PROJECT.md`
    3. `PRODUCT.md`
    4. `USER_FLOWS.md`
    5. `UX_UI_SPEC.md`
    6. `TECHNICAL_GUIDE.md`
    7. `DEVELOPMENT_PLAN.md`
    8. `ACCEPTANCE.md`
    9. `PRIVACY_SPEC.md`
  - Document Reader view modes:
    - **Preview Mode**: Rendered styled markdown with headings, bullet points, and code blocks.
    - **Raw Mode (`源码`)**: Raw markdown in `<pre>` format.
    - **Edit Mode (`编辑`)**: Full-featured textarea editor; adding content and clicking `保存修改` successfully persists changes to the project state.
  - Modals:
    - **Agent Prompt Modal (`复制 Agent 启动词`)**: Displays pre-configured prompt instructions binding `AGENTS.md` and repository blueprint standards.
    - **Spec-Drift Auditor Modal (`规范漂移审计`)**: Displays drift check status comparing state decisions with document text.
  - **Single-File HTML Bundle Export (`导出单文件 HTML`)**: Emits `POST /api/projects/:id/export/html`, producing an offline self-contained HTML file of **402,719 bytes (~403 KB)** containing all embedded styles, scripts, and specifications.
- **Artifacts**: `deep/d02-docs-tab-empty.png`, `deep/d03-docs-compiled.png`, `deep/d04-doc-agents-md.png`, `deep/d05-doc-blueprint-second.png`, `deep/d06-doc-raw-mode.png`, `deep/d07-doc-edit-mode.png`, `deep/d08-doc-saved.png`, `deep/d09-modal-agent-prompt.png`, `deep/d10-modal-spec-drift.png`, `deep/想做一个独属于我和对象的网站_可以进行实时的互动-spec.html`.

---

## 3. Multi-Viewport Responsive Emulation

We evaluated responsive layout fidelity across 4 standard viewports:

| Viewport | Dimensions | Target Device Class | Visual Observations | Uncontained Overflows |
|---|---|---|---|---|
| **desktop-1440** | 1440 × 900 | Standard Desktop | Full three-pane shell, comfortable layout | TopNav project title clamped (`max-w-[280px]`) |
| **compact-desktop-1024** | 1024 × 768 | Laptop / iPad Pro | Sidebar icons collapse, drawer slides | TopNav project title clamped (`max-w-[201px]`) |
| **tablet-768** | 768 × 1024 | iPad / Tablet Portrait | Drawers collapse into overlay with backdrop | TopNav title clamped; OverviewDrawer opens as modal |
| **mobile-375** | 375 × 812 | iPhone SE / Mobile | Single column, off-canvas navigation | **Header overflow** in HomeView; TopNav title squished to 82px |

### Key Responsive Findings
1. **Drawer Breakpoint Handling**:
   - On 768px tablet, `OverviewDrawer` renders as a slide-over drawer with `z-40` fixed backdrop (`bg-black/40 backdrop-blur-sm`).
   - On 375px mobile, `NavigationDrawer` collapses into the hamburger button (`button[aria-label="打开主导航"]`).
2. **Horizontal Overflow Audit**:
   - `window.innerWidth >= document.documentElement.scrollWidth` held true for the main workspace shell (no viewport-level page runaway horizontal scroll).
   - Local uncontained text overflows and flex wrap defects were observed at 375px in specific components (detailed in Section 4).

---

## 4. Empirical Vulnerabilities & Bugs Found

### [P1] Bug 1: Playwright Strict Mode Violation on Modal Close Button
- **Component File**: `apps/web/src/components/modals/ProviderHealthModal.tsx:71` & `apps/web/src/components/common/Modal.tsx:69`
- **Observed Error**:
  ```text
  locator.click: Error: strict mode violation: getByRole('button', { name: '关闭' }) resolved to 2 elements:
    1) <button aria-label="关闭窗口" ...>
    2) <button ...>关闭</button>
  ```
- **Root Cause**: `Modal.tsx` provides a header close icon button (`aria-label="关闭窗口"`). `ProviderHealthModal.tsx` also provides a bottom footer action button labeled `"关闭"`. In addition, `ResponsiveDrawer.tsx:125` uses `aria-label="关闭抽屉"`, while `DirectoryBrowserModal.tsx` uses `aria-label="关闭窗口"`.
- **Impact**: Screen readers and automated accessibility / E2E tools encounter duplicate or inconsistent accessible names. Clicking by standard button name fails strict resolution.
- **Recommended Mitigation**:
  - Standardize `Modal.tsx` header close button `aria-label` to `"关闭窗口"`.
  - In `ProviderHealthModal.tsx`, label the footer dismissal button `"完成"` or `"知道了"`, or omit the footer close button since the top close icon already exists.

---

### [P1] Bug 2: Mobile 375px Uncontained Horizontal Overflow in Home Creation Header
- **Component File**: `apps/web/src/features/home/HomeView.tsx:571-610`
- **Observed Behavior**:
  - At viewport width 375px, the header controls contain two mode toggle buttons (`四项意图引导` + `自由长文本输入`, combined width ~240px) plus the project name input container (`w-48` = 192px).
  - Combined required width is `240px + 192px + gap = ~448px > 375px`.
  - Because the container `div` lacks `flex-wrap`, `input#project-name` is squished:
    - `clientWidth`: 113px
    - `scrollWidth`: 147px
    - Placeholder text *"项目名称（可选）"* is horizontally clipped (`overflow-x: clip`).
- **Impact**: On mobile phones, users cannot view or comfortably edit the project name without visual clipping.
- **Recommended Mitigation**:
  - Add `flex-wrap gap-2` to the parent container: `<div className="flex flex-wrap items-center gap-2 ...">`.
  - Set `input` width to `w-full sm:w-48` so it cleanly drops below the toggle pills on narrow screens.

---

### [P1] Bug 3: Workspace TopNav Breadcrumb Title Severe Clipping & Missing Hover Tooltip
- **Component File**: `apps/web/src/components/layout/TopNav.tsx:79-88`
- **Observed Behavior**:
  - The project title element is rendered as:
    ```tsx
    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-[280px]">
      {projectName}
    </span>
    ```
  - For standard project names (e.g. *"想做一个独属于我和对象的网站_可以进行实时的互动"*, scrollWidth 284px):
    - At 1440px desktop: Clamped to `280px` (`scrollWidth: 284px > clientWidth: 280px`).
    - At 1024px compact desktop: Clamped to `201px`.
    - At 375px mobile: Squished to `82px` (`scrollWidth: 284px > clientWidth: 82px`).
  - The element lacks a native `title={projectName}` attribute or tooltip.
- **Impact**: Users cannot read the full project name when navigating the workspace, and on mobile devices only ~4 Chinese characters are visible with no way to reveal the rest.
- **Recommended Mitigation**:
  - Add `title={projectName}` to the `<span>` so native hover reveals the complete string.
  - On mobile breakpoints, adjust flex priority so the active project title retains reasonable width, or display it in a secondary subtitle row.

---

### [P1] Bug 4: ResponsiveDrawer Stuck Open Across Viewport Breakpoint Resize
- **Component File**: `apps/web/src/components/layout/AppShell.tsx:15-18, 48-58` & `apps/web/src/components/common/ResponsiveDrawer.tsx:103-107`
- **Observed Behavior**:
  - `AppShell.tsx` calculates drawer collapse actions via `getBreakpointCollapseActions(previousWidth, currentWidth)`:
    ```ts
    if (previousWidth >= 1280 && currentWidth < 1280) {
      return { closeLeft: false, closeRight: true };
    }
    ```
  - If a user opens `OverviewDrawer` on a tablet (e.g., width 768px or 1024px) where `previousWidth < 1280`, and then rotates their tablet to portrait or resizes to mobile (width 375px), `closeRight` is NOT triggered.
  - The drawer remains open with its fixed overlay (`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm`), blocking all pointer interactions with the underlying workspace.
- **Impact**: Mobile users rotating or resizing devices find the UI completely unresponsive until they locate the backdrop dismissal target.
- **Recommended Mitigation**:
  - Update `getBreakpointCollapseActions`:
    ```ts
    if (currentWidth < 768) {
      return { closeLeft: true, closeRight: true };
    }
    ```

---

### [P2] Bug 5: Accessible Name Collision for "列表视图"
- **Component File**: `apps/web/src/features/chat/ChatView.tsx:783` vs `apps/web/src/components/decision/OverviewDrawer.tsx:730`
- **Observed Behavior**:
  - `ChatView.tsx` defines:
    ```tsx
    <button title="切换为全量问题列表视图" ...>列表视图</button>
    ```
  - `OverviewDrawer.tsx` defines:
    ```tsx
    <button title="卡片列表视图" ...>列表视图</button>
    ```
  - When querying `getByRole('button', { name: /列表视图/ })`, both buttons match simultaneously.
- **Impact**: Assistive technologies (screen readers) announce ambiguous button purposes. Automated accessibility testing and E2E suites fail without brittle CSS class filtering.
- **Recommended Mitigation**:
  - Explicitly differentiate accessible names via `aria-label`:
    - `aria-label="切换为问题列表视图"` in `ChatView.tsx`.
    - `aria-label="切换为决策卡片列表"` in `OverviewDrawer.tsx`.

---

### [P2] Bug 6: Initial Reducer UI Theme Inconsistency & Missing LocalStorage Persistence
- **Component File**: `apps/web/src/state/projectSessionReducer.ts:117` vs `apps/web/src/components/layout/ThemeToggle.tsx:17`
- **Observed Behavior**:
  - `initialProjectSessionState.uiState.theme` is initialized as `'dark'`.
  - However, in `ThemeToggle.tsx`:
    ```tsx
    const isDark = theme === 'dark';
    ```
  - Unlike draft inputs and wizard steps which are persisted in `localStorage` (`pa:wizard_index:...`), the theme state is purely in-memory in the session reducer. On full page reload, any user-selected light mode preference is lost and resets to dark.
- **Impact**: Users preferring light mode must re-toggle the theme every time they refresh or open a new session.
- **Recommended Mitigation**:
  - Persist `theme` to `localStorage.getItem('pa:theme')` in `ThemeToggle.tsx` / `projectSessionReducer.ts`, respecting system `prefers-color-scheme`.

---

### [P2] Bug 7: QuestionCard List View Collapse State Friction
- **Component File**: `apps/web/src/features/chat/QuestionCard.tsx:36, 67, 283`
- **Observed Behavior**:
  - In `ChatView.tsx` list mode, question cards are rendered with `defaultExpanded={index === 0}`. All subsequent question cards (index >= 1) render in collapsed state.
  - The radio option list, custom input textarea, and `确认此决定` / `确认并继续` buttons are hidden from the DOM until the user clicks `展开回答与详情`.
  - While this keeps the list compact, users trying to quickly scan and answer questions must execute two clicks per question.
- **Impact**: Extra interaction step for keyboard and touch users navigating lists of questions.
- **Recommended Mitigation**:
  - Provide an "全部展开 / 全部收起" (Expand All / Collapse All) bulk toggle button in the list view header next to `跳过所选`.

---

## 5. Artifact & Evidence Index

All empirical evidence is stored in `.playwright-cli/challenger-artifacts/`:

| Artifact Category | File Path | Description |
|---|---|---|
| **E2E Test Report** | `.playwright-cli/challenger-artifacts/challenger-test-report.json` | Complete phase execution log with timestamps, DOM selectors, and console logs |
| **Exported HTML Bundle** | `.playwright-cli/challenger-artifacts/deep/想做一个独属于我和对象的网站_可以进行实时的互动-spec.html` | 402.7 KB offline specification bundle generated via UI export |
| **Deep Test Log** | `.playwright-cli/challenger-artifacts/deep/deep-verification-log.json` | Execution log for document compilation, raw view, and save persistence |
| **Undo Flow Test** | `.playwright-cli/challenger-artifacts/undo-test/01-expanded-question-card.png`, `02-undo-banner-visible.png` | Visual evidence of 10s undo banner and retract capability |
| **Lifecycle Screenshots** | `.playwright-cli/challenger-artifacts/01-*.png` to `14-*.png` (30+ images) | Screenshots covering every lifecycle screen and modal state |
| **Viewport Sweeps** | `.playwright-cli/challenger-artifacts/viewport-*.png` | Emulation screenshots at 1440px, 1024px, 768px, and 375px |
