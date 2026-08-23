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
}
