import { readFile, writeFile, mkdir, mkdtemp, cp, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createApp } from '../../../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../../../apps/server/dist/planning/PlanningRuntime.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard } from '../../../../packages/core/dist/index.js';

const [sourceLabel,label]=process.argv.slice(2);
if(![sourceLabel,label].every(value=>/^[a-z0-9-]+$/.test(value??'')))throw new Error('Source and unique output labels required');
const base=resolve('docs/validation/agy-2026-10-04/real-integration'),source=join(base,sourceLabel),root=join(base,label);
await mkdir(root); // Exclusive evidence label; never overwrite a frozen control.
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceManifestBytes=await readFile(join(source,'manifest.json')),previous=JSON.parse(sourceManifestBytes);
if(previous.status!=='completed'||previous.activeCallsAtShutdown!==0)throw new Error('Requires stopped completed control');
async function treeHash(path){const files=[];async function walk(dir,relative=''){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative?`${relative}/${entry.name}`:entry.name;if(entry.isDirectory())await walk(join(dir,entry.name),name);else files.push([name,sha(await readFile(join(dir,entry.name)))]);}}await walk(path);return sha(Buffer.from(JSON.stringify(files)));}
const originalHash=await treeHash(source),workspace=await mkdtemp(join(tmpdir(),'pa-quality-publish-')),metadata=JSON.parse(await readFile(join(source,'project-records','project.json'),'utf8'));
const path=join(workspace,'projects',metadata.projectId);await cp(join(source,'project-records'),path,{recursive:true});
const manifest={...structuredClone(previous),label,path,temp:workspace,startedAt:new Date().toISOString(),checks:[],approvals:[],providerCalls:[],maxActiveCalls:0,controlKind:'public-http-quality-package-publication-on-copy',authorization:'No AI or new approvals. Publish already API-accepted genuine blueprint on a copy through formal HTTP API; not human review.',migration:{sourceLabel,sourceManifestSha256:sha(sourceManifestBytes),sourceTreeSha256:originalHash,method:'Frozen control copied byte-for-byte; formal HTTP compiler and export; source project unchanged',allInheritedProviderCalls:[...(previous.migration?.allInheritedProviderCalls??[]),...previous.providerCalls],allInheritedApprovals:[...(previous.migration?.allInheritedApprovals??[]),...previous.approvals]}};
function check(name,pass,details){manifest.checks.push({name,pass:!!pass,details});if(!pass)throw new Error(name);}
for(const record of manifest.packages){record.inheritedFrom=sourceLabel;await cp(join(source,`${record.labelSuffix}-development-package`),join(root,`${record.labelSuffix}-development-package`),{recursive:true});await cp(join(source,`${record.labelSuffix}-development-package.zip`),join(root,`${record.labelSuffix}-development-package.zip`));}
const engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(workspace));
const runtime=new PlanningRuntime(engine,{async complete(){manifest.providerCalls.push({forbidden:true});throw new Error('Publication must not invoke AI');}},previous.actualConfig);
const app=createApp({workspaceRoot:workspace,engine,planningRuntime:runtime,useMockAI:true});
const server=await new Promise(done=>{const listener=app.listen(0,'127.0.0.1',()=>done(listener));});
const url=`http://127.0.0.1:${server.address().port}`,headers={'Content-Type':'application/json'};
try{
  const opened=await fetch(`${url}/api/projects/open`,{method:'POST',headers,body:JSON.stringify({projectId:metadata.projectId})});check('formal-http-open',opened.ok,await opened.text());
  const before=await runtime.service.get(path);await writeFile(join(root,'pre-publication-snapshot.json'),JSON.stringify(before,null,2));
  check('all-stages-approved',Object.values(before.planning.blueprint.stages).every(status=>status==='approved'));
  const response=await fetch(`${url}/api/projects/${metadata.projectId}/planning/package`,{method:'POST',headers,body:JSON.stringify({expectedRevision:before.metadata.stateRevision,operationId:`publish-${label}`})}),body=await response.json();check('formal-http-publish',response.ok&&body.success,body);
  const pm=body.data;check('new-package-uses-current-blueprint',pm.sourceRevision===before.metadata.stateRevision&&pm.sourceRevision>previous.packages.at(-1).manifest.sourceRevision,{current:before.metadata.stateRevision,sourceRevision:pm.sourceRevision,previous:previous.packages.at(-1).manifest.sourceRevision});
  const suffix='quality-reviewed-r2';if(manifest.packages.some(record=>record.labelSuffix===suffix))throw new Error('Choose unused package suffix');
  await cp(join(path,pm.directory),join(root,`${suffix}-development-package`),{recursive:true});
  const exported=await fetch(`${url}/api/projects/${metadata.projectId}/planning/package/export`),zip=Buffer.from(await exported.arrayBuffer());check('formal-http-zip',exported.ok&&zip.subarray(0,2).toString()==='PK');await writeFile(join(root,`${suffix}-development-package.zip`),zip);
  const verified=[];for(const file of pm.files){const response=await fetch(`${url}/api/projects/${metadata.projectId}/planning/package/files/${encodeURIComponent(file.name)}`),bytes=Buffer.from(await response.arrayBuffer()),hash=sha(bytes);verified.push({name:file.name,sha256:hash,matches:response.ok&&hash===file.sha256});}
  check('all-http-preview-hashes',verified.every(file=>file.matches),verified);manifest.packages.push({labelSuffix:suffix,manifest:pm,zipBytes:zip.length,zipSha256:sha(zip),verified});
  const final=await runtime.service.get(path);check('compile-preserves-approved-blocks',JSON.stringify(before.planning.blueprint.blocks)===JSON.stringify(final.planning.blueprint.blocks));
  await writeFile(join(root,'final-snapshot.json'),JSON.stringify(final,null,2));
  check('source-evidence-unchanged',originalHash===await treeHash(source));check('zero-provider-calls',manifest.providerCalls.length===0);
  manifest.status='completed';
}catch(error){manifest.status='blocked';manifest.error=String(error);process.exitCode=1;}
finally{await new Promise(done=>server.close(done));manifest.completedAt=new Date().toISOString();manifest.activeCallsAtShutdown=0;await cp(path,join(root,'project-records'),{recursive:true});await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({label,status:manifest.status,error:manifest.error,checks:manifest.checks.length,path}));}
