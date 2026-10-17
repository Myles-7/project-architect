import type { AgentTaskResult, PlanningTaskKind } from '@project-architect/contracts';

/** Consume compatible history without changing canonical results or their hashes.
 * This is not validation: new Provider output must pass its complete role contract.
 */
export function planningResultView(result: AgentTaskResult, kind: PlanningTaskKind): AgentTaskResult {
  if (kind === 'decomposition') return {
    ...result, groups: [], questions: [], evidence: [], blockers: [], followUp: [], clarification: null,
  };
  const { workItems: _workItems, ...view } = result;
  if (kind === 'research' || kind === 'validation' || kind === 'review') return {
    ...view, groups: [], questions: [], clarification: null,
    followUp: kind === 'review' ? [] : view.followUp,
  };
  return view;
}
