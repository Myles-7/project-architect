# Open-Source Assimilation Report

## Executive Summary

Project Architect should not import a complete external workflow. The research
supports a smaller, native B2 behavior layer on top of the existing single-call
Variant B architecture:

1. Separate **product discovery (WHAT/WHY)** from technical planning (HOW).
2. Treat agent-derived items as visible candidates until an explicit policy permits
   a low-risk product-level assumption; never silently promote them to confirmed.
3. Classify a strict conflict only when two confirmed, locked, or hard constraints
   cannot both be true. Classify tradeoffs separately as tensions, risks, scope
   issues, gaps, or deferred technical notes.
4. Select questions only after classifying and ranking the underlying decision;
   maintain a small, stage-sensitive clarification budget.
5. Use a lightweight readiness check to decide whether to continue discovery,
   without starting technical planning or overruling the user.

This directly targets B Winner Validation’s three systemic issues: implementation
assumptions in roughly 7/10 cases, conflict overclassification in 8/10 non-strict
conflict cases, and premature technology framing. It preserves B’s tested
operational strengths: one Antigravity call per turn, structured output, and no
multi-agent orchestration.

## Scope and Method

This was an **Observe → Extract → Map → Design** study. No Variant B prompt,
schema, fixtures, raw results, provider, or production code was modified. Local
shallow clones are research-only in `.research-cache/`, which is ignored by the
benchmark’s `.gitignore`.

Sources were read beyond their READMEs: actual command/skill prompts, workflow
definitions, templates, schemas, implementations, and selected tests/examples.
The source revisions below were retrieved on 2026-08-22 (Asia/Shanghai).

## Repositories Reviewed

| Repository | Branch / commit | License | Files actually reviewed |
| --- | --- | --- |
| [github/spec-kit](https://github.com/github/spec-kit) | `main` / `27f50f7e6b618ea14d74dd4037f9e7c60218b16c` | MIT | `templates/commands/{specify,clarify,plan,analyze}.md`; `templates/{spec,plan,constitution,checklist}-template.md`; `workflows/speckit/workflow.yml` |
| [ZhangHanDong/agent-spec](https://github.com/ZhangHanDong/agent-spec) | `main` / `2483398da89bd392186849bb865aae969667ac0a` | MIT | `skills/agent-spec-intent-compiler/SKILL.md`; `docs/intent-compiler/architecture.md`; clarification/provenance/trace schemas; governance/provenance requirements; `src/spec_knowledge/requirement.rs` |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | `main` / `f1b521dffac38ed6638689cd28b0c204b1eef0f1` | MIT | `docs/{explore,workflows}.md`; `src/core/templates/workflows/{explore,propose}.ts`; `schemas/spec-driven/templates/{proposal,spec,design,tasks}.md`; relevant template tests located |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | `main` / `67d876f1c317a82123e429d0c078ff3c601a99a8` | MIT | `src/core-skills/{bmad-forge-idea,bmad-brainstorming}/SKILL.md`; `docs/explanation/analysis-phase.md`; `docs/how-to/pressure-test-an-idea.md`; `docs/reference/workflow-map.md` |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | `main` / `127d90534b9c1b1ba4554f007dd4b5fd2c8bf1b4` | MIT | `README.md`; `src/types/providers.ts`; `src/assertions/{json,javascript,latency,cost}.ts`; smoke assertion fixtures and examples located; official custom-provider, configuration, and assertion docs reviewed |

The branch and SHA values are local shallow-clone metadata. Licenses were checked
in each repository’s root `LICENSE` file, not inferred from a badge.

## Benchmark Evidence That Drives This Design

The source study is constrained by actual benchmark evidence, not a generic
prompt rewrite:

| Failure pattern | Evidence in current benchmark | Design target |
| --- | --- | --- |
| FP-01 — implementation assumption | Winner validation documents full Web stack/PostgreSQL (case-03), model API/MediaPipe/i18n (case-04), SQLite (case-06), centralized sync architecture (case-08), zero-knowledge/sync design (case-09), and a colour approach (case-10). | Evidence-state policy plus technical-decision gate. |
| FP-02 — conflict overclassification | Winner validation finds the true offline-vs-automatic-sync conflict in case-05, but records ordinary scope, UX, security, or architecture tradeoffs as conflicts in cases 01, 02, 03, 06, 07, 08, 09, and 10. | Strict conflict taxonomy and an explicit `tension` class. |
| FP-03 — premature technology framing | The manual review records technology-stack questions/recommendations for otherwise product-definition work (for example case-01’s Tauri recommendation and several database/framework/API/sync suggestions). | WHAT-before-HOW gate and technical-note deferral. |

See the primary local evidence: `../reports/B_WINNER_VALIDATION_REPORT.md` §§
Assumption Review, Conflict Precision Review, Product-vs-Technology Discipline;
and `../reports/B_WINNER_MANUAL_REVIEW.md`. The B-vs-E smoke report is secondary
evidence: E’s structural classification was better in cases 03/05 but it lost
case-01 gap coverage, so B2 must preserve B’s question prioritization rather
than transplant E.

The concrete benchmark-to-design chain is recorded in
[`FAILURE_PATTERN_CATALOG.md`](FAILURE_PATTERN_CATALOG.md).

## Patterns Extracted

The detailed evidence and adoption decision for every pattern is in
[`PATTERN_CATALOG.md`](PATTERN_CATALOG.md). The highest-value patterns are:

1. **PAT-001 — WHAT/WHY before HOW** from Spec Kit’s `specify` and `plan`
   separation.
2. **PAT-002 — impact-limited clarification** from Spec Kit’s maximum-three
   clarifications and scope/security/UX-first ordering.
3. **PAT-003 — candidate plus human governance boundary** from agent-spec’s
   Candidate Requirement Blocks and explicit acceptance transition.
4. **PAT-004 — source trace and confidence** from agent-spec’s intake contract,
   adapted as lightweight internal metadata rather than a Requirement IR.
5. **PAT-005 — explore without commitment** from OpenSpec’s no-artifact/no-code
   explore stage.
6. **PAT-006 — material ambiguity vs minor assumption** from OpenSpec’s
   proposal guardrails.
7. **PAT-007 — one-branch-at-a-time pressure test** from BMAD Forge Idea.
8. **PAT-008 — explicit convergence/readiness** from BMAD’s separate analysis,
   planning, and solutioning boundaries.
9. **PAT-009 — declarative regression matrix plus custom assertions** from
   Promptfoo.

## Adoption Matrix

| Pattern | Source | Problem | Adopt? | Project Architect design | V1 / V2 |
| --- | --- | --- | --- | --- |
| PAT-001 WHAT/WHY-before-HOW | Spec Kit | FP-01, FP-03 | Adapt now | Product-before-Technology gate | B2 now |
| PAT-002 clarification budget | Spec Kit | low-value/many questions | Adapt now | rank then ask 1 critical/high or ≤2 normal related questions | B2 now |
| PAT-003 candidate governance | agent-spec | silent promotion | Adapt now | confirmed/candidate/assumption policy, human is authority | B2 now |
| PAT-004 source/confidence | agent-spec | traceability | Adapt now, internal only | `origin`, `confidence`, evidence excerpt in state/debug record | B2 now, UI later |
| PAT-005 explore before proposal | OpenSpec | premature commitment | Adapt now | Discovery remains a reversible product conversation | B2 now |
| PAT-006 material ambiguity rule | OpenSpec | assumption safety | Adapt now | ask material decisions; make only bounded minor product assumptions | B2 now |
| PAT-007 pressure-test branch | BMAD | insufficient challenge | Adapt now | one internal pressure-test scan before question selection | B2 now |
| PAT-008 readiness boundary | BMAD / OpenSpec | jumping to implementation | Adapt now | discovery readiness recommendation, user approval remains required | B2 now |
| PAT-009 custom provider + assertions | Promptfoo | regression portability | Future hybrid | small isolated PoC, then declarative regression subset | post-B2 validation |
| Full Requirement IR / DAG | agent-spec | enterprise trace | Reject | too much state and governance for discovery | not V1 |
| Full artifact/change lifecycle | Spec Kit / OpenSpec | implementation management | Reject | Project Architect does not own planning/implementation lifecycle | not V1 |
| Personas / agent party | BMAD | independent viewpoints | Reject | violates validated one-call specialized-agent direction | not V1 |
| Full Promptfoo replacement | Promptfoo | benchmark harness | Reject | preserve Antigravity envelope/cost guard/manual reports | not V1 |

## Rejected Patterns and Why

**Full Spec Kit workflow.** Its constitution-to-spec-to-plan-to-tasks handoffs,
repo mutation, branch setup, and implementation command are valuable for coding
workflows, but Project Architect ends before coding. B2 adopts the boundary, not
the file lifecycle.

**agent-spec Requirement IR, graph, source digests, task contracts, and explicit
enterprise transition CLI.** These are sound governance mechanisms, but would
turn a lightweight project-conversation state into a requirements compiler.
Only the semantic rule—AI may draft candidates; human confirmation determines
accepted truth—and optional small provenance metadata is needed.

**OpenSpec change management and schema-driven artifact packs.** B2 benefits
from `explore` being a non-committing state and from the distinction between
material ambiguity and a reasonable assumption. It does not need change
directories, delta specs, archival, or tasks.

**BMAD personas and multi-agent debate.** BMAD’s pressure-testing discipline is
useful, but its persona system, memlog, and full analysis/planning/solutioning
suite conflict with the benchmarked one-call architecture and the task’s explicit
no-multi-agent constraint.

**Promptfoo as a replacement harness.** Promptfoo’s provider response model can
carry output, token usage, cost, and metadata, and its assertions suit
regression. It cannot automatically preserve Project Architect’s raw `agy.exe`
envelope, nonstandard thinking/cache usage, Windows process diagnostics, manual
review format, or hard stop cost guard without custom integration. The right
direction is hybrid, not replacement.

## Direct Code Reuse Decisions

No external code, prompt, template, schema, or workflow text was copied into
Project Architect. The design uses independently written rules inspired by the
mechanisms above. All reviewed repositories are MIT licensed, but any future
direct reuse must retain the relevant license/copyright notice and document the
exact source file and revision. This research does **not** recommend direct
reuse.

## Risks

| Risk introduced by B2 | Mitigation / benchmark observation |
| --- | --- |
| A rigid technology gate may hide a real feasibility blocker. | Allow an exception only for explicit user request, product hard constraint, or feasibility blocker; express it at capability/constraint level first. |
| More categories may make output less concise. | Keep provenance and `technical_note` internal; expose `tensions` only because it prevents misleading conflicts. |
| Candidate governance can make the assistant sound evasive. | Preserve B’s recommendation behavior; every meaningful candidate/question may include a reasoned recommendation. |
| A pressure test can harm B’s strong case-01 gap coverage if it consumes attention. | Make it an internal pre-question scan, not another call, persona, or required user-facing list. |
| Heuristic scores may overstate success. | Use targeted B-vs-B2 raw-output review and explicit manual checks; do not treat heuristic values as objective truth. |

## Recommended B2 Direction

Adopt the behavior model in
[`PROJECT_ARCHITECT_BEHAVIOR_MODEL.md`](PROJECT_ARCHITECT_BEHAVIOR_MODEL.md)
and the minimal B-to-B2 delta in [`B2_DESIGN.md`](B2_DESIGN.md). It retains one
specialized Project Architect, one structured Antigravity call per turn, and the
existing B quality focus. B2 changes classification and decision governance; it
does not add task modes, a critic, multi-agent roles, or a technical planning
system.

## Source Links

- Spec Kit repository and command/template sources: https://github.com/github/spec-kit
- agent-spec repository and Intent Compiler sources: https://github.com/ZhangHanDong/agent-spec
- OpenSpec repository and Explore/Workflow sources: https://github.com/Fission-AI/OpenSpec
- BMAD-METHOD repository and Forge Idea sources: https://github.com/bmad-code-org/BMAD-METHOD
- Promptfoo repository: https://github.com/promptfoo/promptfoo
- Promptfoo configuration guide: https://www.promptfoo.dev/docs/configuration/guide/
- Promptfoo JavaScript custom provider guide: https://www.promptfoo.dev/docs/providers/custom-api/
- Promptfoo assertions and metrics guide: https://www.promptfoo.dev/docs/configuration/expected-outputs/
