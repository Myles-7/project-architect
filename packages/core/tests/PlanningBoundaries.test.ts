import { describe,it,expect,beforeEach,afterEach } from 'vitest';
import { mkdtemp,rm,writeFile,readFile } from 'node:fs/promises';
import { join } from 'node:path';import { tmpdir } from 'node:os';
import { PlanningService,ProjectStateEngine,FileStorage,WorkspaceGuard,planningBasis,planningInputHash,blueprintCoverage } from '../src/index.js';
import { group,question } from '../../../tests/fixtures/planning.mjs';
describe('Planning state boundaries on real files',()=>{
 let root:string,path:string,engine:ProjectStateEngine,service:PlanningService;
 beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'pa-boundary-'));path=join(root,'project');engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root));await engine.createProject({name:'边界',idea:'有没有 GitHub 项目能实现？',projectPath:path});service=new PlanningService(engine);});
 afterEach(async()=>{await rm(root,{recursive:true,force:true});});
 async function propose(groups:any[],stage:any='product',id='change-boundary',evidence:any[]=[]){const s=await service.get(path);return service.propose(path,{id,runId:'run-test',stage,basis:planningBasis(s),summary:'边界验证',groups,evidence,status:'pending',createdAt:new Date().toISOString(),approvals:[]});}
 const decision=(key:string,aliases:string[]=[])=>({decisionKey:key,aliases,area:'technical_boundary',statement:'保存为本地文件并支持导出',rationale:'个人离线工作',evidenceIds:[]});
 async function approveThreeStages(){for(const stage of ['product','technical','delivery']){const s=await propose([group(stage)],stage,`base-${stage}`);await service.approve(path,`base-${stage}`,{expectedRevision:s.metadata.stateRevision,operationId:`approve-${stage}`,groupIds:[`${stage}-group`]});}}
 const feedbackGroup=(id:string,stages=['product','technical','delivery'])=>({id,title:`反馈 ${id}`,impact:'对应阶段的反馈修订',dependsOn:[],blocks:stages.flatMap(stage=>group(stage).blocks).map((block:any)=>({...block,content:`${block.content} 修订 ${id}。`})),removeBlockIds:[],decisions:[],status:'pending'});
 it('keeps same-basis feedback siblings pending until explicitly rejected without reviving stale approval',async()=>{
  await approveThreeStages();let s=await service.get(path);const oldInputHash=s.planning!.blueprint.approvedInputHash;
  s=await service.recordInput(path,'开发反馈：审阅两份候选修订',s.metadata.stateRevision,'sibling-input','feedback');
  await propose([feedbackGroup('a')],'feedback','feedback-a');s=await propose([feedbackGroup('b')],'feedback','feedback-b');
  s=await service.approve(path,'feedback-a',{expectedRevision:s.metadata.stateRevision,operationId:'approve-a',groupIds:['a']});
  expect(s.planning!.blueprint.approvedInputHash).toBe(oldInputHash);expect(Object.values(s.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);
  s=await new PlanningService(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root))).get(path);
  expect(s.planning!.changeSets.find(c=>c.id==='feedback-b')!.status).toBe('stale');
  await expect(service.approve(path,'feedback-b',{expectedRevision:s.metadata.stateRevision,operationId:'approve-stale-b',groupIds:['b']})).rejects.toMatchObject({code:'STALE_BASIS'});
  s=await service.reject(path,'feedback-b',['b'],s.metadata.stateRevision,'reject-b');
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));
  expect(s.planning!.blueprint.blocks.every(block=>block.content.includes('修订 a'))).toBe(true);expect(s.planning!.changeSets.find(c=>c.id==='feedback-b')!.status).toBe('rejected');
 });
 it('retains accumulated approval when another feedback package joins an ongoing review',async()=>{
  await approveThreeStages();let s=await service.get(path);s=await service.recordInput(path,'开发反馈：持续审阅',s.metadata.stateRevision,'ongoing-input','feedback');
  s=await propose([feedbackGroup('a'),{...feedbackGroup('b'),blocks:[]}],'feedback','ongoing-feedback');
  s=await service.approve(path,'ongoing-feedback',{expectedRevision:s.metadata.stateRevision,operationId:'approve-ongoing-a',groupIds:['a']});
  const originalReview=structuredClone(s.planning!.changeSets.find(c=>c.id==='ongoing-feedback')!.feedbackReview);
  s=await propose([{...feedbackGroup('extra'),blocks:[]}],'feedback','extra-feedback');
  s=await service.reject(path,'extra-feedback',['extra'],s.metadata.stateRevision,'reject-extra');
  expect(s.planning!.changeSets.find(c=>c.id==='ongoing-feedback')!.feedbackReview!.sourceBasisHash).toBe(originalReview!.sourceBasisHash);
  expect(s.planning!.changeSets.find(c=>c.id==='ongoing-feedback')!.feedbackReview!.affectedStages.sort()).toEqual(['delivery','product','technical']);
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);
  s=await service.reject(path,'ongoing-feedback',['b'],s.metadata.stateRevision,'reject-ongoing-b');
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));
  expect(s.planning!.blueprint.blocks.every(block=>block.content.includes('修订 a'))).toBe(true);
 });
 it('does not mark newer input reviewed when the remainder of old feedback is rejected',async()=>{
  await approveThreeStages();let s=await service.get(path);const oldInputHash=s.planning!.blueprint.approvedInputHash;
  s=await service.recordInput(path,'开发反馈：第一轮修订',s.metadata.stateRevision,'old-input','feedback');
  s=await propose([feedbackGroup('a'),{...feedbackGroup('b'),blocks:[]}],'feedback','old-feedback');
  s=await service.approve(path,'old-feedback',{expectedRevision:s.metadata.stateRevision,operationId:'approve-old-a',groupIds:['a']});
  const approvedA=structuredClone(s.planning!.blueprint.blocks);
  s=await service.recordInput(path,'开发反馈：还有新的恢复流程 C',s.metadata.stateRevision,'new-input','feedback');
  const inputHash=planningInputHash(s);
  s=await service.reject(path,'old-feedback',['b'],s.metadata.stateRevision,'reject-old-b');
  expect(s.planning!.blueprint.approvedInputHash).toBe(oldInputHash);expect(s.planning!.blueprint.approvedInputHash).not.toBe(inputHash);expect(s.planning!.blueprint.blocks).toEqual(approvedA);
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);
  expect(s.planning!.inputs.at(-1)!.raw).toBe('开发反馈：还有新的恢复流程 C');
 });
 it('completes feedback after sequential approvals while retaining every approved stage',async()=>{
  await approveThreeStages();let s=await service.get(path);s=await service.recordInput(path,'开发反馈：分批批准三个阶段',s.metadata.stateRevision,'sequential-input','feedback');
  s=await propose([feedbackGroup('product-a',['product']),feedbackGroup('technical-b',['technical']),feedbackGroup('delivery-c',['delivery'])],'feedback','sequential-feedback');
  for(const id of ['product-a','technical-b','delivery-c'])s=await service.approve(path,'sequential-feedback',{expectedRevision:s.metadata.stateRevision,operationId:`approve-${id}`,groupIds:[id]});
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));
  expect(s.planning!.blueprint.blocks.filter(block=>block.stage==='product').every(block=>block.content.includes('product-a'))).toBe(true);
 });
 it('allows rejecting the first feedback group before approving the remaining one',async()=>{
  await approveThreeStages();let s=await service.get(path);s=await service.recordInput(path,'开发反馈：技术候选保持不变，只修订交付',s.metadata.stateRevision,'reject-first-input','feedback');
  s=await propose([feedbackGroup('a',['technical']),feedbackGroup('b',['delivery'])],'feedback','reject-first');
  s=await service.reject(path,'reject-first',['a'],s.metadata.stateRevision,'reject-first-a');
  s=await service.approve(path,'reject-first',{expectedRevision:s.metadata.stateRevision,operationId:'approve-after-reject',groupIds:['b']});
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));
  expect(s.planning!.blueprint.blocks.filter(block=>block.stage==='technical').some(block=>block.content.includes('修订 a'))).toBe(false);
 });
 it('lets a fresh complete feedback review supersede unrelated stale review history',async()=>{
  await approveThreeStages();let s=await service.get(path);s=await service.recordInput(path,'开发反馈：第一轮',s.metadata.stateRevision,'history-input','feedback');
  s=await propose([feedbackGroup('a'),{...feedbackGroup('b'),blocks:[]}],'feedback','history-feedback');
  s=await service.approve(path,'history-feedback',{expectedRevision:s.metadata.stateRevision,operationId:'approve-history-a',groupIds:['a']});
  s=await service.recordInput(path,'开发反馈：重新分析全部方案',s.metadata.stateRevision,'fresh-input','feedback');
  s=await propose([feedbackGroup('fresh')],'feedback','fresh-feedback');
  s=await service.approve(path,'fresh-feedback',{expectedRevision:s.metadata.stateRevision,operationId:'approve-fresh',groupIds:['fresh']});
  expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));
  expect(s.planning!.changeSets.find(c=>c.id==='history-feedback')!.status).toBe('stale');expect(s.planning!.changeSets.find(c=>c.id==='history-feedback')!.groups.find(g=>g.id==='b')!.status).toBe('pending');
  const blueprint=structuredClone(s.planning!.blueprint);
  s=await service.reject(path,'history-feedback',['b'],s.metadata.stateRevision,'reject-obsolete-b');expect(s.planning!.blueprint).toEqual(blueprint);
 });
 it('projects legacy partially approved feedback back into review and can finish it explicitly',async()=>{
  await approveThreeStages();let s=await service.get(path);s=await service.recordInput(path,'开发反馈：历史部分批准',s.metadata.stateRevision,'legacy-input','feedback');
  s=await propose([feedbackGroup('a'),{...feedbackGroup('b'),blocks:[]}],'feedback','legacy-feedback');
  s=await service.approve(path,'legacy-feedback',{expectedRevision:s.metadata.stateRevision,operationId:'approve-legacy-a',groupIds:['a']});
  const c=s.planning!.changeSets.find(c=>c.id==='legacy-feedback')!;delete c.feedbackReview;
  s.planning!.blueprint.stages={product:'approved',technical:'approved',delivery:'approved'};s.planning!.blueprint.approvedInputHash=planningInputHash(s);c.basis={...planningBasis(s),revision:s.metadata.stateRevision+1};
  await engine.commitPlanningState(path,s,s.metadata.stateRevision);
  s=await service.get(path);expect(Object.values(s.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);expect(s.planning!.blueprint.approvedInputHash).toBeUndefined();expect(s.planning!.changeSets.find(c=>c.id==='legacy-feedback')!.status).toBe('partially-approved');
  s=await service.reject(path,'legacy-feedback',['b'],s.metadata.stateRevision,'reject-legacy-b');expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);
 });
 it('rejects whitespace-only modules, verification and completion entries',()=>{
  const valid=['product','technical','delivery'].flatMap(stage=>group(stage).blocks);
  expect(blueprintCoverage(valid)).toEqual([]);
  for(const field of ['modules','verification','completionCriteria']){
   const blocks=structuredClone(valid);blocks.find((b:any)=>b.kind==='task').task[field]=[' \t '];
   expect(blueprintCoverage(blocks)).toContain('任务 implement-notes 缺少范围、行为、关联或验收');
  }
 });
 it('rejects whitespace-only technical validation steps and environment details',()=>{
  const blocks=['product','technical','delivery'].flatMap(stage=>group(stage).blocks);
  const task=blocks.find((b:any)=>b.kind==='task');
  const validation={...structuredClone(task),id:'verify-storage',kind:'validation',task:{...structuredClone(task.task),environment:'独立临时目录和目标浏览器',steps:['保存并重开测试数据'],passCriteria:['重开后的正文一致'],evidenceRequired:['实际操作日志'],onFailure:'暂停依赖任务并反馈修订接口。'}};
  expect(blueprintCoverage([...blocks,validation])).toEqual([]);
  for(const field of ['environment','steps','passCriteria','evidenceRequired','onFailure']){
   const invalid=structuredClone(validation);invalid.task[field]=Array.isArray(invalid.task[field])?[' \t ']: ' \t ';
   expect(blueprintCoverage([...blocks,invalid])).toContain('验证任务 verify-storage 缺少环境、步骤、证据或失败处理');
  }
 });
 it('keeps untouched downstream design pending when feedback combines a decision change with product-only revision',async()=>{
  await approveThreeStages();let s=await service.get(path);
  const downstream=structuredClone(s.planning!.blueprint.blocks.filter(b=>b.stage!=='product'));
  s=await service.recordInput(path,'改为远程多人协作，笔记保存到云服务',s.metadata.stateRevision,'cloud-input');
  const feedback={...group('product'),id:'cloud-feedback',blocks:[{...group('product').blocks.find((b:any)=>b.id==='scope'),content:'本轮改为多人在线协作笔记，笔记保存到远程云服务。'}],decisions:[{...decision('notes:storage'),statement:'笔记保存到远程云服务并支持多人协作。'}]};
  s=await propose([feedback],'feedback','cloud-change');
  s=await service.approve(path,'cloud-change',{expectedRevision:s.metadata.stateRevision,operationId:'approve-cloud',groupIds:[feedback.id]});
  expect(s.planning!.changeSets.find(c=>c.id==='cloud-change')!.status).toBe('approved');
  expect(s.planning!.blueprint.stages).toEqual({product:'approved',technical:'needs-revision',delivery:'needs-revision'});
  expect(s.planning!.blueprint.blocks.filter(b=>b.stage!=='product')).toEqual(downstream);
  expect(s.decisions.items.find(d=>d.decisionKey==='notes:storage')).toMatchObject({status:'confirmed',approvalSource:'cloud-change:approve-cloud'});
  expect((await service.get(path)).planning!.blueprint.stages).toEqual(s.planning!.blueprint.stages);
 });
 it('keeps complete three-stage feedback approved when it also changes a decision',async()=>{
  await approveThreeStages();let s=await service.get(path);
  s=await service.recordInput(path,'改为远程多人协作，修订产品、接口和验收任务',s.metadata.stateRevision,'cloud-input');
  const groups=['product','technical','delivery'].map(stage=>{const draft=group(stage);return {...draft,id:`cloud-${stage}`,blocks:draft.blocks.map((b:any)=>({...b,content:`${b.content} 新增远程服务异常与共享冲突的处理说明。`}))};});
  groups[0]!.decisions=[{...decision('notes:storage'),statement:'笔记保存到远程云服务并支持多人协作。'}];
  s=await propose(groups,'feedback','cloud-all');
  s=await service.approve(path,'cloud-all',{expectedRevision:s.metadata.stateRevision,operationId:'approve-cloud-all',groupIds:groups.map(g=>g.id)});
  expect(s.planning!.blueprint.stages).toEqual({product:'approved',technical:'approved',delivery:'approved'});
  expect(blueprintCoverage(s.planning!.blueprint.blocks)).toEqual([]);
  expect(s.planning!.changeSets.find(c=>c.id==='cloud-all')!.groups.every(g=>g.status==='approved')).toBe(true);
  expect((await service.get(path)).planning!.blueprint.stages).toEqual(s.planning!.blueprint.stages);
 });
 it('keeps all three stages approved when one feedback package explicitly revises every affected stage',async()=>{for(const stage of ['product','technical','delivery']){let s=await propose([group(stage)],stage,`base-${stage}`);await service.approve(path,`base-${stage}`,{expectedRevision:s.metadata.stateRevision,operationId:`approve-${stage}`,groupIds:[`${stage}-group`]});}let s=await service.get(path);s=await service.recordInput(path,'开发反馈：失败提示需要覆盖全部步骤',s.metadata.stateRevision,'feedback-input');const groups=['product','technical','delivery'].map(stage=>({...group(stage),id:`feedback-${stage}`}));s=await propose(groups,'feedback','feedback-all');s=await service.approve(path,'feedback-all',{expectedRevision:s.metadata.stateRevision,operationId:'feedback-all',groupIds:groups.map(g=>g.id)});expect(Object.values(s.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);});
 it('allows separate answers to an approved project batch while invalidating affected design',async()=>{let s=await propose([group('product')]);s=await service.approve(path,'change-boundary',{operationId:'approve',expectedRevision:s.metadata.stateRevision,groupIds:['product-group']});s=await service.installQuestions(path,planningBasis(s),[question() as any,question('notes:export','q-export') as any],'run-split');const first=s.questions.items[0]!.id,second=s.questions.items[1]!.id;s=await service.answer(path,[{questionId:first,kind:'selection',optionKeys:['local']}],s.metadata.stateRevision,'first');expect(s.planning!.blueprint.stages.product).toBe('needs-revision');s=await service.get(path);s=await service.answer(path,[{questionId:second,kind:'selection',optionKeys:['local']}],s.metadata.stateRevision,'second');expect(s.questions.items.every(q=>q.status==='answered')).toBe(true);expect(s.decisions.items.filter(d=>d.status==='confirmed')).toHaveLength(2);});
 it.each(['delegate','defer','custom'] as const)('preserves %s topic across reload and requires a reason to ask it again',async(kind)=>{let s=await service.get(path);s=await service.installQuestions(path,planningBasis(s),[question() as any],'run-first');s=await service.answer(path,[{questionId:s.questions.items[0]!.id,kind,text:kind==='custom'?'  先研究可行性。\n':''}],s.metadata.stateRevision,'answer');s=await new PlanningService(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root))).get(path);expect(s.planning!.topics[0]!.lastAnswerKind).toBe(kind);expect(s.decisions.items.filter(d=>d.status==='confirmed')).toHaveLength(0);await expect(service.installQuestions(path,planningBasis(s),[question() as any],'run-repeat')).rejects.toMatchObject({code:'QUESTION_QUALITY_FAILED'});});
 it('preserves initial free text without confirming it as a requirement',async()=>{const s=await service.get(path);expect(s.decisions.items.some(d=>['confirmed','locked'].includes(d.status))).toBe(false);expect(s.planning!.inputs[0]!.raw).toBe('有没有 GitHub 项目能实现？');expect(s.planning!.inputs[0]!.kind).toBe('question');});
 it('refuses newly colliding aliases and overlapping blocks before any commit',async()=>{const a=group('product'),b={...group('product'),id:'other',blocks:[],decisions:[decision('b')]};a.decisions=[decision('a',['b'])];let s=await propose([a,b]);const revision=s.metadata.stateRevision;await expect(service.approve(path,'change-boundary',{operationId:'collision',expectedRevision:revision,groupIds:[a.id,b.id]})).rejects.toMatchObject({code:'TOPIC_CONFLICT'});expect((await service.get(path)).metadata.stateRevision).toBe(revision);const c={...group('product'),id:'overlap'};s=await propose([group('product'),c],'product','overlap');await expect(service.approve(path,'overlap',{operationId:'blocks',expectedRevision:s.metadata.stateRevision,groupIds:['product-group','overlap']})).rejects.toMatchObject({code:'INVALID_CHANGESET'});});
 it('finishes a partial package after rejecting its optional group, without reviving stale readiness',async()=>{const optional={...group('product'),id:'optional',blocks:[]};let s=await propose([group('product'),optional]);s=await service.approve(path,'change-boundary',{operationId:'partial',expectedRevision:s.metadata.stateRevision,groupIds:['product-group']});expect(s.planning!.blueprint.stages.product).toBe('needs-revision');s=await service.reject(path,'change-boundary',['optional'],s.metadata.stateRevision,'reject');expect(s.planning!.changeSets[0]!.status).toBe('approved');expect(s.planning!.blueprint.stages.product).toBe('approved');expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));});
 it('checks every feature’s flow and dangling requirement references before readiness',()=>{const product=group('product').blocks;product.push({...product.find((b:any)=>b.kind==='feature'),id:'extra-feature'});expect(blueprintCoverage(product,'product')).toContain('功能 extra-feature 缺少流程');product.find((b:any)=>b.kind==='flow').requirementIds=['missing'];expect(blueprintCoverage(product,'product').join(' ')).toContain('关联了不存在的需求');});
 it('protects evidence identities even after partial approval and user editing',async()=>{const evidence={id:'e',kind:'user',source:'project:idea',content:'个人使用',obtainedAt:'2026-10-04',applicability:'目标'};const a=group('product');a.blocks[0].evidenceIds=['e'];let s=await propose([a], 'product','e1',[evidence]);s=await service.approve(path,'e1',{operationId:'approve',expectedRevision:s.metadata.stateRevision,groupIds:[a.id]});await expect(propose([{...group('technical'),blocks:[]}],'technical','e2',[{...evidence,content:'团队使用'}])).rejects.toMatchObject({code:'INVALID_EVIDENCE'});});
 it('material content changes invalidate the basis and remain visible as extraction failure',async()=>{const before=await service.get(path);const source=join(path,before.metadata.inputRefs[0]!.storageRef);await writeFile(source,'externally changed');const changed=await service.get(path);expect(changed.metadata.inputRefs[0]!.status).toBe('failed');expect(planningBasis(before).hash).not.toBe(planningBasis(changed).hash);});
 it('makes decision-only feedback require redesign while preserving history',async()=>{let s=await propose([group('product')]);s=await service.approve(path,'change-boundary',{operationId:'product',expectedRevision:s.metadata.stateRevision,groupIds:['product-group']});const feedback={...group('product'),id:'feedback',blocks:[],decisions:[decision('storage:remote')]};s=await propose([feedback],'feedback','feedback');s=await service.approve(path,'feedback',{operationId:'feedback',expectedRevision:s.metadata.stateRevision,groupIds:['feedback']});expect(s.planning!.blueprint.stages.product).toBe('needs-revision');expect(s.planning!.blueprint.blocks).toHaveLength(8);});
 it('stores blueprint and proposals in the verified revision for recovery',async()=>{const s=await propose([group('product')]);const manifest=JSON.parse(await readFile(join(path,'state','revisions',String(s.metadata.stateRevision),'manifest.json'),'utf8'));expect(manifest.files.some((f:any)=>f.filename==='blueprint.json'&&f.sha256)).toBe(true);const reload=await new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)).loadProject(path);expect(reload.planning!.changeSets[0]!.id).toBe('change-boundary');});
});
