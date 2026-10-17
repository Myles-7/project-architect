import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import request from 'supertest';
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { ProjectStateEngine,FileStorage,WorkspaceGuard,planningBasis,planningInputHash } from '@project-architect/core';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { FixturePlanningProvider,group } from '../../../tests/fixtures/planning.mjs';

let root:string,id:string,path:string,runtime:PlanningRuntime,app:any;
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'pa-planning-api-'));const guard=new WorkspaceGuard(root);const engine=new ProjectStateEngine(new FileStorage(),guard);runtime=new PlanningRuntime(engine,new FixturePlanningProvider(1) as any,{},[1,2]);app=createApp({workspaceRoot:root,engine,planningRuntime:runtime});const created=await request(app).post('/api/projects').send({name:'接口测试',idea:'个人笔记工具'}).expect(200);id=created.body.data.projectId;path=guard.resolveProjectPath(id);});
afterEach(async()=>{vi.restoreAllMocks();await runtime.shutdown();await rm(root,{recursive:true,force:true});});
it.each([false,true])('keeps partial feedback gated through HTTP and protects newer input (%s)',async(newerInput)=>{
  const base=`/api/projects/${id}`;
  for(const stage of ['product','technical','delivery'] as const){
    let s=await runtime.service.get(path);
    s=await runtime.service.propose(path,{id:`http-${stage}`,runId:'http-base',stage,basis:planningBasis(s),summary:'基础方案',groups:[group(stage)],evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]});
    await request(app).post(`${base}/planning/changesets/http-${stage}/approve`).send({operationId:`http-approve-${stage}`,expectedRevision:s.metadata.stateRevision,groupIds:[`${stage}-group`]}).expect(200);
  }
  let s=await runtime.service.get(path);const previousInputHash=s.planning!.blueprint.approvedInputHash;
  await request(app).post(`${base}/planning/inputs`).send({raw:'开发反馈：分两组修订',kind:'feedback',expectedRevision:s.metadata.stateRevision,operationId:'http-feedback-input'}).expect(200);
  s=await runtime.service.get(path);
  const groups=['a','b'].map((id,index)=>({id,title:`修订 ${id}`,impact:'跨阶段修改',dependsOn:[],blocks:['product','technical','delivery'].flatMap(stage=>group(stage).blocks).filter(block=>['a','b'][['notes','stack','implement-notes'].includes(block.id)?0:1]===id).map(block=>({...block,content:`${block.content} HTTP修订 ${index}。`})),removeBlockIds:[],decisions:[],status:'pending' as const}));
  s=await runtime.service.propose(path,{id:'http-feedback',runId:'http-feedback-run',stage:'feedback',basis:planningBasis(s),summary:'部分反馈审批',groups,evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]});
  const approved=await request(app).post(`${base}/planning/changesets/http-feedback/approve`).send({operationId:'http-approve-a',expectedRevision:s.metadata.stateRevision,groupIds:['a']}).expect(200);
  s=approved.body.data.snapshot;
  expect(s.planning!.blueprint.approvedInputHash).toBe(previousInputHash);expect(Object.values(s.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);
  const blocked=await request(app).post(`${base}/planning/package`).send({operationId:'http-blocked-package',expectedRevision:s.metadata.stateRevision}).expect(422);expect(blocked.body.error.code).toBe('STAGE_NOT_APPROVED');
  if(newerInput){await request(app).post(`${base}/planning/inputs`).send({raw:'开发反馈：新增输入 C',kind:'feedback',expectedRevision:s.metadata.stateRevision,operationId:'http-new-c'}).expect(200);s=await runtime.service.get(path);}
  const payload={operationId:'http-reject-b',expectedRevision:s.metadata.stateRevision,groupIds:['b']};
  const rejected=await request(app).post(`${base}/planning/changesets/http-feedback/reject`).send(payload).expect(200);
  s=rejected.body.data.snapshot;
  const repeated=await request(app).post(`${base}/planning/changesets/http-feedback/reject`).send(payload).expect(200);expect(repeated.body.stateRevision).toBe(s.metadata.stateRevision);
  expect(s.planning!.blueprint.blocks.find(block=>block.id==='notes')!.content).toContain('HTTP修订 0');
  expect(s.planning!.blueprint.blocks.find(block=>block.id==='scope')!.content).not.toContain('HTTP修订 1');
  expect(s.planning!.blueprint.approvedInputHash).toBe(newerInput?previousInputHash:planningInputHash(s));
  const compiled=await request(app).post(`${base}/planning/package`).send({operationId:'http-final-package',expectedRevision:s.metadata.stateRevision}).expect(newerInput?422:200);
  if(newerInput){expect(compiled.body.error.code).toBe('STAGE_NOT_APPROVED');expect(s.planning!.inputs.at(-1)!.raw).toBe('开发反馈：新增输入 C');}
  else{expect(compiled.body.data.sourceRevision).toBe(s.metadata.stateRevision);const product=await request(app).get(`${base}/planning/package/files/PRODUCT.md`).expect(200);expect(product.text).toContain('HTTP修订 0');}
});
it.each([
  ['planning/runs',{stage:'clarify',operationId:12,expectedRevision:1}],
  ['planning/inputs',{raw:12,operationId:'input',expectedRevision:1}],
  ['questions/answers',{answers:[null],operationId:'answer',expectedRevision:1}],
  ['planning/package',{operationId:12,expectedRevision:1}],
])('returns 400 for malformed %s rather than an internal TypeError',async(route,body)=>{const r=await request(app).post(`/api/projects/${id}/${route}`).send(body);expect(r.status).toBe(400);expect(r.body.error.code).toBe('INVALID_INTENT');expect(r.body.error.message).not.toContain('TypeError');});
it('validates configuration arrays and leaves the previous effective settings intact',async()=>{const before=runtime.getConfig();const r=await request(app).put(`/api/projects/${id}/planning/config`).send({...before,officialHosts:'nodejs.org'});expect(r.status).toBe(400);expect(runtime.getConfig()).toEqual(before);});
it('leaves effective settings unchanged when preference persistence fails',async()=>{
  const before=runtime.getConfig();
  vi.spyOn(FileStorage.prototype,'writeJson').mockRejectedValueOnce(new Error('EIO preference write failed'));
  const r=await request(app).put(`/api/projects/${id}/planning/config`).send({...before,designModel:'gemini-3.8-flash-high',reviewModel:'gemini-3.8-flash-high'});
  expect(r.status).toBe(500);expect(runtime.getConfig()).toEqual(before);
});
it('serializes preference persistence and exposes only successfully saved values',async()=>{
  const before=runtime.getConfig(),first={...before,designModel:'  gemini-3.8-flash-high  ',reviewModel:'gemini-3.8-flash-high'},second={...before,concurrency:2};
  const write=FileStorage.prototype.writeJson;let unblock!:()=>void;const gate=new Promise<void>(resolve=>unblock=resolve);const seen:any[]=[];
  vi.spyOn(FileStorage.prototype,'writeJson').mockImplementation(async function(path,value){
    if(path===join(root,'planning-config.json')){seen.push(value);if(seen.length===1)await gate;}
    return write.call(this,path,value);
  });
  const one=request(app).put(`/api/projects/${id}/planning/config`).send(first).then(r=>r);
  await vi.waitFor(()=>expect(seen).toHaveLength(1));
  const two=request(app).put(`/api/projects/${id}/planning/config`).send(second).then(r=>r);
  await new Promise(resolve=>setTimeout(resolve,30));expect(seen).toHaveLength(1);expect(runtime.getConfig()).toEqual(before);
  unblock();const responses=await Promise.all([one,two]);expect(responses.map(r=>r.status)).toEqual([200,200]);expect(responses[0]!.body.data.designModel).toBe('gemini-3.8-flash-high');
  expect(JSON.parse(await readFile(join(root,'planning-config.json'),'utf8'))).toEqual(runtime.getConfig());expect(runtime.getConfig()).toEqual(second);
  const restarted=new PlanningRuntime((runtime as any).engine,new FixturePlanningProvider() as any);
  createApp({workspaceRoot:root,planningRuntime:restarted});expect(restarted.getConfig()).toEqual(second);
});
it.each(['{broken',JSON.stringify({concurrency:0,designModel:'x',reviewModel:'y'})])('reports invalid persisted preferences without default model fallback',async(text)=>{
  const file=join(root,'planning-config.json');await writeFile(file,text);
  expect(()=>createApp({workspaceRoot:root})).toThrow('规划运行配置无法加载');expect(await readFile(file,'utf8')).toBe(text);
});
it('blocks historical production planning and draft HTML fallback',async()=>{expect((await request(app).post(`/api/projects/${id}/discovery`).send({expectedRevision:1})).status).toBe(410);const r=await request(app).get(`/api/projects/${id}/documents/export-html`);expect(r.status).toBe(422);expect(r.body.error.code).toBe('PACKAGE_INCOMPLETE');expect((await runtime.service.get(path)).metadata.stateRevision).toBe(1);});
it('replays SSE after a Last-Event-ID with ordered, nonduplicated progress',async()=>{
  const run=await runtime.start(path,{stage:'clarify',expectedRevision:1,operationId:'sse'});await vi.waitFor(()=>expect((runtime as any).active.size).toBe(0));const events=await runtime.events(path,run.id);const after=events[0]!.seq;const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const port=server.address().port;const abort=new AbortController();
  try{const response=await fetch(`http://127.0.0.1:${port}/api/projects/${id}/planning/runs/${run.id}/events`,{headers:{'Last-Event-ID':String(after)},signal:abort.signal});expect(response.headers.get('content-type')).toContain('text/event-stream');const reader=response.body!.getReader();let text='';while(!text.includes(`id: ${events.at(-1)!.seq}\n`)){const {value,done}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);}const seq=[...text.matchAll(/^id: (\d+)$/gm)].map(m=>Number(m[1]));expect(seq).toEqual(events.filter(e=>e.seq>after).map(e=>e.seq));}
  finally{abort.abort();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
