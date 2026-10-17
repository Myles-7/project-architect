import type { ProjectAreaId } from './areas.js';
import type { DiscoveryResult } from './provider.js';

export type DiscoveryTurnStatus =
  | 'recorded'
  | 'queued'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'stale';

export type DiscoveryIntensity = 'lite' | 'standard' | 'deep';

export type DiscoveryExecutionPhase =
  | 'context_assembly'
  | 'provider_inference'
  | 'gap_detection'
  | 'state_commit';

export type AgentRunDiagnostics = Record<string, unknown>;

export interface DiscoveryTurnRecord {
  id: string;
  projectId: string;
  inputRef?: string;
  sourceRevision: number;
  status: DiscoveryTurnStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  providerResult?: DiscoveryResult;
  acceptedRefs: string[];
  discardedCounts: Record<string, number>;
  diagnostics?: AgentRunDiagnostics;
  errorCode?: string;
}

export interface CandidateSuggestion {
  decision_key: string;
  area: ProjectAreaId;
  statement: string;
  rationale: string;
}

export interface AssumptionSuggestion {
  decision_key: string;
  area: ProjectAreaId;
  statement: string;
  reason: string;
}

export interface RiskSuggestion {
  risk_key: string;
  area: ProjectAreaId;
  statement: string;
  impact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}
