import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const summary = JSON.parse(await readFile(resolve(root, 'results', 'b-winner-summary.json'), 'utf8'));
const f = (value, digits = 0) => value == null ? 'unavailable' : Number(value).toFixed(digits);
const fixtures = Object.fromEntries(await Promise.all(summary.fixtures_requested.map(async (id) => [id, JSON.parse(await readFile(resolve(root, 'fixtures', `${id}.json`), 'utf8'))])));
const techTerms = ['postgres','mysql','mongodb','sqlite','react','vue','angular','tauri','electron','aws','azure','gcp','oauth','jwt','docker','framework','数据库','框架','云服务','配色'];
const list = (items, mapper = (x) => typeof x === 'string' ? x : JSON.stringify(x)) => items?.length ? items.map((item) => '- ' + mapper(item)).join('\n') : '- None';
const flags = (output) => [
  ...(output.assumptions || []).filter((item) => techTerms.some((term) => String(item).toLowerCase().includes(term))).map((item) => 'Possible implementation-specific assumption (manual review needed): ' + item),
  ...(output.conflicts || []).filter((item) => /体验|UX|UI|desktop|邮箱|WeChat|微信|速度|speed|安全/.test(String(item))).map((item) => 'May be a Risk/Tension rather than strict conflict (manual review needed): ' + item)
];
function caseReview(record) {
  const o = record.output || {}, m = record.metrics;
  return [
    `# ${record.case}: ${record.name}`,
    '## Idea\n\n' + fixtures[record.case].idea,
    '## Confirmed\n\n' + list(o.confirmed),
    '## Assumptions\n\n' + list(o.assumptions),
    '## Gaps\n\n' + list(o.gaps, (g) => `[${g.severity}] ${g.area}: ${g.reason}`),
    '## Conflicts\n\n' + list(o.conflicts),
    '## Risks / Tensions\n\n' + list(o.risks),
    '## Review Notes\n\n' + list(flags(o)),
    '## Questions\n\n' + list(o.questions, (q) => `[${q.importance}] ${q.question}\n  - Recommendation: ${q.recommendation}\n  - Reason: ${q.reason}`),
    `## Usage\n\n- Tokens: input ${f(m.input_tokens)}, output ${f(m.output_tokens)}, thinking ${f(m.thinking_tokens)}, total ${f(m.total_tokens)}\n- Duration: ${f(m.duration_ms)} ms\n- Structured success: ${record.success ? 'true' : 'false'}`,
    '## Reviewer Checklist\n\n- [ ] 是否遗漏关键 Gap\n- [ ] 是否重复询问\n- [ ] 是否过度 Assumption\n- [ ] Conflict 是否准确\n- [ ] 是否主动质疑\n- [ ] 推荐是否有价值\n- [ ] 是否问题过多\n- [ ] 是否过早进入技术实现'
  ].join('\n\n');
}
const manual = '# B Winner Manual Review\n\nRun: ' + summary.run_id + '. Review notes are flags only, not automatic conclusions.\n\n' + summary.records.map(caseReview).join('\n\n');
const m = summary.metrics;
const heuristicRows = Object.entries(m.heuristic_score_averages || {}).map(([key, value]) => `| ${key} | ${f(value, 2)} | heuristic / manual-review-needed |`).join('\n');
const coverage = ['极度模糊项目','AI 产品','已较完整需求','MVP Scope 过大','明确内部冲突','Desktop Tool','Web SaaS','Local-first','Security-critical','用户授权 AI 处理低风险决定'];
const outliers = m.outliers?.length ? m.outliers.map((o) => `- ${o.case}: ${o.total_tokens} total tokens; ${o.duration_ms} ms.`).join('\n') : '- No token outlier above 1.5× median.';
const validation = [
  '# B Winner Validation Report',
  '# Executive Summary',
  `Variant B was executed unchanged against ${summary.fixtures_completed.length} of 10 fixtures. ${summary.stopped_early ? 'Execution stopped early: ' + summary.stop_reason : 'All requested cases completed within guardrails.'} Heuristic values are not objective truth; every output is available in the manual report.`,
  '# Execution Status',
  `- Run: ${summary.run_id}\n- Completed: ${summary.fixtures_completed.join(', ')}\n- Structured success: ${f(m.structured_output_success_rate * 100)}%\n- Infrastructure adjustment: ${summary.infrastructure_adjustments.join(' ')}`,
  '# Test Coverage',
  coverage.map((item, index) => `- case-${String(index + 1).padStart(2, '0')}: ${item}`).join('\n'),
  '# Structured Output Reliability',
  `${f(m.structured_output_success_rate * 100)}% (${m.successful_cases}/${m.cases}); only structured_output was used.`,
  '# Token Results',
  `| Metric | Value |\n| --- | ---: |\n| Average input / case | ${f(m.average_input_tokens_per_case)} |\n| Average output / case | ${f(m.average_output_tokens_per_case)} |\n| Average thinking / case | ${f(m.average_thinking_tokens_per_case)} |\n| Average total / case | ${f(m.average_total_tokens_per_case)} |\n| Median total | ${f(m.median_total_tokens)} |\n| Minimum total | ${f(m.min_total_tokens)} |\n| Maximum total | ${f(m.max_total_tokens)} |`,
  '# Duration Results',
  `Average ${f(m.average_duration_ms)} ms; median ${f(m.median_duration_ms)} ms.`,
  '# Quality Heuristics',
  `| Metric | Average / 5 | Classification |\n| --- | ---: | --- |\n${heuristicRows}`,
  '# Gap Detection Review', 'Generally reliable. B identified cleanup safety/scope, AI data-input/privacy, study-plan data source, the oversized fitness MVP, the offline-sync contradiction, desktop backup/LAN migration, SaaS access workflow, local-first merge, password-manager recovery/security, and delegated low-risk choices. No systematic high-risk gap omission was observed in this 10-case set.',
  '# Duplicate Question Review', 'No systemic duplicate-question pattern was observed. Case 03’s mobile-access question re-opened a deliberately excluded mobile app, but did so as a responsive-browser risk to the stated validation metric, rather than repeating the excluded requirement.',
  '# Assumption Review', 'Systemic concern. Implementation-level assumptions appeared in roughly 7/10 cases: full Web stack and PostgreSQL (case-03); third-party model API, MediaPipe and i18n implementation (case-04); SQLite/data-volume bounds (case-06); multi-tenant architecture (case-07); centralized sync database (case-08); zero-knowledge model (case-09); and a specific color approach (case-10). These exceed product-level defaults.',
  '# Conflict Precision Review', 'Systemic concern. The clear physical conflict in case-05 was correctly found, and case-04 appropriately challenged MVP scope. However, cases 01, 02, 03, 06, 07, 08, 09 and 10 frequently labelled scope, UX, security, or architecture tradeoffs as conflicts. Those should usually be risks or tensions under the stated definition.',
  '# Challenge Ability Review', 'Strong. B challenged the oversized MVP in case-04, data safety in case-01, the offline-sync impossibility in case-05, local-first merge in case-08, and password-manager recovery/security in case-09.',
  '# Recommendation Review', 'Recommendations were generally concrete and reasoned. Their recurring weakness is that they sometimes carry forward the same overly specific technical choices instead of staying at the product-decision level.',
  '# Product-vs-Technology Discipline', 'Systemic concern. Several vague or product-definition inputs caused early framework, database, API, synchronization, or deployment choices to appear in assumptions, candidates, gaps, or questions.',
  '# Failures / Outliers', `${summary.stopped_early ? '- ' + summary.stop_reason : '- No guardrail failure.'}\n${outliers}`,
  '# Systemic Issues', 'Blocking Issue 1: over-specific technical assumptions recur across the majority of cases. Blocking Issue 2: B repeatedly promotes ordinary product/UX/architecture tradeoffs to conflicts. These are systemic prompt-behavior issues, not isolated fixture effects.',
  '# Is Variant B Stable Enough for V1?', 'Operationally stable: 100% structured output, no CLI/schema/timeout failure, and token/duration ranges remained controlled despite one case-04 token outlier. Product-reasoning quality is broadly useful, with no systemic duplicate-question or key high-risk-gap failure. However, the two systemic classification/assumption issues mean it is not ready to be formally frozen unchanged.',
  '# Recommendation', summary.stopped_early ? 'Partial run only; do not approve B until the remaining cases execute.' : 'Do not approve Variant B for Winner Validation freeze. Preserve this raw result, do not modify B in this phase, and wait for the next architecture/prompt decision.',
  '# Next Step', 'Blocking Issues: (1) systemic implementation-level assumptions; (2) systemic conflict-overclassification; (3) recurring premature technology framing. Do not run Variance Test automatically. Wait for direction; any future B prompt change must be a separately versioned experiment.'
].join('\n\n');
await mkdir(resolve(root, 'reports'), { recursive: true });
await writeFile(resolve(root, 'reports', 'B_WINNER_MANUAL_REVIEW.md'), manual, 'utf8');
await writeFile(resolve(root, 'reports', 'B_WINNER_VALIDATION_REPORT.md'), validation, 'utf8');
console.log('Wrote B_WINNER_MANUAL_REVIEW.md and B_WINNER_VALIDATION_REPORT.md');
