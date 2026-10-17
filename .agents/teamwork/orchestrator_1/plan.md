# Master Plan: Comprehensive Frontend & UX/UI All-Round Audit

## Objective
Conduct a full-scope, deep, ground-truth audit of the Project Architect system covering:
- 6 Core Lifecycles (Cold Start -> Q&A Discovery -> Decision Management -> Topology DAG/Diagrams -> Readiness Gates -> Document Compilation/Merge/Export)
- Responsive Viewports (1440px+, 768-1280px, 375px) & Boundary Resilience (Overflow, Empty States, Mega DAGs, Batch uploads)
- WCAG 2.1 AA theme contrast & visual design
- Dynamic Playwright interactions, browser console errors, and DOM inspections
- Code penetration with exact file paths and line numbers
- Compilation of master deliverable `docs/FRONTEND_UX_ALL_ROUND_AUDIT.md`

## Architecture & Work Breakdown

### Phase 1: Deep Static Code Penetration & Dynamic Testing (Parallel Streams)
1. **Stream A (Explorer 1 - Lifecycle 1-3)**:
   - Lifecycle 1: Project init, seed presets, freeform ideation, brownfield ingestion, archive/activation, package import/export.
   - Lifecycle 2: Teleprompter, question card selection/freeform input, multi-stage deduction switching, 10s cascade undo, error recovery.
   - Lifecycle 3: Dual view (cards vs outline tree), inline quick edit/lock, multi-attribute filter, drawer & metrics linkage.
2. **Stream B (Explorer 2 - Lifecycle 4-6)**:
   - Lifecycle 4: DAG canvas (nodes, edges, zoom/pan, blast radius, cycle warning), Mermaid architecture diagrams (zoom/pan, fullscreen, SVG export).
   - Lifecycle 5: 8 domain readiness gates, inline AI recommendation adoption, blocking admission conditions.
   - Lifecycle 6: Incremental & draft compilation, 3-way merge diff comparison, single-file offline HTML bundle export, pa verify drift audit coordination.
3. **Stream C (Explorer 3 - Responsive Viewports, Boundaries & Theme)**:
   - Viewports: 1440px+ (desktop widescreen), 768px~1280px (tablet/laptop drawer breakpoints), 375px (mobile layout/scrolling/truncation).
   - Boundaries: Ultra-long strings, zero-data/empty states, massive DAG networks, batch input stress.
   - Design System: WCAG 2.1 AA contrast, light/dark mode consistency, shadow elevation, typography hierarchy, visual noise.
4. **Stream D (Challenger - Dynamic Playwright Interaction & DOM/Console Verification)**:
   - Run dynamic interaction tests with Playwright / test harnesses.
   - Capture runtime console errors, unhandled promise rejections, DOM layout shifts, and interactive breakages.

### Phase 2: Synthesis & Deliverable Compilation (Worker)
- Synthesize all findings from Streams A, B, C, D into a unified taxonomy.
- Ensure every issue includes:
  * Stage & trigger scenario
  * Reproduction steps & symptoms (console/DOM/visual)
  * Severity rating (P0/P1/P2/P3)
  * Exact source file path and line numbers
  * Impact analysis & user sentiment
- Construct 2D Summary Matrix (Lifecycle Stage × Severity Level).
- Compile and write the deliverable to `docs/FRONTEND_UX_ALL_ROUND_AUDIT.md`.

### Phase 3: Multi-Perspective Verification & Forensic Integrity Audit
- **Reviewers (2 Reviewers)**: Inspect report for completeness, depth, formatting, and verify code anchors.
- **Challenger (1 Challenger)**: Verify reproduction steps and sanity of claims.
- **Forensic Auditor (1 Auditor)**: Execute binary integrity gate to ensure zero dummy data, genuine reproduction, and authentic citations.
- Gate check in `GATE_STATUS.md`.

### Phase 4: Final Reporting & Handoff
- Present comprehensive summary report to parent.
