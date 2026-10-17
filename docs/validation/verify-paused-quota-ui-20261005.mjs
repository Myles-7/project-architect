import { mkdtemp, cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';
import { createApp } from '../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard } from '../../packages/core/dist/index.js';
import { treeSha256 } from './agy-2026-10-04/real-integration/model-transition.mjs';

const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw new Error('Pass a stopped real control label');
const directory = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const sourceHash = (await treeSha256(directory)).sha256;
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
if (manifest.activeCallsAtShutdown !== 0 || manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length) throw new Error('Source is not stopped');
const screenshotLabel = process.argv[3] ?? 'quota-recovery';
if (!/^[a-z0-9-]+$/.test(screenshotLabel)) throw new Error('Invalid screenshot label');
const root = resolve('docs/validation/ui-20261005', screenshotLabel);
await mkdir(root, { recursive: true });
const result = { label, checkedAt: new Date().toISOString(), scope: 'Real paused project copied for HTTP/UI recovery messaging only; no content acceptance, new package or human approval implied.', providerCalls: 0, checks: [], pageErrors: [] };
function check(name, pass, details) {
  result.checks.push({ name, pass: Boolean(pass), ...(details === undefined ? {} : { details }) });
  if (!pass) throw new Error(name);
}
const workspace = await mkdtemp(join(tmpdir(), 'pa-quota-ui-'));
const metadata = JSON.parse(await readFile(join(directory, 'project-records/project.json'), 'utf8'));
const project = join(workspace, 'projects', metadata.projectId);
await cp(join(directory, 'project-records'), project, { recursive: true });
const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(workspace));
const runtime = new PlanningRuntime(engine, { async complete() { result.providerCalls++; throw new Error('This check must not invoke a model'); } }, manifest.actualConfig);
const app = createApp({ workspaceRoot: workspace, engine, planningRuntime: runtime, useMockAI: true });
const require = createRequire(resolve('apps/server/package.json'));
app.use(require('express').static(resolve('apps/web/dist')));
app.use((req, res, next) => req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(resolve('apps/web/dist/index.html')) : next());
const server = await new Promise(done => { const listener = app.listen(0, '127.0.0.1', () => done(listener)); });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const opened = await fetch(`${base}/api/projects/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: metadata.projectId }) });
  check('copy-opens-via-formal-http', opened.ok);
  const response = await fetch(`${base}/api/projects/${metadata.projectId}/planning`), view = await response.json();
  check('source-has-real-paused-quota-run', response.ok && view.success && view.data.runs.some(run => run.status === 'paused' && /Individual quota reached/i.test(run.error ?? '')));
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => result.pageErrors.push(String(error)));
  await page.goto(base); await page.waitForLoadState('networkidle');
  await page.getByText(metadata.name, { exact: true }).first().click();
  const notice = page.getByRole('alert').filter({ hasText: 'AI 服务额度已用尽' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('服务预计恢复');
  await expect(notice).toContainText('不是可用保证');
  await expect(notice).toContainText('额度恢复或在 agy 切换账号后');
  await expect(page.getByRole('region', { name: '当前阶段与下一步' })).toContainText('额度暂停');
  check('stage-guidance-prioritizes-recovery', true);
  check('manual-resume-remains-available', await page.getByRole('button', { name: '继续运行', exact: true }).isEnabled());
  const staleCount = view.data.state.changeSets.filter(item => item.status === 'stale').length;
  if (staleCount) {
    const archive = page.locator('.planning-stale-history');
    await expect(archive).toBeVisible();
    check('stale-history-collapsed-by-default', !(await archive.evaluate(element => element.open)));
    check('approved-plan-precedes-stale-history', await page.evaluate(() => Boolean(document.querySelector('.planning-approved').compareDocumentPosition(document.querySelector('.planning-stale-history')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await archive.locator(':scope > summary').click();
    check('all-stale-records-retained', await archive.locator('.planning-stale-entry').count() === staleCount);
    const firstEntry = archive.locator('.planning-stale-entry').first();
    await firstEntry.locator(':scope > summary').click();
    await expect(firstEntry.locator('.planning-changeset')).toBeVisible();
    check('stale-review-actions-unavailable', await archive.getByRole('button', { name: /批准选中分组|拒绝选中分组|让 AI 修订当前草案/ }).count() === 0);
    await firstEntry.locator(':scope > summary').click();
    await archive.locator(':scope > summary').click();
    check('stale-history-can-reclose', !(await archive.evaluate(element => element.open)));
  }
  const message = await notice.locator('p').first().innerText();
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await notice.scrollIntoViewIfNeeded();
    await page.locator('.planning-plan-scroll').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: join(root, `paused-quota-${width}.png`), fullPage: true });
    const resumeBounds = await page.getByRole('button', { name: '继续运行', exact: true }).boundingBox();
    const panelBounds = await page.locator('.planning-conversation-scroll').boundingBox();
    check(`resume-visible-with-error-${width}`, Boolean(resumeBounds && panelBounds && resumeBounds.y >= panelBounds.y && resumeBounds.y + resumeBounds.height <= panelBounds.y + panelBounds.height));
    check(`no-horizontal-overflow-${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check(`notice-fits-panel-${width}`, await notice.evaluate(element => element.scrollWidth <= element.clientWidth));
    check(`reset-estimate-stays-fixed-${width}`, await notice.locator('p').first().innerText() === message);
  }
  await notice.getByText('查看错误记录', { exact: true }).click();
  const rawRecord = await notice.locator('details p').innerText();
  // agy can report quota exhaustion in either a terminal envelope or stderr.
  // Verify the actual stored error verbatim instead of requiring one format.
  check('raw-service-record-retained', rawRecord.length > 0 && view.data.runs.some(run => run.status === 'paused' && /Individual quota reached/i.test(run.error ?? '') && run.error === rawRecord));
  check('raw-record-wraps-in-panel', await notice.evaluate(element => element.scrollWidth <= element.clientWidth));
  check('zero-model-calls', result.providerCalls === 0);
  check('zero-browser-errors', result.pageErrors.length === 0);
  check('source-control-bytes-unchanged', (await treeSha256(directory)).sha256 === sourceHash);
  result.status = 'passed';
} catch (error) { result.status = 'failed'; result.error = String(error); process.exitCode = 1; }
finally {
  if (browser) await browser.close(); await runtime.shutdown(); await new Promise(done => server.close(done));
  result.serverStopped = true;
  await writeFile(join(root, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, providerCalls: result.providerCalls, pageErrors: result.pageErrors, error: result.error, root }));
}
