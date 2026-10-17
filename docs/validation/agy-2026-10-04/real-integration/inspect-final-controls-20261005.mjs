import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { planningContextReadIssues } from '../../../../packages/agent/dist/tools/PlanningContextAccess.js';
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
for (const label of process.argv.slice(2)) {
  const directory = join(root,label);
  const manifest = JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  const activeCall=manifest.providerCalls.find(call=>!call.completedAt);
  const runId = activeCall?.cwd?.match(/[/\\](run-[a-z0-9-]+)[/\\]tasks[/\\]/)?.[1] ?? manifest.runs.at(-1)?.id ?? manifest.qualityFeedback?.runId;
  let run;
  try { run = JSON.parse(await readFile(join(manifest.path,'runtime','planning',runId,'run.json'),'utf8')); } catch {}
  const tasks = run?.tasks ?? [];
  const counts = tasks.reduce((result, task) => { const key = `${task.kind}:${task.status}`; result[key] = (result[key]??0)+1; return result; },{});
  const outputs=[];
  for(const task of tasks.filter(task=>task.status==='completed' && ['review','revision','integration'].includes(task.kind)).slice(-3)) {
    try { const output=JSON.parse(await readFile(join(manifest.path,'runtime','planning',runId,task.outputRef),'utf8'));outputs.push({id:task.id,kind:task.kind,blockerCount:output.blockers?.length,blockers:output.blockers?.slice(0,3).map(value=>value.slice(0,220)),groups:output.groups?.length}); } catch {}
  }
  const progress=[];
  for(const call of manifest.providerCalls.filter(call=>!call.completedAt)) {
    try {const info=await stat(call.logPath);const raw=await readFile(call.logPath,'utf8');const actions=[];for(const line of raw.split('\n').filter(Boolean)){let chunk;try{chunk=JSON.parse(line);}catch{continue;}if(chunk.stream!=='stdout')continue;for(const part of chunk.data.split('\n').filter(Boolean)){let event;try{event=JSON.parse(part);}catch{continue;}if(event.step_update)actions.push({tool:event.step_update.tool_name,state:event.step_update.state});}}let mandatoryReadLedger;try{const config=JSON.parse(await readFile(join(call.cwd,'.agents','planning-tools.json'),'utf8'));if(config.contextAccess?.requiredKeys.length)mandatoryReadLedger={requiredRecords:config.contextAccess.requiredKeys.length,missingRecords:planningContextReadIssues(config.contextAccess).length,scope:'Ledger coverage only; not semantic comprehension or final visible-stream acceptance'};}catch{}progress.push({requestId:call.requestId,bytes:info.size,lastWriteUTC:info.mtime.toISOString(),lastActions:actions.slice(-2),mandatoryReadLedger});} catch {}
  }
  console.log(JSON.stringify({label,controlStatus:manifest.status??'running',runId,runStatus:run?.status,taskCounts:counts,newCalls:manifest.providerCalls.length,callStatuses:manifest.providerCalls.reduce((result,call)=>{const key=call.status??'running'; result[key]=(result[key]??0)+1;return result;},{}),activeTasks:tasks.filter(task=>task.status==='running').map(task=>({id:task.id,kind:task.kind,goalExcerpt:task.goal.slice(0,120),attempts:task.attempts})),error:manifest.error,latestOutputs:outputs,progress,newApprovals:manifest.approvals.length,newPackages:manifest.packages.filter(record=>!record.inheritedFrom).length}));
}
