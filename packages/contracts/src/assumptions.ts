import type { DecisionRef } from './refs.js';

export type AssumptionStatus = 'active' | 'replaced' | 'converted' | 'resolved' | 'removed';

export interface AssumptionItem {
  id: string;                       // e.g. "asm-01"
  area?: string;                    // Target architecture/product area
  decisionKey?: string;             // Topic key from B3 Discovery
  statement: string;
  reason: string;
  status: AssumptionStatus;
  linkedDecisionRefs?: DecisionRef[];
  resolvedDecisionRef?: DecisionRef; // Confirmed decision created from this assumption
  createdAt: string;                // ISO 8601
  resolvedAt?: string;              // ISO 8601
}

export interface AssumptionsState {
  schemaVersion: number;
  projectId: string;
  items: AssumptionItem[];
  updatedAt: string;                // ISO 8601
}
