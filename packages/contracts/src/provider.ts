import type { QuestionImportance } from './questions.js';
import type { SeverityLevel } from './gaps.js';

export type TaskMode = 'discovery-turn' | 'readiness-review' | 'document-plan';

/**
 * Product-level capability requested from the single Agent. These modes guide
 * local prompt/context selection; they do not permit extra provider calls.
 */
export type AgentMode =
  | 'idea-analysis'
  | 'gap-analysis'
  | 'question-generation'
  | 'decision-review'
  | 'readiness-review'
  | 'document-compile';

export interface AIProviderRequest {
  requestId: string;
  task: TaskMode;
  mode?: AgentMode;
  promptProfile?: string;
  schemaProfile?: string;
  prompt: string;
  schemaPath: string;
  contextText: string;
  timeoutMs?: number;
}

export interface AgentRunTrace {
  id: string;
  mode: AgentMode;
  promptProfile: string;
  contextProfile: string;
  schemaProfile: string;
  startedAt: string;
  completedAt: string;
  provider: string;
  tokens: number | 'unavailable';
  durationMs: number;
  stateRevisionBefore: number;
  stateRevisionAfter: number;
  diagnostics?: Record<string, unknown>;
}

export interface ProviderUsage {
  inputTokens: number | 'unavailable';
  outputTokens: number | 'unavailable';
  thinkingTokens: number | 'unavailable';
  totalTokens: number | 'unavailable';
  cacheReadTokens: number | 'unavailable';
}

export interface StructuredResult<T = unknown> {
  status: 'success' | 'failed' | 'timed-out' | 'cancelled';
  structuredSuccess: boolean;
  structuredOutput: T | null;
  rawEnvelope: unknown;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number;
  usage: ProviderUsage;
  provider: string;
}

/**
 * Exact structure produced by b2-unified.schema.json in discovery-turn
 */
export interface DiscoveryResult {
  confirmed: string[];
  candidates: string[];
  assumptions: string[];
  unknowns: string[];
  risks: string[];
  conflicts: string[];
  tensions: Array<{
    description: string;
    reason: string;
  }>;
  gaps: Array<{
    area: string;
    severity: SeverityLevel;
    reason: string;
    impact: string;
    dependency: string;
    should_ask_user: boolean;
  }>;
  questions: Array<{
    importance: QuestionImportance;
    question: string;
    reason: string;
    recommendation: string;
    recommendation_reason: string;
    options: Array<{
      label: string;
      impact: string;
    }>;
    allow_free_input: boolean;
  }>;
}

export interface ReadinessReviewResult {
  status: 'ready' | 'ready-with-warnings' | 'not-ready';
  warnings: string[];
  issues: string[];
  assumptions: string[];
  missing_areas: string[];
  recommended_next_action: string;
}

export interface DocumentPlanResult {
  document_plan: {
    core_documents: string[];
    specialty_documents: string[];
    source_mapping: Record<string, string[]>;
  };
  coverage_warnings: string[];
  unresolved_markers: string[];
}
