import { join, basename } from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import type { BlueprintBlock, PlanningPackageManifest, PlanningPackageTaskFile } from '@project-architect/contracts';
import { PlanningService, PlanningError, blueprintCoverage, planningBasis, planningInputHash, DocumentExportService, WorkspaceGuard } from '@project-architect/core';
import { projectPlanningTaskGraph } from './PlanningTaskGraph.js';

export class PlanningPackageCompiler {
  private static locks = new Map<string,Promise<void>>();
  constructor(private service:PlanningService) {}
  async compile(path:string,expectedRevision:number,operationId:string):Promise<PlanningPackageManifest>{
    while(PlanningPackageCompiler.locks.has(path))await PlanningPackageCompiler.locks.get(path);
    let release!:()=>void;PlanningPackageCompiler.locks.set(path,new Promise(r=>release=r));
    try{return await this.compileLocked(path,expectedRevision,operationId);}finally{PlanningPackageCompiler.locks.delete(path);release();}
  }
  private async verify(path:string,manifest:PlanningPackageManifest):Promise<Array<{path:string;data:Uint8Array}>> {
    const required=['START_HERE.md','PROJECT.md','PRODUCT.md','USER_FLOWS.md','UX_UI_SPEC.md','TECHNICAL_GUIDE.md','DEVELOPMENT_PLAN.md','ACCEPTANCE.md','AGENTS.md','tasks.json'];
    if(!Array.isArray(manifest.files)||new Set(manifest.files.map(f=>f.name)).size!==manifest.files.length||required.some(name=>!manifest.files.some(f=>f.name===name)))throw new PlanningError('PACKAGE_INCOMPLETE','开发包缺少必需文件或有重复项');
    if(!/^artifacts\/packages\/[a-z0-9-]+$/.test(manifest.directory))throw new PlanningError('PACKAGE_INCOMPLETE','开发包目录无效');
    const files:Array<{path:string;data:Uint8Array}>=[];
    for(const file of manifest.files){
      if(basename(file.name)!==file.name||! /^[a-f0-9]{64}$/.test(file.sha256))throw new PlanningError('PACKAGE_INCOMPLETE','产物路径或哈希无效');
      const filePath=new WorkspaceGuard(path).assertContained(join(path,'artifacts','packages'),join(path,manifest.directory,file.name));
      let data:Buffer;try{data=await readFile(filePath);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new PlanningError('PACKAGE_INCOMPLETE',`产物缺失：${file.name}`);throw error;}
      if(createHash('sha256').update(data).digest('hex')!==file.sha256)throw new PlanningError('PACKAGE_MODIFIED',`产物已被外部修改：${file.name}；请作为反馈处理`);
      files.push({path:file.name,data});
    }
    return files;
  }
  private async compileLocked(path:string,expectedRevision:number,operationId:string):Promise<PlanningPackageManifest>{
    if(typeof operationId!=='string'||!operationId.trim()||!Number.isInteger(expectedRevision))throw new PlanningError('INVALID_INTENT','需要操作 ID 和版本');
    const s=await this.service.get(path);
    if(s.planning!.package?.operationId===operationId){const prior=s.planning!.package;if(prior.sourceRevision!==expectedRevision||prior.basisHash!==planningBasis(s).hash)throw new PlanningError('IDEMPOTENCY_CONFLICT','操作 ID 已用于另一版本的导出');await this.verify(path,prior);return prior;}
    if(s.metadata.stateRevision!==expectedRevision)throw new PlanningError('STATE_REVISION_CONFLICT','版本已变化');
    if(!Object.values(s.planning!.blueprint.stages).every(status=>status==='approved'))throw new PlanningError('STAGE_NOT_APPROVED','三个设计阶段均需批准');
    if(s.planning!.blueprint.approvedInputHash!==planningInputHash(s))throw new PlanningError('UNREVIEWED_INPUT','新的输入或材料尚未纳入批准方案，请先分析影响并审阅修订');
    const blocks=s.planning!.blueprint.blocks;const issues=blueprintCoverage(blocks);if(issues.length)throw new PlanningError('PACKAGE_INCOMPLETE',issues.join('；'));
    const versionHash=planningBasis(s).hash;
    const directory=join(path,'artifacts','packages',`${expectedRevision}-${versionHash.slice(0,12)}-${createHash('sha256').update(operationId).digest('hex').slice(0,12)}`);const existing=join(directory,'package-manifest.json');
    let prior:PlanningPackageManifest|undefined;try{prior=JSON.parse(await readFile(existing,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new PlanningError('PACKAGE_INCOMPLETE','开发包清单无法读取，请保留证据并用新的操作重试');}
    if(prior){if(prior.basisHash!==versionHash||prior.operationId!==operationId||prior.sourceRevision!==expectedRevision)throw new PlanningError('IDEMPOTENCY_CONFLICT','恢复产物与本次编译不符');await this.verify(path,prior);await this.service.publishPackage(path,prior,expectedRevision);return prior;}
    const taskGraph=projectPlanningTaskGraph(blocks);
    const taskFile:PlanningPackageTaskFile={schemaVersion:2,revision:expectedRevision,blueprintHash:versionHash,...taskGraph};
    const taskById=new Map(taskFile.tasks.map(task=>[task.id,task]));
    const blockById=new Map(blocks.map(block=>[block.id,block]));
    const tasks=taskFile.tasks.map(task=>blockById.get(task.id)!);const first=taskFile.tasks[0]!;
    const projectionScope='任务依赖仅沿已批准蓝图的 dependsOn 穿过非任务块，遇到首个 task 或 validation 端点即停止；requirementIds 不推断前置。任务按稳定拓扑顺序排列，同时可执行的任务按 ID 排序。未登记的语义前置不会由导出补造，发现后应提交质量反馈并审阅修订。';
    const temporary=`${directory}.staging-${randomUUID()}`;await mkdir(temporary,{recursive:true});
    const header=(title:string)=>`# ${s.metadata.name} — ${title}\n\n版本：${expectedRevision}；批准蓝图：${versionHash}\n\n`;
    const render=(selected:BlueprintBlock[])=>selected.map(b=>`## ${b.title}\n\nID：${b.id}；关联需求：${b.requirementIds.join('、')||'项目目标'}；${taskById.has(b.id)?`任务前置：${taskById.get(b.id)!.dependsOn.join('、')||'无'}；蓝图原始依赖：${b.dependsOn.join('、')||'无'}`:`依赖：${b.dependsOn.join('、')||'无'}`}\n\n${b.content}\n${b.task?`\n目标：${b.task.goal}\n\n范围：${b.task.scope}\n\n排除：${b.task.exclusions}\n\n模块：${b.task.modules.join('、')}\n\n正常行为：${b.task.normalBehavior}\n\n异常行为：${b.task.failureBehavior}\n\n验证：\n${b.task.verification.map(v=>`- ${v}`).join('\n')}\n\n完成条件：\n${b.task.completionCriteria.map(v=>`- ${v}`).join('\n')}\n\n假设：${b.task.assumptions.join('；')||'无'}\n${b.kind==='validation'?`\n环境：${b.task.environment}\n\n步骤：\n${b.task.steps!.map(v=>`- ${v}`).join('\n')}\n\n通过标准：\n${b.task.passCriteria!.map(v=>`- ${v}`).join('\n')}\n\n证据：${b.task.evidenceRequired!.join('；')}\n\n失败后：${b.task.onFailure}\n`:''}`:''}\n来源：${b.evidenceIds.join('、')||'已批准设计'}；批准操作：${b.approvedBy}\n`).join('\n');
    const select=(kinds:BlueprintBlock['kind'][])=>blocks.filter(b=>kinds.includes(b.kind));
    const userNotes=join(path,'documents','USER_NOTES.md');let notes='';try{notes=await readFile(userNotes,'utf8');}catch{}
    const documents:Record<string,string>={
      'START_HERE.md':header('开发入口')+`阅读 PROJECT → PRODUCT → USER_FLOWS → UX_UI_SPEC → TECHNICAL_GUIDE → DEVELOPMENT_PLAN → ACCEPTANCE → AGENTS。\n\n首个可执行任务：${first.id} — ${first.title}。按 tasks.json 和 DEVELOPMENT_PLAN 的共同顺序实施，每个任务满足其前置条件后才开始；可独立执行的能力试验可以先验证，依赖实现或打包的集成验证须在相应任务完成后执行。未验证事项不能当作能力事实。实现或验证失败时保留证据并向 Project Architect 反馈，修订相关方案后继续。\n\n${projectionScope}\n\n这是规划交付，不表示目标项目已经被开发或实测。\n`,
      'PROJECT.md':header('目标与边界')+render(select(['target','problem','outcomes','scope','non_goals']))+`\n## 已批准关键决定\n\n${s.decisions.items.filter(d=>['confirmed','locked'].includes(d.status)).map(d=>`- ${d.statement}（${d.decisionKey??d.id}；来源 ${d.approvalSource??'历史用户决定'}）`).join('\n')}\n`,
      'PRODUCT.md':header('功能定义')+render(select(['feature'])),
      'USER_FLOWS.md':header('使用与恢复流程')+render(select(['flow'])),
      'UX_UI_SPEC.md':header('页面、交互与状态')+render(select(['page'])),
      'TECHNICAL_GUIDE.md':header('技术与接口')+render(select(['technology','module','data_model','interface','error','deployment']))+`\n## 可行性证据\n\n${s.planning!.evidence.map(e=>`- ${e.id}：${e.content}；来源 ${e.source}；日期 ${e.obtainedAt}；适用范围 ${e.applicability}；结果 ${e.outcome??'参考证据'}；哈希 ${e.hash??'未提供'}。`).join('\n')}\n`,
      'DEVELOPMENT_PLAN.md':header('全阶段开发任务')+projectionScope+'\n\n'+render(tasks),
      'ACCEPTANCE.md':header('验收场景')+render(select(['acceptance','validation'])),
      'AGENTS.md':header('目标项目开发约束')+`按已批准蓝图和任务实施。不得把未执行试验写为通过，不得越过任务依赖。需求变化或关键验证失败时提交反馈，等待相关方案修订。\n\nProject Architect 自身的技术栈与存储限制不适用于此项目。\n\n`+render(select(['scope','non_goals','technology'])),
      'tasks.json':JSON.stringify(taskFile,null,2)+'\n',
    };
    if(notes)documents['USER_NOTES.md']=notes;
    try{
      const manifest:PlanningPackageManifest={revision:expectedRevision+1,sourceRevision:expectedRevision,basisHash:versionHash,operationId,files:[],directory:`artifacts/packages/${basename(directory)}`};
      for(const [name,content] of Object.entries(documents)){await writeFile(join(temporary,name),content,'utf8');manifest.files.push({name,sha256:createHash('sha256').update(content).digest('hex')});}
      const bodies=Object.entries(documents).filter(([n])=>n.endsWith('.md')&&n!=='USER_NOTES.md').map(([,c])=>c.split('\n').slice(4).join('\n'));
      if(new Set(bodies).size!==bodies.length)throw new PlanningError('PACKAGE_INCOMPLETE','文档正文重复');
      await writeFile(join(temporary,'package-manifest.json'),JSON.stringify(manifest,null,2));
      const current=await this.service.get(path);if(current.metadata.stateRevision!==expectedRevision)throw new PlanningError('STATE_REVISION_CONFLICT','编译期间方案已变化');
      await rename(temporary,directory);
      await this.service.publishPackage(path,manifest,expectedRevision);
      return manifest;
    }catch(error){await rm(temporary,{recursive:true,force:true});throw error;}
  }
  async export(path:string):Promise<Buffer>{
    const s=await this.service.get(path);const manifest=s.planning!.package;
    if(!manifest)throw new PlanningError('PACKAGE_INCOMPLETE','请先编译开发包');
    if(planningBasis(s).hash!==manifest.basisHash)throw new PlanningError('STALE_BASIS','导出包版本已过期，请重新编译');
    const files=await this.verify(path,manifest);
    files.push({path:'package-manifest.json',data:Buffer.from(JSON.stringify(manifest,null,2))});
    return new DocumentExportService().createZip(files);
  }
  async read(path:string,name:string):Promise<string>{
    const s=await this.service.get(path),manifest=s.planning!.package;
    if(!manifest)throw new PlanningError('PACKAGE_INCOMPLETE','请先生成开发包');
    if(manifest.basisHash!==planningBasis(s).hash)throw new PlanningError('STALE_BASIS','开发包已过期，请重新生成');
    const files=await this.verify(path,manifest),file=files.find(f=>f.path===name);
    if(!file)throw new PlanningError('INVALID_INTENT','文件不在当前开发包内');
    return Buffer.from(file.data).toString('utf8');
  }
}
