import type { AgentTaskResult, EvidenceRecord, PlanningTask, PlanningWorkPartition } from '@project-architect/contracts';
import { PLANNING_TASK_SCHEMA } from '@project-architect/contracts';
import { hashValue, PlanningError, planningDependencyCycles } from '@project-architect/core';
import { planningResultView } from './PlanningResultView.js';
import { scopeAssemblyEvidence } from './PlanningAssemblyEvidence.js';

/** Capacity recovery is triggered by a real service error, never a usage budget. */
export const isPlanningOutputLimit = (message: string) => /exceeded the output token limit|output.?token.?limit|max(?:imum)?.?output.?tokens|MAX_TOKENS/i.test(message);
export const partitionPrompt = `你是已登记的任务拆分工作者。本次父任务实际触及模型单次输出上限，不能截短方案或减少功能。只规划更小的、能够独立输出的工作范围，groups/questions/evidence/blockers/followUp=[]、clarification=null，workItems 至少两个。每项给稳定唯一 id、具体 goal、它独占负责新增/修改/删除的稳定 blockIds、工作项 dependsOn。不输出设计正文。覆盖父任务全部职责和新需求，保留无关块，不扩用户范围；普通细节由AI设计。将现有受影响块及其新增关联块划到唯一所有者，其他工作者可以引用但不能修改。整合/修订已有 currentDraft 时，将其中全部待批准块和 removeBlockIds 也分配到范围，以保留此前修好的内容；已有未变块在其范围原样保留，不重写成旧批准内容。只在确有先后依赖时登记 dependsOn，不建立循环。单个复杂功能可按流程、契约和实现验收进一步分工；不存在费用、总工作项或修订次数门禁。当前父范围存在时，子项必须严格细分其 blockIds；不能用两个同样的大任务伪装拆分。最终由应用完整汇集片段并独立评审，不直接写正式状态。`;

export function partitionSchema() {
  const schema: any = structuredClone(PLANNING_TASK_SCHEMA);
  for (const key of ['groups', 'questions', 'evidence', 'blockers', 'followUp']) schema.properties[key] = { type: 'array', maxItems: 0, items: {} };
  schema.properties.clarification = { type: 'null' };
  schema.properties.workItems.minItems = 2;
  schema.required.push('workItems');
  return schema;
}
export function validatePartitions(output: AgentTaskResult, parent?: PlanningWorkPartition, required: string[] = []): PlanningWorkPartition[] {
  if (output.groups.length || output.questions.length || output.evidence.length || output.blockers.length || output.followUp.length || output.clarification !== null) throw new PlanningError('INVALID_STRUCTURED_RESULT', '拆分任务只允许返回工作范围');
  const items = output.workItems;
  if (!items || items.length < 2) throw new PlanningError('INVALID_STRUCTURED_RESULT', '输出超限须拆成至少两个具体工作范围');
  const ids = new Set<string>(), blocks = new Set<string>();
  for (const item of items) {
    if (!item.id.trim() || ids.has(item.id) || !item.goal.trim() || !item.blockIds.length || !item.blockIds.every(id => id.trim())) throw new PlanningError('INVALID_STRUCTURED_RESULT', '工作范围缺失、重复或为空');
    ids.add(item.id);
    for (const id of item.blockIds) { if (blocks.has(id)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `多个工作范围修改同一块：${id}`); blocks.add(id); }
  }
  for (const item of items) for (const id of item.dependsOn) if (!ids.has(id)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `工作范围依赖不存在：${id}`);
  if (planningDependencyCycles(items).length) throw new PlanningError('INVALID_STRUCTURED_RESULT', '工作范围存在循环依赖');
  if (parent && (blocks.size !== parent.blockIds.length || parent.blockIds.some(id => !blocks.has(id)))) throw new PlanningError('INVALID_STRUCTURED_RESULT', '再次拆分必须完整且严格细分父范围');
  if (required.some(id => !blocks.has(id))) throw new PlanningError('INVALID_STRUCTURED_RESULT', '工作范围遗漏了已有待批准内容');
  return items;
}
export function validatePartitionResult(result: AgentTaskResult, partition: PlanningWorkPartition, required: string[] = []): void {
  const allowed = new Set(partition.blockIds);
  const touched = result.groups.flatMap(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds]);
  if (touched.some(id => !allowed.has(id))) throw new PlanningError('INVALID_STRUCTURED_RESULT', '工作者修改了登记范围之外的块');
  if (result.workItems?.length) throw new PlanningError('INVALID_STRUCTURED_RESULT', '工作者不能自行登记子任务');
  if (!result.questions.length && required.some(id => !touched.includes(id))) throw new PlanningError('INVALID_STRUCTURED_RESULT', '工作者遗漏了登记的新块或既有待批准内容');
}
export interface PlanningAssemblyOptions { version: 2; knownEvidence: EvidenceRecord[] }
export function assemblePartitions(tasks: PlanningTask[], results: Map<string, AgentTaskResult>, base?: AgentTaskResult, roleViewVersion: 0 | 1 = 1, evidenceScopeVersion: 0 | 1 = 0, options?: PlanningAssemblyOptions): AgentTaskResult {
  const groups: AgentTaskResult['groups'] = [], evidence = new Map<string, AgentTaskResult['evidence'][number]>();
  const groupIds = new Set<string>(), blockIds = new Set<string>(), decisionKeys = new Set<string>();
  const questions = new Map<string, AgentTaskResult['questions'][number]>(), blockers = new Set<string>(), followUp = new Map<string, AgentTaskResult['followUp'][number]>();
  let views = tasks.map(task => {
    const source = results.get(task.id); if (!source) throw new PlanningError('INVALID_STRUCTURED_RESULT', '拆分任务产物尚未完整');
    // Version 0 only reconstructs historical receipts; all new assemblies use 1.
    return roleViewVersion === 1 ? planningResultView(source, task.kind) : source;
  });
  if (options?.version === 2) {
    const scoped = scopeAssemblyEvidence([...(base ? [base] : []), ...views], base, options.knownEvidence);
    if (base) base = scoped.shift()!;
    views = scoped;
  } else if (evidenceScopeVersion === 1) views = scopeAssemblyEvidence(views, base);
  for (const record of base?.evidence ?? []) evidence.set(record.id, structuredClone(record));
  for (const [index, task] of tasks.entries()) {
    const result = views[index]!;
    for (const group of result.groups) {
      if (groupIds.has(group.id)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `拆分分组 ID 冲突：${group.id}`); groupIds.add(group.id);
      for (const id of [...group.blocks.map(block => block.id), ...group.removeBlockIds]) { if (blockIds.has(id)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `拆分块 ID 冲突：${id}`); blockIds.add(id); }
      for (const decision of group.decisions) { if (decisionKeys.has(decision.decisionKey)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `拆分决定键冲突：${decision.decisionKey}`); decisionKeys.add(decision.decisionKey); }
      const registeredDependencies=(task.partition?.dependsOn??[]).flatMap(id=>{
        const dependency=tasks.find(candidate=>candidate.partition?.id===id);
        if(!dependency)throw new PlanningError('INVALID_STRUCTURED_RESULT','汇集的工作范围依赖不存在');
        const source = results.get(dependency.id);
        return source ? (roleViewVersion === 1 ? planningResultView(source, dependency.kind) : source).groups.map(item=>item.id) : [];
      });
      groups.push({ ...structuredClone(group), dependsOn:[...new Set([...group.dependsOn,...registeredDependencies])] });
    }
    for (const record of result.evidence) {
      const old = evidence.get(record.id);
      if (old && hashValue(old) !== hashValue(record)) throw new PlanningError('INVALID_STRUCTURED_RESULT', `拆分证据 ID 内容冲突：${record.id}`);
      evidence.set(record.id, structuredClone(record));
    }
    for (const question of result.questions) {
      const old = questions.get(question.decisionKey!);
      if (old && hashValue(old) !== hashValue(question)) throw new PlanningError('INVALID_STRUCTURED_RESULT', '拆分问题存在不同取舍');
      questions.set(question.decisionKey!, structuredClone(question));
    }
    result.blockers.forEach(value => blockers.add(value)); result.followUp.forEach(value => followUp.set(hashValue(value), value));
  }
  // Block ownership covers the complete candidate. Preserve pending decisions
  // and their exact evidence unless a validated fragment replaces that key.
  const replacementGroups = new Map<string, string[]>();
  const actionGroups = new Map<string, string[]>();
  for (const old of base?.groups ?? []) {
    const owned = new Set([...old.blocks.map(block => block.id), ...old.removeBlockIds]);
    const remaining = old.decisions.filter(decision => !decisionKeys.has(decision.decisionKey));
    const rejected = (old.rejectDecisionIds ?? []).filter(id => !groups.some(group => group.rejectDecisionIds?.includes(id)));
    const replacements = groups.filter(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds].some(id => owned.has(id)) || group.decisions.some(decision => old.decisions.some(original => original.decisionKey === decision.decisionKey))).map(group => group.id);
    const contentOwners = options?.version === 2 ? groups.filter(group => group.blocks.some(block => owned.has(block.id)) || group.decisions.some(decision => old.decisions.some(original => original.decisionKey === decision.decisionKey))).map(group => group.id) : [];
    // Deleting an obsolete member of a larger group does not make its owner
    // implement every prerequisite of the retained members. A wholly removed
    // group still carries its original approval prerequisites.
    const prerequisiteOwners = contentOwners.length ? contentOwners : replacements;
    actionGroups.set(old.id, [...new Set(replacements)]);
    if (remaining.length || rejected.length) {
      if (groupIds.has(old.id)) throw new PlanningError('INVALID_STRUCTURED_RESULT', '修订分组与需保留的原分组 ID 冲突');
      groups.push({ ...structuredClone(old), blocks: [], removeBlockIds: [], decisions: remaining, rejectDecisionIds: rejected });
      groupIds.add(old.id); prerequisiteOwners.push(old.id);
    }
    replacementGroups.set(old.id, [...new Set(prerequisiteOwners)]);
  }
  // Translate an existing approval dependency through its actual replacement
  // owners; do not infer new semantic prerequisites from requirement links.
  for (const group of groups) group.dependsOn = [...new Set(group.dependsOn.flatMap(id => replacementGroups.get(id) ?? [id]))].filter(id => id !== group.id);
  for (const old of base?.groups ?? []) {
    const owners = replacementGroups.get(old.id) ?? [];
    const prerequisites = old.dependsOn.flatMap(id=>replacementGroups.get(id)??[id]);
    for (const id of owners) {
      const owner=groups.find(group=>group.id===id)!;
      owner.dependsOn=[...new Set([...owner.dependsOn,...prerequisites])].filter(dependency=>dependency!==id);
    }
    const retained=groups.find(group=>group.id===old.id);
    if(retained)retained.dependsOn=[...new Set([...retained.dependsOn,...(options?.version === 2 ? actionGroups.get(old.id) ?? owners : owners)])].filter(id=>id!==retained.id);
  }
  const referenced = new Set(groups.flatMap(group => [...group.blocks.flatMap(block => block.evidenceIds), ...group.decisions.flatMap(decision => decision.evidenceIds)]));
  const workerEvidence = new Set(views.flatMap(view => view.evidence.map(record => record.id)));
  const currentEvidence = [...evidence.values()].filter(record => !options || referenced.has(record.id) || workerEvidence.has(record.id));
  return { summary: '已汇集全部登记工作范围；设计内容仍待独立评审和用户批准。', groups, evidence: currentEvidence, questions: [...questions.values()], blockers: [...blockers], followUp: [...followUp.values()], clarification: null };
}
/** Apply the Core batch budget while retaining every additional model question. */
export function batchAssembledQuestions(result: AgentTaskResult) {
  return { output: { ...result, questions: result.questions.slice(0,3) }, deferred: result.questions.slice(3) };
}
