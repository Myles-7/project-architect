import { ReadinessGate } from '../readiness/ReadinessGate.js';
import type {
  ProjectSnapshot,
  ReadinessView,
  ReadinessAreaView,
  ReadinessIssueView,
  DecisionRef,
  GapRef,
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

  const requiredAreas = currentReadiness?.requiredAreas || [
    'project_overview',
    'target_user',
    'mvp_scope',
    'technical_boundary',
  ];

  const ackConflicts = currentReadiness?.criticalConflictAcknowledgements || [];
  const ackIssues = currentReadiness?.knownIssueAcknowledgements || [];

  // 1. Derive Readiness Areas
  const areas: ReadinessAreaView[] = requiredAreas.map((areaId) => {
    const matchedDecision = decisions.find(
      (d) => (d.area === areaId || d.id === areaId) && (d.status === 'confirmed' || d.status === 'locked')
    );
    const blockingGaps = openGaps.filter((g) => g.area === areaId).map((g) => `gap:${g.id}` as GapRef);

    const isSatisfied = Boolean(matchedDecision) && blockingGaps.length === 0;

    return {
      areaId,
      title: formatAreaTitle(areaId),
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
        message: `Gap in ${formatAreaTitle(g.area)}: ${g.reason || g.impact || 'Unresolved dependency'}`,
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
  let score = Math.round(areaRatio * 60 + (hasUnackCritical ? 0 : 30) + (assumptions.length > 0 ? 10 : 0));
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

  return {
    sourceStateRevision: snapshot.metadata.stateRevision,
    projectId: snapshot.metadata.projectId,
    level,
    score,
    status,
    isReadyForDocs,
    userDisposition,
    areas,
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

function formatAreaTitle(areaId: string): string {
  switch (areaId) {
    case 'project_overview':
    case 'vision':
      return 'Project Vision & Overview';
    case 'target_user':
    case 'user':
      return 'Target User Persona';
    case 'mvp_scope':
    case 'scope':
      return 'MVP Functional Scope';
    case 'technical_boundary':
    case 'constraints':
      return 'Platform & Technical Boundary';
    default:
      return areaId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
