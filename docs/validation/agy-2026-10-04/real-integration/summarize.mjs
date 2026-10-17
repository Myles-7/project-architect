import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('docs/validation/agy-2026-10-04/real-integration');
const runs=[];const calls=[];
for(const mode of ['chinese','vague','materials']){
  const m=JSON.parse(await readFile(join(root,mode,'manifest.json'),'utf8'));
  for(const ref of m.runs){const p=join(root,mode,'project-records','runtime','planning',ref.id);const r=JSON.parse(await readFile(join(p,'run.json'),'utf8'));
    runs.push({mode,id:r.id,status:r.status,error:r.error,tasks:r.tasks.map(t=>({id:t.id,kind:t.kind,status:t.status,attempts:t.attempts})),simulatedAnswerBatches:m.answers.length,apiAutomatedApprovals:m.approvals.length,checks:m.checks});
    for(const t of r.tasks){const dir=join(p,'tasks',t.id);for(const name of await readdir(dir)){if(/^call-\d+\.json$/.test(name)){const c=JSON.parse(await readFile(join(dir,name),'utf8'));calls.push({mode,runId:r.id,taskId:t.id,...c});}}}
  }
}
const materialManifest=JSON.parse(await readFile(join(root,'materials','manifest.json'),'utf8'));
const mp=join(root,'materials','project-records','runtime','planning',materialManifest.runs[0].id);
const record=JSON.parse(await readFile(join(mp,'tools','evidence','evidence-f0ddcd3e-c4d2-4327-bfb7-8bb1555bd240.json'),'utf8'));
const actualImage=await readFile(join(root,'materials','project-records',materialManifest.image.ref.storageRef));
const imagePath=join(materialManifest.path,materialManifest.image.ref.storageRef);
const taskStream=(await readFile(join(mp,'tasks','task-171344fc-c3e0-411f-b66c-bd33dfe86daf','call-1.ndjson'),'utf8')).split('\n').filter(Boolean).map(JSON.parse).filter(e=>e.stream==='stdout').flatMap(e=>e.data.split('\n').filter(Boolean).flatMap(s=>{try{return [JSON.parse(s)];}catch{return [];}}));
const view=taskStream.find(e=>e.step_update?.tool_name==='view_file'&&e.step_update.state==='DONE'&&e.step_update.tool_info?.parameters?.AbsolutePath===imagePath);
const imageCheck={actualRegisteredOriginalViewerSucceeded:!!view,originalHashMatches:createHash('sha256').update(actualImage).digest('hex')===materialManifest.image.sha256,randomTextExact:record.content.includes('Q7M4-8261'),leftBlueRectangle:/左侧.*蓝色矩形/.test(record.content),rightOrangeRedCircle:/右侧.*红橙色.*圆形/.test(record.content),candidateEvidenceRecorded:record.status==='candidate'||record.approval==='candidate',evidenceId:record.id,proposalCompleted:false};
await writeFile(join(root,'materials','vision-diagnostic-validation.json'),JSON.stringify(imageCheck,null,2));
const summary={at:new Date().toISOString(),hostNode:'v24.19.0',scope:'Real integration with installed AGY and production dist. No mocks and no product source/build edits by validation worker.',runs,calls,actualPlanningProviderCalls:calls.length,actualIndependentHtmlProviderCalls:2,visionDiagnostic:imageCheck,htmlFailedControl:JSON.parse(await readFile(join(root,'html-research','diagnostic-evidence-validation.json'),'utf8')),htmlCurrentBuild:JSON.parse(await readFile(join(root,'html-research-v2','diagnostic-evidence-validation.json'),'utf8')),limitations:['Default Opus external quota exhausted. Full three-stage flow, compiled real-model package and approved-requirement feedback remain unexecuted.','Scripted answers are simulated user input; no actual human approval occurred.','Earlier HTML terminal ERROR is rejected despite candidate evidence; the new build has a separate actual terminal SUCCESS.','No default-model downgrade or hidden provider fallback.']};
await writeFile(join(root,'validation-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({actualPlanningProviderCalls:summary.actualPlanningProviderCalls,actualIndependentHtmlProviderCalls:summary.actualIndependentHtmlProviderCalls,runs:runs.map(r=>({mode:r.mode,status:r.status})),visionDiagnostic:imageCheck,htmlCurrentBuild:summary.htmlCurrentBuild},null,2));
