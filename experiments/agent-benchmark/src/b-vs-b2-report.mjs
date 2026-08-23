import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const summary = JSON.parse(await readFile(resolve(root, 'results', 'b-vs-b2-targeted-summary.json'), 'utf8'));
const b = summary.variants.B;
const b2 = summary.variants.B2;
const f = (value, digits = 0) => value == null || value === 'unavailable' ? 'unavailable' : Number(value).toFixed(digits);
const tokenDelta = ((b2.average_total_tokens_per_case / b.average_total_tokens_per_case - 1) * 100).toFixed(1) + '%';
const find = (id, variant) => summary.records.find((record) => record.case === id && record.variant === variant);
const list = (items, render = String) => items?.length ? items.map((item) => '- ' + render(item)).join('\n') : '- None';
const ideas = Object.fromEntries(await Promise.all(summary.cases_requested.map(async (id) => [id, JSON.parse(await readFile(resolve(root, 'fixtures', `${id}.json`), 'utf8')).idea])));
const notes = {
  'case-01': 'B2 removes B’s stack recommendation and turns false conflicts into tensions. Safety, target-user, and platform issues remain, but it does not directly ask a separate MVP cleanup-category scope question.',
  'case-03': 'B2 removes named Web-stack/database assumptions and false conflicts. It focuses on rescheduling/syllabus, but its mobile-responsive question partially reopens stated desktop-only scope.',
  'case-05': 'B2 preserves the true offline/data-locality versus automatic-sync conflict. It also introduces E2EE/cloud/direct-sync choices and folds a separate device-discovery security risk into the conflict wording.',
  'case-06': 'B2 removes SQLite/database/server assumptions and correctly uses a tension for single-machine simplicity versus future LAN sharing. Business-flow, role/permission, backup, and expansion challenges remain.',
  'case-08': 'B2 removes CRDT/server/WebSocket/OAuth framing and asks a product-level merge-experience question. E2EE appears in a risk; rich-text/platform/concurrency assumptions still need manual scrutiny.',
  'case-09': 'B2 removes B’s detailed crypto stack, Docker, and provider recommendations; security and recovery risks remain. It still recommends zero-knowledge cloud sync and does not make recovery/security promise the leading question.',
};

function render(record) {
  if (!record) return '_Not run due to guardrail._';
  const o = record.output || {};
  return [
    `**Tokens:** ${f(record.metrics.total_tokens)} total; ${f(record.metrics.input_tokens)} input; ${f(record.metrics.output_tokens)} output; ${f(record.metrics.thinking_tokens)} thinking.  \n**Duration:** ${f(record.metrics.duration_ms)} ms.  \n**Structured success:** ${record.success ? 'yes' : 'no'}.  \n**Possible newly introduced technology warnings:** ${record.technology_warnings.length ? record.technology_warnings.map((w) => w.term).join(', ') : 'none'}.`,
    '### Confirmed\n' + list(o.confirmed),
    '### Candidates\n' + list(o.candidates),
    '### Assumptions\n' + list(o.assumptions),
    '### Gaps\n' + list(o.gaps, (g) => `[${g.severity}] ${g.area}: ${g.reason}`),
    '### Conflicts\n' + list(o.conflicts),
    '### Tensions\n' + list(o.tensions, (t) => `${t.description}: ${t.reason}`),
    '### Risks\n' + list(o.risks),
    '### Questions and Recommendations\n' + list(o.questions, (q) => `[${q.importance}] ${q.question}\n  - Recommendation: ${q.recommendation}\n  - Reason: ${q.recommendation_reason}`),
    '### Unknowns\n' + list(o.unknowns),
  ].join('\n\n');
}

const manual = [
  '# B vs B2 Targeted Manual Review', '',
  `Run: \`${summary.run_id}\`. Manual review is authoritative for open-ended quality. Technology detections are warnings across all user-visible fields, not an automatic verdict.`, '',
  '## Aggregate reviewer observations', '',
  `- B2 lowers all-field possible-premature-tech warnings from ${b.possible_premature_technology_warnings} (B) to ${b2.possible_premature_technology_warnings} (B2), but warnings remain in cases 05, 08, and 09.`,
  '- B2 largely replaces false conflicts with tensions and preserves the case-05 hard conflict, but one case-05 conflict string still includes a separate security risk.',
  '- B2 preserves most challenge ability, yet case-01 misses a direct cleanup-scope question and case-09 prioritizes a solution choice over recovery/security policy.', '',
  ...summary.cases_requested.flatMap((id) => [
    `## ${id}`, '', '### Idea', '', ideas[id], '', '### B', '', render(find(id, 'B')), '', '### B2', '', render(find(id, 'B2')), '', '### Reviewer Notes', '', notes[id], '',
    '[ ] Implementation assumption reduced  ', '[ ] Premature tech reduced  ', '[ ] True conflict preserved  ', '[ ] False conflict reduced  ', '[ ] Key gaps preserved  ', '[ ] Challenge ability preserved  ', '[ ] Recommendation remains useful  ', '[ ] No duplicate question', '',
  ]),
].join('\n');

const report = [
  '# B vs B2 Targeted Regression Report', '',
  '## Executive Summary', '',
  'All six requested cases completed with 12 primary Antigravity calls. Both variants produced structured output for every call; there was no CLI, timeout, schema, or guardrail failure. B2 materially reduces implementation assumptions and false conflicts, but does not fully satisfy the all-fields WHAT-before-HOW gate: it still introduces encryption/synchronisation implementation choices in cases 05, 08, and 09. It also partially regresses case-01 cleanup-scope coverage and case-09 recovery/security prioritization.', '',
  '**Recommendation: do not promote B2 to Full 10-Case Regression yet.** Preserve this B2 raw result. Do not modify B or silently patch this B2 run.', '',
  '## Execution Status', '',
  `- Run id: \`${summary.run_id}\``, `- Requested/completed: ${summary.cases_requested.join(', ')} / ${summary.cases_completed.join(', ')}`, `- Primary calls: ${summary.records.length}; exactly one per Case × Variant`, `- Guardrail stop: ${summary.stopped_early ? `yes — ${summary.stop_reason}` : 'no'}`, '- Retries: none', '- B stayed unchanged; additions are isolated B2 prompt/schema/runner/reporting.', '',
  '## Token and Duration Results', '',
  '| Variant | Structured success | Avg input | Avg output | Avg thinking | Avg total | Avg duration | Tech warnings |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  `| B | ${f(b.structured_output_success_rate * 100)}% | ${f(b.average_input_tokens_per_case)} | ${f(b.average_output_tokens_per_case)} | ${f(b.average_thinking_tokens_per_case)} | ${f(b.average_total_tokens_per_case)} | ${f(b.average_duration_ms)} ms | ${b.possible_premature_technology_warnings} |`,
  `| B2 | ${f(b2.structured_output_success_rate * 100)}% | ${f(b2.average_input_tokens_per_case)} | ${f(b2.average_output_tokens_per_case)} | ${f(b2.average_thinking_tokens_per_case)} | ${f(b2.average_total_tokens_per_case)} | ${f(b2.average_duration_ms)} ms | ${b2.possible_premature_technology_warnings} |`, '',
  `B2 total-token delta vs B: **${tokenDelta}**, below the +20% warning threshold. Existing heuristic quality averages are B ${f(b.average_heuristic_quality_out_of_5, 2)} / 5 and B2 ${f(b2.average_heuristic_quality_out_of_5, 2)} / 5. They are not the decision criterion.`, '',
  '## Implementation Assumption and Technology Framing', '',
  `B2 reduces warning count from ${b.possible_premature_technology_warnings} to ${b2.possible_premature_technology_warnings} and removes the recurring stack/database/protocol framing in the target cases. This is material but incomplete: case-05 emits E2EE and direct/cloud sync choices, case-08 introduces E2EE in a risk, and case-09 recommends zero-knowledge cloud sync. Because the gate applies to every user-visible field, this remains a blocking issue.`, '',
  '## Conflict Precision', '',
  'B2 is materially better: no ordinary tradeoffs are labeled conflicts in cases 01, 03, 06, 08, or 09, and `tensions` are used as intended. Case-05 preserves the true hard conflict. Its conflict record nevertheless adds a separate device-discovery security risk; that phrase should be split into Risk/Tension rather than remain inside Conflict.', '',
  '## Gap and Challenge Preservation', '',
  '- Case-01: safety, platform, and target-user issues remain; direct MVP cleanup-scope questioning is missing.', '- Case-03: rescheduling and syllabus-source gaps remain; mobile-responsive question partially reopens desktop-only scope.', '- Case-05: genuine conflict remains critical.', '- Case-06/08: repair workflow, role/permission, sharing, merge, and identity challenges remain without B’s database/protocol framing.', '- Case-09: recovery/autofill/security risks and scope challenge remain, but recovery/security policy is not the leading question.', '',
  '## Recommendation Usefulness', '',
  'B2 remains useful and concrete in cases 01, 03, 06, and much of 08. Its case-05 and case-09 recommendations are less suitable for Discovery because they prescribe a particular encrypted-sync architecture. This is a precision problem, not a reliability failure.', '',
  '## Structured Output Reliability and Failures', '',
  `- B: ${b.successful_cases}/${b.cases} structured successes.`, `- B2: ${b2.successful_cases}/${b2.cases} structured successes.`, '- CLI failure: none.', '- Timeout: none.', '- Schema/parse failure: none.', '- Guardrail outlier: none.', '',
  '## Blocking Issues', '',
  '1. **Technology gate incomplete across fields.** B2 no longer puts named technology in assumptions, but still introduces E2EE/zero-knowledge/direct-sync choices in candidates, risks, tensions, options, and recommendations.', '2. **Case-05 conflict wording remains partly overclassified.** The strict conflict is present, but an independent security risk is bundled into it.', '3. **Challenge prioritization needs correction.** Case-01 misses an explicit cleanup-scope question; case-09 does not prioritize recovery/security policy.', '4. **Duplicate/reopening guard needs review.** Case-03 reopens mobile access despite stated desktop-browser-only MVP.', '',
  '## Decision', '',
  'B2 meets stability and cost requirements and clearly improves assumption/conflict behavior. It does not yet satisfy the required all-field technology gate and fully preserve the specified priority of case-01/case-09 challenges. **Do not promote B2.**', '',
  '## Next Step', '',
  'Wait for a separate prompt-design decision. Do not run B2 Full 10-Case Regression, Variance Test, Promptfoo, or another variant automatically.', '',
].join('\n');

await mkdir(resolve(root, 'reports'), { recursive: true });
await writeFile(resolve(root, 'reports', 'B_VS_B2_TARGETED_MANUAL_REVIEW.md'), manual, 'utf8');
await writeFile(resolve(root, 'reports', 'B_VS_B2_TARGETED_REPORT.md'), report, 'utf8');
console.log('Wrote B_VS_B2_TARGETED_REPORT.md and B_VS_B2_TARGETED_MANUAL_REVIEW.md');
