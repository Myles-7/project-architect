import { ReadinessGate } from '../readiness/ReadinessGate.js';
import { ReadinessActionPolicy } from '../readiness/ReadinessActionPolicy.js';
import { AreaRegistry } from '../areas/AreaRegistry.js';
import {
  CANONICAL_B3_AREAS,
  type ProjectSnapshot,
  type ReadinessView,
  type ReadinessAreaView,
  type ReadinessIssueView,
  type DecisionRef,
  type GapRef,
} from '@project-architect/contracts';

/**
 * Pure-function projection: ProjectSnapshot -> ReadinessView.
 *
 * Guaranteed Invariants:
 * 1. Zero state mutations (pure function, does not modify input snapshot).
 * 2. Purely derives score, Level 1~5, blocking issues, and gate authorization state.
 * 3. Does not permit unapproved readiness states to manufacture canGenerateDocs=true.
 */
export function readinessProjection(snapshot: ProjectSnapshot): ReadinessView {
  const currentReadiness = snapshot.readiness?.current;
  const decisions = snapshot.decisions?.items || [];
  const openGaps = (snapshot.gaps?.gaps || []).filter((g) => g.status === 'open');
  const openConflicts = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open');
  const assumptions = (snapshot.assumptions?.items || []).filter((a) => a.status === 'active');

  const requiredAreas = currentReadiness?.requiredAreas && currentReadiness.requiredAreas.length > 0
    ? currentReadiness.requiredAreas
    : [...CANONICAL_B3_AREAS];

  const ackConflicts = currentReadiness?.criticalConflictAcknowledgements || [];
  const ackIssues = currentReadiness?.knownIssueAcknowledgements || [];

  // 1. Derive Readiness Areas
  const areas: ReadinessAreaView[] = requiredAreas.map((areaId) => {
    const canonicalArea = AreaRegistry.normalize(areaId);
    const matchedDecision = decisions.find(
      (d) => (AreaRegistry.normalize(d.area) === canonicalArea || d.id === areaId) && (d.status === 'confirmed' || d.status === 'locked')
    );
    const blockingGaps = openGaps.filter((g) => AreaRegistry.normalize(g.area) === canonicalArea).map((g) => `gap:${g.id}` as GapRef);

    const isSatisfied = Boolean(matchedDecision) && blockingGaps.length === 0;

    return {
      areaId,
      title: AreaRegistry.getReadinessTitle(areaId),
      isSatisfied,
      decisionRef: matchedDecision ? (`decision:${matchedDecision.id}` as DecisionRef) : undefined,
      blockingGapRefs: blockingGaps,
    };
  });

  // 2. Derive Blocking Issues
  const blockingIssues: ReadinessIssueView[] = [];

  for (const c of openConflicts) {
    const isCritical = c.severity === 'critical';
    const isAck = ackConflicts.includes(`conflict:${c.id}`) || ackConflicts.includes(c.id);
    const conflictMessage = c.reason
      ? `Conflict: ${c.propositionA} vs ${c.propositionB} (${c.reason})`
      : `Conflict: ${c.propositionA} vs ${c.propositionB}`;

    blockingIssues.push({
      id: `conflict:${c.id}`,
      severity: isCritical ? 'critical' : 'high',
      message: conflictMessage,
      targetRef: `conflict:${c.id}`,
      isAcknowledged: isAck,
    });
  }

  for (const g of openGaps) {
    if (g.severity === 'critical' || g.severity === 'high') {
      const isAck = ackIssues.includes(`gap:${g.id}`) || ackIssues.includes(g.id);
      blockingIssues.push({
        id: `gap:${g.id}`,
        severity: g.severity === 'critical' ? 'critical' : 'high',
        message: `Gap in ${AreaRegistry.getReadinessTitle(g.area)}: ${g.reason || g.impact || 'Unresolved dependency'}`,
        targetRef: `gap:${g.id}`,
        isAcknowledged: isAck,
      });
    }
  }

  // 3. Derive Score & Level (1 to 5)
  const satisfiedCount = areas.filter((a) => a.isSatisfied).length;
  const areaRatio = areas.length > 0 ? satisfiedCount / areas.length : 0;
  const hasUnackCritical = blockingIssues.some((i) => i.severity === 'critical' && !i.isAcknowledged);

  let level: 1 | 2 | 3 | 4 | 5 = 1;
  // Active assumptions are unverified risks and do not award arbitrary bonuses
  const assumptionPenalty = Math.min(10, Math.floor(assumptions.length * 1.5));
  let score = Math.round(areaRatio * 60 + (hasUnackCritical ? 0 : 40) - assumptionPenalty);
  score = Math.max(10, Math.min(100, score));

  if (score >= 90 && !hasUnackCritical && areaRatio === 1) {
    level = 5;
  } else if (score >= 75 && !hasUnackCritical) {
    level = 4;
  } else if (score >= 55) {
    level = 3;
  } else if (score >= 35) {
    level = 2;
  } else {
    level = 1;
  }

  const status = currentReadiness?.status || (level >= 4 ? 'ready' : level >= 3 ? 'ready-with-warnings' : 'not-ready');
  const isReadyForDocs = status === 'ready' || status === 'ready-with-warnings';
  const userDisposition = currentReadiness?.userDisposition || 'pending';

  // Can generate docs iff ReadinessGate allows it
  const gateResult = new ReadinessGate().canGenerateDocuments(snapshot);
  const canGenerateDocs = gateResult.allowed;

  const warnings = currentReadiness?.warnings ? [...currentReadiness.warnings] : [];
  if (assumptions.length > 0 && !warnings.some((w) => w.includes('assumption'))) {
    warnings.push(`${assumptions.length} active assumption(s) currently apply.`);
  }

  const currentRevision = snapshot.metadata.stateRevision;
  const basisRevision = currentReadiness?.basisRevision ?? currentRevision;
  const isStale = Boolean(currentReadiness && currentRevision > basisRevision + 1);

  const coverage = {
    total: areas.length,
    satisfied: satisfiedCount,
    ratio: areaRatio,
  };

  // Credibility calculation (0 - 100):
  // Coverage measures completeness; Credibility measures trustworthiness.
  // Assumptions strictly penalize or maintain, NEVER award positive points.
  let credibility = 100;
  credibility -= openConflicts.filter((c) => c.severity === 'critical').length * 30;
  credibility -= openGaps.filter((g) => g.severity === 'critical').length * 20;
  credibility -= openGaps.filter((g) => g.severity === 'high').length * 10;
  credibility -= assumptions.length * 5;
  credibility -= Math.round((1 - areaRatio) * 40);
  const credibilityScore = Math.max(0, Math.min(100, credibility));

  const actions = ReadinessActionPolicy.evaluateActions(snapshot);

  return {
    basisRevision,
    currentRevision,
    isStale,
    coverage,
    credibilityScore,
    areas,
    actions,

    // Compatibility fields
    sourceStateRevision: currentRevision,
    projectId: snapshot.metadata.projectId,
    level,
    score,
    status,
    isReadyForDocs,
    userDisposition,
    blockingIssues,
    warnings,
    activeAssumptions: assumptions.map((a) => ({
      ref: `assumption:${a.id}`,
      statement: a.statement,
      reason: a.reason,
    })),
    canGenerateDocs,
  };
}
