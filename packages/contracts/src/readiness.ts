import type { AssumptionRef } from './refs.js';

export type ReadinessStatus = 'ready' | 'ready-with-warnings' | 'not-ready';

export type UserDisposition =
  | 'pending'
  | 'return-to-discovery'
  | 'approved'
  | 'approved-with-warnings'
  | 'approved-with-known-issues'
  | 'approved-with-critical-conflicts';

export interface ReadinessSnapshot {
  id: string;
  status: ReadinessStatus;
  reviewedAt: string;                // ISO 8601
  requiredAreas: string[];
  warnings: string[];
  issues: string[];
  assumptionRefs: AssumptionRef[];
  knownIssueAcknowledgements: string[];
  criticalConflictAcknowledgements: string[];
  userDisposition: UserDisposition;
}

export interface ReadinessState {
  schemaVersion: number;
  projectId: string;
  current: ReadinessSnapshot;
  history: ReadinessSnapshot[];
  updatedAt: string;                // ISO 8601
}
