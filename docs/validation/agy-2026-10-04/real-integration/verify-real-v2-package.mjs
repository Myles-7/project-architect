import { mkdtemp, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';
import { createApp } from '../../../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard, planningBasis } from '../../../../packages/core/dist/index.js';

const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label || '')) throw new Error('Completed real control label required');
const directory = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const parentBytes = await readFile(join(directory, 'manifest.json'));
const parent = JSON.parse(parentBytes.toString('utf8'));
if (parent.status !== 'completed' || parent.activeCallsAtShutdown !== 0) throw new Error('Requires a completed, frozen real control');
const result = {
  label, checkedAt: new Date().toISOString(), sourceManifestSha256: createHash('sha256').update(parentBytes).digest('hex'),
  scope: 'Recompile a copy of the real approved blueprint through public HTTP; no new AI result, requirement or approval. Structural graph checks do not establish semantic plan quality.',
  providerCalls: 0, checks: [],
};
function check(name, pass, details) {
  result.checks.push({ name, pass: Boolean(pass), ...(details === undefined ? {} : { details }) });
  if (!pass) throw new Error(name);
}
const workspace = await mkdtemp(join(tmpdir(), 'pa-real-v2-package-'));
const metadata = JSON.parse(await readFile(join(directory, 'project-records', 'project.json'), 'utf8'));
const project = join(workspace, 'projects', metadata.projectId);
await cp(join(directory, 'project-records'), project, { recursive: true });
const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(workspace));
const runtime = new PlanningRuntime(engine, { async complete() { result.providerCalls++; throw new Error('Package compilation cannot invoke a model'); } }, parent.actualConfig);
const before = await runtime.service.get(project);
const originalBlueprint = structuredClone(before.planning.blueprint);
const app = createApp({ workspaceRoot: workspace, engine, planningRuntime: runtime, useMockAI: true });
const require = createRequire(resolve('apps/server/package.json'));
app.use(require('express').static(resolve('apps/web/dist')));
app.use((request, response, next) => request.method === 'GET' && !request.path.startsWith('/api') ? response.sendFile(resolve('apps/web/dist/index.html')) : next());
const server = await new Promise(resolveServer => { const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener)); });
const base = `http://127.0.0.1:${server.address().port}`;
const outputDirectory = join(directory, 'v2-compilation');
await mkdir(outputDirectory, { recursive: true });
let browser;
try {
  const opened = await fetch(`${base}/api/projects/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: metadata.projectId }) });
  check('real-project-copy-opens', opened.ok);
  const response = await fetch(`${base}/api/projects/${metadata.projectId}/planning/package`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: before.metadata.stateRevision, operationId: `real-v2-${label}-${Date.now()}` }) });
  const envelope = await response.json();
  check('public-http-compile-succeeds', response.ok && envelope.success, response.ok ? undefined : envelope.error);
  const current = await runtime.service.get(project), manifest = current.planning.package;
  check('approved-blueprint-unchanged', JSON.stringify(originalBlueprint) === JSON.stringify(current.planning.blueprint));
  check('formal-basis-unchanged', planningBasis(before).hash === planningBasis(current).hash);
  const documents = new Map();
  for (const file of manifest.files) {
    const preview = await fetch(`${base}/api/projects/${metadata.projectId}/planning/package/files/${encodeURIComponent(file.name)}`);
    const bytes = Buffer.from(await preview.arrayBuffer());
    check('preview-sha-matches-manifest', preview.ok && createHash('sha256').update(bytes).digest('hex') === file.sha256, file.name);
    documents.set(file.name, bytes.toString('utf8'));
    await writeFile(join(outputDirectory, file.name), bytes);
  }
  await writeFile(join(outputDirectory, 'package-manifest.json'), JSON.stringify(manifest, null, 2));
  const data = JSON.parse(documents.get('tasks.json'));
  check('task-contract-version-2', data.schemaVersion === 2);
  check('task-version-and-basis-match', data.revision === manifest.sourceRevision && data.blueprintHash === manifest.basisHash);
  const sourceById = new Map(originalBlueprint.blocks.map(block => [block.id, block]));
  const executionBlocks = originalBlueprint.blocks.filter(block => ['task', 'validation'].includes(block.kind));
  check('every-real-task-preserved', executionBlocks.length === data.tasks.length && executionBlocks.every(block => data.tasks.some(task => task.id === block.id)));
  const positions = new Map(data.tasks.map((task, index) => [task.id, index]));
  const referenceIds = new Set(data.blueprintReferences.map(reference => reference.id));
  const allIds = new Set([...positions.keys(), ...referenceIds]);
  check('all-blueprint-references-preserved', allIds.size === sourceById.size && [...sourceById.keys()].every(id => allIds.has(id)));
  for (const task of data.tasks) {
    const source = sourceById.get(task.id);
    check('task-data-and-source-dependencies-preserved', Object.entries(source.task).every(([key, value]) => JSON.stringify(task[key]) === JSON.stringify(value)) && JSON.stringify(source.dependsOn) === JSON.stringify(task.blueprintDependsOn) && JSON.stringify(source.requirementIds) === JSON.stringify(task.requirementIds), task.id);
    check('execution-prerequisites-are-earlier-exported-tasks', task.dependsOn.every(id => positions.has(id) && positions.get(id) < positions.get(task.id)), task.id);
    check('task-source-references-resolve', [...task.blueprintDependsOn, ...task.requirementIds].every(id => allIds.has(id)), task.id);
  }
  for (const reference of data.blueprintReferences) check('non-task-source-references-resolve', [...reference.dependsOn, ...reference.requirementIds].every(id => allIds.has(id)), reference.id);
  const order = [...documents.get('DEVELOPMENT_PLAN.md').matchAll(/^ID：([^；]+)；/gm)].map(match => match[1]);
  check('task-file-and-development-plan-have-same-order', JSON.stringify(order) === JSON.stringify(data.tasks.map(task => task.id)));
  check('entry-matches-first-topological-task', data.tasks[0].dependsOn.length === 0 && documents.get('START_HERE.md').includes(`首个可执行任务：${data.tasks[0].id} —`));
  const exported = await fetch(`${base}/api/projects/${metadata.projectId}/planning/package/export`), zip = Buffer.from(await exported.arrayBuffer());
  check('formal-http-zip-export', exported.ok && zip.subarray(0, 4).toString('hex') === '504b0304');
  await writeFile(join(directory, 'v2-development-package.zip'), zip);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(base);
  await page.getByText(metadata.name, { exact: true }).first().click();
  const downloadLink = page.getByRole('link', { name: '下载开发包 ZIP', exact: true });
  await expect(downloadLink).toBeVisible();
  const pendingDownload = page.waitForEvent('download'); await downloadLink.click();
  const download = await pendingDownload, downloadedPath = join(directory, 'v2-browser-development-package.zip');
  await download.saveAs(downloadedPath);
  check('v2-browser-download-matches-public-zip', await download.failure() === null && zip.equals(await readFile(downloadedPath)));
  check('source-control-manifest-unmodified', parentBytes.equals(await readFile(join(directory, 'manifest.json'))));
  check('no-provider-calls', result.providerCalls === 0);
  result.package = manifest;
  result.firstTask = data.tasks[0].id;
  result.taskCount = data.tasks.length;
  result.zipBytes = zip.length;
  result.zipSha256 = createHash('sha256').update(zip).digest('hex');
  result.status = 'passed';
} catch (error) {
  result.status = 'failed'; result.error = String(error); process.exitCode = 1;
} finally {
  await browser?.close(); await runtime.shutdown(); server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
  result.copyWorkspace = workspace;
  await writeFile(join(directory, 'v2-package-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ label, status: result.status, checks: result.checks.length, taskCount: result.taskCount, firstTask: result.firstTask, error: result.error }));
}
