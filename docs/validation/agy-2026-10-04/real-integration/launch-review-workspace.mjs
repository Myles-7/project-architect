import { mkdtemp, cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createApp } from '../../../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard } from '../../../../packages/core/dist/index.js';

// A manual review surface uses copies of frozen real outputs. It never grants
// model calls or edits to the evidence originals or the user's own workspace.
const labels = process.argv.slice(2);
if (!labels.length || labels.some(label => !/^[a-z0-9-]+$/.test(label))) throw new Error('Supply completed real-control labels');
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const workspace = await mkdtemp(join(tmpdir(), 'pa-human-review-'));
const projects = [], sourceHashes = new Map();
let reviewConfig;
for (const label of labels) {
  const source = join(root, label), bytes = await readFile(join(source, 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0 || !manifest.packages.length) throw new Error(`${label} is not a frozen completed control`);
  const contentReview = JSON.parse(await readFile(join(source, 'independent-content-review.json'), 'utf8'));
  if (contentReview.status !== 'passed' || contentReview.contentPassed !== true) throw new Error(`${label} still has content blockers`);
  const finalSnapshotSha256 = createHash('sha256').update(await readFile(join(source, 'final-snapshot.json'))).digest('hex');
  if (contentReview.finalSnapshotSha256 !== finalSnapshotSha256) throw new Error(`${label} content review does not match its final snapshot`);
  reviewConfig ??= manifest.actualConfig;
  const metadata = JSON.parse(await readFile(join(source, 'project-records', 'project.json'), 'utf8'));
  if (projects.some(project => project.id === metadata.projectId)) throw new Error('Duplicate project identity');
  const path = join(workspace, 'projects', metadata.projectId);
  await cp(join(source, 'project-records'), path, { recursive: true });
  const latest = manifest.packages.at(-1);
  projects.push({ label, id: metadata.projectId, name: metadata.name, path, packageLabel: latest.labelSuffix, files: latest.manifest.files.map(file => file.name) });
  sourceHashes.set(label, createHash('sha256').update(bytes).digest('hex'));
}
const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(workspace));
let attemptedProviderCalls = 0;
const runtime = new PlanningRuntime(engine, { async complete() { attemptedProviderCalls++; throw new Error('Review copies do not run AI'); } }, reviewConfig);
const require = createRequire(resolve('apps/server/package.json'));
const express = require('express');
const app = express();
app.use((request, response, next) => {
  // Opening a project only registers/reads the isolated copy. Other write
  // controls are deliberately disabled while reviewing the final evidence.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !(request.method === 'POST' && request.path === '/api/projects/open')) {
    return response.status(403).json({ success: false, error: { code: 'REVIEW_COPY_READ_ONLY', message: '这是实际生成方案的审阅副本。请在聊天中反馈修改意见；此入口只支持查看和导出。' } });
  }
  next();
});
app.use(createApp({ workspaceRoot: workspace, engine, planningRuntime: runtime }));
app.use(express.static(resolve('apps/web/dist')));
app.use((request, response, next) => request.method === 'GET' && !request.path.startsWith('/api') ? response.sendFile(resolve('apps/web/dist/index.html')) : next());
const server = await new Promise(resolveServer => { const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener)); });
const base = `http://127.0.0.1:${server.address().port}`;
for (const project of projects) {
  const response = await fetch(`${base}/api/projects/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id }) });
  if (!response.ok) throw new Error(`Could not register ${project.name}: ${await response.text()}`);
  const viewResponse = await fetch(`${base}/api/projects/${project.id}/planning`);
  const view = await viewResponse.json();
  if (!viewResponse.ok || !view.success || Object.values(view.data.state.blueprint.stages).some(stage => stage !== 'approved') || view.data.coverageIssues.length) throw new Error(`Incomplete review project: ${project.label}`);
  project.entry = `${base}/api/projects/${project.id}/planning/package/files/START_HERE.md`;
  project.zip = `${base}/api/projects/${project.id}/planning/package/export`;
}
for (const [label, hash] of sourceHashes) if (createHash('sha256').update(await readFile(join(root, label, 'manifest.json'))).digest('hex') !== hash) throw new Error('Original evidence changed');
const info = { createdAt: new Date().toISOString(), status: 'running', base, workspace, scope: 'Manual human review of isolated copies; approvals remain scripted acceptance in the evidence. All original project records and user workspace are unchanged.', attemptedProviderCalls, projects, sourceManifestHashes: Object.fromEntries(sourceHashes) };
await mkdir(root, { recursive: true });
await writeFile(join(root, 'review-workspace.json'), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await runtime.shutdown();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
  info.status = 'stopped'; info.stoppedAt = new Date().toISOString(); info.attemptedProviderCalls = attemptedProviderCalls;
  await writeFile(join(root, 'review-workspace.json'), JSON.stringify(info, null, 2));
}
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
