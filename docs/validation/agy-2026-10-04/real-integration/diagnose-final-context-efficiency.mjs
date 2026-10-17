import { readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
for(const label of process.argv.slice(2)){
  const manifest=JSON.parse(await readFile(resolve('docs/validation/agy-2026-10-04/real-integration',label,'manifest.json'),'utf8'));
  for(const call of manifest.providerCalls.filter(call=>!call.completedAt)){
    const tag=createHash('sha256').update(call.requestId).digest('hex').slice(0,16);
    const directory=join(call.cwd,'.agents');
    let entries, reads;
    try{entries=JSON.parse(await readFile(join(directory,`context-${tag}-entries.json`),'utf8'));reads=(await readFile(join(directory,`context-${tag}-reads.ndjson`),'utf8')).split('\n').filter(Boolean).map(JSON.parse);}catch(error){console.log(JSON.stringify({label,requestId:call.requestId,error:String(error)}));continue;}
    const sections={};for(const entry of entries){const section=entry.path.split('/')[1];const value=sections[section]??={entries:0,bytes:0};value.entries++;value.bytes+=Buffer.byteLength(entry.content);}
    const segments=reads.flatMap(frame=>frame.reads??[frame]);
    const unique=new Set(segments.map(read=>read.key));
    console.log(JSON.stringify({label,requestId:call.requestId,totalEntries:entries.length,smallEntries:entries.filter(entry=>Buffer.byteLength(entry.content)<800).length,sections,readCalls:reads.length,batchCalls:reads.filter(frame=>frame.reads).length,returnedSegments:segments.length,distinctKeysRead:unique.size,continuationOrRepeatedSegments:segments.length-unique.size}));
  }
}
