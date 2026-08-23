import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAntigravity } from './antigravity-provider.mjs';
import { fullModularContext, minimizedGapContext, minimizedQuestionContext, contextText } from './context-builder.mjs';
import { evaluateRecord } from './evaluator.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const fixturesDir = resolve(root, 'fixtures');
const promptsDir = resolve(root, 'prompts');
const schemasDir = resolve(root, 'schemas');
const resultsDir = resolve(root, 'results');
const args = process.argv.slice(2);
const value = (name, fallback = null) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const smoke = args.includes('--smoke');
const runId = value('--run-id', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const requestedCases = value('--cases')?.split(',');
const smokeCases = new Set(['case-01', 'case-03', 'case-05']);
const severity = { critical: 3, high: 2, medium: 1, low: 0 };

async function loadFixtures() {
  const files = (await readdir(fixturesDir)).filter((name) => name.endsWith('.json')).sort();
  const all = await Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve(fixturesDir, file), 'utf8'))));
  return all.filter((item) => requestedCases ? requestedCases.includes(item.id) : !smoke || smokeCases.has(item.id));
}
async function prompt(name) { return readFile(resolve(promptsDir, name), 'utf8'); }
const schema = (name) => resolve(schemasDir, name);

function taskPrompt(instructions, context) {
  return `${instructions.trim()}\n\n## Context\n${typeof context === 'string' ? context : contextText(context)}`;
}
function asArray(value) { return Array.isArray(value) ? value : []; }
function asObject(value) { return value && typeof value === 'object' ? value : {}; }
function normalizeIdea(value) { const v = asObject(value); return { confirmed: asArray(v.confirmed), candidates: asArray(v.candidates), assumptions: asArray(v.assumptions), unknowns: asArray(v.unknowns), risks: asArray(v.risks), project_tags: asArray(v.project_tags) }; }
function normalizeGaps(value) { const v = asObject(value); return { gaps: asArray(v.gaps), conflicts: asArray(v.conflicts) }; }
function normalizeQuestions(value) { const v = asObject(value); return { questions: asArray(v.questions) }; }
function usageOf(call) { const usage = call.envelope?.usage || {}; return { input_tokens: usage.input_tokens ?? null, output_tokens: usage.output_tokens ?? null, thinking_tokens: usage.thinking_tokens ?? null, total_tokens: usage.total_tokens ?? ((usage.input_tokens != null && usage.output_tokens != null) ? usage.input_tokens + usage.output_tokens + (usage.thinking_tokens || 0) : null), raw_usage: usage }; }
function total(values, key) { const numbers = values.map((item) => item[key]).filter(Number.isFinite); return numbers.length ? numbers.reduce((sum, n) => sum + n, 0) : null; }

async function invoke({ fixture, variant, task, instructions, context, schemaName, callIndex }) {
  const rawOutputPath = resolve(resultsDir, 'raw', runId, `${fixture.id}__${variant}__${String(callIndex).padStart(2, '0')}__${task}.json`);
  const call = await callAntigravity({ prompt: taskPrompt(instructions, context), schemaPath: schema(schemaName), rawOutputPath });
  return { task, success: call.success, duration_ms: call.durationMs, exit_code: call.exitCode, timed_out: call.timedOut, stderr: call.stderr || null, raw_path: rawOutputPath, output: call.structuredOutput, ...usageOf(call) };
}

async function runVariant(fixture, variant, prompts) {
  const calls = [];
  if (variant === 'A') {
    calls.push(await invoke({ fixture, variant, task: 'baseline', instructions: prompts.a, context: `User idea:\n${fixture.idea}`, schemaName: 'unified.schema.json', callIndex: 1 }));
  } else if (variant === 'B') {
    calls.push(await invoke({ fixture, variant, task: 'single-custom', instructions: `${prompts.constitution}\n\nAnalyze this user idea.`, context: `User idea:\n${fixture.idea}`, schemaName: 'unified.schema.json', callIndex: 1 }));
  } else {
    const min = variant === 'D';
    const analysisCall = await invoke({ fixture, variant, task: 'idea-analysis', instructions: `${prompts.constitution}\n\n${prompts.idea}`, context: `User idea:\n${fixture.idea}`, schemaName: 'idea-analysis.schema.json', callIndex: 1 });
    calls.push(analysisCall);
    const analysis = normalizeIdea(analysisCall.output);
    const gapContext = min ? minimizedGapContext(fixture, analysis) : fullModularContext(fixture, analysis, null);
    const gapCall = await invoke({ fixture, variant, task: 'gap-analysis', instructions: `${prompts.constitution}\n\n${prompts.gap}`, context: gapContext, schemaName: 'gap-analysis.schema.json', callIndex: 2 });
    calls.push(gapCall);
    const gaps = normalizeGaps(gapCall.output);
    const questionContext = min ? minimizedQuestionContext(fixture, analysis, gaps) : fullModularContext(fixture, analysis, gaps);
    const questionCall = await invoke({ fixture, variant, task: 'question-compose', instructions: `${prompts.constitution}\n\n${prompts.questions}`, context: questionContext, schemaName: 'question-compose.schema.json', callIndex: 3 });
    calls.push(questionCall);
    const questions = normalizeQuestions(questionCall.output);
    calls.output = { ...analysis, ...gaps, ...questions };
  }
  const output = calls.output || asObject(calls[0]?.output);
  const metrics = { calls_per_case: calls.length, duration_ms: total(calls, 'duration_ms'), input_tokens: total(calls, 'input_tokens'), output_tokens: total(calls, 'output_tokens'), thinking_tokens: total(calls, 'thinking_tokens'), total_tokens: total(calls, 'total_tokens') };
  const record = { run_id: runId, variant, case: fixture.id, name: fixture.name, output, calls, metrics, success: calls.every((call) => call.success), timestamp: new Date().toISOString() };
  record.evaluation = evaluateRecord(record, fixture);
  return record;
}

function summarize(records) {
  const variants = {};
  for (const variant of ['A', 'B', 'C', 'D']) {
    const group = records.filter((record) => record.variant === variant);
    const average = (selector) => { const values = group.map(selector).filter(Number.isFinite); return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null; };
    const avgQuality = average((record) => record.evaluation.heuristicQuality);
    const avgTokens = average((record) => record.metrics.total_tokens);
    variants[variant] = { cases: group.length, successful_cases: group.filter((record) => record.success).length, average_input_tokens_per_case: average((record) => record.metrics.input_tokens), average_total_tokens_per_case: avgTokens, average_calls_per_case: average((record) => record.metrics.calls_per_case), average_heuristic_quality_out_of_5: avgQuality, quality_per_10k_tokens: avgQuality != null && avgTokens ? (avgQuality / 5) * 10000 / avgTokens : null, structured_output_success_rate: group.length ? group.filter((record) => record.success).length / group.length : null };
  }
  return variants;
}

const fixtures = await loadFixtures();
const prompts = { a: await prompt('variant-a.md'), constitution: await prompt('constitution.md'), idea: await prompt('idea-analysis.md'), gap: await prompt('gap-analysis.md'), questions: await prompt('question-compose.md') };
await mkdir(resolve(resultsDir, 'normalized', runId), { recursive: true });
const records = [];
for (const fixture of fixtures) {
  for (const variant of ['A', 'B', 'C', 'D']) {
    process.stdout.write(`[${runId}] ${fixture.id} variant ${variant}\n`);
    try {
      const record = await runVariant(fixture, variant, prompts);
      records.push(record);
      await writeFile(resolve(resultsDir, 'normalized', runId, `${fixture.id}__${variant}.json`), JSON.stringify(record, null, 2), 'utf8');
    } catch (error) {
      const failure = { run_id: runId, variant, case: fixture.id, name: fixture.name, success: false, error: { message: error.message, stack: error.stack }, calls: [], metrics: { calls_per_case: 0, duration_ms: null, input_tokens: null, output_tokens: null, thinking_tokens: null, total_tokens: null }, timestamp: new Date().toISOString() };
      records.push(failure);
      await writeFile(resolve(resultsDir, 'normalized', runId, `${fixture.id}__${variant}.json`), JSON.stringify(failure, null, 2), 'utf8');
    }
  }
}
const summary = { benchmark: 'Project Architect Agent Benchmark v1', run_id: runId, mode: smoke ? 'smoke' : 'full', cli: { command: process.env.AGY_CLI || 'agy.exe' }, started_case_count: fixtures.length, records, variants: summarize(records), generated_at: new Date().toISOString() };
await writeFile(resolve(resultsDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({ run_id: runId, mode: summary.mode, variants: summary.variants }, null, 2));
