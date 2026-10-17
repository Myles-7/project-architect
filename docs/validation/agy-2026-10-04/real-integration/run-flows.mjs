import { join,resolve,dirname } from 'node:path';
import { mkdir,readFile,writeFile,mkdtemp,cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { FileStorage,ProjectStateEngine,WorkspaceGuard,blueprintCoverage } from '../../../../packages/core/dist/index.js';
import { AntigravityCliProvider } from '../../../../packages/agent/dist/provider/AntigravityCliProvider.js';
import { PlanningRuntime } from '../../../../apps/server/dist/planning/PlanningRuntime.js';
import { PlanningPackageCompiler } from '../../../../apps/server/dist/planning/PlanningPackageCompiler.js';
if (process.argv[4] || process.argv[5]) { await import('./run-flows-models.mjs'); process.exit(process.exitCode ?? 0); }
process.env.PATH=dirname(process.execPath)+';'+process.env.PATH;
const mode=process.argv[2]??'vague';
const root=resolve('docs/validation/agy-2026-10-04/real-integration',process.argv[3]??mode);
await mkdir(root,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'pa-real-integration-'));
const path=join(temp,mode==='chinese'?'项目构思':mode);
const manifest={mode,hostNode:process.version,executable:process.execPath,temp,path,startedAt:new Date().toISOString(),authorization:'All answers are simulated user input. All approvals are API automated acceptance, not actual human review.',runs:[],answers:[],approvals:[],checks:[]};
const save=()=>writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2));await save();
const engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(temp));
const runtime=new PlanningRuntime(engine,new AntigravityCliProvider());
const idea=mode==='materials'?'我想做一个给自己用的本地原型核对页面：用户上传的截图仅作布局参考；文字说明负责行为，不自动把图里的示例文字变成业务需求。只做一个输入项目名、点击确认、展示项目名和清空的单页面。目标是快速核对输入反馈，失败时保留输入。浏览器运行，桌面优先；无需服务端、登录、协作或支付。核心验收：输入任意项目名后可确认显示，空值有提示；具体布局请完整查看截图并描述真实内容。其余普通细节明确委托 AI 拟定，设计建议仍待批准。':'我想做一个帮自己整理随手灵感的小工具。';
async function settled(id){
  const started=Date.now();let last='';let lastMinute=0;
  while(runtime.active.has(id)){
    const r=await runtime.get(path,id);const state=JSON.stringify(r.tasks.map(t=>({kind:t.kind,status:t.status,attempts:t.attempts,error:t.error})));
    if(state!==last||Date.now()-lastMinute>=60000){console.log(JSON.stringify({at:new Date().toISOString(),stage:r.stage,id,status:r.status,elapsedSeconds:Math.round((Date.now()-started)/1000),tasks:JSON.parse(state)}));last=state;lastMinute=Date.now();}
    await new Promise(r=>setTimeout(r,3000));
  }
  const r=await runtime.get(path,id);console.log(JSON.stringify({settled:true,stage:r.stage,id,status:r.status,error:r.error,summary:r.summary}));await writeFile(join(root,`${r.stage}-${manifest.runs.length}-${id}.json`),JSON.stringify(r,null,2));return r;
}
async function start(stage,feedback){const s=await runtime.service.get(path);const r=await runtime.start(path,{stage,expectedRevision:s.metadata.stateRevision,operationId:`real-${mode}-${stage}-${Date.now()}`,...(feedback?{feedback}: {})});manifest.runs.push({stage,id:r.id});await save();return await settleQuestions(await settled(r.id));}
async function settleQuestions(r){
  while(r.status==='paused'&&r.pendingQuestions.length){
    if(r.pendingQuestions.length>3)throw new Error('More than three questions');
    let s=await runtime.service.get(path);const before=s.decisions.items.filter(d=>d.status==='confirmed').length;
    const answers=r.pendingQuestions.map((q,i)=>i===0?{questionId:q.id,kind:'selection',optionKeys:[q.options.find(o=>o.key===q.recommendedOptionKey)?.key??q.options[0].key]}:{questionId:q.id,kind:'delegate',text:'模拟用户输入：普通细节交给 AI 拟定，结果仍作为待批准建议。'});
    const operationId=`simulated-answer-${mode}-${Date.now()}`;
    s=await runtime.service.answer(path,answers,s.metadata.stateRevision,operationId);
    manifest.answers.push({kind:'simulated user input',runId:r.id,operationId,questions:r.pendingQuestions,answers});
    manifest.checks.push({name:'max-three-unique-choice-questions',pass:r.pendingQuestions.length<=3&&new Set(r.pendingQuestions.map(q=>q.decisionKey)).size===r.pendingQuestions.length});
    manifest.checks.push({name:'delegation-does-not-confirm',pass:s.decisions.items.filter(d=>d.status==='confirmed').length-before===answers.filter(a=>a.kind==='selection').length});await save();
    await runtime.resume(path,r.id);r=await settled(r.id);
  }
  if(r.status!=='reviewable')throw new Error(`${r.stage} stopped ${r.status}: ${r.error}`);
  return r;
}
async function approve(r){let s=await runtime.service.get(path);const c=s.planning.changeSets.find(c=>c.id===r.changeSetId);if(!c)throw new Error('Missing changeset');
  await writeFile(join(root,`${r.stage}-proposal.json`),JSON.stringify(c,null,2));
  const request={expectedRevision:s.metadata.stateRevision,operationId:`api-automated-acceptance-${mode}-${r.stage}-${Date.now()}`,groupIds:c.groups.filter(g=>g.status==='pending').map(g=>g.id)};
  manifest.checks.push({name:`${r.stage}-draft-not-formal-before-api-acceptance`,pass:c.groups.every(g=>g.blocks.every(b=>!s.planning.blueprint.blocks.some(old=>JSON.stringify(old)===JSON.stringify(b))))});
  s=await runtime.service.approve(path,c.id,request);manifest.approvals.push({kind:'API automated acceptance; not human review',changeSetId:c.id,request,stages:s.planning.blueprint.stages});await save();await writeFile(join(root,`${r.stage}-approved-snapshot.json`),JSON.stringify(s,null,2));return s;
}
try{
  await engine.createProject({name:`真实集成验证-${mode}`,idea,projectPath:path});
  if(mode==='materials'){
    const image=await readFile(resolve('docs/validation/agy-2026-10-04/materials/fixture.png'));let s=await runtime.service.get(path);
    manifest.image={sha256:createHash('sha256').update(image).digest('hex'),expected:{text:'Q7M4-8261',left:'blue rectangle',right:'orange-red circle'},expectedNotInPrompt:true};
    const ref=await engine.addInput(path,'image','fixture.png',image.toString('base64'),'base64',s.metadata.stateRevision);manifest.image.ref=ref;await save();
  }
  const clarification=await start('clarify');await writeFile(join(root,'clarification.json'),JSON.stringify(clarification,null,2));
  if(mode!=='chinese'){
    for(const stage of (mode==='materials'?['product']:['product','technical','delivery']))await approve(await start(stage));
    if(mode==='vague'){
      let s=await runtime.service.get(path);const compiler=new PlanningPackageCompiler(runtime.service);const packageManifest=await compiler.compile(path,s.metadata.stateRevision,'api-automated-package-vague');const zip=await compiler.export(path);await writeFile(join(root,'development-package.zip'),zip);await cp(join(path,packageManifest.directory),join(root,'development-package'),{recursive:true});manifest.package={manifest:packageManifest,zipBytes:zip.length,zipSha256:createHash('sha256').update(zip).digest('hex')};await save();
      s=await runtime.service.get(path);await writeFile(join(root,'pre-feedback-snapshot.json'),JSON.stringify(s,null,2));
      const feedback='模拟用户需求变更：已批准方案现在必须增加「误删可恢复」：删除灵感后进入回收区保留七天，可还原；超过七天明确提示永久删除。只修订受影响的功能、流程、数据、接口、错误恢复、开发任务和验收，保留无关块的稳定 ID。此原文不是直接批准新方案。';
      const before=s.planning.blueprint.blocks;const r=await start('feedback',feedback);const draft=await runtime.service.get(path);const c=draft.planning.changeSets.find(c=>c.id===r.changeSetId);const touched=new Set(c.groups.flatMap(g=>[...g.removeBlockIds,...g.blocks.map(b=>b.id)]));
      manifest.feedback={text:feedback,touched:[...touched],unaffected:before.filter(b=>!touched.has(b.id)).map(b=>b.id),formalUnchangedBeforeApproval:JSON.stringify(before)===JSON.stringify(draft.planning.blueprint.blocks)};await approve(r);const after=await runtime.service.get(path);manifest.feedback.unaffectedPreserved=before.filter(b=>!touched.has(b.id)).every(b=>JSON.stringify(b)===JSON.stringify(after.planning.blueprint.blocks.find(x=>x.id===b.id)));manifest.feedback.coverageIssues=blueprintCoverage(after.planning.blueprint.blocks);await save();
    }
  }
  manifest.status='completed';
}catch(error){manifest.status='blocked';manifest.error=String(error);console.error(error);process.exitCode=1;}
finally{manifest.completedAt=new Date().toISOString();await save();await cp(path,join(root,'project-records'),{recursive:true});console.log(JSON.stringify({mode,status:manifest.status,error:manifest.error,path,manifest:join(root,'manifest.json')}));}
