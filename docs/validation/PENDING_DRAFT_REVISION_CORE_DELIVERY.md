# Pending draft revision delivery

Execution evidence uses the machine's Asia/Shanghai local time on 2026-10-05. This work uses temporary projects and fixture Providers only. It does not edit or approve the real notes08/materials projects, call a real Provider, build dist, or create a commit. Implementation source, tests and API documentation were explicitly handed back as stopped before the parent build.

## Result and entry point

`POST /api/projects/:projectId/planning/runs` now accepts `draftChangeSetId` alongside the source package's original `stage`, complete nonblank `feedback`, `expectedRevision` and `operationId`.

An HTTP fixture test proves that an unapproved first `product` package can be revised even when the formal blueprint is empty. Technical and delivery source packages still require the preceding formal stage approval; feedback still requires an existing formal blueprint. Missing, stale, approved, rejected or cross-stage sources are refused before feedback/runtime writes.

The formal UI adds a feedback field and “让 AI 修订当前草案” beside valid pending/partially-approved packages. It submits the source ID and original stage. Unsaved manual editing disables revision; failed submission retains feedback. Cancelled/failed source revisions continue their original Run instead of silently regenerating from formal state. Stale revisions have explicit guidance.

## Source and recovery contract

- `PlanningRun.draftSource` contains the source ChangeSet ID, source Run ID, original stage/basis, canonical `hashValue(full ChangeSet)` and original pending group IDs. This hash is not a file-byte SHA.
- `draft-source.json` freezes the complete original object before feedback is recorded. Initial candidate groups include only pending groups. The complete source evidence remains available; approved/rejected groups do not become candidates again.
- Recording feedback changes the basis. The old package may therefore project a top-level `stale` status. Its original groups, evidence and approval records remain unchanged. Comparing its complete original object must allow this top-level status projection.
- The latest real candidate in the new Run takes priority over the original frozen candidate. Review gets a clearly labelled pending comparison baseline; the parent's separate formal `changeReviewBaseline` remains intact.
- Source block/removal IDs are registered as required scope. Existing formal IDs cannot make pending candidate scope disappear silently.
- Source bytes are rechecked on context consumption, every Provider call before/after return (including retries), same-operation replay and restart/resume. Missing or altered source returns `RESULT_MODIFIED` and cannot be accepted as a result.
- Prepared starts persist the frozen source, original snapshot and paused `pendingStart:true` Run before committing feedback. Exact operation/request replay after an interrupted final Run write records feedback once. Unrelated basis changes are refused. A cancelled prepared start needs explicit resume.
- Questions/answers can pause a revision; a fresh Runtime resumes using the latest revised candidate and the same frozen source. Cancellation stops active work even if source bytes are corrupt and records a diagnostic.

## Atomic human lock preservation

Independent review identified and closed a failure window in the initial implementation: publishing a proposal and then editing inherited locks could leave an approvable lockless package if the second commit failed.

The delivered implementation uses narrow `PlanningService.proposeRevision(path, proposal, frozenSource, reference)` instead. Core first applies the strict Provider contract to new groups and continues rejecting Provider `locked`/approval metadata. It then verifies the frozen full source, hash/stage/basis/pending group IDs, and the current Core source object in full, allowing only the top-level stale projection. Core maps original pending human `locked` values to the same stable IDs, and commits the new pending package plus `proposal:<id>` and `draft-locks:<id>` traces in one revision. Ordinary `propose` remains unchanged.

No second edit or intermediate visible pending package exists. A failure before commit leaves no new package. A failure after a completed atomic commit recovers the complete package idempotently. A competing approval cannot see an intermediate package. Explicit approval is still required, and locked formal contents still require explicit `unlockIds`.

## Validation evidence

| Evidence | Executed outcome | Scope |
| --- | --- | --- |
| `draft-revision-before.txt` | 13 failed, 1 passed | Original implementation could not revise an unapproved first product |
| `draft-revision-after.txt` | 14 passed | Initial fix |
| `draft-revision-final.txt` | 9 files, 168 passed | Runtime, recovery/partition/context, parent's blueprint-context tests, API, web transport/presentation |
| `draft-revision-additional.txt` | 21 passed | Source-specific technical/delivery gates and question-answer/restart continuation added to the original revision file |
| `draft-revision-atomic.txt` | 3 files, 68 passed | Delivered revision file: 30; Core Service/Boundaries: 38 |
| `output/playwright/pending-draft-revision/05-assertions.txt` | 8 browser assertions passed, CLI exit 0 | Actual current-source component interactions, memory API fixture |
| `output/playwright/pending-draft-revision/06-final-snapshot.txt` and `final.png` | Final state recorded | Saved manual text, cleared feedback after successful start, original stage/ID/raw input in both calls |

The atomic suite directly checks: commit-before/after EIO, absence of intermediate pending packages, approval competition, same-proposal idempotency, Provider lock rejection, forged source/reference rejection, source edited after capture, Runtime resume after proposal failure, and source modification during a transient Provider retry.

The browser checks cover: disabled revision while editing; preserved unsaved text; exact leading/trailing whitespace and newline in feedback; no call while editing; retained raw input on API failure; clearing only after a successful start; original stage/source/raw input transport; preserved manual text after save. The isolated Vite server and browser were closed after testing. This is component/transport verification, not full application/Core/live AI browser acceptance.

`git diff --check` passed for owned paths. A direct trailing-whitespace check also covered the new/untracked files. No existing test assertions were weakened. The 168-test log predates the atomic Core change; the final 68-test log validates that change. Full updated build and independent regression belong to the parent handoff.

## Exact owned implementation files

- `packages/contracts/src/planning.ts`
- `packages/core/src/planning/PlanningService.ts` — the narrow atomic revision method; existing normal proposal behavior retained
- `apps/server/src/planning/PlanningDraftRevision.ts`
- `apps/server/src/planning/PlanningRuntime.ts`
- `apps/server/src/planning/PlanningContext.ts`
- `apps/web/src/features/planning/PlanningChangeSet.tsx`
- `apps/web/src/features/planning/PlanningWorkspace.tsx`
- `apps/web/src/api/client.ts` — request type already serializes the new field; narrow contract comment only in this work
- `apps/server/tests/planning-draft-revision.test.ts`
- `apps/web/tests/planning-draft-revision.test.ts`
- `apps/web/tests/fixtures/pending-draft-revision.html`
- `apps/web/tests/fixtures/pending-draft-revision.tsx`
- `docs/api/PLANNING_API.md`

## Remaining limits

Live Provider content quality and preservation of unrelated semantics remain an independent review/acceptance responsibility. Required scope, immutable evidence checks, frozen provenance and approval gates protect structure and authority; they cannot prove that generated prose is correct. The isolated browser fixture does not exercise the full Workspace polling/SSE flow. Parent must build current sources before using dist for real notes08 revision and must keep its bad original package unapproved.
