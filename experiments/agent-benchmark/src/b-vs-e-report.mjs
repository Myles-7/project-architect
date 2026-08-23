import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const summary = JSON.parse(await readFile(resolve(root, 'results', 'b-vs-e-summary.json'), 'utf8'));
const f = (n, digits = 0) => n == null ? 'unavailable' : Number(n).toFixed(digits);
const v = (id) => summary.variants[id];
const tokenChange = Number.isFinite(v('B').average_total_tokens_per_case) && Number.isFinite(v('E').average_total_tokens_per_case) ? ((v('E').average_total_tokens_per_case / v('B').average_total_tokens_per_case - 1) * 100).toFixed(1) + '%' : 'unavailable';
const find = (id, variant) => summary.records.find((r) => r.case === id && r.variant === variant);
const ideas = Object.fromEntries(await Promise.all(summary.cases_requested.map(async (id) => {
  const fixture = JSON.parse(await readFile(resolve(root, 'fixtures', `${id}.json`), 'utf8'));
  return [id, fixture.idea];
})));
const lines = (items, map) => items?.length ? items.map((item) => '- ' + map(item)).join('\n') : '- None';
function normalized(record) {
  const output = record?.output || {};
  const updates = output.understanding_updates || output;
  return { confirmed: updates.confirmed || output.confirmed || [], assumptions: updates.assumptions || output.assumptions || [], gaps: output.gaps || [], conflicts: output.conflicts || [], tensions: output.tensions || [], risks: output.risks || [], overview: output.overview_updates || [], questions: output.next_step?.questions || output.questions || [] };
}
function display(record) {
  if (!record) return '_Not run due to guardrail._';
  const x = normalized(record), m = record.metrics;
  return [
    `**Tokens:** ${f(m.total_tokens)} total; ${f(m.input_tokens)} input.  \n**Duration:** ${f(m.duration_ms)} ms.  \n**Prompt/context/user-input chars:** ${f(m.prompt_chars)} / ${f(m.context_chars)} / ${f(m.user_input_chars)}.`,
    '**Confirmed**\n' + lines(x.confirmed, String),
    '**Assumptions**\n' + lines(x.assumptions, String),
    '**Gaps**\n' + lines(x.gaps, (g) => `[${g.severity}] ${g.area}: ${g.reason}`),
    '**Conflicts**\n' + lines(x.conflicts, (c) => typeof c === 'string' ? c : `[${c.severity}] ${c.description}: ${c.reason}`),
    '**Tensions**\n' + lines(x.tensions, (t) => `${t.description}: ${t.reason}`),
    '**Risks**\n' + lines(x.risks, String),
    '**Questions and recommendations**\n' + lines(x.questions, (q) => `[${q.importance}] ${q.question} — Recommendation: ${q.recommendation}`),
    '**Overview updates**\n' + lines(x.overview, String)
  ].join('\n\n');
}
const checklist = '- [ ] 是否重复询问已明确信息\n- [ ] 是否发现真正关键 Gap\n- [ ] 是否把风险误判成 Conflict\n- [ ] 是否存在过度具体 Assumption\n- [ ] 是否主动质疑不合理需求\n- [ ] 推荐是否真正有价值\n- [ ] 问题是否值得占用用户注意力\n- [ ] 是否过早进入技术实现';
const manual = '# B vs E Manual Review\n\nRun: `' + summary.run_id + '`. Do not treat this checklist as auto-scored.\n\n' + summary.cases_requested.map((id) => `# ${id}\n\n## Idea\n\n${ideas[id]}\n\n## B\n\n${display(find(id, 'B'))}\n\n## E\n\n${display(find(id, 'E'))}\n\n## Reviewer checklist\n\n${checklist}`).join('\n\n');
const report = `# B vs E Smoke Report

## Execution Status

- Requested: ${summary.cases_requested.join(', ')}
- Completed: ${summary.cases_completed.join(', ') || 'none'}
- Guardrail stop: ${summary.stopped_early ? 'yes — ' + summary.stop_reason : 'no'}
- Each executed Case × Variant made exactly one main CLI call.

## Token, Duration, and Structured Output

| Variant | Cases | Avg input | Avg total | Avg duration ms | Structured success | Avg prompt chars | Avg context chars |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B | ${f(v('B').cases)} | ${f(v('B').average_input_tokens_per_case)} | ${f(v('B').average_total_tokens_per_case)} | ${f(v('B').average_duration_ms)} | ${f(v('B').structured_output_success_rate * 100)}% | ${f(v('B').average_prompt_chars)} | ${f(v('B').average_context_chars)} |
| E | ${f(v('E').cases)} | ${f(v('E').average_input_tokens_per_case)} | ${f(v('E').average_total_tokens_per_case)} | ${f(v('E').average_duration_ms)} | ${f(v('E').structured_output_success_rate * 100)}% | ${f(v('E').average_prompt_chars)} | ${f(v('E').average_context_chars)} |

E token change vs B: **${tokenChange}**. Quality metrics are heuristic/manual-review-needed: B ${f(v('B').average_heuristic_quality_out_of_5, 2)} / 5; E ${f(v('E').average_heuristic_quality_out_of_5, 2)} / 5.

## Required Decision Questions

1. **B Token / Case:** ${f(v('B').average_total_tokens_per_case)}.
2. **E Token / Case:** ${f(v('E').average_total_tokens_per_case)}.
3. **E token change:** ${tokenChange}.
4. **Structured Output:** B ${f(v('B').structured_output_success_rate * 100)}%; E ${f(v('E').structured_output_success_rate * 100)}%.
5. **Case 01 core gaps:** **B is better.** B surfaced safety boundary, target-user/UI, and MVP scope. E correctly represented safety as a tension, but concentrated on platform and did not ask its high safety/scope gap.
6. **Case 03 duplicates / assumption restraint:** **E is better on duplicate/conflict discipline.** B reopened the already-confirmed email choice and labeled email/WeChat and desktop/library tradeoffs as conflicts. E selected only the unresolved plan-generation question and used tensions. E still made over-specific assumptions (for example, basic email-password auth and manual rescheduling), so it does not clearly win assumption restraint.
7. **Case 05 conflict:** **Both found the core conflict; E is more precise structurally.** Both identified offline/no-data-leaving-device versus automatic cross-device sync. E emitted one critical structured conflict plus a separate tension; B emitted two conflict strings, the second being less direct.
8. **Is E worth added complexity?** **No, not yet.** It meets the cost condition and fixes classification in two cases, but does not clearly improve overall gap/question quality and loses Case 01 coverage.
9. **Recommendation:** ${summary.stopped_early ? 'No recommendation: guardrail prevented a valid comparison.' : '**Keep B as the V1 baseline.** Do not upgrade to E in its current form.'}
10. **Ready for Winner Validation?** ${summary.stopped_early ? 'No.' : '**No.** Revise E’s gap-to-question prioritization and assumption rule, then rerun this three-case B/E smoke before any winner validation.'}

## Notes

- assumption_over_specification and conflict_precision are heuristic/manual-review-needed, not objective truth.
- B uses its existing constitution and unified schema unchanged. E uses a separate one-call schema with bounded context.
`;
await mkdir(resolve(root, 'reports'), { recursive: true });
await writeFile(resolve(root, 'reports', 'B_VS_E_MANUAL_REVIEW.md'), manual, 'utf8');
await writeFile(resolve(root, 'reports', 'B_VS_E_SMOKE_REPORT.md'), report, 'utf8');
console.log('Wrote B_VS_E_SMOKE_REPORT.md and B_VS_E_MANUAL_REVIEW.md');
