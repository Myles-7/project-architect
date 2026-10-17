import type { AgentTaskResult, ChangeSet, PlanningDraftSource, ProjectSnapshot, StartPlanningRequest } from '@project-architect/contracts';
import { hashValue, planningBasis, PlanningError } from '@project-architect/core';

export function capturePlanningDraft(snapshot: ProjectSnapshot, request: StartPlanningRequest): ChangeSet | undefined {
  if (!request.draftChangeSetId) return undefined;
  const source = snapshot.planning!.changeSets.find(change => change.id === request.draftChangeSetId);
  if (!source) throw new PlanningError('INVALID_CHANGESET', '待修订草案不存在');
  if (source.status === 'stale' || source.basis.hash !== planningBasis(snapshot).hash) throw new PlanningError('STALE_BASIS', '草案依据已变化，请重新规划');
  if (!['pending', 'partially-approved'].includes(source.status) || source.stage !== request.stage || source.stage === 'clarify' || !source.groups.some(group => group.status === 'pending')) throw new PlanningError('INVALID_CHANGESET', '只能在原阶段修订有效的待批准草案');
  return structuredClone(source);
}

export function planningDraftSource(source: ChangeSet): PlanningDraftSource {
  return { changeSetId: source.id, sourceRunId: source.runId, stage: source.stage, basis: structuredClone(source.basis), hash: hashValue(source), groupIds: source.groups.filter(group => group.status === 'pending').map(group => group.id) };
}

export function validatePlanningDraftSource(source: ChangeSet, reference: PlanningDraftSource, request: StartPlanningRequest | undefined): void {
  if (!source || !reference || !request || hashValue(source) !== reference.hash || source.id !== reference.changeSetId || source.runId !== reference.sourceRunId || source.stage !== reference.stage || hashValue(source.basis) !== hashValue(reference.basis) || request.draftChangeSetId !== source.id || request.stage !== source.stage || !['pending', 'partially-approved'].includes(source.status) || !Array.isArray(source.groups) || !Array.isArray(source.evidence) || !Array.isArray(reference.groupIds) || !reference.groupIds.length || hashValue(source.groups.filter(group => group.status === 'pending').map(group => group.id)) !== hashValue(reference.groupIds)) throw new PlanningError('RESULT_MODIFIED', '冻结的草案来源缺失、无效或已修改');
}

export function planningDraftCandidate(source: ChangeSet, reference: PlanningDraftSource): AgentTaskResult {
  return { summary: source.summary, groups: structuredClone(source.groups.filter(group => reference.groupIds.includes(group.id))), evidence: structuredClone(source.evidence), questions: [], blockers: [], followUp: [], clarification: null };
}

export const draftRevisionPrompt = `\n这次用户要求修订已有待批准草案。currentDraft 是本次应继续的候选，优先采用本 Run 最新实际草案；初次由已冻结的待批准分组提供。保留已经正确的正文、决定、删除动作和证据，按最新反馈修改相关职责及依赖闭包，不从正式蓝图重新生成并丢失正确候选。draftRevisionBaseline 若提供，仅是修订前待批准候选的比较基线，不是正式事实；独立评审比较未受反馈影响的范围是否丢失。人工锁定意图由 Core 保留，你不得输出 locked/approvedBy/approvedAt。所有新产物仍待用户批准。`;
