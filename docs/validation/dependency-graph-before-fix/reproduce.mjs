// Diagnostic only: builds an in-memory legal DAG; never opens a project or Provider.
// Run with Node 24: node docs/validation/dependency-graph-before-fix/reproduce.mjs
import { Worker } from 'node:worker_threads';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const repository = new URL('../../../', import.meta.url);
const sourceUrl = new URL('packages/core/src/planning/PlanningValidation.ts', repository);
const compiledUrl = new URL('packages/core/dist/planning/PlanningValidation.js', repository);
const fixtureUrl = new URL('tests/fixtures/planning.mjs', repository);
const files = await Promise.all([sourceUrl, compiledUrl, fixtureUrl].map(async url => ({
  path: decodeURIComponent(url.pathname),
  sha256: createHash('sha256').update(await readFile(url)).digest('hex'),
})));

const workerSource = `
import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { blueprintCoverage } from ${JSON.stringify(compiledUrl.href)};
import { blocks } from ${JSON.stringify(fixtureUrl.href)};
const baseline = ['product', 'technical', 'delivery'].flatMap(blocks);
const template = baseline.find(block => block.kind === 'module');
const graph = structuredClone(baseline);
const layers = 22;
for (let level = 0; level < layers; level++) for (let lane = 0; lane < 2; lane++) {
  graph.push({ ...template, id: 'shared-' + level + '-' + lane,
    title: '共享前置 ' + level + '/' + lane,
    dependsOn: level ? ['shared-' + (level - 1) + '-0', 'shared-' + (level - 1) + '-1'] : [],
    requirementIds: ['notes'], evidenceIds: [] });
}
blueprintCoverage(baseline);
const started = performance.now();
const issues = blueprintCoverage(graph);
parentPort.postMessage({ layers, blockCount: graph.length,
  edgeCount: graph.reduce((count, block) => count + block.dependsOn.length, 0),
  elapsedMs: Math.round((performance.now() - started) * 10) / 10,
  issues, graph: graph.map(({ id, stage, kind, dependsOn }) => ({ id, stage, kind, dependsOn })) });
`;

const measurement = await new Promise((resolve, reject) => {
  const worker = new Worker(workerSource, { eval: true, type: 'module' });
  const timeout = setTimeout(async () => {
    await worker.terminate();
    resolve({ timedOut: true, timeoutMs: 5000 });
  }, 5000);
  worker.once('message', result => { clearTimeout(timeout); resolve(result); });
  worker.once('error', error => { clearTimeout(timeout); reject(error); });
});

const report = {
  schemaVersion: 1, recordedAt: new Date().toISOString(),
  nodeVersion: process.version, platform: process.platform, architecture: process.arch,
  description: 'A complete 16-block fixture plus 22 two-node layers sharing the preceding layer. All blueprintCoverage requirements and graph edges are valid.',
  scope: 'In-memory deterministic validator only; no Provider, project writes, or full test run.',
  timeoutMs: 5000, files, measurement,
  priorMeasurements: [
    { layers: 18, blockCount: 52, edgeCount: 69, elapsedMs: 166.1, actualFindCalls: 1048553, issues: [] },
    { layers: 20, blockCount: 56, edgeCount: 77, elapsedMs: 623.5, issues: [] },
    { layers: 22, blockCount: 60, edgeCount: 85, elapsedMs: 2546.3, issues: [] },
  ],
  priorMeasurementNote: 'Captured before this script was saved; the 18-layer call counted array.find invocations. The fresh measurement above is uninstrumented.',
};
// Keep the saved pre-fix measurement.json intact when comparing a later build.
const outputUrl = new URL('measurement-rerun.json', import.meta.url);
await writeFile(outputUrl, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: decodeURIComponent(outputUrl.pathname), ...measurement, graph: undefined }));
if (measurement.timedOut || measurement.issues?.length) process.exitCode = 1;
