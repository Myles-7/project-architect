import type { ProjectSnapshot } from '@project-architect/contracts';
import { AreaRegistry } from '../areas/AreaRegistry.js';
import { classifyInput, emptyPlanningState } from '../planning/PlanningState.js';

export interface MigrationDiagnostics {
  normalizedAreas: number;
  unknownAreas: string[];
  legacySchemaFiles: string[];
}

export class ProjectStateMigration {
  static normalizeDecisionKey(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9_:-]+/g, '_');
  }

  /** Shared additive loaded-record rules, without material I/O or persistence. Mutates only the supplied projection. */
  static normalizeLoadedRecords(
    snapshot: Pick<ProjectSnapshot, 'metadata' | 'decisions' | 'gaps' | 'questions' | 'planning'>,
    legacyPlanningLedger = !snapshot.planning,
  ): void {
    const { metadata, decisions, gaps, questions } = snapshot;
    const planning = snapshot.planning ??= emptyPlanningState();
    decisions.traces ??= [];
    gaps.schemaVersion = 2;
    for (const gap of gaps.gaps) {
      gap.decisionKey ??= this.normalizeDecisionKey(`${gap.area}:${gap.id}`);
      const legacyDependency = gap.dependency && gap.dependency.toLowerCase() !== 'none'
        ? [gap.dependency]
        : [];
      gap.dependsOn ??= legacyDependency.map(value => this.normalizeDecisionKey(value));
    }
    questions.schemaVersion = 2;
    for (const question of questions.items) {
      const linkedGapId = question.issueRef.startsWith('gap:') ? question.issueRef.slice(4) : undefined;
      const linkedGap = linkedGapId ? gaps.gaps.find(gap => gap.id === linkedGapId) : undefined;
      question.decisionKey ??= linkedGap?.decisionKey || this.normalizeDecisionKey(`legacy:${question.id}`);
      question.dependsOn ??= linkedGap?.dependsOn || [];
      question.batchId ??= 'legacy';
      question.batchStage ??= 'legacy';
      question.basisRevision ??= metadata.stateRevision;
    }
    for (const topic of planning.topics) if (!decisions.items.some(d => d.id === topic.effectiveDecisionId && ['confirmed','locked'].includes(d.status))) topic.effectiveDecisionId = undefined;
    for (const decision of decisions.items) {
      decision.evidenceRefs ??= [];
      const linked = decision.evidenceRefs.map(ref => questions.items.find(q => ref === `question:${q.id}`)).find(Boolean);
      decision.decisionKey ??= linked?.decisionKey;
      if (legacyPlanningLedger && !decision.decisionKey && ['confirmed','locked'].includes(decision.status)) {
        const warning = `旧决定 ${decision.id} 缺少明确的问题或决策键关联，暂时保留原记录，需审阅后确认主题。`;
        if (!planning.diagnostics.includes(warning)) planning.diagnostics.push(warning);
      }
      if (decision.decisionKey) {
        let topic = planning.topics.find(t => t.key === decision.decisionKey);
        if (!topic) planning.topics.push(topic = { key: decision.decisionKey, aliases: [], history: [] });
        if (!topic.history.includes(decision.id)) topic.history.push(decision.id);
        if (decision.status === 'confirmed' || decision.status === 'locked') {
          const existing = decisions.items.find(d => d.id === topic!.effectiveDecisionId);
          if (existing && existing.id !== decision.id) {
            const warning = `主题 ${topic.key} 有多个有效旧决定，需审阅合并。`;
            if (!planning.diagnostics.includes(warning)) planning.diagnostics.push(warning);
          }
          if (existing?.status !== 'locked' || decision.status === 'locked') topic.effectiveDecisionId = decision.id;
        }
      }
      if (!decision.approvalSource && ['question','uncertainty','delegation'].includes(classifyInput(decision.statement)) && ['confirmed','locked'].includes(decision.status)) {
        const warning = `旧决定 ${decision.id} 可能把问题、委托或不确定表达当作事实，需审阅后清理。`;
        if (!planning.diagnostics.includes(warning)) planning.diagnostics.push(warning);
      }
    }
  }

  /**
   * Performs non-destructive in-memory normalization of legacy or alias area IDs.
   * Locked decisions only have their area normalized without changing statement, status, or evidence.
   */
  static migrateInMemory(snapshot: ProjectSnapshot): {
    snapshot: ProjectSnapshot;
    diagnostics: MigrationDiagnostics;
  } {
    const diagnostics: MigrationDiagnostics = {
      normalizedAreas: 0,
      unknownAreas: [],
      legacySchemaFiles: [],
    };

    const unknownSet = new Set<string>();

    // 1. Migrate Decisions
    if (snapshot.decisions?.items) {
      for (const d of snapshot.decisions.items) {
        const resolved = AreaRegistry.resolve(d.area);
        if (resolved.area !== d.area || resolved.isUnknown) {
          diagnostics.normalizedAreas++;
          if (resolved.isUnknown && d.area) {
            unknownSet.add(d.area);
          }
          if (!d.sourceArea && (resolved.sourceArea || resolved.isUnknown)) {
            d.sourceArea = resolved.sourceArea || d.area;
          }
          d.area = resolved.area;
        }
      }
    }

    // 2. Migrate Gaps
    if (snapshot.gaps?.gaps) {
      for (const g of snapshot.gaps.gaps) {
        const resolved = AreaRegistry.resolve(g.area);
        if (resolved.area !== g.area || resolved.isUnknown) {
          diagnostics.normalizedAreas++;
          if (resolved.isUnknown && g.area) {
            unknownSet.add(g.area);
          }
          if (!(g as any).sourceArea && (resolved.sourceArea || resolved.isUnknown)) {
            (g as any).sourceArea = resolved.sourceArea || g.area;
          }
          g.area = resolved.area;
        }
      }
    }

    // 3. Migrate Overview Sections
    if (snapshot.overview?.sections) {
      for (const sec of snapshot.overview.sections) {
        const resolved = AreaRegistry.resolve(sec.id);
        if (resolved.area !== sec.id) {
          sec.id = resolved.area;
          sec.title = AreaRegistry.getTitle(resolved.area);
        }
      }
    }

    diagnostics.unknownAreas = Array.from(unknownSet);
    return { snapshot, diagnostics };
  }
}
