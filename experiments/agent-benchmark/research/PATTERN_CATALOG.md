# Pattern Catalog

All entries below describe independently designed Project Architect adaptations.
They are not copied prompt text or code. Source revisions and licenses are in
[`OPEN_SOURCE_ASSIMILATION_REPORT.md`](OPEN_SOURCE_ASSIMILATION_REPORT.md).

## Exact Source URLs

| Pattern | Primary reviewed source |
| --- | --- |
| PAT-001 / PAT-002 | https://github.com/github/spec-kit/blob/27f50f7e6b618ea14d74dd4037f9e7c60218b16c/templates/commands/specify.md |
| PAT-003 / PAT-004 | https://github.com/ZhangHanDong/agent-spec/blob/2483398da89bd392186849bb865aae969667ac0a/skills/agent-spec-intent-compiler/SKILL.md |
| PAT-005 / PAT-006 | https://github.com/Fission-AI/OpenSpec/blob/f1b521dffac38ed6638689cd28b0c204b1eef0f1/docs/explore.md |
| PAT-007 / PAT-008 | https://github.com/bmad-code-org/BMAD-METHOD/blob/67d876f1c317a82123e429d0c078ff3c601a99a8/src/core-skills/bmad-forge-idea/SKILL.md |
| PAT-009 | https://github.com/promptfoo/promptfoo/blob/127d90534b9c1b1ba4554f007dd4b5fd2c8bf1b4/src/types/providers.ts |

Secondary files and exact local paths are listed in each pattern’s Evidence
field and in the assimilation report’s repository table.

## PAT-001 — WHAT/WHY Before HOW Gate

**Source:** `github/spec-kit`, `templates/commands/specify.md` and
`templates/commands/plan.md`, commit `27f50f7e6b618ea14d74dd4037f9e7c60218b16c`.

**Problem Solved:** Prevents technical design from becoming a substitute for
missing product definition.

**Mechanism:** Spec Kit’s specify command explicitly focuses on what users need
and why, prohibits implementation details in its specification quality checklist,
and asks no more than three material clarifications. Its plan template is a later
artifact that introduces language, dependencies, storage, platform, and technical
context.

**Why It Works:** The boundary is enforced by artifact purpose and a checklist,
not merely a vague instruction to be less technical.

**Project Architect Mapping:** FP-01 and FP-03. B chose React/Vue/PostgreSQL,
Tauri, SQLite, APIs, CRDTs, and sync servers before product choices required
them.

**Adoption:** Adapt.

**Implementation Form:** Prompt rule plus a local/evaluator rule. Discovery
defaults to product-level language. A named framework, database, provider, sync
protocol, deployment platform, language, or UI framework is forbidden unless the
user named it, a hard product constraint requires it, a feasibility blocker makes
it necessary, or the user explicitly asks for technical design.

**Risk:** A blanket ban could ignore genuine feasibility constraints. B2 admits
an exception but requires the response to state the product constraint first.

**Evidence:** `specify.md` “Focus on WHAT users need and WHY” and its quality
checklist’s “No implementation details”; `plan-template.md` begins its separate
Technical Context.

## PAT-002 — Impact-Limited Clarification Budget

**Source:** `github/spec-kit`, `templates/commands/specify.md` and
`templates/commands/clarify.md`.

**Problem Solved:** Avoids generating questions just to appear thorough.

**Mechanism:** Specify caps `NEEDS CLARIFICATION` markers at three and only uses
them for scope/UX-significant choices where no reasonable default exists. It
prioritizes scope, then security/privacy, UX, and technical details. Clarify is a
later focused pass rather than an unbounded inventory.

**Why It Works:** The cap is paired with a decision threshold; low-value unknowns
do not consume user attention.

**Project Architect Mapping:** Preserve B’s mostly good relevance/conciseness
while B2 chooses a question from a classified gap rather than surfacing every
thought.

**Adoption:** Adapt.

**Implementation Form:** Prompt rule and schema-level output expectation:
one question for a critical or high-priority decision; only tightly coupled
questions may accompany it. For normal gaps, return at most two related questions.
Do not ask a fact already explicitly stated.

**Risk:** Too-small a budget can delay closely coupled decisions. The rule allows
one additional question only when its answer directly changes the recommended
answer to the first.

**Evidence:** `specify.md` §§ execution flow and “For AI Generation”; `clarify.md`
describes up to five targeted questions in an explicit clarification stage.

## PAT-003 — Candidate Is Not Accepted Truth

**Source:** `ZhangHanDong/agent-spec`,
`skills/agent-spec-intent-compiler/SKILL.md`,
`docs/intent-compiler/architecture.md`, and
`knowledge/requirements/req-requirement-governance.md`, commit
`2483398da89bd392186849bb865aae969667ac0a`.

**Problem Solved:** Stops an agent inference from silently becoming a requirement.

**Mechanism:** The Intent Compiler drafts Candidate Requirement Blocks from raw
intent. Candidates have source excerpts and confidence, remain `proposed`, and
only a human acceptance transition enables executable lowering. Open questions
remain open; compilation cannot mutate governance state.

**Why It Works:** It separates drafting authority from requirement authority and
makes uncertainty visible.

**Project Architect Mapping:** B’s implementation choices were sometimes emitted
as assumptions or recommendations with the apparent force of settled design.

**Adoption:** Adapt.

**Implementation Form:** Prompt policy plus lightweight state semantics:
`confirmed` is user-stated or user-approved only; an AI-derived material decision
is `candidate` or `gap`; an `assumption` is permitted only by PAT-005’s bounded
predicate. No full requirement graph or transition CLI.

**Risk:** Excessive candidates can be noisy. Only decision-relevant candidates
are surfaced; everything else is omitted.

**Evidence:** Intent Compiler rules state “Do not silently invent missing
requirements” and “Do not treat a model inference as accepted”; the architecture
diagram and stage table show proposed → human acceptance → accepted.

## PAT-004 — Lightweight Provenance and Confidence

**Source:** `ZhangHanDong/agent-spec`, Intent Compiler intake contract,
`docs/intent-compiler/architecture.md`, and provenance/trace schemas.

**Problem Solved:** Lets the system and reviewer distinguish user evidence from
agent interpretation without creating a heavy Requirement IR.

**Mechanism:** Candidate blocks carry source, source excerpt, and high/medium/low
confidence; source trace survives through later artifacts. The architecture keeps
human-maintained normative truth separate from derived data.

**Why It Works:** Provenance makes a claim inspectable and prevents a smooth prose
summary from hiding inference.

**Project Architect Mapping:** B2 needs a durable way to enforce that a user
statement differs from an AI conclusion, particularly across turns.

**Adoption:** Adapt, internal first.

**Implementation Form:** A future light project-state record may be
`{ value, status, origin: user|agent, confidence: high|medium|low,
evidence: short excerpt }`. B2’s response need not expose all metadata. It should
show the semantic category, while UI/debug views may expose provenance later.

**Risk:** Source excerpts can bloat context or reveal unnecessary conversational
detail. Cap excerpts and include them only in state, not in normal user output.

**Evidence:** `SKILL.md` PRD Intake Output Contract; `architecture.md` Stage
Contracts and Requirement Governance Gate; versioned provenance schemas.

## PAT-005 — Explore Without Commitment; Material Ambiguity Rule

**Source:** `Fission-AI/OpenSpec`, `docs/explore.md`, `docs/workflows.md`, and
`src/core/templates/workflows/propose.ts`, commit
`f1b521dffac38ed6638689cd28b0c204b1eef0f1`.

**Problem Solved:** Keeps fuzzy idea work reversible and prevents the assistant
from committing to a design before the problem is clear.

**Mechanism:** OpenSpec’s Explore is a conversation that creates no artifacts or
code; only when the picture is clear does it hand off. Its proposal guardrail
asks about ambiguity that materially changes scope, externally observable
behaviour, compatibility, or acceptance criteria, while allowing minor details
to be assumed and recorded.

**Why It Works:** The workflow gives ambiguity a specific threshold and offers a
safe state in which tradeoffs can be discussed without declaring a solution.

**Project Architect Mapping:** B2 Discovery should remain product exploration;
tech choices should be deferred rather than filled in to make a plan look
complete.

**Adoption:** Adapt.

**Implementation Form:** Prompt policy. Every unspecified item is tested:
material decision → Gap/Candidate/question; minor reversible product detail →
explicit assumption; implementation detail → Technical Note unless an exception
to PAT-001 applies.

**Risk:** “Material” can be subjective. B2 defines the test in its assumption
policy and validates it against target cases.

**Evidence:** `docs/explore.md` explicitly says Explore creates no artifacts or
code; `propose.ts` guardrails distinguish material ambiguity from minor details.

## PAT-006 — Planning Artifact Separation and Readiness

**Source:** `Fission-AI/OpenSpec`, `schemas/spec-driven/templates/{proposal,spec,design,tasks}.md`,
and `docs/workflows.md`.

**Problem Solved:** Avoids treating “an idea exists” as “the project is ready for
implementation planning.”

**Mechanism:** Proposal captures why/what changes; requirement specs describe
behaviour/scenarios; design captures decisions and risks/tradeoffs; tasks are a
later artifact. Workflow status derives what is ready from dependencies.

**Why It Works:** It puts planning detail after agreement on purpose and
behaviour, and distinguishes risks/tradeoffs from requirements.

**Project Architect Mapping:** B2 needs a small discovery readiness signal, not
OpenSpec’s artifact graph.

**Adoption:** Adapt.

**Implementation Form:** `next_step.action` gains/uses `ready` only when product
purpose, primary user, MVP boundary, primary flow, success signal, and all
critical decisions are resolved or explicitly accepted as open risk. The user’s
final approval remains the highest authority.

**Risk:** A generic readiness list could become a bureaucratic checklist.
Use it as a decision aid, never a hard autonomous transition into coding.

**Evidence:** proposal/spec/design/tasks templates separate purpose, requirements,
design tradeoffs, and tasks; workflow docs distinguish explore/propose/apply.

## PAT-007 — One Branch at a Time, Constructive Pressure Test

**Source:** `bmad-code-org/BMAD-METHOD`,
`src/core-skills/bmad-forge-idea/SKILL.md` and
`docs/how-to/pressure-test-an-idea.md`, commit
`67d876f1c317a82123e429d0c078ff3c601a99a8`.

**Problem Solved:** Finds weak assumptions, value failures, scope problems, and
ambiguous terms without turning discovery into a long generic checklist.

**Mechanism:** Forge Idea is explicitly about better thinking rather than a
document. It asks one question at a time in dependency order, treats fuzzy terms
as ambiguity to resolve, challenges a central claim, and permits hardened,
killed, or clearer outcomes.

**Why It Works:** It pushes the conversation toward the load-bearing unresolved
branch instead of a shallow set of unrelated questions.

**Project Architect Mapping:** B has good challenge ability. B2 should preserve
that through an internal pressure-test scan of value, scope, core flow, safety,
and hard constraints before selecting a question.

**Adoption:** Adapt.

**Implementation Form:** Prompt-only reasoning sequence. No personas, memlog,
or second model call. Challenge is expressed as a Gap, Scope Issue, Risk, or
Tension unless it satisfies the strict Conflict test.

**Risk:** Adversarial tone can feel obstructive. Ask one high-value question,
include a recommendation and rationale, and do not challenge settled facts
without evidence.

**Evidence:** Forge Idea Overview, “The forge,” and exit states; pressure-test
guide’s one-branch-at-a-time instruction.

## PAT-008 — Explicit Analysis-to-Planning Boundary

**Source:** `bmad-code-org/BMAD-METHOD`, `docs/explanation/analysis-phase.md`
and `docs/reference/workflow-map.md`.

**Problem Solved:** Prevents downstream architecture from being built on vague,
unexamined product assumptions.

**Mechanism:** BMAD separates optional analysis (brainstorming, forge, research,
brief, PRFAQ), planning (PRD/UX/spec—locks WHAT before HOW), and solutioning
(architecture and stories).

**Why It Works:** It uses a conceptual stage boundary that explains why technical
decisions are premature, rather than labelling them universally bad.

**Project Architect Mapping:** Formalizes Project Architect’s role as Discovery
and Definition, before coding and technical architecture.

**Adoption:** Adapt.

**Implementation Form:** Core constitution and readiness policy. B2 can record a
high-level technical constraint as a deferred Technical Note, but must not design
the stack during Discovery.

**Risk:** Users who explicitly want technical guidance may feel blocked. The
technical-decision gate permits an explicit technical-planning request while
keeping that response separate from product facts.

**Evidence:** Analysis Phase explanation and Workflow Map Phase 1–3 distinction.

## PAT-009 — Declarative Regression Matrix With Extensible Assertions

**Source:** `promptfoo/promptfoo`, `src/types/providers.ts`,
`src/assertions/{json,javascript,latency,cost}.ts`, official configuration,
custom-provider, and assertion documentation, commit
`127d90534b9c1b1ba4554f007dd4b5fd2c8bf1b4`.

**Problem Solved:** Makes prompt regressions comparable over fixtures, structured
output, custom checks, latency, and provider metrics.

**Mechanism:** Promptfoo config defines prompts, providers, test cases, and
assertions in a matrix. A custom provider implements `id()` and `callApi()` and
can return `output`, `tokenUsage`, `cost`, and metadata. JSON assertions validate
JSON plus a schema; JavaScript assertions can use the provider response/context;
latency and cost assertions are built in.

**Why It Works:** It turns repeatable objective checks into declarative test data
while retaining manual review when quality is open-ended.

**Project Architect Mapping:** Useful for a later B/B2 regression subset and CI
visibility, but the current harness has irreplaceable Antigravity-specific
process/cost/raw-envelope behavior.

**Adoption:** Future, hybrid.

**Implementation Form:** Isolated `experiments/promptfoo-poc/` only after B2
design approval. One JavaScript provider would spawn `agy.exe`, parse the raw
JSON, return `structured_output` as `output`, and attach the original envelope
and usage in metadata. Do not install or migrate now.

**Risk:** Flattening the envelope to Promptfoo’s standard token shape loses
thinking/cache token fidelity unless copied into metadata. Promptfoo cache and
parallel defaults also need an explicit cost guard.

**Evidence:** `providers.ts` `ApiProvider`/`callApi`; `json.ts` AJV schema
validation; `javascript.ts`; latency/cost assertions; official docs:
https://www.promptfoo.dev/docs/providers/custom-api/ and
https://www.promptfoo.dev/docs/configuration/expected-outputs/.
