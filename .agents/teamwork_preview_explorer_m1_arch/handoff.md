# Architectural & AGENTS.md Compliance Audit Report

## Executive Summary

Project Architect was audited against the five Absolute Rules defined in `AGENTS.md`. The audit inspected `packages/core/`, `packages/agent/`, `packages/contracts/`, `apps/server/`, `apps/web/`, `frontend/`, and `experiments/agent-benchmark/` (specifically `constitution-b3.md`, `b3-discovery.schema.json`, and `antigravity-provider.mjs`).

### Overall Compliance Verdict: **CONDITIONAL PASS WITH 6 GROUNDED ARCHITECTURAL RISKS**

| AGENTS.md Rule | Rule Intent | Compliance Status | Key Risk / Observation |
|---|---|---|---|
| **Rule 1: B3 Contract Integrity** | B3 is the sole production runtime; no B2.1 fallback; question count governed by Core local budget; unique & independent `decision_key`; no multi-agent pipelines. | **COMPLIANT IN RUNTIME, 2 CODE RISKS** | `AIOrchestrator` strictly uses `constitution-b3.md` and `b3-discovery.schema.json`. However: (1) 6 legacy B2 schemas remain in `packages/agent/src/schemas/`; (2) `ProjectStateEngine.applyDiscoveryTurn()` contains an unbudgeted question insertion fallback path. |
| **Rule 2: Strict Single Structured Call** | Discovery turn triggers at most 1 provider call; no hidden sequential LLM calls; 100% structured output. | **COMPLIANT WITH 1 INFRA RISK** | Core gap/question/policy engines are 100% deterministic local TypeScript. Orchestrator executes a single call to `provider.complete()`. However, Win32 command line parameter passing truncates prompts at 28,000 chars and parser accepts fallback unwrapped dicts. |
| **Rule 3: User Authorization & State Protection** | AI outputs are strictly suggestions (Candidate/Gap/Risk/Tension/Assumption); only users confirm/lock; Core is SSOT. | **COMPLIANT** | Confirmed state is exclusively written via user actions (`confirmSuggestion`, `answerQuestion`, `addDecision`, `updateDecision`). AI `result.confirmed` is ignored. Core file state is canonical truth; UI is projection. |
| **Rule 4: Local-First & Zero Over-Engineering** | No databases (SQLite, Postgres, Prisma, TypeORM); local directory + 2-phase commit; no auth, license, or cloud sync. | **COMPLIANT WITH 1 OS RISK** | Zero databases or auth packages in `package.json` or source. Two-phase commit (`StateCommitManager`) guarantees atomic revision pointers with snapshot manifests. Windows path casing in mutex keys needs normalization. |
| **Rule 5: Prototype vs Production Isolation** | `frontend/` mock data and `setProject()` isolated from production; single-direction data flow with `packages/contracts`. | **COMPLIANT IN ISOLATION, NO LINT GUARD** | `apps/web/` and `apps/server/` have zero imports from `frontend/`. However, no lint or boundary rules prevent accidental imports, and `frontend/` contains obsolete un-synced types. |

---

## 1. Observation

Direct observations from codebase inspection:

### Obs 1: Active Runtime Wires B3 Constitution & Schema, but 6 Legacy B2 Schema Files Persist
- **Files**:
  - `packages/agent/src/prompts/PromptLoader.ts` (lines 37-50): Loads `experiments/agent-benchmark/prompts/constitution-b3.md`.
  - `packages/agent/src/schemas/SchemaResolver.ts` (lines 17-25): Resolves strictly to `experiments/agent-benchmark/schemas/b3-discovery.schema.json`.
  - `packages/agent/src/runtime/AgentRuntimeRegistry.ts` (lines 14, 25, 36, 47, 58, 69): All 6 agent modes (`idea-analysis`, `gap-analysis`, `question-generation`, `decision-review`, `readiness-review`, `document-compile`) set `schemaProfile: 'b3-discovery'`.
  - **Dangling Legacy Assets**: In `packages/agent/src/schemas/`:
    - `gap-analysis.schema.json` (lines 8-24, 41-48, 57-80):
      - Line 8: `"candidates": { "type": "array", "items": { "type": "string" } }` (Pre-B3 string array)
      - Line 9: `"assumptions": { "type": "array", "items": { "type": "string" } }`
      - Line 11: `"risks": { "type": "array", "items": { "type": "string" } }`
      - Line 41, 48: Required fields include `"dependency": { "type": "string" }` instead of B3's `"decision_key"` and `"depends_on": string[]`.
      - Line 57: Questions schema lacks `decision_key`, `depends_on`, and `recommended_option_key`.
    - Identical legacy schemas exist for `idea-analysis.schema.json`, `question-generation.schema.json`, `decision-review.schema.json`, `readiness-review.schema.json`, `document-compile.schema.json`.

### Obs 2: Unbudgeted Question Insertion Fallback in `ProjectStateEngine.applyDiscoveryTurn()`
- **File**: `packages/core/src/engine/ProjectStateEngine.ts` (lines 1689–1734)
- **Code**:
  ```ts
  // 5. Process Questions
  if (payload.questions && payload.questions.length > 0) {
    for (const q of payload.questions) {
      const exists = snapshot.questions.items.some(
        (item) => item.question.trim() === q.question.trim() && item.status !== 'dismissed'
      );
      if (!exists) snapshot.questions.items.push(q);
    }
  } else {
    for (const q of result.questions || []) {
      const exists = snapshot.questions.items.some(
        (item) => item.question.trim() === q.question.trim() && item.status !== 'dismissed'
      );
      if (!exists) {
        ...
        snapshot.questions.items.push({
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          issueRef: 'gap:general',
          ...
        });
      }
    }
  }
  ```
- **Context**: `applyDiscoveryTurn` is an older public API still invoked directly in unit/regression tests (`tests/p0-closure-verification.test.ts:129`, `tests/product-hardening/discovery-persistence.test.ts:239`, `packages/core/tests/ProjectStateEngine.test.ts:74`). When `payload.questions` is omitted, it directly pushes raw `result.questions` from the AI into state, completely bypassing `QuestionSelector` and `QuestionBatchPolicy`.

### Obs 3: Test Fixture and Domain Phrasing Coupling in Fallback Question Composer
- **File**: `packages/core/src/questions/QuestionComposer.ts` (lines 193–208, 214, 238–253)
- **Code**:
  ```ts
  // Lines 193-198
  if (/(?:avatar|room|asset|素材|装扮|形象|房间)/i.test(text)) {
    return `建议首发内置 2-3 套精美默认形象与“${label}”素材，暂缓自由文件上传与复杂编辑器。`;
  }
  if (/(?:sync|action|status|动作|同步|互动|玩法|吃饭|睡觉)/i.test(text)) {
    return `建议首发优先实现基础双人在线状态与单向高频动作广播“${label}”，暂不做复杂物理碰撞与链式互动。`;
  }
  // Line 214
  case 'target_user':
    return `建议首发优先收敛“${label}”为情侣两人私密专属空间，暂不扩展为大众通用社区。`;
  ```
- **Context**: These regexes and default strings reflect a specific benchmark test fixture (`case-01`, a romantic virtual room app). When deterministic fallback generation is triggered for any generic enterprise, developer tool, or SaaS product, it yields recommendations mentioning "情侣两人私密专属空间" and "双人动作广播".

### Obs 4: Prompt Command-Line Slicing & Permissive Structured Output Parsing in `AntigravityCliProvider`
- **File**: `packages/agent/src/provider/AntigravityCliProvider.ts` (lines 68–71, 303–311)
- **Code**:
  ```ts
  // Lines 68-71: Command line truncation
  if (process.platform === 'win32' && fullPrompt.length > 28_000) {
    const truncationMarker = '\n\n... [Context truncated to stay within Win32 command line limit]';
    fullPrompt = fullPrompt.slice(0, 28_000 - truncationMarker.length) + truncationMarker;
  }
  ...
  // Lines 303-311: Permissive extraction fallback
  let structuredOutput = envelope?.structured_output as T | undefined;
  if (!structuredOutput && typeof envelope?.response === 'string') {
    try {
      const parsedResponse = JSON.parse(envelope.response);
      if (parsedResponse && typeof parsedResponse === 'object') {
        structuredOutput = (parsedResponse.structured_output || parsedResponse) as T;
      }
    } catch {}
  }
  ```
- **Context**: Passing large prompts via CLI argument `-p <prompt>` risks Win32 command line overflow (`lpCommandLine` limit 32k). Slicing strings arbitrarily truncates context. Furthermore, line 308 falls back to accepting `parsedResponse` directly if `structured_output` key is absent.

### Obs 5: Path Casing Vulnerability in Project Mutex Locking
- **File**: `packages/core/src/commit/StateCommitManager.ts` (lines 83–89)
- **Code**:
  ```ts
  async withProjectLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
    const key = resolve(projectPath);
    while (this.projectLocks.has(key)) {
      await this.projectLocks.get(key);
    }
  ```
- **Context**: On Windows systems, `resolve("d:\\project")` and `resolve("D:\\project")` produce keys with different case. Concurrent requests with varying drive letter casing bypass the mutex, creating race conditions in two-phase commit file writes.

### Obs 6: Complete Independence of `apps/web/` from `frontend/`, but Type Drift in `frontend/`
- **Files**:
  - `apps/web/package.json` (line 12): Depends strictly on `"@project-architect/contracts": "workspace:*"`.
  - `grep_search` across `apps/` and `packages/` for `from 'frontend'` or `from '../frontend'`: 0 occurrences found.
  - `frontend/src/types/project.ts` (lines 1–138): Defines completely separate, un-versioned type interfaces that do not reference `@project-architect/contracts`.
  - `frontend/src/data/mockQuestions.ts`: Contains legacy question structures missing `decisionKey`, `dependsOn`, and `recommended_option_key`.

---

## 2. Logic Chain

From observations to compliance conclusions:

1. **Rule 1 (B3 Contract Integrity)**:
   - *Premise 1*: B3 requires `constitution-b3.md` and `b3-discovery.schema.json` as the sole production runtime.
   - *Premise 2*: Observations show `PromptLoader` and `SchemaResolver` strictly point to the B3 assets.
   - *Premise 3*: However, 6 legacy schema files exist under `packages/agent/src/schemas/`, and `ProjectStateEngine.applyDiscoveryTurn()` contains a fallback branch inserting unconstrained raw AI questions.
   - *Inference*: While the active execution path in `AIOrchestrator.runDiscoveryTurn()` complies with B3, dead schema assets and legacy engine methods represent latent regression risks that violate architectural purity.

2. **Rule 2 (Strict Single Structured Call)**:
   - *Premise 1*: Discovery turn must make at most one primary LLM call and update state 100% from `structured_output`.
   - *Premise 2*: `AIOrchestrator.runDiscoveryTurn()` invokes `this.executeAgentMode()` exactly once per turn. All downstream processing (`GapDetectionEngine`, `QuestionEngine`, `DecisionPolicyEngine`) is local deterministic TypeScript code without secondary LLM calls.
   - *Premise 3*: In `AntigravityCliProvider.ts`, output is parsed as JSON and validated strictly against schema fields (`candidates`, `assumptions`, `risks`, `gaps`, `questions`).
   - *Inference*: The architecture adheres to the single structured call rule. However, passing prompts via CLI argument `-p` on Windows introduces context truncation risks, and the fallback parser accepts unwrapped JSON.

3. **Rule 3 (User Authorization & State Protection)**:
   - *Premise 1*: AI outputs must enter as candidate, assumption, risk, gap, tension, or question. Confirmed/Locked status must only be written by explicit user actions.
   - *Premise 2*: In `ProjectStateEngine.ts` and `DecisionPolicyEngine.ts`, AI suggestions are assigned `status: 'candidate'`, `status: 'active'`, `status: 'identified'`, `status: 'open'`, or `status: 'proposed'`.
   - *Premise 3*: `result.confirmed` from the AI is explicitly ignored. `status: 'confirmed'` is only written in user-origin handlers (`confirmSuggestion`, `answerQuestion`, `addDecision`, `updateDecision`) and stamped with `confirmedBy: 'user'`.
   - *Inference*: Full compliance with Rule 3.

4. **Rule 4 (Local-First & Zero Over-Engineering)**:
   - *Premise 1*: No external/embedded databases (SQLite, Postgres, Prisma, TypeORM), no authentication/license systems, and state stored in local files via 2-phase commit.
   - *Premise 2*: Dependency scan of all `package.json` files and code imports confirmed 0 database and auth packages.
   - *Premise 3*: `StateCommitManager.ts` implements an atomic two-phase commit: writes revision files to `state/revisions/<rev>`, generates and verifies `manifest.json`, switches `state/current.json` pointer, updates canonical files, and provides `recoverIfNeeded()` on restart.
   - *Inference*: Full compliance with Rule 4. A minor mutex key normalization fix is required for Windows drive letter casing.

5. **Rule 5 (Prototype vs Production Isolation)**:
   - *Premise 1*: `frontend/` is an interactive prototype; production (`apps/web/`, `apps/server/`) must not import its mock data or types.
   - *Premise 2*: Zero import links exist between production code and `frontend/`.
   - *Inference*: Production code is completely isolated from the prototype. Adding lint rules will prevent future violations.

---

## 3. Caveats

1. **Provider Environment Availability**:
   - The test environment does not currently have `agy.exe` installed on the system PATH. Provider execution tests rely on `MockAIProvider`. The runtime behavior of `AntigravityCliProvider` was audited via static code analysis and unit tests in `packages/agent/tests/AntigravityCliProvider.test.ts`.
2. **Win32 Command Line Character Limits**:
   - Windows command line length limit (`32,767` chars) was analyzed based on Windows API specifications and code in `AntigravityCliProvider.ts:68`. In large projects with extensive input materials, context truncation will trigger unless stdin piping or temporary files are used.
3. **Scope of Prototype Directory**:
   - `frontend/` was audited solely for import leakage and contract deviation. Visual styling and UI component quality of `frontend/` were delegated to peer explorer agents (`explorer_ui`, `explorer_ux`).

---

## 4. Conclusion & Concrete Findings

### Summary of Compliance Assessment

The Project Architect codebase exhibits remarkably high architectural discipline. The Core engine, AI Orchestrator, Contracts package, and Web application strictly follow local-first principles, zero-database persistence, single-turn structured AI invocation, and user-authorization-first invariants.

### 6 Grounded Compliance Findings & Risks

#### Finding 1 (Rule 1 Violation/Risk: Legacy B2 Schemas in Production Package)
- **Citation**: `AGENTS.md` Rule 1 ("B3 是唯一生产运行时；B2.1 资产只作为历史实验记录，不得重新接入运行时回退")
- **Location**: `packages/agent/src/schemas/gap-analysis.schema.json` (lines 8-24, 41-48, 57-80) and sibling files (`idea-analysis.schema.json`, etc.)
- **Evidence**: `candidates`, `assumptions`, and `risks` are defined as `string[]` instead of structured B3 objects. Gaps require deprecated `dependency` string instead of `decision_key` and `depends_on`.
- **Impact**: Maintenance hazard. If any developer attempts to make `SchemaResolver` dynamically resolve by mode name, runtime immediately falls back to legacy B2 contracts.

#### Finding 2 (Rule 1 Invariant Bypass: Raw AI Question Injection)
- **Citation**: `AGENTS.md` Rule 1 ("问题数量必须由 Core 的本地阶段预算决定，同批问题必须使用唯一 decision_key 且互不依赖")
- **Location**: `packages/core/src/engine/ProjectStateEngine.ts` (lines 1699–1734)
- **Evidence**: `applyDiscoveryTurn()` checks `if (payload.questions && payload.questions.length > 0)`. If false, it loops over `result.questions` and directly inserts them with `issueRef: 'gap:general'`.
- **Impact**: Bypasses `QuestionSelector` and `QuestionBatchPolicy`, allowing arbitrary question counts and unverified dependencies into project state.

#### Finding 3 (Rule 1 & Rule 4 Leakage: Test-Fixture Hardcoding in Fallback Composer)
- **Citation**: `AGENTS.md` Rule 1 & Rule 4 ("通用系统架构设计平台", Constitution-B3 "Capability Before Mechanism")
- **Location**: `packages/core/src/questions/QuestionComposer.ts` (lines 193–208, 214, 238–253)
- **Evidence**: Regexes and fallback copy hardcoded to couple's virtual room app:
  `case 'target_user': return '建议首发优先收敛“${label}”为情侣两人私密专属空间，暂不扩展为大众通用社区。';`
- **Impact**: Any generic software project (e.g. enterprise tool) triggering deterministic question fallback receives romantic app recommendations.

#### Finding 4 (Rule 2 Risk: Command-Line Context Truncation & Lenient Output Parsing)
- **Citation**: `AGENTS.md` Rule 2 ("严格单次调用与结构化输出：状态变更必须 100% 来自 structured_output")
- **Location**: `packages/agent/src/provider/AntigravityCliProvider.ts` (lines 68–71, 303–311)
- **Evidence**:
  - `fullPrompt.slice(0, 28_000 - truncationMarker.length)` cuts prompts mid-string on Windows.
  - `structuredOutput = (parsedResponse.structured_output || parsedResponse) as T;` accepts arbitrary JSON dictionary without requiring `structured_output` key.
- **Impact**: Large contexts suffer silent information loss; malformed provider output can bypass envelope validation.

#### Finding 5 (Rule 4 Invariant Hardening: Windows Drive Letter Mutex Key Bifurcation)
- **Citation**: `AGENTS.md` Rule 4 ("全系统采用本地文件目录 + 两阶段 State Commit")
- **Location**: `packages/core/src/commit/StateCommitManager.ts` (line 84)
- **Evidence**: `const key = resolve(projectPath);` is case-sensitive on Windows (`d:\` vs `D:\`).
- **Impact**: Concurrent requests using different path letter casing get separate mutex locks, causing race conditions in two-phase commit.

#### Finding 6 (Rule 5 Boundary Discipline: Lack of Boundary Linter Between Prototype & Production)
- **Citation**: `AGENTS.md` Rule 5 ("原型与正式代码隔离：当前 frontend/ 目录为交互原型，其内部 Mock 数据与 setProject() 逻辑不是正式规范")
- **Location**: `frontend/src/types/project.ts` (lines 1–138), `package.json`
- **Evidence**: `frontend/` contains independent duplicate types and outdated mock questions. No eslint or oxlint rule exists to prevent future imports from `frontend/` into `apps/web/`.
- **Impact**: Risk of future accidental imports or developer confusion regarding the canonical source of truth.

---

## 5. Architectural Hardening Solutions

### Solution 1: Clean Deprecation of Legacy Schemas & Static Pointer Invariant
- **Action**:
  1. Remove or archive the 6 legacy schema files in `packages/agent/src/schemas/*.schema.json`.
  2. In `packages/agent/src/schemas/SchemaResolver.ts`, maintain a single canonical pointer:
     ```ts
     export const CANONICAL_B3_SCHEMA_PATH = 'experiments/agent-benchmark/schemas/b3-discovery.schema.json';
     ```
  3. Add a unit test asserting that no `.schema.json` files exist in `packages/agent/src/schemas/` that deviate from `b3-discovery.schema.json`.

### Solution 2: Seal the Question Ingestion Gateway in `ProjectStateEngine`
- **Action**:
  1. Refactor `ProjectStateEngine.applyDiscoveryTurn()` to mandate `payload.questions` generated by `QuestionEngine`.
  2. If `payload.questions` is missing, throw an error or internally delegate to `QuestionEngine.generateQuestions()`.
  3. Mark `applyDiscoveryTurn` as `@deprecated` in favor of `applyIntegratedDiscoveryTurn`.

### Solution 3: Domain-Neutral Question Fallback Templates
- **Action**:
  1. Replace hardcoded fixture keywords in `QuestionComposer.ts` with domain-neutral defaults:
     ```ts
     case 'target_user':
       return `建议首发优先聚焦最核心的 1 类典型用户群体，暂缓拓展为多角色复杂体系。`;
     case 'technical_boundary':
       return `建议首发采用轻量本地架构，将网络同步与复杂扩展列为下一阶段目标。`;
     ```
  2. Move test-fixture specific wording into test mock providers.

### Solution 4: Stdin Prompt Passing in `AntigravityCliProvider`
- **Action**:
  1. Refactor `AntigravityCliProvider.ts` to pass large prompt strings via `child.stdin.write(fullPrompt); child.stdin.end();` instead of command-line arguments `-p <string>`.
  2. Remove permissive `|| parsedResponse` fallback at line 308; require explicit `envelope.structured_output`.

### Solution 5: Windows Path Normalization in Mutex Lock
- **Action**:
  In `StateCommitManager.ts` line 84:
  ```ts
  const key = process.platform === 'win32'
    ? resolve(projectPath).toLowerCase()
    : resolve(projectPath);
  ```

### Solution 6: Oxlint / ESLint Monorepo Boundary Guard
- **Action**:
  Add a restricted imports rule in root/apps eslint/oxlint configuration:
  ```json
  "no-restricted-imports": ["error", {
    "patterns": [{
      "group": ["**/frontend/**", "../../frontend/**"],
      "message": "AGENTS.md Rule 5 Violation: Production code must never import from prototype directory (frontend/)."
    }]
  }]
  ```

---

## 6. Feasibility, Cost & Quantitative Impact Analysis

| Improvement Solution | Implementation Effort | Breaking Risk | Architectural Benefit | Quantitative Metric |
|---|---|---|---|---|
| **1. Remove Legacy B2 Schemas** | 0.5 hours | None (all modes already resolve to B3) | Eliminates schema drift and prevents accidental regression | 100% adherence to B3 unified output schema |
| **2. Seal Question Gateway in Core** | 1 hour | Low (update 3 tests to pass payload) | Enforces Rule 1 stage budgets on all entry points | 0 unbudgeted or dangling questions in state |
| **3. Neutralize Fallback Phrasing** | 1 hour | None | Eliminates inappropriate romantic app copy in generic projects | 100% domain neutrality across all 8 B3 areas |
| **4. Stdin Prompt Passing in CLI Provider** | 2 hours | Low | Eliminates 28k char prompt truncation on Windows | Supports unlimited prompt length without context loss |
| **5. Mutex Path Normalization** | 0.5 hours | None | Prevents concurrency race conditions on Windows | Zero lock bypasses due to drive letter casing |
| **6. Monorepo Boundary Linter** | 0.5 hours | None | Automated CI/build-time guarantee of Rule 5 | 0 cross-boundary prototype imports |

**Total Hardening Investment**: ~5.5 engineering hours.  
**ROI**: Eliminates all identified compliance risks, safeguards local-first integrity, and aligns production code 100% with `AGENTS.md`.

---

## 7. Verification Method

Independent verification steps to validate these findings and fixes:

1. **Verify Legacy Schema Drift**:
   - Inspect files in `packages/agent/src/schemas/`.
   - Command: `ls packages/agent/src/schemas/*.schema.json`
   - Invalidation condition: If files define `candidates` as object with `decision_key`, the finding is resolved.
2. **Verify Question Ingestion Bypass**:
   - Inspect `packages/core/src/engine/ProjectStateEngine.ts` lines 1699-1734.
   - Run: Call `stateEngine.applyDiscoveryTurn(path, mockResult, rev, {})` with 20 questions in `mockResult.questions`.
   - Expected before fix: 20 questions inserted with `issueRef: 'gap:general'`.
   - Expected after fix: Triggers error or clamps questions to `QuestionBatchPolicy` maximum.
3. **Verify Question Composer Domain Coupling**:
   - Inspect `packages/core/src/questions/QuestionComposer.ts` line 214.
   - Check if string contains "情侣两人私密专属空间".
4. **Verify Windows Mutex Lock Key**:
   - Inspect `packages/core/src/commit/StateCommitManager.ts` line 84.
   - Run concurrent lock tests with `c:\project` vs `C:\project`.
5. **Verify Prototype Isolation**:
   - Run ripgrep: `rg "frontend/" packages/ apps/`
   - Expected: 0 matches in source code.
