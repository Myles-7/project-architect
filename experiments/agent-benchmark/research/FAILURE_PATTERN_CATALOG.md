# Failure Pattern Catalog

This catalog is grounded in the completed B Winner Validation, not generated
from generic prompting advice. All conclusions below are
**heuristic/manual-review-needed** except operational metrics such as structured
output success. See `../reports/B_WINNER_VALIDATION_REPORT.md` and
`../reports/B_WINNER_MANUAL_REVIEW.md` for raw evidence.

## FP-01 — Systemic Implementation-Level Assumption

**Observed behavior:** Variant B turns unspecified product detail into specific
implementation choices. The validation report identifies this in roughly 7/10
cases: a full Web stack and PostgreSQL (case-03), third-party model API,
MediaPipe, and i18n (case-04), SQLite and volume bounds (case-06), multi-tenant
architecture (case-07), centralized sync database (case-08), zero-knowledge
model/sync architecture (case-09), and a specific visual-colour approach
(case-10).

**Why it is harmful:** It makes a preliminary product conversation appear to
contain settled architectural commitments. These choices can distort later user
answers and make the Project Architect behave like an implementation architect.

**Open-source mechanisms mapped:**

- PAT-001 Spec Kit’s explicit WHAT/WHY specification versus later plan Technical
  Context.
- PAT-003 agent-spec’s rule that a model inference cannot become accepted truth.
- PAT-004 agent-spec provenance/confidence separation.
- PAT-005 OpenSpec’s material-ambiguity versus minor-assumption distinction.

**B2 resolution:** Product-before-Technology Gate plus six-condition Assumption
Policy. Implementation choices are omitted or deferred internally as Technical
Notes; material product alternatives are Candidate/Gap/question.

**Regression evidence to seek:** cases 01, 03, 06, 08, and 09 contain no
B2-introduced named framework/database/vendor/provider/protocol/auth mechanism
unless the fixture explicitly demands it.

## FP-02 — Systemic Conflict Overclassification

**Observed behavior:** Case-05 correctly identifies the strict conflict between
fully offline/no data leaving the device and automatic cross-device sync. Yet the
winner report finds that cases 01, 02, 03, 06, 07, 08, 09, and 10 frequently
call scope, UX, security, or architecture tradeoffs “conflicts.” Examples in the
manual review include quiet/low-interruption UX versus motivation, desktop use
versus away-from-desk access, and offline editing versus access control.

**Why it is harmful:** A Conflict signals that the user must resolve an
incompatibility. Treating every difficult tradeoff this way creates false urgency
and weakens the signal for true blockers.

**Open-source mechanisms mapped:**

- PAT-005 OpenSpec Explore encourages discussing options/tradeoffs before
  committing to a proposal.
- PAT-006 OpenSpec’s design template reserves a distinct risks/trade-offs space.
- PAT-007 BMAD’s one-branch pressure test distinguishes weak assumptions from a
  reason to kill/change the idea.

**B2 resolution:** strict pairwise Conflict decision test plus a compact public
`tensions` category. Scope issues become `gaps` with `area: scope`; future
engineering consequences become Technical Notes.

**Regression evidence to seek:** case-05 retains one critical conflict naming
both constraints. Cases 01, 03, 06, 08, and 09 do not label a mere cost,
complexity, risk, UX tradeoff, or future design choice as a Conflict.

## FP-03 — Premature Technology Framing

**Observed behavior:** While key product decisions remain unresolved, B asks or
recommends technology stacks, databases, APIs, synchronisation protocols,
frameworks, deployment, and security infrastructure. The case-01 manual review,
for example, records a technology-stack question and Tauri recommendation.

**Why it is harmful:** It competes with higher-value discovery questions such as
who the user is, what the MVP safely does, which workflow is primary, and what
privacy promise is actually being made. It also feeds FP-01.

**Open-source mechanisms mapped:**

- PAT-001 Spec Kit’s specification quality gate: no languages/frameworks/APIs in
  the WHAT/WHY spec, then technical context in planning.
- PAT-008 BMAD’s analysis/planning/solutioning separation.
- PAT-002 bounded clarification ordering, which puts scope/security/UX before
  technical detail.

**B2 resolution:** Technology Decision Gate with four exceptions. Under an
exception B2 names a capability/constraint first and records a Technical Note;
it does not select a specific stack unless the user explicitly requested that
later-stage decision.

**Regression evidence to seek:** case-01 asks about target user, platform,
safe-cleaning scope, and MVP boundary rather than implementation. Case-09 asks
about a security promise/recovery/user policy rather than server topology or
sync protocol.
