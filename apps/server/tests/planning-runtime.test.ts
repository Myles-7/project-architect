import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { mkdtemp,rm,readFile,writeFile,mkdir,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage,ProjectStateEngine,WorkspaceGuard,planningBasis,hashValue } from '@project-architect/core';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { semanticProgressSignature } from '../src/planning/PlanningProgress.js';
import { verifyTaskEvidence } from '../src/planning/PlanningEvidence.js';
import { result,group,question,clarification,FixturePlanningProvider } from '../../../tests/fixtures/planning.mjs';

describe('Planning runtime lifecycle and authority',()=>{
  let root:string,path:string,engine:ProjectStateEngine,runtime:PlanningRuntime;
  beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'pa-runtime-'));path=join(root,'project');engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root));await engine.createProject({name:'规划测试',idea:'个人笔记工具',projectPath:path});runtime=new PlanningRuntime(engine,new FixturePlanningProvider() as any,{},[1,2]);});
  afterEach(async()=>{for(const active of (runtime as any).active.values())active.abort.abort();await Promise.all([...((runtime as any).active.values())].map((a:any)=>a.completion));await rm(root,{recursive:true,force:true});});
  async function start(stage='clarify'){const s=await runtime.service.get(path);return runtime.start(path,{stage:stage as any,expectedRevision:s.metadata.stateRevision,operationId:`start-${stage}-${Math.random()}`});}
  async function settled(id:string){await vi.waitFor(async()=>expect((runtime as any).active.has(id)).toBe(false),{timeout:5000});return runtime.get(path,id);}
  async function projectFileBytes(directory=path,prefix=''):Promise<Record<string,string>>{
    const files:Record<string,string>={};
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const key=`${prefix}${entry.name}`,file=join(directory,entry.name);
      if(entry.isDirectory())Object.assign(files,await projectFileBytes(file,`${key}/`));
      else files[key]=(await readFile(file)).toString('base64');
    }
    return files;
  }
  async function seedFeedbackBlueprint(){
    const groups=[group('product'),group('technical'),group('delivery')];
    const delivery=groups[2]!;delivery.blocks.push(...['accept-recovery','accept-empty'].map(id=>({...delivery.blocks[1]!,id})));
    let snapshot=await runtime.service.get(path);
    snapshot=await runtime.service.propose(path,{id:'ordinary-revision-baseline',runId:'run-baseline',stage:'product',basis:planningBasis(snapshot),summary:'正式完整基线',groups,evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]});
    await runtime.service.approve(path,'ordinary-revision-baseline',{expectedRevision:snapshot.metadata.stateRevision,operationId:'approve-ordinary-revision-baseline',groupIds:groups.map(item=>item.id)});
    return groups;
  }
  it.each([
    {stage:'feedback' as const,code:'STAGE_NOT_APPROVED',message:'尚无正式方案可修订'},
    {stage:'technical' as const,code:'STAGE_NOT_APPROVED',message:'请先批准产品与体验'},
    {stage:'delivery' as const,code:'STAGE_NOT_APPROVED',message:'请先批准技术与接口'},
    {stage:'product' as const,code:'CLARIFICATION_REQUIRED',message:'请先澄清目标用户、问题、结果、范围和约束，或明确委托。'},
  ])('rejects $stage feedback before changing state and preserves the prerequisite error on retry',async({stage,code,message})=>{
    let s=await runtime.service.get(path);
    if(stage==='delivery'){
      const proposal={id:'delivery-prerequisite-product',runId:'run-base',stage:'product' as const,basis:planningBasis(s),summary:'测试',groups:[group('product')],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
      s=await runtime.service.propose(path,proposal);
      s=await runtime.service.approve(path,proposal.id,{expectedRevision:s.metadata.stateRevision,operationId:'approve-delivery-prerequisite-product',groupIds:['product-group']});
    }
    s=await runtime.service.installQuestions(path,planningBasis(s),[question() as any],`prerequisite-${stage}`);
    const before=structuredClone(s),files=await projectFileBytes();
    const complete=vi.fn(async()=>{throw new Error('Rejected requests must not invoke a Provider');});
    (runtime as any).provider={complete};
    const request={stage,expectedRevision:s.metadata.stateRevision,operationId:`rejected-${stage}`,feedback:'  用户补充：请保留编辑失败时的完整输入。  '};
    await expect(runtime.start(path,request)).rejects.toMatchObject({code,message});
    const after=await runtime.service.get(path);
    expect.soft(after.metadata.stateRevision).toBe(before.metadata.stateRevision);
    expect.soft(after.planning!.inputs).toEqual(before.planning!.inputs);
    expect.soft(after.questions).toEqual(before.questions);
    expect.soft(after).toEqual(before);
    expect.soft(await projectFileBytes()).toEqual(files);
    expect.soft(await runtime.list(path)).toEqual([]);
    expect.soft((runtime as any).active.size).toBe(0);
    expect.soft(complete).not.toHaveBeenCalled();
    await expect.soft(runtime.start(path,request)).rejects.toMatchObject({code,message});
    expect.soft(await runtime.service.get(path)).toEqual(before);
    expect.soft(await projectFileBytes()).toEqual(files);
    expect.soft(await runtime.list(path)).toEqual([]);
    expect.soft(complete).not.toHaveBeenCalled();
  });
  it('sends complete explicitly selected tradeoffs in provider context after saving and restarting',async()=>{
    const run=await start();const waiting=await settled(run.id);const q=waiting.pendingQuestions[0]!;
    let s=await runtime.service.get(path);
    s=await runtime.service.answer(path,[{questionId:q.id,kind:'selection',optionKeys:['remote']}],s.metadata.stateRevision,'selected-tradeoffs');
    const provider=new FixturePlanningProvider(1);
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);
    await runtime.resume(path,run.id);expect((await settled(run.id)).status).toBe('reviewable');expect(provider.calls.length).toBeGreaterThan(0);
    for(const request of provider.calls){
      const context=JSON.parse((request as any).contextText);const answered=context.answers.find((item:any)=>item.questionId===q.id);
      expect(answered).toMatchObject({questionId:q.id,decisionKey:q.decisionKey,question:q.question,answerKind:'selection',answer:'保存到远程服务',options:q.options,selectedOptionKeys:['remote'],selectedOptions:[q.options.find(option=>option.key==='remote')]});
      expect(answered.selectedOptions[0]).toMatchObject({approach:'笔记保存到自己部署的服务。',gain:'可以跨设备访问。',sacrifice:'需要部署并维护服务。',impact:'增加服务和身份验证。',reversibility:'hard'});
      expect(context.approvedDecisions.find((item:any)=>item.decisionKey===q.decisionKey)?.statement).toBe(`${q.question}\n保存到远程服务：笔记保存到自己部署的服务。`);
    }
  });
  it.each(['custom','delegate','defer'] as const)('sends %s raw answers and all options after restart without inventing a selection',async(kind)=>{
    const run=await start();const waiting=await settled(run.id);const q=waiting.pendingQuestions[0]!;
    const raw='  保存在本地\n保留我的补充约束。  ';let s=await runtime.service.get(path);const decisions=structuredClone(s.decisions.items);
    s=await runtime.service.answer(path,[{questionId:q.id,kind,text:raw,optionKeys:['local']}],s.metadata.stateRevision,`no-selection-${kind}`);
    const provider=new FixturePlanningProvider(1);
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);
    await runtime.resume(path,run.id);expect((await settled(run.id)).status).toBe('reviewable');expect(provider.calls.length).toBeGreaterThan(0);
    for(const request of provider.calls){const context=JSON.parse((request as any).contextText);expect(context.answers.find((item:any)=>item.questionId===q.id)).toMatchObject({questionId:q.id,answerKind:kind,answer:raw,options:q.options,selectedOptionKeys:[],selectedOptions:[]});expect(context.approvedDecisions).toEqual(decisions.filter(item=>['confirmed','locked'].includes(item.status)));}
    const saved=(await runtime.service.get(path)).questions.items.find(item=>item.id===q.id)!;
    expect(saved).not.toHaveProperty('selectedOptionKeys');expect(saved.answer).toBe(raw);
  });
  it('keeps a historical label-matching answer unknown and retains the original options and formal decision as reference',async()=>{
    const run=await start();const waiting=await settled(run.id);const q=waiting.pendingQuestions[0]!;
    let s=await runtime.service.get(path);s=await runtime.service.answer(path,[{questionId:q.id,kind:'selection',optionKeys:['local']}],s.metadata.stateRevision,'legacy-label-source');
    const formal=structuredClone(s.decisions.items.filter(item=>['confirmed','locked'].includes(item.status)));
    // Seed a committed legacy snapshot in this temporary project, so reload reads the verified revision.
    const old=structuredClone(s);const legacy=old.questions.items.find(item=>item.id===q.id)!;delete legacy.answerKind;delete legacy.selectedOptionKeys;
    await engine.commitPlanningState(path,old,s.metadata.stateRevision);
    const questionFile=join(path,'state','questions.json');
    const originalBytes=await readFile(questionFile,'utf8');
    const provider=new FixturePlanningProvider(1);
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);
    await runtime.resume(path,run.id);expect((await settled(run.id)).status).toBe('reviewable');expect(provider.calls.length).toBeGreaterThan(0);
    for(const request of provider.calls){const context=JSON.parse((request as any).contextText);expect(context.answers.find((item:any)=>item.questionId===q.id)).toMatchObject({questionId:q.id,question:q.question,answerKind:'unknown',answer:q.options[0]!.label,options:q.options,selectedOptionKeys:[],selectedOptions:[]});expect(context.approvedDecisions).toEqual(formal);}
    expect(await readFile(questionFile,'utf8')).toBe(originalBytes);
    const saved=(await runtime.service.get(path)).questions.items.find(item=>item.id===q.id)!;
    expect(saved).not.toHaveProperty('answerKind');expect(saved).not.toHaveProperty('selectedOptionKeys');
  });
  it('pauses for valid questions before follow-ups and reevaluates them after answers',async()=>{
    const calls:string[]=[];
    const followUp=[{kind:'research',goal:'回答后查证所选平台'},{kind:'validation',goal:'回答后验证所选方案'}];
    (runtime as any).provider={complete:async(req:any)=>{
      calls.push(req.prompt);
      const context=JSON.parse(req.contextText);
      const output=req.prompt.includes('本任务目标：回答后')?result({summary:'基于已回答方向完成工作。'})
        :req.prompt.includes('本任务目标：整合新增研究与验证')?result({clarification})
        :context.answers.length?result({clarification:{...clarification,constraints:''},followUp})
        :result({questions:[question()],followUp});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    const run=await start();const waiting=await settled(run.id);
    expect(waiting.status).toBe('paused');expect(waiting.pendingQuestions).toHaveLength(1);
    expect(waiting.tasks.map(t=>t.kind)).toEqual(['clarification']);expect(calls).toHaveLength(1);
    let s=await runtime.service.get(path);
    s=await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[0]!.id,kind:'selection',optionKeys:['local']}],s.metadata.stateRevision,'answer-before-follow-up');
    await runtime.resume(path,run.id);const done=await settled(run.id);
    expect(done.status).toBe('reviewable');
    expect(done.tasks.filter(t=>['research','validation'].includes(t.kind)).map(t=>t.goal)).toEqual(followUp.map(f=>f.goal));
    expect(calls.filter(p=>p.includes('本任务目标：回答后'))).toHaveLength(2);
  });
  it('deduplicates asynchronous follow-ups before scheduling and reuses the completed task',async()=>{
    const goal='核对笔记保存失败后的官方恢复行为';
    const duplicate=result({clarification:null,followUp:[{kind:'research',goal},{kind:'research',goal}]});
    const calls:Array<{requestId:string;logPath:string;prompt:string}>=[];let revisions=0;
    (runtime as any).provider={complete:async(req:any)=>{
      calls.push({requestId:req.requestId,logPath:req.logPath,prompt:req.prompt});
      await new Promise(resolve=>setTimeout(resolve,10));
      const output=req.prompt.includes(`本任务目标：${goal}`)?result({summary:'官方恢复行为已核对。'}):req.prompt.includes('本任务目标：整合新增研究与验证')&&++revisions>1?result({clarification}):structuredClone(duplicate);
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:10,exitCode:0};
    }};
    const run=await start();const done=await settled(run.id);
    expect(done.status).toBe('reviewable');
    const tasks=done.tasks.filter(t=>t.kind==='research'&&t.goal===goal);expect(tasks).toHaveLength(1);
    const task=tasks[0]!;expect(task.attempts).toBe(1);expect(task.status).toBe('completed');
    const requests=calls.filter(c=>c.prompt.includes(`本任务目标：${goal}`));expect(requests).toHaveLength(1);
    expect(requests[0]!.requestId).toBe(`${task.id}-1`);
    expect(requests[0]!.logPath).toBe(join(path,'runtime','planning',run.id,'tasks',task.id,'call-1.ndjson'));
    expect(new Set(calls.map(c=>c.requestId)).size).toBe(calls.length);
    expect(revisions).toBe(2);
    expect((await runtime.events(path,run.id)).filter(e=>e.type==='task-started'&&e.taskId===task.id)).toHaveLength(1);
    expect((await readdir(join(path,'runtime','planning',run.id,'tasks',task.id))).filter(name=>/^call-\d+\.json$/.test(name))).toEqual(['call-1.json']);
  });
  it('keeps sibling follow-up work registered and cancellable after another task fails',async()=>{
    (runtime as any).provider={complete:async(req:any)=>{
      if(req.prompt.includes('本任务目标：快速失败'))return {structuredSuccess:false,status:'failed',stderr:'Permission denied',durationMs:1,exitCode:1};
      if(req.prompt.includes('本任务目标：缓慢研究'))return new Promise((_,reject)=>{const abort=()=>reject(new Error('Cancelled'));if(req.abortSignal.aborted)abort();else req.abortSignal.addEventListener('abort',abort,{once:true});});
      return {structuredSuccess:true,status:'success',structuredOutput:result({clarification:null,followUp:[{kind:'research',goal:'快速失败'},{kind:'research',goal:'缓慢研究'}]}),durationMs:1,exitCode:0};
    }};
    const run=await start();await vi.waitFor(async()=>expect((await runtime.get(path,run.id)).tasks.some(t=>t.goal==='缓慢研究'&&t.status==='running')).toBe(true));expect((runtime as any).active.has(run.id)).toBe(true);
    await runtime.cancel(path,run.id);expect((await settled(run.id)).status).toBe('cancelled');expect((runtime as any).runningCalls).toBe(0);
  });
  it('does not invoke a sibling Provider after cancellation during attempt preparation',async()=>{
    const calls:any[]=[];
    (runtime as any).provider={complete:async(req:any)=>{
      calls.push(req);
      if(req.abortSignal.aborted)return {structuredSuccess:false,status:'cancelled',durationMs:0,exitCode:null};
      if(req.prompt.includes('本任务目标：快速失败'))return {structuredSuccess:false,status:'failed',stderr:'Permission denied',durationMs:1,exitCode:1};
      if(req.prompt.includes('本任务目标：缓慢研究'))return new Promise((_,reject)=>{const abort=()=>reject(new Error('Cancelled'));if(req.abortSignal.aborted)abort();else req.abortSignal.addEventListener('abort',abort,{once:true});});
      return {structuredSuccess:true,status:'success',structuredOutput:result({clarification:null,followUp:[{kind:'research',goal:'快速失败'},{kind:'research',goal:'缓慢研究'}]}),durationMs:1,exitCode:0};
    }};
    const storage=(runtime as any).storage,write=storage.writeJson.bind(storage);
    let entered!:()=>void,release!:()=>void,intercepted=false;
    const preparing=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
    const spy=vi.spyOn(storage,'writeJson').mockImplementation(async(location:string,value:any)=>{
      if(!intercepted&&location.endsWith('run.json')&&value.tasks?.some((task:any)=>task.goal==='缓慢研究'&&task.status==='running'&&task.attempts===1)){intercepted=true;entered();await gate;}
      return write(location,value);
    });
    try{
      const run=await start();await preparing;
      const cancelled=runtime.cancel(path,run.id);
      await vi.waitFor(()=>expect((runtime as any).active.get(run.id).abort.signal.aborted).toBe(true));
      release();await cancelled;const done=await settled(run.id);
      expect(done.status).toBe('cancelled');expect(done.tasks.find(task=>task.goal==='缓慢研究')!.status).toBe('cancelled');
      expect(calls.filter(req=>req.prompt.includes('本任务目标：缓慢研究'))).toEqual([]);expect((runtime as any).runningCalls).toBe(0);
    }finally{release();spy.mockRestore();}
  });
  it('finishes ready clarification and passes deferred work to design without running it early',async()=>{
    const base=new FixturePlanningProvider(1),followUp=[{kind:'validation',goal:'设计阶段验证移动平台能力'}];const calls:any[]=[];
    (runtime as any).provider={complete:async(req:any)=>{calls.push(req);const context=JSON.parse(req.contextText);if(context.stage==='clarify')return {structuredSuccess:true,status:'success',structuredOutput:result({clarification,followUp}),durationMs:1,exitCode:0};expect(context.discoveryContext.clarification).toEqual(clarification);expect(context.discoveryContext.deferredWork).toEqual(followUp);return base.complete(req);}};
    const run=await start();const done=await settled(run.id);const s=await runtime.service.get(path);
    expect(done.status).toBe('reviewable');expect(done.deferredWork).toEqual(followUp);expect(done.tasks).toHaveLength(1);expect(runtime.productReadiness(s,await runtime.list(path)).ready).toBe(true);
    expect((await settled((await start('product')).id)).status).toBe('reviewable');expect(calls.filter(req=>req.prompt.includes('本任务目标：设计阶段验证'))).toHaveLength(0);
  });
  it('repairs an incomplete clarification instead of declaring an unusable completion',async()=>{
    (runtime as any).provider={complete:async()=>({structuredSuccess:true,status:'success',structuredOutput:result({clarification:{...clarification,constraints:''}}),durationMs:1,exitCode:0})};
    const done=await settled((await start()).id);
    expect(done.status).toBe('paused');expect(done.error).toContain('连续三次无进展');expect(done.error).toContain('澄清尚未完整');expect(done.tasks.map(t=>t.kind)).toEqual(['clarification','revision','revision']);
    expect(runtime.productReadiness(await runtime.service.get(path),await runtime.list(path)).ready).toBe(false);
  });
  it('does not present old clarification constraints after a structured choice changes decisions',async()=>{
    (runtime as any).provider={complete:async()=>({structuredSuccess:true,status:'success',structuredOutput:result({clarification}),durationMs:1,exitCode:0})};
    const ready=await settled((await start()).id);let s=await runtime.service.get(path);
    s=await runtime.service.installQuestions(path,planningBasis(s),[question() as any],'later-storage-choice');
    s=await runtime.service.answer(path,[{questionId:s.questions.items.at(-1)!.id,kind:'selection',optionKeys:['remote']}],s.metadata.stateRevision,'remote-after-clarification');
    const active={path,run:{...ready,stage:'technical',basis:planningBasis(s),tasks:[]},results:new Map()};
    const context=await (runtime as any).context(active);
    expect(JSON.parse(context.text).discoveryContext).toBeUndefined();expect(JSON.parse(context.text).approvedDecisions[0].statement).toContain('远程');
  });
  it('reexecutes the same follow-up when a user answer changes its basis',async()=>{
    const goal='查证用户所选存储平台';let research=0;const bases:string[]=[];
    (runtime as any).provider={complete:async(req:any)=>{const context=JSON.parse(req.contextText);let output;
      if(req.prompt.includes(`本任务目标：${goal}`)){research++;bases.push(context.basis.hash);output=result();}
      else if(req.prompt.includes('本任务目标：整合新增研究与验证'))output=context.answers.length?result({clarification}):result({questions:[question()]});
      else output=result({clarification:null,followUp:[{kind:'research',goal}]});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    const run=await start();const waiting=await settled(run.id);expect(waiting.status).toBe('paused');expect(research).toBe(1);
    let s=await runtime.service.get(path);s=await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[0]!.id,kind:'selection',optionKeys:['remote']}],s.metadata.stateRevision,'choose-remote');await runtime.resume(path,run.id);
    const done=await settled(run.id);expect(done.status).toBe('reviewable');expect(research).toBe(2);expect(new Set(bases).size).toBe(2);
    expect(done.tasks.filter(t=>t.kind==='research').map(t=>t.attempts)).toEqual([1,1]);
  });
  it('freezes model and official-source preferences through answers and server restart',async()=>{
    const original=runtime.getConfig();const changed={...original,designModel:'gemini-3.8-flash-high',reviewModel:'gemini-3.8-flash-high',officialHosts:['after.example']};
    const run=await start();const waiting=await settled(run.id);expect(waiting.effectiveConfig).toEqual(original);
    runtime.configure(changed);let s=await runtime.service.get(path);s=await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[0]!.id,kind:'delegate'}],s.metadata.stateRevision,'delegate-for-restart');
    const provider=new FixturePlanningProvider(1);const restarted=new PlanningRuntime(engine,provider as any,changed);
    try{await restarted.resume(path,run.id);await vi.waitFor(()=>expect((restarted as any).active.size).toBe(0));const done=await restarted.get(path,run.id);expect(done.status).toBe('reviewable');expect(done.effectiveConfig).toEqual(original);
      expect(provider.calls.every((req:any)=>req.model===original.designModel)).toBe(true);
      for(const req of provider.calls){const tools=JSON.parse(await readFile(join(req.cwd,'.agents','planning-tools.json'),'utf8'));expect(tools.officialHosts).toEqual(original.officialHosts);}
    }finally{await restarted.shutdown();}
  });
  it('retries transient service failures twice and records every invocation',async()=>{
    const base=new FixturePlanningProvider(1);let calls=0;
    (runtime as any).provider={complete:async(req:any)=>{calls++;if(calls<=2)return {structuredSuccess:false,status:'failed',stderr:'503 temporarily unavailable',durationMs:1,exitCode:1};return base.complete(req);}};
    const run=await start();const done=await settled(run.id);expect(done.status).toBe('paused');expect(done.tasks[0]!.attempts).toBe(3);expect(calls).toBe(3);expect((await runtime.events(path,run.id)).filter(e=>e.type==='retry')).toHaveLength(2);
  });
  it.each([
    'RESOURCE_EXHAUSTED (code 429): Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 4h6m36s.',
    'error: Individual quota reached. Please upgrade your subscription to increase your limits.',
  ])('preserves quota failures without treating them as transient retries: %s',async error=>{
    const complete=vi.fn(async()=>({structuredSuccess:false,status:'failed',stderr:error,durationMs:1,exitCode:1}));
    (runtime as any).provider={complete};
    const before=await runtime.service.get(path),run=await start(),done=await settled(run.id);
    expect(done.status).toBe('paused');expect(done.tasks[0]!.attempts).toBe(1);expect(complete).toHaveBeenCalledTimes(1);
    expect(done.error).toContain(error);expect((await runtime.events(path,run.id)).filter(event=>event.type==='retry')).toHaveLength(0);
    expect((await runtime.service.get(path)).planning.blueprint).toEqual(before.planning.blueprint);
    expect((runtime as any).runningCalls).toBe(0);
  });
  it('keeps two automatic retries for a short unclassified 429 rate limit',async()=>{
    const complete=vi.fn(async()=>({structuredSuccess:false,status:'failed',stderr:'429 Too Many Requests: rate limit exceeded',durationMs:1,exitCode:1}));
    (runtime as any).provider={complete};const run=await start(),done=await settled(run.id);
    expect(done.status).toBe('paused');expect(complete).toHaveBeenCalledTimes(3);
    expect((await runtime.events(path,run.id)).filter(event=>event.type==='retry')).toHaveLength(2);
  });
  it('retries a transport EOF during account eligibility without treating it as quota',async()=>{
    const base=new FixturePlanningProvider(1);let calls=0;
    (runtime as any).provider={complete:async(request:any)=>{calls++;return calls===1?{structuredSuccess:false,status:'failed',stderr:'Eligibility check failed: failed to get profile picture: unexpected EOF',durationMs:1,exitCode:1}:base.complete(request);}};
    const run=await start(),done=await settled(run.id);expect(done.status).toBe('paused');expect(done.pendingQuestions).toHaveLength(1);expect(calls).toBe(2);
    expect((await runtime.events(path,run.id)).filter(event=>event.type==='retry')).toHaveLength(1);
  });
  it('pauses after three unchanged drafts even if question IDs and timestamps change',async()=>{
    let count=0;(runtime as any).provider={complete:async()=>{const q=question();q.id=`fresh-${++count}`;q.createdAt=new Date().toISOString();q.recommendedOptionKey='missing';return {structuredSuccess:true,status:'success',structuredOutput:result({questions:[q]}),durationMs:1,exitCode:0};}};
    const run=await start();const done=await settled(run.id);expect(done.status).toBe('paused');expect(done.error).toContain('连续三次无进展');expect(count).toBe(3);expect((await runtime.service.get(path)).questions.items).toHaveLength(0);
  });
  it('runs independent review and repairs a blocking finding before offering a package',async()=>{
    const base=new FixturePlanningProvider(1);let reviews=0;
    (runtime as any).provider={complete:async(req:any)=>{if(req.prompt.includes('你是独立评审者')){expect(Object.keys(JSON.parse(req.contextText).workerResults)).toEqual(['draft']);return {structuredSuccess:true,status:'success',structuredOutput:result({blockers:++reviews===1?['需补充保存失败后的重试交互']:[]}),durationMs:1,exitCode:0};}if(JSON.parse(req.contextText).stage==='clarify')return {structuredSuccess:true,status:'success',structuredOutput:result({clarification}),durationMs:1,exitCode:0};return base.complete(req);}};
    await settled((await start()).id);const done=await settled((await start('product')).id);expect(done.status).toBe('reviewable');expect(reviews).toBe(2);expect(done.tasks.some(t=>t.kind==='revision')).toBe(true);expect((await runtime.service.get(path)).planning!.blueprint.blocks).toHaveLength(0);
  });
  it('lets independent review resolve stale worker observations while retaining their exact raw output and receipt',async()=>{
    const stale='旧观察：笔记流程仍缺少保存失败后的重试入口',candidate=result({groups:[group('product')],blockers:[stale]});
    const sourceFiles:string[]=[],sourceBytes:Buffer[]=[];let runId='',reviews=0;
    (runtime as any).provider={complete:async(request:any)=>{
      const context=JSON.parse(request.contextText);let output;
      if(context.stage==='clarify')output=result({clarification});
      else if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者')){
        reviews++;expect(context.workerResults.draft.blockers).toEqual([stale]);
        expect(context.workerResults.draft.groups.flatMap((item:any)=>item.blocks).find((block:any)=>block.id==='notes-flow').content).toContain('保存失败保留输入并提供重试');
        const active=await runtime.get(path,runId);
        sourceFiles.push(...active.tasks.filter(task=>['design','integration'].includes(task.kind)&&task.status==='completed').flatMap(task=>['result.json','result-receipt.json'].map(name=>join(path,'runtime/planning',runId,'tasks',task.id,name))));
        sourceBytes.push(...await Promise.all(sourceFiles.map(file=>readFile(file))));output=result();
      }else output=structuredClone(candidate);
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    await settled((await start()).id);const started=await start('product');runId=started.id;const done=await settled(started.id);
    expect(done.status).toBe('reviewable');expect(reviews).toBe(1);expect(done.tasks.filter(task=>task.kind==='revision')).toEqual([]);
    expect(await Promise.all(sourceFiles.map(file=>readFile(file)))).toEqual(sourceBytes);
    for(const task of done.tasks.filter(task=>['design','integration'].includes(task.kind))){
      const raw=JSON.parse(await readFile(join(path,'runtime/planning',done.id,'tasks',task.id,'result.json'),'utf8'));
      const receipt=JSON.parse(await readFile(join(path,'runtime/planning',done.id,'tasks',task.id,'result-receipt.json'),'utf8'));
      expect(raw.blockers).toEqual([stale]);expect(receipt.hash).toBe(hashValue(raw));
    }
    expect((await runtime.service.get(path)).planning!.blueprint.blocks).toEqual([]);
  });
  it('repairs a genuine current review finding without copying adjudicated old observations into current issues',async()=>{
    const stale='旧观察：已有流程没有失败重试',current='必须明确保存失败时重试按钮持续可见';
    const original=group('product'),repaired=structuredClone(original);repaired.blocks.find((block:any)=>block.id==='notes-flow')!.content+='；保存失败时重试按钮持续可见。';
    let reviews=0,repairs=0;
    (runtime as any).provider={complete:async(request:any)=>{
      const context=JSON.parse(request.contextText);let output;
      if(context.stage==='clarify')output=result({clarification});
      else if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者')){reviews++;expect(context.workerResults.draft.blockers).toEqual([stale]);output=result({blockers:reviews===1?[current,current]:[]});}
      else if(request.prompt.includes('本任务目标：修订最新草案')){repairs++;expect(context.currentIssues).toEqual([current]);expect(request.prompt).not.toContain(stale);output=result({groups:[repaired],blockers:[stale]});}
      else output=result({groups:[original],blockers:[stale]});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    await settled((await start()).id);const done=await settled((await start('product')).id);
    expect(done.status).toBe('reviewable');expect(reviews).toBe(2);expect(repairs).toBe(1);
    const repair=done.tasks.find(task=>task.kind==='revision')!;expect(repair.repairIssues).toEqual([current]);
    const snapshot=await runtime.service.get(path);expect(snapshot.planning!.changeSets.find(change=>change.runId===done.id)!.groups).toEqual([repaired]);
    const integration=done.tasks.find(task=>task.kind==='integration')!;
    const raw=JSON.parse(await readFile(join(path,'runtime/planning',done.id,'tasks',integration.id,'result.json'),'utf8'));
    expect(raw).toEqual(result({groups:[original],blockers:[stale]}));
  });
  it.each([
    {kind:'official-source',source:'https://developer.example/invented',issue:'缺少 research_read 获取记录'},
    {kind:'material',source:'material:invented',issue:'没有有效注册来源'},
    {kind:'user',source:'input:invented',issue:'必须指向实际原文'},
  ])('does not let an empty review waive invalid $kind provenance',async({kind,source,issue})=>{
    let reviews=0;const evidence={id:'invalid-proof',kind,source,content:'未经来源支持的结论',obtainedAt:'2026-10-04T00:00:00Z',applicability:'本候选'};
    (runtime as any).provider={complete:async(request:any)=>{
      const context=JSON.parse(request.contextText);let output;
      if(context.stage==='clarify')output=result({clarification});
      else if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者')){reviews++;output=result();}
      else {if(request.prompt.includes('本任务目标：修订最新草案'))expect(context.currentIssues.join('；')).toContain(issue);output=result({groups:[group('product')],evidence:[evidence]});}
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    await settled((await start()).id);const done=await settled((await start('product')).id);
    expect(done.status).toBe('paused');expect(done.error).toContain(issue);expect(done.error).toContain('连续三次无进展');expect(reviews).toBe(0);
    expect((await runtime.service.get(path)).planning!.changeSets.filter(change=>change.runId===done.id)).toEqual([]);
  });
  it('repairs a four-block ordinary revision before review or proposal and preserves its exact receipt',async()=>{
    const baseline=await seedFeedbackBlueprint(),complete=structuredClone(baseline);
    complete[0]!.blocks.find((block:any)=>block.id==='notes-flow')!.content='同Run已修好：保存失败保持弹窗和完整草稿。';
    const partial={...complete[2]!,blocks:complete[2]!.blocks.map((block:any)=>({...block,content:`局部修订保留：${block.content}`}))};
    const repaired=[complete[0]!,complete[1]!,partial],reviewed:number[]=[],contexts:any[]=[];let revisions=0,runId='';let savedPartial:Buffer|undefined,savedReceipt:Buffer|undefined,partialTaskId='';
    (runtime as any).provider={complete:async(request:any)=>{
      const context=JSON.parse(request.contextText);let output;
      if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者')){reviewed.push(context.workerResults.draft.groups.flatMap((item:any)=>item.blocks).length);output=result({blockers:reviewed.length===1?['交付验收需进一步明确']:[]});}
      else if(request.prompt.includes('本任务目标：修订最新草案')){
        contexts.push(context);revisions++;
        if(revisions===1)output=result({groups:[partial]});
        else{
          const active=await runtime.get(path,runId),first=active.tasks.find(task=>task.kind==='revision'&&task.status==='completed')!;partialTaskId=first.id;
          savedPartial=await readFile(join(path,'runtime/planning',runId,'tasks',first.id,'result.json'));savedReceipt=await readFile(join(path,'runtime/planning',runId,'tasks',first.id,'result-receipt.json'));
          expect((await runtime.service.get(path)).planning!.changeSets.filter(change=>change.runId===runId)).toEqual([]);
          output=result({groups:repaired});
        }
      }else output=result({groups:complete});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    const started=await start('feedback');runId=started.id;const done=await settled(started.id);expect(done.status).toBe('reviewable');expect(revisions).toBe(2);
    expect(reviewed).toEqual([18,18]);expect(contexts[1].currentDraft.groups).toEqual([partial]);
    expect(contexts[1].unfinishedScopes.flatMap((scope:any)=>scope.previousCandidateBlocks??[]).find((block:any)=>block.id==='notes-flow')?.content).toContain('同Run已修好');
    const first=done.tasks.find(task=>task.kind==='revision')!;expect(first.requiredBlockIds).toHaveLength(18);expect(first.assemblyBaseTaskId).toBe(done.tasks.find(task=>task.kind==='integration')?.id);
    expect(await readFile(join(path,'runtime/planning',runId,'tasks',partialTaskId,'result.json'))).toEqual(savedPartial);expect(await readFile(join(path,'runtime/planning',runId,'tasks',partialTaskId,'result-receipt.json'))).toEqual(savedReceipt);
    expect(JSON.parse(savedPartial!.toString())).toEqual(result({groups:[partial]}));expect(JSON.parse(savedReceipt!.toString()).hash).toBe(hashValue(result({groups:[partial]})));
    const snapshot=await runtime.service.get(path),proposal=snapshot.planning!.changeSets.find(change=>change.runId===done.id)!;
    expect(proposal.groups).toEqual(repaired);expect(snapshot.planning!.blueprint.blocks.find(block=>block.id==='notes-flow')?.content).toBe(baseline[0]!.blocks.find((block:any)=>block.id==='notes-flow')!.content);
  });
  it('keeps the latest delivery edits across consecutive four-block and eight-block ordinary revisions without rewriting source receipts',async()=>{
    const baseline=await seedFeedbackBlueprint(),complete=structuredClone(baseline);
    const delivery={...complete[2]!,blocks:complete[2]!.blocks.map((block:any)=>({...block,content:`局部A最新交付：${block.content}`}))};
    const product={...complete[0]!,blocks:complete[0]!.blocks.map((block:any)=>({...block,content:`局部B最新产品：${block.content}`}))};
    const repaired=[product,complete[1]!,delivery],reviewed:number[]=[],contexts:any[]=[];let revisions=0,runId='';let sourceFiles:string[]=[],sourceBytes:Buffer[]=[];
    (runtime as any).provider={complete:async(request:any)=>{
      const context=JSON.parse(request.contextText);let output;
      if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者')){reviewed.push(context.workerResults.draft.groups.flatMap((item:any)=>item.blocks).length);output=result({blockers:reviewed.length===1?['需完善交付与产品细节']:[]});}
      else if(request.prompt.includes('本任务目标：修订最新草案')){
        contexts.push(context);revisions++;
        if(revisions===1)output=result({groups:[delivery]});
        else if(revisions===2)output=result({groups:[product]});
        else{
          const active=await runtime.get(path,runId);
          sourceFiles=active.tasks.filter(task=>task.kind==='integration'||task.kind==='revision'&&task.status==='completed').flatMap(task=>['result.json','result-receipt.json'].map(name=>join(path,'runtime/planning',runId,'tasks',task.id,name)));
          sourceBytes=await Promise.all(sourceFiles.map(file=>readFile(file)));
          expect((await runtime.service.get(path)).planning!.changeSets.filter(change=>change.runId===runId)).toEqual([]);
          output=result({groups:repaired});
        }
      }else output=result({groups:complete});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    const started=await start('feedback');runId=started.id;const done=await settled(started.id);expect(done.status).toBe('reviewable');expect(revisions).toBe(3);
    expect(reviewed).toEqual([18,18]);expect(contexts[2].currentDraft.groups).toEqual([product]);
    const [first,second,third]=done.tasks.filter(task=>task.kind==='revision'),anchor=done.tasks.find(task=>task.kind==='integration')!;
    expect(second!.assemblyBaseTaskId).toBe(anchor.id);expect(third!.assemblyBaseTaskId).toBe(anchor.id);expect(third!.requiredBlockIds).toHaveLength(18);
    const scope=contexts[2].unfinishedScopes.find((item:any)=>item.taskId===third!.id);
    expect(scope.previousCandidateBlocks.filter((block:any)=>delivery.blocks.some((item:any)=>item.id===block.id))).toEqual(delivery.blocks);
    for(const block of delivery.blocks)expect(scope.previousCandidateSources).toContainEqual({blockId:block.id,taskId:first!.id,action:'replace'});
    for(const block of complete[1]!.blocks)expect(scope.previousCandidateSources).toContainEqual({blockId:block.id,taskId:anchor.id,action:'replace'});
    expect(await Promise.all(sourceFiles.map(file=>readFile(file)))).toEqual(sourceBytes);
    for(const [index,task] of [first,second].entries()){
      const raw=JSON.parse(await readFile(join(path,'runtime/planning',runId,'tasks',task!.id,'result.json'),'utf8')),receipt=JSON.parse(await readFile(join(path,'runtime/planning',runId,'tasks',task!.id,'result-receipt.json'),'utf8'));
      expect(raw).toEqual(result({groups:[index===0?delivery:product]}));expect(receipt.hash).toBe(hashValue(raw));
    }
    const snapshot=await runtime.service.get(path);expect(snapshot.planning!.changeSets.find(change=>change.runId===done.id)?.groups).toEqual(repaired);
    expect(snapshot.planning!.blueprint.blocks).toEqual(baseline.flatMap(item=>item.blocks).map(block=>expect.objectContaining(block)));
  });
  it.each(['registered','legacy'] as const)('restores the complete candidate scope after an ordinary partial question and restart (%s metadata)',async(metadata)=>{
    const baseline=await seedFeedbackBlueprint(),complete=structuredClone(baseline);complete[0]!.blocks.find((block:any)=>block.id==='notes-flow')!.content='先前候选已修好：失败保留完整草稿及重试入口。';
    const partial={...complete[2]!,blocks:complete[2]!.blocks.map((block:any)=>({...block,content:`回答前已修订：${block.content}`}))},repaired=[complete[0]!,complete[1]!,partial];
    let reviews=0,revisions=0;const resumedContexts:any[]=[];
    const provider={complete:async(request:any)=>{
      const context=JSON.parse(request.contextText);let output;
      if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者'))output=result({blockers:++reviews===1?['需要修订并澄清恢复取舍']:[]});
      else if(request.prompt.includes('本任务目标：修订最新草案')||request.prompt.includes('本任务目标：依据本轮')){
        if(++revisions===1)output=result({groups:[partial],questions:[question('ordinary-revision:recovery')]});
        else{resumedContexts.push(context);output=result({groups:repaired});}
      }else output=result({groups:complete});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};(runtime as any).provider=provider;
    const started=await start('feedback'),waiting=await settled(started.id);expect(waiting.status).toBe('paused');expect(waiting.pendingQuestions).toHaveLength(1);await runtime.shutdown();
    const first=waiting.tasks.find(task=>task.kind==='revision')!,anchor=waiting.tasks.find(task=>task.kind==='integration')!;
    const artifactFiles=[first,anchor].flatMap(task=>['result.json','result-receipt.json'].map(name=>join(path,'runtime/planning',waiting.id,'tasks',task.id,name))),before=await Promise.all(artifactFiles.map(file=>readFile(file)));
    if(metadata==='legacy'){delete first.requiredBlockIds;delete first.assemblyBaseTaskId;await writeFile(join(path,'runtime/planning',waiting.id,'run.json'),JSON.stringify(waiting));}
    const snapshot=await runtime.service.get(path);await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[0]!.id,kind:'delegate'}],snapshot.metadata.stateRevision,'answer-ordinary-revision');
    runtime=new PlanningRuntime(new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(root)),provider as any,{},[1,2]);
    await runtime.resume(path,waiting.id);const done=await settled(waiting.id);expect(done.status).toBe('reviewable');expect(revisions).toBe(2);
    const context=resumedContexts[0];expect(context.currentDraft.groups).toEqual([partial]);expect(context.unfinishedScopes.flatMap((scope:any)=>scope.previousCandidateBlocks??[]).find((block:any)=>block.id==='notes-flow')?.content).toContain('先前候选已修好');
    const continuation=done.tasks.filter(task=>task.kind==='revision').at(-1)!;expect(continuation.assemblyBaseTaskId).toBe(anchor.id);expect(continuation.requiredBlockIds).toHaveLength(18);
    expect(await Promise.all(artifactFiles.map(file=>readFile(file)))).toEqual(before);
    expect((await runtime.service.get(path)).planning!.changeSets.find(change=>change.runId===done.id)?.groups).toEqual(repaired);
  });
  it('allows an explicit ordinary revision removal and leaves a new feedback run scoped to its own candidate',async()=>{
    const baseline=await seedFeedbackBlueprint(),complete=[structuredClone(baseline[0]!)];let reviews=0;
    const removed='non-goals';const revised={...complete[0]!,blocks:complete[0]!.blocks.filter((block:any)=>block.id!==removed),removeBlockIds:[removed]};
    // Preserve mandatory coverage by replacing the removed stable ID with a new candidate.
    revised.blocks.push({...complete[0]!.blocks.find((block:any)=>block.id===removed)!,id:'updated-non-goals'});
    (runtime as any).provider={complete:async(request:any)=>{
      let output;
      if(request.prompt.includes('你负责官方资料研究'))output=result();
      else if(request.prompt.includes('你是独立评审者'))output=result({blockers:++reviews===1?['范围说明需要替换旧块']:[]});
      else if(request.prompt.includes('本任务目标：修订最新草案'))output=result({groups:[revised]});
      else output=result({groups:complete});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    const done=await settled((await start('feedback')).id);expect(done.status).toBe('reviewable');expect(reviews).toBe(2);
    const revision=done.tasks.find(task=>task.kind==='revision')!;expect(revision.requiredBlockIds).toEqual(complete[0]!.blocks.map((block:any)=>block.id));expect(revision.requiredBlockIds).not.toContain('notes-api');
    const snapshot=await runtime.service.get(path);expect(snapshot.planning!.changeSets.find(change=>change.runId===done.id)?.groups).toEqual([revised]);expect(snapshot.planning!.blueprint.blocks.some(block=>block.id===removed)).toBe(true);
  });
  it('keeps the latest corrected draft explicit when a new decision resumes revision',async()=>{
    let reviews=0,revisions=0;const blocker='编辑保存失败时必须保持弹窗和草稿';
    const corrected=group('product');corrected.blocks.find((b:any)=>b.id==='notes-flow')!.content='保存失败时弹窗保持打开，草稿完整保留，用户可以重试。';
    (runtime as any).provider={complete:async(req:any)=>{
      const context=JSON.parse(req.contextText);let output;
      if(context.stage==='clarify')output=result({clarification});
      else if(req.prompt.includes('你是独立评审者')){reviews++;expect(context.currentDraft).toBeUndefined();expect(Object.keys(context.workerResults)).toEqual(['draft']);output=result({blockers:reviews===1?[blocker]:[]});}
      else if(req.prompt.includes('你负责官方资料研究'))output=result();
      else if(req.prompt.includes('以 currentDraft 为最新修订基准')){
        if(context.historicalReviewFindings.length){
          revisions++;
          if(revisions===1)output=result({groups:[corrected],questions:[question('backup','q-backup')]});
          else{expect(context.currentDraft.groups[0].blocks.find((b:any)=>b.id==='notes-flow').content).toContain('草稿完整保留');expect(context.historicalReviewFindings).toContain(blocker);output=result({groups:[corrected]});}
        }else output=result({groups:[group('product')]});
      }else output=result({groups:[group('product')]});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    await settled((await start()).id);const product=await start('product'),waiting=await settled(product.id);expect(waiting.status).toBe('paused');
    let s=await runtime.service.get(path);s=await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[0]!.id,kind:'delegate'}],s.metadata.stateRevision,'delegate-new-backup');
    await runtime.resume(path,product.id);const done=await settled(product.id);expect(done.status).toBe('reviewable');expect(revisions).toBe(2);
    const changes=(await runtime.service.get(path)).planning!.changeSets.find(c=>c.id===done.changeSetId)!;
    expect(changes.groups[0]!.blocks.find(b=>b.id==='notes-flow')!.content).toContain('草稿完整保留');
  });
  it('resumes only the failed parallel task and preserves the completed design',async()=>{
    let s=await runtime.service.get(path);const proposal={id:'product-base',runId:'run-base',stage:'product',basis:planningBasis(s),summary:'测试',groups:[group('product')],evidence:[],status:'pending',createdAt:new Date().toISOString(),approvals:[]};s=await runtime.service.propose(path,proposal as any);await runtime.service.approve(path,proposal.id,{expectedRevision:s.metadata.stateRevision,operationId:'approve-base',groupIds:['product-group']});
    const base=new FixturePlanningProvider(5);let fail=true;let designs=0;let research=0;
    (runtime as any).provider={complete:async(req:any)=>{if(req.prompt.includes('你负责官方资料研究')){research++;if(fail)return {structuredSuccess:false,status:'failed',stderr:'Permission denied',durationMs:1,exitCode:1};}if(req.prompt.includes('本任务目标：生成本阶段完整设计'))designs++;return base.complete(req);}};
    const run=await start('technical');expect((await settled(run.id)).status).toBe('paused');fail=false;await runtime.resume(path,run.id);expect((await settled(run.id)).status).toBe('reviewable');expect(designs).toBe(1);expect(research).toBe(2);
  });
  it('repairs immutable evidence conflicts before publishing a proposal',async()=>{
    const proof={id:'shared-proof',kind:'user' as const,source:'project:idea',content:'个人笔记工具',obtainedAt:'2026-10-04T00:00:00Z',applicability:'原始目标'};
    let s=await runtime.service.get(path);const baseline=group('product');baseline.blocks[0].evidenceIds=[proof.id];
    const proposal={id:'product-proof-base',runId:'run-base',stage:'product' as const,basis:planningBasis(s),summary:'测试',groups:[baseline],evidence:[proof],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    s=await runtime.service.propose(path,proposal);await runtime.service.approve(path,proposal.id,{expectedRevision:s.metadata.stateRevision,operationId:'approve-proof-base',groupIds:['product-group']});
    let repairs=0,reviews=0;
    (runtime as any).provider={complete:async(req:any)=>{
      expect(JSON.parse(req.contextText).approvedEvidence).toEqual([proof]);
      let output;
      if(req.prompt.includes('你是独立评审者')){reviews++;output=result();}
      else if(req.prompt.includes('你负责官方资料研究'))output=result();
      else if(req.prompt.includes('本任务目标：修订最新草案')){repairs++;expect(JSON.parse(req.contextText).currentIssues.join('；')).toContain('shared-proof');expect(req.prompt).not.toContain('证据 ID 已属于不同内容');output=result({groups:[group('technical')],evidence:[proof]});}
      else output=result({groups:[group('technical')],evidence:[{...proof,applicability:'模型擅自改写的用途'}]});
      return {structuredSuccess:true,status:'success',structuredOutput:output,durationMs:1,exitCode:0};
    }};
    const run=await start('technical');const done=await settled(run.id);expect(done.status).toBe('reviewable');expect(repairs).toBe(1);expect(reviews).toBe(1);
    s=await runtime.service.get(path);expect(s.planning!.evidence.find(e=>e.id===proof.id)).toEqual(proof);
    const draft=s.planning!.changeSets.find(c=>c.id===done.changeSetId)!;expect(draft.evidence).toEqual([proof]);expect(s.planning!.blueprint.stages.technical).toBe('not-designed');
  });
  it('rejects changed persisted intermediate output before launching another call',async()=>{
    const run=await start();await settled(run.id);const done=await runtime.get(path,run.id);const file=join(path,'runtime','planning',run.id,done.tasks[0]!.outputRef!);const output=JSON.parse(await readFile(file,'utf8'));output.summary='外部改动';await writeFile(file,JSON.stringify(output));await expect(runtime.resume(path,run.id)).rejects.toMatchObject({code:'RESULT_MODIFIED'});expect((runtime as any).active.size).toBe(0);
  });
  it.each(['selection','custom','delegate','defer'] as const)('continues only this round’s %s answer and preserves completed calls',async(kind)=>{
    const run=await start();expect((await settled(run.id)).status).toBe('paused');let s=await runtime.service.get(path);
    s=await runtime.service.answer(path,[{questionId:s.questions.items[0]!.id,kind,...(kind==='selection'?{optionKeys:['local']}:kind==='custom'?{text:'仅用于我自己，离线本地保存'}:{})}],s.metadata.stateRevision,`answer-${kind}`);
    const tasks=(await runtime.get(path,run.id)).tasks.filter(t=>t.status==='completed');await runtime.resume(path,run.id);const continued=await settled(run.id);
    expect(continued.status).toBe('reviewable');expect(continued.tasks[0]!.attempts).toBe(tasks[0]!.attempts);expect(continued.clarification?.target).toBeTruthy();
    expect(s.decisions.items.filter(d=>d.status==='confirmed')).toHaveLength(kind==='selection'?1:0);
  });
  it('rejects an unrelated change when attempting answer continuation',async()=>{const run=await start();await settled(run.id);let s=await runtime.service.get(path);s=await runtime.service.answer(path,[{questionId:s.questions.items[0]!.id,kind:'delegate'}],s.metadata.stateRevision,'answer');await runtime.service.recordInput(path,'现在改成多用户协作',s.metadata.stateRevision,'external');await expect(runtime.resume(path,run.id)).rejects.toMatchObject({code:'STALE_BASIS'});});
  it.each(['selection','custom','delegate','defer'] as const)('keeps partial %s answers resumable after an early continue attempt',async(kind)=>{
    const calls:any[]=[];
    (runtime as any).provider={complete:async(req:any)=>{
      calls.push(req);const context=JSON.parse(req.contextText);
      return {structuredSuccess:true,status:'success',structuredOutput:context.answers.length===2?result({clarification}):result({questions:[question('storage','q-storage'),question('capture','q-capture')]}),durationMs:1,exitCode:0};
    }};
    const run=await start();const waiting=await settled(run.id);let s=await runtime.service.get(path);
    s=await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[0]!.id,kind,...(kind==='selection'?{optionKeys:['local']}:kind==='custom'?{text:'本地即可'}:{})}],s.metadata.stateRevision,`partial-${kind}`);
    await expect(runtime.resume(path,run.id)).rejects.toMatchObject({code:'INVALID_INTENT',message:expect.stringContaining('未回答')});
    expect((await runtime.get(path,run.id)).status).toBe('paused');expect(calls).toHaveLength(1);
    s=await runtime.service.answer(path,[{questionId:waiting.pendingQuestions[1]!.id,kind:'delegate'}],s.metadata.stateRevision,`remaining-${kind}`);
    await runtime.resume(path,run.id);const done=await settled(run.id);
    expect(done.status).toBe('reviewable');expect(calls).toHaveLength(2);expect(done.tasks[0]!.attempts).toBe(1);
  });
  it('cannot cancel a different project and waits for the old executor before resume',async()=>{(runtime as any).provider=new FixturePlanningProvider(150);const run=await start();await expect(runtime.cancel(join(root,'other'),run.id)).rejects.toBeDefined();expect((await runtime.get(path,run.id)).status).not.toBe('cancelled');await runtime.cancel(path,run.id);await runtime.resume(path,run.id);expect((await settled(run.id)).status).toBe('paused');expect((await runtime.get(path,run.id)).pendingQuestions).toHaveLength(1);});
  it('deduplicates start and rejects changed request for an operation ID',async()=>{const s=await runtime.service.get(path);const req={stage:'clarify' as const,expectedRevision:s.metadata.stateRevision,operationId:'same'};const [a,b]=await Promise.all([runtime.start(path,req),runtime.start(path,req)]);expect(a.id).toBe(b.id);await expect(runtime.start(path,{...req,stage:'product'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});});
  it('does not accept a ready clarification after the basis changed',async()=>{const run=await start();await settled(run.id);let s=await runtime.service.get(path);s=await runtime.service.answer(path,[{questionId:s.questions.items[0]!.id,kind:'delegate'}],s.metadata.stateRevision,'answer');await runtime.resume(path,run.id);await settled(run.id);s=await runtime.service.get(path);await runtime.service.recordInput(path,'用户改成整个团队',s.metadata.stateRevision,'new');await expect(start('product')).rejects.toMatchObject({code:'CLARIFICATION_REQUIRED'});});
  it('rejects product feedback that changes a ready clarification basis without saving it',async()=>{
    (runtime as any).provider={complete:async()=>({structuredSuccess:true,status:'success',structuredOutput:result({clarification}),durationMs:1,exitCode:0})};
    await settled((await start()).id);
    const before=await runtime.service.get(path),runs=await runtime.list(path),files=await projectFileBytes();
    expect(runtime.productReadiness(before,runs).ready).toBe(true);
    const complete=vi.fn(async()=>{throw new Error('Rejected feedback must not invoke a Provider');});
    (runtime as any).provider={complete};
    const request={stage:'product' as const,expectedRevision:before.metadata.stateRevision,operationId:'new-feedback-after-ready-clarification',feedback:'目标用户改成整个团队'};
    for(let attempt=0;attempt<2;attempt++){
      await expect.soft(runtime.start(path,request)).rejects.toMatchObject({code:'CLARIFICATION_REQUIRED'});
      expect.soft(await runtime.service.get(path)).toEqual(before);
      expect.soft(await projectFileBytes()).toEqual(files);
      expect.soft(await runtime.list(path)).toEqual(runs);
      expect.soft(complete).not.toHaveBeenCalled();
    }
  });
  it('records accepted product redesign feedback once and registers the resulting input basis',async()=>{
    let s=await runtime.service.get(path);
    const proposal={id:'feedback-redesign-source',runId:'run-base',stage:'product' as const,basis:planningBasis(s),summary:'测试',groups:[group('product')],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    s=await runtime.service.propose(path,proposal);
    s=await runtime.service.approve(path,proposal.id,{expectedRevision:s.metadata.stateRevision,operationId:'approve-feedback-redesign-source',groupIds:['product-group']});
    s=await runtime.service.installQuestions(path,planningBasis(s),[question() as any],'superseded-by-redesign-feedback');
    const before=structuredClone(s);
    expect(runtime.productReadiness(before,[]).ready).toBe(false);
    const raw='  保存失败时请显示重试按钮，并保留草稿。  ';
    const request={stage:'product' as const,expectedRevision:s.metadata.stateRevision,operationId:'accepted-redesign-feedback',feedback:raw};
    const run=await runtime.start(path,request);
    const basis=JSON.parse(await readFile(join(path,'runtime','planning',run.id,'basis.json'),'utf8'));
    expect(basis.metadata.stateRevision).toBe(before.metadata.stateRevision+1);
    expect(run.basis).toEqual(planningBasis(basis));
    expect(basis.planning.inputs.filter((input:any)=>input.raw===raw)).toHaveLength(1);
    expect(basis.questions.items[0].status).toBe('superseded');
    expect(basis.planning.blueprint).toEqual(before.planning!.blueprint);
    expect(basis.decisions).toEqual(before.decisions);
    expect((await settled(run.id)).status).toBe('reviewable');
    expect((await runtime.start(path,request)).id).toBe(run.id);
    s=await runtime.service.get(path);
    expect(s.planning!.inputs.filter(input=>input.raw===raw)).toHaveLength(1);
    expect(s.planning!.operations.filter(operation=>operation.id===`feedback:${request.operationId}`)).toHaveLength(1);
    expect(s.planning!.blueprint).toEqual(before.planning!.blueprint);
    expect(s.decisions).toEqual(before.decisions);
  });
  it('can redesign a previously approved product without making stale content formal again',async()=>{
    let s=await runtime.service.get(path);const base={id:'approved-product-source',runId:'run-base',stage:'product' as const,basis:planningBasis(s),summary:'测试',groups:[group('product')],evidence:[],status:'pending' as const,createdAt:new Date().toISOString(),approvals:[]};
    s=await runtime.service.propose(path,base);s=await runtime.service.approve(path,base.id,{expectedRevision:s.metadata.stateRevision,operationId:'approve-redesign-source',groupIds:['product-group']});
    expect(runtime.productReadiness(s,[]).ready).toBe(true);
    s=await runtime.service.installQuestions(path,planningBasis(s),[question('technical:storage','q-technical-storage') as any],'new-technical-choice');
    expect(runtime.productReadiness(s,[]).ready).toBe(false);
    s=await runtime.service.answer(path,[{questionId:s.questions.items[0]!.id,kind:'selection',optionKeys:['local']}],s.metadata.stateRevision,'technical-choice');
    expect(s.planning!.blueprint.stages.product).toBe('needs-revision');expect(runtime.productReadiness(s,[]).ready).toBe(true);
    const done=await settled((await start('product')).id);expect(done.status).toBe('reviewable');
    s=await runtime.service.get(path);expect(s.planning!.blueprint.stages.product).toBe('needs-revision');expect(s.planning!.changeSets.find(c=>c.id===done.changeSetId)?.status).toBe('pending');
  });
  it('recovers a completed result and event sequence from the interrupted journal',async()=>{const run=await start();await settled(run.id);const dir=join(path,'runtime','planning',run.id);const stored=JSON.parse(await readFile(join(dir,'run.json'),'utf8'));stored.status='running';stored.nextEventSeq=1;stored.tasks[0].status='running';delete stored.tasks[0].outputRef;await writeFile(join(dir,'run.json'),JSON.stringify(stored));const restarted=new PlanningRuntime(engine,new FixturePlanningProvider() as any);const recovered=await restarted.get(path,run.id);expect(recovered.status).toBe('paused');expect(recovered.nextEventSeq).toBeGreaterThan(1);await restarted.resume(path,run.id);await vi.waitFor(()=>expect((restarted as any).active.size).toBe(0));expect((await restarted.get(path,run.id)).tasks[0]!.attempts).toBe(1);});
  it('survives a runtime disk fault without a poisoned write tail or registration leak',async()=>{const storage=(runtime as any).storage;const original=storage.writeJson.bind(storage);let fault=true;vi.spyOn(storage,'writeJson').mockImplementation(async(...args:any[])=>{if(fault&&String(args[0]).endsWith('run.json')){fault=false;throw new Error('EIO injected');}return original(...args);});await expect(start()).rejects.toThrow('EIO');expect((runtime as any).active.size).toBe(0);const run=await start();expect((await settled(run.id)).status).toBe('paused');});
  it('semantic no-progress signature ignores fresh IDs, timestamps and output ordering',()=>{const a=result({groups:[group('product')],questions:[question()],evidence:[{id:'e1',kind:'user',source:'project:idea',content:'个人笔记',obtainedAt:'2026-10-04',applicability:'目标'}]});const b=structuredClone(a);b.groups[0].id='new-group';b.groups[0].blocks=b.groups[0].blocks.reverse().map((v:any)=>({...v,id:`new-${v.id}`,requirementIds:v.requirementIds.map((id:string)=>`new-${id}`),dependsOn:v.dependsOn.map((id:string)=>`new-${id}`)}));b.questions[0].id='new-question';b.questions[0].createdAt='2026-10-05';b.questions[0].options.reverse();b.evidence[0].id='e2';b.evidence[0].obtainedAt='2026-10-05';expect(semanticProgressSignature(a,[])).toBe(semanticProgressSignature(b,[]));b.groups[0].blocks[0].content+=' changed';expect(semanticProgressSignature(a,[])).not.toBe(semanticProgressSignature(b,[]));});
  it('rejects invented experiment success and normalizes a failed real record',async()=>{const evidenceRoot=join(root,'evidence');await mkdir(evidenceRoot);const snapshot=await runtime.service.get(path);const config={materialRoots:[],materials:[],experimentRoot:join(root,'exp'),evidenceRoot};const e={id:'e',kind:'experiment',source:'experiment:invented',content:'能力通过',obtainedAt:'2026-10-04',outcome:'passed',applicability:'运行环境'};const fabricated=result({evidence:[e]});await verifyTaskEvidence(fabricated,snapshot,config);expect(fabricated.blockers.length).toBe(1);expect(fabricated.evidence[0].outcome).toBe('unexecuted');await writeFile(join(evidenceRoot,'tool-events.ndjson'),JSON.stringify({action:'experiment_result',details:{id:'actual',status:'fail',environment:{runtime:'node',image:'node:24',network:'none'},completedAt:'2026-10-04'}})+'\n');const failed=result({evidence:[{...e,source:'experiment:actual'}]});await verifyTaskEvidence(failed,snapshot,config);expect(failed.evidence[0].outcome).toBe('failed');expect(failed.blockers.length).toBe(1);expect(failed.evidence[0].hash).toBeTruthy();});
});
