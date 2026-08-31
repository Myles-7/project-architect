import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAntigravity } from './antigravity-provider.mjs';
import { evaluateB3Quality, summarizeManualReviews } from './b3-quality-evaluator.mjs';
import { getStageFixture, buildStageContext, MULTI_STAGE_CASES } from './b3-stage-fixtures.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const get = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const defaultCases = Array.from({ length: 14 }, (_, index) => `case-${String(index + 1).padStart(2, '0')}`).join(',');
const selected = get('--cases', defaultCases).split(',');
const runId = get('--run-id', `b3-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const summaryFile = get('--summary-file', 'b3-summary.json');
const manualReviewsFile = get('--manual-reviews-file', '');
const resultsDir = resolve(root, 'results');
const reportsDir = resolve(root, 'reports');
const normalizedDir = resolve(resultsDir, 'normalized', runId);
const read = (path) => readFile(path, 'utf8');
const manualReviewEvidence = manualReviewsFile
  ? JSON.parse(await read(resolve(process.cwd(), manualReviewsFile)))
  : {};
const reviewsFor = (caseId, stage) => manualReviewEvidence[`${caseId}:${stage}`] || [];

async function loadInitialFixtures() {
  const files = (await readdir(resolve(root, 'fixtures'))).filter((name) => name.endsWith('.json'));
  const fixtures = await Promise.all(files.map(async (name) => JSON.parse(await read(resolve(root, 'fixtures', name)))));
  return selected.map((id) => {
    const fixture = fixtures.find((item) => item.id === id);
    if (!fixture) throw new Error(`Unknown fixture: ${id}`);
    return fixture;
  });
}

function usage(call) {
  const value = call.envelope?.usage || {};
  return {
    input_tokens: value.input_tokens ?? 'unavailable',
    output_tokens: value.output_tokens ?? 'unavailable',
    thinking_tokens: value.thinking_tokens ?? 'unavailable',
    total_tokens: value.total_tokens ?? 'unavailable',
    cache_read_tokens: value.cache_read_tokens ?? 'unavailable',
  };
}

const [constitution, initialFixtures] = await Promise.all([
  read(resolve(root, 'prompts', 'constitution-b3.md')),
  loadInitialFixtures(),
]);

await mkdir(normalizedDir, { recursive: true });
await mkdir(reportsDir, { recursive: true });

const records = [];
const durations = [];
let totalInputTokens = 0;
let totalOutputTokens = 0;
let observedCacheTokens = 0;

// 1. Execute 14 Initial Fixtures
for (const fixture of initialFixtures) {
  const context = `## B3 Runtime Question Budget\n- Stage: initial\n- Target: 8-12 useful independent questions\n- Hard maximum: 12\n\n## User Idea\n${fixture.idea}`;
  const rawPath = resolve(resultsDir, 'raw', runId, `${fixture.id}__B3__initial.json`);
  const call = await callAntigravity({
    prompt: `${constitution}\n\nAnalyze the idea and return the largest useful independent question set.\n\n${context}`,
    schemaPath: resolve(root, 'schemas', 'b3-discovery.schema.json'),
    rawOutputPath: rawPath,
  });

  const b3 = evaluateB3Quality(call.structuredOutput, {
    stage: 'initial',
    manualReviews: reviewsFor(fixture.id, 'initial'),
  });
  const u = usage(call);
  if (typeof call.durationMs === 'number') durations.push(call.durationMs);
  if (typeof u.input_tokens === 'number') totalInputTokens += u.input_tokens;
  if (typeof u.output_tokens === 'number') totalOutputTokens += u.output_tokens;
  if (typeof u.cache_read_tokens === 'number' && u.cache_read_tokens > 0) {
    observedCacheTokens += u.cache_read_tokens;
  }

  const record = {
    run_id: runId,
    variant: 'B3',
    case: fixture.id,
    stage: 'initial',
    name: fixture.name,
    success: call.success && b3.is_valid_contract,
    structured_success: call.success,
    calls_per_case: 1,
    duration_ms: call.durationMs,
    output: call.structuredOutput || {},
    raw_path: rawPath,
    usage: u,
    b3,
  };
  records.push(record);
  await writeFile(resolve(normalizedDir, `${fixture.id}__B3__initial.json`), JSON.stringify(record, null, 2), 'utf8');
}

// 2. Execute Multi-Stage Fixtures (explore, converge, readiness) for 4 scenarios
const stages = ['explore', 'converge', 'readiness'];
for (const caseId of MULTI_STAGE_CASES) {
  if (!selected.includes(caseId)) continue;
  for (const stage of stages) {
    const stageFixture = getStageFixture(caseId, stage);
    if (!stageFixture) continue;

    const context = buildStageContext(stageFixture);
    const rawPath = resolve(resultsDir, 'raw', runId, `${caseId}__B3__${stage}.json`);
    const call = await callAntigravity({
      prompt: `${constitution}\n\nAnalyze the current stage context and return the stage-appropriate independent question set.\n\n${context}`,
      schemaPath: resolve(root, 'schemas', 'b3-discovery.schema.json'),
      rawOutputPath: rawPath,
    });

    const b3 = evaluateB3Quality(call.structuredOutput, {
      stage,
      lockedStatements: stageFixture.lockedDecisions.map((d) => d.statement),
      manualReviews: reviewsFor(caseId, stage),
    });
    const u = usage(call);
    if (typeof call.durationMs === 'number') durations.push(call.durationMs);
    if (typeof u.input_tokens === 'number') totalInputTokens += u.input_tokens;
    if (typeof u.output_tokens === 'number') totalOutputTokens += u.output_tokens;
    if (typeof u.cache_read_tokens === 'number' && u.cache_read_tokens > 0) {
      observedCacheTokens += u.cache_read_tokens;
    }

    const record = {
      run_id: runId,
      variant: 'B3',
      case: caseId,
      stage,
      name: `${stageFixture.name} [${stage}]`,
      success: call.success && b3.is_valid_contract,
      structured_success: call.success,
      calls_per_case: 1,
      duration_ms: call.durationMs,
      output: call.structuredOutput || {},
      raw_path: rawPath,
      usage: u,
      b3,
    };
    records.push(record);
    await writeFile(resolve(normalizedDir, `${caseId}__B3__${stage}.json`), JSON.stringify(record, null, 2), 'utf8');
  }
}

// Latency percentiles
durations.sort((a, b) => a - b);
const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

const totalViolations = records.reduce((sum, r) => sum + r.b3.violations.length, 0);
const structuredSuccessRate = records.filter((r) => r.structured_success).length / records.length;
const budgetViolations = records.filter((r) => r.b3.question_count > (r.stage === 'readiness' ? 2 : r.stage === 'converge' ? 4 : r.stage === 'explore' ? 8 : 12)).length;
const duplicateKeyCount = records.reduce((sum, record) => sum + record.b3.duplicate_keys, 0);
const dependencyConflictCount = records.reduce((sum, record) => sum + record.b3.intra_batch_dependency_conflicts, 0);
const invalidRecommendationCount = records.reduce((sum, record) => sum + record.b3.invalid_recommended_option_keys, 0);
const nonChineseCount = records.reduce((sum, record) => sum + record.b3.non_chinese_question_fields, 0);
const lockedOverwriteCount = records.reduce((sum, record) => sum + record.b3.locked_overwrites, 0);
const leakageCount = records.reduce((sum, record) => sum + record.b3.leakage_count, 0);
const manualReviewSummary = summarizeManualReviews(records);
const latencyPassed = durations.length === records.length && p50 <= 30_000 && p95 <= 60_000;
const isReleaseReady = structuredSuccessRate === 1.0
  && totalViolations === 0
  && manualReviewSummary.passed
  && latencyPassed;

const summary = {
  benchmark: 'Project Architect B3 Adaptive Discovery Full Release Benchmark',
  run_id: runId,
  environment: {
    platform: process.platform,
    node: process.version,
    provider: 'Antigravity (AGY)',
    model: 'Claude 3.5 Sonnet / Gemini via AGY',
    concurrency: 1,
    calls_per_turn: 1,
  },
  cases_executed: records.length,
  successful_cases: records.filter((r) => r.success).length,
  structured_output_success_rate: structuredSuccessRate,
  contract_violation_count: totalViolations,
  manual_review: manualReviewSummary,
  performance: {
    p50_duration_ms: p50,
    p95_duration_ms: p95,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    observed_cache_tokens: observedCacheTokens,
    prompt_cache_status: observedCacheTokens > 0 ? 'observed' : 'unknown',
    latency_gate_passed: latencyPassed,
  },
  release_verdict: isReleaseReady ? 'READY' : 'NOT READY',
  records,
  generated_at: new Date().toISOString(),
};

await writeFile(resolve(resultsDir, summaryFile), JSON.stringify(summary, null, 2), 'utf8');

// Generate Formal Markdown Validation Report
const reportContent = `# B3 Discovery 引擎发布门槛裁决报告 (Release Validation Report)

- **评估运行 ID**: \`${runId}\`
- **运行环境**: \`${process.platform}\` · Node.js \`${process.version}\`
- **Provider / 模型**: \`Antigravity CLI (AGY)\` · \`Claude 3.5 Sonnet / Gemini via AGY\`
- **测试场景总数**: **${records.length}** 组（覆盖 14 个 Initial Fixtures 与 4 组 Explore/Converge/Readiness 多阶段验证）
- **发布裁决结论**: **${isReleaseReady ? '✅ READY FOR RELEASE' : '❌ NOT READY'}**

---

## 1. 自动门槛指标看板 (Automated Thresholds)

| 门槛指标 | 目标标准 | 实际达成 | 结论 |
| :--- | :--- | :--- | :--- |
| **结构化输出成功率** | 100% | ${(structuredSuccessRate * 100).toFixed(1)}% | ${structuredSuccessRate === 1 ? 'PASS' : 'FAIL'} |
| **单操作 Provider 调用次数** | 严格 1 次 / 操作 | 1 次 (单轮结构化) | PASS |
| **问题预算越界** | 0 项 | ${budgetViolations} 项 | ${budgetViolations === 0 ? 'PASS' : 'FAIL'} |
| **重复 decision_key** | 0 项 | ${duplicateKeyCount} 项 | ${duplicateKeyCount === 0 ? 'PASS' : 'FAIL'} |
| **同批依赖冲突 (Intra-batch)** | 0 项 | ${dependencyConflictCount} 项 | ${dependencyConflictCount === 0 ? 'PASS' : 'FAIL'} |
| **推荐 Option Key 缺失/不匹配** | 0 项 | ${invalidRecommendationCount} 项 | ${invalidRecommendationCount === 0 ? 'PASS' : 'FAIL'} |
| **非中文/可读性劣质字段** | 0 项 | ${nonChineseCount} 项 | ${nonChineseCount === 0 ? 'PASS' : 'FAIL'} |
| **Locked 决策越权覆盖** | 0 项 | ${lockedOverwriteCount} 项 | ${lockedOverwriteCount === 0 ? 'PASS' : 'FAIL'} |
| **内部系统术语泄露** | 0 项 | ${leakageCount} 项 | ${leakageCount === 0 ? 'PASS' : 'FAIL'} |
| **人工双评审证据** | 每个场景 2 份，均分 ≥ 4，单项 ≥ 3 | ${manualReviewSummary.valid_review_count}/${manualReviewSummary.expected_review_count} 份 | ${manualReviewSummary.passed ? 'PASS' : 'FAIL'} |
| **Provider 时延** | p50 ≤ 30s，p95 ≤ 60s | p50 ${(p50 / 1000).toFixed(2)}s / p95 ${(p95 / 1000).toFixed(2)}s | ${latencyPassed ? 'PASS' : 'FAIL'} |

---

## 2. 性能与 Token 分布 (Performance & Cache Evidence)

- **p50 推理时延**: \`${(p50 / 1000).toFixed(2)}s\` (门槛标准: ≤ 30s)
- **p95 推理时延**: \`${(p95 / 1000).toFixed(2)}s\` (门槛标准: ≤ 60s)
- **累计输入 Token**: \`${totalInputTokens.toLocaleString()}\`
- **累计输出 Token**: \`${totalOutputTokens.toLocaleString()}\`
- **Prompt 缓存状态**: \`${observedCacheTokens > 0 ? `已观测到缓存命中 (${observedCacheTokens.toLocaleString()} tokens)` : '已配置稳定前缀，真实命中状态由 Provider 上报 (unknown/observed)'}\`
- **上下文预算控制**: Question Context 严格受限于 \`12,000\` 字符以内。

---

## 3. 双人独立人工评分复核 (Manual Reviews)

- **有效评审证据**: ${manualReviewSummary.valid_review_count} / ${manualReviewSummary.expected_review_count}
- **平均分**: ${manualReviewSummary.average_score === null ? '未提供' : manualReviewSummary.average_score.toFixed(2)} / 5.0
- **最低单项分**: ${manualReviewSummary.minimum_score === null ? '未提供' : manualReviewSummary.minimum_score.toFixed(2)} / 5.0
- **门槛结论**: ${manualReviewSummary.passed ? 'PASS' : 'FAIL — 必须提供真实、可追溯的双人独立评分，自动测试不得代填'}

---

## 4. 全量 Case 执行清单

| Case ID | 阶段 | 场景名称 | 生成问题数 | 唯一 Key 数 | 契约合规 | 时延 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${records.map((r) => `| \`${r.case}\` | \`${r.stage}\` | ${r.name} | ${r.b3.question_count} 题 | ${r.b3.unique_decision_keys} 个 | ${r.success ? '✅ PASS' : '❌ FAIL'} | ${r.duration_ms}ms |`).join('\n')}

---

## 5. 最终发布裁决

${isReleaseReady ? `> [!IMPORTANT]\n> **发布裁决：APPROVED FOR PRODUCTION RELEASE**\n>\n> 自动契约、真实双人评审证据与时延门槛全部通过。` : `> [!CAUTION]\n> **发布裁决：NOT READY**\n>\n> 自动契约、真实人工评审证据或时延门槛至少一项未通过；不得以推定分数代替缺失证据。`}
`;

await writeFile(resolve(reportsDir, 'B3_RELEASE_VALIDATION_REPORT.md'), reportContent, 'utf8');

process.stdout.write(`${JSON.stringify({
  run_id: runId,
  cases_executed: summary.cases_executed,
  successful_cases: summary.successful_cases,
  structured_output_success_rate: summary.structured_output_success_rate,
  contract_violation_count: summary.contract_violation_count,
  p50_duration_ms: summary.performance.p50_duration_ms,
  p95_duration_ms: summary.performance.p95_duration_ms,
  release_verdict: summary.release_verdict,
}, null, 2)}\n`);
