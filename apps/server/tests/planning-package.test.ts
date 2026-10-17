import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { mkdtemp,rm,readFile,writeFile,unlink,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { BlueprintBlock, ChangeSet, PlanningPackageTaskFile } from '@project-architect/contracts';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStateEngine,FileStorage,WorkspaceGuard,PlanningService,planningBasis,planningInputHash } from '@project-architect/core';
import { PlanningPackageCompiler } from '../src/planning/PlanningPackageCompiler.js';
import { group } from '../../../tests/fixtures/planning.mjs';

describe('Approved development package publication',()=>{
  let root:string,path:string,service:PlanningService,compiler:PlanningPackageCompiler;
  beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'pa-package-'));path=join(root,'project');const engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root));await engine.createProject({name:'笔记工具',idea:'个人笔记工具',projectPath:path});service=new PlanningService(engine);compiler=new PlanningPackageCompiler(service);
    for(const stage of ['product','technical','delivery'] as const){const s=await service.get(path);const c={id:`change-${stage}`,runId:`run-${stage}`,stage,basis:planningBasis(s),summary:'测试阶段',groups:[group(stage)],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};const proposed=await service.propose(path,c as any);await service.approve(path,c.id,{operationId:`approve-${stage}`,expectedRevision:proposed.metadata.stateRevision,groupIds:[`${stage}-group`]});}});
  afterEach(async()=>{await rm(root,{recursive:true,force:true});});
  async function compile(id='package-1'){const s=await service.get(path);return compiler.compile(path,s.metadata.stateRevision,id);}
  async function approveBlueprint(edit:(blocks:BlueprintBlock[])=>BlueprintBlock[],id='graph'){
    const s=await service.get(path);
    const proposedBlocks=edit(structuredClone(s.planning!.blueprint.blocks)).map(block=>{delete block.approvedBy;delete block.approvedAt;delete block.locked;return block;});
    const c:ChangeSet={id:`change-${id}`,runId:`run-${id}`,stage:'feedback',basis:planningBasis(s),summary:'审阅完整任务依赖图',groups:[{id:`group-${id}`,title:'完整方案',impact:'明确登记的任务前置关系',dependsOn:[],blocks:proposedBlocks,removeBlockIds:[],decisions:[],status:'pending'}],evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]};
    const proposed=await service.propose(path,c);return service.approve(path,c.id,{operationId:`approve-${id}`,expectedRevision:proposed.metadata.stateRevision,groupIds:[`group-${id}`]});
  }
  function task(template:BlueprintBlock,id:string,dependsOn:string[]=[],kind:'task'|'validation'='task'):BlueprintBlock{
    return {...structuredClone(template),id,title:`任务 ${id}`,kind,dependsOn,task:{...structuredClone(template.task!),...(kind==='validation'?{environment:'独立临时目录与 Node',steps:['建立临时目录并执行能力试验'],passCriteria:['实际结果符合预期'],evidenceRequired:['环境与执行日志'],onFailure:'保存失败证据并提交方案反馈'}:{})}};
  }
  async function readTasks(manifest:Awaited<ReturnType<typeof compile>>):Promise<PlanningPackageTaskFile>{return JSON.parse(await readFile(join(path,manifest.directory,'tasks.json'),'utf8'));}

  it('blocks compilation until every feedback group is reviewed and preserves the approved subset',async()=>{
    let s=await service.get(path);
    const previouslyReviewed=s.planning!.blueprint.approvedInputHash;
    s=await service.recordInput(path,'开发反馈：两组独立流程需要跨阶段修订',s.metadata.stateRevision,'partial-feedback-input','feedback');
    const blocks=['product','technical','delivery'].flatMap(stage=>group(stage).blocks);
    const draft=(id:string,ids:string[])=>({id,title:`修订 ${id}`,impact:'修订相应产品、技术和交付内容',dependsOn:[],blocks:blocks.filter(block=>ids.includes(block.id)).map(block=>({...block,content:`${block.content} 已审阅修订 ${id}。`})),removeBlockIds:[],decisions:[],status:'pending' as const});
    const c:ChangeSet={id:'partial-feedback',runId:'partial-feedback-run',stage:'feedback',basis:planningBasis(s),summary:'两组独立反馈',groups:[draft('a',['notes','stack','implement-notes']),draft('b',['scope','notes-module','accept-notes'])],evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]};
    s=await service.propose(path,c);
    s=await service.approve(path,c.id,{operationId:'approve-feedback-a',expectedRevision:s.metadata.stateRevision,groupIds:['a']});
    await expect(compile('partial-feedback-package')).rejects.toMatchObject({code:'STAGE_NOT_APPROVED'});
    expect(s.planning!.changeSets.find(change=>change.id===c.id)!.status).toBe('partially-approved');
    expect(s.planning!.blueprint.blocks.find(block=>block.id==='notes')!.content).toContain('已审阅修订 a');
    expect(s.planning!.blueprint.blocks.find(block=>block.id==='scope')!.content).not.toContain('已审阅修订 b');
    expect(s.planning!.blueprint.approvedInputHash).toBe(previouslyReviewed);
    expect(Object.values(s.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);
    expect((await readdir(join(path,'artifacts','packages')).catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return [];throw error;}))).toEqual([]);
    const revision=s.metadata.stateRevision;
    s=await service.reject(path,c.id,['b'],revision,'reject-feedback-b');
    expect(s.planning!.blueprint.stages).toEqual({product:'approved',technical:'approved',delivery:'approved'});
    expect(s.planning!.blueprint.approvedInputHash).toBe(planningInputHash(s));
    expect((await service.reject(path,c.id,['b'],revision,'reject-feedback-b')).metadata.stateRevision).toBe(s.metadata.stateRevision);
    const manifest=await compile('finished-feedback-package');
    expect(await compiler.read(path,'PRODUCT.md')).toContain('已审阅修订 a');
    expect(await compiler.read(path,'PROJECT.md')).not.toContain('已审阅修订 b');
    expect(manifest.sourceRevision).toBe(s.metadata.stateRevision);
  });

  it.each([
    {name:'a non-task-only cycle unreachable from tasks',cycle:true,error:'循环依赖'},
    {name:'a missing dependency reference unreachable from tasks',cycle:false,error:'依赖不存在：missing-blueprint-ref'},
  ])('rejects $name before publishing any package artifacts',async({cycle,error})=>{
    const approved=await service.get(path);const damaged=structuredClone(approved);
    const template=damaged.planning!.blueprint.blocks.find(block=>block.id==='notes-module')!;
    damaged.planning!.blueprint.blocks.push({...structuredClone(template),id:'unvisited-invalid-a',dependsOn:[cycle?'unvisited-invalid-b':'missing-blueprint-ref']});
    if(cycle)damaged.planning!.blueprint.blocks.push({...structuredClone(template),id:'unvisited-invalid-b',dependsOn:['unvisited-invalid-a']});
    // Simulate damaged storage at the read seam only; invalid graphs are never submitted as approved input.
    const read=vi.spyOn(service,'get').mockResolvedValue(damaged);
    const publish=vi.spyOn(service,'publishPackage');
    await expect(compiler.compile(path,damaged.metadata.stateRevision,'damaged-package')).rejects.toMatchObject({code:'PACKAGE_INCOMPLETE',message:expect.stringContaining(error)});
    expect(publish).not.toHaveBeenCalled();
    expect(damaged.planning!.package).toBeUndefined();
    const artifacts=await readdir(join(path,'artifacts','packages')).catch((failure:NodeJS.ErrnoException)=>{if(failure.code==='ENOENT')return [];throw failure;});
    expect(artifacts).toEqual([]);
    read.mockRestore();publish.mockRestore();
    const persisted=await service.get(path);
    expect(persisted.planning!.package).toBeUndefined();
    expect(persisted.planning!.blueprint).toEqual(approved.planning!.blueprint);
  });

  it('projects indirect approved blueprint prerequisites, stops at the first task, and shares the order across entry and plan',async()=>{
    const approved=await approveBlueprint(blocks=>{
      const implement=blocks.find(b=>b.id==='implement-notes')!;
      blocks.find(b=>b.id==='notes-api')!.dependsOn=['notes-module'];
      blocks.find(b=>b.id==='notes-module')!.dependsOn=['z-prepare-storage'];
      return [...blocks,task(implement,'z-prepare-storage',['zz-bootstrap']),task(implement,'zz-bootstrap')];
    });
    const source=structuredClone(approved.planning!.blueprint);
    const m=await compile();const data=await readTasks(m);
    expect(data.tasks.map((t:{id:string})=>t.id)).toEqual(['zz-bootstrap','z-prepare-storage','implement-notes']);
    expect(data.tasks.find((t:{id:string})=>t.id==='implement-notes')).toMatchObject({dependsOn:['z-prepare-storage'],blueprintDependsOn:['notes-api']});
    expect(data.tasks.find((t:{id:string})=>t.id==='z-prepare-storage').dependsOn).toEqual(['zz-bootstrap']);
    expect(data.schemaVersion).toBe(2);
    expect(data.blueprintReferences.find((b:{id:string})=>b.id==='notes-api')).toEqual({id:'notes-api',title:'笔记接口',kind:'interface',stage:'technical',dependsOn:['notes-module'],requirementIds:['notes']});
    expect(data.blueprintReferences.some((b:{kind:string})=>['task','validation'].includes(b.kind))).toBe(false);
    const exportedIds=new Set(data.tasks.map((t:{id:string})=>t.id));
    expect(data.tasks.every((t:{dependsOn:string[]})=>t.dependsOn.every(id=>exportedIds.has(id)))).toBe(true);
    const plan=await compiler.read(path,'DEVELOPMENT_PLAN.md');
    expect([...plan.matchAll(/^ID：([^；]+)；/gm)].map(match=>match[1])).toEqual(data.tasks.map((t:{id:string})=>t.id));
    expect(plan).toContain('任务前置：z-prepare-storage');
    expect(plan).toContain('蓝图原始依赖：notes-api');
    const entry=await compiler.read(path,'START_HERE.md');
    expect(entry).toContain('首个可执行任务：zz-bootstrap');
    expect(entry).toContain('仅沿已批准蓝图的 dependsOn');
    expect(entry).toContain('requirementIds 不推断前置');
    expect((await service.get(path)).planning!.blueprint).toEqual(source);
  });

  it('does not tell a developer to run integration validation before its required implementation',async()=>{
    await approveBlueprint(blocks=>{
      const implement=blocks.find(block=>block.id==='implement-notes')!;
      return [...blocks,task(implement,'z-integration-validation',['implement-notes'],'validation')];
    },'integration-order');
    const manifest=await compile('integration-order-package'),data=await readTasks(manifest);
    expect(data.tasks.map(item=>item.id)).toEqual(['implement-notes','z-integration-validation']);
    expect(data.tasks[1]!.dependsOn).toEqual(['implement-notes']);
    const entry=await compiler.read(path,'START_HERE.md');
    expect(entry).toContain('首个可执行任务：implement-notes');
    expect(entry).not.toContain('先完成前置验证');
  });

  it('topologically orders shuffled inputs with deterministic multiple roots and a validation prerequisite',async()=>{
    const approved=await approveBlueprint(blocks=>{
      const implement=blocks.find(b=>b.id==='implement-notes')!;
      implement.dependsOn=['notes-api','b-root','a-root','notes-api'];
      blocks.find(b=>b.id==='notes-api')!.dependsOn=['notes-module'];
      blocks.find(b=>b.id==='notes-module')!.dependsOn=['z-validate-storage'];
      return [...blocks,task(implement,'b-root'),task(implement,'z-validate-storage',[],'validation'),task(implement,'a-root')].reverse();
    },'shuffled');
    const first=await readTasks(await compile('shuffle-package'));
    expect(first.tasks.map((t:{id:string})=>t.id)).toEqual(['a-root','b-root','z-validate-storage','implement-notes']);
    expect(first.tasks.find((t:{id:string})=>t.id==='implement-notes').dependsOn).toEqual(['a-root','b-root','z-validate-storage']);
    expect(first.tasks.find((t:{id:string})=>t.id==='z-validate-storage').kind).toBe('validation');
    expect(first.tasks.find((t:{id:string})=>t.id==='implement-notes').blueprintDependsOn).toEqual(['notes-api','b-root','a-root','notes-api']);
    await approveBlueprint(()=>[...structuredClone(approved.planning!.blueprint.blocks)].reverse(),'reshuffled');
    const second=await readTasks(await compile('reshuffle-package'));
    expect(second.tasks).toEqual(first.tasks);
    expect(second.blueprintReferences).toEqual(first.blueprintReferences);
  });

  it('does not invent task edges from shared or task-valued requirementIds',async()=>{
    await approveBlueprint(blocks=>{
      const implement=blocks.find(b=>b.id==='implement-notes')!;
      implement.requirementIds=['notes','a-unrelated'];
      const reference=blocks.find(b=>b.id==='notes-api')!;reference.requirementIds=['notes','a-unrelated'];
      return [...blocks,task(implement,'a-unrelated')];
    });
    const data=await readTasks(await compile());
    expect(data.tasks.map((t:{id:string;dependsOn:string[]})=>({id:t.id,dependsOn:t.dependsOn}))).toEqual([{id:'a-unrelated',dependsOn:[]},{id:'implement-notes',dependsOn:[]}]);
    expect(data.tasks.find((t:{id:string})=>t.id==='implement-notes').blueprintDependsOn).toEqual(['notes-api']);
    expect(data.tasks.find((t:{id:string})=>t.id==='implement-notes').requirementIds).toEqual(['notes','a-unrelated']);
    expect(data.blueprintReferences.find((b:{id:string})=>b.id==='notes-api').requirementIds).toEqual(['notes','a-unrelated']);
  });

  it('keeps historical schemaVersion 1 bytes readable and does not upgrade an existing manifest',async()=>{
    const s=await service.get(path);const publish=service.publishPackage.bind(service);
    const intercepted=vi.spyOn(service,'publishPackage').mockImplementationOnce(async(projectPath,manifest,revision)=>{
      const filePath=join(projectPath,manifest.directory,'tasks.json');const current=JSON.parse(await readFile(filePath,'utf8'));
      const legacy=JSON.stringify({schemaVersion:1,revision:current.revision,blueprintHash:current.blueprintHash,tasks:current.tasks.map((entry:{id:string;title:string;kind:string;dependsOn:string[];blueprintDependsOn?:string[]})=>{const {blueprintDependsOn,...old}=entry;return {...old,dependsOn:blueprintDependsOn??entry.dependsOn};})},null,2)+'\n';
      await writeFile(filePath,legacy);manifest.files.find(file=>file.name==='tasks.json')!.sha256=createHash('sha256').update(legacy).digest('hex');
      await writeFile(join(projectPath,manifest.directory,'package-manifest.json'),JSON.stringify(manifest,null,2));
      return publish(projectPath,manifest,revision);
    });
    const manifest=await compiler.compile(path,s.metadata.stateRevision,'historical-package');intercepted.mockRestore();
    const legacy=await readFile(join(path,manifest.directory,'tasks.json'),'utf8');
    expect(JSON.parse(legacy).schemaVersion).toBe(1);
    expect(await compiler.read(path,'tasks.json')).toBe(legacy);
    expect(await compiler.compile(path,manifest.sourceRevision,manifest.operationId)).toEqual(manifest);
    expect(await readFile(join(path,manifest.directory,'tasks.json'),'utf8')).toBe(legacy);
    expect((await compiler.export(path)).subarray(0,4).toString('hex')).toBe('504b0304');
  });
  it('refuses to reissue an old approved blueprint after unreviewed input or material changes',async()=>{await compile('before-change');let s=await service.get(path);s=await service.recordInput(path,'改成多用户共享笔记，增加账号',s.metadata.stateRevision,'new-scope');expect(Object.values(s.planning!.blueprint.stages).every(v=>v==='approved')).toBe(true);await expect(compile('after-change')).rejects.toMatchObject({code:'UNREVIEWED_INPUT'});});
  it('compiles distinct documents, matching task data, hashes and actual ZIP',async()=>{await writeFile(join(path,'documents','USER_NOTES.md'),'用户手工说明：先完成离线笔记。');const m=await compile();expect(m.files).toHaveLength(11);const documents=await Promise.all(m.files.filter(f=>f.name.endsWith('.md')).map(f=>readFile(join(path,m.directory,f.name),'utf8')));expect(new Set(documents).size).toBe(documents.length);const tasks=JSON.parse(await readFile(join(path,m.directory,'tasks.json'),'utf8'));expect(tasks.tasks[0].id).toBe('implement-notes');expect(tasks.blueprintHash).toBe(m.basisHash);expect(tasks.revision).toBe(m.sourceRevision);expect(await readFile(join(path,m.directory,'USER_NOTES.md'),'utf8')).toContain('用户手工说明');const zip=await compiler.export(path);expect(zip.subarray(0,4).toString('hex')).toBe('504b0304');expect(zip.includes(Buffer.from('START_HERE.md'))).toBe(true);expect((await service.get(path)).planning!.package).toEqual(m);});
  it('checks idempotent requests against revision and all file contents',async()=>{const m=await compile();expect(await compiler.compile(path,m.sourceRevision,m.operationId)).toEqual(m);await expect(compiler.compile(path,m.sourceRevision+1,m.operationId)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});await unlink(join(path,m.directory,'PRODUCT.md'));await expect(compiler.compile(path,m.sourceRevision,m.operationId)).rejects.toMatchObject({code:'PACKAGE_INCOMPLETE'});await expect(compiler.export(path)).rejects.toMatchObject({code:'PACKAGE_INCOMPLETE'});});
  it('recovers only verified artifacts after publication failure and permits a new operation',async()=>{const publish=service.publishPackage.bind(service);const spy=vi.spyOn(service,'publishPackage').mockRejectedValueOnce(new Error('EIO after complete compilation'));const s=await service.get(path);await expect(compiler.compile(path,s.metadata.stateRevision,'opA')).rejects.toThrow('EIO');expect((await service.get(path)).planning!.package).toBeUndefined();spy.mockImplementation(publish);const b=await compiler.compile(path,s.metadata.stateRevision,'opB');expect(b.operationId).toBe('opB');expect(b.directory).toBeTruthy();});
  it('refuses damaged unpublished output without publishing half a package',async()=>{const spy=vi.spyOn(service,'publishPackage').mockRejectedValueOnce(new Error('EIO'));const s=await service.get(path);await expect(compiler.compile(path,s.metadata.stateRevision,'opA')).rejects.toThrow('EIO');const fs=await import('node:fs/promises');const dirs=await fs.readdir(join(path,'artifacts','packages'));await writeFile(join(path,'artifacts','packages',dirs[0]!,'PRODUCT.md'),'tampered');spy.mockRestore();await expect(compiler.compile(path,s.metadata.stateRevision,'opA')).rejects.toMatchObject({code:'PACKAGE_MODIFIED'});expect((await service.get(path)).planning!.package).toBeUndefined();});
  it('invalidates exports when requirements change after approval',async()=>{const m=await compile();let s=await service.get(path);s=await service.recordInput(path,'改成多人协作',s.metadata.stateRevision,'new');await expect(compiler.export(path)).rejects.toMatchObject({code:'STALE_BASIS'});expect(m.basisHash).not.toBe(planningBasis(s).hash);});
});
