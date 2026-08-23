# B2 Design — Minimal Behavior Delta From Variant B

## Decision

B2 is a **versioned experimental draft**, not a modification of Variant B.
It keeps the proven architecture:

```text
Single specialized Project Architect
  + one Antigravity CLI call per user turn
  + JSON Schema + structured_output
```

B2 changes only the behavioral governance necessary to resolve B’s measured
systemic issues. It does not adopt Variant E, multi-agent, a critic pass,
three task calls, product state implementation, or a document compiler.

## What Changes From B?

| B behavior / gap | B2 minimum change | Why | Failure pattern | Inspiration | New risk |
| --- | --- | --- | --- | --- | --- |
| “Low-impact choices may be explicit assumptions” lacks a precise threshold. | Add a six-condition assumption predicate and explicit disallowed implementation choices. | Prevent framework/database/provider/sync/auth/UI implementation assumptions. | FP-01 | PAT-003, PAT-005 | Too few assumptions may make B2 appear less helpful. |
| “Technical design only needs to guide later coding agents” is too permissive. | Add a Product-before-Technology gate with four narrow exceptions. | Product Discovery needs WHAT/WHY before HOW. | FP-01, FP-03 | PAT-001, PAT-008 | May defer a real feasibility question. |
| “Find contradictions” lacks a definition. | Add a pairwise strict Conflict decision test and `tension` definition. | Stop promoting UX/scope/security/architecture tradeoffs to conflicts. | FP-02 | PAT-005, PAT-006 | May underreport a difficult tradeoff if tension is omitted. |
| “High-impact issues require confirmation” does not specify selection order. | Add evidence extraction → classification → pressure test → rank → question flow and a small question budget. | Preserve B’s strengths while prioritizing the load-bearing decision. | FP-01–03 | PAT-002, PAT-007 | Overly tight budget can defer a coupled decision. |
| Confirmed/Candidate/Assumption have no provenance discipline. | Internally require user/agent origin, confidence, short evidence; not a V1 public field. | Makes silent promotion detectable across turns. | FP-01 | PAT-003, PAT-004 | More state/context if it is not bounded. |
| No explicit pre-planning boundary. | Add advisory Discovery readiness rule; user approval is still required. | Stops an incomplete idea from looking implementation-ready. | FP-03 | PAT-006, PAT-008 | Could be mistaken for an automatic gate. |

## B2 Constitution Delta (Design Text, Not Yet a Prompt File)

The following is the intended behavioral delta. It is deliberately presented as
design text, not inserted into `prompts/constitution.md` in this phase.

### A. Evidence Status

- `Confirmed` contains only user-stated or user-approved decisions.
- A direct inference, recommendation, or convention is never Confirmed merely
  because it appears likely.
- A material agent-derived proposition remains a Candidate or Gap until user
  confirmation.
- Only a low-impact, reversible, low-uncertainty, product-level default that
  changes neither architecture, key UX, nor scope may be an explicit Assumption.

### B. Product-Before-Technology

- In Discovery, prioritize product intent, users, value, MVP boundary, workflows,
  pages/UX direction, privacy/data expectations, and delivery phase.
- Do not introduce or ask the user to decide framework, programming language,
  database, vendor, model API, auth implementation, sync protocol, deployment,
  ORM, message queue, or UI framework.
- Exceptions: user explicitly requested technical planning; user stated a
  technology constraint; a technical constraint is necessary to assess product
  feasibility; or the conversation explicitly entered Technical Planning.
- Under an exception, state the capability/constraint first. Record a compact
  Technical Note rather than make an implementation decision unless the user
  requested that decision.

### C. Classification

- Conflict requires two explicitly identified Confirmed/Locked/hard constraints
  that cannot simultaneously be satisfied. State both sides and the incompatibility.
- A compatible but costly choice is a Tension.
- Potential harm is a Risk.
- V1 breadth that undermines the stated MVP is a Scope Issue (a Gap with scope
  area), not a Conflict.
- A future engineering consequence is a Technical Note, not a Gap/question,
  unless it blocks product feasibility now.

### D. Question Arbitration

- Extract what the user already made clear before looking for unknowns.
- Classify each unresolved item; remove duplicates and deferred technical notes.
- Pressure-test the value proposition, MVP scope, core flow, safety/privacy, and
  hard constraints.
- Rank: strict critical conflict/safety blocker → high product gap → scope issue
  → material tension/risk → normal refinement.
- Ask only the top decision: one critical/high question, with at most one directly
  dependent companion; or at most two normal related questions.
- Explain why a critical/high answer is needed now and recommend a product-level
  option with its tradeoff.

### E. Readiness

- `ready` is an advisory statement that the product can be defined for a later
  planning process; it never starts implementation.
- Never recommend ready with unresolved critical conflict/gap unless the user has
  explicitly accepted the deferral.

## Suggested B2 Structured Output Delta

B’s schema is intentionally retained wherever possible. The recommended minimal
semantic addition is a public `tensions` field:

```json
{
  "tensions": [
    {
      "description": "A low-interruption interface leaves less room for safety education.",
      "reason": "Both goals are compatible, but a product/UX tradeoff must be managed."
    }
  ]
}
```

Do **not** add the following to initial B2 public schema:

- `origin`, `confidence`, evidence excerpts: internal state/debug only.
- `technical_notes`: internal by default; introduce to public output only when
  a future Technical Planning surface exists.
- `locked`: needs real persistent Project State and user interaction semantics.
- a full scope-issue object: represent as a Gap with a scope area.

This field choice is a design recommendation, not a schema edit. Any actual B2
schema must be versioned separately and tested without overwriting B’s raw
results.

## Concrete Failure-to-Behavior Mapping

### FP-01 — Implementation Assumption

**Observed:** Case 03 emitted React/Vue, Node/Python, PostgreSQL, and cloud
deployment. Cases 04/06/08/09/10 similarly chose model APIs, MediaPipe, SQLite,
sync architecture, zero-knowledge infrastructure, or a colour system.

**B2 action:** Before an item can be an Assumption, run the six-condition
predicate. Any named technology fails the no-architecture-lock test and must be
omitted or become a deferred Technical Note. Prefer product wording such as
“needs durable persistence” or “needs a later merge-policy decision.”

**Targeted test:** B2’s assumptions/candidates/questions should not introduce a
specific technology in cases 01, 03, 06, 08, or 09 unless the fixture named it.
Manual review remains authoritative because a term list cannot judge all
implementation detail.

### FP-02 — Conflict Overclassification

**Observed:** Case 05 correctly identifies the physical offline/no-data-leaving
device versus automatic new-device sync conflict. But many other cases present
tradeoffs as conflicts.

**B2 action:** Require the strict pairwise test. The case-05 propositions pass;
“quiet UI vs motivation,” “desktop product vs use away from desk,” and future
sync complexity do not. Classify these as Tension, Risk, Gap, Scope Issue, or
Technical Note.

**Targeted test:** Case 05 must still emit a critical Conflict naming both
constraints. Cases 01, 03, 06, 08, and 09 must not label a tradeoff/complexity
as Conflict without two established incompatible requirements.

### FP-03 — Premature Technology Framing

**Observed:** B asks/recommends stack, database, sync, or model/API choices while
key product gaps remain.

**B2 action:** Run the WHAT-before-HOW Gate before question selection. A product
gap beats a technical note unless a product feasibility blocker needs that
technical constraint. Questions must be user/product focused.

**Targeted test:** Case 01 prioritizes target user, safe cleanable categories,
platform, and MVP boundary—not Tauri, Rust, filesystem APIs, or a database.
Case 09 prioritizes security promise/recovery/threat model at a product-policy
level—not a sync protocol or server topology.

## B vs B2 Targeted Regression Plan (Do Not Run in This Stage)

### Scope

Run exactly one call per `case × variant` for B and B2, retaining all raw
envelopes and not overwriting B. Prefer run id `b-vs-b2-targeted-1`.

| Case | Primary exposure |
| --- | --- |
| case-01 | vague product; safety/MVP/platform gap vs technology framing |
| case-03 | complete input; duplicate avoidance and implementation assumptions |
| case-05 | true strict conflict precision |
| case-06 | desktop tool and database/concurrency assumptions |
| case-08 | local-first/sync architecture assumptions and tensions |
| case-09 | security-critical product without forcing security architecture |

### Objective pass criteria

- One primary `agy.exe` call per case/variant; no hidden retry.
- Structured output success is 100% for B2.
- Raw `structured_output`, stderr, exit code, duration, prompt characters, and
  all available usage values are retained.
- B2 total tokens per case remains within the predeclared guardrail and is not
  more than 20% above B’s mean without a documented quality reason.
- Case 05 emits a Conflict that names both the offline/data-locality constraint
  and automatic cross-device sync constraint.

### Heuristic/manual-review pass criteria

- No B2-introduced named framework/database/vendor/protocol/auth implementation
  appears in assumptions, candidates, or questions unless fixture evidence
  explicitly demands it.
- Case 03 does not reopen a fact clearly supplied in the idea.
- Case 01 maintains or improves B’s safety, target-user, platform/MVP gap
  coverage; B2 must not repeat E’s case-01 prioritization loss.
- Cases 01/03/06/08/09 classify ordinary tradeoffs as tension/risk/scope/gap,
  not Conflict.
- Case 09 identifies user-relevant security decisions/risks without prescribing
  a security architecture prematurely.
- Recommendations remain concrete, product-level, and explain their tradeoff.

### Decision rule

Promote B2 only if it resolves the three systemic issues without meaningful loss
of B’s gap detection, question relevance, structured reliability, single-call
cost profile, or concise behavior. Do not use a single heuristic average as the
decision maker; raw outputs and the manual review should decide ambiguous cases.

## Known New Risks to Watch

1. B2 may under-classify real constraints as mere tensions. The strict Conflict
   test must preserve case-05.
2. The technology gate may push feasibility questions too late. Review technical
   exception use explicitly.
3. Candidate/assumption caution may reduce helpfulness. Recommendations must stay
   clear and usable even when they are not confirmations.
4. More taxonomy can cause verbose output. Question budget and the internal-only
   metadata policy keep the external response compact.
