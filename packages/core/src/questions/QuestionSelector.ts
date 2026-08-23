import type { GapItem, ProjectSnapshot } from '@project-architect/contracts';

export interface QuestionSelection {
  gapsToAsk: GapItem[];
  gapsToAssume: GapItem[];
}

/** Deterministic arbitration layer: it selects gaps but never creates decisions or wording. */
export class QuestionSelector {
  select(gaps: GapItem[], snapshot: ProjectSnapshot): QuestionSelection {
    const resolvedAreas = new Set(
      snapshot.overview.sections
        .filter((section) => section.maturity === 'clear' || section.maturity === 'locked')
        .map((section) => this.normalizeArea(section.id))
    );
    for (const decision of snapshot.decisions.items) {
      if (decision.origin === 'user' && (decision.status === 'confirmed' || decision.status === 'locked')) {
        resolvedAreas.add(this.normalizeArea(decision.area));
      }
    }
    const handledGapRefs = new Set(
      snapshot.questions.items
        .filter((question) => question.status === 'answered' || question.status === 'dismissed')
        .map((question) => question.issueRef)
    );
    const active = gaps.filter((gap) => gap.status === 'open'
      && !resolvedAreas.has(this.normalizeArea(gap.area))
      && !handledGapRefs.has(`gap:${gap.id}`));

    const gapsToAssume = active.filter((gap) => gap.severity === 'low');
    const askable = active.filter((gap) => gap.severity !== 'low' && gap.shouldAskUser);
    const highPriority = this.order(askable.filter((gap) => gap.severity === 'critical' || gap.severity === 'high'));
    const normalPriority = this.order(askable.filter((gap) => gap.severity === 'medium'));

    if (highPriority.length > 0) {
      const primary = highPriority[0]!;
      const gapsToAsk = [primary];
      const dependency = this.findDirectDependency(primary, highPriority);
      if (dependency) gapsToAsk.push(dependency);
      return { gapsToAsk, gapsToAssume };
    }
    if (normalPriority.length === 0) return { gapsToAsk: [], gapsToAssume };

    // B2.1 freeze: normal questions remain capped at two related decisions.
    const primary = normalPriority[0]!;
    const gapsToAsk = normalPriority
      .filter((gap) => this.normalizeArea(gap.area) === this.normalizeArea(primary.area))
      .slice(0, 2);
    return { gapsToAsk, gapsToAssume };
  }

  private findDirectDependency(primary: GapItem, candidates: GapItem[]): GapItem | undefined {
    if (!primary.dependency || primary.dependency === 'none') return undefined;
    return candidates.find((candidate) => candidate.id !== primary.id
      && (candidate.id === primary.dependency || this.normalizeArea(candidate.area) === this.normalizeArea(primary.dependency)));
  }

  private order(gaps: GapItem[]): GapItem[] {
    const severityWeight: Record<GapItem['severity'], number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...gaps].sort((a, b) => {
      const priorityDifference = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      return priorityDifference || severityWeight[b.severity] - severityWeight[a.severity];
    });
  }

  private normalizeArea(area: string): string {
    return area.toLowerCase().trim().replace(/[-\s]+/g, '_');
  }
}
