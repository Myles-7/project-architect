import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root=resolve('docs/validation/agy-2026-10-04/real-integration'),notBefore='2026-10-04T18:51:00.000Z',entries=[
  {mode:'vague',sourceLabel:'flash-vague-quality-20261005-01',nextLabel:'flash-vague-quality-resume-20261005-02'},
  {mode:'materials',sourceLabel:'flash-materials-chinese-resume-20261005-02',nextLabel:'flash-materials-chinese-resume-20261005-03'}
],controls=[];
for(const entry of entries){
  const manifestPath=join(root,entry.sourceLabel,'manifest.json'),bytes=await readFile(manifestPath),manifest=JSON.parse(bytes.toString('utf8'));
  if(manifest.status!=='blocked'||manifest.activeCallsAtShutdown!==0||manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length!==0)throw new Error('Requires frozen quota-blocked source with zero calls and leases');
  try{await access(join(root,entry.nextLabel,'manifest.json'));throw new Error('Prepared next label is already in use');}catch(error){if(error.code!=='ENOENT')throw error;}
  let completedReceipts=0;
  for(const recorded of manifest.runs){const run=JSON.parse(await readFile(join(root,entry.sourceLabel,'project-records','runtime','planning',recorded.id,'run.json'),'utf8'));completedReceipts+=run.tasks.filter(task=>task.status==='completed').length;}
  const quotaReports=manifest.providerCalls.filter(call=>/Individual quota reached/.test(call.error??'')).map(call=>{
    const match=call.error.match(/Resets in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?\./),delay=match?((Number(match[1]??0)*60+Number(match[2]??0))*60+Number(match[3]??0))*1000:null;
    return{requestId:call.requestId,callCompletedAt:call.completedAt,error:call.error,sourceLog:call.logPath,providerReportedDelayMs:delay,estimateFromCallCompletionUTC:delay===null?null:new Date(Date.parse(call.completedAt)+delay).toISOString(),interpretation:'Provider estimate only; call completion can follow the error event and does not guarantee availability'};
  });
  const args=['docs/validation/agy-2026-10-04/real-integration/run-flows.mjs',entry.mode,entry.nextLabel,'gemini-3.8-flash-high','gemini-3.8-flash-high',`resume-from=${entry.sourceLabel}`,'shared-group=flash-m8-20261005'];
  controls.push({...entry,sourceManifestPath:manifestPath,sourceManifestSha256:createHash('sha256').update(bytes).digest('hex'),completedReceiptsToPreserve:completedReceipts,quotaReports,nextArgs:args,actualRetryAtUTC:null});
}
const plan={preparedAtUTC:new Date().toISOString(),notBeforeUTC:notBefore,instruction:'Wait in this same task with each tool wait at most 60 seconds. Do not create persistent automation, call the unchanged unavailable Provider before this instant, switch models, or modify frozen source manifests. At/after notBefore, invoke fresh public resume processes and record actual launch time separately. The Provider reset estimate is not a promise.',status:'waiting-for-authorized-retry-instant',controls};
await writeFile(join(root,'quota-recovery-plan.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({notBeforeUTC:notBefore,controls:controls.map(({quotaReports,nextArgs,...entry})=>entry)}));
