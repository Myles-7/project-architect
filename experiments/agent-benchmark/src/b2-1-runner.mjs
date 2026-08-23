import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAntigravity } from './antigravity-provider.mjs';
import { evaluateRecord } from './evaluator.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const get = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const runId = get('--run-id', `b2-1-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const selected = get('--cases', 'case-01,case-02,case-03,case-04,case-05,case-06,case-07,case-08,case-09,case-10').split(',');
const summaryFile = get('--summary-file', 'b2-1-summary.json');
const resume = args.includes('--resume');
const resultsDir = resolve(root, 'results');
const normalizedDir = resolve(resultsDir, 'normalized', runId);
const guardrail = { max_input_tokens: 60000, max_total_tokens: 75000, max_duration_ms: 90000 };
const technologyTerms = [
  ['React', /\breact\b/i], ['Vue', /\bvue\b/i], ['Angular', /\bangular\b/i], ['Tauri', /\btauri\b/i], ['Electron', /\belectron\b/i], ['Node.js', /\bnode(?:\.js)?\b/i], ['Python', /\bpython\b/i], ['PostgreSQL', /\bpostgres(?:ql)?\b/i], ['SQLite', /\bsqlite\b/i], ['MySQL', /\bmysql\b/i], ['MongoDB', /\bmongodb\b/i], ['Redis', /\bredis\b/i], ['CRDT', /\bcrdt\b/i], ['WebSocket', /\bwebsocket\b/i], ['MediaPipe', /\bmediapipe\b/i], ['Gemini API', /\bgemini(?:\s+api)?\b/i], ['OAuth', /\boauth\b/i], ['JWT', /\bjwt\b/i], ['E2EE', /\b(?:e2ee|end[ -]?to[ -]?end encryption)\b|端到端加密/i], ['zero-knowledge', /\bzero[ -]?knowledge\b|零知识/i], ['direct sync', /\bdirect(?:ly)?\s+sync\b|设备直连|局域网直连|点对点同步/i], ['sync server/relay', /同步服务器|同步中继|sync (?:server|relay)|centralized sync/i], ['encryption architecture', /加密架构|密码学方案|encryption architecture|cryptographic mechanism/i], ['Docker', /\bdocker\b/i], ['AWS', /\baws\b/i], ['Azure', /\bazure\b/i], ['GCP', /\bgcp\b|google cloud/i], ['Vercel', /\bvercel\b/i],
];
const discoveryMechanismTerms = [
  ['encrypted data or transport', /加密同步|加密数据|加密传输|加密存储/i],
  ['key mechanism', /共享密钥|恢复密钥|应急凭证|密钥文件|key sharing|recovery key/i],
  ['device pairing', /设备配对|配对(?:码|协议)?|device pairing/i],
  ['direct transport', /直接传输|直接同步|USB(?:拷贝|传输)?|局域网内(?:设备)?间|peer[ -]?to[ -]?peer/i],
  ['biometric unlock', /面部识别|指纹(?:解锁|验证)?|生物识别(?:解锁|验证)?|biometric unlock/i],
];
const read = (path) => readFile(path, 'utf8');
const average = (values) => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };

async function loadFixtures() {
  const files = (await readdir(resolve(root, 'fixtures'))).filter((name) => name.endsWith('.json'));
  const fixtures = await Promise.all(files.map(async (name) => JSON.parse(await read(resolve(root, 'fixtures', name)))));
  const selectedFixtures = selected.map((id) => fixtures.find((fixture) => fixture.id === id));
  if (selectedFixtures.some((fixture) => !fixture)) throw new Error(`Unknown fixture in ${selected.join(', ')}`);
  return selectedFixtures;
}
function usage(call) {
  const u = call.envelope?.usage || {};
  return { input_tokens: u.input_tokens ?? 'unavailable', output_tokens: u.output_tokens ?? 'unavailable', thinking_tokens: u.thinking_tokens ?? 'unavailable', total_tokens: u.total_tokens ?? 'unavailable', cache_read_tokens: u.cache_read_tokens ?? 'unavailable', raw_usage: u };
}
function warnings(fixture, output) {
  const source = fixture.idea;
  const target = JSON.stringify(output ?? '');
  return [...technologyTerms, ...discoveryMechanismTerms].filter(([, pattern]) => !pattern.test(source) && pattern.test(target)).map(([term]) => ({ type: 'possible-premature-tech', term, scope: 'all-user-visible-fields', manual_review_needed: true }));
}
function violation(call) {
  if (!call.success) return `structured output failure (exit ${call.exit_code})`;
  if (Number.isFinite(call.input_tokens) && call.input_tokens > guardrail.max_input_tokens) return `input_tokens ${call.input_tokens} > ${guardrail.max_input_tokens}`;
  if (Number.isFinite(call.total_tokens) && call.total_tokens > guardrail.max_total_tokens) return `total_tokens ${call.total_tokens} > ${guardrail.max_total_tokens}`;
  if (Number.isFinite(call.duration_ms) && call.duration_ms > guardrail.max_duration_ms) return `duration_ms ${call.duration_ms} > ${guardrail.max_duration_ms}`;
  return null;
}
async function invoke(fixture, constitution) {
  const context = `User idea:\n${fixture.idea}`;
  const prompt = `${constitution.trim()}\n\nAnalyze this user idea.\n\n## Context\n${context}`;
  const rawOutputPath = resolve(resultsDir, 'raw', runId, `${fixture.id}__B2.1__01__single-call.json`);
  const call = await callAntigravity({ prompt, schemaPath: resolve(root, 'schemas', 'b2-unified.schema.json'), rawOutputPath });
  return { task: 'single-custom', variant: 'B2.1', case: fixture.id, duration_ms: call.durationMs, exit_code: call.exitCode ?? 'unavailable', timed_out: call.timedOut, structured_success: call.success, success: call.success, stderr: call.stderr || null, raw_path: rawOutputPath, output: call.structuredOutput, prompt_chars: prompt.length, context_chars: context.length, user_input_chars: fixture.idea.length, ...usage(call) };
}
function recordFromCall(fixture, call) {
  const record = { run_id: runId, variant: 'B2.1', case: fixture.id, name: fixture.name, success: call.success, output: call.output || {}, calls: [call], metrics: { calls_per_case: 1, duration_ms: call.duration_ms, input_tokens: call.input_tokens, output_tokens: call.output_tokens, thinking_tokens: call.thinking_tokens, total_tokens: call.total_tokens, cache_read_tokens: call.cache_read_tokens, prompt_chars: call.prompt_chars, context_chars: call.context_chars, user_input_chars: call.user_input_chars }, technology_warnings: warnings(fixture, call.output), timestamp: new Date().toISOString() };
  record.evaluation = evaluateRecord(record, fixture);
  return record;
}
function summarize(records) {
  return { cases: records.length, successful_cases: records.filter((record) => record.success).length, structured_output_success_rate: records.length ? records.filter((record) => record.success).length / records.length : null, average_input_tokens_per_case: average(records.map((record) => record.metrics.input_tokens)), average_output_tokens_per_case: average(records.map((record) => record.metrics.output_tokens)), average_thinking_tokens_per_case: average(records.map((record) => record.metrics.thinking_tokens)), average_total_tokens_per_case: average(records.map((record) => record.metrics.total_tokens)), average_duration_ms: average(records.map((record) => record.metrics.duration_ms)), average_heuristic_quality_out_of_5: average(records.map((record) => record.evaluation.heuristicQuality)), possible_premature_technology_warnings: records.reduce((total, record) => total + record.technology_warnings.length, 0) };
}

const [constitution, fixtures] = await Promise.all([read(resolve(root, 'prompts', 'constitution-b2-1.md')), loadFixtures()]);
await mkdir(normalizedDir, { recursive: true });
const existingFiles = resume ? (await readdir(normalizedDir)).filter((name) => name.endsWith('.json')) : [];
const records = resume ? await Promise.all(existingFiles.map(async (name) => JSON.parse(await read(resolve(normalizedDir, name))))) : [];
let stopReason = null;
for (const fixture of fixtures) {
  if (records.some((record) => record.case === fixture.id)) { process.stdout.write(`[${runId}] ${fixture.id} resumed from saved result\n`); continue; }
  const call = await invoke(fixture, constitution);
  const record = recordFromCall(fixture, call);
  records.push(record);
  await writeFile(resolve(normalizedDir, `${fixture.id}__B2.1.json`), JSON.stringify(record, null, 2), 'utf8');
  const reason = violation(call);
  if (reason) { stopReason = `${fixture.id}/B2.1: ${reason}`; break; }
}
const summary = { benchmark: 'Project Architect Agent Benchmark v1 B2.1 Validation', run_id: runId, variant: 'B2.1', cases_requested: selected, cases_completed: [...new Set(records.map((record) => record.case))], stopped_early: !!stopReason, stop_reason: stopReason, guardrail, records, metrics: summarize(records), infrastructure_adjustments: ['B2.1 constitution adds a cross-field Capability Before Mechanism compliance pass. The runner adds warning-only detection for Chinese and English mechanism terms. Existing provider, B2 inline schema, fixtures, Variant B, and one-call execution model are unchanged.'], generated_at: new Date().toISOString() };
await writeFile(resolve(resultsDir, summaryFile), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ run_id: runId, stopped_early: summary.stopped_early, stop_reason: summary.stop_reason, metrics: summary.metrics }, null, 2));
