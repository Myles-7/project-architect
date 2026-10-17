import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PlanningView, PlanningRuntimeConfig } from '@project-architect/contracts';
import { blueprintCoverage, FileStorage, PlanningError, planningInputHash, planningPackageStatus } from '@project-architect/core';
import { PlanningRuntime } from './PlanningRuntime.js';
import { PlanningPackageCompiler } from './PlanningPackageCompiler.js';
import { normalizePlanningConfig, serializePlanningConfigWrite } from './PlanningConfig.js';

export function createPlanningRoutes(runtime:PlanningRuntime,resolveProject:(id:string)=>Promise<string>,configPath:string):Router {
  const router=Router();
  router.use((req,_res,next)=>{if(['POST','PUT','PATCH'].includes(req.method)){req.body??={};if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)){next(new PlanningError('INVALID_INTENT','请求必须为 JSON 对象'));return;}}next();});
  const handler=(action:(req:Request,res:Response,path:string)=>Promise<void>)=>async(req:Request,res:Response,next:NextFunction)=>{try{const path=await resolveProject(String(req.params.id));await action(req,res,path);}catch(error){next(error);}};
  const ok=(res:Response,data:unknown,revision?:number)=>res.json({success:true,data,...(revision!==undefined?{stateRevision:revision}:{})});
  router.get('/projects/:id/planning',handler(async(_req,res,path)=>{
    const snapshot=await runtime.service.get(path);const state=snapshot.planning!;const runs=await runtime.list(path);const coverageIssues=blueprintCoverage(state.blueprint.blocks);
    if(state.blueprint.blocks.length&&state.blueprint.approvedInputHash!==planningInputHash(snapshot))coverageIssues.push('新的输入或材料尚未纳入批准方案，请先分析影响并审阅修订。');
    const status:PlanningView['status']=state.changeSets.some(c=>['pending','partially-approved'].includes(c.status))?'方案可审阅':Object.values(state.blueprint.stages).every(s=>s==='approved')&&!coverageIssues.length?(state.blueprint.blocks.some(b=>b.kind==='validation')?'包含验证任务':'已批准'):state.blueprint.blocks.length?'待设计':'待澄清';
    ok(res,{sourceStateRevision:snapshot.metadata.stateRevision,packageStatus:planningPackageStatus(snapshot),canGenerateProduct:runtime.productReadiness(snapshot,runs).ready,state,runs,status,coverageIssues} satisfies PlanningView,snapshot.metadata.stateRevision);
  }));
  router.post('/projects/:id/planning/inputs',handler(async(req,res,path)=>{const s=await runtime.service.recordInput(path,req.body.raw,req.body.expectedRevision,req.body.operationId,req.body.kind);ok(res,{snapshot:s},s.metadata.stateRevision);}));
  router.post('/projects/:id/planning/runs',handler(async(req,res,path)=>{const run=await runtime.start(path,req.body);res.status(202).json({success:true,data:run});}));
  router.get('/projects/:id/planning/runs/:runId',handler(async(req,res,path)=>{ok(res,await runtime.get(path,String(req.params.runId)));}));
  router.post('/projects/:id/planning/runs/:runId/cancel',handler(async(req,res,path)=>{ok(res,await runtime.cancel(path,String(req.params.runId)));}));
  router.post('/projects/:id/planning/runs/:runId/resume',handler(async(req,res,path)=>{ok(res,await runtime.resume(path,String(req.params.runId)));}));
  router.get('/projects/:id/planning/runs/:runId/events',handler(async(req,res,path)=>{
    const id=String(req.params.runId);await runtime.get(path,id);const last=Number(req.get('Last-Event-ID')??req.query.after??0);
    if(!Number.isInteger(last)||last<0){res.status(400).json({success:false,error:{code:'INVALID_INTENT',message:'事件序号无效'}});return;}
    res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders();
    let sequence=last;let closed=false;const write=(event:import('@project-architect/contracts').PlanningEvent)=>{if(!closed&&event.seq>sequence){sequence=event.seq;res.write(`id: ${event.seq}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`);}};
    // Subscribe before replay; buffer during replay to preserve monotonically ordered delivery.
    const queued:import('@project-architect/contracts').PlanningEvent[]=[];let replaying=true;const listener=(e:import('@project-architect/contracts').PlanningEvent)=>{if(replaying)queued.push(e);else write(e);};runtime.on(id,listener);
    req.on('close',()=>{closed=true;runtime.off(id,listener);clearInterval(heartbeat);});
    const heartbeat=setInterval(()=>{if(!closed)res.write(': keepalive\n\n');},15000);heartbeat.unref();
    for(const event of await runtime.events(path,id,last))write(event);replaying=false;queued.sort((a,b)=>a.seq-b.seq).forEach(write);
  }));
  router.post('/projects/:id/questions/answers',handler(async(req,res,path)=>{const s=await runtime.service.answer(path,req.body.answers,req.body.expectedRevision,req.body.operationId);ok(res,{snapshot:s},s.metadata.stateRevision);}));
  router.patch('/projects/:id/planning/changesets/:changeSetId',handler(async(req,res,path)=>{const s=await runtime.service.edit(path,String(req.params.changeSetId),req.body.groups,req.body.expectedRevision,req.body.operationId);ok(res,{snapshot:s},s.metadata.stateRevision);}));
  router.post('/projects/:id/planning/changesets/:changeSetId/approve',handler(async(req,res,path)=>{const s=await runtime.service.approve(path,String(req.params.changeSetId),req.body);ok(res,{snapshot:s},s.metadata.stateRevision);}));
  router.post('/projects/:id/planning/changesets/:changeSetId/reject',handler(async(req,res,path)=>{const s=await runtime.service.reject(path,String(req.params.changeSetId),req.body.groupIds,req.body.expectedRevision,req.body.operationId);ok(res,{snapshot:s},s.metadata.stateRevision);}));
  router.get('/projects/:id/planning/config',handler(async(_req,res)=>{ok(res,runtime.getConfig());}));
  router.put('/projects/:id/planning/config',handler(async(req,res)=>{
    const value=normalizePlanningConfig(req.body as PlanningRuntimeConfig);
    await serializePlanningConfigWrite(configPath,async()=>{
      await new FileStorage().writeJson(configPath,value);
      runtime.configure(value);
    });
    ok(res,value);
  }));
  router.post('/projects/:id/planning/package',handler(async(req,res,path)=>{const result=await new PlanningPackageCompiler(runtime.service).compile(path,req.body.expectedRevision,req.body.operationId);ok(res,result,result.revision);}));
  router.get('/projects/:id/planning/package/export',handler(async(_req,res,path)=>{const result=await new PlanningPackageCompiler(runtime.service).export(path);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="development-package.zip"');res.send(result);}));
  router.get('/projects/:id/planning/package/files/:name',handler(async(req,res,path)=>{res.type('text/plain').send(await new PlanningPackageCompiler(runtime.service).read(path,String(req.params.name)));}));
  return router;
}
