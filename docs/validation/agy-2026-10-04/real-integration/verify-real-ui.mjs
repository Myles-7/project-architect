import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';
import { createApp } from '../../../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard } from '../../../../packages/core/dist/index.js';

const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label || '')) throw new Error('Completed evidence label required');
const directory = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const manifestBytes = await readFile(join(directory, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0 || !manifest.packages.some(record => record.labelSuffix === 'revised')) throw new Error('Requires completed, frozen real scenario with revised package');
const independentReview = JSON.parse(await readFile(join(directory, 'independent-content-review.json'), 'utf8'));
if (independentReview.status !== 'passed' || independentReview.contentPassed !== true) throw new Error('Final UI delivery requires independent content acceptance first');
const finalSnapshotSha256 = createHash('sha256').update(await readFile(join(directory, 'final-snapshot.json'))).digest('hex');
if (independentReview.finalSnapshotSha256 !== finalSnapshotSha256) throw new Error('Independent content acceptance must match this exact final snapshot');
const latestPackage = manifest.packages.at(-1);
const result = { label, packageLabel: latestPackage.labelSuffix, checkedAt: new Date().toISOString(), providerCalls: 0, scope: 'HTTP/UI read and ZIP of a copy of a genuine model-produced project; answers and approvals remain automated acceptance, not human review', checks: [], consoleErrors: [] };
function check(name, pass, details) {
  result.checks.push({ name, pass: Boolean(pass), ...(details === undefined ? {} : { details }) });
  if (!pass) throw new Error(name);
}
const workspace = await mkdtemp(join(tmpdir(), 'pa-real-browser-'));
const metadata = JSON.parse(await readFile(join(directory, 'project-records', 'project.json'), 'utf8'));
const project = join(workspace, 'projects', metadata.projectId);
await cp(join(directory, 'project-records'), project, { recursive: true });
const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(workspace));
const runtime = new PlanningRuntime(engine, { async complete() { result.providerCalls++; throw new Error('Read-only real UI acceptance must not invoke a model'); } }, manifest.actualConfig);
// MockAI is used only for the health indicator. Planning reads come from the
// frozen real project, and the injected runtime refuses all model calls.
const app = createApp({ workspaceRoot: workspace, engine, planningRuntime: runtime, useMockAI: true });
const require = createRequire(resolve('apps/server/package.json'));
app.use(require('express').static(resolve('apps/web/dist')));
app.use((request, response, next) => request.method === 'GET' && !request.path.startsWith('/api') ? response.sendFile(resolve('apps/web/dist/index.html')) : next());
const server = await new Promise(resolveServer => { const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener)); });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const opened = await fetch(`${base}/api/projects/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: metadata.projectId }) });
  check('copy-opens-through-formal-http-api', opened.ok, await opened.text());
  const response = await fetch(`${base}/api/projects/${metadata.projectId}/planning`), view = await response.json();
  check('formal-http-blueprint-approved', response.ok && view.success && Object.values(view.data.state.blueprint.stages).every(status => status === 'approved') && view.data.coverageIssues.length === 0, { stages: view.data?.state?.blueprint?.stages, coverage: view.data?.coverageIssues });
  const actualPackage = view.data.state.package;
  const expectedPackage = latestPackage.manifest;
  check('formal-http-package-matches-real-record', JSON.stringify(actualPackage) === JSON.stringify(expectedPackage));
  for (const file of actualPackage.files) {
    const preview = await fetch(`${base}/api/projects/${metadata.projectId}/planning/package/files/${encodeURIComponent(file.name)}`), bytes = Buffer.from(await preview.arrayBuffer());
    check('http-preview-content-hash', preview.ok && createHash('sha256').update(bytes).digest('hex') === file.sha256, file.name);
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => result.consoleErrors.push(String(error)));
  await page.goto(base);
  await page.getByText(metadata.name, { exact: true }).first().click();
  await expect(page.getByRole('region', { name: '当前方案与变更包' })).toBeVisible();
  await expect(page.getByRole('link', { name: '下载开发包 ZIP', exact: true })).toBeVisible();
  const approved = page.locator('.planning-approved > details');
  check('genuine-approved-blocks-render', await approved.count() === view.data.state.blueprint.blocks.length, await approved.count());
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.planning-plan-scroll').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: join(directory, `real-workbench-approved-${width}.png`), fullPage: true });
    check(`desktop-no-horizontal-overflow-${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (let index = 0; index < Math.min(3, await approved.count()); index++) await approved.nth(index).locator('summary').click();
  await page.screenshot({ path: join(directory, 'real-workbench-approved.png'), fullPage: true });
  await page.getByText(`预览开发包文件 (${actualPackage.files.length})`, { exact: true }).click();
  await expect(page.getByRole('link', { name: '预览 START_HERE.md', exact: true })).toBeVisible();
  const pendingPage = page.waitForEvent('popup');
  await page.getByRole('link', { name: '预览 START_HERE.md', exact: true }).click();
  const previewPage = await pendingPage; await previewPage.waitForLoadState();
  check('browser-preview-real-entry-content', (await previewPage.locator('body').innerText()).includes('首个可执行任务'));
  await previewPage.close();
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载开发包 ZIP', exact: true }).click();
  const download = await pendingDownload;
  const saved = join(directory, 'real-ui-development-package.zip');
  await download.saveAs(saved);
  check('browser-download-no-error', await download.failure() === null, download.suggestedFilename());
  const originalZip = await readFile(join(directory, `${latestPackage.labelSuffix}-development-package.zip`)), downloadedZip = await readFile(saved);
  check('browser-download-exact-real-package-bytes', originalZip.equals(downloadedZip), { bytes: downloadedZip.length, sha256: createHash('sha256').update(downloadedZip).digest('hex') });
  check('no-browser-page-errors', result.consoleErrors.length === 0, result.consoleErrors);
  check('no-provider-calls-during-real-ui-read', result.providerCalls === 0);
  check('source-real-evidence-manifest-unmodified', manifestBytes.equals(await readFile(join(directory, 'manifest.json'))));
  result.status = 'passed';
} catch (error) {
  result.status = 'failed'; result.error = String(error); process.exitCode = 1;
} finally {
  await browser?.close(); await runtime.shutdown();
  server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose));
  result.copyWorkspace = workspace;
  await writeFile(join(directory, 'real-ui-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ label, status: result.status, checks: result.checks.length, error: result.error, copyWorkspace: workspace }));
}
