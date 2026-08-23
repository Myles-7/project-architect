import type { DecisionRef } from './refs.js';

export type AssumptionStatus = 'active' | 'replaced' | 'converted' | 'removed';

export interface AssumptionItem {
  id: string;                       // e.g. "asm-01"
  statement: string;
  reason: string;
  status: AssumptionStatus;
  linkedDecisionRefs?: DecisionRef[];
  createdAt: string;                // ISO 8601
  resolvedAt?: string;              // ISO 8601
}

export interface AssumptionsState {
  schemaVersion: number;
  projectId: string;
  items: AssumptionItem[];
  updatedAt: string;                // ISO 8601
}
