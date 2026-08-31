import type {
  ProjectSnapshot,
  DiscoveryProgressView,
} from '@project-architect/contracts';

/**
 * Projects the unified discovery progress view from a canonical project snapshot.
 * ARCHITECTURAL INVARIANT: "Projection is derived, not persisted."
 */
export function projectDiscoveryProgressProjection(
  snapshot: ProjectSnapshot
): DiscoveryProgressView {
  const stateRevision = snapshot.metadata.stateRevision;
  const projectId = snapshot.metadata.projectId;

  // 1. Conflicts & Gaps
  const conflicts = snapshot.gaps?.conflicts || [];
  const openConflicts = conflicts.filter((c) => c.status === 'open');
  const allGaps = snapshot.gaps?.gaps || [];
  const openGaps = allGaps.filter((g) => g.status === 'open');
  const deferredGaps = allGaps.filter((g) => g.status === 'deferred');
  const criticalOpenGaps = openGaps.filter((g) => g.severity === 'critical');

  const blockingDecisionCount = openConflicts.length + criticalOpenGaps.length;
  const openGapCount = openGaps.length;

  const activeAssumptions = (snapshot.assumptions?.items || []).filter(
    (a) => a.status === 'active'
  );
  const deferredGapCount = deferredGaps.length + activeAssumptions.length;

  // 2. Batch Questions
  const allQuestions = snapshot.questions?.items || [];
  let latestBatchId: string | null = null;
  for (let i = allQuestions.length - 1; i >= 0; i--) {
    const q = allQuestions[i];
    if (q && q.batchId) {
      latestBatchId = q.batchId;
      break;
    }
  }

  const currentBatch = latestBatchId
    ? allQuestions.filter((q) => q.batchId === latestBatchId && q.status !== 'superseded')
    : allQuestions.filter((q) => q.status !== 'superseded');

  const activeBatchQuestionCount = currentBatch.filter(
    (q) => q.status === 'proposed' || q.status === 'shown'
  ).length;
  const answeredBatchQuestionCount = currentBatch.filter(
    (q) => q.status === 'answered'
  ).length;
  const dismissedBatchQuestionCount = currentBatch.filter(
    (q) => q.status === 'dismissed'
  ).length;
  const remainingBatchQuestionCount = activeBatchQuestionCount;

  // 3. Can generate next batch
  // Rule: Next batch is allowed ONLY when the current batch has fully concluded (0 remaining)
  // and there are still open gaps or candidate decisions to resolve.
  const hasCandidates = (snapshot.decisions?.items || []).some(
    (d) => d.status === 'candidate'
  );
  const isTerminalStage = ['approved', 'documents-generated'].includes(
    snapshot.metadata.stage
  );

  const canGenerateNextBatch =
    remainingBatchQuestionCount === 0 &&
    (openGapCount > 0 || hasCandidates) &&
    !isTerminalStage;

  // 4. Next Action
  let nextAction: DiscoveryProgressView['nextAction'] = 'answer';
  if (remainingBatchQuestionCount > 0) {
    nextAction = 'answer';
  } else if (
    snapshot.metadata.stage === 'readiness-review' ||
    openGapCount === 0 ||
    snapshot.readiness?.current?.status === 'ready' ||
    snapshot.readiness?.current?.status === 'ready-with-warnings'
  ) {
    nextAction = 'review-readiness';
  } else {
    nextAction = 'organize';
  }

  return {
    sourceStateRevision: stateRevision,
    projectId,
    blockingDecisionCount,
    openGapCount,
    deferredGapCount,
    activeBatchQuestionCount,
    answeredBatchQuestionCount,
    dismissedBatchQuestionCount,
    remainingBatchQuestionCount,
    canGenerateNextBatch,
    nextAction,
  };
}
