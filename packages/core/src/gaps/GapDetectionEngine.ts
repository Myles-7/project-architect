import { AreaRegistry } from '../areas/AreaRegistry.js';
import type {
  ProjectSnapshot,
  MergedChecklistHint,
  DiscoveryResult,
  GapItem,
  GapPriorityFactors,
  SeverityLevel,
} from '@project-architect/contracts';

/**
 * Product-first importance is intentionally only one input. The local engine
 * combines it with the factors that make a missing decision costly to defer.
 */
const AREA_IMPORTANCE: Record<string, number> = {
  project_overview: 7,
  target_user: 6,
  user_flows: 5,
  core_features: 5,
  mvp_scope: 4,
  technical_boundary: 3,
  ux_ui_direction: 2,
  page_structure: 2,
  delivery_plan: 1,
};

const LEVEL_SCORE: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class GapDetectionEngine {
  /**
   * Detects, fuses, deduplicates and prioritizes product gaps by combining:
   * 1. Universal & Project-Type Checklist Hints (Static baseline)
   * 2. LLM Discovery Results (Dynamic discovery)
   * 3. Current Project State & Overview maturity (Filter satisfied areas)
   */
  detectAndPrioritizeGaps(
    snapshot: ProjectSnapshot,
    checklistHints: MergedChecklistHint[],
    discoveryResult?: DiscoveryResult
  ): GapItem[] {
    const existingGaps = snapshot.gaps.gaps;
    const confirmedDecisions = snapshot.decisions.items.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );

    // Identify areas that are clear or locked in Overview
    const clearOrLockedAreas = new Set<string>();
    const lockedAreas = new Set<string>();
    for (const section of snapshot.overview.sections) {
      const normSectionId = this.normalizeArea(section.id);
      if (section.maturity === 'clear' || section.maturity === 'locked') {
        clearOrLockedAreas.add(normSectionId);
      }
      if (section.maturity === 'locked') {
        lockedAreas.add(normSectionId);
      }
    }

    const confirmedDecisionKeys = new Set(
      confirmedDecisions
        .filter((d) => d.decisionKey)
        .map((d) => this.normalizeDecisionKey(d.decisionKey!))
    );

    const answeredQuestionKeys = new Set(
      snapshot.questions.items
        .filter((q) => q.status === 'answered' || q.status === 'dismissed')
        .flatMap((q) => [
          ...(q.decisionKey ? [this.normalizeDecisionKey(q.decisionKey)] : []),
          ...(q.issueRef ? [this.normalizeDecisionKey(q.issueRef.replace(/^gap:/, ''))] : []),
        ])
    );

    const candidateGapsMap = new Map<string, GapItem>();

    // 1. Ingest AI-discovered Gaps (Highest semantic richness)
    if (discoveryResult?.gaps) {
      for (const aiGap of discoveryResult.gaps) {
        const normArea = this.normalizeArea(aiGap.area);
        const decisionKey = this.normalizeDecisionKey(aiGap.decision_key || `${normArea}:${aiGap.reason}`);

        if (this.isDecisionKeySatisfied(decisionKey, normArea, lockedAreas, confirmedDecisionKeys, answeredQuestionKeys)) {
          continue;
        }

        // Avoid repetitive basic target_user question if user already provided specific audience evidence
        if (normArea === 'target_user' && this.hasSpecificTargetUserEvidence(snapshot)) {
          continue;
        }

        const gapId = `gap-ai-${normArea}-${Date.now().toString(36).slice(-4)}`;
        candidateGapsMap.set(decisionKey, {
          id: gapId,
          area: normArea,
          decisionKey,
          dependsOn: (aiGap.depends_on || []).map((value) => this.normalizeDecisionKey(value)),
          severity: aiGap.severity || 'high',
          reason: aiGap.reason,
          impact: aiGap.impact,
          shouldAskUser: aiGap.should_ask_user ?? true,
          status: 'open',
          source: 'ai',
          uncertainty: 'high',
          stageRelevance: snapshot.metadata.stage,
        });
      }
    }

    // 2. Ingest Checklist Hints (Safety net for missing core areas)
    for (const hint of checklistHints) {
      const normArea = this.normalizeArea(hint.area);
      if (clearOrLockedAreas.has(normArea)) {
        continue;
      }
      if (normArea === 'target_user' && this.hasSpecificTargetUserEvidence(snapshot)) {
        continue;
      }
      const hasDecisionInArea = confirmedDecisions.some((d) => this.normalizeArea(d.area) === normArea);
      if (hasDecisionInArea) {
        continue;
      }
      const checklistKey = this.normalizeDecisionKey(`checklist:${hint.id}`);

      if (this.isDecisionKeySatisfied(checklistKey, normArea, lockedAreas, confirmedDecisionKeys, answeredQuestionKeys)) {
        continue;
      }

      // Check if specific checklist criterion is already satisfied by decision key or area evidence
      const hasSpecificDecision = confirmedDecisions.some((d) =>
        d.decisionKey && this.normalizeDecisionKey(d.decisionKey) === checklistKey
      );

      if (!hasSpecificDecision) {
        const existingCandidate = [...candidateGapsMap.values()].find((gap) => gap.area === normArea);
        if (!existingCandidate) {
          const gapId = `gap-chk-${normArea}-${hint.id.replace(/^chk-/, '')}`;
          candidateGapsMap.set(checklistKey, {
            id: gapId,
            area: normArea,
            decisionKey: checklistKey,
            dependsOn: [],
            severity: hint.importance === 'critical' ? 'critical' : hint.importance === 'high' ? 'high' : 'medium',
            reason: `Checklist 标准检查项尚未明确：${hint.criterion}`,
            impact: `影响 ${normArea} 的完整度闭环。`,
            shouldAskUser: hint.importance === 'critical' || hint.importance === 'high',
            status: 'open',
            source: 'checklist',
            uncertainty: 'high',
            stageRelevance: snapshot.metadata.stage,
          });
        } else {
          // Merge checklist insight into AI gap if checklist has higher severity
          const hintSevScore = LEVEL_SCORE[hint.importance === 'critical' ? 'critical' : hint.importance === 'high' ? 'high' : 'medium'];
          const aiSevScore = LEVEL_SCORE[existingCandidate.severity];
          if (hintSevScore > aiSevScore) {
            existingCandidate.severity = hint.importance === 'critical' ? 'critical' : 'high';
          }
        }
      }
    }

    // 3. Merge with existing open gaps in state that are not yet satisfied
    for (const oldGap of existingGaps) {
      if (oldGap.status === 'open') {
        const normArea = this.normalizeArea(oldGap.area);
        if (normArea === 'target_user' && this.hasSpecificTargetUserEvidence(snapshot)) {
          continue;
        }
        if (clearOrLockedAreas.has(normArea) && oldGap.source === 'checklist') {
          continue;
        }
        const decisionKey = this.normalizeDecisionKey(oldGap.decisionKey || `${normArea}:${oldGap.id}`);
        if (!this.isDecisionKeySatisfied(decisionKey, normArea, lockedAreas, confirmedDecisionKeys, answeredQuestionKeys)) {
          if (!candidateGapsMap.has(decisionKey)) {
            candidateGapsMap.set(decisionKey, { ...oldGap, decisionKey, dependsOn: oldGap.dependsOn || [] });
          }
        }
      }
    }

    return this.prioritizeGaps(Array.from(candidateGapsMap.values()), snapshot.metadata.stage);
  }

  private normalizeDecisionKey(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9_:-]+/g, '_');
  }

  /**
   * Applies a deliberately small, explainable priority model. Product
   * importance keeps Discovery product-first; impact, uncertainty,
   * dependency, irreversibility, and stage relevance decide urgency within
   * that boundary. This is deterministic local intelligence, not an AI claim.
   */
  calculatePriorityScore(gap: GapItem, stage?: ProjectSnapshot['metadata']['stage']): number {
    const normArea = this.normalizeArea(gap.area);
    const factors = this.resolvePriorityFactors(gap, stage);
    return (
      (AREA_IMPORTANCE[normArea] ?? 2) * 3 +
      LEVEL_SCORE[gap.severity] * 3 +
      LEVEL_SCORE[factors.impact] * 6 +
      LEVEL_SCORE[factors.uncertainty] * 3 +
      LEVEL_SCORE[factors.dependency] * 3 +
      LEVEL_SCORE[factors.irreversibility] * 4 +
      LEVEL_SCORE[factors.stageRelevance] * 4 +
      this.evidenceSpecificityBonus(gap) +
      this.criticalSafetyBonus(normArea, gap)
    );
  }

  /** Adds persisted priority metadata and returns a stable highest-first order. */
  prioritizeGaps(
    gaps: GapItem[],
    stage?: ProjectSnapshot['metadata']['stage']
  ): GapItem[] {
    return gaps
      .map((gap) => {
        const priorityFactors = this.resolvePriorityFactors(gap, stage);
        const priorityScore = this.calculatePriorityScore({ ...gap, priorityFactors }, stage);
        return {
          ...gap,
          priorityFactors,
          priorityScore,
          priority: this.priorityBand(priorityScore),
        };
      })
      .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  }

  private resolvePriorityFactors(
    gap: GapItem,
    stage?: ProjectSnapshot['metadata']['stage']
  ): GapPriorityFactors {
    if (gap.priorityFactors) return gap.priorityFactors;

    const severityDefault = gap.severity;
    return {
      impact: this.parseLevel(gap.impact) ?? severityDefault,
      uncertainty: this.parseLevel(gap.uncertainty) ?? this.defaultUncertainty(severityDefault),
      dependency: this.parseLevel(gap.dependency) ?? (gap.dependency === 'none' ? 'low' : 'high'),
      irreversibility: severityDefault === 'critical' || severityDefault === 'high' ? 'high' : severityDefault,
      stageRelevance: this.parseLevel(gap.stageRelevance) ?? this.defaultStageRelevance(gap.area, stage),
    };
  }

  private priorityBand(score: number): SeverityLevel {
    if (score >= 85) return 'critical';
    if (score >= 65) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }

  private defaultUncertainty(severity: SeverityLevel): SeverityLevel {
    if (severity === 'critical') return 'high';
    return severity;
  }

  private defaultStageRelevance(
    area: string,
    stage?: ProjectSnapshot['metadata']['stage']
  ): SeverityLevel {
    const normalizedArea = this.normalizeArea(area);
    const earlyStage = stage === undefined || stage === 'created' || stage === 'initial-analysis' || stage === 'broad-pass';
    if (earlyStage) {
      return ['product_identity', 'target_user', 'user_flows', 'mvp_scope'].includes(normalizedArea)
        ? 'high'
        : normalizedArea === 'technical_boundary'
          ? 'low'
          : 'medium';
    }
    if (stage === 'readiness-review') {
      return ['mvp_scope', 'user_flows', 'trust_safety'].includes(normalizedArea) ? 'high' : 'medium';
    }
    return normalizedArea === 'technical_boundary' ? 'medium' : 'high';
  }

  private parseLevel(value?: string): SeverityLevel | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase().trim();
    return normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical'
      ? normalized
      : undefined;
  }

  /** A critical trust/safety blocker must be arbitrated before normal discovery refinement. */
  private criticalSafetyBonus(area: string, gap: GapItem): number {
    return area === 'trust_safety' && gap.severity === 'critical' ? 16 : 0;
  }

  /** A concrete Agent-discovered gap can break a tie with a generic checklist safety net. */
  private evidenceSpecificityBonus(gap: GapItem): number {
    return gap.source === 'ai' ? 4 : 0;
  }

  private isDecisionKeySatisfied(
    decisionKey: string,
    area: string,
    lockedAreas: Set<string>,
    confirmedDecisionKeys: Set<string>,
    answeredQuestionKeys: Set<string>,
  ): boolean {
    if (lockedAreas.has(area)) return true;
    const normKey = this.normalizeDecisionKey(decisionKey);
    return confirmedDecisionKeys.has(normKey) || answeredQuestionKeys.has(normKey);
  }

  /**
   * For the initial free-form idea or early stage, use a
   * small lexical check to avoid asking a redundant generic target-user question
   * if the user has already explicitly defined specific audience boundaries.
   */
  private hasSpecificTargetUserEvidence(snapshot: ProjectSnapshot): boolean {
    const userEvidence = snapshot.decisions.items
      .filter((decision) => decision.origin === 'user' && (decision.status === 'confirmed' || decision.status === 'locked'))
      .map((decision) => decision.statement.toLowerCase())
      .join(' ');
    if (!userEvidence) return false;
    const groupMentioned = /用户|学生|开发者|团队|家长|儿童|企业|商家|情侣|两个人|二人|customer|student|developer|team|parent|child|business|couple/.test(userEvidence);
    const audienceIsSpecific = /考研|中国|独立|个人|专业|初学|全职|高校|企业级|小白|专属|私密|两口子|beginner|independent|professional|enterprise|full.?time|private/.test(userEvidence);
    return groupMentioned && audienceIsSpecific;
  }

  /**
   * Normalizes area strings to standard categories.
   */
  private normalizeArea(area: string): string {
    return AreaRegistry.normalize(area);
  }
}
