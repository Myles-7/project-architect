import { mkdtemp, cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';
import { createApp } from '../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard, planningBasis } from '../../packages/core/dist/index.js';
import { group, question, result, clarification } from '../../tests/fixtures/planning.mjs';

const phase = process.argv[2] || 'before';
if (!['before','after'].includes(phase)) throw new Error('Expected before or after');
const evidenceLabel = process.argv[3] || phase;
if (!/^[a-z0-9-]+$/.test(evidenceLabel)) throw new Error('Invalid screenshot evidence label');
const directory = resolve('docs/validation/ui-20261005', evidenceLabel); await mkdir(directory, { recursive: true });
const workspace = await mkdtemp(join(tmpdir(), 'pa-visual-review-'));
const source = resolve('docs/validation/agy-2026-10-04/real-integration/flash-materials-final-20261005-02/project-records');
const realMetadata = JSON.parse(await readFile(join(source, 'project.json'), 'utf8'));
await cp(source, join(workspace, 'projects', realMetadata.projectId), { recursive: true });
const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(workspace));
const copies = {};
for (const kind of ['empty','questions','draft','runtime']) copies[kind] = await engine.createProject({ projectId:`proj-visual-${kind}`, name:`界面样本 · ${kind}`, idea:'个人开发笔记工作台，方便保存、查找和导出。' });
const report = {phase, evidenceLabel, checkedAt:new Date().toISOString(), workspace, realSource:source, scope:'Real model-produced frozen copy for approved/materials/history/diagnostics; Core-installed fixtures for questions/draft and deterministic Provider for running/cancel. No real Provider calls.', screenshots:[],checks:[],pageErrors:[]};
let hold = false, unavailable = false;
const provider = {async complete(request) {
  if (unavailable) return {status:'failed',structuredSuccess:false,stderr:'Individual quota reached: deliberate UI recovery fixture',durationMs:1,exitCode:1};
  if (hold) return new Promise(resolveCall => request.abortSignal.addEventListener('abort', () => resolveCall({ status:'cancelled', structuredSuccess:false, durationMs:1, exitCode:0 }), {once:true}));
  return {status:'success',structuredSuccess:true,structuredOutput:result({clarification}),durationMs:1,exitCode:0};
}};
const runtime = new PlanningRuntime(engine, provider, {concurrency:4});
const qSnapshot = copies.questions.snapshot;
const editorQuestion = {...question('notes:editor','q-editor'), question:'编辑笔记时，怎样保存修改？', issueRef:'gap:editor', reason:'保存方式影响操作频率与误修改的恢复体验。', recommendation:'自动保存', recommendationReason:'减少手动操作，并提供撤销与保存状态。', recommendedOptionKey:'auto', options:[
 {key:'auto',label:'自动保存',approach:'输入停止后自动保存，并显示正在保存、已保存或失败。',gain:'减少手动操作，不容易忘记保存。',sacrifice:'误修改也会保存，需要撤销或版本恢复。',impact:'增加防抖、状态展示、冲突恢复和撤销测试。',reversibility:'moderate'},
 {key:'manual',label:'点击保存',approach:'编辑后点击保存；离开前提示未保存修改。',gain:'保存时机明确，实现简单。',sacrifice:'每次修改都需手动操作，可能忘记。',impact:'增加未保存标识与离开提醒。',reversibility:'easy'}]};
await runtime.service.installQuestions(copies.questions.projectPath, planningBasis(qSnapshot), [question('notes:storage','q-local'),editorQuestion], 'visual-questions');
const cs = {id:'change-visual',runId:'run-visual-draft',stage:'product',basis:planningBasis(copies.draft.snapshot),summary:'规划笔记工作台的目标、流程和页面状态。',groups:[group('product')],evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]};
await runtime.service.propose(copies.draft.projectPath,cs);
const app = createApp({workspaceRoot:workspace,engine,planningRuntime:runtime,useMockAI:true});
const require = createRequire(resolve('apps/server/package.json'));
app.use(require('express').static(resolve('apps/web/dist')));
app.use((request,response,next) => request.method==='GET'&&!request.path.startsWith('/api')?response.sendFile(resolve('apps/web/dist/index.html')):next());
const server = await new Promise(resolveServer => { const listener=app.listen(0,'127.0.0.1',()=>resolveServer(listener)); });
const base=`http://127.0.0.1:${server.address().port}`;
for(const metadata of [realMetadata,...Object.values(copies).map(item=>item.snapshot.metadata)]) {
 const response=await fetch(`${base}/api/projects/open`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:metadata.projectId})}); if(!response.ok)throw new Error(`open ${metadata.projectId}: ${await response.text()}`);
}
let browser;
const check=(name, details)=>{report.checks.push({name,passed:true,details});};
try {
 browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:"light"});
 page.on('pageerror',error=>report.pageErrors.push(String(error)));
 const shot=async(name,sourceType='fixture',fullPage=false)=>{
  const badge=page.locator('.planning-pane-heading .planning-badge').first();if(await badge.count())await expect(badge).not.toHaveText('正在读取');
  if(await page.getByText('正在读取项目记录…',{exact:true}).count())await expect(page.getByText('正在读取项目记录…',{exact:true})).toHaveCount(0);
  await page.locator('.planning-conversation-scroll,.planning-plan-scroll').evaluateAll(items=>items.forEach(item=>item.scrollTop=0));
  const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
  await page.screenshot({path:join(directory,`${name}.png`),fullPage,animations:'disabled'});report.screenshots.push({name,sourceType,theme:await page.locator('html').getAttribute('class'),viewport:page.viewportSize(),layout});
 };
 const home=async()=>{const button=page.getByRole('button',{name:'返回项目首页',exact:true});if(await button.count())await button.click();else if (!(await page.locator("#idea-input").count())) await page.goto(base);await expect(page.locator('#idea-input')).toBeVisible();};
 const open=async(name)=>{await home();await page.getByRole('button',{name:/活跃 \(/}).click();await page.getByText(name,{exact:true}).first().click();await expect(page.getByRole('region',{name:'当前方案与变更包'})).toBeVisible();};
 const nav=async(name)=>page.getByRole('navigation',{name:'工作台主导航',exact:true}).getByRole('button',{name,exact:true}).click();
 await page.goto(base);await expect(page.locator('#idea-input')).toBeVisible(); await shot('01-home','mixed');
 await open(copies.empty.snapshot.metadata.name);await shot('02-empty-workspace');
 await open(copies.questions.snapshot.metadata.name);await expect(page.getByRole('region',{name:'待回答的问题'})).toBeVisible();
 const composer=page.locator('.planning-composer textarea');await composer.fill('切换材料后仍需保留的构思');
 await page.locator('.planning-question').first().getByRole('radio').first().check();
 await page.locator('.planning-question').nth(1).getByRole('button',{name:'自定义答案',exact:true}).click();
 await page.locator('.planning-question').nth(1).getByRole('textbox').fill('我的自定义编辑偏好'); await shot('03-questions');
 await nav('材料');await expect(page.getByRole('heading',{name:/输入材料与附件/})).toBeVisible();await nav('规划工作台');
 await expect(composer).toHaveValue('切换材料后仍需保留的构思');await expect(page.locator('.planning-question').first().getByRole('radio').first()).toBeChecked();await expect(page.locator('.planning-question').nth(1).getByRole('textbox')).toHaveValue('我的自定义编辑偏好');check('navigation-keeps-composer-and-batch-answers');
 await home();await open(copies.questions.snapshot.metadata.name);await expect(composer).toHaveValue('切换材料后仍需保留的构思');check('home-and-reopen-keeps-session-drafts');
 await open(copies.draft.snapshot.metadata.name);await expect(page.getByRole('button',{name:'编辑草案',exact:true})).toBeVisible(); await shot('04-draft-review');
 await expect(page.getByRole('textbox',{name:'草案修订反馈',exact:true})).toBeHidden();await expect(page.locator('.planning-block-diff').first()).toBeInViewport();check('draft-body-before-feedback-input');
 await page.locator('.planning-block-diff').nth(4).scrollIntoViewIfNeeded();
 const reviewBar=await page.locator('.planning-review-toolbar').boundingBox();const planPane=await page.locator('.planning-plan-scroll').boundingBox();expect(reviewBar.y).toBeGreaterThanOrEqual(planPane.y-1);expect(reviewBar.y+reviewBar.height).toBeLessThan(page.viewportSize().height);check('review-actions-stay-in-reading-pane');
 await page.locator('.planning-draft-feedback > summary').click();await page.getByRole('textbox',{name:'草案修订反馈',exact:true}).fill('保留这份反馈');
 await page.locator('.planning-draft-feedback > summary').click();await nav('历史');await nav('规划工作台');await expect(page.getByRole('textbox',{name:'草案修订反馈',exact:true})).toBeHidden();await page.locator('.planning-draft-feedback > summary').click();await expect(page.getByRole('textbox',{name:'草案修订反馈',exact:true})).toHaveValue('保留这份反馈');check('collapsed-feedback-keeps-input-and-state-after-navigation');
 await page.getByRole('button',{name:'编辑草案',exact:true}).click();await page.getByRole('textbox',{name:'草案内容',exact:true}).first().fill('保留我正在修改的草案');await shot('05-draft-editor');
 await nav('历史');await nav('规划工作台');await expect(page.getByRole('textbox',{name:'草案内容',exact:true}).first()).toHaveValue('保留我正在修改的草案');await expect(page.getByRole('textbox',{name:'草案修订反馈',exact:true})).toHaveValue('保留这份反馈');check('navigation-keeps-block-edit-and-revision-feedback');
 const snapshot=await runtime.service.get(copies.draft.projectPath);const groups=structuredClone(cs.groups);groups[0].blocks[0].content='其他操作更新的服务端草案';
 await runtime.service.edit(copies.draft.projectPath,cs.id,groups,snapshot.metadata.stateRevision,'visual-external-edit');
 await expect(page.getByText('草案编辑发生冲突',{exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'草案内容',exact:true}).first()).toHaveValue('保留我正在修改的草案');await shot('06-preserved-edit-conflict');check('remote-edit-conflict-preserves-local-input');
 await open(realMetadata.name);await expect(page.locator('.planning-approved > details').first()).toBeVisible();for(const detail of await page.locator('.planning-approved > details').all())await detail.locator('summary').first().click();await shot('07-approved-long-plan','real-model');
 const realState=await runtime.service.get(join(workspace,'projects',realMetadata.projectId));const realBlocks=realState.planning.blueprint.blocks;
 await page.getByRole('link',{name:'开发包',exact:true}).click();await expect(page.locator('#planning-package')).toBeInViewport();await expect(page.locator('#planning-package')).toBeFocused();await page.screenshot({path:join(directory,'25-development-package-anchor.png'),animations:'disabled'});report.screenshots.push({name:'25-development-package-anchor',sourceType:'real-model',theme:await page.locator('html').getAttribute('class'),viewport:page.viewportSize(),layout:await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}))});check('development-package-anchor-reaches-and-focuses-delivery');
 await page.getByRole('navigation',{name:'方案阶段筛选',exact:true}).getByRole('button',{name:'技术与接口',exact:true}).click();await expect(page.locator('.planning-approved > details')).toHaveCount(realBlocks.filter(block=>block.stage==='technical').length);
 const sought=realBlocks.find(block=>block.stage==='technical');await page.getByRole('searchbox',{name:'查找方案内容',exact:true}).fill(sought.title);await expect(page.locator('.planning-approved > details').first().locator('summary')).toContainText(sought.title);check('approved-plan-stage-filter-and-search');
 await page.getByRole('searchbox',{name:'查找方案内容',exact:true}).fill('不存在的方案关键词-a391');await expect(page.getByText('没有匹配的区块，试试其他关键词或阶段。',{exact:true})).toBeVisible();await page.getByRole('searchbox',{name:'查找方案内容',exact:true}).fill('');await page.getByRole('navigation',{name:'方案阶段筛选',exact:true}).getByRole('button',{name:'全部',exact:true}).click();await expect(page.locator('.planning-approved > details')).toHaveCount(realBlocks.length);
 await nav('材料');await shot('08-materials','real-model');
 const upload=page.getByRole('button',{name:/上传材料|添加材料/}).first();if(await upload.count()){await upload.click();await shot('09-upload-drawer','real-model');await page.getByRole('button',{name:/关闭弹窗|取消/}).first().click();}
 const urls=[];page.on('request',request=>{if(request.url().includes('/api/'))urls.push(new URL(request.url()).pathname);});
 await nav('历史');await expect(page.getByRole('heading',{name:'每次构思，都有来处'})).toBeVisible();await shot('10-history','real-model');
 await nav('诊断');await expect(page.getByRole('heading',{name:'运行信息，有据可查'})).toBeVisible();await expect(page.getByRole('heading',{name:'项目目录',exact:true})).toBeVisible();await shot('11-diagnostics','real-model');
 await page.getByText('高级运行设置 · 整个工作区共用',{exact:true}).click();await shot('12-advanced-settings','real-model');
 const baseline=urls.length;await page.waitForTimeout(2300);expect(urls.slice(baseline).some(url=>url.endsWith('/planning')||url===`/api/projects/${realMetadata.projectId}`)).toBe(false);check('diagnostics-no-hidden-workbench-polling',urls.slice(baseline));
 await page.getByRole('button',{name:"切换界面主题"}).first().click();await shot('13-alternate-theme-diagnostics','real-model');
 const buttonContrast=await page.locator('.planning-diagnostics .planning-button').evaluateAll(buttons=>{
  const luminance=value=>{const components=value.match(/[\d.]+/g).slice(0,3).map(Number).map(component=>{const channel=component/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});return .2126*components[0]+.7152*components[1]+.0722*components[2];};
  return buttons.filter(button=>!button.disabled&&button.getBoundingClientRect().bottom>0&&button.getBoundingClientRect().top<innerHeight).map(button=>{const style=getComputedStyle(button),foreground=luminance(style.color),background=luminance(style.backgroundColor);return{label:button.textContent.trim(),foreground:style.color,background:style.backgroundColor,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};});
 });expect(buttonContrast.length).toBeGreaterThanOrEqual(3);for(const button of buttonContrast)expect(button.contrast,button.label).toBeGreaterThanOrEqual(4.5);check('alternate-theme-diagnostics-button-contrast',buttonContrast);
 await nav('规划工作台');await shot('14-alternate-theme-workbench','real-model');
 // Desktop is the requested target. Keep existing mobile behavior outside
 // this visual optimization pass.
 await page.setViewportSize({width:1280,height:900});await shot('15-compact-desktop-workbench','real-model');
 await page.getByRole('button',{name:'专注阅读方案',exact:true}).click();await expect(page.locator('.planning-conversation')).toBeHidden();await shot('16-focused-plan','real-model');check('focused-plan-expands-reading-pane');
 await page.getByRole('button',{name:'返回双栏',exact:true}).click();
 await page.setViewportSize({width:1920,height:1080});await shot('21-wide-desktop-workbench','real-model');
 await page.setViewportSize({width:1440,height:1000});await home();await shot('17-alternate-theme-home','mixed');
 await open(copies.runtime.snapshot.metadata.name);let initial=await runtime.service.get(copies.runtime.projectPath);const run=await runtime.start(copies.runtime.projectPath,{stage:'clarify',expectedRevision:initial.metadata.stateRevision,operationId:'visual-clarify'});while((await runtime.get(copies.runtime.projectPath,run.id)).status==='running'||(await runtime.get(copies.runtime.projectPath,run.id)).status==='queued')await new Promise(resolveWait=>setTimeout(resolveWait,30));
 initial=await runtime.service.get(copies.runtime.projectPath);hold=true;const active=await runtime.start(copies.runtime.projectPath,{stage:'product',expectedRevision:initial.metadata.stateRevision,operationId:'visual-running'});await expect(page.getByRole('button',{name:'取消运行',exact:true})).toBeVisible();await shot('18-running-state');await page.getByRole('button',{name:'取消运行',exact:true}).click();await expect(page.getByRole('button',{name:'基于当前状态重新运行',exact:true})).toBeVisible();await shot('19-cancelled-state');check('visible-cancel-and-restart');
 await home();const row=page.getByText(copies.empty.snapshot.metadata.name,{exact:true}).first().locator('xpath=ancestor::*[@role="button"][1]');await row.locator('.project-actions-popover > summary').click();const trash=row.getByRole('button',{name:'删除项目',exact:true});await expect(trash).toBeVisible();await trash.click();await page.getByRole('button',{name:'移入回收站',exact:true}).last().click();await page.getByRole('button',{name:/回收站 \(/}).click();await expect(page.getByText(copies.empty.snapshot.metadata.name,{exact:true})).toBeVisible();await shot('20-recycle-bin');await page.getByRole('button',{name:/还原项目/}).first().click();check('project-trash-and-restore');
 await open(copies.empty.snapshot.metadata.name);hold=false;unavailable=true;const retrySnapshot=await runtime.service.get(copies.empty.projectPath);const paused=await runtime.start(copies.empty.projectPath,{stage:'clarify',expectedRevision:retrySnapshot.metadata.stateRevision,operationId:'visual-unavailable'});
 await expect(page.getByRole('button',{name:'继续运行',exact:true})).toBeVisible();await shot('22-provider-unavailable');unavailable=false;await page.getByRole('button',{name:'继续运行',exact:true}).click();await expect.poll(async()=>(await runtime.get(copies.empty.projectPath,paused.id)).status).toBe('reviewable');await expect(page.getByRole('button',{name:'继续运行',exact:true})).toHaveCount(0);check('provider-pause-and-resume');
 await home();await page.route(`**/api/projects/${copies.empty.snapshot.metadata.projectId}/planning`,route=>route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":null}'}));await open(copies.empty.snapshot.metadata.name);await expect(page.getByRole('button',{name:'重新读取状态',exact:true})).toBeVisible();await shot('23-invalid-response-recovery');await page.unroute(`**/api/projects/${copies.empty.snapshot.metadata.projectId}/planning`);await page.getByRole('button',{name:'重新读取状态',exact:true}).click();await expect(page.getByRole('button',{name:'重新读取状态',exact:true})).toHaveCount(0);check('invalid-api-response-shows-recovery');
 await open(realMetadata.name);const inputBase=await runtime.service.get(join(workspace,'projects',realMetadata.projectId));await runtime.service.recordInput(join(workspace,'projects',realMetadata.projectId),'UI fixture: changed planning basis; new analysis is required.',inputBase.metadata.stateRevision,'visual-package-stale','feedback');await expect(page.getByRole('link',{name:'下载开发包 ZIP',exact:true})).toHaveCount(0);await expect(page.getByText(/当前开发包|重新生成后再预览|需要重新生成/).first()).toBeVisible();await shot('24-stale-package','fixture-on-real-copy');check('stale-package-hides-download-and-preview');
 expect(report.pageErrors).toEqual([]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}finally{await browser?.close();await runtime.shutdown();server.closeAllConnections();await new Promise(done=>server.close(done));await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
