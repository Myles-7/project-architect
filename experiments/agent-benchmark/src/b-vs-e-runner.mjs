import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAntigravity } from './antigravity-provider.mjs';
import { buildVariantEContext } from './context-builder.mjs';
import { evaluateRecord } from './evaluator.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const resultsDir = resolve(root, 'results');
const args = process.argv.slice(2);
const get = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const runId = get('--run-id', `b-vs-e-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const selected = (get('--cases', 'case-01,case-03,case-05')).split(',');
const resume = args.includes('--resume');
const guardrail = { max_input_tokens: 60000, max_total_tokens: 75000, max_duration_ms: 90000 };
const promptsDir = resolve(root, 'prompts');
const schemasDir = resolve(root, 'schemas');

const read = (path) => readFile(path, 'utf8');
const loadFixtures = async () => {
  const files = (await readdir(resolve(root, 'fixtures'))).filter((name) => name.endsWith('.json'));
  const items = await Promise.all(files.map(async (name) => JSON.parse(await read(resolve(root, 'fixtures', name)))));
  return selected.map((id) => items.find((item) => item.id === id)).filter(Boolean);
};
const promptText = (instructions, context) => `${instructions.trim()}\n\n## Context\n${context}`;
const usage = (call) => {
  const u = call.envelope?.usage || {};
  return { input_tokens: u.input_tokens ?? null, output_tokens: u.output_tokens ?? null, thinking_tokens: u.thinking_tokens ?? null, total_tokens: u.total_tokens ?? null, cache_read_tokens: u.cache_read_tokens ?? null, raw_usage: u };
};
const average = (values) => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };

async function invoke({ fixture, variant, task, instructions, context, schemaName, contextMetrics }) {
  const finalPrompt = promptText(instructions, context);
  const rawOutputPath = resolve(resultsDir, 'raw', runId, `${fixture.id}__${variant}__01__${task}.json`);
  const call = await callAntigravity({ prompt: finalPrompt, schemaPath: resolve(schemasDir, schemaName), rawOutputPath });
  return { task, variant, case: fixture.id, duration_ms: call.durationMs, exit_code: call.exitCode, timed_out: call.timedOut, structured_success: call.success, success: call.success, stderr: call.stderr || null, raw_path: rawOutputPath, output: call.structuredOutput, prompt_chars: finalPrompt.length, context_chars: contextMetrics.context_chars, user_input_chars: contextMetrics.user_input_chars, ...usage(call) };
}
function violatesGuardrail(call) {
  if (!call.success) return `structured output failure (exit ${call.exit_code})`;
  if (Number.isFinite(call.input_tokens) && call.input_tokens > guardrail.max_input_tokens) return `input_tokens ${call.input_tokens} > ${guardrail.max_input_tokens}`;
  if (Number.isFinite(call.total_tokens) && call.total_tokens > guardrail.max_total_tokens) return `total_tokens ${call.total_tokens} > ${guardrail.max_total_tokens}`;
  if (Number.isFinite(call.duration_ms) && call.duration_ms > guardrail.max_duration_ms) return `duration_ms ${call.duration_ms} > ${guardrail.max_duration_ms}`;
  return null;
}
function recordFromCall(fixture, variant, call) {
  const record = { run_id: runId, variant, case: fixture.id, name: fixture.name, success: call.success, output: call.output || {}, calls: [call], metrics: { calls_per_case: 1, duration_ms: call.duration_ms, input_tokens: call.input_tokens, output_tokens: call.output_tokens, thinking_tokens: call.thinking_tokens, total_tokens: call.total_tokens, cache_read_tokens: call.cache_read_tokens, prompt_chars: call.prompt_chars, context_chars: call.context_chars, user_input_chars: call.user_input_chars }, timestamp: new Date().toISOString() };
  record.evaluation = evaluateRecord(record, fixture);
  return record;
}
function summarize(records) {
  return Object.fromEntries(['B', 'E'].map((variant) => {
    const group = records.filter((record) => record.variant === variant);
    const q = average(group.map((record) => record.evaluation.heuristicQuality));
    const t = average(group.map((record) => record.metrics.total_tokens));
    return [variant, { cases: group.length, successful_cases: group.filter((record) => record.success).length, structured_output_success_rate: group.length ? group.filter((record) => record.success).length / group.length : null, average_input_tokens_per_case: average(group.map((r) => r.metrics.input_tokens)), average_output_tokens_per_case: average(group.map((r) => r.metrics.output_tokens)), average_thinking_tokens_per_case: average(group.map((r) => r.metrics.thinking_tokens)), average_total_tokens_per_case: t, average_duration_ms: average(group.map((r) => r.metrics.duration_ms)), average_prompt_chars: average(group.map((r) => r.metrics.prompt_chars)), average_context_chars: average(group.map((r) => r.metrics.context_chars)), average_heuristic_quality_out_of_5: q, quality_per_10k_tokens: q != null && t ? (q / 5) * 10000 / t : null }];
  }));
}

const [constitution, variantE, fixtures] = await Promise.all([read(resolve(promptsDir, 'constitution.md')), read(resolve(promptsDir, 'variant-e.md')), loadFixtures()]);
await mkdir(resolve(resultsDir, 'normalized', runId), { recursive: true });
const normalizedDir = resolve(resultsDir, 'normalized', runId);
const existingFiles = resume ? (await readdir(normalizedDir)).filter((name) => name.endsWith('.json')) : [];
const records = resume ? await Promise.all(existingFiles.map(async (name) => JSON.parse(await read(resolve(normalizedDir, name))))) : [];
let stopReason = null;
for (const fixture of fixtures) {
  if (records.some((record) => record.case === fixture.id)) {
    process.stdout.write(`[${runId}] ${fixture.id} resumed from saved results\n`);
    continue;
  }
  const bContext = `User idea:\n${fixture.idea}`;
  const bCall = await invoke({ fixture, variant: 'B', task: 'single-custom', instructions: `${constitution}\n\nAnalyze this user idea.`, context: bContext, schemaName: 'unified.schema.json', contextMetrics: { context_chars: bContext.length, user_input_chars: fixture.idea.length } });
  const bRecord = recordFromCall(fixture, 'B', bCall);
  records.push(bRecord);
  await writeFile(resolve(normalizedDir, `${fixture.id}__B.json`), JSON.stringify(bRecord, null, 2), 'utf8');
  stopReason = violatesGuardrail(bCall);
  if (stopReason) { stopReason = `${fixture.id}/B: ${stopReason}`; break; }

  const built = buildVariantEContext(fixture);
  const eCall = await invoke({ fixture, variant: 'E', task: 'single-call-modular', instructions: variantE, context: built.contextText, schemaName: 'variant-e.schema.json', contextMetrics: built });
  const eRecord = recordFromCall(fixture, 'E', eCall);
  eRecord.context_budget = built.budget;
  records.push(eRecord);
  await writeFile(resolve(normalizedDir, `${fixture.id}__E.json`), JSON.stringify(eRecord, null, 2), 'utf8');
  stopReason = violatesGuardrail(eCall);
  if (stopReason) { stopReason = `${fixture.id}/E: ${stopReason}`; break; }
}
const summary = { benchmark: 'Project Architect Agent Benchmark v1 B vs E', run_id: runId, cases_requested: selected, cases_completed: [...new Set(records.map((record) => record.case))], stopped_early: !!stopReason, stop_reason: stopReason, guardrail, records, variants: summarize(records), generated_at: new Date().toISOString() };
await writeFile(resolve(resultsDir, 'b-vs-e-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ run_id: runId, stopped_early: summary.stopped_early, stop_reason: stopReason, variants: summary.variants }, null, 2));
