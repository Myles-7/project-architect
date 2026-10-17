import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {providerSlots} from './agy-2026-10-04/real-integration/global-provider-slots.mjs';

process.env.PATH=dirname(process.execPath)+';'+process.env.PATH;
const label=process.argv[2],model='gemini-3.8-flash-high';
if(!label || !/^[a-z0-9-]+$/.test(label))throw new Error('Supply a new evidence label; historical controls are immutable.');
const build=resolve(process.argv[3]??'packages/agent/.validation/context-batch-build-v2-20261005');
const {AntigravityCliProvider}=await import(pathToFileURL(join(build,'provider/AntigravityCliProvider.js')));
const {preparePlanningWorkspace}=await import(pathToFileURL(join(build,'tools/PlanningToolsMcpServer.js')));
const {planningContextReadIssues}=await import(pathToFileURL(join(build,'tools/PlanningContextAccess.js')));
const root=resolve('docs/validation/agy-2026-10-04/real-integration',label);
await mkdir(root);
const marker=randomBytes(12).toString('hex');
const source={projectName:'只读批量上下文真实验证',constraints:'合成验证，不是正式需求或批准',rawInputs:[{id:'opaque',raw:'甲😀\\\"\n'.repeat(1000)+'\n末尾验证码：'+marker}],proofItems:Array.from({length:160},(_,id)=>({id:`p${id}`,value:`完整小记录 ${id} 中文😀`})),workerResults:{draft:{groups:[],approved:false}},taskHistory:[{body:'这是排除的历史，不是本轮必读。'.repeat(20000)}]};
const contextText=JSON.stringify(source,null,2),schemaPath=join(root,'schema.json');
await writeFile(join(root,'expected-input.json'),contextText);
await writeFile(schemaPath,JSON.stringify({type:'object',properties:{observedMarker:{type:'string'},draftApproved:{type:'boolean'},observedCount:{type:'integer'}},required:['observedMarker','draftApproved','observedCount'],additionalProperties:false}));
await preparePlanningWorkspace({materialRoots:[],materials:[],experimentRoot:join(root,'experiments'),evidenceRoot:join(root,'evidence')},root);
const slots=providerSlots('flash-m8-recovered-20261005-02',label);
const config={designModel:model,reviewModel:model,concurrency:4};
const manifest={mode:'context-batch-probe',label,startedAt:new Date().toISOString(),requestedConfig:config,actualConfig:config,providerCalls:[],maxActiveCalls:1,sharedProviderSlots:{group:slots.group,directory:slots.directory,journal:slots.journal,capacity:4},productionBuildScope:'Isolated compiled current agent source; existing production dist and in-flight controllers remain untouched.',buildPath:build,contextModuleSha256:createHash('sha256').update(await readFile(join(build,'tools/PlanningContextAccess.js'))).digest('hex'),status:'running'};
const save=()=>writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2));await save();
const request={requestId:`${label}-actual`,task:'planning-task',cwd:root,model,schemaPath,allowedTools:['mcp_project_architect_planning_context'],logPath:join(root,'stream.ndjson'),contextText,prompt:'真实只读分页传输验证。优先planning_context action=scan requiredOnly=true，按nextOffset和nextCharacterOffset完整续读，直到nextOffset为null。不用逐条read，除非确需单独定位。全部必读范围必须实际可见，不能跳页，否则finish被拒绝。不要读取taskHistory（历史仅可检索），不要使用其他工具或委托。最终返回rawInputs[0].raw末尾的验证码observedMarker、候选真实draftApproved以及proofItems的实际observedCount。验证码未在提示词提供，不能猜。'};
let lease;
try{
  lease=await slots.acquire(request);
  const call={requestId:request.requestId,model,reasoningEffort:'high',startedAt:new Date().toISOString(),cwd:root,logPath:request.logPath,sharedLease:lease};manifest.providerCalls.push(call);await save();
  const result=await new AntigravityCliProvider().complete(request);
  Object.assign(call,{completedAt:new Date().toISOString(),status:result.status,structuredSuccess:result.structuredSuccess,error:result.stderr,durationMs:result.durationMs});await save();
  const toolConfig=JSON.parse(await readFile(join(root,'.agents','planning-tools.json'),'utf8'));
  const missing=planningContextReadIssues(toolConfig.contextAccess);
  const entries=JSON.parse(await readFile(toolConfig.contextAccess.entriesPath,'utf8'));
  const observations=[];
  for(const line of (await readFile(request.logPath,'utf8')).split('\n').filter(Boolean)){
    const chunk=JSON.parse(line);if(chunk.stream!=='stdout')continue;
    for(const part of chunk.data.split('\n').filter(Boolean)){
      let event;try{event=JSON.parse(part);}catch{continue;}
      const step=event.step_update;if(step?.state!=='DONE'||step.tool_name!=='call_mcp_tool'||step.tool_info?.parameters?.ToolName!=='planning_context')continue;
      let output;try{output=JSON.parse(step.tool_info.output);}catch{}
      observations.push({action:step.tool_info.parameters.Arguments?.action,directlyVisibleJSON:!!output,outputBytes:Buffer.byteLength(step.tool_info.output??''),output});
    }
  }
  const visible=observations.flatMap(observation=>observation.output?.parts?.map(part=>({...part,contextSha256:observation.output.contextSha256}))??(observation.action==='read'&&observation.output?.key?[observation.output]:[]));
  const missingVisible=entries.filter(entry=>toolConfig.contextAccess.requiredKeys.includes(entry.key)).filter(entry=>{
    let end=0;const parts=visible.filter(part=>part.key===entry.key&&part.sha256===entry.sha256&&part.contextSha256===toolConfig.contextAccess.sourceSha256).sort((a,b)=>a.offset-b.offset);
    for(const part of parts){if(part.offset>end||part.content!==entry.content.slice(part.offset,part.offset+part.content.length))break;end=Math.max(end,part.offset+part.content.length);}return end<entry.characters;
  }).map(entry=>entry.key);
  const scanCalls=observations.filter(observation=>observation.action==='scan').length;
  const passed=result.structuredSuccess&&result.structuredOutput?.observedMarker===marker&&result.structuredOutput?.draftApproved===false&&result.structuredOutput?.observedCount===160&&!missing.length&&!missingVisible.length&&scanCalls>0&&scanCalls<toolConfig.contextAccess.requiredKeys.length/3;
  const report={checkedAtUTC:new Date().toISOString(),status:passed?'passed':'failed',model,result,totalFrozenUtf8Bytes:Buffer.byteLength(contextText),requiredEntries:toolConfig.contextAccess.requiredKeys.length,requiredUtf8Bytes:entries.filter(entry=>toolConfig.contextAccess.requiredKeys.includes(entry.key)).reduce((sum,entry)=>sum+Buffer.byteLength(entry.content),0),scanCalls,missingRequiredReads:missing,missingMandatoryVisibleRanges:missingVisible,observations,scope:'Synthetic complete visible batch transport and opaque-marker proof; not content acceptance of a full project or human review.'};
  await writeFile(join(root,'result.json'),JSON.stringify(report,null,2));manifest.status=passed?'completed':'failed';if(!passed)process.exitCode=1;
  console.log(JSON.stringify({label,status:report.status,requiredEntries:report.requiredEntries,scanCalls,missing:missing.length,missingVisible:missingVisible.length,durationMs:result.durationMs,error:result.stderr}));
}catch(error){manifest.status='failed';manifest.error=String(error);process.exitCode=1;console.error(error);}
finally{if(lease)await slots.release(lease);manifest.completedAt=new Date().toISOString();manifest.activeCallsAtShutdown=0;manifest.sharedProviderSlots.ownedLeasesAtShutdown=await slots.owned();await save();}
