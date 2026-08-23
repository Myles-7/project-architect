import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const runId = process.argv[2];
if (!runId) throw new Error('Usage: node src/summarize-run.mjs <run-id>');
const dir = resolve(root, 'results', 'normalized', runId);
const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
const records = await Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve(dir, file), 'utf8'))));
const average = (values) => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; };
const variants = Object.fromEntries(['A', 'B', 'C', 'D'].map((variant) => {
  const group = records.filter((record) => record.variant === variant);
  const q = average(group.map((record) => record.evaluation?.heuristicQuality));
  const t = average(group.map((record) => record.metrics?.total_tokens));
  return [variant, { cases: group.length, successful_cases: group.filter((record) => record.success).length, average_input_tokens_per_case: average(group.map((record) => record.metrics?.input_tokens)), average_total_tokens_per_case: t, average_calls_per_case: average(group.map((record) => record.metrics?.calls_per_case)), average_heuristic_quality_out_of_5: q, quality_per_10k_tokens: q != null && t ? (q / 5) * 10000 / t : null, structured_output_success_rate: group.length ? group.filter((record) => record.success).length / group.length : null }];
}));
const summary = { benchmark: 'Project Architect Agent Benchmark v1', run_id: runId, mode: 'partial-smoke', planned_case_count: 3, started_case_count: new Set(records.map((record) => record.case)).size, stopped_early: true, stop_reason: 'Stopped before Case 05 because Case 03 Variant C accumulated 247,719 total tokens and its Question Composition call returned CLI status ERROR (exit code 1) after 119,781 ms. Full matrix was not authorized by the cost guardrail.', cli: { command: process.env.AGY_CLI || 'agy.exe' }, records, variants, generated_at: new Date().toISOString() };
await writeFile(resolve(root, 'results', 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ run_id: runId, variants }, null, 2));
