import { AreaRegistry } from '../areas/AreaRegistry.js';
import type {
  ProjectSnapshot,
  ProjectOverviewView,
  OverviewSectionView,
  OverviewItemView,
  SectionMaturity,
  TypedRef,
} from '@project-architect/contracts';

/**
 * Pure-function projection: ProjectSnapshot -> ProjectOverviewView.
 *
 * Guaranteed Invariants:
 * 1. Zero state mutations (pure function, does not modify input snapshot).
 * 2. Zero I/O operations and zero AI calls.
 * 3. Never fabricates default text for missing decisions; displays honest warnings and unaddressed states.
 * 4. Distinctly separates Candidate, Confirmed, and Locked statuses (excludes superseded & rejected).
 */
export function projectOverviewProjection(snapshot: ProjectSnapshot): ProjectOverviewView {
  const decisions = snapshot.decisions?.items || [];
  const assumptions = (snapshot.assumptions?.items || []).filter((a) => a.status === 'active');
  const openGaps = (snapshot.gaps?.gaps || []).filter((g) => g.status === 'open');
  const openConflicts = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open');

  let totalConfirmed = 0;
  let totalLocked = 0;
  let totalCandidates = 0;

  for (const d of decisions) {
    if (d.status === 'locked') totalLocked++;
    else if (d.status === 'confirmed') totalConfirmed++;
    else if (d.status === 'candidate') totalCandidates++;
  }

  const sections: OverviewSectionView[] = (snapshot.overview?.sections || []).map((section) => {
    // Find active decisions matching this section either by itemRefs or by matching canonical area
    const sectionDecisions = decisions.filter(
      (d) =>
        (section.itemRefs.includes(`decision:${d.id}`) || AreaRegistry.normalize(d.area) === section.id) &&
        (d.status === 'candidate' || d.status === 'confirmed' || d.status === 'locked')
    );

    const items: OverviewItemView[] = sectionDecisions.map((d) => {
      const hasConflict = openConflicts.some((c) => c.decisionRefs.includes(`decision:${d.id}`));
      const isCandidate = d.status === 'candidate';

      let hasWarning = false;
      let warningReason: string | undefined;

      if (hasConflict) {
        hasWarning = true;
        warningReason = 'Decision has an active unresolved conflict';
      } else if (isCandidate) {
        hasWarning = true;
        warningReason = 'Candidate direction awaiting explicit user confirmation';
      }

      return {
        ref: `decision:${d.id}`,
        statement: d.statement,
        status: d.status as 'candidate' | 'confirmed' | 'locked',
        origin: d.origin,
        isLocked: d.status === 'locked',
        hasWarning,
        warningReason,
        evidenceRefs: d.evidenceRefs ? [...d.evidenceRefs] : undefined,
      };
    });

    // P1-5: Map active assumptions to the section matching their area or itemRefs
    const sectionAssumptions = assumptions.filter(
      (a) =>
        section.itemRefs.includes(`assumption:${a.id}`) ||
        (a.area && AreaRegistry.normalize(a.area) === section.id) ||
        (!a.area && (section.id === 'technical_boundary' || section.id === 'tech_boundary'))
    );

    const assumptionItems: OverviewItemView[] = sectionAssumptions.map((a) => ({
      ref: `assumption:${a.id}` as TypedRef,
      statement: a.statement,
      status: 'candidate' as const,
      origin: 'agent' as const,
      isLocked: false,
      hasWarning: true,
      warningReason: a.reason ? `架构假设待验证: ${a.reason}` : '架构假设待验证',
    }));

    const openGapsForSection = openGaps.filter((g) => AreaRegistry.normalize(g.area) === section.id);

    return {
      id: section.id,
      title: section.title,
      kind: section.kind,
      maturity: section.maturity,
      items: [...items, ...assumptionItems],
      hasUnresolvedGaps: openGapsForSection.length > 0,
      unresolvedGapCount: openGapsForSection.length,
    };
  });

  // Calculate overall maturity
  let overallMaturity: SectionMaturity = 'unexplored';
  if (sections.length > 0) {
    const maturities = sections.map((s) => s.maturity);
    if (maturities.every((m) => m === 'locked')) {
      overallMaturity = 'locked';
    } else if (maturities.every((m) => m === 'clear' || m === 'locked')) {
      overallMaturity = 'clear';
    } else if (maturities.some((m) => m === 'mostly-clear' || m === 'clear' || m === 'locked')) {
      overallMaturity = 'mostly-clear';
    } else if (maturities.some((m) => m === 'needs-clarification')) {
      overallMaturity = 'needs-clarification';
    }
  }

  return {
    sourceStateRevision: snapshot.metadata.stateRevision,
    projectId: snapshot.metadata.projectId,
    projectName: snapshot.metadata.name,
    projectStage: snapshot.metadata.stage,
    updatedAt: snapshot.metadata.updatedAt,
    overallMaturity,
    sections,
    totalConfirmedDecisions: totalConfirmed,
    totalLockedDecisions: totalLocked,
    totalCandidates,
  };
}
