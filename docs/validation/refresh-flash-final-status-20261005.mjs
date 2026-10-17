import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';

const root=resolve('docs/validation');
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const summary=await read('refactor-summary.json');
const labels=process.argv.slice(2,4);
const verificationTag=process.argv[4]??'walltime';
const pausedUiNames=process.argv.slice(5);
if(!/^[a-z0-9-]+$/.test(verificationTag)||pausedUiNames.length!==0&&pausedUiNames.length!==2||pausedUiNames.some(name=>!/^[a-z0-9-]+$/.test(name)))throw new Error('Optional verification tag and two UI report directories must be valid');
if(labels.length!==2||labels.some(label=>!/^[a-z0-9-]+$/.test(label)))throw new Error('Both final Flash control labels required');
const probes=[];
for(const entry of await readdir(join(root,'agy-2026-10-04/account-probes'),{withFileTypes:true})){
  if(!entry.isDirectory()||!entry.name.startsWith('gemini-3.8-flash-high-'))continue;
  const path=`agy-2026-10-04/account-probes/${entry.name}/result.json`;
  try{const result=await read(path);if(result.model==='gemini-3.8-flash-high'&&Number.isFinite(Date.parse(result.checkedAt)))probes.push({path,result});}catch(error){if(error.code!=='ENOENT')throw error;}
}
probes.sort((a,b)=>Date.parse(b.result.checkedAt)-Date.parse(a.result.checkedAt));
if(!probes.length)throw new Error('A real Flash availability probe is required');
const {path:probePath,result:probe}=probes[0];
const records=[];
for(const label of labels){
  const path=`agy-2026-10-04/real-integration/${label}/manifest.json`;
  const manifest=await read(path);
  if(manifest.actualConfig.designModel!=='gemini-3.8-flash-high'||manifest.actualConfig.reviewModel!=='gemini-3.8-flash-high')throw new Error('Unexpected model configuration');
  let review=null;
  try{review=await read(`agy-2026-10-04/real-integration/${label}/independent-content-review.json`);}catch(error){if(error.code!=='ENOENT')throw error;}
  const delivery={};
  for(const [key,name] of Object.entries({package:'package-artifact-verification.json',ui:'real-ui-verification.json',receipts:'preserved-receipts-verification.json',visibleContext:'final-visible-context-verification.json'})){
    try{const report=await read(`agy-2026-10-04/real-integration/${label}/${name}`);delivery[key]={status:report.status,report:`agy-2026-10-04/real-integration/${label}/${name}`};}catch(error){if(error.code!=='ENOENT')throw error;delivery[key]={status:'pending'};}
  }
  records.push({label,manifest:path,status:manifest.status??'running',error:manifest.error??null,startedAt:manifest.startedAt,completedAt:manifest.completedAt??null,newProviderCalls:manifest.providerCalls.length,successfulNewProviderCalls:manifest.providerCalls.filter(call=>call.structuredSuccess).length,activeActualCalls:manifest.providerCalls.filter(call=>!call.completedAt).length,newApprovals:manifest.approvals.length,newPackages:manifest.packages.filter(pkg=>!pkg.inheritedFrom).length,configuration:manifest.actualConfig,contentReviewStatus:review?.status??'pending',contentReviewPassed:review?.contentPassed??null,delivery,activeCallsAtShutdown:manifest.activeCallsAtShutdown??null,ownedLeasesAtShutdown:manifest.sharedProviderSlots?.ownedLeasesAtShutdown??null});
}
summary.previousQuotaBlockedControls??={controls:summary.currentRealControls,status:summary.realFullFlow,availability:summary.latestGeminiAvailability};
summary.currentRealControls=records.map(record=>record.manifest);
summary.realControlStatus={controls:records,activeActualCalls:records.reduce((count,record)=>count+record.activeActualCalls,0),allControlsStopped:records.every(record=>record.activeCallsAtShutdown===0&&!record.ownedLeasesAtShutdown?.length)};
summary.latestGeminiAvailability={checkedAtUTC:probe.checkedAt,checkedAtAsiaShanghai:new Date(probe.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),status:probe.structuredSuccess&&probe.status==='success'?'actual_structured_flash_call_passed':/Individual quota reached/i.test(probe.stderr??'')?'quota_blocked_actual_call':'actual_structured_flash_call_failed',model:probe.model,probe:probePath,planningQualityProvenByProbe:false};
// A successful short probe cannot overrule a later genuine planning failure.
const currentCalls = [];
for (const record of records) {
  const manifest = await read(record.manifest);
  for (const call of manifest.providerCalls.filter(call => call.completedAt && call.model === 'gemini-3.8-flash-high')) currentCalls.push({ ...call, manifest: record.manifest });
}
currentCalls.sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
const latestCall = currentCalls[0];
if (latestCall && Date.parse(latestCall.completedAt) > Date.parse(probe.checkedAt)) {
  summary.latestGeminiAvailability = {
    checkedAtUTC: latestCall.completedAt,
    checkedAtAsiaShanghai: new Date(latestCall.completedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),
    status: /Individual quota reached/i.test(latestCall.error ?? '') ? 'quota_blocked_actual_call' : latestCall.structuredSuccess ? 'actual_structured_flash_call_passed' : 'actual_structured_flash_call_failed',
    model: latestCall.model, manifest: latestCall.manifest, requestId: latestCall.requestId,
    error: latestCall.error ?? null, logPath: latestCall.logPath,
    scope: 'Latest actual completed planning invocation; earlier successful short probe remains historical.',
    earlierProbe: probePath, planningQualityProvenByProbe: false,
  };
}
summary.availabilityProbes=[...new Set([...summary.availabilityProbes,probePath])];
const semanticPassed=records.every(record=>record.status==='completed'&&record.contentReviewStatus==='passed'&&record.contentReviewPassed===true);
const blocked=records.some(record=>['failed','blocked'].includes(record.status));
summary.realFullFlow=semanticPassed?'real_flash_content_passed_final_delivery_checks_pending':blocked?'real_flash_final_quality_control_needs_repair':'running_final_quality_repair_flash';
if(blocked&&summary.latestGeminiAvailability.status==='quota_blocked_actual_call')summary.realFullFlow='paused_final_quality_repair_quota';
summary.realContentQuality=semanticPassed?'independent_cross_contract_review_passed':'pending_final_real_feedback_packages_and_independent_review';
summary.humanReview='pending';
const slotReport='agy-2026-10-04/real-integration/global-provider-slots/flash-m8-recovered-20261005-02/shared-provider-verification.json',slots=await read(slotReport);
if(slots.status!=='passed'||slots.controls.some(control=>control.activeCallsAtShutdown!==0||control.ownedLeasesAtShutdown?.length))throw new Error('Shared-slot stop verification is not green');
summary.sharedProviderSlots={group:'flash-m8-recovered-20261005-02',status:slots.status,peak:slots.maxConcurrentCalls,checks:slots.checks.length,controls:slots.controls.length,report:slotReport,includesCurrentControls:labels.every(label=>slots.controls.some(control=>control.label===label)),scope:'Frozen stop verification for the controls named in its report; proves call tracing, capacity and release only, not content quality. Active newer controls require a fresh stopped verification.'};
const localReport=`refactor-vitest-${verificationTag}-20261005.json`;
const local=await read(localReport);
if(!local.success||local.numFailedTests||local.numPendingTests)throw new Error('Latest batch transport source regression is not green');
summary.vitest={files:local.testResults.length,total:local.numTotalTests,passed:local.numPassedTests,failed:local.numFailedTests,skipped:local.numPendingTests,report:localReport,scope:'All permanent tests for the selected verified source revision; actual report counts. Does not prove AI content quality.'};
const buildReport=`refactor-build-${verificationTag}-20261005.txt`,schemaReport=`schema-${verificationTag}-20261005.txt`,browserReport=`playwright-${verificationTag}-20261005.txt`;
const build=await readFile(join(root,buildReport),'utf8'),schema=await readFile(join(root,schemaReport),'utf8'),browser=await readFile(join(root,browserReport),'utf8');
if(!build.includes('apps/server build: Done')||!build.includes('apps/web build: Done')||!schema.includes('Shared task schema and B3 JSON match.')||!browser.includes('4 passed'))throw new Error('Latest production verification logs are incomplete');
summary.build='passed';summary.schema='passed';summary.buildReport=buildReport;summary.schemaReport=schemaReport;
summary.playwright={passed:4,provider:'FixturePlanningProvider',report:browserReport};
const batchPath='agy-2026-10-04/real-integration/flash-context-batch-real-20261005-02/result.json',batch=await read(batchPath);
if(batch.status!=='passed'||batch.missingMandatoryVisibleRanges.length||batch.missingRequiredReads.length)throw new Error('Complete real batch visibility proof required');
summary.realBatchContext={status:batch.status,model:batch.model,report:batchPath,requiredEntries:batch.requiredEntries,scanCalls:batch.scanCalls,missingVisibleRanges:0,missingLedgerReads:0,totalFrozenUtf8Bytes:batch.totalFrozenUtf8Bytes,scope:batch.scope};
const quotaUi=await read('ui-20261005/quota-recovery-final/report.json');
if(quotaUi.status!=='passed'||quotaUi.providerCalls!==0||quotaUi.pageErrors.length||!quotaUi.serverStopped)throw new Error('Final quota recovery UI verification is not green');
summary.quotaRecoveryUi={status:quotaUi.status,checks:quotaUi.checks.length,providerCalls:0,report:'ui-20261005/quota-recovery-final/report.json',screenshots:3,scope:quotaUi.scope};
summary.currentPausedUi = [];
for (const name of pausedUiNames.length?pausedUiNames:['actual-paused-notes-09-walltime','actual-paused-materials-09-walltime']) {
  const path = `ui-20261005/${name}/report.json`, report = await read(path);
  if (report.status !== 'passed' || report.providerCalls || report.pageErrors.length || !report.serverStopped) throw new Error('Latest genuine paused-project UI verification is not green');
  summary.currentPausedUi.push({ report: path, label: report.label, checks: report.checks.length, screenshots: 3, scope: report.scope });
}
summary.pendingContentPrecheck={notes:'pending-content-recheck-20261005/notes-report.json',materials:'pending-content-recheck-20261005/materials-report.json',observations:'pending-content-recheck-20261005/OBSERVATIONS.md',isFinalContentAcceptance:false};
summary.currentContentReviews=records.map(record=>({label:record.label,report:`agy-2026-10-04/real-integration/${record.label}/independent-content-review.json`,status:record.contentReviewStatus,contentPassed:record.contentReviewPassed,isFinalContentAcceptance:record.contentReviewPassed===true&&record.contentReviewStatus==='passed'}));
summary.latestLocalVerificationScope=`Selected current build and Schema plus ${local.testResults.length} files/${local.numPassedTests} tests and four browser flows. Previous desktop 25 screenshots/17 checks retain their UI scope; both selected genuine paused projects passed ${summary.currentPausedUi.reduce((total,item)=>total+item.checks,0)} recovery checks with six screenshots. Visual inspection is recorded separately. Final real-package screenshots are still pending. This refresh reads evidence and does not rerun tests.`;
const finalDeliveryPassed=semanticPassed&&records.every(record=>Object.values(record.delivery).every(check=>check.status==='passed'))&&summary.sharedProviderSlots.includesCurrentControls&&summary.realControlStatus.allControlsStopped;
if(finalDeliveryPassed){summary.realFullFlow='real_flash_final_content_and_delivery_passed_human_review_pending';summary.latestLocalVerificationScope=summary.latestLocalVerificationScope.replace('Final real-package screenshots are still pending.','Both final genuine packages passed HTTP/browser preview and ZIP download checks; human review remains pending.');}
summary.updatedAtUTC=new Date().toISOString();
await writeFile(join(root,'refactor-summary.json'),`${JSON.stringify(summary,null,2)}\n`);
console.log(JSON.stringify({realFullFlow:summary.realFullFlow,controls:records.map(({label,status,newProviderCalls,successfulNewProviderCalls,activeActualCalls,contentReviewStatus})=>({label,status,newProviderCalls,successfulNewProviderCalls,activeActualCalls,contentReviewStatus}))}));
