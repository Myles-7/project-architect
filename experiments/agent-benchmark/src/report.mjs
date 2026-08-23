import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const summary = JSON.parse(await readFile(resolve(root, 'results', 'summary.json'), 'utf8'));
const f = (v, n = 0) => v == null ? 'metric unavailable' : Number(v).toFixed(n);
const v = (id) => summary.variants[id];
const pct = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b ? `${(a * 100 / b).toFixed(1)}%` : 'metric unavailable';
const qualityDelta = Number.isFinite(v('B').average_heuristic_quality_out_of_5) && Number.isFinite(v('A').average_heuristic_quality_out_of_5) ? (v('B').average_heuristic_quality_out_of_5 - v('A').average_heuristic_quality_out_of_5).toFixed(2) : 'metric unavailable';
const metricRows = ['A','B','C','D'].map((id) => `| ${id} | ${f(v(id).average_input_tokens_per_case)} | ${f(v(id).average_total_tokens_per_case)} | ${f(v(id).average_calls_per_case, 1)} | ${f(v(id).average_heuristic_quality_out_of_5, 2)} | ${f(v(id).quality_per_10k_tokens, 3)} | ${f(v(id).structured_output_success_rate * 100)}% |`).join('\n');
const recordRows = summary.records.map((r) => `| ${r.case} | ${r.variant} | ${r.success ? 'OK' : 'FAIL'} | ${f(r.metrics.total_tokens)} | ${f(r.evaluation?.heuristicQuality, 2)} |`).join('\n');
const failures = summary.records.filter((r) => !r.success);

const report = `# Executive Summary

This is the **${summary.mode}** run \`${summary.run_id}\`, an isolated architecture experiment rather than product code. It was stopped before the full matrix because the cost guardrail was breached: ${summary.stop_reason || 'not applicable'}

The strongest evidence is Case 03: full-context modular C reached 247,719 total tokens and its Question Composition task returned a CLI error; context-selected D completed at 76,955 total tokens. Therefore do not run full-context C across the ten-case matrix. Across the two completed cases, single custom B has the best heuristic quality/token result and is the provisional V1 choice; D is the only modular direction worth further testing.

# Experiment Setup

- CLI: \`${summary.cli.command}\`, JSON mode and JSON Schema.
- Data source: JSON envelope \`structured_output\` only. The \`response\` field was never parsed.
- Planned smoke cases: ${summary.planned_case_count ?? 'metric unavailable'}; fully recorded cases: ${summary.started_case_count}; repetitions: 1.
- Status: ${summary.stopped_early ? '**stopped early**' : 'completed'}.
- Raw envelopes: \`results/raw/${summary.run_id}\`; normalized records: \`results/normalized/${summary.run_id}\`.

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
${recordRows}

# Token Results

| Variant | Avg input tokens / case | Avg total tokens / case | Avg calls / case | Heuristic quality / 5 | Quality / 10k tokens | Structured success |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${metricRows}

Formula: \`Quality / 10k tokens = (average heuristic quality / 5) × 10,000 / average total tokens per case\`. All token values are provider-reported. No unavailable metric was estimated.

# Structured Output Reliability

${['A','B','C','D'].map((id) => `- ${id}: ${f(v(id).structured_output_success_rate * 100)}% complete-case success.`).join('\n')}

# Failure Analysis

${failures.length ? failures.map((r) => `- ${r.case}/${r.variant}: ${r.calls.filter((c) => !c.success).map((c) => `${c.task}: exit ${c.exit_code}, ${c.duration_ms} ms`).join('; ')}`).join('\n') : 'No failures.'}

The initial \`smoke-1\` failure is also preserved under raw/normalized results: the CLI did not resolve the unified schema's local \`$defs\` references. The fixed inline schema was rerun as \`smoke-2-fixed\`; neither run was overwritten.

# A vs B

**Question 1: Is a custom Project Architect prompt clearly better than raw Antigravity?** Not proven by this partial smoke. The B−A heuristic delta is ${qualityDelta} / 5, and B uses ${pct(v('B').average_total_tokens_per_case, v('A').average_total_tokens_per_case)} of A's average total tokens. Inspect the raw pairs for duplicate questions and more meaningful recommendations before deciding.

# B vs C

**Question 2: Are modular prompts clearly better than a single prompt?** Full-context C is not viable as implemented. It uses ${f(v('C').average_calls_per_case, 1)} calls/case versus B's ${f(v('B').average_calls_per_case, 1)}, and Case 03's question task ballooned to 140,433 input tokens before the CLI returned status ERROR (exit code 1). Its staged output is useful evidence, but its cost/complexity is unjustified without strict budgeting.

# C vs D

**Question 3: How much does context minimization lower tokens?** D averages ${pct(v('D').average_total_tokens_per_case, v('C').average_total_tokens_per_case)} of C in this partial smoke. On Case 03 it cut total tokens by 68.9% (76,955 vs 247,719) and completed while C returned a CLI error.

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
`;

await mkdir(resolve(root, 'reports'), { recursive: true });
await writeFile(resolve(root, 'reports', 'BENCHMARK_REPORT.md'), report, 'utf8');
console.log(`Wrote ${resolve(root, 'reports', 'BENCHMARK_REPORT.md')}`);
