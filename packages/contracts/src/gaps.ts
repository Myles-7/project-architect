import type { TypedRef } from './refs.js';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type GapSource = 'checklist' | 'ai' | 'user' | 'system';

/**
 * Deterministic inputs used by the local Gap Priority System.
 *
 * These factors describe urgency to resolve a gap; they do not change the
 * Agent's semantic severity assessment. Keeping the two concepts separate
 * lets the system rank gaps without reinterpreting structured Agent output.
 */
export interface GapPriorityFactors {
  impact: SeverityLevel;
  uncertainty: SeverityLevel;
  dependency: SeverityLevel;
  irreversibility: SeverityLevel;
  stageRelevance: SeverityLevel;
}

export interface GapItem {
  id: string;                       // e.g. "gap-01"
  area: string;
  severity: SeverityLevel;
  reason: string;
  impact: string;
  dependency: string;
  shouldAskUser: boolean;
  status: 'open' | 'questioned' | 'addressed' | 'deferred';
  source?: GapSource;
  uncertainty?: string;
  stageRelevance?: string;
  /** Local, explainable priority inputs. New writes should always populate this. */
  priorityFactors?: GapPriorityFactors;
  /** Derived local priority band. It is never an AI-confirmed product decision. */
  priority?: SeverityLevel;
  /** Derived local score used only for stable ordering. */
  priorityScore?: number;
}

export interface ConflictItem {
  id: string;                       // e.g. "cnf-01"
  propositionA: string;
  propositionB: string;
  decisionRefs: TypedRef[];         // Must contain at least two decision/hard constraint references
  severity: SeverityLevel;
  reason: string;
  status: 'open' | 'resolved' | 'deferred';
}

export interface TensionItem {
  id: string;                       // e.g. "tns-01"
  description: string;
  reason: string;
  status: 'open' | 'addressed' | 'deferred';
}

export interface GapsState {
  schemaVersion: number;
  projectId: string;
  gaps: GapItem[];
  conflicts: ConflictItem[];
  tensions: TensionItem[];
  updatedAt: string;                // ISO 8601
}

export interface RiskItem {
  id: string;                       // e.g. "rsk-01"
  description: string;
  severity: SeverityLevel;
  impact: string;
  mitigationDirection: string;
  status: 'identified' | 'accepted' | 'mitigated' | 'deferred';
}

export interface RisksState {
  schemaVersion: number;
  projectId: string;
  items: RiskItem[];
  updatedAt: string;                // ISO 8601
}
