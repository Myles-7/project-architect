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
  // 1. Product Identity & Core Problem
  product_identity: 7,
  core_problem: 7,
  product_vision: 7,
  project_overview: 7,

  // 2. Target User
  target_user: 6,
  user_persona: 6,

  // 3. Core Workflow
  user_flows: 5,
  user_flow: 5,
  primary_flow: 5,
  core_features: 5,

  // 4. MVP Scope
  mvp_scope: 4,
  scope_boundary: 4,

  // 5. Trust / Safety / Data Ownership
  trust_safety: 3,
  data_security: 3,
  data_ownership: 3,
  privacy: 3,

  // 6. UX / UI Tradeoff
  ux_ui: 2,
  ux_ui_direction: 2,
  page_structure: 2,

  // 7. Technical Constraint (Platform / Runtime)
  technical_boundary: 1,
  platform: 1,
  platform_lifecycle: 1,
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

    // Identify areas that are already clear or locked in Overview
    const clearAreas = new Set<string>();
    for (const section of snapshot.overview.sections) {
      if (section.maturity === 'clear' || section.maturity === 'locked') {
        clearAreas.add(section.id);
      }
    }
    const confirmedAreas = new Set(
      confirmedDecisions
        .filter((decision) => decision.origin === 'user')
        .map((decision) => this.normalizeArea(decision.area))
    );

    const candidateGapsMap = new Map<string, GapItem>();

    // 1. Ingest AI-discovered Gaps (Highest semantic richness)
    if (discoveryResult?.gaps) {
      for (const aiGap of discoveryResult.gaps) {
        if (this.isAreaCoveredByUserEvidence(snapshot, this.normalizeArea(aiGap.area), clearAreas, confirmedAreas)) {
          // Area is already closed by confirmed/locked decisions
          continue;
        }

        const normArea = this.normalizeArea(aiGap.area);
        const gapId = `gap-ai-${normArea}-${Date.now().toString(36).slice(-4)}`;

        candidateGapsMap.set(normArea, {
          id: gapId,
          area: normArea,
          severity: aiGap.severity || 'high',
          reason: aiGap.reason,
          impact: aiGap.impact,
          dependency: aiGap.dependency || 'none',
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
      if (this.isAreaCoveredByUserEvidence(snapshot, normArea, clearAreas, confirmedAreas)) {
        continue;
      }

      // Check if decisions already satisfy this specific checklist criterion
      const hasDecisionInArea = confirmedDecisions.some((d) => this.normalizeArea(d.area) === normArea);

      if (!hasDecisionInArea) {
        const existingCandidate = candidateGapsMap.get(normArea);
        if (!existingCandidate) {
          // Create new checklist-derived gap
          const gapId = `gap-chk-${normArea}-${hint.id.replace(/^chk-/, '')}`;
          candidateGapsMap.set(normArea, {
            id: gapId,
            area: normArea,
            severity: hint.importance === 'critical' ? 'critical' : hint.importance === 'high' ? 'high' : 'medium',
            reason: `Checklist 标准检查项尚未明确：${hint.criterion}`,
            impact: `影响 ${normArea} 的完整度闭环。`,
            dependency: 'none',
            shouldAskUser: hint.importance === 'critical' || hint.importance === 'high',
            status: 'open',
            source: 'checklist',
            uncertainty: 'high',
            stageRelevance: snapshot.metadata.stage,
          });
        } else {
          // Merge checklist insight into AI gap if AI gap was lower severity
          const hintSevScore = LEVEL_SCORE[hint.importance === 'critical' ? 'critical' : hint.importance === 'high' ? 'high' : 'medium'];
          const aiSevScore = LEVEL_SCORE[existingCandidate.severity];
          if (hintSevScore > aiSevScore) {
            existingCandidate.severity = hint.importance === 'critical' ? 'critical' : 'high';
          }
        }
      }
    }

    // 3. Merge with existing open gaps in state
    for (const oldGap of existingGaps) {
      if (oldGap.status === 'open' && !this.isAreaCoveredByUserEvidence(snapshot, this.normalizeArea(oldGap.area), clearAreas, confirmedAreas)) {
        const normArea = this.normalizeArea(oldGap.area);
        if (!candidateGapsMap.has(normArea)) {
          candidateGapsMap.set(normArea, oldGap);
        }
      }
    }

    return this.prioritizeGaps(Array.from(candidateGapsMap.values()), snapshot.metadata.stage);
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

  /**
   * Only user-origin facts close a gap. For the initial free-form idea, use a
   * small lexical check to avoid asking a target-user question the user has
   * already explicitly answered in that same input.
   */
  private isAreaCoveredByUserEvidence(
    snapshot: ProjectSnapshot,
    area: string,
    clearAreas: Set<string>,
    confirmedAreas: Set<string>,
  ): boolean {
    if (clearAreas.has(area) || confirmedAreas.has(area)) return true;
    if (area !== 'target_user') return false;
    const userEvidence = snapshot.decisions.items
      .filter((decision) => decision.origin === 'user' && (decision.status === 'confirmed' || decision.status === 'locked'))
      .map((decision) => decision.statement.toLowerCase())
      .join(' ');
    const groupMentioned = /用户|学生|开发者|团队|家长|儿童|企业|商家|customer|student|developer|team|parent|child|business/.test(userEvidence);
    const audienceIsSpecific = /考研|中国|独立|个人|专业|初学|全职|高校|企业级|小白|beginner|independent|professional|enterprise|full.?time/.test(userEvidence);
    return groupMentioned && audienceIsSpecific;
  }

  /**
   * Normalizes area strings to standard categories.
   */
  private normalizeArea(area: string): string {
    const clean = area.toLowerCase().trim().replace(/[-\s]+/g, '_');
    if (clean.includes('tech') || clean.includes('platform') || clean.includes('runtime')) {
      return 'technical_boundary';
    }
    if (clean.includes('target') || clean.includes('persona') || (clean.includes('user') && !clean.includes('flow'))) {
      return 'target_user';
    }
    if (clean.includes('flow') || clean.includes('journey') || clean.includes('feature')) {
      return 'user_flows';
    }
    if (clean.includes('mvp') || clean.includes('scope')) {
      return 'mvp_scope';
    }
    if (clean.includes('security') || clean.includes('privacy') || clean.includes('trust') || clean.includes('ownership')) {
      return 'trust_safety';
    }
    if (clean.includes('ux') || clean.includes('ui') || clean.includes('page')) {
      return 'ux_ui';
    }
    if (clean.includes('overview') || clean.includes('vision') || clean.includes('identity') || clean.includes('problem')) {
      return 'product_identity';
    }
    return clean;
  }
}
