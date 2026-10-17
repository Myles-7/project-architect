import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, planningBasis, hashValue, assertTaskResult, planningDependencyCycles } from '@project-architect/core';
import { PLANNING_TASK_SCHEMA, type PlanningTask } from '@project-architect/contracts';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { result, group, clarification, question } from '../../../tests/fixtures/planning.mjs';
import { assemblePartitions, batchAssembledQuestions, validatePartitionResult, validatePartitions } from '../src/planning/PlanningTaskPartition.js';
import { planningWorkerContext } from '../src/planning/PlanningContext.js';

const limit = 'Your previous response was cut off because it exceeded the output token limit';
const projects: string[] = [];
const runtimes: PlanningRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(runtime => runtime.shutdown()));
  await Promise.all(projects.splice(0).map(path => rm(path, { recursive: true, force: true })));
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'pa-output-partition-')); projects.push(root);
  const path = join(root, 'project');
  const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
  await engine.createProject({ name: '产物拆分回归', idea: '个人笔记工具', projectPath: path });
  return { root, path, engine };
}
async function settled(runtime: PlanningRuntime, path: string, id: string) {
  await vi.waitFor(() => expect((runtime as any).active.has(id)).toBe(false), { timeout: 5000 });
  return runtime.get(path, id);
}
const success = (output: any) => ({ structuredSuccess: true, status: 'success', structuredOutput: output, durationMs: 1, exitCode: 0 });
async function startProduct(runtime:PlanningRuntime,path:string){
  let snapshot=await runtime.service.get(path);const run=await runtime.start(path,{stage:'clarify',expectedRevision:snapshot.metadata.stateRevision,operationId:'clarify'});await settled(runtime,path,run.id);
  snapshot=await runtime.service.get(path);return runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:'product'});
}
function splitProvider(slices:any[][],outputs:any[],continuation:()=>any,failReviewOnce=false){
  const calls:any[]=[];
  return {calls,async complete(request:any){calls.push(request);const context=JSON.parse(request.contextText);
    if(context.stage==='clarify')return success(result({clarification}));
    if(context.workPartition)return success(outputs[context.workPartition.id==='a'?0:1]);
    if(request.prompt.includes('任务拆分'))return success(result({workItems:slices.map((blocks,index)=>({id:index?'b':'a',goal:`范围${index}`,blockIds:blocks.map((block:any)=>block.id),dependsOn:[]}))}));
    if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};
    if(request.prompt.includes('本任务目标：依据本轮')||request.prompt.includes('本任务目标：修订最新草案'))return success(continuation());
    if(request.prompt.includes('你是独立评审者')&&failReviewOnce){failReviewOnce=false;return {structuredSuccess:false,status:'failed',stderr:'Permission denied in review',durationMs:1,exitCode:1};}
    return success(result());
  }};
}

describe('Registered recovery from actual Provider output limits', () => {
  it('splits the failed authoring task, assembles all validated fragments and preserves draft authority', async () => {
    const { path, engine } = await setup();
    const completeGroup = group('product'), calls: any[] = [];
    const partitions = [completeGroup.blocks.slice(0, 4), completeGroup.blocks.slice(4)];
    const provider = { async complete(request: any) {
      calls.push(request); const context = JSON.parse(request.contextText);
      if (context.stage === 'clarify') return success(result({ clarification }));
      if (context.workPartition) {
        const index = context.workPartition.id === 'slice-a' ? 0 : 1;
        return success(result({ groups: [{ ...completeGroup, id: context.workPartition.id, blocks: partitions[index] }] }));
      }
      if (request.prompt.includes('任务拆分')) return success(result({ workItems: partitions.map((blocks, index) => ({ id: index ? 'slice-b' : 'slice-a', goal: `设计第${index + 1}个明确范围`, blockIds: blocks.map((block: any) => block.id), dependsOn: [] })) }));
      if (request.prompt.includes('本任务目标：生成本阶段完整设计')) return { structuredSuccess: false, status: 'failed', stderr: limit, structuredOutput: result({ groups: [completeGroup] }), durationMs: 1, exitCode: 0 };
      if (request.prompt.includes('本任务目标：整合当前工作者产物')) return success(result({ groups: [completeGroup] }));
      return success(result());
    } };
    const runtime = new PlanningRuntime(engine, provider as any, { concurrency: 1 }, [1, 2]); runtimes.push(runtime);
    let snapshot = await runtime.service.get(path);
    const clarify = await runtime.start(path, { stage: 'clarify', expectedRevision: snapshot.metadata.stateRevision, operationId: 'clarify' });
    await settled(runtime, path, clarify.id);
    snapshot = await runtime.service.get(path);
    const started = await runtime.start(path, { stage: 'product', expectedRevision: snapshot.metadata.stateRevision, operationId: 'product' });
    const run = await settled(runtime, path, started.id);
    expect.soft(run.status).toBe('reviewable');
    const parent = run.tasks.find(task => task.kind === 'design' && !(task as any).partition);
    expect.soft((parent as any)?.outputOrigin).toBe('assembly');
    expect.soft((parent as any)?.partitionTaskIds).toHaveLength(2);
    expect.soft(calls.filter(request => !JSON.parse(request.contextText).workPartition && request.prompt.includes('本任务目标：生成本阶段完整设计'))).toHaveLength(1);
    expect.soft(calls.some(request=>request.prompt.includes('本任务目标：整合当前工作者产物'))).toBe(false);
    const after = await runtime.service.get(path);
    expect.soft(after.planning!.blueprint.blocks).toEqual([]);
    expect.soft(after.planning!.changeSets.at(-1)?.groups.flatMap(item => item.blocks)).toEqual(completeGroup.blocks);
    expect.soft((runtime as any).runningCalls).toBe(0);
    const review = calls.find(request=>request.prompt.includes('你是独立评审者'));
    expect(JSON.parse(review.contextText).workerResults.draft.groups.flatMap((item:any)=>item.blocks)).toEqual(completeGroup.blocks);
    if ((parent as any)?.outputOrigin === 'assembly') {
      const receipt = JSON.parse(await readFile(join(path, 'runtime/planning', run.id, 'tasks', parent!.id, 'result-receipt.json'), 'utf8'));
      expect(receipt.origin).toBe('assembly'); expect(receipt.assemblyRoleViewVersion).toBe(1); expect(receipt.children).toHaveLength(2);
      expect(receipt.children.every((child: any) => typeof child.hash === 'string')).toBe(true);
    }
  });

  it('restarts only the failed slice and keeps successful results, receipts and the original failed schema unchanged', async () => {
    const { root, path, engine } = await setup();
    const completeGroup=group('product'), slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    let fail=true; const calls:any[]=[];
    const provider={async complete(request:any){calls.push(request);const context=JSON.parse(request.contextText);
      if(context.stage==='clarify')return success(result({clarification}));
      if(context.workPartition){const index=context.workPartition.id==='slice-a'?0:1;if(index===1&&fail){fail=false;return {structuredSuccess:false,status:'failed',stderr:'Permission denied in slice B',durationMs:1,exitCode:1};}return success(result({groups:[{...completeGroup,id:context.workPartition.id,blocks:slices[index]}]}));}
      if(request.prompt.includes('任务拆分'))return success(result({workItems:slices.map((blocks,index)=>({id:index?'slice-b':'slice-a',goal:`范围${index}`,blockIds:blocks.map((block:any)=>block.id),dependsOn:[]}))}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};
      return success(result());
    }};
    let runtime=new PlanningRuntime(engine,provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);const clarify=await runtime.start(path,{stage:'clarify',expectedRevision:snapshot.metadata.stateRevision,operationId:'clarify'});await settled(runtime,path,clarify.id);
    snapshot=await runtime.service.get(path);const started=await runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:'product'});
    const paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');expect(paused.error).toContain('slice B');
    const first=paused.tasks.find(task=>task.partition?.id==='slice-a')!,parent=paused.tasks.find(task=>task.kind==='design'&&!task.partition)!;
    const directory=join(path,'runtime/planning',started.id,'tasks',first.id);
    const beforeResult=await readFile(join(directory,'result.json')),beforeReceipt=await readFile(join(directory,'result-receipt.json'));
    const failedSchema=await readFile(join(path,'runtime/planning',started.id,'tasks',parent.id,'call-1.schema.json'));
    const beforeCalls=calls.length;await runtime.shutdown();
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    await runtime.resume(path,started.id);const completed=await settled(runtime,path,started.id);expect(completed.status).toBe('reviewable');
    expect(await readFile(join(directory,'result.json'))).toEqual(beforeResult);expect(await readFile(join(directory,'result-receipt.json'))).toEqual(beforeReceipt);
    expect(await readFile(join(path,'runtime/planning',started.id,'tasks',parent.id,'call-1.schema.json'))).toEqual(failedSchema);
    expect(completed.tasks.find(task=>task.id===first.id)?.attempts).toBe(1);
    expect(calls.slice(beforeCalls).filter(request=>JSON.parse(request.contextText).workPartition).map(request=>JSON.parse(request.contextText).workPartition.id)).toEqual(['slice-b']);
    expect(calls.slice(beforeCalls).some(request=>request.prompt.includes('任务拆分'))).toBe(false);
    expect((await runtime.service.get(path)).planning!.blueprint.blocks).toEqual([]);
  });

  it.each(['research', 'validation', 'review'] as const)('keeps legacy %s bodies from conflicting with or adding to a new design assembly', kind => {
    const design = result({ groups: [group('product')], questions: [question('authoring-question')] });
    const legacyGroup = group('product'); legacyGroup.blocks[0].content = '历史支持正文不得覆盖设计';
    legacyGroup.blocks.push({ ...legacyGroup.blocks[1], id: 'legacy-extra', content: '历史支持新增正文也不得进入草案' });
    const proof = { id: 'legacy-proof', kind: 'user', source: 'project:idea', content: '用户原文', obtainedAt: '2026-10-04T00:00:00Z', applicability: '原文依据' };
    const legacy = result({ groups: [legacyGroup], questions: [question('legacy-question')], clarification, evidence: [proof], blockers: ['仍缺真实验证'], followUp: [{ kind: 'validation', goal: '必要恢复补证' }], workItems: [{ id: 'legacy-plan', goal: '不能自行登记', blockIds: ['notes'], dependsOn: [] }] });
    assertTaskResult(legacy);
    const tasks = [{ id: 'design', kind: 'design' }, { id: 'legacy', kind }] as any;
    const results = new Map([['design', design], ['legacy', legacy]]), before = structuredClone(legacy), beforeHash = hashValue(legacy);
    const assembled = assemblePartitions(tasks, results);
    expect(assembled.groups).toEqual(design.groups); expect(assembled.questions).toEqual(design.questions);
    expect(assembled.evidence).toEqual([proof]); expect(assembled.blockers).toEqual(legacy.blockers);
    expect(assembled.followUp).toEqual(kind === 'review' ? [] : legacy.followUp); expect(assembled.clarification).toBeNull(); expect(assembled).not.toHaveProperty('workItems');
    expect(results.get('legacy')).toBe(legacy); expect(legacy).toEqual(before); expect(hashValue(legacy)).toBe(beforeHash);
  });

  it('resumes a legal old support receipt into a new role-filtered assembly without changing source bytes or hashes', async () => {
    const { root, path, engine } = await setup(), completeGroup = group('product'), slices = [completeGroup.blocks.slice(0, 4), completeGroup.blocks.slice(4)];
    let failSlice = true; const calls: any[] = [];
    const provider = { async complete(request: any) {
      calls.push(request); const context = JSON.parse(request.contextText);
      if (context.stage === 'clarify') return success(result({ clarification }));
      if (context.workPartition) {
        const index = context.workPartition.id === 'a' ? 0 : 1;
        if (index === 1 && failSlice) { failSlice = false; return { structuredSuccess: false, status: 'failed', stderr: 'Permission denied in legacy slice B', durationMs: 1, exitCode: 1 }; }
        return success(result({ groups: [{ ...completeGroup, id: index ? 'b' : 'a', blocks: slices[index] }] }));
      }
      if (request.prompt.includes('任务拆分')) return success(result({ workItems: slices.map((blocks, index) => ({ id: index ? 'b' : 'a', goal: `范围${index}`, blockIds: blocks.map((block: any) => block.id), dependsOn: [] })) }));
      if (request.prompt.includes('本任务目标：生成本阶段完整设计')) return { structuredSuccess: false, status: 'failed', stderr: limit, durationMs: 1, exitCode: 0 };
      return success(result());
    } };
    let runtime = new PlanningRuntime(engine, provider as any, { concurrency: 2 }, [1, 2]); runtimes.push(runtime);
    const started = await startProduct(runtime, path), paused = await settled(runtime, path, started.id); expect(paused.status).toBe('paused'); await runtime.shutdown();
    const research = paused.tasks.find(task => task.kind === 'research')!, directory = join(path, 'runtime/planning', paused.id, 'tasks', research.id);
    const legacy = result({ groups: [completeGroup], questions: [question('legacy-question')], clarification, workItems: [{ id: 'legacy-plan', goal: '不能自行登记', blockIds: ['notes'], dependsOn: [] }] }); assertTaskResult(legacy);
    const receipt = JSON.parse(await readFile(join(directory, 'result-receipt.json'), 'utf8')); receipt.hash = hashValue(legacy); research.outputHash = receipt.hash;
    await writeFile(join(directory, 'result.json'), JSON.stringify(legacy)); await writeFile(join(directory, 'result-receipt.json'), JSON.stringify(receipt));
    await writeFile(join(directory, 'result.schema.json'), JSON.stringify(PLANNING_TASK_SCHEMA));
    await writeFile(join(directory, 'call-1.schema.json'), JSON.stringify(PLANNING_TASK_SCHEMA));
    const call = JSON.parse(await readFile(join(directory, 'call-1.json'), 'utf8')); call.schemaHash = hashValue(PLANNING_TASK_SCHEMA); await writeFile(join(directory, 'call-1.json'), JSON.stringify(call));
    await writeFile(join(path, 'runtime/planning', paused.id, 'run.json'), JSON.stringify(paused));
    const sourceFiles = ['result.json', 'result-receipt.json', 'result.schema.json', 'call-1.schema.json', 'call-1.json'];
    const before = await Promise.all(sourceFiles.map(name => readFile(join(directory, name))));
    runtime = new PlanningRuntime(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)), provider as any, { concurrency: 2 }, [1, 2]); runtimes.push(runtime);
    await runtime.resume(path, paused.id); const run = await settled(runtime, path, paused.id); expect(run.status).toBe('reviewable');
    expect(await Promise.all(sourceFiles.map(name => readFile(join(directory, name))))).toEqual(before);
    expect(run.tasks.find(task => task.id === research.id)?.outputHash).toBe(receipt.hash); expect(run.tasks.filter(task => task.kind === 'decomposition')).toHaveLength(1);
    const snapshot = await runtime.service.get(path), proposal = snapshot.planning!.changeSets.find(change => change.runId === run.id)!;
    expect(proposal.groups.flatMap(item => item.blocks)).toEqual(completeGroup.blocks); expect(snapshot.planning!.blueprint.blocks).toEqual([]); expect(run.pendingQuestions).toEqual([]);
    const integration = run.tasks.find(task => task.kind === 'integration')!;
    const assemblyReceipt = JSON.parse(await readFile(join(path, 'runtime/planning', run.id, 'tasks', integration.id, 'result-receipt.json'), 'utf8'));
    expect(assemblyReceipt.assemblyRoleViewVersion).toBe(1); expect(assemblyReceipt.children).toContainEqual({ taskId: research.id, hash: receipt.hash });
  });

  it.each([{missingReceipt:false,omitOrigin:false},{missingReceipt:true,omitOrigin:false},{missingReceipt:false,omitOrigin:true}])('preserves an old unversioned assembly containing legal legacy support groups (missing receipt=$missingReceipt, origin omitted=$omitOrigin)', async ({missingReceipt,omitOrigin}) => {
    const { root, path, engine } = await setup(), completeGroup = group('product'), slices = [completeGroup.blocks.slice(0, 4), completeGroup.blocks.slice(4)];
    const provider = splitProvider(slices, slices.map((blocks, index) => result({ groups: [{ ...completeGroup, id: index ? 'b' : 'a', blocks }] })), () => result({ groups: [completeGroup] }), true);
    let runtime = new PlanningRuntime(engine, provider as any, {}, [1, 2]); runtimes.push(runtime);
    const started = await startProduct(runtime, path), paused = await settled(runtime, path, started.id); expect(paused.status).toBe('paused'); await runtime.shutdown();
    const runDirectory = join(path, 'runtime/planning', paused.id), taskDirectory = (id: string) => join(runDirectory, 'tasks', id);
    const research = paused.tasks.find(task => task.kind === 'research')!, integration = paused.tasks.find(task => task.kind === 'integration')!;
    const legacy = result({ groups: [{ ...completeGroup, id: 'legacy-support', blocks: [{ ...completeGroup.blocks[1], id: 'legacy-support-problem' }] }], clarification }); assertTaskResult(legacy);
    const researchReceipt = JSON.parse(await readFile(join(taskDirectory(research.id), 'result-receipt.json'), 'utf8')); researchReceipt.hash = hashValue(legacy); research.outputHash = researchReceipt.hash;
    if(omitOrigin){delete researchReceipt.origin;delete research.outputOrigin;}
    await writeFile(join(taskDirectory(research.id), 'result.json'), JSON.stringify(legacy)); await writeFile(join(taskDirectory(research.id), 'result-receipt.json'), JSON.stringify(researchReceipt));
    await writeFile(join(taskDirectory(research.id), 'result.schema.json'), JSON.stringify(PLANNING_TASK_SCHEMA));
    await writeFile(join(taskDirectory(research.id), 'call-1.schema.json'), JSON.stringify(PLANNING_TASK_SCHEMA));
    const researchCall = JSON.parse(await readFile(join(taskDirectory(research.id), 'call-1.json'), 'utf8')); researchCall.schemaHash = hashValue(PLANNING_TASK_SCHEMA); await writeFile(join(taskDirectory(research.id), 'call-1.json'), JSON.stringify(researchCall));
    const sources = new Map(); for (const task of paused.tasks.filter(task => task.status === 'completed')) sources.set(task.id, JSON.parse(await readFile(join(taskDirectory(task.id), 'result.json'), 'utf8')));
    const children = integration.partitionTaskIds!.map(id => paused.tasks.find(task => task.id === id)!);
    const oldAssembly = batchAssembledQuestions(assemblePartitions(children, sources, undefined, 0));
    const oldReceipt = JSON.parse(await readFile(join(taskDirectory(integration.id), 'result-receipt.json'), 'utf8')); delete oldReceipt.assemblyRoleViewVersion; delete oldReceipt.assemblyEvidenceScopeVersion; delete oldReceipt.assemblyVersion; delete oldReceipt.assemblyKnownEvidenceHash;
    if(omitOrigin)delete oldReceipt.origin;
    delete integration.assemblyEvidenceScopeVersion; delete integration.assemblyVersion; delete integration.assemblyKnownEvidenceHash;
    oldReceipt.hash = hashValue(oldAssembly.output); oldReceipt.children = children.map(task => ({ taskId: task.id, hash: hashValue(sources.get(task.id)) })); oldReceipt.deferredQuestions = oldAssembly.deferred;
    integration.outputHash = oldReceipt.hash; integration.deferredQuestions = oldAssembly.deferred;
    await writeFile(join(taskDirectory(integration.id), 'result.json'), JSON.stringify(oldAssembly.output)); await writeFile(join(taskDirectory(integration.id), 'result-receipt.json'), JSON.stringify(oldReceipt));
    await writeFile(join(runDirectory, 'run.json'), JSON.stringify(paused));
    const originalResult = await readFile(join(taskDirectory(integration.id), 'result.json')), originalReceipt = await readFile(join(taskDirectory(integration.id), 'result-receipt.json'));
    const researchBytes = await readFile(join(taskDirectory(research.id), 'result.json')), researchReceiptBytes = await readFile(join(taskDirectory(research.id), 'result-receipt.json'));
    if (missingReceipt) await rm(join(taskDirectory(integration.id), 'result-receipt.json'));
    runtime = new PlanningRuntime(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)), provider as any, {}, [1, 2]); runtimes.push(runtime);
    await runtime.resume(path, paused.id); const run = await settled(runtime, path, paused.id); expect(run.status).toBe('reviewable');
    const restored = JSON.parse(await readFile(join(taskDirectory(integration.id), 'result.json'), 'utf8')), restoredReceipt = JSON.parse(await readFile(join(taskDirectory(integration.id), 'result-receipt.json'), 'utf8'));
    expect(restored).toEqual(oldAssembly.output); expect(hashValue(restored)).toBe(oldReceipt.hash); expect(restoredReceipt.hash).toBe(oldReceipt.hash); expect(restoredReceipt).not.toHaveProperty('assemblyRoleViewVersion'); expect(restoredReceipt).not.toHaveProperty('assemblyVersion'); expect(restoredReceipt).not.toHaveProperty('assemblyKnownEvidenceHash');
    if (!missingReceipt) { expect(await readFile(join(taskDirectory(integration.id), 'result.json'))).toEqual(originalResult); expect(await readFile(join(taskDirectory(integration.id), 'result-receipt.json'))).toEqual(originalReceipt); }
    if(omitOrigin){expect(restoredReceipt.origin).toBeUndefined();expect(run.tasks.find(task=>task.id===integration.id)?.outputOrigin).toBe('assembly');expect(run.tasks.find(task=>task.id===research.id)?.outputOrigin).toBe('provider');}
    expect(await readFile(join(taskDirectory(research.id), 'result.json'))).toEqual(researchBytes); expect(await readFile(join(taskDirectory(research.id), 'result-receipt.json'))).toEqual(researchReceiptBytes);
    expect((await runtime.service.get(path)).planning!.blueprint.blocks).toEqual([]);
  });

  it.each([1, 2])('rebuilds version %s worker evidence and both assembly receipts without repeating source calls or changing source bytes', async version => {
    const { root, path, engine } = await setup(), completeGroup = group('product');
    const slices = [completeGroup.blocks.slice(0, 4), completeGroup.blocks.slice(4)];
    const records = ['甲工作者范围依据', '乙工作者范围依据'].map((content, index) => ({
      id: 'shared-worker-evidence', kind: 'user' as const, content, source: 'project:idea',
      obtainedAt: '2026-10-04T00:00:00Z', applicability: `登记范围 ${index} 的用户输入说明`,
      hash: hashValue({ worker: index }), location: `worker-${index}.md`, environment: `worker-${index}`,
    }));
    const outputs = slices.map((blocks, index) => result({ evidence: [records[index]], groups: [{
      ...completeGroup, id: index ? 'b' : 'a',
      blocks: blocks.map((block: any) => ({ ...block, evidenceIds: ['shared-worker-evidence'] })),
      decisions: [{ decisionKey: `worker-${index}:scope`, area: 'scope', statement: `登记范围 ${index} 的第一版行为`, rationale: '本工作者保留其完整来源说明', evidenceIds: ['shared-worker-evidence'] }],
    }] }));
    const provider = splitProvider(slices, outputs, () => result({ groups: [completeGroup] }), true);
    let runtime = new PlanningRuntime(engine, provider as any, {}, [1, 2]); runtimes.push(runtime);
    const started = await startProduct(runtime, path), paused = await settled(runtime, path, started.id);
    expect(paused.status).toBe('paused'); expect(paused.error).toContain('Permission denied in review');
    await runtime.shutdown();
    const taskDirectory = (id: string) => join(path, 'runtime/planning', paused.id, 'tasks', id);
    const assemblies = paused.tasks.filter(task => task.outputOrigin === 'assembly');
    expect(assemblies).toHaveLength(2);
    if (version === 1) {
      for (const task of assemblies) {
        const receipt = JSON.parse(await readFile(join(taskDirectory(task.id), 'result-receipt.json'), 'utf8'));
        delete task.assemblyVersion; delete task.assemblyKnownEvidenceHash; delete receipt.assemblyVersion; delete receipt.assemblyKnownEvidenceHash;
        await writeFile(join(taskDirectory(task.id), 'result-receipt.json'), JSON.stringify(receipt));
      }
      await writeFile(join(path, 'runtime/planning', paused.id, 'run.json'), JSON.stringify(paused));
    }
    const parent = assemblies.find(task => task.kind === 'design')!;
    const parentOutput = JSON.parse(await readFile(join(taskDirectory(parent.id), 'result.json'), 'utf8'));
    expect(new Set(parentOutput.evidence.map((record: any) => record.id)).size).toBe(2);
    for (const [index, original] of records.entries()) {
      const scoped = parentOutput.evidence.find((record: any) => record.content === original.content);
      expect(scoped).toBeDefined(); expect(scoped.id).not.toBe(original.id);
      expect({ ...scoped, id: original.id }).toEqual(original);
      const nextGroup = parentOutput.groups.find((item: any) => item.id === (index ? 'b' : 'a'));
      expect(nextGroup.blocks.every((block: any) => hashValue(block.evidenceIds) === hashValue([scoped.id]))).toBe(true);
      expect(nextGroup.decisions[0].evidenceIds).toEqual([scoped.id]);
    }
    const sourceTasks = paused.tasks.filter(task => task.outputOrigin === 'provider' && task.status === 'completed');
    const sourceFiles = [...new Set([
      ...sourceTasks.flatMap(task => ['result.json', 'result-receipt.json'].map(name => join(taskDirectory(task.id), name))),
      ...paused.tasks.filter(task => task.attempts > 0).flatMap(task => [join(taskDirectory(task.id), 'result.schema.json'), ...Array.from({ length: task.attempts }, (_, index) => index + 1).flatMap(attempt => [`call-${attempt}.json`, `call-${attempt}.schema.json`].map(name => join(taskDirectory(task.id), name)))]),
    ])];
    const sourceBytes = await Promise.all(sourceFiles.map(file => readFile(file)));
    const originalAssemblies = await Promise.all(assemblies.map(async task => {
      const bytes = await readFile(join(taskDirectory(task.id), 'result.json'));
      const receipt = JSON.parse(await readFile(join(taskDirectory(task.id), 'result-receipt.json'), 'utf8'));
      expect(task.assemblyEvidenceScopeVersion).toBe(1); expect(receipt.assemblyEvidenceScopeVersion).toBe(1);
      if (version === 2) { expect(receipt.assemblyVersion).toBe(2); expect(receipt.assemblyKnownEvidenceHash).toBe(hashValue(JSON.parse(await readFile(join(taskDirectory(task.id), 'assembly-known-evidence.json'), 'utf8')))); }
      else expect(receipt.assemblyVersion).toBeUndefined();
      expect(receipt.hash).toBe(task.outputHash); expect(hashValue(JSON.parse(bytes.toString()))).toBe(task.outputHash);
      await rm(join(taskDirectory(task.id), 'result-receipt.json'));
      return { task, bytes, receipt };
    }));
    const beforeCalls = provider.calls.length;
    runtime = new PlanningRuntime(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)), provider as any, {}, [1, 2]); runtimes.push(runtime);
    await runtime.resume(path, paused.id); const run = await settled(runtime, path, paused.id);
    expect(run.status).toBe('reviewable');
    expect(provider.calls.slice(beforeCalls)).toHaveLength(1);
    expect(provider.calls[beforeCalls].prompt).toContain('你是独立评审者');
    expect(await Promise.all(sourceFiles.map(file => readFile(file)))).toEqual(sourceBytes);
    for (const source of sourceTasks) {
      const restored = run.tasks.find(task => task.id === source.id)!;
      expect(restored.attempts).toBe(source.attempts); expect(restored.outputHash).toBe(source.outputHash);
    }
    for (const original of originalAssemblies) {
      expect(await readFile(join(taskDirectory(original.task.id), 'result.json'))).toEqual(original.bytes);
      const receipt = JSON.parse(await readFile(join(taskDirectory(original.task.id), 'result-receipt.json'), 'utf8'));
      expect(receipt.assemblyRoleViewVersion).toBe(1); expect(receipt.assemblyEvidenceScopeVersion).toBe(1);
      expect(receipt.assemblyVersion).toBe(original.receipt.assemblyVersion); expect(receipt.assemblyKnownEvidenceHash).toBe(original.receipt.assemblyKnownEvidenceHash);
      expect(receipt.hash).toBe(original.receipt.hash); expect(receipt.children).toEqual(original.receipt.children);
      expect(run.tasks.find(task => task.id === original.task.id)?.outputHash).toBe(original.task.outputHash);
    }
    const snapshot = await runtime.service.get(path), proposal = snapshot.planning!.changeSets.find(change => change.runId === run.id)!;
    expect(proposal.evidence).toEqual(parentOutput.evidence);
    expect(proposal.groups).toEqual(parentOutput.groups);
    expect(snapshot.planning!.blueprint.blocks).toEqual([]); expect(proposal.approvals).toEqual([]);
  });

  it('restores a hash-registered legacy role0 assembly when role1 reconstruction throws before the fallback', async () => {
    const { root, path, engine } = await setup(), completeGroup = group('product');
    const slices = [completeGroup.blocks.slice(0, 4), completeGroup.blocks.slice(4)];
    const provider = splitProvider(slices, slices.map((blocks, index) => result({ groups: [{ ...completeGroup, id: index ? 'b' : 'a', blocks }] })), () => result({ groups: [completeGroup] }), true);
    let runtime = new PlanningRuntime(engine, provider as any, {}, [1, 2]); runtimes.push(runtime);
    const started = await startProduct(runtime, path), paused = await settled(runtime, path, started.id);
    expect(paused.status).toBe('paused'); await runtime.shutdown();
    const runDirectory = join(path, 'runtime/planning', paused.id), taskDirectory = (id: string) => join(runDirectory, 'tasks', id);
    const integration = paused.tasks.find(task => task.kind === 'integration')!, research = paused.tasks.find(task => task.kind === 'research')!;
    const decision = { decisionKey: 'legacy:scope', area: 'scope', statement: '保留历史待批准范围决定', rationale: '来源记录完整保留，不能改写历史收据', evidenceIds: [] };
    const base = result({ groups: [{ ...completeGroup, id: 'a', decisions: [decision] }] }); assertTaskResult(base);
    const completedAt = new Date(Date.parse(paused.createdAt) - 1000).toISOString();
    const baseTask: PlanningTask = {
      id: 'task-legacy-base', kind: 'revision', goal: '合法历史待批准基线', dependsOn: [], status: 'completed', model: integration.model,
      attempts: 1, inputRefs: [], outputOrigin: 'provider', outputRef: 'tasks/task-legacy-base/result.json',
      outputHash: hashValue(base), basisHash: paused.basis.hash, completedAt, startedAt: completedAt,
    };
    paused.tasks.unshift(baseTask); await mkdir(taskDirectory(baseTask.id), { recursive: true });
    await writeFile(join(taskDirectory(baseTask.id), 'result.json'), JSON.stringify(base));
    await writeFile(join(taskDirectory(baseTask.id), 'result-receipt.json'), JSON.stringify({ taskId: baseTask.id, hash: baseTask.outputHash, basisHash: paused.basis.hash, completedAt, origin: 'provider' }));
    const legacy = result({ groups: [{ ...completeGroup, id: 'legacy-support', blocks: [], decisions: [decision] }] }); assertTaskResult(legacy);
    const researchReceipt = JSON.parse(await readFile(join(taskDirectory(research.id), 'result-receipt.json'), 'utf8'));
    researchReceipt.hash = hashValue(legacy); research.outputHash = researchReceipt.hash;
    await writeFile(join(taskDirectory(research.id), 'result.json'), JSON.stringify(legacy));
    await writeFile(join(taskDirectory(research.id), 'result-receipt.json'), JSON.stringify(researchReceipt));
    for (const source of [baseTask, research]) {
      for (const name of ['result.schema.json', 'call-1.schema.json']) await writeFile(join(taskDirectory(source.id), name), JSON.stringify(PLANNING_TASK_SCHEMA));
      const call = source.id === research.id ? JSON.parse(await readFile(join(taskDirectory(source.id), 'call-1.json'), 'utf8')) : { status: 'success', durationMs: 1, exitCode: 0, model: source.model };
      call.schemaHash = hashValue(PLANNING_TASK_SCHEMA); await writeFile(join(taskDirectory(source.id), 'call-1.json'), JSON.stringify(call));
    }
    const sources = new Map<string, any>();
    for (const source of paused.tasks.filter(task => task.status === 'completed')) sources.set(source.id, JSON.parse(await readFile(join(taskDirectory(source.id), 'result.json'), 'utf8')));
    const children = integration.partitionTaskIds!.map(id => paused.tasks.find(task => task.id === id)!);
    expect(() => assemblePartitions(children, sources, base, 1, 0)).toThrow('原分组 ID 冲突');
    const oldAssembly = batchAssembledQuestions(assemblePartitions(children, sources, base, 0, 0)); assertTaskResult(oldAssembly.output);
    const oldReceipt = JSON.parse(await readFile(join(taskDirectory(integration.id), 'result-receipt.json'), 'utf8'));
    delete oldReceipt.assemblyRoleViewVersion; delete oldReceipt.assemblyEvidenceScopeVersion; delete integration.assemblyEvidenceScopeVersion; delete oldReceipt.assemblyVersion; delete oldReceipt.assemblyKnownEvidenceHash; delete integration.assemblyVersion; delete integration.assemblyKnownEvidenceHash;
    oldReceipt.hash = hashValue(oldAssembly.output); oldReceipt.children = children.map(task => ({ taskId: task.id, hash: hashValue(sources.get(task.id)) }));
    oldReceipt.base = { taskId: baseTask.id, hash: baseTask.outputHash }; oldReceipt.deferredQuestions = oldAssembly.deferred;
    integration.assemblyBaseTaskId = baseTask.id; integration.outputHash = oldReceipt.hash; integration.deferredQuestions = oldAssembly.deferred;
    await writeFile(join(taskDirectory(integration.id), 'result.json'), JSON.stringify(oldAssembly.output));
    await writeFile(join(taskDirectory(integration.id), 'result-receipt.json'), JSON.stringify(oldReceipt));
    await writeFile(join(runDirectory, 'run.json'), JSON.stringify(paused));
    // Freeze the representative legal legacy fixture before the interrupted write window.
    const sourceFiles = paused.tasks.filter(task => task.status === 'completed' && task.id !== integration.id).flatMap(task => ['result.json', 'result-receipt.json'].map(name => join(taskDirectory(task.id), name)));
    sourceFiles.push(...[baseTask, research].flatMap(task => ['result.schema.json', 'call-1.schema.json', 'call-1.json'].map(name => join(taskDirectory(task.id), name))));
    const sourceBytes = await Promise.all(sourceFiles.map(file => readFile(file)));
    await rm(join(taskDirectory(integration.id), 'result-receipt.json')); const beforeCalls = provider.calls.length;
    runtime = new PlanningRuntime(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)), provider as any, {}, [1, 2]); runtimes.push(runtime);
    await runtime.resume(path, paused.id); const run = await settled(runtime, path, paused.id);
    expect(run.status).toBe('reviewable'); expect(provider.calls.slice(beforeCalls)).toHaveLength(1);
    expect(provider.calls[beforeCalls].prompt).toContain('你是独立评审者');
    expect(await Promise.all(sourceFiles.map(file => readFile(file)))).toEqual(sourceBytes);
    const restored = JSON.parse(await readFile(join(taskDirectory(integration.id), 'result.json'), 'utf8'));
    const receipt = JSON.parse(await readFile(join(taskDirectory(integration.id), 'result-receipt.json'), 'utf8'));
    expect(restored).toEqual(oldAssembly.output); expect(hashValue(restored)).toBe(oldReceipt.hash); expect(receipt.hash).toBe(oldReceipt.hash);
    expect(receipt).not.toHaveProperty('assemblyRoleViewVersion'); expect(receipt).not.toHaveProperty('assemblyEvidenceScopeVersion');
    expect(receipt.base).toEqual(oldReceipt.base); expect(receipt.children).toEqual(oldReceipt.children);
    expect(run.tasks.find(task => task.id === integration.id)?.outputHash).toBe(oldReceipt.hash);
    expect(run.tasks.find(task => task.id === baseTask.id)?.attempts).toBe(1);
    const snapshot = await runtime.service.get(path), proposal = snapshot.planning!.changeSets.find(change => change.runId === run.id)!;
    expect(proposal.groups).toEqual(oldAssembly.output.groups); expect(proposal.approvals).toEqual([]); expect(snapshot.planning!.blueprint.blocks).toEqual([]);
  });

  it('rejects overlap, cycles, missing candidate ownership, outside-scope writes and missing planned blocks',()=>{
    const items=[{id:'a',goal:'范围A',blockIds:['new-a'],dependsOn:[]},{id:'b',goal:'范围B',blockIds:['new-b'],dependsOn:[]}];
    expect(validatePartitions(result({workItems:items}) as any)).toEqual(items);
    expect(()=>validatePartitions(result({workItems:[items[0],{...items[1],blockIds:['new-a']}]}) as any)).toThrow('同一块');
    expect(()=>validatePartitions(result({workItems:items}) as any,undefined,['lost-candidate'])).toThrow('遗漏');
    expect(()=>validatePartitions(result({workItems:[{...items[0],dependsOn:['b']},{...items[1],dependsOn:['a']}]}) as any)).toThrow('循环');
    expect(()=>validatePartitions(result({workItems:items}) as any,{id:'parent',goal:'父范围',blockIds:['new-a','new-b','lost'],dependsOn:[]})).toThrow('细分');
    expect(()=>validatePartitionResult(result({groups:[group('product')]}) as any,items[0])).toThrow('范围之外');
    expect(()=>validatePartitionResult(result() as any,items[0],['new-a'])).toThrow('遗漏');
  });

  it('keeps exact candidate evidence and pending decisions in the full assembly and rejects conflicting identities',()=>{
    const original=group('product');original.decisions=[{decisionKey:'retained-key',area:'product',statement:'待批准的原决定',rationale:'保留此前用户意图',evidenceIds:['proof']}];
    const evidence={id:'proof',kind:'user',content:'用户原文',source:'project:idea',obtainedAt:'2026-10-04T00:00:00Z',applicability:'范围'};
    const base=result({groups:[original],evidence:[evidence]}) as any;
    const task={id:'part',kind:'revision',goal:'part',dependsOn:[],status:'completed',model:'model',attempts:1,inputRefs:[]} as any;
    const revised={...original,id:'new-group',decisions:[]};const results=new Map([[task.id,result({groups:[revised]}) as any]]);
    const assembled=assemblePartitions([task],results,base);
    expect(assembled.evidence).toEqual([evidence]);expect(assembled.groups.flatMap(item=>item.decisions)).toEqual(original.decisions);
    results.set(task.id,result({groups:[revised],evidence:[{...evidence,content:'擅自重写'}]}) as any);
    expect(()=>assemblePartitions([task],results,base)).toThrow('证据 ID 内容冲突');
  });

  it('never sends the last partial worker as the complete draft and gives supporting roles the current candidate',()=>{
    const full=result({groups:[group('product')]}) as any,fragment=result({groups:[{...group('product'),blocks:group('product').blocks.slice(0,1)}]}) as any;
    const parent={id:'parent',kind:'revision',goal:'parent',dependsOn:[],status:'completed',model:'model',attempts:1,inputRefs:[],completedAt:'2026-10-04T00:00:03Z',outputOrigin:'assembly'} as any;
    const child={...parent,id:'child',completedAt:'2026-10-04T00:00:02Z',partition:{id:'slice',goal:'slice',blockIds:['target'],dependsOn:[]}};
    const values=new Map([['parent',full],['child',fragment]]),state={evidence:[],changeSets:[]} as any;
    for(const kind of ['review','research','validation'] as const){const context=planningWorkerContext([parent,child],values,state,{...parent,id:'next',kind});expect(kind==='review'?context.workerResults.draft:context.currentDraft).toEqual(full);expect(JSON.stringify(context.workerResults)).not.toContain('"child"');}
  });

  it('projects explicitly registered scope prerequisites to approval groups',()=>{
    const base={kind:'design',goal:'范围',dependsOn:[],status:'completed',model:'model',attempts:1,inputRefs:[]} as any;
    const tasks=[{...base,id:'a-task',partition:{id:'a',goal:'前置',blockIds:['target'],dependsOn:[]}},{...base,id:'b-task',partition:{id:'b',goal:'后置',blockIds:['problem'],dependsOn:['a']}}];
    const results=new Map(tasks.map((task,index)=>[task.id,result({groups:[{...group('product'),id:`${task.id}-group`,blocks:[group('product').blocks[index]]}]}) as any]));
    expect(assemblePartitions(tasks,results).groups[1]?.dependsOn).toEqual(['a-task-group']);
  });

  it.each(['cancel','basis-change'] as const)('prevents assembly delivery after %s while child work is running',async(action)=>{
    const {path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const releases:Array<()=>void>=[];
    const provider={async complete(request:any){const context=JSON.parse(request.contextText);
      if(context.stage==='clarify')return success(result({clarification}));
      if(context.workPartition){const index=context.workPartition.id==='a'?0:1;return new Promise(resolve=>{releases.push(()=>resolve(success(result({groups:[{...completeGroup,id:context.workPartition.id,blocks:slices[index]}]}))));request.abortSignal.addEventListener('abort',()=>resolve({structuredSuccess:false,status:'cancelled',durationMs:1,exitCode:0}),{once:true});});}
      if(request.prompt.includes('任务拆分'))return success(result({workItems:slices.map((blocks,index)=>({id:index?'b':'a',goal:`范围${index}`,blockIds:blocks.map((block:any)=>block.id),dependsOn:[]}))}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};
      return success(result());
    }};
    const runtime=new PlanningRuntime(engine,provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);const clarify=await runtime.start(path,{stage:'clarify',expectedRevision:snapshot.metadata.stateRevision,operationId:'clarify'});await settled(runtime,path,clarify.id);
    snapshot=await runtime.service.get(path);const started=await runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:'product'});
    await vi.waitFor(()=>expect(releases).toHaveLength(2),{timeout:5000});
    if(action==='cancel')await runtime.cancel(path,started.id);
    else {snapshot=await runtime.service.get(path);await runtime.service.recordInput(path,'新的明确范围变更',snapshot.metadata.stateRevision,'changed-input');releases.forEach(release=>release());}
    const run=await settled(runtime,path,started.id);expect(run.status).toBe(action==='cancel'?'cancelled':'stale');
    const after=await runtime.service.get(path);expect(after.planning!.blueprint.blocks).toEqual([]);expect(after.planning!.changeSets.filter(change=>change.runId===run.id)).toEqual([]);expect(after.planning!.package).toBeUndefined();expect((runtime as any).runningCalls).toBe(0);
  });

  it('offers four valid slice questions in two batches and continues after all answers without discarding any',async()=>{
    const {path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const questions=[1,2,3,4].map(index=>({...question(),id:`q-${index}`,decisionKey:`key-${index}`}));
    const outputs=slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}],questions:questions.slice(index*2,index*2+2)}));
    const provider=splitProvider(slices,outputs,()=>result({groups:[completeGroup]}));
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const started=await startProduct(runtime,path);let run=await settled(runtime,path,started.id);
    expect(run.pendingQuestions.map(item=>item.decisionKey)).toEqual(['key-1','key-2','key-3']);expect(run.deferredQuestions?.map(item=>item.id)).toEqual(['q-4']);
    for(const batch of [3,1]){
      expect(run.pendingQuestions).toHaveLength(batch);let snapshot=await runtime.service.get(path);
      await runtime.service.answer(path,run.pendingQuestions.map(item=>({questionId:item.id,kind:'selection' as const,optionKeys:['local']})),snapshot.metadata.stateRevision,`answer-${batch}`);
      await runtime.resume(path,run.id);run=await settled(runtime,path,run.id);
    }
    expect(run.status).toBe('reviewable');expect(run.deferredQuestions??[]).toEqual([]);
    const snapshot=await runtime.service.get(path);expect(snapshot.questions.items.filter(item=>item.status==='answered').map(item=>item.decisionKey).sort()).toEqual(questions.map(item=>item.decisionKey));
    expect(snapshot.planning!.changeSets.at(-1)?.groups.flatMap(item=>item.blocks)).toEqual(completeGroup.blocks);
  });

  it('restores assembly provenance from the receipt after an interrupted run metadata write',async()=>{
    const {root,path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const provider=splitProvider(slices,slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}]})),()=>result({groups:[completeGroup]}),true);
    let runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const started=await startProduct(runtime,path),paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');
    const location=join(path,'runtime/planning',paused.id,'run.json'),saved=JSON.parse(await readFile(location,'utf8'));
    const assemblies=paused.tasks.filter(task=>task.outputOrigin==='assembly'),files=assemblies.flatMap(task=>['result.json','result-receipt.json','assembly-known-evidence.json'].map(name=>join(path,'runtime/planning',paused.id,'tasks',task.id,name))),bytes=await Promise.all(files.map(file=>readFile(file)));
    for(const task of saved.tasks.filter((item:any)=>item.outputOrigin==='assembly')){task.status='paused';delete task.outputOrigin;delete task.partitionTaskIds;delete task.assemblyVersion;delete task.assemblyKnownEvidenceHash;}
    await writeFile(location,JSON.stringify(saved));const before=provider.calls.length;
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);runtimes.push(runtime);
    await runtime.resume(path,paused.id);const run=await settled(runtime,path,paused.id);expect(run.status).toBe('reviewable');
    expect(run.tasks.filter(task=>task.outputOrigin==='assembly')).toHaveLength(2);
    expect(provider.calls.slice(before).every(request=>request.prompt.includes('你是独立评审者'))).toBe(true);
    expect(await Promise.all(files.map(file=>readFile(file)))).toEqual(bytes);
    for(const task of assemblies){const recovered=run.tasks.find(item=>item.id===task.id)!;expect(recovered.assemblyVersion).toBe(2);expect(recovered.assemblyKnownEvidenceHash).toBe(task.assemblyKnownEvidenceHash);}
  });
  it.each(['changed','missing'] as const)('rejects a %s frozen Core evidence assembly basis before repeating any Provider call',async action=>{
    const {root,path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const provider=splitProvider(slices,slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}]})),()=>result({groups:[completeGroup]}),true);
    let runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const started=await startProduct(runtime,path),paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');await runtime.shutdown();
    const assembly=paused.tasks.find(task=>task.outputOrigin==='assembly')!,directory=join(path,'runtime/planning',paused.id,'tasks',assembly.id),file=join(directory,'assembly-known-evidence.json');
    const receipt=JSON.parse(await readFile(join(directory,'result-receipt.json'),'utf8'));expect(receipt.assemblyVersion).toBe(2);expect(receipt.assemblyKnownEvidenceHash).toBe(assembly.assemblyKnownEvidenceHash);
    const sourceFiles=paused.tasks.filter(task=>task.status==='completed').flatMap(task=>['result.json','result-receipt.json'].map(name=>join(path,'runtime/planning',paused.id,'tasks',task.id,name))),sourceBytes=await Promise.all(sourceFiles.map(file=>readFile(file)));
    if(action==='missing')await rm(file);else await writeFile(file,JSON.stringify([{id:'changed-proof',kind:'user',source:'project:idea',content:'改写的依据',obtainedAt:'2026-10-04',applicability:'篡改'}]));
    const before=provider.calls.length;runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);runtimes.push(runtime);
    await expect(runtime.resume(path,paused.id)).rejects.toMatchObject({code:'RESULT_MODIFIED'});expect(provider.calls).toHaveLength(before);expect((runtime as any).active.size).toBe(0);
    expect(await Promise.all(sourceFiles.map(file=>readFile(file)))).toEqual(sourceBytes);
  });
  it.each([
    {label:'registered assembly downgrade',origin:'provider',registration:'registered'},
    {label:'partition ownership downgrade',origin:'provider',registration:'partitions'},
    {label:'version 2 downgrade',origin:'provider',registration:'version'},
    {label:'missing version 2 origin',origin:undefined,registration:'registered'},
    {label:'empty receipt origin',origin:'',registration:'registered'},
    {label:'null receipt origin',origin:null,registration:'registered'},
    {label:'unknown receipt origin',origin:'unrecognized',registration:'registered'},
    {label:'registered provider relabeled assembly',origin:'assembly',registration:'registered'},
  ])('rejects $label before another call and preserves all stored artifacts',async({origin,registration})=>{
    const {root,path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const provider=splitProvider(slices,slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}]})),()=>result({groups:[completeGroup]}),true);
    let runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const started=await startProduct(runtime,path),paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');await runtime.shutdown();
    const assembly=paused.tasks.find(task=>origin==='assembly'?task.kind==='research'&&task.outputOrigin==='provider':task.kind==='design'&&task.outputOrigin==='assembly')!,directory=join(path,'runtime/planning',paused.id,'tasks',assembly.id),receiptPath=join(directory,'result-receipt.json'),runFile=join(path,'runtime/planning',paused.id,'run.json');
    const receipt=JSON.parse(await readFile(receiptPath,'utf8'));if(origin===undefined)delete receipt.origin;else receipt.origin=origin;
    await writeFile(receiptPath,JSON.stringify(receipt));
    if(registration==='partitions'){delete assembly.outputOrigin;delete assembly.assemblyVersion;delete assembly.assemblyKnownEvidenceHash;}
    else if(registration==='version'){delete assembly.outputOrigin;delete assembly.partitionTaskIds;}
    await writeFile(runFile,JSON.stringify(paused));
    if(origin==='provider')await rm(join(directory,'assembly-known-evidence.json'));
    const files=[runFile,...paused.tasks.filter(task=>task.status==='completed').flatMap(task=>['result.json','result-receipt.json'].map(name=>join(path,'runtime/planning',paused.id,'tasks',task.id,name)))],bytes=await Promise.all(files.map(file=>readFile(file))),before=provider.calls.length;
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);runtimes.push(runtime);
    await expect(runtime.resume(path,paused.id)).rejects.toMatchObject({code:'RESULT_MODIFIED',...(origin==='assembly'?{message:expect.stringContaining('产物来源不一致')}:{})});
    expect(provider.calls).toHaveLength(before);expect((runtime as any).active.size).toBe(0);expect(await Promise.all(files.map(file=>readFile(file)))).toEqual(bytes);
  });
  it('isolates conflicting inherited candidate evidence against actual immutable Core records in a version 2 repair assembly',async()=>{
    const {path,engine}=await setup();
    const canonical={id:'canonical-proof',kind:'user' as const,source:'project:idea',content:'用户的原始目标',obtainedAt:'2026-10-04T00:00:00Z',applicability:'正式原文依据'},orphan={...canonical,id:'orphan-proof',content:'未引用的正式原文'};
    const wrong={...canonical,applicability:'候选改写了用途'},wrongOrphan={...orphan,applicability:'历史候选改写了用途'};
    const technical=group('technical');technical.blocks[0]!.evidenceIds=[canonical.id];const slices=[technical.blocks.slice(0,3),technical.blocks.slice(3)];
    const calls:any[]=[],sourceFiles:string[]=[],sourceBytes:Buffer[]=[];let runId='',reviews=0;
    const provider={async complete(request:any){
      calls.push(request);const context=JSON.parse(request.contextText);
      if(context.workPartition)return success(result({groups:[{...technical,id:context.workPartition.id,blocks:slices[context.workPartition.id==='a'?0:1]}]}));
      if(request.prompt.includes('任务拆分')){
        const active=await runtime.get(path,runId);sourceFiles.push(...active.tasks.filter(task=>['design','integration'].includes(task.kind)&&task.status==='completed').flatMap(task=>['result.json','result-receipt.json'].map(name=>join(path,'runtime/planning',runId,'tasks',task.id,name))));sourceBytes.push(...await Promise.all(sourceFiles.map(file=>readFile(file))));
        return success(result({workItems:slices.map((blocks,index)=>({id:index?'b':'a',goal:`技术范围${index}`,blockIds:blocks.map((block:any)=>block.id),dependsOn:[]}))}));
      }
      if(request.prompt.includes('你负责官方资料研究'))return success(result());
      if(request.prompt.includes('你是独立评审者')){reviews++;expect(context.workerResults.draft.evidence).toHaveLength(1);expect(context.workerResults.draft.evidence[0].id).not.toBe(canonical.id);return success(result());}
      if(request.prompt.includes('本任务目标：修订最新草案')){expect(context.currentIssues.join('；')).toContain(canonical.id);return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};}
      return success(result({groups:[technical],evidence:[wrong,wrongOrphan]}));
    }};
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);const product=group('product');product.blocks[0]!.evidenceIds=[canonical.id];product.blocks[1]!.evidenceIds=[orphan.id];
    snapshot=await runtime.service.propose(path,{id:'canonical-baseline',runId:'run-baseline',stage:'product',basis:planningBasis(snapshot),summary:'正式证据基线',groups:[product],evidence:[canonical,orphan],status:'pending',createdAt:new Date().toISOString(),approvals:[]});
    snapshot=await runtime.service.approve(path,'canonical-baseline',{expectedRevision:snapshot.metadata.stateRevision,operationId:'approve-canonical-baseline',groupIds:[product.id]});
    const started=await runtime.start(path,{stage:'technical',expectedRevision:snapshot.metadata.stateRevision,operationId:'canonical-assembly'});runId=started.id;const done=await settled(runtime,path,runId);
    expect(done.status).toBe('reviewable');expect(reviews).toBe(1);expect(calls.filter(request=>request.prompt.includes('任务拆分'))).toHaveLength(1);
    snapshot=await runtime.service.get(path);expect(snapshot.planning!.evidence).toEqual([canonical,orphan]);
    const proposal=snapshot.planning!.changeSets.find(change=>change.runId===done.id)!;expect(proposal.evidence).toHaveLength(1);const inherited=proposal.evidence[0]!;
    expect(inherited.id).not.toBe(canonical.id);expect({...inherited,id:canonical.id}).toEqual(wrong);expect(proposal.groups.flatMap(item=>item.blocks).find(block=>block.id==='stack')!.evidenceIds).toEqual([inherited.id]);
    expect(proposal.evidence.some(record=>record.id===orphan.id)).toBe(false);expect(await Promise.all(sourceFiles.map(file=>readFile(file)))).toEqual(sourceBytes);
    const repair=done.tasks.find(task=>task.kind==='revision'&&!task.partition)!,directory=join(path,'runtime/planning',done.id,'tasks',repair.id),receipt=JSON.parse(await readFile(join(directory,'result-receipt.json'),'utf8')),known=JSON.parse(await readFile(join(directory,'assembly-known-evidence.json'),'utf8'));
    expect(receipt.assemblyVersion).toBe(2);expect(receipt.assemblyKnownEvidenceHash).toBe(hashValue(known));expect(known).toContainEqual(canonical);expect(known).not.toContainEqual(wrong);
    expect(snapshot.planning!.blueprint.blocks.some(block=>block.stage==='technical')).toBe(false);
  });

  it('retains the unfinished registered scope through user answers and automatically repairs an otherwise covered draft that omits it',async()=>{
    const {path,engine}=await setup(),completeGroup=group('product');
    const extra={...completeGroup.blocks[3],id:'special-scope',title:'额外明确范围',content:'回答这个重大问题后还必须实现本登记范围。'};
    const q={...question(),id:'special-question',decisionKey:'special-choice'};let continuationCount=0;
    const provider=splitProvider([completeGroup.blocks,[extra]],[result({groups:[{...completeGroup,id:'a'}]}),result({questions:[q]})],()=>result({groups:[{...completeGroup,blocks:++continuationCount===1?completeGroup.blocks:[...completeGroup.blocks,extra]}]}));
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const started=await startProduct(runtime,path);let run=await settled(runtime,path,started.id);expect(run.pendingQuestions).toHaveLength(1);expect(run.unfinishedBlockIds).toEqual(['special-scope']);
    let snapshot=await runtime.service.get(path);await runtime.service.answer(path,[{questionId:run.pendingQuestions[0]!.id,kind:'selection',optionKeys:['local']}],snapshot.metadata.stateRevision,'answer-special');
    await runtime.resume(path,run.id);run=await settled(runtime,path,run.id);expect(run.status).toBe('reviewable');expect(continuationCount).toBe(2);expect(run.unfinishedBlockIds).toEqual([]);
    snapshot=await runtime.service.get(path);expect(snapshot.planning!.changeSets.at(-1)?.groups.flatMap(item=>item.blocks).some(item=>item.id==='special-scope')).toBe(true);
    const continued=provider.calls.find(request=>request.prompt.includes('本任务目标：依据本轮'));
    expect(JSON.parse(continued.contextText).unfinishedScopes.some((item:any)=>item.requiredBlockIds.includes('special-scope'))).toBe(true);
    expect(provider.calls.find(request=>request.prompt.includes('本任务目标：修订最新草案')).prompt).toContain('special-scope');
    expect(provider.calls.filter(request=>request.prompt.includes('你是独立评审者')).map(request=>JSON.parse(request.contextText).workerResults.draft.groups.flatMap((item:any)=>item.blocks).length)).toEqual([9]);
    const omitted=run.tasks.find(task=>task.kind==='revision'&&!task.partition)!;
    const raw=JSON.parse(await readFile(join(path,'runtime/planning',run.id,'tasks',omitted.id,'result.json'),'utf8'));
    const receipt=JSON.parse(await readFile(join(path,'runtime/planning',run.id,'tasks',omitted.id,'result-receipt.json'),'utf8'));
    expect(raw).toEqual(result({groups:[completeGroup]}));expect(receipt.hash).toBe(hashValue(raw));
  });

  it('retains original approval prerequisites and ties preserved candidate decisions to their replacement blocks',()=>{
    const original=group('product'),a={...original,id:'old-a',blocks:[original.blocks[0]],dependsOn:['old-b'],decisions:[{decisionKey:'candidate',area:'product',statement:'待审建议',rationale:'必须一起看设计',evidenceIds:[]}]},b={...original,id:'old-b',blocks:[original.blocks[1]],dependsOn:[]};
    const tasks=['new-a','new-b'].map(id=>({id,kind:'revision',goal:id,dependsOn:[],status:'completed',model:'model',attempts:1,inputRefs:[]} as any));
    const values=new Map(tasks.map((task,index)=>[task.id,result({groups:[{...original,id:task.id,blocks:[original.blocks[index]]}]}) as any]));
    const assembled=assemblePartitions(tasks,values,result({groups:[a,b]}) as any);
    expect(assembled.groups.find(item=>item.id==='new-a')?.dependsOn).toContain('new-b');
    expect(assembled.groups.find(item=>item.id==='old-a')?.dependsOn.sort()).toEqual(['new-a','new-b']);
  });
  it('keeps deletion ownership from inheriting unrelated build prerequisites while retaining real approval dependencies', () => {
    const original = group('product'), block = (index: number, id: string) => ({ ...original.blocks[index]!, id });
    const tech = { ...original, id: 'old-tech', blocks: [block(0, 'tech')], dependsOn: [] };
    const business = { ...original, id: 'old-business', blocks: [block(1, 'business')], dependsOn: ['old-tech'] };
    const build = { ...original, id: 'old-build', blocks: [block(2, 'build'), block(3, 'obsolete-validation')], dependsOn: ['old-business'] };
    const sources = [
      result({ groups: [{ ...tech, id: 'new-tech', removeBlockIds: ['obsolete-validation'] }] }),
      result({ groups: [{ ...business, id: 'new-business', dependsOn: ['new-tech'] }] }),
      result({ groups: [{ ...build, id: 'new-build', blocks: [build.blocks[0]!] }] }),
    ];
    const tasks = sources.map((_, index) => ({ id: `slice-${index}`, kind: 'revision' as const } as PlanningTask));
    const results = new Map(tasks.map((task, index) => [task.id, sources[index]!]));
    const base = result({ groups: [tech, business, build] }), before = hashValue([base, ...sources]);
    const legacy = assemblePartitions(tasks, results, base);
    expect(planningDependencyCycles(legacy.groups).length).toBeGreaterThan(0);
    const current = assemblePartitions(tasks, results, base, 1, 1, { version: 2, knownEvidence: [] });
    expect(current.groups.find(item => item.id === 'new-tech')!.dependsOn).toEqual([]);
    expect(current.groups.find(item => item.id === 'new-build')!.dependsOn).toEqual(['new-business']);
    expect(current.groups.find(item => item.id === 'new-business')!.dependsOn).toEqual(['new-tech']);
    expect(planningDependencyCycles(current.groups)).toEqual([]); expect(hashValue([base, ...sources])).toBe(before);
    const deletionOnly = assemblePartitions([tasks[0]!], new Map([[tasks[0]!.id, result({ groups: [{ ...tech, id: 'remove-build', blocks: [], removeBlockIds: build.blocks.map(block => block.id) }] })]]), result({ groups: [build] }), 1, 1, { version: 2, knownEvidence: [] });
    expect(deletionOnly.groups[0]!.dependsOn).toEqual(['old-business']);
  });
  it('keeps conflicting referenced base claims under separate IDs and excludes unused historical base evidence from a new candidate', () => {
    const canonical = { id: 'proof', kind: 'user' as const, source: 'project:idea', content: '用户原文', obtainedAt: '2026-10-04T00:00:00Z', applicability: '正式依据' };
    const modified = { ...canonical, applicability: '候选不同解释' }, orphan = { ...canonical, id: 'orphan-proof', content: '无关历史解释' };
    const content = group('product'); content.blocks[0]!.evidenceIds = ['proof'];
    const base = result({ groups: [content], evidence: [modified, orphan] });
    const source = result({ groups: [content] }), tasks = [{ id: 'slice', kind: 'revision' as const } as PlanningTask], results = new Map([[tasks[0]!.id, source]]);
    const before = hashValue([base, source]);
    const assembled = assemblePartitions(tasks, results, base, 1, 1, { version: 2, knownEvidence: [canonical, { ...orphan, content: '正式原文' }] });
    expect(assembled.evidence).toHaveLength(1); expect(assembled.evidence[0]!.id).not.toBe('proof');
    expect(assembled.groups[0]!.blocks[0]!.evidenceIds).toEqual([assembled.evidence[0]!.id]);
    expect({ ...assembled.evidence[0], id: 'proof' }).toEqual(modified); expect(hashValue([base, source])).toBe(before);
  });

  it.each(['modify','delete'] as const)('preserves the pending %s of a formal block through an unanswered slice and carries its legal candidate intent into answer continuation',async(action)=>{
    const {path,engine}=await setup(),completeGroup=group('product');
    const obsolete={...completeGroup.blocks[4],id:'obsolete',title:'旧范围',content:'旧正式范围，尚未批准删除。'};
    const changed={...completeGroup.blocks[5],content:'合法候选修改：保存失败保留全部编辑输入，恢复入口一直可见。'};
    const target=action==='modify'?'notes':'obsolete';
    const candidate=result({groups:[{...completeGroup,id:'legal-candidate',blocks:action==='modify'?[completeGroup.blocks[0],changed]:[completeGroup.blocks[0]],removeBlockIds:action==='delete'?['obsolete']:[]}]});
    const q=question(`pending-${action}`,`question-${action}`),calls:any[]=[];let continued=0;
    const provider={async complete(request:any){calls.push(request);const context=JSON.parse(request.contextText);
      if(context.workPartition)return success(context.workPartition.id==='a'?result({groups:[{...completeGroup,id:'preserved',blocks:[completeGroup.blocks[0]]}]}):result({questions:[q]}));
      if(request.prompt.includes('任务拆分'))return success(result({workItems:[{id:'a',goal:'保留目标',blockIds:['target'],dependsOn:[]},{id:'b',goal:`${action}正式块`,blockIds:[target],dependsOn:[]}]}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return success(candidate);
      if(request.prompt.includes('本任务目标：整合当前工作者产物'))return {structuredSuccess:false,status:'failed',stderr:limit,structuredOutput:result({groups:[{...completeGroup,id:'rejected-error-output',blocks:[{...changed,content:'ERROR产物不能成为恢复依据。'}],removeBlockIds:['non-goals']}]}),durationMs:1,exitCode:0};
      if(request.prompt.includes('本任务目标：依据本轮')||request.prompt.includes('本任务目标：修订最新草案'))return success(++continued===1?result({groups:[{...completeGroup,id:'omitted',blocks:[completeGroup.blocks[0]]}]}):candidate);
      return success(result());
    }};
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);
    const baseline={id:`baseline-${action}`,runId:'run-baseline',stage:'product' as const,basis:planningBasis(snapshot),summary:'正式基线',groups:[{...completeGroup,blocks:[...completeGroup.blocks,obsolete]}],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    snapshot=await runtime.service.propose(path,baseline);
    snapshot=await runtime.service.approve(path,baseline.id,{expectedRevision:snapshot.metadata.stateRevision,operationId:`approve-${action}`,groupIds:[completeGroup.id]});
    const started=await runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:`revise-${action}`});
    let run=await settled(runtime,path,started.id);expect(run.pendingQuestions).toHaveLength(1);expect(run.unfinishedBlockIds).toEqual([target]);
    snapshot=await runtime.service.get(path);await runtime.service.answer(path,[{questionId:run.pendingQuestions[0]!.id,kind:'selection',optionKeys:['local']}],snapshot.metadata.stateRevision,`answer-${action}`);
    await runtime.resume(path,run.id);run=await settled(runtime,path,run.id);
    expect.soft(run.status).toBe('reviewable');expect.soft(continued).toBe(2);expect.soft(run.unfinishedBlockIds).toEqual([]);
    const continuation=calls.find(request=>request.prompt.includes('本任务目标：依据本轮'));
    const scope=JSON.parse(continuation.contextText).unfinishedScopes.find((item:any)=>item.partition?.id==='b');
    expect.soft(scope?.requiredBlockIds).toEqual([target]);
    if(action==='modify')expect.soft(scope?.previousCandidateBlocks).toEqual([changed]);
    else expect.soft(scope?.previousCandidateRemoveIds).toEqual(['obsolete']);
    expect.soft(JSON.stringify(scope)).not.toContain('ERROR产物');
    expect.soft(calls.find(request=>request.prompt.includes('本任务目标：修订最新草案')).prompt).toContain(target);
    expect.soft(calls.filter(request=>request.prompt.includes('你是独立评审者')).map(request=>JSON.parse(request.contextText).workerResults.draft.groups)).toEqual([candidate.groups]);
    const proposal=(await runtime.service.get(path)).planning!.changeSets.find(change=>change.runId===run.id)!;
    if(action==='modify')expect(proposal.groups.flatMap(item=>item.blocks).find(item=>item.id==='notes')).toEqual(changed);
    else expect(proposal.groups.flatMap(item=>item.removeBlockIds)).toContain('obsolete');
    const formal=(await runtime.service.get(path)).planning!.blueprint.blocks;
    expect(formal.find(item=>item.id==='notes')?.content).toBe(completeGroup.blocks[5].content);expect(formal.some(item=>item.id==='obsolete')).toBe(true);
  });

  it.each(['complete','truncated'] as const)('rebuilds an assembly from source receipts after result writing and before receipt writing (%s orphan)',async(orphan)=>{
    const {root,path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const provider=splitProvider(slices,slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}]})),()=>result({groups:[completeGroup]}));
    let runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const storage=(runtime as any).storage,write=storage.writeJson.bind(storage);let interrupted=false,orphanPath='',written:any;
    vi.spyOn(storage,'writeJson').mockImplementation(async(location:string,value:any)=>{
      if(!interrupted&&location.endsWith('result-receipt.json')&&value.origin==='assembly'){
        interrupted=true;orphanPath=location.replace('result-receipt.json','result.json');written=JSON.parse(await readFile(orphanPath,'utf8'));
        if(orphan==='truncated')await writeFile(orphanPath,'{"interrupted":');
        throw new Error('EIO injected after assembly result write before receipt write');
      }
      return write(location,value);
    });
    const started=await startProduct(runtime,path),paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');expect(interrupted).toBe(true);
    const parent=paused.tasks.find(task=>task.outputOrigin==='assembly')!;expect(parent.partitionTaskIds).toHaveLength(2);
    const sourceReceipts=await Promise.all(parent.partitionTaskIds!.map(id=>readFile(join(path,'runtime/planning',paused.id,'tasks',id,'result-receipt.json'))));
    await expect(readFile(orphanPath.replace('result.json','result-receipt.json'))).rejects.toMatchObject({code:'ENOENT'});
    await runtime.shutdown();const before=provider.calls.length;
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);runtimes.push(runtime);
    await runtime.resume(path,paused.id);const run=await settled(runtime,path,paused.id);expect(run.status).toBe('reviewable');
    expect(JSON.parse(await readFile(orphanPath,'utf8'))).toEqual(written);
    const receipt=JSON.parse(await readFile(orphanPath.replace('result.json','result-receipt.json'),'utf8'));expect(receipt.origin).toBe('assembly');expect(receipt.children).toHaveLength(2);
    expect(await Promise.all(parent.partitionTaskIds!.map(id=>readFile(join(path,'runtime/planning',paused.id,'tasks',id,'result-receipt.json'))))).toEqual(sourceReceipts);
    expect(provider.calls.slice(before).every(request=>request.prompt.includes('你是独立评审者'))).toBe(true);
    expect((await runtime.service.get(path)).planning!.blueprint.blocks).toEqual([]);
  });

  it('blocks final delivery when a later complete revision drops registered modifications and removals of formal blocks',async()=>{
    const {path,engine}=await setup(),completeGroup=group('product');
    const obsolete={...completeGroup.blocks[4],id:'obsolete',title:'旧范围'},changed={...completeGroup.blocks[5],content:'待批准修改：持久恢复保存失败的输入。'};
    const candidate=result({groups:[{...completeGroup,id:'candidate',blocks:[completeGroup.blocks[0],changed],removeBlockIds:['obsolete']}]});let reviews=0;
    const provider={async complete(request:any){const context=JSON.parse(request.contextText);
      if(context.workPartition)return success(result({groups:[{...completeGroup,id:context.workPartition.id,blocks:context.workPartition.id==='a'?[completeGroup.blocks[0]]:[changed],removeBlockIds:context.workPartition.id==='b'?['obsolete']:[]}]}));
      if(request.prompt.includes('任务拆分'))return success(result({workItems:[{id:'a',goal:'保留目标',blockIds:['target'],dependsOn:[]},{id:'b',goal:'保留修改与删除',blockIds:['notes','obsolete'],dependsOn:[]}]}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return success(candidate);
      if(request.prompt.includes('本任务目标：整合当前工作者产物'))return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};
      if(request.prompt.includes('你是独立评审者'))return success(result({blockers:reviews++===0?['notes 的恢复描述需要更具体。']:[]}));
      if(request.prompt.includes('本任务目标：修订最新草案'))return success(result({groups:[{...completeGroup,id:'discarded-scope',blocks:[completeGroup.blocks[0]]}]}));
      return success(result());
    }};
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);const baseline={id:'final-baseline',runId:'run-baseline',stage:'product' as const,basis:planningBasis(snapshot),summary:'正式基线',groups:[{...completeGroup,blocks:[...completeGroup.blocks,obsolete]}],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    snapshot=await runtime.service.propose(path,baseline);snapshot=await runtime.service.approve(path,baseline.id,{expectedRevision:snapshot.metadata.stateRevision,operationId:'approve-final-baseline',groupIds:[completeGroup.id]});
    const started=await runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:'final-capacity-revision'});
    const run=await settled(runtime,path,started.id);expect(run.status).toBe('paused');expect(run.error).toContain('登记范围尚未完成：notes');expect(run.error).toContain('登记范围尚未完成：obsolete');expect(run.unfinishedBlockIds).toEqual(['notes','obsolete']);
    expect((await runtime.service.get(path)).planning!.changeSets.filter(change=>change.runId===run.id)).toEqual([]);expect(reviews).toBe(1);
  });

  it('still rejects a Provider result whose receipt is missing instead of treating it as a recoverable assembly',async()=>{
    const {root,path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const provider=splitProvider(slices,slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}]})),()=>result({groups:[completeGroup]}),true);
    let runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    const started=await startProduct(runtime,path),paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');await runtime.shutdown();
    const child=paused.tasks.find(task=>task.partition&&task.outputOrigin==='provider')!;
    await rm(join(path,'runtime/planning',paused.id,'tasks',child.id,'result-receipt.json'));
    const before=provider.calls.length;
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);runtimes.push(runtime);
    await expect(runtime.resume(path,paused.id)).rejects.toMatchObject({code:'RESULT_MODIFIED'});
    expect(provider.calls).toHaveLength(before);expect((runtime as any).active.size).toBe(0);
  });

  it('shows a deferred fourth question with a valid reopen reason even when its topic has an earlier answer',async()=>{
    const {path,engine}=await setup(),completeGroup=group('product'),slices=[completeGroup.blocks.slice(0,4),completeGroup.blocks.slice(4)];
    const questions=[1,2,3].map(index=>question(`fresh-${index}`,`fresh-question-${index}`));
    questions.push({...question('notes:storage','storage-reopened'),reopenReason:'新增恢复要求需要重新确认存储取舍。'});
    const provider=splitProvider(slices,slices.map((blocks,index)=>result({groups:[{...completeGroup,id:index?'b':'a',blocks}],questions:questions.slice(index*2,index*2+2)})),()=>result({groups:[completeGroup]}));
    const runtime=new PlanningRuntime(engine,provider as any,{},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);
    snapshot=await runtime.service.installQuestions(path,planningBasis(snapshot),[question()], 'prior-storage');
    await runtime.service.answer(path,[{questionId:snapshot.questions.items[0]!.id,kind:'selection',optionKeys:['local']}],snapshot.metadata.stateRevision,'prior-storage-answer');
    const started=await startProduct(runtime,path);let run=await settled(runtime,path,started.id);expect(run.pendingQuestions.map(item=>item.decisionKey)).toEqual(['fresh-1','fresh-2','fresh-3']);
    snapshot=await runtime.service.get(path);await runtime.service.answer(path,run.pendingQuestions.map(item=>({questionId:item.id,kind:'selection' as const,optionKeys:['local']})),snapshot.metadata.stateRevision,'answer-fresh');
    await runtime.resume(path,run.id);run=await settled(runtime,path,run.id);
    expect(run.status).toBe('paused');expect(run.pendingQuestions).toHaveLength(1);expect(run.pendingQuestions[0]?.decisionKey).toBe('notes:storage');expect(run.pendingQuestions[0]?.reopenReason).toBe(questions[3]!.reopenReason);
    expect(run.deferredQuestions?.map(item=>item.id)).toEqual(['storage-reopened']);
    snapshot=await runtime.service.get(path);await runtime.service.answer(path,[{questionId:run.pendingQuestions[0]!.id,kind:'selection',optionKeys:['local']}],snapshot.metadata.stateRevision,'answer-reopened');
    await runtime.resume(path,run.id);run=await settled(runtime,path,run.id);expect(run.status).toBe('reviewable');expect(run.deferredQuestions??[]).toEqual([]);
    expect((await runtime.service.get(path)).questions.items.filter(item=>item.decisionKey==='notes:storage'&&item.status==='answered')).toHaveLength(2);
  });

  it.each(['modify','delete'] as const)('requires an explicit candidate action for a registered formal-block %s in initial design splitting without a base candidate',async(action)=>{
    const {root,path,engine}=await setup(),completeGroup=group('product');
    const obsolete={...completeGroup.blocks[4],id:'obsolete',title:'旧范围',content:'已批准的旧范围，删除必须作为候选提出。'};
    const changed={...completeGroup.blocks[5],content:'新增明确恢复入口：保存失败保留全部草稿，允许用户重试。'};
    const requiredId=action==='modify'?'notes':'obsolete';let supplyAction=false;const calls:any[]=[];
    const provider={async complete(request:any){calls.push(request);const context=JSON.parse(request.contextText);
      if(context.workPartition){
        if(context.workPartition.id==='a')return success(result({groups:[{...completeGroup,id:'a-group',blocks:[completeGroup.blocks[0]]}]}));
        return success(supplyAction?result({groups:[{...completeGroup,id:'b-group',blocks:action==='modify'?[changed]:[],removeBlockIds:action==='delete'?['obsolete']:[]}]}):result());
      }
      if(request.prompt.includes('任务拆分'))return success(result({workItems:[{id:'a',goal:'明确保留目标',blockIds:['target'],dependsOn:[]},{id:'b',goal:`明确${action}既有正式范围`,blockIds:[requiredId],dependsOn:[]}]}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};
      return success(result());
    }};
    let runtime=new PlanningRuntime(engine,provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);
    const baseline={id:`initial-baseline-${action}`,runId:'run-baseline',stage:'product' as const,basis:planningBasis(snapshot),summary:'正式旧产品',groups:[{...completeGroup,blocks:[...completeGroup.blocks,obsolete]}],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    snapshot=await runtime.service.propose(path,baseline);snapshot=await runtime.service.approve(path,baseline.id,{expectedRevision:snapshot.metadata.stateRevision,operationId:`approve-initial-${action}`,groupIds:[completeGroup.id]});
    const started=await runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:`initial-split-${action}`});
    const paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');expect(paused.error).toContain('遗漏');
    const parent=paused.tasks.find(task=>task.kind==='design'&&!task.partition)!;
    expect(parent.assemblyBaseTaskId).toBeUndefined();
    const preserved=paused.tasks.find(task=>task.partition?.id==='a')!,missing=paused.tasks.find(task=>task.partition?.id==='b')!;
    expect(preserved.status).toBe('completed');expect(missing.status).toBe('paused');expect(missing.requiredBlockIds).toEqual([requiredId]);
    expect((await runtime.service.get(path)).planning!.changeSets.filter(change=>change.runId===paused.id)).toEqual([]);
    const preservedDirectory=join(path,'runtime/planning',paused.id,'tasks',preserved.id);
    const preservedBytes=await readFile(join(preservedDirectory,'result.json')),preservedReceipt=await readFile(join(preservedDirectory,'result-receipt.json'));
    await expect(readFile(join(path,'runtime/planning',paused.id,'tasks',missing.id,'result.json'))).rejects.toMatchObject({code:'ENOENT'});
    await runtime.shutdown();const before=calls.length;
    // Older registrations excluded existing formal IDs from requiredBlockIds.
    paused.tasks.filter(task=>task.partition).forEach(task=>task.requiredBlockIds=[]);
    await writeFile(join(path,'runtime/planning',paused.id,'run.json'),JSON.stringify(paused));
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    await runtime.resume(path,paused.id);const legacyPaused=await settled(runtime,path,paused.id);
    expect(legacyPaused.status).toBe('paused');expect(legacyPaused.tasks.find(task=>task.id===missing.id)?.requiredBlockIds).toEqual([requiredId]);
    expect((await runtime.service.get(path)).planning!.changeSets.filter(change=>change.runId===paused.id)).toEqual([]);
    await runtime.shutdown();supplyAction=true;
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    await runtime.resume(path,paused.id);const run=await settled(runtime,path,paused.id);expect(run.status).toBe('reviewable');expect(run.unfinishedBlockIds).toEqual([]);
    expect(calls.slice(before).filter(request=>JSON.parse(request.contextText).workPartition).map(request=>JSON.parse(request.contextText).workPartition.id)).toEqual(['b','b']);
    expect(calls.slice(before).some(request=>request.prompt.includes('任务拆分'))).toBe(false);
    expect(await readFile(join(preservedDirectory,'result.json'))).toEqual(preservedBytes);expect(await readFile(join(preservedDirectory,'result-receipt.json'))).toEqual(preservedReceipt);
    snapshot=await runtime.service.get(path);const proposal=snapshot.planning!.changeSets.find(change=>change.runId===run.id)!;
    if(action==='modify')expect(proposal.groups.flatMap(item=>item.blocks).find(item=>item.id==='notes')).toEqual(changed);
    else expect(proposal.groups.flatMap(item=>item.removeBlockIds)).toContain('obsolete');
    expect(snapshot.planning!.blueprint.blocks.find(item=>item.id==='notes')?.content).toBe(completeGroup.blocks[5].content);expect(snapshot.planning!.blueprint.blocks.some(item=>item.id==='obsolete')).toBe(true);
    expect((runtime as any).runningCalls).toBe(0);
  });

  it.each(['none','after-reference','after-cleanup'] as const)('retries a legacy completed scope and rejects all derived drafts while retaining source evidence (%s interruption)',async(interruption)=>{
    const {root,path,engine}=await setup(),completeGroup=group('product');
    const changed={...completeGroup.blocks[5],content:'旧待批准候选：保存失败保留编辑输入。'};
    const fresh={...changed,content:'恢复后完整候选：保存失败保留编辑输入，并一直显示可操作的重试入口。'};
    let recovering=false,reviews=0;const calls:any[]=[];
    const candidate=()=>result({summary:recovering?'重新履责并评审当前完整候选。':'旧版完整候选。',groups:[{...completeGroup,id:'revision-candidate',blocks:[completeGroup.blocks[0],recovering?fresh:changed]}]});
    const provider={async complete(request:any){calls.push(request);const context=JSON.parse(request.contextText);
      if(context.workPartition)return success(result({groups:[{...completeGroup,id:`${context.workPartition.id}-group`,blocks:context.workPartition.id==='a'?[completeGroup.blocks[0]]:[recovering?fresh:changed]}]}));
      if(request.prompt.includes('任务拆分'))return success(result({workItems:[{id:'a',goal:'保留目标',blockIds:['target'],dependsOn:[]},{id:'b',goal:'履行正式笔记块的候选修改',blockIds:['notes'],dependsOn:[]}]}));
      if(request.prompt.includes('本任务目标：生成本阶段完整设计'))return {structuredSuccess:false,status:'failed',stderr:limit,durationMs:1,exitCode:0};
      if(request.prompt.includes('本任务目标：修订最新草案'))return success(candidate());
      if(request.prompt.includes('你是独立评审者'))return recovering?success(result()):++reviews===1?success(result({blockers:['补充明确的失败重试入口。']})):{structuredSuccess:false,status:'failed',stderr:'Permission denied in legacy review',durationMs:1,exitCode:1};
      return success(result());
    }};
    let runtime=new PlanningRuntime(engine,provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    let snapshot=await runtime.service.get(path);
    const baseline={id:'legacy-scope-baseline',runId:'run-baseline',stage:'product' as const,basis:planningBasis(snapshot),summary:'正式产品',groups:[completeGroup],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    snapshot=await runtime.service.propose(path,baseline);snapshot=await runtime.service.approve(path,baseline.id,{expectedRevision:snapshot.metadata.stateRevision,operationId:'approve-legacy-scope',groupIds:[completeGroup.id]});
    const started=await runtime.start(path,{stage:'product',expectedRevision:snapshot.metadata.stateRevision,operationId:'legacy-completed-scope'});
    const paused=await settled(runtime,path,started.id);expect(paused.status).toBe('paused');expect(paused.error).toContain('legacy review');await runtime.shutdown();
    const runDirectory=join(path,'runtime/planning',paused.id),taskDirectory=(id:string)=>join(runDirectory,'tasks',id);
    const missing=paused.tasks.find(task=>task.partition?.id==='b')!,preserved=paused.tasks.find(task=>task.partition?.id==='a')!,plan=paused.tasks.find(task=>task.kind==='decomposition')!;
    const artifacts=new Map<string,{output:any;receipt:any}>();
    for(const task of paused.tasks.filter(task=>task.status==='completed'))artifacts.set(task.id,{output:JSON.parse(await readFile(join(taskDirectory(task.id),'result.json'),'utf8')),receipt:JSON.parse(await readFile(join(taskDirectory(task.id),'result-receipt.json'),'utf8'))});
    // This models a hash-consistent SUCCESS accepted under the old scope rule.
    const legacy=artifacts.get(missing.id)!;legacy.output=result();legacy.receipt.hash=hashValue(legacy.output);missing.outputHash=legacy.receipt.hash;
    paused.tasks.filter(task=>task.partition).forEach(task=>task.requiredBlockIds=[]);
    const rebuilt=new Set<string>();
    const rebuild=(task:any)=>{
      if(task.outputOrigin!=='assembly'||rebuilt.has(task.id))return;
      const children=task.partitionTaskIds.map((id:string)=>paused.tasks.find(item=>item.id===id)!);children.forEach(rebuild);
      if(task.assemblyBaseTaskId)rebuild(paused.tasks.find(item=>item.id===task.assemblyBaseTaskId)!);
      const values=new Map([...artifacts].map(([id,value])=>[id,value.output]));
      const batched=batchAssembledQuestions(assemblePartitions(children,values,task.assemblyBaseTaskId?values.get(task.assemblyBaseTaskId):undefined)),artifact=artifacts.get(task.id)!;
      artifact.output=batched.output;artifact.receipt.hash=hashValue(batched.output);artifact.receipt.children=children.map((child:any)=>({taskId:child.id,hash:hashValue(values.get(child.id))}));artifact.receipt.deferredQuestions=batched.deferred;
      task.outputHash=artifact.receipt.hash;task.deferredQuestions=batched.deferred;rebuilt.add(task.id);
    };
    paused.tasks.filter(task=>task.outputOrigin==='assembly').forEach(rebuild);
    for(const [id,artifact] of artifacts){await writeFile(join(taskDirectory(id),'result.json'),JSON.stringify(artifact.output));await writeFile(join(taskDirectory(id),'result-receipt.json'),JSON.stringify(artifact.receipt));}
    await writeFile(join(runDirectory,'run.json'),JSON.stringify(paused));
    const stale=paused.tasks.filter(task=>task.status==='completed'&&![preserved.id,plan.id].includes(task.id)&&task.kind!=='research');
    expect(stale.some(task=>task.kind==='revision')).toBe(true);expect(stale.some(task=>task.kind==='review')).toBe(true);expect(stale.filter(task=>task.outputOrigin==='assembly')).toHaveLength(2);
    const oldBytes=new Map<string,{result:Buffer;receipt:Buffer}>();
    for(const task of [...stale,preserved,plan])oldBytes.set(task.id,{result:await readFile(join(taskDirectory(task.id),'result.json')),receipt:await readFile(join(taskDirectory(task.id),'result-receipt.json'))});
    const callBytes=await readFile(join(taskDirectory(missing.id),'call-1.json'));const before=calls.length;recovering=true;
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    if(interruption!=='none'){
      const storage=(runtime as any).storage,write=storage.writeJson.bind(storage);let interrupted=false;
      vi.spyOn(storage,'writeJson').mockImplementation(async(location:string,value:any)=>{
        await write(location,value);
        const task=value.tasks?.find((item:any)=>item.id===missing.id);
        if(!interrupted&&location===join(runDirectory,'run.json')&&task?.status==='paused'&&(interruption==='after-reference'?task.outputRef?.includes('/scope-rejections/'):!task.outputRef&&!task.outputHash)){
          interrupted=true;throw new Error(`EIO injected ${interruption}`);
        }
      });
      await expect(runtime.resume(path,paused.id)).rejects.toThrow('EIO injected');expect(interrupted).toBe(true);expect(calls).toHaveLength(before);await runtime.shutdown();
      runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{concurrency:2},[1,2]);runtimes.push(runtime);
    }
    await runtime.resume(path,paused.id);const run=await settled(runtime,path,paused.id);expect(run.status).toBe('reviewable');
    const resumedCalls=calls.slice(before);expect(resumedCalls.filter(request=>JSON.parse(request.contextText).workPartition).map(request=>JSON.parse(request.contextText).workPartition.id)).toEqual(['b']);
    expect(resumedCalls.some(request=>request.prompt.includes('任务拆分'))).toBe(false);expect(resumedCalls.some(request=>request.prompt.includes('本任务目标：修订最新草案'))).toBe(true);expect(resumedCalls.some(request=>request.prompt.includes('你是独立评审者'))).toBe(true);
    expect(run.tasks.find(task=>task.id===missing.id)?.attempts).toBe(missing.attempts+1);
    for(const task of [preserved,plan]){expect(await readFile(join(taskDirectory(task.id),'result.json'))).toEqual(oldBytes.get(task.id)!.result);expect(await readFile(join(taskDirectory(task.id),'result-receipt.json'))).toEqual(oldBytes.get(task.id)!.receipt);expect(run.tasks.find(item=>item.id===task.id)?.attempts).toBe(task.attempts);}
    for(const task of stale){const archives=await readdir(join(taskDirectory(task.id),'scope-rejections'));expect(archives).toHaveLength(1);expect(await readFile(join(taskDirectory(task.id),'scope-rejections',archives[0]!,'result.json'))).toEqual(oldBytes.get(task.id)!.result);expect(await readFile(join(taskDirectory(task.id),'scope-rejections',archives[0]!,'result-receipt.json'))).toEqual(oldBytes.get(task.id)!.receipt);}
    expect(await readFile(join(taskDirectory(missing.id),'call-1.json'))).toEqual(callBytes);
    snapshot=await runtime.service.get(path);expect(snapshot.planning!.changeSets.find(change=>change.runId===run.id)!.groups.flatMap(item=>item.blocks).find(block=>block.id==='notes')).toEqual(fresh);
    expect(snapshot.planning!.blueprint.blocks.find(block=>block.id==='notes')?.content).toBe(completeGroup.blocks[5].content);
  });
});
