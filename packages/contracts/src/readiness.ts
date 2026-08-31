import type { AssumptionRef } from './refs.js';

export type ReadinessStatus = 'ready' | 'ready-with-warnings' | 'not-ready';

export type UserDisposition =
  | 'pending'
  | 'return-to-discovery'
  | 'approved'
  | 'approved-with-warnings'
  | 'approved-with-known-issues'
  | 'approved-with-critical-conflicts';

import { CORE_DISCOVERY_AREA_IDS, type CoreDiscoveryAreaId } from './areas.js';

export const CANONICAL_B3_AREAS = CORE_DISCOVERY_AREA_IDS;

export type CanonicalB3Area = CoreDiscoveryAreaId;

export interface ReadinessCoverageMetric {
  total: number;
  satisfied: number;
  ratio: number;
}

export interface ReadinessSnapshot {
  id: string;
  status: ReadinessStatus;
  reviewedAt: string;                // ISO 8601
  basisRevision: number;             // State revision this evaluation is based on
  requiredAreas: string[];
  warnings: string[];
  issues: string[];
  assumptionRefs: AssumptionRef[];
  knownIssueAcknowledgements: string[];
  criticalConflictAcknowledgements: string[];
  userDisposition: UserDisposition;
  coverage?: ReadinessCoverageMetric;
  credibilityScore?: number;         // 0 - 100
}

export interface ReadinessState {
  schemaVersion: number;
  projectId: string;
  current: ReadinessSnapshot;
  history: ReadinessSnapshot[];
  updatedAt: string;                // ISO 8601
}
