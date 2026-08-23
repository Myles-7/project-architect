import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAntigravity } from './antigravity-provider.mjs';
import { evaluateRecord } from './evaluator.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const runId = process.argv.includes('--run-id') ? process.argv[process.argv.indexOf('--run-id') + 1] : `b-winner-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const resultsDir = resolve(root, 'results');
const guardrail = { max_input_tokens: 60000, max_total_tokens: 75000, max_duration_ms: 90000 };
const constitution = await readFile(resolve(root, 'prompts', 'constitution.md'), 'utf8');
const schemaPath = resolve(root, 'schemas', 'unified.schema.json');
const fixtures = await Promise.all((await readdir(resolve(root, 'fixtures'))).filter((name) => name.endsWith('.json')).sort().map(async (name) => JSON.parse(await readFile(resolve(root, 'fixtures', name), 'utf8'))));
const average = (values) => { const xs = values.filter(Number.isFinite); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
const median = (values) => { const xs = values.filter(Number.isFinite).sort((a, b) => a - b); if (!xs.length) return null; const middle = Math.floor(xs.length / 2); return xs.length % 2 ? xs[middle] : (xs[middle - 1] + xs[middle]) / 2; };
const usage = (call) => { const u = call.envelope?.usage || {}; return { input_tokens: u.input_tokens ?? null, output_tokens: u.output_tokens ?? null, thinking_tokens: u.thinking_tokens ?? null, total_tokens: u.total_tokens ?? null, cache_read_tokens: u.cache_read_tokens ?? null, raw_usage: u }; };
function guardFailure(call) {
  if (!call.success) return `structured output failure (exit ${call.exitCode})`;
  if (Number.isFinite(call.envelope?.usage?.input_tokens) && call.envelope.usage.input_tokens > guardrail.max_input_tokens) return `input_tokens ${call.envelope.usage.input_tokens} > ${guardrail.max_input_tokens}`;
  if (Number.isFinite(call.envelope?.usage?.total_tokens) && call.envelope.usage.total_tokens > guardrail.max_total_tokens) return `total_tokens ${call.envelope.usage.total_tokens} > ${guardrail.max_total_tokens}`;
  if (call.durationMs > guardrail.max_duration_ms) return `duration_ms ${call.durationMs} > ${guardrail.max_duration_ms}`;
  return null;
}
function summarize(records) {
  const metric = (key) => records.map((r) => r.metrics[key]);
  const totalMedian = median(metric('total_tokens'));
  return { cases: records.length, successful_cases: records.filter((r) => r.success).length, structured_output_success_rate: records.length ? records.filter((r) => r.success).length / records.length : null, average_input_tokens_per_case: average(metric('input_tokens')), average_output_tokens_per_case: average(metric('output_tokens')), average_thinking_tokens_per_case: average(metric('thinking_tokens')), average_total_tokens_per_case: average(metric('total_tokens')), median_total_tokens: totalMedian, min_total_tokens: Math.min(...metric('total_tokens').filter(Number.isFinite)), max_total_tokens: Math.max(...metric('total_tokens').filter(Number.isFinite)), average_duration_ms: average(metric('duration_ms')), median_duration_ms: median(metric('duration_ms')), average_heuristic_quality_out_of_5: average(records.map((r) => r.evaluation.heuristicQuality)), heuristic_score_averages: Object.fromEntries(Object.keys(records[0]?.evaluation?.scores || {}).map((key) => [key, average(records.map((r) => r.evaluation.scores[key]))])), outliers: records.filter((r) => Number.isFinite(r.metrics.total_tokens) && totalMedian && r.metrics.total_tokens > totalMedian * 1.5).map((r) => ({ case: r.case, total_tokens: r.metrics.total_tokens, duration_ms: r.metrics.duration_ms })) };
}

const normalizedDir = resolve(resultsDir, 'normalized', runId);
await mkdir(normalizedDir, { recursive: true });
const records = [];
let stopReason = null;
for (const fixture of fixtures) {
  const context = `User idea:\n${fixture.idea}`;
  const prompt = `${constitution.trim()}\n\nAnalyze this user idea.\n\n## Context\n${context}`;
  const rawOutputPath = resolve(resultsDir, 'raw', runId, `${fixture.id}__B__01__single-custom.json`);
  const call = await callAntigravity({ prompt, schemaPath, rawOutputPath });
  const callRecord = { task: 'single-custom', variant: 'B', case: fixture.id, duration_ms: call.durationMs, exit_code: call.exitCode, timed_out: call.timedOut, stderr: call.stderr || null, structured_success: call.success, success: call.success, raw_path: rawOutputPath, output: call.structuredOutput, prompt_chars: prompt.length, user_input_chars: fixture.idea.length, ...usage(call) };
  const record = { run_id: runId, variant: 'B', case: fixture.id, name: fixture.name, success: call.success, output: call.structuredOutput || {}, calls: [callRecord], metrics: { calls_per_case: 1, duration_ms: call.durationMs, input_tokens: callRecord.input_tokens, output_tokens: callRecord.output_tokens, thinking_tokens: callRecord.thinking_tokens, total_tokens: callRecord.total_tokens, cache_read_tokens: callRecord.cache_read_tokens, prompt_chars: prompt.length, user_input_chars: fixture.idea.length }, timestamp: new Date().toISOString() };
  record.evaluation = evaluateRecord(record, fixture);
  records.push(record);
  await writeFile(resolve(normalizedDir, `${fixture.id}__B.json`), JSON.stringify(record, null, 2), 'utf8');
  stopReason = guardFailure(call);
  if (stopReason) { stopReason = `${fixture.id}: ${stopReason}`; break; }
}
const summary = { benchmark: 'Project Architect Agent Benchmark v1 Winner Validation', run_id: runId, variant: 'B', fixtures_requested: fixtures.map((f) => f.id), fixtures_completed: records.map((r) => r.case), stopped_early: !!stopReason, stop_reason: stopReason, guardrail, infrastructure_adjustments: ['Dedicated B-only runner records required metrics and writes a separate result namespace. The B constitution, unified schema, prompt body, and one-call behavior are unchanged.'], records, metrics: summarize(records), generated_at: new Date().toISOString() };
await writeFile(resolve(resultsDir, 'b-winner-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ run_id: runId, completed: summary.fixtures_completed, stopped_early: summary.stopped_early, stop_reason: summary.stop_reason, metrics: summary.metrics }, null, 2));
