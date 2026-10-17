import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label??''))throw new Error('Evidence label required');
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label);
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
if(!manifest.completedAt)throw new Error('Only frozen completed controls can be diagnosed');
const runs=[];
for(const recorded of manifest.runs){
  const directory=join(root,'project-records','runtime','planning',recorded.id);
  const run=JSON.parse(await readFile(join(directory,'run.json'),'utf8'));
  const outputs=[];
  for(const task of run.tasks){
    if(!task.outputRef)continue;
    const resultBytes=await readFile(join(directory,task.outputRef));
    const result=JSON.parse(resultBytes.toString('utf8'));
    outputs.push({taskId:task.id,kind:task.kind,goal:task.goal,resultByteSha256:createHash('sha256').update(resultBytes).digest('hex'),blockers:result.blockers,questions:result.questions.map(q=>q.decisionKey),followUp:result.followUp,summary:result.summary,evidence:result.evidence.map(e=>({id:e.id,kind:e.kind,outcome:e.outcome,source:e.source,hash:e.hash}))});
  }
  let tools=[];
  try{tools=(await readFile(join(directory,'tools','evidence','tool-events.ndjson'),'utf8')).split('\n').filter(Boolean).map(JSON.parse);}catch(error){if(error.code!=='ENOENT')throw error;}
  runs.push({id:run.id,stage:run.stage,status:run.status,error:run.error,tasks:run.tasks.map(t=>({id:t.id,kind:t.kind,goal:t.goal,status:t.status,attempts:t.attempts,startedAt:t.startedAt,completedAt:t.completedAt})),outputs,environmentPreparations:tools.filter(e=>e.action==='environment_prepare'),experiments:tools.filter(e=>e.action==='experiment_run')});
}
const diagnostic={label,controlStatus:manifest.status,acceptedAsSuccessfulControl:manifest.status==='completed'&&manifest.checks.every(c=>c.pass),controllerStop:manifest.controllerStop,productionDistHashes:manifest.productionDistHashes,migration:manifest.migration,providerCalls:manifest.providerCalls.length,actualModels:[...new Set(manifest.providerCalls.map(c=>c.model))],maxActiveCalls:manifest.maxActiveCalls,activeCallsAtShutdown:manifest.activeCallsAtShutdown,simulatedAnswerBatches:manifest.answers.length,automatedApprovals:manifest.approvals.length,packages:manifest.packages.length,failedAssertions:manifest.checks.filter(c=>!c.pass),runs};
await writeFile(join(root,'control-history-diagnostic.json'),JSON.stringify(diagnostic,null,2));
console.log(JSON.stringify({label,status:diagnostic.controlStatus,runs:runs.map(r=>({stage:r.stage,status:r.status,tasks:r.tasks.length,completedOutputs:r.outputs.length,unavailablePreparations:r.environmentPreparations.filter(e=>e.details?.status==='unavailable').length})),providerCalls:diagnostic.providerCalls,automatedApprovals:diagnostic.automatedApprovals,packages:diagnostic.packages,activeCallsAtShutdown:diagnostic.activeCallsAtShutdown}));
