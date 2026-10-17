import type { AgentTaskResult, BlueprintBlock, BlueprintState } from '@project-architect/contracts';

interface UnfinishedCandidate {
  taskId?: string;
  previousCandidateBlocks?: BlueprintBlock[];
  previousCandidateRemoveIds?: string[];
}

/** A read-only context projection. Original approved bodies stay in Core and
 * basis.json; candidate bodies remain in their validated task results. */
export function planningBlueprintContext(approved: BlueprintState, draft?: AgentTaskResult | null, unfinished: UnfinishedCandidate[] = [], dependencies: AgentTaskResult[] = [], compareApprovedChanges = false) {
  const supplied = [...(draft ? [draft] : []), ...dependencies];
  const replacements = new Set([
    ...supplied.flatMap(result => result.groups.flatMap(group => group.blocks.map(block => block.id))),
    ...unfinished.flatMap(scope => scope.previousCandidateBlocks?.map(block => block.id) ?? []),
  ]);
  const removals = new Set([
    ...supplied.flatMap(result => result.groups.flatMap(group => group.removeBlockIds)),
    ...unfinished.flatMap(scope => scope.previousCandidateRemoveIds ?? []),
  ]);
  if (!draft && !replacements.size && !removals.size) return { blueprint: approved };
  const shadowedApprovedBlocks = approved.blocks.filter(block => replacements.has(block.id) || removals.has(block.id)).map(block => ({
    id: block.id, stage: block.stage, kind: block.kind, title: block.title,
    locked: Boolean(block.locked), approvedBy: block.approvedBy, approvedAt: block.approvedAt,
    change: replacements.has(block.id) ? removals.has(block.id) ? 'replacement-and-removal' : 'replacement' : 'removal',
  }));
  return {
    blueprint: { ...approved, blocks: approved.blocks.filter(block => !replacements.has(block.id) && !removals.has(block.id)) },
    blueprintContext: {
      kind: 'approved-blocks-with-candidate-overrides-omitted',
      source: 'Core approved blueprint; original full state retained in this run basis.json',
      candidateStatus: 'pending-user-approval',
      shadowedApprovedBlocks,
    },
    ...(compareApprovedChanges ? {
      changeReviewBaseline: {
        status: 'previous-approved-for-change-comparison-only' as const,
        purpose: 'Compare each replacement/removal against its prior approved content to detect unrelated scope loss. These bodies are historical and must not override the current pending candidate.',
        blocks: structuredClone(approved.blocks.filter(block => replacements.has(block.id) || removals.has(block.id))),
      },
    } : {}),
  };
}
