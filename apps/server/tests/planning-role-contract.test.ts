import { describe, expect, it, vi } from 'vitest';
import { Ajv } from 'ajv';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { PlanningTaskKind } from '@project-architect/contracts';
import { PLANNING_TASK_SCHEMA } from '@project-architect/contracts';
import { assertTaskResult,FileStorage,ProjectStateEngine,WorkspaceGuard,planningBasis } from '@project-architect/core';
import * as schemas from '../src/planning/PlanningSchema.js';
import { planningPrompt } from '../src/planning/PlanningPrompt.js';
import { partitionSchema, validatePartitionResult } from '../src/planning/PlanningTaskPartition.js';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { result, group, clarification, question } from '../../../tests/fixtures/planning.mjs';

const ajv = new Ajv({ allErrors: true, strict: false });
const selectSchema = schemas.planningTaskSchema;
const validate = (kind: PlanningTaskKind, value: unknown) => ajv.compile(selectSchema(kind))(value);
const supportRoles = ['research', 'validation', 'review'] as const;
const authoringRoles = ['clarification', 'design', 'integration', 'revision'] as const;
const proof = { id: 'synthetic-proof', kind: 'experiment', source: 'experiment:synthetic-unavailable', content: '契约测试记录：目标验证环境不可用。', obtainedAt: '2026-10-04T00:00:00Z', applicability: '保存失败恢复', environment: 'synthetic fixture', outcome: 'unexecuted' };

describe('Planning worker role output contracts', () => {
  it('exports a selector that can constrain non-design workers independently', () => {
    expect(schemas.planningTaskSchema).toBeTypeOf('function');
  });

  it.each(supportRoles)('validates %s role boundaries even when a Provider reports structured success', kind => {
    const output = result({ groups: [group('product')] });
    expect(() => schemas.assertPlanningTaskRole(output, kind)).toThrow(/INVALID_STRUCTURED_RESULT/);
  });

  it('validates forbidden review questions and follow-ups after a Provider returns them', () => {
    for (const output of [result({ questions: [question()] }), result({ followUp: [{ kind: 'validation', goal: '未来真实应用测量' }] })]) {
      expect(() => schemas.assertPlanningTaskRole(output, 'review')).toThrow(/INVALID_STRUCTURED_RESULT/);
    }
  });

  it.each(supportRoles)('accepts honest %s role results through the runtime boundary', kind => {
    expect(() => schemas.assertPlanningTaskRole(result({ evidence: [proof], blockers: ['目标平台尚未提供，需要开发验证任务。'] }), kind)).not.toThrow();
  });

  it.each(supportRoles)('permits omitted or empty workItems but rejects decomposition work from a %s worker', kind => {
    for (const output of [result(), result({ workItems: [] })]) {
      expect(validate(kind, output)).toBe(true);
      expect(() => schemas.assertPlanningTaskRole(output, kind)).not.toThrow();
    }
    const output = result({ workItems: [{ id: 'part-notes', goal: '重设计笔记功能', blockIds: ['notes'], dependsOn: [] }] });
    expect(ajv.compile(PLANNING_TASK_SCHEMA)(output)).toBe(true);
    expect(validate(kind, output)).toBe(false);
    expect(() => schemas.assertPlanningTaskRole(output, kind)).toThrow(/INVALID_STRUCTURED_RESULT/);
  });

  it.each(supportRoles)('rejects full blueprint groups from a %s worker', kind => {
    const output = result({ groups: [group('product')] });
    expect(ajv.compile(PLANNING_TASK_SCHEMA)(output)).toBe(true);
    expect(validate(kind, output)).toBe(false);
  });

  it.each(supportRoles)('rejects clarification content from a %s worker', kind => {
    expect(validate(kind, result({ clarification }))).toBe(false);
  });

  it.each(supportRoles)('rejects user questions from a %s worker', kind => {
    expect(validate(kind, result({ questions: [question()] }))).toBe(false);
  });

  it('rejects follow-up work from an independent reviewer', () => {
    expect(validate('review', result({ followUp: [{ kind: 'validation', goal: '验证保存失败恢复' }] }))).toBe(false);
  });

  it.each(['research', 'validation'] as const)('accepts %s evidence, concrete blockers and registered follow-ups in the unified result shape', kind => {
    const output = result({ evidence: [proof], blockers: ['note-write 缺少目标平台的实际恢复证据。'], followUp: [{ kind: 'research', goal: '核对官方恢复约束' }, { kind: 'validation', goal: '验证可执行的最小恢复程序' }] });
    expect(validate(kind, output)).toBe(true);
    expect(() => assertTaskResult(output)).not.toThrow();
    for (const field of ['summary', 'groups', 'questions', 'evidence', 'blockers', 'followUp', 'clarification']) {
      const missing = { ...output }; delete (missing as any)[field];
      expect(validate(kind, missing)).toBe(false);
    }
    expect(validate(kind, { ...output, confirmed: ['模型无权确认'] })).toBe(false);
  });

  it('accepts review findings without requiring design output or new work', () => {
    const output = result({ evidence: [proof], blockers: ['notes-flow 与 notes-api 的失败后恢复行为不一致。'] });
    expect(validate('review', output)).toBe(true);
    expect(() => assertTaskResult(output)).not.toThrow();
  });

  it.each(authoringRoles)('retains complete design content while forbidding work registration for %s workers', kind => {
    expect((selectSchema(kind) as any).properties.workItems.maxItems).toBe(0);
    expect(planningPrompt('technical',kind,'本登记角色任务')).toContain('workItems 不输出');
    expect(validate(kind, result({ groups: [group('delivery')], clarification, questions: [question()] }))).toBe(true);
    expect(() => schemas.assertPlanningTaskRole(result({ groups: [group('delivery')], clarification, questions: [question()] }), kind)).not.toThrow();
  });

  it.each(authoringRoles)('rejects nonempty workItems in the actual %s schema and acceptance boundary without dropping them', kind => {
    const output = result({ groups: [group('technical')], workItems: [{ id: 'unregistered-notes', goal: '工作者自行拆分', blockIds: ['notes-module'], dependsOn: [] }] });
    const original = structuredClone(output);
    expect(ajv.compile(PLANNING_TASK_SCHEMA)(output)).toBe(true);
    expect(validate(kind, output)).toBe(false);
    expect(() => schemas.assertPlanningTaskRole(output, kind)).toThrow(/INVALID_STRUCTURED_RESULT/);
    expect(output).toEqual(original);
  });

  it.each(authoringRoles)('accepts omitted or empty workItems from %s workers', kind => {
    for (const output of [result({groups:[group('technical')]}), result({groups:[group('technical')],workItems:[]})]) {
      expect(validate(kind,output)).toBe(true);
      expect(()=>schemas.assertPlanningTaskRole(output,kind)).not.toThrow();
    }
  });

  it('allows a complete scoped design with no work registration and keeps decomposition independent', () => {
    const output=result({groups:[group('technical')],workItems:[]});
    expect(validate('design',output)).toBe(true);
    expect(()=>schemas.assertPlanningTaskRole(output,'design')).not.toThrow();
    expect(()=>validatePartitionResult(output,{id:'tech',goal:'完整技术片',blockIds:output.groups[0]!.blocks.map(block=>block.id),dependsOn:[]},output.groups[0]!.blocks.map(block=>block.id))).not.toThrow();
    const schema=partitionSchema(),workItems=[{id:'a',goal:'接口片',blockIds:['notes-api'],dependsOn:[]},{id:'b',goal:'模块片',blockIds:['notes-module'],dependsOn:[]}];
    expect(schema.properties.workItems.minItems).toBe(2);expect(schema.properties.workItems.maxItems).toBeUndefined();
    expect(ajv.compile(schema)(result({workItems}))).toBe(true);
    expect(()=>schemas.assertPlanningTaskRole(result({workItems}),'decomposition')).not.toThrow();
    expect(ajv.compile(schema)(result({workItems:workItems.slice(0,1)}))).toBe(false);
    expect(ajv.compile(PLANNING_TASK_SCHEMA)(result({workItems}))).toBe(true);
  });

  it.each([false,true])('checks the actual scoped call schema and never adopts unauthorized workItems (illegal=%s)',async(illegal)=>{
    const root=await mkdtemp(join(tmpdir(),'pa-role-workitems-')),path=join(root,'project');
    const engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root));
    await engine.createProject({name:'登记职责验证',idea:'个人笔记工具',projectPath:path});
    const complete=group('product'),slices=[complete.blocks.slice(0,4),complete.blocks.slice(4)],scoped:any[]=[];
    const provider={async complete(request:any){
      const context=JSON.parse(request.contextText),success=(output:any)=>({structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0});
      if(context.workPartition){
        const index=context.workPartition.id==='a'?0:1;
        const output=result({groups:[{...complete,id:context.workPartition.id,blocks:slices[index]}],workItems:illegal&&index===1?[{id:'unregistered-child',goal:'工作者自行登记',blockIds:['notes'],dependsOn:[]}]:[]});
        const schema=JSON.parse(await readFile(request.schemaPath,'utf8'));
        scoped.push({schema,output:structuredClone(output),matches:ajv.compile(schema)(output)});
        return success(output);
      }
      if(request.prompt.includes('任务拆分'))return success(result({workItems:slices.map((blocks,index)=>({id:index?'b':'a',goal:`登记片 ${index}`,blockIds:blocks.map((block:any)=>block.id),dependsOn:[]}))}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return {structuredSuccess:false,status:'failed',stderr:'Your previous response was cut off because it exceeded the output token limit',durationMs:1,exitCode:0};
      return success(result());
    }};
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);
    try{
      let s=await runtime.service.get(path);s=await runtime.service.propose(path,{id:'role-base',runId:'base',stage:'product',basis:planningBasis(s),summary:'已批准产品',groups:[complete],evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]});
      s=await runtime.service.approve(path,'role-base',{expectedRevision:s.metadata.stateRevision,operationId:'approve-role-base',groupIds:[complete.id]});
      const baseline=structuredClone(s.planning!.blueprint),revision=s.metadata.stateRevision;
      const run=await runtime.start(path,{stage:'product',expectedRevision:revision,operationId:'scoped-role-contract'});
      await vi.waitFor(()=>expect((runtime as any).active.has(run.id)).toBe(false),{timeout:5000});
      const done=await runtime.get(path,run.id),snapshot=await runtime.service.get(path);
      expect(scoped).toHaveLength(2);expect(scoped.every(call=>call.schema.properties.workItems.maxItems===0)).toBe(true);
      expect(snapshot.planning!.blueprint).toEqual(baseline);expect((runtime as any).runningCalls).toBe(0);
      const proposals=snapshot.planning!.changeSets.filter(change=>change.runId===run.id);
      if(illegal){
        expect(scoped.find(call=>call.output.workItems.length)!.matches).toBe(false);
        expect(scoped.find(call=>call.output.workItems.length)!.output.workItems[0]!.id).toBe('unregistered-child');
        expect(done.status).toBe('paused');expect(done.error).toContain('workItems');expect(proposals).toEqual([]);expect(snapshot.metadata.stateRevision).toBe(revision);
      }else{
        expect(scoped.every(call=>call.matches)).toBe(true);expect(done.status).toBe('reviewable');expect(proposals).toHaveLength(1);
        expect(proposals[0]!.groups.flatMap(item=>item.blocks)).toEqual(complete.blocks);
      }
    }finally{await runtime.shutdown();await rm(root,{recursive:true,force:true});}
  });

  it('defaults new task kinds to the shared contract for separate decomposition validation', () => {
    expect(selectSchema('decomposition' as PlanningTaskKind)).toBe(PLANNING_TASK_SCHEMA);
  });

  it.each(supportRoles)('gives %s workers their role contract without current-stage design instructions', kind => {
    const stageInstructions = {
      feedback: '只修改受影响块及任务。',
      product: '生成产品与体验：',
      technical: '依据已批准产品设计生成',
      delivery: '依据已批准产品和技术生成',
      clarify: 'clarification 填写有明确证据的',
    } as const;
    for (const [stage, instruction] of Object.entries(stageInstructions)) {
      const prompt = planningPrompt(stage as keyof typeof stageInstructions, kind, '只处理本登记任务');
      expect(prompt).not.toContain(instruction);
      expect(prompt).not.toContain('块 content 提供完整具体设计');
      expect(prompt).toContain(`当前阶段：${stage}`);
      expect(prompt).toContain('本任务目标：只处理本登记任务');
      expect(prompt).toContain('groups=[]');
      expect(prompt).toContain('questions=[]');
      expect(prompt).toContain('clarification=null');
    }
  });

  it('gives validation its own role and forbids a reviewer from scheduling or questioning', () => {
    const prompt = planningPrompt('feedback', 'validation', '最小恢复验证');
    expect(prompt).toContain('你负责受控验证');
    expect(prompt).toContain('后续开发完成后在真实应用测量');
    expect(prompt).toContain('明确未执行');
    expect(prompt).toContain('需要开发验证任务');
    expect(prompt).toContain('交给登记整合任务处理，不生成 groups');
    expect(planningPrompt('feedback', 'review', '独立审阅')).toContain('followUp=[]');
  });

  it.each(supportRoles)('describes model output capacity without imposing a cost gate on %s', kind => {
    const prompt = planningPrompt('feedback', kind, '处理本登记任务');
    expect(prompt).toContain('单次输出的体积上限是模型能力边界');
    expect(prompt).toContain('不是费用、Token 预算或总调用数门禁');
    const schema = JSON.stringify(selectSchema(kind));
    expect(schema).not.toContain('maxLength');
    expect((selectSchema(kind) as any).properties.evidence.maxItems).toBeUndefined();
    expect((selectSchema(kind) as any).properties.blockers.maxItems).toBeUndefined();
  });

  it('keeps complete stage instructions for design and clarification', () => {
    expect(planningPrompt('product', 'design', '完整产品设计')).toContain('生成产品与体验：');
    expect(planningPrompt('clarify', 'clarification', '澄清')).toContain('clarification 填写有明确证据的');
    expect(planningPrompt('feedback', 'revision', '修复当前草案')).toContain('以 currentDraft 为最新修订基准');
  });
});
