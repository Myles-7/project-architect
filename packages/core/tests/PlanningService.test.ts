import { describe,it,expect,beforeEach,afterEach } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage, WorkspaceGuard, PlanningService, planningBasis, validateQuestionSet, blueprintCoverage } from '../src/index.js';
import type { ChangeSet, QuestionItem } from '@project-architect/contracts';

export function planningQuestion(): QuestionItem {
  return { id:'q-storage', importance:'high', issueRef:'gap:g-storage', question:'数据保存在什么地方？', area:'technical_boundary', reason:'存储会影响部署与离线体验。', recommendation:'本地文件', recommendationReason:'你的个人工具不需要远程共享。', recommendedOptionKey:'local', options:[
    {key:'local',label:'本地文件',approach:'数据保存在当前设备的项目目录。',gain:'离线使用和备份容易。',sacrifice:'跨设备需要手动迁移。',impact:'无需远程后端；支持导出。',reversibility:'moderate'},
    {key:'remote',label:'远程服务',approach:'数据上传到自建服务。',gain:'跨设备访问。',sacrifice:'需要部署维护。',impact:'增加服务和身份管理。',reversibility:'hard'},
  ],allowFreeInput:true,decisionKey:'storage:location',dependsOn:[],status:'proposed',createdAt:new Date().toISOString() };
}
describe('Planning approval safety',()=>{
  let root:string,path:string,engine:ProjectStateEngine,service:PlanningService;
  beforeEach(async()=>{
    root=await mkdtemp(join(tmpdir(),'pa-planning-')); engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root));
    await engine.createProject({name:'Planning test',idea:'个人需求规划工具',projectPath:join(root,'project'),projectId:'proj-planning'});
    path=join(root,'project'); service=new PlanningService(engine);
  });
  afterEach(async()=>{await rm(root,{recursive:true,force:true});});
  async function proposal(id='change-1'):Promise<ChangeSet>{const s=await service.get(path);return {id,runId:'run-1',stage:'technical',basis:planningBasis(s),summary:'存储方案',createdAt:new Date().toISOString(),status:'pending',approvals:[],evidence:[],groups:[{id:'storage',title:'存储',impact:'本地持久化',dependsOn:[],blocks:[],removeBlockIds:[],decisions:[{decisionKey:'storage:location',area:'technical_boundary',statement:'数据保存为本地文件，支持备份导出。',rationale:'自用，方便恢复。',evidenceIds:[]}],status:'pending'}]};}
  it('draft never confirms; approval is atomic and idempotent and preserves provenance',async()=>{
    const before=await service.get(path);const c=await proposal(); const draft=await service.propose(path,c);
    expect(draft.decisions.items).toEqual(before.decisions.items);
    const intent={operationId:'approval-1',expectedRevision:draft.metadata.stateRevision,groupIds:['storage']};
    const approved=await service.approve(path,c.id,intent);
    expect(approved.decisions.items.find(d=>d.decisionKey==='storage:location')?.approvalSource).toContain('approval-1');
    const again=await service.approve(path,c.id,intent);expect(again.metadata.stateRevision).toBe(approved.metadata.stateRevision);
    await expect(service.approve(path,c.id,{...intent,groupIds:['other']})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
    const manifest=await new FileStorage().readJson<any>(join(path,'state','revisions',String(approved.metadata.stateRevision),'manifest.json'));
    expect(manifest.files.map((f:any)=>f.filename)).toEqual(expect.arrayContaining(['planning.json','blueprint.json','changesets.json']));
  });
  it('refuses stale proposals and locked replacement without partial writes',async()=>{
    let s=await service.propose(path,await proposal());s=await service.approve(path,'change-1',{operationId:'approve',expectedRevision:s.metadata.stateRevision,groupIds:['storage']});
    const original=s.decisions.items.find(d=>d.decisionKey==='storage:location')!;
    await engine.lockDecision(path,`decision:${original.id}`,s.metadata.stateRevision);
    const c=await proposal('change-2');s=await service.propose(path,c);
    const rev=s.metadata.stateRevision;
    await expect(service.approve(path,c.id,{operationId:'locked',expectedRevision:rev,groupIds:['storage']})).rejects.toMatchObject({code:'LOCKED_CONFLICT'});
    expect((await service.get(path)).metadata.stateRevision).toBe(rev);
    s=await service.recordInput(path,'改成远程共享',rev,'new-input');
    await expect(service.approve(path,c.id,{operationId:'stale',expectedRevision:s.metadata.stateRevision,groupIds:['storage'],unlockIds:[original.id]})).rejects.toMatchObject({code:'STALE_BASIS'});
  });
  it('allows a user to save draft lock intent, applies it only on approval, and requires explicit unlock for replacement',async()=>{
    const c=await proposal('lockable-block');c.groups[0]!.blocks=[{id:'local-storage',stage:'technical',kind:'module',title:'本地存储',content:'本地存储模块负责原子保存，失败后保留原始内容并提供重试。',dependsOn:[],requirementIds:[],evidenceIds:[]}];
    let s=await service.propose(path,c);const groups=structuredClone(c.groups);groups[0]!.blocks[0]!.locked=true;
    s=await service.edit(path,c.id,groups,s.metadata.stateRevision,'set-draft-lock');
    expect(s.planning!.blueprint.blocks).toEqual([]);expect((await service.get(path)).planning!.changeSets.find(change=>change.id===c.id)!.groups[0]!.blocks[0]!.locked).toBe(true);
    s=await service.approve(path,c.id,{operationId:'approve-lock',expectedRevision:s.metadata.stateRevision,groupIds:['storage']});
    expect(s.planning!.blueprint.blocks[0]!.locked).toBe(true);expect(s.planning!.blueprint.blocks[0]!.approvedBy).toBe('approve-lock');
    const replacement=await proposal('replace-lock');replacement.groups[0]!.blocks=[{...c.groups[0]!.blocks[0]!,content:'本地存储模块新增保存失败的诊断记录，并保留原始内容供用户重试。'}];
    s=await service.propose(path,replacement);const revision=s.metadata.stateRevision;
    await expect(service.approve(path,replacement.id,{operationId:'no-unlock',expectedRevision:revision,groupIds:['storage']})).rejects.toMatchObject({code:'LOCKED_CONFLICT'});
    expect((await service.get(path)).metadata.stateRevision).toBe(revision);
    s=await service.approve(path,replacement.id,{operationId:'explicit-unlock',expectedRevision:revision,groupIds:['storage'],unlockIds:['local-storage']});
    expect(s.planning!.blueprint.blocks[0]!.content).toBe(replacement.groups[0]!.blocks[0]!.content);expect(s.planning!.blueprint.blocks[0]!.locked).not.toBe(true);
  });
  it.each([{locked:'true'}, {approvedBy:'pretend-approval'}, {approvedAt:'2026-10-04T00:00:00Z'}])('rejects invalid hand-edit metadata without any write: %j',async(metadata)=>{
    const c=await proposal('manual-metadata');c.groups[0]!.blocks=[{id:'local-storage',stage:'technical',kind:'module',title:'本地存储',content:'本地存储模块负责原子保存，失败保留原内容。',dependsOn:[],requirementIds:[],evidenceIds:[]}];
    const s=await service.propose(path,c),groups=structuredClone(c.groups);Object.assign(groups[0]!.blocks[0]!,metadata);
    await expect(service.edit(path,c.id,groups,s.metadata.stateRevision,'invalid-manual-metadata')).rejects.toMatchObject({code:'INVALID_CHANGESET'});
    expect((await service.get(path)).metadata.stateRevision).toBe(s.metadata.stateRevision);
  });
  it('continues to reject Provider-origin lock and approval metadata',async()=>{
    const c=await proposal('agent-metadata');c.groups[0]!.blocks=[{id:'local-storage',stage:'technical',kind:'module',title:'本地存储',content:'本地存储模块负责原子保存，失败保留原内容。',dependsOn:[],requirementIds:[],evidenceIds:[],locked:true}];
    const before=await service.get(path);await expect(service.propose(path,c)).rejects.toMatchObject({code:'INVALID_CHANGESET'});
    expect(service.draftIssues(before,{groups:c.groups,evidence:[]})).toEqual(expect.arrayContaining([expect.stringContaining('INVALID_CHANGESET')]));
    expect((await service.get(path)).metadata.stateRevision).toBe(before.metadata.stateRevision);
  });
  it('detects missing block and decision evidence before independent review without changing state',async()=>{
    const c=await proposal('missing-evidence');
    c.groups[0]!.blocks=[{id:'storage-module',stage:'technical',kind:'module',title:'存储模块',content:'存储失败时保留原始输入并提供重试。',dependsOn:[],requirementIds:[],evidenceIds:['evidence-invented-context-hash']}];
    c.groups[0]!.decisions[0]!.evidenceIds=['evidence-absent-decision'];
    const before=await service.get(path);
    expect(service.draftIssues(before,c)).toEqual(expect.arrayContaining([
      expect.stringContaining('storage-module 引用了缺失证据 evidence-invented-context-hash'),
      expect.stringContaining('storage:location 引用了缺失证据 evidence-absent-decision'),
    ]));
    expect((await service.get(path))).toEqual(before);
  });
  it('allows exact approved and own proposal evidence but requires pending sibling evidence to be supplied',async()=>{
    const first=await proposal('first-evidence');
    first.evidence=[{id:'approved-source',kind:'user',source:'project:idea',content:'个人需求规划工具',obtainedAt:'2026-10-05T00:00:00Z',applicability:'存储设计'}];
    first.groups[0]!.decisions[0]!.evidenceIds=['approved-source'];
    let snapshot=await service.propose(path,first);
    snapshot=await service.approve(path,first.id,{operationId:'approve-source',expectedRevision:snapshot.metadata.stateRevision,groupIds:['storage']});
    const sibling=await proposal('pending-sibling');
    sibling.evidence=[{...first.evidence[0]!,id:'pending-source',content:'待批准的来源记录'}];
    snapshot=await service.propose(path,sibling);
    const next=await proposal('next-evidence');
    next.groups[0]!.blocks=[{id:'storage-module',stage:'technical',kind:'module',title:'存储模块',content:'存储失败时保留原始输入并提供重试。',dependsOn:[],requirementIds:[],evidenceIds:['approved-source','pending-source']}];
    expect(service.draftIssues(snapshot,next).join(' ')).toContain('缺失证据 pending-source');
    next.evidence=structuredClone(sibling.evidence);
    expect(service.draftIssues(snapshot,next)).toEqual([]);
  });
  it('free text and delegation preserve raw input without confirmed decisions',async()=>{
    let s=await service.get(path);const originalCount=s.decisions.items.length;
    s=await service.installQuestions(path,planningBasis(s),[planningQuestion()],'run-q');
    s=await engine.answerQuestion(path,`question:${s.questions.items[0]!.id}`,'有没有 GitHub 项目能实现？',s.metadata.stateRevision);
    expect(s.decisions.items.length).toBe(originalCount);expect(s.planning!.inputs.at(-1)?.kind).toBe('question');
    const q=planningQuestion();q.decisionKey='storage:delegate';
    s=await service.installQuestions(path,planningBasis(s),[q],'run-delegate');
    s=await service.answer(path,[{questionId:s.questions.items[0]!.id,kind:'delegate'}],s.metadata.stateRevision,'delegate');
    expect(s.decisions.items.length).toBe(originalCount);expect(s.planning!.inputs.at(-1)?.kind).toBe('delegation');
  });
  it('explicit choices retain topic and survive reload, resolved topic does not get repeated',async()=>{
    let s=await service.get(path);s=await service.installQuestions(path,planningBasis(s),[planningQuestion()],'run');
    s=await service.answer(path,[{questionId:s.questions.items[0]!.id,kind:'selection',optionKeys:['local']}],s.metadata.stateRevision,'select');
    const reloaded=await service.get(path);expect(reloaded.decisions.items.find(d=>d.decisionKey==='storage:location')?.status).toBe('confirmed');
    expect(validateQuestionSet([planningQuestion()],reloaded.planning!)).toContain('主题 storage:location 已回答或委托，缺少重问原因');
  });
  it('persists explicit selection keys and kind with the full original options across a fresh engine reload',async()=>{
    let s=await service.get(path);const originalCount=s.decisions.items.length;const q={...planningQuestion(),selectionMode:'multiple' as const};
    s=await service.installQuestions(path,planningBasis(s),[q],'run-structured-answer');const questionId=s.questions.items[0]!.id;
    s=await service.answer(path,[{questionId,kind:'selection',optionKeys:['remote','local']}],s.metadata.stateRevision,'structured-select');
    const restarted=new PlanningService(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)));
    const reloaded=await restarted.get(path);const saved=reloaded.questions.items.find(item=>item.id===questionId)!;
    expect(saved).toMatchObject({answerKind:'selection',selectedOptionKeys:['remote','local'],answer:'本地文件、远程服务',options:q.options});
    const disk=await new FileStorage().readJson<{items:QuestionItem[]}>(join(path,'state','questions.json'));
    expect(disk.items.find(item=>item.id===questionId)).toEqual(saved);
    expect(reloaded.decisions.items).toHaveLength(originalCount+1);
    expect(reloaded.decisions.items.at(-1)?.statement).toBe(`${q.question}\n本地文件：数据保存在当前设备的项目目录。\n远程服务：数据上传到自建服务。`);
  });
  it.each(['custom','delegate','defer'] as const)('persists %s kind and raw text without selection keys or confirmation',async(kind)=>{
    let s=await service.get(path);const decisions=structuredClone(s.decisions.items);
    s=await service.installQuestions(path,planningBasis(s),[planningQuestion()],`run-${kind}`);const questionId=s.questions.items[0]!.id;
    const raw='  本地文件\n这段原话附有额外限制。  ';
    await service.answer(path,[{questionId,kind,text:raw,optionKeys:['local']}],s.metadata.stateRevision,`structured-${kind}`);
    const reloaded=await new PlanningService(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root))).get(path);
    const saved=reloaded.questions.items.find(item=>item.id===questionId)!;
    expect(saved).toMatchObject({answerKind:kind,answer:raw,status:kind==='defer'?'dismissed':'answered'});
    expect(saved).not.toHaveProperty('selectedOptionKeys');
    expect(reloaded.planning!.inputs.at(-1)).toMatchObject({raw,questionId});
    expect(reloaded.decisions.items).toEqual(decisions);
  });
  it('rejects dependent question batch, poor choices, vague readiness and orphaned group approval',async()=>{
    const s=await service.get(path);const a=planningQuestion(),b={...planningQuestion(),id:'q-b',decisionKey:'storage:secondary',dependsOn:['storage:location']};
    expect(validateQuestionSet([a,b],s.planning!).join(' ')).toContain('存在依赖');
    expect(validateQuestionSet([{...a,options:a.options.map(o=>({...o,gain:undefined}))}],s.planning!).join(' ')).toContain('缺少具体取舍');
    expect(blueprintCoverage([]).length).toBeGreaterThan(10);
    const c=await proposal();c.groups.push({...c.groups[0]!,id:'dependent',dependsOn:['storage']});
    const draft=await service.propose(path,c);
    await expect(service.approve(path,c.id,{operationId:'orphan',expectedRevision:draft.metadata.stateRevision,groupIds:['dependent']})).rejects.toMatchObject({code:'DEPENDENCY_CONFLICT'});
  });
});
