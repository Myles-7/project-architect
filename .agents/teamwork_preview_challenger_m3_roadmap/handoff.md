# Handoff Report — Challenger Verification of Roadmap, Metrics & Migration Strategy

**Agent ID**: `teamwork_preview_challenger_m3_roadmap`  
**Role**: Roadmap & Migration Challenger (critic, specialist)  
**Target Deliverable Challenged**: `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` (1413 lines, 93,918 bytes)  
**Parent Conversation ID**: `7c4eeea1-eb14-4ac9-83a6-20550d74235f`  
**Date**: 2026-09-22  
**Gate Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

Direct empirical observations, tool executions, code citations, and mathematical calculations:

### 1.1 Empirical Refutation of WCAG 2.1 AA Compliance Claim
- **Document Claim**:
  In `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` (lines 894, 904, 1303):
  ```css
  --color-surface-base: #16171B;    /* 基础层 */
  --color-surface-overlay: #23252C; /* 浮动层 */
  ...
  --color-text-muted: #747780;      /* 对比度 4.5:1 (通过 WCAG AA) */
  ```
  Line 1303 asserts: `WCAG 2.1 AA 达标率升至 100%`。
- **Empirical Execution & Mathematical Derivation**:
  An independent Node.js script implementing the official W3C Relative Luminance and Contrast Ratio formulas was executed:
  $$\text{Contrast Ratio} = \frac{L_{\text{lighter}} + 0.05}{L_{\text{darker}} + 0.05}$$
  Where $L = 0.2126 R + 0.7152 G + 0.0722 B$ in linearized sRGB space.
  - `#747780` against `#16171B` yields: **4.00:1** (Below the mandatory 4.5:1 threshold for normal text).
  - `#747780` against `#23252C` (Modal/Dropdown Overlay) yields: **3.42:1** (Fails by **24.0%**).
  - `#747780` against `#0B0C0E` (Canvas) yields: **4.37:1** (Below 4.5:1).
  - Script output:
    ```
    #747780 on #16171B: 4.00
    #747780 on #23252C: 3.42
    #747780 on #0B0C0E: 4.37
    ```
  - Required color to achieve $\ge 4.5:1$ across all dark surfaces (including overlays `#23252C`): `--color-text-muted` must be at least `#8A8D96` (achieving **4.61:1** on overlay and **5.37:1** on surface-base).

### 1.2 Omission of Solution 7 from Section 9 Roadmap
- **Document Text**:
  - Section 7 (lines 1072-1088) designs: `方案 7: File System Access API 目录选择器与非阻塞无障碍模态框` (0.5 天).
  - Section 8 (line 1309) includes `方案 7: 目录选择器与非阻塞模态框` (0.5 天, 零风险).
  - Section 10.2 (line 1407) includes verification check: `- [ ] 目录选择器生效: 在项目创建时，可通过目录选择器绑定任意本机合法路径。`
  - **Section 9 (lines 1348-1382)**: Scanned via PowerShell text parsing (`Get-Content docs\PROJECT_AUDIT_AND_OPTIMIZATION.md | Select-String "方案 7"`): **0 occurrences in Section 9**.
  - `方案 7` is completely absent from P0, P1, and P2 tasks in the roadmap.

### 1.3 Internal Conflict Regarding Prototype Migration Phase
- **Section 1.3 (lines 132-135)**:
  `第一阶段 (P1)：将 frontend/ 中已被验证优秀的“大纲折叠树”与“状态过滤胶囊”组件逻辑抽取并移植至 apps/web/src/features/overview/，使用 packages/contracts 的只读视图模型强类型化。`
- **Section 9 (line 1376)**:
  `阶段 P2 (Day 9 - Day 14): 2. [Feature-Port] 将原型 frontend/ 中的“卡片/大纲双重视图”与“决策状态过滤胶囊”完整移植至 apps/web (方案 13)。`
- The document contradicts itself on whether the prototype overview feature is ported during P1 (Days 4-8) or P2 (Days 9-14).

### 1.4 Temporal Dependency Inversion Between P0.4 and P1.8
- **P0 Task 4 (line 1355)**:
  `[Core-Fix] 封闭 ProjectStateEngine.applyDiscoveryTurn 裸问题旁路插入，强制经过预算阶段策略 (方案 15)。`
  - Scheme 15 specification (line 1229) states: `若 payload.questions 为空，直接调用内置的 QuestionEngine 生成标准批次`。
- **P1 Task 8 (line 1370)**:
  `[Core-Copy] 替换 QuestionComposer.ts 中的虚拟情侣房间业务文案为通用系统架构模板 (方案 16)。`
- **Code Reality**:
  `packages/core/src/questions/QuestionComposer.ts:193-214` currently contains:
  ```typescript
  if (/(?:avatar|room|asset|素材|装扮|形象|房间)/i.test(text)) {
    return `建议首发内置 2-3 套精美默认形象与“${label}”素材...`;
  }
  case 'target_user':
    return `建议首发优先收敛“${label}”为情侣两人私密专属空间...`;
  ```
  If P0.4 activates the fallback to `QuestionEngine`/`QuestionComposer` while `QuestionComposer` still contains the virtual couple room copy (not scheduled for remediation until P1.8), any fallback question generated during P0 testing will emit romantic couple room text. Furthermore, existing integration tests in `tests/product-hardening/` relying on `applyDiscoveryTurn` will fail.

### 1.5 Prototype Migration Standalone Usability Gap
- **Inspection of `frontend/` vs `apps/web/`**:
  - `frontend/src/App.tsx` and `frontend/src/data/mockOverview.ts`: Functions 100% standalone in Vite with client-side mock data; requires no backend server.
  - `apps/web/src/state/ProjectSessionContext.tsx`: Requires active connection to `apps/server` (default `http://localhost:3001`).
  - The migration plan (Section 1.3 & Section 9 P2) archives `frontend/` into `experiments/prototypes/workspace-poc/` and adds Monorepo boundary lint rules (`no-restricted-imports`), but does not provide:
    1. An offline demo/mock mode or sample project seeding script in `apps/web`.
    2. A package.json script alias (`pnpm dev:prototype`) to allow continued previewing of the prototype.
  - Testers currently evaluating UI/UX on the standalone prototype without `apps/server` or AI API keys will be disrupted.

---

## 2. Logic Chain

1. **Premise 1 (Mathematical Integrity of Claims)**:
   - A technical report claiming "WCAG 2.1 AA 达标率升至 100%" must have tokens that mathematically satisfy the W3C contrast ratio criteria ($\ge 4.5:1$ for normal text).
   - Direct calculation (Observation 1.1) proves `--color-text-muted: #747780` yields 4.00:1 on base and 3.42:1 on overlay.
   - Therefore, the claim of 100% WCAG AA compliance is mathematically false as written and will fail automated accessibility audits (axe-core, Lighthouse).

2. **Premise 2 (Roadmap Completeness and Consistency)**:
   - An engineering roadmap must account for all proposed solutions in its work breakdown.
   - Observation 1.2 proves `方案 7` (Directory picker & non-blocking modals) was designed in Section 7, costed in Section 8, verified in Section 10.2, but dropped completely from Section 9.
   - Observation 1.3 proves an explicit milestone contradiction: Section 1.3 promises prototype overview porting in P1, while Section 9 schedules it in P2.
   - Therefore, engineering execution will experience scope ambiguity and scheduling friction.

3. **Premise 3 (Dependency Viability and Execution Safety)**:
   - Modifying the state machine entry point (`ProjectStateEngine.applyDiscoveryTurn`) in P0 to delegate empty payloads to `QuestionComposer` while leaving `QuestionComposer` un-sanitized until P1 (Observation 1.4) introduces a regression bug into P0.
   - `QuestionComposer.ts` domain-neutral cleanup (方案 16) must either precede or be merged into P0 along with `applyDiscoveryTurn` refactoring (方案 15).

4. **Premise 4 (Zero-Disruption Migration Requirement)**:
   - The user objective specifically asks: *"Does the prototype (frontend/) to production (apps/web/) migration strategy ensure zero disruption for users currently testing the prototype?"*
   - Archiving `frontend/` without providing an offline demo mode or backend-free mock runner in `apps/web` (Observation 1.5) breaks the testing workflow for any stakeholder testing UI flows without `apps/server` running.

5. **Conclusion**:
   - The document is of exceptional breadth and architectural depth (94k bytes, 28 grounded defects), but contains 1 direct mathematical error, 1 missing roadmap item, 1 inter-section milestone contradiction, 1 dependency inversion, and 1 migration transition gap.
   - Under rigorous adversarial standards, these flaws require explicit changes before milestone sign-off.

---

## 3. Caveats

- **Feasibility of Workload Estimates (Person-Days)**:
  - P0: 1.5 person-days allocated across 3 calendar days (0.5 pd/day ratio) — Highly realistic.
  - P1: 4.2 person-days allocated across 5 calendar days (0.84 pd/day ratio) — Realistic for a focused engineer.
  - P2: 4.6 person-days allocated across 6 calendar days (0.77 pd/day ratio) — Realistic.
  - The aggregate work estimates (10-14 engineering days) are well-calibrated; the flaw is in task placement and omissions, not overall capacity.
- **CLS Calculation**:
  - The CLS reduction projection ($>0.28 \to <0.03$) is sound according to the W3C formula assuming the layout collapse is animated smoothly or height is reserved; it is valid provided height-reserving skeletons are used.
- **Review-Only Constraint**:
  - In accordance with the system constraints, this Challenger subagent has performed AST, code inspection, and external script calculations without altering `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` or any production source code.

---

## 4. Conclusion & Gate Verdict

### **Gate Verdict: REQUEST_CHANGES**

The master report `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` is **conditionally close to approval**, but requires the following **5 targeted remediations**:

1. **Fix Dark Mode WCAG Contrast Token in Scheme 1 (line 904)**:
   - Replace `--color-text-muted: #747780; /* 对比度 4.5:1 (通过 WCAG AA) */` with:
     ```css
     --color-text-muted: #8A8D96; /* 对比度 5.37:1 on surface-base, 4.61:1 on overlay (100% WCAG 2.1 AA 合规) */
     ```
   - Update the dark mode palette documentation in Section 7 (Scheme 1) and Section 8 (Row 1).

2. **Integrate Scheme 7 into Section 9 Roadmap**:
   - Add `[UX-Feature] 集成 File System Access API 目录选择器并以非阻塞 Modal 替换原生 alert/confirm (方案 7: 0.5 天)` into Section 9.
   - Recommended placement: **阶段 P1 Task 9** (or P2 Task 8).

3. **Reconcile Milestone Schedule Between Section 1.3 and Section 9**:
   - Align Section 1.3 and Section 9 on the timing of `[Feature-Port]` (Overview outline tree & filters).
   - If scheduled for P2 (Section 9, line 1376), update Section 1.3 (line 133) to state `第二阶段 (P2)` instead of `第一阶段 (P1)`.

4. **Resolve P0/P1 Dependency Inversion between Scheme 15 and Scheme 16**:
   - Move `[Core-Copy]` (替换 `QuestionComposer.ts` 中的虚拟情侣房间业务文案为通用系统架构模板, 方案 16: 0.2 天) from P1 into **P0 Task 8**, or merge it directly into P0 Task 4 (`applyDiscoveryTurn` 收敛).
   - This guarantees that when `applyDiscoveryTurn` falls back to `QuestionComposer`, the template library is already generic and unit tests will pass cleanly.

5. **Enhance Prototype Migration Strategy with Standalone Mock Mode**:
   - In Section 1.3 and Section 7 (Scheme 19), add an explicit transition mitigation:
     - Provide a demo/mock project seed command (`pnpm seed:demo`) or an offline mock switch in `apps/web` so prototype testers can explore UI without starting `apps/server`.
     - Retain an npm script in root `package.json` (`"dev:prototype": "pnpm --filter @experiments/workspace-poc dev"`) during the P2 transition period to prevent disruption to ongoing user evaluations.

---

## 5. Verification Method

To independently verify the observations and validate when the changes are applied:

1. **WCAG Contrast Verification**:
   Run the following Node.js one-liner to verify that the proposed token passes $\ge 4.5:1$ across all surface elevations:
   ```bash
   node -e "
   function c(h1,h2){
     const s=x=>((x/=255)<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4));
     const l=h=>0.2126*s(parseInt(h.slice(1,3),16))+0.7152*s(parseInt(h.slice(3,5),16))+0.0722*s(parseInt(h.slice(5,7),16));
     const a=l(h1),b=l(h2); return ((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2);
   }
   console.log('Old #747780 on #16171B:', c('#747780','#16171B')); // 4.00 (FAIL)
   console.log('Old #747780 on #23252C:', c('#747780','#23252C')); // 3.42 (FAIL)
   console.log('New #8A8D96 on #16171B:', c('#8A8D96','#16171B')); // 5.37 (PASS)
   console.log('New #8A8D96 on #23252C:', c('#8A8D96','#23252C')); // 4.61 (PASS)
   "
   ```

2. **Roadmap Completeness Verification**:
   Execute PowerShell search to ensure all 20 solutions are mapped in Section 9:
   ```powershell
   Get-Content docs\PROJECT_AUDIT_AND_OPTIMIZATION.md -Encoding utf8 | Select-String "方案 7"
   ```
   Must return matching lines in Section 7, Section 8, Section 9, and Section 10.

3. **Section 1.3 vs Section 9 Consistency Check**:
   Inspect line 133 and line 1376 in `docs/PROJECT_AUDIT_AND_OPTIMIZATION.md` to ensure the milestone designation (P1 vs P2) for `[Feature-Port]` matches.
