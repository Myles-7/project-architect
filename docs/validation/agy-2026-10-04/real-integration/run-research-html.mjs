import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AntigravityCliProvider } from '../../../../packages/agent/dist/provider/AntigravityCliProvider.js';
import { preparePlanningWorkspace } from '../../../../packages/agent/dist/tools/PlanningToolsMcpServer.js';
process.env.PATH = dirname(process.execPath) + ';' + process.env.PATH;
const root=resolve('docs/validation/agy-2026-10-04/real-integration',process.argv[2]??'html-research');
await mkdir(root,{recursive:true});
const url='https://docs.docker.com/engine/network/drivers/none/';
const config={materialRoots:[],materials:[],experimentRoot:resolve(root,'experiments'),evidenceRoot:resolve(root,'evidence'),officialHosts:['docs.docker.com']};
const cwd=resolve(root,'worker');await preparePlanningWorkspace(config,cwd);
const schemaPath=resolve(root,'schema.json');
await writeFile(schemaPath,JSON.stringify({type:'object',properties:{source:{type:'string'},sha256:{type:'string'},fetchedAt:{type:'string'},scope:{type:'string'},findings:{type:'array',items:{type:'string'}},evidenceId:{type:'string'},limitations:{type:'array',items:{type:'string'}},readOffsets:{type:'array',items:{type:'integer'}}},required:['source','sha256','fetchedAt','scope','findings','evidenceId','limitations','readOffsets'],additionalProperties:false}));
const started=Date.now();const reminder=setInterval(()=>console.log(JSON.stringify({at:new Date().toISOString(),status:'working',elapsedSeconds:Math.round((Date.now()-started)/1000)})),60000);
try {
  const result=await new AntigravityCliProvider().complete({requestId:'html-research-real-20261004',task:'planning-task',model:'gemini-3.1-pro-high',reasoningEffort:'high',cwd,schemaPath,logPath:resolve(root,'stream.ndjson'),prompt:`Use registered project_architect research_read to read exactly ${url}. It now returns paginated readable text and stores the complete raw HTML separately. Read every returned range by nextOffset until nextOffset=null. Extract only the supported container network-none behavior, then call evidence_record with actual source, content, scope and conclusion. Return actual source/hash/fetch time/evidence id, every read offset, and limitations. No environment preparation or experiment is needed. Do not substitute memory or a different URL.`,contextText:'Registered integration validation of real rendered official HTML research. All conclusions are candidate evidence; no user approval is implied.'});
  await writeFile(resolve(root,'result.json'),JSON.stringify({hostNode:process.version,executable:process.execPath,...result},null,2));
  const events=(await readFile(resolve(config.evidenceRoot,'tool-events.ndjson'),'utf8')).split('\n').filter(Boolean).map(JSON.parse);
  const reads=events.filter(e=>e.action==='research_read').map(e=>e.details);
  const output=result.structuredOutput;const source=reads[0];
  const raw=source?await readFile(source.evidencePath):null;
  const check={structuredSuccess:result.structuredSuccess,actualHtmlFetched:!!source&&raw?.toString().includes('<'),sourceMatches:output?.source===url,hashMatches:!!raw&&createHash('sha256').update(raw).digest('hex')===output?.sha256,dateMatches:source?.fetchedAt===output?.fetchedAt,allRangesRead:!!source&&reads.some(r=>r.offset+(r.length??12000)>=r.totalCharacters),reads,evidenceId:output?.evidenceId};
  await writeFile(resolve(root,'semantic-validation.json'),JSON.stringify(check,null,2));
  console.log(JSON.stringify({status:result.status,structuredSuccess:result.structuredSuccess,output,check},null,2));
} catch(error){await writeFile(resolve(root,'controller-error.json'),JSON.stringify({error:String(error)},null,2));console.error(error);process.exitCode=1;}
finally{clearInterval(reminder);}
