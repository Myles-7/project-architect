import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label??''))throw new Error('Frozen evidence label required');
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
if(!manifest.completedAt||manifest.activeCallsAtShutdown!==0)throw new Error('Requires frozen control with zero actual active calls');
const calls=[];
for(const call of manifest.providerCalls){
  const bytes=await readFile(call.logPath),envelopes=bytes.toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)),stdout=envelopes.filter(envelope=>envelope.stream==='stdout').map(envelope=>envelope.data).join(''),stderr=envelopes.filter(envelope=>envelope.stream==='stderr').map(envelope=>envelope.data).join(''),terminals=[];
  for(const line of stdout.split('\n').filter(Boolean)){let event;try{event=JSON.parse(line);}catch{continue;}if(event.event==='result')terminals.push(event.result);}
  calls.push({requestId:call.requestId,model:call.model,effort:call.reasoningEffort,status:call.status,error:call.error,usage:call.usage,inputObservation:call.inputObservation??{status:'unavailable',reason:'Historical validation wrapper did not record actual request context sizes; they are not inferred from usage or current build'},recordedLogUtf8Bytes:bytes.length,logSha256:createHash('sha256').update(bytes).digest('hex'),recordedStdoutUtf8Bytes:Buffer.byteLength(stdout),recordedStderrUtf8Bytes:Buffer.byteLength(stderr),terminalResults:terminals.map(terminal=>({status:terminal?.status,error:terminal?.error,utf8Bytes:Buffer.byteLength(JSON.stringify(terminal)),structuredOutputUtf8Bytes:terminal?.structured_output==null?null:Buffer.byteLength(JSON.stringify(terminal.structured_output)),accepted:call.structuredSuccess===true&&terminal?.status==='SUCCESS'})),outputObservation:call.outputObservation??null});
}
const result={label,checkedAt:new Date().toISOString(),scope:'Actual saved stream bytes and observed request metrics; measurements do not assert repaired output truncation or content quality. Usage counters may span tool/model turns.',calls};
await writeFile(join(root,'provider-size-diagnostic.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({label,calls:calls.length,recordedContextSizes:calls.filter(call=>call.inputObservation.runtimeContextUtf8Bytes!==undefined).length,truncationCalls:calls.filter(call=>/cut off|output token limit/i.test(call.error??'')).map(call=>({requestId:call.requestId,stdoutBytes:call.recordedStdoutUtf8Bytes,usage:call.usage,terminalResults:call.terminalResults}))}));
