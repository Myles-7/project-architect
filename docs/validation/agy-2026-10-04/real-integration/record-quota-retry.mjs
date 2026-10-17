import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root=resolve('docs/validation/agy-2026-10-04/real-integration'),path=join(root,'quota-recovery-plan.json'),plan=JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
for(const control of plan.controls){
  const manifest=JSON.parse(await readFile(join(root,control.nextLabel,'manifest.json'),'utf8'));
  control.controllerProcessStartedAtUTC=manifest.startedAt;control.activeControlStatus=manifest.status??'running';control.actualCallsRecorded=manifest.providerCalls.length;
  const call=manifest.providerCalls[0];control.observedProviderStartedAtUTC=call?.startedAt??null;
  let invocation;
  if(call)for(const line of (await readFile(call.logPath,'utf8')).split('\n').filter(Boolean)){const envelope=JSON.parse(line);if(envelope.stream==='invocation'){invocation=envelope;break;}}
  control.actualRetryAtUTC=invocation?.at??null;control.actualCLIArgs=invocation?.data?.args??null;control.inputObservation=call?.inputObservation??null;
  if(control.actualRetryAtUTC&&Date.parse(control.actualRetryAtUTC)<Date.parse(plan.notBeforeUTC))throw new Error('Actual CLI invocation preceded authorized retry instant');
}
plan.status='public-resume-records-observed';plan.lastObservedAtUTC=new Date().toISOString();
await writeFile(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({notBeforeUTC:plan.notBeforeUTC,controls:plan.controls.map(control=>({nextLabel:control.nextLabel,controllerProcessStartedAtUTC:control.controllerProcessStartedAtUTC,actualRetryAtUTC:control.actualRetryAtUTC,activeControlStatus:control.activeControlStatus,actualCallsRecorded:control.actualCallsRecorded,inputObservation:control.inputObservation}))}));
