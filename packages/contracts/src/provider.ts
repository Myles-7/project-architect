import type { QuestionImportance } from './questions.js';
import type { SeverityLevel } from './gaps.js';

export type TaskMode = 'discovery-turn' | 'readiness-review' | 'document-plan' | 'planning-task';

/**
 * Product-level capability used for local prompt/context selection. PlanningRuntime
 * registers and schedules every provider invocation separately.
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
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Isolated task workspace; never the authoritative project-state directory. */
  cwd?: string;
  /** Append-only stream record owned by the registered task. */
  logPath?: string;
  /** Explicit MCP tool names for the confined planning-worker profile. */
  allowedTools?: string[];
  /** Allows local background jobs to stop a no-longer-relevant provider run. */
  abortSignal?: AbortSignal;
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

import type { CandidateSuggestion, AssumptionSuggestion, RiskSuggestion } from './discovery.js';

/**
 * Active structure produced by b3-discovery.schema.json in discovery-turn.
 */
export interface DiscoveryResult {
  confirmed: string[];
  candidates: CandidateSuggestion[];
  assumptions: AssumptionSuggestion[];
  unknowns: string[];
  risks: RiskSuggestion[];
  conflicts: string[];
  tensions: Array<{
    description: string;
    reason: string;
  }>;
  gaps: Array<{
    decision_key: string;
    depends_on: string[];
    area: string;
    severity: SeverityLevel;
    reason: string;
    impact: string;
    should_ask_user: boolean;
  }>;
  questions: Array<{
    decision_key: string;
    depends_on: string[];
    importance: QuestionImportance;
    question: string;
    reason: string;
    recommendation: string;
    recommendation_reason: string;
    recommended_option_key: string;
    options: Array<{
      key: string;
      label: string;
      impact: string;
      tradeoffs?: string;
      reversibility?: 'easy' | 'moderate' | 'hard';
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

export interface ProviderHealthView {
  status: 'ready' | 'degraded' | 'unavailable';
  providerName: string;
  modelName?: string;
  inferenceLocation: 'local' | 'remote' | 'unknown';
  sendsProjectContextOffDevice: boolean | 'unknown';
  structuredOutput: 'supported' | 'unsupported' | 'unknown';
  promptCache: 'supported' | 'observed' | 'unsupported' | 'unknown';
  checkedAt: string;
  executable?: string;
  lastSuccessAt?: string;
  lastFailureCode?: string;
  guidance?: string;
}
