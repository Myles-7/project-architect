## 2026-09-22T04:45:26Z
You are a specialist Worker subagent tasked with refining and hardening the master deliverable `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` based on empirical feedback from two independent adversarial Challengers.

# Identity and Workspace
- Archetype: teamwork_preview_worker
- Role: Master Report Refinement Architect
- Working Directory: d:\桌面\项目构思\.agents\teamwork_preview_worker_m2_refine
- Parent Conversation ID: 7c4eeea1-eb14-4ac9-83a6-20550d74235f
- Authoritative User Request: d:\桌面\项目构思\ORIGINAL_REQUEST.md
- Scope Document: d:\桌面\项目构思\.agents\orchestrator_1\PROJECT.md
- Target Deliverable to Refine: d:\桌面\项目构思\docs\PROJECT_AUDIT_AND_OPTIMIZATION.md
- Project Guidelines: d:\桌面\项目构思\AGENTS.md

# MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

# Source Documents to Read First
1. `d:\桌面\项目构思\docs\PROJECT_AUDIT_AND_OPTIMIZATION.md` (Current master report)
2. `d:\桌面\项目构思\.agents\teamwork_preview_challenger_m3_feasibility\handoff.md` (6 empirical feasibility issues)
3. `d:\桌面\项目构思\.agents\teamwork_preview_challenger_m3_roadmap\handoff.md` (5 roadmap & metric issues)
4. `d:\桌面\项目构思\.agents\orchestrator_1\GATE_STATUS.md` (Consolidated gate feedback)

# 11 Required Refinements to Implement in `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md`:
1. **Proposal 17 (CLI Stdin Flags)**:
   - Replace fabricated `--stdin` / `--profile` with actual Antigravity CLI streaming flags: `--input-format stream-json --output-format stream-json`. Include controlled fallback to `--file` mode if host CLI version does not support streaming JSON.
2. **Proposal 4 (Discovery Retry Pipeline Idempotency)**:
   - Decouple `recordDiscoveryInput` from `scheduleDiscoveryJob`. Add an idempotency token (`clientTurnId` / `inputMessageHash`). If the input was already recorded in state revision N, retrying scheduling must not re-record duplicate input or increment state revision.
3. **Proposal 5 (Question Retraction / Single-Decision Undo)**:
   - Fix status lifecycle: mark retracted decision as `rejected` (or ensure `DecisionPolicyEngine` and `buildOverviewProjection` explicitly treat `deprecated` identically to `rejected` / `superseded`). Re-open linked gaps from `addressed` back to `open` upon retraction. Check DAG dependencies.
4. **Proposal 7 (Directory Picker Web Sandbox)**:
   - Clarify that `window.showDirectoryPicker()` in standard browser context returns a FileSystemDirectoryHandle where `.name` is only the folder basename, and cannot expose the host's absolute path due to browser security sandbox. Document the dual-strategy: Web browser mode uses manual absolute path text input with validation + server-side directory browsing endpoint (`GET /api/fs/directories?path=...`); Electron / Desktop mode uses `dialog.showOpenDialog({ properties: ['openDirectory'] })` returning native absolute path.
5. **Proposal 11 (PDF/DOCX Parser Safety & Architecture Boundaries)**:
   - Add explicit security constraints: 20MB max file size, 50-page limit, 10s worker thread timeout with abort signal to protect Node.js event loop against zip bombs / OOM.
   - Architectural boundary: Keep parser dependencies inside `apps/server` or `packages/agent` via optional adapter to strictly preserve the zero-dependency, pure algorithmic contract of `packages/core`.
6. **Proposal 18 (Windows Mutex Key Normalization)**:
   - Update normalization from naive `resolve(path).toLowerCase()` to `fs.realpathSync.native(resolve(path)).toLowerCase()` to resolve NTFS junctions, Windows symlinks, and subst drive letters.
7. **Proposal 1 (WCAG AA Dark Mode Token)**:
   - Update `--color-text-muted` from `#747780` to `#8A8D96` in the design tokens table, showing the exact contrast math (4.61:1 on overlay `#23252C`, 5.37:1 on base `#16171B`), achieving true WCAG 2.1 AA compliance.
8. **Section 9 Roadmap Completeness**:
   - Explicitly insert `方案 7: File System Access API / 目录浏览选择器与非阻塞模态框` into Section 9 (under P1 Task 3).
9. **Section 1.3 vs Section 9 Schedule Reconciliation**:
   - Reconcile the scheduling of Overview Cards/Outline porting (aligning Section 1.3 to Section 9 P2 Task 2).
10. **Temporal Dependency Inversion**:
    - Move Scheme 16 (QuestionComposer benchmark copy cleanup) into P0 alongside Scheme 15 so that P0 fallback question synthesis never leaks couple test copy.
11. **Testing Disruption in Migration Strategy**:
    - Add a transitional offline/demo mock mode script (`pnpm dev:mock` or `pnpm dev:prototype`) in `apps/web/` so prototype testers can continue testing UI without running `apps/server` or needing AI keys.

# Deliverables
1. Update `d:\桌面\项目构思\docs\PROJECT_AUDIT_AND_OPTIMIZATION.md` with all 11 refinements in place.
2. Write `handoff.md` in `d:\桌面\项目构思\.agents\teamwork_preview_worker_m2_refine/` documenting the edits and line changes made.
3. Send a message to parent notifying that the refinements have been applied.
