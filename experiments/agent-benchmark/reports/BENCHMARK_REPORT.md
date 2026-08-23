# Executive Summary

This is the **partial-smoke** run `smoke-2-fixed`, an isolated architecture experiment rather than product code. It was stopped before the full matrix because the cost guardrail was breached: Stopped before Case 05 because Case 03 Variant C accumulated 247,719 total tokens and its Question Composition call returned CLI status ERROR (exit code 1) after 119,781 ms. Full matrix was not authorized by the cost guardrail.

The strongest evidence is Case 03: full-context modular C reached 247,719 total tokens and its Question Composition task returned a CLI error; context-selected D completed at 76,955 total tokens. Therefore do not run full-context C across the ten-case matrix. Across the two completed cases, single custom B has the best heuristic quality/token result and is the provisional V1 choice; D is the only modular direction worth further testing.

# Experiment Setup

- CLI: `agy.exe`, JSON mode and JSON Schema.
- Data source: JSON envelope `structured_output` only. The `response` field was never parsed.
- Planned smoke cases: 3; fully recorded cases: 2; repetitions: 1.
- Status: **stopped early**.
- Raw envelopes: `results/raw/smoke-2-fixed`; normalized records: `results/normalized/smoke-2-fixed`.

# Variants

- **A** Raw Antigravity baseline: idea + minimal analysis prompt + unified schema.
- **B** Single custom Project Architect: constitution + idea + unified schema.
- **C** Modular Project Architect: Idea Analysis → Gap Analysis → Question Composition with full intermediate context.
- **D** Modular plus Context-Minimized: the same modes with task-specific selected and capped context.

# Test Cases

Fixtures contain ten reusable cases, with expected characteristics rather than fixed answer keys. This partial smoke completed Case 01 (vague cleaner) and Case 03 (already detailed study planner). It was intentionally stopped before Case 05 (offline/sync contradiction) because C had already demonstrated abnormal consumption.

# Quality Results

Quality values are **heuristic suggestions**, not objective judgments. The script scores fixture-signal coverage, output completeness, explicit assumption labeling, challenge signals, recommendation presence, schema success, and conciseness. Semantic duplicate-question detection and recommendation value require manual review.

| Case | Variant | Structured | Total tokens | Heuristic quality / 5 |
| --- | --- | --- | ---: | ---: |
| case-01 | A | OK | 41065 | 4.88 |
| case-01 | B | OK | 26617 | 4.88 |
| case-01 | C | OK | 75832 | 4.88 |
| case-01 | D | OK | 78444 | 4.88 |
| case-03 | A | OK | 25934 | 4.50 |
| case-03 | B | OK | 32739 | 4.88 |
| case-03 | C | FAIL | 247719 | 3.25 |
| case-03 | D | OK | 76955 | 4.63 |

# Token Results

| Variant | Avg input tokens / case | Avg total tokens / case | Avg calls / case | Heuristic quality / 5 | Quality / 10k tokens | Structured success |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 25142 | 33500 | 1.0 | 4.69 | 0.280 | 100% |
| B | 18626 | 29678 | 1.0 | 4.88 | 0.329 | 100% |
| C | 141097 | 161776 | 3.0 | 4.06 | 0.050 | 50% |
| D | 63047 | 77700 | 3.0 | 4.75 | 0.122 | 100% |

Formula: `Quality / 10k tokens = (average heuristic quality / 5) × 10,000 / average total tokens per case`. All token values are provider-reported. No unavailable metric was estimated.

# Structured Output Reliability

- A: 100% complete-case success.
- B: 100% complete-case success.
- C: 50% complete-case success.
- D: 100% complete-case success.

# Failure Analysis

- case-03/C: question-compose: exit 1, 119781 ms

The initial `smoke-1` failure is also preserved under raw/normalized results: the CLI did not resolve the unified schema's local `$defs` references. The fixed inline schema was rerun as `smoke-2-fixed`; neither run was overwritten.

# A vs B

**Question 1: Is a custom Project Architect prompt clearly better than raw Antigravity?** Not proven by this partial smoke. The B−A heuristic delta is 0.19 / 5, and B uses 88.6% of A's average total tokens. Inspect the raw pairs for duplicate questions and more meaningful recommendations before deciding.

# B vs C

**Question 2: Are modular prompts clearly better than a single prompt?** Full-context C is not viable as implemented. It uses 3.0 calls/case versus B's 1.0, and Case 03's question task ballooned to 140,433 input tokens before the CLI returned status ERROR (exit code 1). Its staged output is useful evidence, but its cost/complexity is unjustified without strict budgeting.

# C vs D

**Question 3: How much does context minimization lower tokens?** D averages 48.0% of C in this partial smoke. On Case 03 it cut total tokens by 68.9% (76,955 vs 247,719) and completed while C returned a CLI error.

**Question 4: What is the quality impact?** It is not valid to claim a quality loss from Case 03 because C did not complete. Its complete-case heuristic is 3.25 (including the CLI failure) versus D's 4.625. The partial C output may still be useful for human inspection, but it is not a successful quality comparator.

# Quality / Token Analysis

The metric table is intentionally only a proxy. It is useful for identifying candidates, not for declaring reasoning quality objective. The Case 03 CLI failure shows why task-level max context, output-size guidance, and timeouts are required before using this metric for routing.

# Recommended Project Architect V1 Architecture

**Question 5: Is D sufficient for V1?** D is technically sufficient as a modular candidate, but it is not the preferred V1 choice on current evidence: B has comparable/higher heuristic quality at 29,678 average total tokens versus D's 77,700. Choose B as the current V1 default. If product flow later requires visible staged modes, make D stricter by truncating individual retained fields, selecting one top gap for Question Composition, and imposing task token/time budgets. Then repeat B and revised D on the smoke set before any full benchmark.

# Whether Multi-Agent Is Necessary

**Question 6: Is multi-agent required?** No evidence in this experiment requires it. No multi-agent solution was implemented. A later controlled experiment may compare a *one-time* final critic pass for conflicts, implicit assumptions, MVP growth, UX breaks, and untestable requirements. That is materially different from continuous multi-agent orchestration.

# Remaining Unknowns

- Two completed cases cannot establish cross-case quality or stochastic variance.
- The current D builder limits list counts but not length of each text item; Case 01 was slightly more expensive than C, so its compressor needs tightening.
- Human reviewers must assess duplicate questions, challenge usefulness, and recommendation quality.

# Next Step

1. Add per-field character/token caps to D's context builder and select one top gap for Question Composition.
2. Rerun the three smoke fixtures for B and revised D only, once each.
3. Manually review the raw outputs, then run revised D on all ten fixtures if cost stays bounded.
4. Repeat the best two variants once to measure variance; only then consider a one-time critic-pass experiment.
