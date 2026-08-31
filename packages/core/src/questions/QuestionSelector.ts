import type { GapItem, ProjectSnapshot } from '@project-architect/contracts';
import { QuestionBatchPolicy, type QuestionBatchPolicyResult } from './QuestionBatchPolicy.js';

export interface QuestionSelectionDiagnostics {
  received: number;
  selected: number;
  deferred: number;
  duplicatesDropped: number;
  invalidDependencies: number;
  dependencyCycles: number;
}

export interface QuestionSelection {
  gapsToAsk: GapItem[];
  gapsToAssume: GapItem[];
  policy: QuestionBatchPolicyResult;
  diagnostics: QuestionSelectionDiagnostics;
}

/** Deterministic arbitration layer: it selects gaps but never creates decisions or wording. */
export class QuestionSelector {
  constructor(private readonly batchPolicy = new QuestionBatchPolicy()) {}

  select(gaps: GapItem[], snapshot: ProjectSnapshot): QuestionSelection {
    const policy = this.batchPolicy.evaluate(snapshot);
    const resolvedAreas = new Set(
      snapshot.overview.sections
        .filter((section) => section.maturity === 'clear' || section.maturity === 'locked')
        .map((section) => this.normalizeArea(section.id))
    );
    const answeredKeys = new Set(
      snapshot.questions.items
        .filter((question) => question.status === 'answered' || question.status === 'dismissed')
        .map((question) => this.normalizeKey(question.decisionKey || question.id))
    );
    const handledGapRefs = new Set(
      snapshot.questions.items
        .filter((question) => question.status === 'answered' || question.status === 'dismissed')
        .map((question) => question.issueRef)
    );
    const active = gaps.filter((gap) =>
      gap.status === 'open'
      && !handledGapRefs.has(`gap:${gap.id}`)
      && !answeredKeys.has(this.gapKey(gap))
    );

    const gapsToAssume = active.filter((gap) => gap.severity === 'low');
    const askable = this.order(active.filter((gap) => gap.severity !== 'low' && gap.shouldAskUser));
    const resolvedKeys = new Set([
      ...resolvedAreas,
      ...answeredKeys,
      ...snapshot.decisions.items
        .filter((decision) => decision.status === 'confirmed' || decision.status === 'locked')
        .flatMap((decision) => [
          ...(decision.decisionKey ? [this.normalizeKey(decision.decisionKey)] : []),
          this.normalizeArea(decision.area),
        ]),
    ]);
    const activeKeys = new Set(askable.map((gap) => this.gapKey(gap)));
    const seenKeys = new Set<string>();
    let duplicatesDropped = 0;
    let invalidDependencies = 0;
    let dependencyCycles = 0;
    const eligible: GapItem[] = [];
    const dependencyGraph = new Map(askable.map((gap) => [this.gapKey(gap), this.dependencies(gap)]));

    for (const gap of askable) {
      const key = this.gapKey(gap);
      if (seenKeys.has(key)) {
        duplicatesDropped += 1;
        continue;
      }
      seenKeys.add(key);
      const unresolved = this.dependencies(gap).filter((dependency) => !resolvedKeys.has(dependency));
      if (unresolved.length > 0) {
        if (this.hasCycle(key, dependencyGraph)) dependencyCycles += 1;
        else if (unresolved.some((dependency) => !activeKeys.has(dependency))) invalidDependencies += 1;
        continue;
      }
      eligible.push(gap);
    }

    const gapsToAsk = eligible.slice(0, policy.maxQuestions);
    return {
      gapsToAsk,
      gapsToAssume,
      policy,
      diagnostics: {
        received: askable.length,
        selected: gapsToAsk.length,
        deferred: askable.length - gapsToAsk.length - duplicatesDropped,
        duplicatesDropped,
        invalidDependencies,
        dependencyCycles,
      },
    };
  }

  private order(gaps: GapItem[]): GapItem[] {
    const severityWeight: Record<GapItem['severity'], number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const areaOrder = [
      'target_user', 'mvp_scope', 'core_features', 'user_flows',
      'page_structure', 'ux_ui_direction', 'technical_boundary', 'delivery_plan',
    ];
    return [...gaps].sort((a, b) => {
      const severityDifference = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDifference) return severityDifference;
      const areaRank = (area: string) => {
        const index = areaOrder.indexOf(this.normalizeArea(area));
        return index === -1 ? areaOrder.length : index;
      };
      const areaDifference = areaRank(a.area) - areaRank(b.area);
      if (areaDifference) return areaDifference;
      const priorityDifference = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      return priorityDifference || this.gapKey(a).localeCompare(this.gapKey(b));
    });
  }

  private normalizeArea(area: string): string {
    return area.toLowerCase().trim().replace(/[-\s]+/g, '_');
  }

  private normalizeKey(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9_:-]+/g, '_');
  }

  private gapKey(gap: GapItem): string {
    return this.normalizeKey(gap.decisionKey || `${this.normalizeArea(gap.area)}:${gap.id}`);
  }

  private dependencies(gap: GapItem): string[] {
    const legacy = gap.dependency && gap.dependency.toLowerCase() !== 'none' ? [gap.dependency] : [];
    return [...new Set([...(gap.dependsOn || []), ...legacy].map((value) => this.normalizeKey(value)))];
  }

  private hasCycle(start: string, graph: Map<string, string[]>): boolean {
    const visit = (current: string, path: Set<string>): boolean => {
      if (path.has(current)) return current === start;
      const nextPath = new Set(path).add(current);
      return (graph.get(current) || []).some((next) => graph.has(next) && visit(next, nextPath));
    };
    return visit(start, new Set());
  }
}
