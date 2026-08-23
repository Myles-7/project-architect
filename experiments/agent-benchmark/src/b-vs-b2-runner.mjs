import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAntigravity } from './antigravity-provider.mjs';
import { evaluateRecord } from './evaluator.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const resultsDir = resolve(root, 'results');
const args = process.argv.slice(2);
const get = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const runId = get('--run-id', `b-vs-b2-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const selected = (get('--cases', 'case-01,case-03,case-05,case-06,case-08,case-09')).split(',');
const resume = args.includes('--resume');
const guardrail = { max_input_tokens: 60000, max_total_tokens: 75000, max_duration_ms: 90000 };
const promptsDir = resolve(root, 'prompts');
const schemasDir = resolve(root, 'schemas');

const technologyTerms = [
  { label: 'React', pattern: /\breact\b/i }, { label: 'Vue', pattern: /\bvue\b/i },
  { label: 'Angular', pattern: /\bangular\b/i }, { label: 'Tauri', pattern: /\btauri\b/i },
  { label: 'Electron', pattern: /\belectron\b/i }, { label: 'Node.js', pattern: /\bnode(?:\.js)?\b/i },
  { label: 'Python', pattern: /\bpython\b/i }, { label: 'PostgreSQL', pattern: /\bpostgres(?:ql)?\b/i },
  { label: 'SQLite', pattern: /\bsqlite\b/i }, { label: 'MySQL', pattern: /\bmysql\b/i },
  { label: 'MongoDB', pattern: /\bmongodb\b/i }, { label: 'Redis', pattern: /\bredis\b/i },
  { label: 'CRDT', pattern: /\bcrdt\b/i }, { label: 'WebSocket', pattern: /\bwebsocket\b/i },
  { label: 'MediaPipe', pattern: /\bmediapipe\b/i }, { label: 'Gemini API', pattern: /\bgemini(?:\s+api)?\b/i },
  { label: 'OAuth', pattern: /\boauth\b/i }, { label: 'JWT', pattern: /\bjwt\b/i },
  { label: 'email/password auth', pattern: /(?:email|邮箱)\s*[/+和及与-]?\s*(?:password|密码)/i },
  { label: 'E2EE', pattern: /\b(?:e2ee|end[ -]?to[ -]?end encryption)\b|端到端加密/i },
  { label: 'zero-knowledge', pattern: /\bzero[ -]?knowledge\b|零知识/i }, { label: 'Docker', pattern: /\bdocker\b/i },
  { label: 'AWS', pattern: /\baws\b/i }, { label: 'Azure', pattern: /\bazure\b/i },
  { label: 'GCP', pattern: /\bgcp\b|google cloud/i }, { label: 'Vercel', pattern: /\bvercel\b/i },
];

const read = (path) => readFile(path, 'utf8');
const average = (values) => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };
const promptText = (instructions, context) => `${instructions.trim()}\n\nAnalyze this user idea.\n\n## Context\n${context}`;

async function loadFixtures() {
  const files = (await readdir(resolve(root, 'fixtures'))).filter((name) => name.endsWith('.json'));
  const entries = await Promise.all(files.map(async (name) => JSON.parse(await read(resolve(root, 'fixtures', name)))));
  const fixtures = selected.map((id) => entries.find((entry) => entry.id === id));
  const missing = selected.filter((id, index) => !fixtures[index]);
  if (missing.length) throw new Error(`Unknown fixture(s): ${missing.join(', ')}`);
  return fixtures;
}

function usage(call) {
  const raw = call.envelope?.usage || {};
  return {
    input_tokens: raw.input_tokens ?? 'unavailable',
    output_tokens: raw.output_tokens ?? 'unavailable',
    thinking_tokens: raw.thinking_tokens ?? 'unavailable',
    total_tokens: raw.total_tokens ?? 'unavailable',
    cache_read_tokens: raw.cache_read_tokens ?? 'unavailable',
    raw_usage: raw,
  };
}

function outputText(output) {
  return JSON.stringify(output ?? '');
}

function technologyWarnings(fixture, output) {
  const input = fixture.idea;
  const outputString = outputText(output);
  return technologyTerms
    .filter(({ pattern }) => !pattern.test(input) && pattern.test(outputString))
    .map(({ label }) => ({ type: 'possible-premature-tech', term: label, scope: 'all-user-visible-fields', manual_review_needed: true }));
}

async function invoke({ fixture, variant, instructions, schemaName }) {
  const context = `User idea:\n${fixture.idea}`;
  const finalPrompt = promptText(instructions, context);
  const rawOutputPath = resolve(resultsDir, 'raw', runId, `${fixture.id}__${variant}__01__single-call.json`);
  const call = await callAntigravity({ prompt: finalPrompt, schemaPath: resolve(schemasDir, schemaName), rawOutputPath });
  const metrics = usage(call);
  return {
    task: 'single-custom', variant, case: fixture.id,
    duration_ms: call.durationMs, exit_code: call.exitCode ?? 'unavailable', timed_out: call.timedOut,
    structured_success: call.success, success: call.success, stderr: call.stderr || null,
    raw_path: rawOutputPath, output: call.structuredOutput, prompt_chars: finalPrompt.length,
    context_chars: context.length, user_input_chars: fixture.idea.length, ...metrics,
  };
}

function violatesGuardrail(call) {
  if (!call.success) return `structured output failure (exit ${call.exit_code})`;
  if (Number.isFinite(call.input_tokens) && call.input_tokens > guardrail.max_input_tokens) return `input_tokens ${call.input_tokens} > ${guardrail.max_input_tokens}`;
  if (Number.isFinite(call.total_tokens) && call.total_tokens > guardrail.max_total_tokens) return `total_tokens ${call.total_tokens} > ${guardrail.max_total_tokens}`;
  if (Number.isFinite(call.duration_ms) && call.duration_ms > guardrail.max_duration_ms) return `duration_ms ${call.duration_ms} > ${guardrail.max_duration_ms}`;
  return null;
}

function recordFromCall(fixture, variant, call) {
  const record = {
    run_id: runId, variant, case: fixture.id, name: fixture.name, success: call.success,
    output: call.output || {}, calls: [call],
    metrics: {
      calls_per_case: 1, duration_ms: call.duration_ms, input_tokens: call.input_tokens,
      output_tokens: call.output_tokens, thinking_tokens: call.thinking_tokens,
      total_tokens: call.total_tokens, cache_read_tokens: call.cache_read_tokens,
      prompt_chars: call.prompt_chars, context_chars: call.context_chars, user_input_chars: call.user_input_chars,
    },
    technology_warnings: technologyWarnings(fixture, call.output), timestamp: new Date().toISOString(),
  };
  record.evaluation = evaluateRecord(record, fixture);
  return record;
}

function summarize(records) {
  return Object.fromEntries(['B', 'B2'].map((variant) => {
    const group = records.filter((record) => record.variant === variant);
    const averageTotal = average(group.map((record) => record.metrics.total_tokens));
    const quality = average(group.map((record) => record.evaluation.heuristicQuality));
    return [variant, {
      cases: group.length, successful_cases: group.filter((record) => record.success).length,
      structured_output_success_rate: group.length ? group.filter((record) => record.success).length / group.length : null,
      average_input_tokens_per_case: average(group.map((record) => record.metrics.input_tokens)),
      average_output_tokens_per_case: average(group.map((record) => record.metrics.output_tokens)),
      average_thinking_tokens_per_case: average(group.map((record) => record.metrics.thinking_tokens)),
      average_total_tokens_per_case: averageTotal,
      average_duration_ms: average(group.map((record) => record.metrics.duration_ms)),
      average_prompt_chars: average(group.map((record) => record.metrics.prompt_chars)),
      average_heuristic_quality_out_of_5: quality,
      quality_per_10k_tokens: quality != null && averageTotal ? (quality / 5) * 10000 / averageTotal : null,
      possible_premature_technology_warnings: group.reduce((total, record) => total + record.technology_warnings.length, 0),
    }];
  }));
}

const [bConstitution, b2Constitution, fixtures] = await Promise.all([
  read(resolve(promptsDir, 'constitution.md')),
  read(resolve(promptsDir, 'constitution-b2.md')),
  loadFixtures(),
]);
const normalizedDir = resolve(resultsDir, 'normalized', runId);
await mkdir(normalizedDir, { recursive: true });
const existingFiles = resume ? (await readdir(normalizedDir)).filter((name) => name.endsWith('.json')) : [];
const records = resume ? await Promise.all(existingFiles.map(async (name) => JSON.parse(await read(resolve(normalizedDir, name))))) : [];
let stopReason = null;
for (const fixture of fixtures) {
  for (const variant of ['B', 'B2']) {
    if (records.some((record) => record.case === fixture.id && record.variant === variant)) {
      process.stdout.write(`[${runId}] ${fixture.id}/${variant} resumed from saved result\n`);
      continue;
    }
    const call = await invoke({
      fixture, variant,
      instructions: variant === 'B' ? bConstitution : b2Constitution,
      schemaName: variant === 'B' ? 'unified.schema.json' : 'b2-unified.schema.json',
    });
    const record = recordFromCall(fixture, variant, call);
    records.push(record);
    await writeFile(resolve(normalizedDir, `${fixture.id}__${variant}.json`), JSON.stringify(record, null, 2), 'utf8');
    const violation = violatesGuardrail(call);
    if (violation) { stopReason = `${fixture.id}/${variant}: ${violation}`; break; }
  }
  if (stopReason) break;
}

const summary = {
  benchmark: 'Project Architect Agent Benchmark v1 B vs B2 Targeted Regression',
  run_id: runId, cases_requested: selected, cases_completed: [...new Set(records.map((record) => record.case))],
  stopped_early: !!stopReason, stop_reason: stopReason, guardrail, records, variants: summarize(records),
  infrastructure_adjustments: ['Added isolated B2 prompt, inline schema, B2-only runner, all-field technology-warning heuristic, and B-vs-B2 reports. Variant B constitution, schema, provider, fixtures, and one-call behavior are unchanged.'],
  generated_at: new Date().toISOString(),
};
await writeFile(resolve(resultsDir, 'b-vs-b2-targeted-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ run_id: runId, stopped_early: summary.stopped_early, stop_reason: stopReason, variants: summary.variants }, null, 2));
