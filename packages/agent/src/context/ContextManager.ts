import type {
  ProjectSnapshot,
  MergedChecklistHint,
  AppRuntimeConfig,
  AgentMode,
} from '@project-architect/contracts';
import { DEFAULT_RUNTIME_CONFIG } from '@project-architect/contracts';
import { IdeaAnalysisContext } from './profiles/IdeaAnalysisContext.js';
import { GapAnalysisContext } from './profiles/GapAnalysisContext.js';
import { QuestionContext } from './profiles/QuestionContext.js';
import { DecisionReviewContext } from './profiles/DecisionReviewContext.js';
import { ReadinessContext } from './profiles/ReadinessContext.js';
import { BaseContextProfile } from './profiles/BaseContextProfile.js';

export interface DiscoveryContextPayload {
  userMessage?: string;
  questionAnswer?: {
    questionRef: string;
    selectedOption?: string;
    freeInput?: string;
  };
  checklistHints?: MergedChecklistHint[];
  inputMaterials?: Array<{ label: string; text: string }>;
}

export class ContextManager {
  private config: AppRuntimeConfig;
  private profiles: Map<AgentMode, BaseContextProfile>;

  constructor(config: AppRuntimeConfig = DEFAULT_RUNTIME_CONFIG) {
    this.config = config;
    this.profiles = new Map<AgentMode, BaseContextProfile>([
      ['idea-analysis', new IdeaAnalysisContext(config)],
      ['gap-analysis', new GapAnalysisContext(config)],
      ['question-generation', new QuestionContext(config)],
      ['decision-review', new DecisionReviewContext(config)],
      ['readiness-review', new ReadinessContext(config)],
      ['document-compile', new ReadinessContext(config)],
    ]);
  }

  getConfig(): AppRuntimeConfig {
    return this.config;
  }

  /**
   * Assembles a compact, high-relevance Markdown text context for a specific AgentMode.
   */
  buildContextForMode(
    mode: AgentMode,
    snapshot: ProjectSnapshot,
    payload: DiscoveryContextPayload
  ): string {
    const profile = this.profiles.get(mode) || this.profiles.get('gap-analysis')!;
    return profile.build(snapshot, payload);
  }

  /**
   * Backwards-compatible discovery context builder.
   */
  buildDiscoveryContext(
    snapshot: ProjectSnapshot,
    payload: DiscoveryContextPayload,
    mode?: AgentMode
  ): string {
    const selectedMode = mode || (payload.questionAnswer ? 'question-generation' : 'gap-analysis');
    return this.buildContextForMode(selectedMode, snapshot, payload);
  }

  /**
   * Computes a structured Token & Context budget distribution breakdown for diagnostics.
   */
  getContextDiagnostics(
    snapshot: ProjectSnapshot,
    inputMaterials: Array<{ id: string; label: string; text: string; isExcluded?: boolean }> = []
  ): import('@project-architect/contracts').ContextDiagnosticsView {
    const breakdown: import('@project-architect/contracts').ContextItemTokenUsage[] = [];

    // 1. System schema and constitution base token budget
    const systemBaseTokens = 2400;
    breakdown.push({
      id: 'system-constitution',
      label: 'B3 宪法与自适应推演 Schema 规范',
      kind: 'system',
      estimatedTokens: systemBaseTokens,
      percentage: 0,
    });

    // 2. Confirmed and locked decisions
    const confirmedCount = (snapshot.decisions?.items || []).filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    );
    const decisionChars = confirmedCount.reduce((acc, d) => acc + d.statement.length + (d.rationale?.length || 0), 0);
    const decisionTokens = Math.max(100, Math.ceil(decisionChars / 3.5));
    breakdown.push({
      id: 'confirmed-decisions',
      label: `已确立决策与锁定边界 (${confirmedCount.length} 项)`,
      kind: 'decision',
      estimatedTokens: decisionTokens,
      percentage: 0,
    });

    // 3. Active assumptions
    const activeAssumptions = (snapshot.assumptions?.items || []).filter((a) => a.status === 'active');
    const assumptionChars = activeAssumptions.reduce((acc, a) => acc + a.statement.length, 0);
    const assumptionTokens = Math.max(50, Math.ceil(assumptionChars / 3.5));
    breakdown.push({
      id: 'active-assumptions',
      label: `活跃低风险技术假设 (${activeAssumptions.length} 项)`,
      kind: 'assumption',
      estimatedTokens: assumptionTokens,
      percentage: 0,
    });

    // 4. Input materials
    for (const mat of inputMaterials) {
      const matTokens = Math.ceil((mat.text || '').length / 3.5);
      const rawId = (mat.id || '').replace(/^input:/, '');
      const safeId = rawId && rawId !== '[object Object]' && !rawId.includes('[object Object]')
        ? rawId
        : `inp-${Math.random().toString(36).slice(2, 8)}`;

      let safeLabel = mat.label || `附件材料 (${safeId})`;
      if (safeLabel.includes('[object Object]')) {
        safeLabel = `附件材料 (${safeId})`;
      }
      const label = safeLabel.startsWith('材料:') ? safeLabel : `材料: ${safeLabel}`;

      breakdown.push({
        id: `input-${safeId}`,
        label,
        kind: 'input',
        estimatedTokens: matTokens,
        percentage: 0,
        isExcluded: Boolean(mat.isExcluded),
      });
    }

    // Calculate total active tokens (excluded items do not consume context budget)
    const activeItems = breakdown.filter((item) => !item.isExcluded);
    const totalEstimatedTokens = activeItems.reduce((acc, item) => acc + item.estimatedTokens, 0);
    const contextLimitTokens = 128000;

    for (const item of breakdown) {
      if (item.isExcluded) {
        item.percentage = 0;
      } else {
        item.percentage = totalEstimatedTokens > 0
          ? Number(((item.estimatedTokens / totalEstimatedTokens) * 100).toFixed(1))
          : 0;
      }
    }

    return {
      projectId: snapshot.metadata.projectId,
      sourceStateRevision: snapshot.metadata.stateRevision,
      totalEstimatedTokens,
      contextLimitTokens,
      tokenUtilizationPercent: Number(((totalEstimatedTokens / contextLimitTokens) * 100).toFixed(2)),
      breakdown,
    };
  }
}
