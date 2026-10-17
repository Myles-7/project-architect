import type { AgentTaskResult, EvidenceRecord, PlanningState, PlanningTask } from '@project-architect/contracts';
import { hashValue } from '@project-architect/core';
import { planningResultView } from './PlanningResultView.js';

interface EvidenceSource { taskId?: string; changeSetId?: string; status?: string }
interface KnownEvidence { record: EvidenceRecord; sources: EvidenceSource[] }

/** Recover pending scope intent only from validated candidates in the result map. */
export function planningUnfinishedScopes(tasks: PlanningTask[], results: Map<string, AgentTaskResult>, unfinishedBlockIds: string[] = []) {
  const unfinished = new Set(unfinishedBlockIds);
  const candidates = tasks.filter(item => item.status === 'completed' && ['design', 'integration', 'revision'].includes(item.kind) && results.has(item.id))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || tasks.indexOf(b) - tasks.indexOf(a));
  return tasks.filter(item => item.requiredBlockIds?.some(id => unfinished.has(id))).map(item => {
    const required = new Set(item.requiredBlockIds?.filter(id => unfinished.has(id)));
    const selected = new Set<string>(), previousCandidateBlocks: AgentTaskResult['groups'][number]['blocks'] = [], previousCandidateRemoveIds: string[] = [];
    const previousCandidateSources: { blockId: string; taskId: string; action: 'replace' | 'remove' }[] = [];
    // Scope still belongs to the registered full anchor. Content references use
    // the newest real action for each missing ID, including earlier partials.
    for (const source of candidates) {
      const previous = planningResultView(results.get(source.id)!, source.kind);
      const blocks = previous.groups.flatMap(group => group.blocks).filter(block => required.has(block.id) && !selected.has(block.id));
      const removals = previous.groups.flatMap(group => group.removeBlockIds).filter(id => required.has(id) && !selected.has(id));
      previousCandidateBlocks.push(...blocks); previousCandidateRemoveIds.push(...removals);
      previousCandidateSources.push(...blocks.map(block => ({ blockId: block.id, taskId: source.id, action: 'replace' as const })), ...removals.map(blockId => ({ blockId, taskId: source.id, action: 'remove' as const })));
      // Keep conflicting actions inside one raw result visible rather than
      // resolving them locally or silently selecting one of its groups.
      [...blocks.map(block => block.id), ...removals].forEach(id => selected.add(id));
    }
    if (previousCandidateSources.length) {
      const sourceIds = new Set(previousCandidateSources.map(source => source.taskId));
      return { taskId: item.id, goal: item.goal, partition: item.partition, requiredBlockIds: item.requiredBlockIds,
        ...(sourceIds.size === 1 ? { previousCandidateTaskId: previousCandidateSources[0]!.taskId } : {}),
        previousCandidateBlocks, previousCandidateRemoveIds, previousCandidateSources };
    }
    return { taskId: item.id, goal: item.goal, partition: item.partition, requiredBlockIds: item.requiredBlockIds };
  });
}

/** Preserve exact evidence identity without letting an older draft replace a repair. */
export function planningWorkerContext(tasks: PlanningTask[], results: Map<string, AgentTaskResult>, state: PlanningState, task?: PlanningTask, initialDraft?: AgentTaskResult) {
  const views = new Map(tasks.filter(item => results.has(item.id)).map(item => [item.id, planningResultView(results.get(item.id)!, item.kind)]));
  // A fragment is not a complete draft. The assembly parent can occur earlier
  // in registration order than the children that finish it.
  const latest = tasks.filter(item => !item.partition && item.status === 'completed' && ['design', 'integration', 'revision', 'clarification'].includes(item.kind) && views.has(item.id)).sort((a,b)=>(a.completedAt??'').localeCompare(b.completedAt??'')||tasks.indexOf(a)-tasks.indexOf(b)).at(-1);
  const draft = latest ? views.get(latest.id)! : initialDraft ?? null;
  const repairSource = task?.repairSourceTaskId ? tasks.find(item => item.id === task.repairSourceTaskId) : task;
  const currentIssues = [...new Set(repairSource?.repairIssues ?? [])];
  const approvedEvidence = state.evidence;
  const known = new Map<string, KnownEvidence>();
  const add = (record: EvidenceRecord, source: EvidenceSource) => {
    const hash = hashValue(record), existing = known.get(hash);
    if (existing) existing.sources.push(source); else known.set(hash, { record, sources: [source] });
  };
  for (const change of state.changeSets) for (const record of change.evidence) add(record, { changeSetId: change.id, status: change.status });
  for (const item of tasks) for (const record of views.get(item.id)?.evidence ?? []) add(record, { taskId: item.id, status: item.status });
  let knownEvidence = [...known.values()];
  if (task?.kind === 'review') {
    const referenced = new Set(draft?.groups.flatMap(group => [...group.blocks.flatMap(block => block.evidenceIds), ...group.decisions.flatMap(decision => decision.evidenceIds)]) ?? []);
    for (const record of draft?.evidence ?? []) referenced.add(record.id);
    knownEvidence = knownEvidence.filter(item => referenced.has(item.record.id));
  }
  const identities = new Map<string, Set<string>>();
  for (const record of [...approvedEvidence, ...knownEvidence.map(item => item.record)]) {
    const versions = identities.get(record.id) ?? new Set<string>(); versions.add(hashValue(record)); identities.set(record.id, versions);
  }
  const evidenceConflicts = [...identities].filter(([, hashes]) => hashes.size > 1).map(([id]) => id);
  const evidenceContext = { approvedEvidence, knownEvidence, evidenceConflicts };
  if (task?.kind === 'review') return { workerResults: { draft }, ...evidenceContext };

  if (!task || !['integration', 'revision'].includes(task.kind)) {
    return { workerResults: Object.fromEntries((task?.dependsOn ?? []).filter(id => views.has(id)).map(id => [id, views.get(id)])), ...(initialDraft || ['research','validation','decomposition'].includes(task?.kind ?? '') ? { currentDraft: draft } : {}), currentIssues, ...evidenceContext };
  }
  const dependencies = new Set(task.dependsOn);
  const workerResults = Object.fromEntries(tasks.filter(item => item.id !== latest?.id && item.status === 'completed' && views.has(item.id) && ((!item.partition && ['research', 'validation'].includes(item.kind)) || dependencies.has(item.id))).map(item => [item.id, views.get(item.id)]));
  const historicalFindings = new Map<string, { id: string; text: string; status: 'historical-observation'; sources: Array<{ taskId: string; kind: PlanningTask['kind'] }> }>();
  const taskHistory = tasks.filter(item => item.status === 'completed' && views.has(item.id)).map(item => {
    const result = views.get(item.id)!;
    const findingIds = [...new Set(result.blockers)].map(text => {
      const id = `finding:${hashValue(text)}`;
      const finding = historicalFindings.get(id) ?? { id, text, status: 'historical-observation' as const, sources: [] };
      finding.sources.push({ taskId: item.id, kind: item.kind }); historicalFindings.set(id, finding);
      return id;
    });
    return { taskId: item.id, kind: item.kind, basisHash: item.basisHash, findingIds, followUp: result.followUp, ...(item.kind === 'clarification' ? { clarification: result.clarification, summary: result.summary } : {}) };
  });
  const historicalReviewFindings = [...new Set(tasks.filter(item => item.kind === 'review' && item.status === 'completed').flatMap(item => views.get(item.id)?.blockers ?? []))];
  return { workerResults, currentDraft: draft, currentIssues, taskHistory, historicalFindings: [...historicalFindings.values()], historicalReviewFindings, ...evidenceContext };
}
