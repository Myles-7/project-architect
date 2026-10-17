// Deterministic test data. It is never imported by the production Provider.
export const result = (extra={}) => ({summary:'本阶段已整理为可审阅草案。',groups:[],questions:[],evidence:[],blockers:[],followUp:[],clarification:null,...extra});
export function question(key='notes:storage', id='q-storage') {
  return {id,issueRef:'gap:storage',importance:'high',question:'笔记数据保存在哪里？',reason:'这会决定离线使用和部署方式。',recommendation:'本地保存',recommendationReason:'个人工具优先支持离线。',recommendedOptionKey:'local',options:[
    {key:'local',label:'保存在本地',approach:'笔记保存为设备上的文件。',gain:'离线使用，备份简单。',sacrifice:'跨设备需要手动导出。',impact:'实现文件持久化和导出。',reversibility:'moderate'},
    {key:'remote',label:'保存到远程服务',approach:'笔记保存到自己部署的服务。',gain:'可以跨设备访问。',sacrifice:'需要部署并维护服务。',impact:'增加服务和身份验证。',reversibility:'hard'},
  ],allowFreeInput:true,selectionMode:'single',decisionKey:key,dependsOn:[],status:'proposed',createdAt:'2026-10-04T00:00:00Z'};
}
export const clarification = {target:'个人开发者本人',problem:'分散笔记难以保存和查找',outcomes:'离线保存、编辑和导出笔记',scope:'单用户笔记管理和本地导出',constraints:'本地部署，不需要账号或同步',delegated:[]};
export function blocks(stage) {
  const block=(id,kind,title,content,requirementIds=[],dependsOn=[],task)=>({id,stage,kind,title,content,requirementIds,dependsOn,evidenceIds:[],...(task?{task}:{})});
  if(stage==='product')return [
    block('target','target','目标用户','服务个人开发者本人，在桌面浏览器整理开发笔记。'),
    block('problem','problem','问题','分散文本难以保存和查找，关闭页面后容易丢失修改。'),
    block('outcomes','outcomes','预期结果','可以离线新增、编辑、查找笔记并导出自己的完整数据。'),
    block('scope','scope','范围','本轮包含单用户本地笔记管理、失败恢复和文件导出。'),
    block('non-goals','non_goals','不做事项','本轮不提供账号、团队协作和自动跨设备同步。'),
    block('notes','feature','笔记管理','新增笔记、编辑标题与正文、手动保存，并在失败时保留编辑内容。'),
    block('notes-flow','flow','笔记流程','打开列表→新增→输入标题正文→保存→显示成功；保存失败保留输入并提供重试。',['notes']),
    block('editor','page','笔记工作区','左侧列表右侧编辑器；空列表显示新建入口，加载显示状态，失败提供重试，离线编辑可继续。',['notes']),
  ];
  if(stage==='technical')return [
    block('stack','technology','技术选择','使用 TypeScript 和文件服务；固定开发版本，优先复用成熟的文本编辑组件。'),
    block('notes-module','module','笔记模块','笔记服务负责读取与原子保存，编辑器负责本地草稿与可观察状态。',['notes']),
    block('note-model','data_model','笔记模型','Note: id:string, title:string, body:string, revision:number；版本保护避免覆盖。',['notes']),
    block('notes-api','interface','笔记接口','PUT /notes/:id 输入 title/body/expectedRevision；成功返回新版本，409 返回当前版本，500 保留草稿。',['notes']),
    block('notes-error','error','错误恢复','磁盘写入失败不替换旧文件；保留草稿并允许重试；版本冲突由用户审阅后合并。',['notes']),
    block('deployment','deployment','部署环境','在本机运行 Node 服务与桌面浏览器；本地文件目录可备份，升级前保留历史版本。'),
  ];
  const task={goal:'独立实现可保存和恢复的笔记管理',scope:'列表、新增、编辑、保存和冲突恢复',exclusions:'不包含账号或跨设备同步',modules:['编辑器','笔记服务'],normalBehavior:'保存后列表和正文显示新版本',failureBehavior:'失败保留草稿；冲突展示版本差异',verification:['在临时目录新增笔记并重新打开','注入保存失败检查草稿仍可见'],completionCriteria:['重新打开后可读到已保存的正文','写入失败后输入内容保持且可以重试'],assumptions:[]};
  return [block('implement-notes','task','实现笔记管理','完成笔记管理模块和接口，验收覆盖成功、失败及版本冲突。',['notes'],['notes-api'],task),block('accept-notes','acceptance','笔记验收','Given 已有笔记，When 修改正文并保存后重新打开，Then 新正文可见；写入失败时草稿保持。',['notes'])];
}
export function group(stage) {return {id:`${stage}-group`,title:`${stage}方案`,impact:'明确当前阶段的实现范围和失败处理。',dependsOn:[],blocks:blocks(stage),removeBlockIds:[],decisions:[],status:'pending'};}
export class FixturePlanningProvider {
  calls=[];
  constructor(delay=30){this.delay=delay;}
  async complete(request){
    this.calls.push(request);
    await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new Error('Cancelled'));};const timer=setTimeout(()=>{request.abortSignal?.removeEventListener('abort',abort);resolve();},this.delay);if(request.abortSignal?.aborted)abort();else request.abortSignal?.addEventListener('abort',abort,{once:true});});
    const context=JSON.parse(request.contextText);let output=result();
    if(context.stage==='clarify')output=context.answers.length?result({clarification,summary:'目标与边界已澄清，可以生成产品与体验。'}):result({questions:[question()],summary:'先确定笔记的存储方式。'});
    else if(request.prompt.includes('你是独立评审者'))output=result();
    else if(request.prompt.includes('你负责官方资料研究'))output=result({summary:'测试研究工作已完成；这里没有真实能力证据。'});
    else if(context.stage==='feedback'){const candidate=context.currentDraft??context.workerResults?.draft;const current=candidate?.groups.flatMap(group=>group.blocks).find(b=>b.id==='notes')??context.blueprint.blocks.find(b=>b.id==='notes');const {approvedAt,approvedBy,locked,...source}=current;const changed={...source,content:'新增编辑和保存笔记；增加明确的自动保存失败提示，并继续保留草稿。'};output=result({groups:[{...group('product'),id:'feedback-group',blocks:[changed],title:'保存提示修订'}]});}
    else output=result({groups:[group(context.stage)]});
    return {status:'completed',structuredSuccess:true,structuredOutput:output,rawEnvelope:null,stderr:'',exitCode:0,durationMs:this.delay,usage:{},provider:'fixture'};
  }
}
