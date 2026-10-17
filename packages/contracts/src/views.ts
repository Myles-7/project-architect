/**
 * @file views.ts
 * @description Shared UI Read Model Contracts (Phase 4.9.2a).
 *
 * ARCHITECTURAL INVARIANT:
 * "Projection is derived, not persisted."
 *
 * UI View Models (Read Models) are pure, read-only projections derived from canonical
 * Project State snapshots. They:
 * 1. Must include an explicit `sourceStateRevision: number` to guarantee synchronization.
 * 2. Must link to source state items strictly via `TypedRef` (e.g. `decision:id`, `gap:id`).
 * 3. Provide presentation-ready semantics: `maturity`, `status`, `isLocked`, `hasWarning`, `isStale`, etc.
 * 4. NEVER contain a writable Project State copy.
 * 5. NEVER contain host absolute file paths, raw provider diagnostics, or internal server tokens.
 *
 * BOUNDARY RULES (Frontend Intent vs Read Model):
 * - Frontend reads Projection (Read Model).
 * - Frontend mutates state strictly by submitting Intent Requests to backend APIs (with mandatory `expectedRevision`).
 * - Backend executes mutations, commits atomic snapshots, and returns updated StateRevision with projections.
 * - Frontend NEVER locally manufactures `Confirmed`, `Locked`, or `Readiness Approval` facts.
 */

import type { TypedRef, DecisionRef, GapRef, AssumptionRef } from './refs.js';
import type { ProjectStage } from './project.js';
import type { SectionMaturity } from './overview.js';
import type { ReadinessStatus, UserDisposition, ReadinessCoverageMetric } from './readiness.js';
import type { DocumentType, DocumentStatus } from './documents.js';

// ============================================================================
// 1. Project Overview View Model
// ============================================================================

export interface OverviewItemView {
  ref: TypedRef;                     // e.g. "decision:dec-01"
  statement: string;
  status: 'candidate' | 'confirmed' | 'locked';
  origin: 'user' | 'agent';
  isLocked: boolean;
  hasWarning: boolean;
  warningReason?: string;
  evidenceRefs?: TypedRef[];
  resolvedGapRefs?: GapRef[];
}

export interface OverviewSectionView {
  id: string;                        // e.g. "target_user", "mvp_scope", "tech_boundary"
  title: string;
  kind: 'fixed' | 'dynamic';
  maturity: SectionMaturity;
  items: OverviewItemView[];
  hasUnresolvedGaps: boolean;
  unresolvedGapCount: number;
}

export interface ProjectOverviewView {
  sourceStateRevision: number;       // Explicit source version
  projectId: string;
  projectName: string;
  projectStage: ProjectStage;
  updatedAt: string;                 // ISO 8601
  overallMaturity: SectionMaturity;
  sections: OverviewSectionView[];
  totalConfirmedDecisions: number;
  totalLockedDecisions: number;
  totalCandidates: number;
}

// ============================================================================
// 2. Readiness View Model
// ============================================================================

export interface ReadinessAreaView {
  areaId: string;                    // e.g. "target_user", "mvp_scope", "tech_boundary"
  title: string;
  isSatisfied: boolean;
  statement?: string;                // Primary confirmed decision summary for this area
  evidenceStatements?: string[];     // All confirmed decision statements in this area
  activeAssumptions?: string[];      // Active assumptions associated with this area
  recommendedFix?: string;           // Recommended suggestion/statement if area is unsatisfied
  recommendedFixReason?: string;     // Rationale for the recommended fix
  decisionRef?: DecisionRef;
  blockingGapRefs: GapRef[];
}

export interface ReadinessScoreItem {
  label: string;
  score: number;
  type: 'base' | 'bonus' | 'penalty';
  description?: string;
}

export interface ReadinessIssueView {
  id: string;
  severity: 'critical' | 'high' | 'normal';
  message: string;
  targetRef?: TypedRef;
  isAcknowledged: boolean;
}

export interface ReadinessActionView {
  disposition: UserDisposition;
  label: string;
  description: string;
  enabled: boolean;
  requiredAcknowledgementRefs: string[];
  blockedReasons: string[];
}

export interface ReadinessView {
  basisRevision: number;
  currentRevision: number;
  isStale: boolean;
  coverage: ReadinessCoverageMetric;
  credibilityScore: number;
  areas: ReadinessAreaView[];
  actions: ReadinessActionView[];

  // Enhanced one-click approval & health inspection fields
  scoreBreakdown?: ReadinessScoreItem[];
  recommendedDisposition?: UserDisposition;
  canDirectlyApprove?: boolean;
  approvalBlockers?: string[];

  // Compatibility fields
  sourceStateRevision: number;       // Explicit source version
  projectId: string;
  level: 1 | 2 | 3 | 4 | 5;          // Readiness score level (Level 1 to 5)
  score: number;                     // 0 to 100
  overallScore?: number;             // SSOT alias strictly equal to score
  status: ReadinessStatus;           // 'ready' | 'ready-with-warnings' | 'not-ready'
  isReadyForDocs: boolean;
  userDisposition: UserDisposition;  // 'pending' | 'approved' | etc.
  blockingIssues: ReadinessIssueView[];
  warnings: string[];
  activeAssumptions: {
    ref: AssumptionRef;
    statement: string;
    reason?: string;
  }[];
  canGenerateDocs: boolean;          // Derived readiness gate: ready + approved + no unacknowledged criticals
}

// ============================================================================
// 3. Document List View Model
// ============================================================================

export interface DocumentItemView {
  id: string;                        // e.g. "doc-agents"
  type: DocumentType;
  title: string;
  path: string;                      // Relative safe path, e.g. "AGENTS.md", "docs/PROJECT.md"
  status: DocumentStatus;
  generatedAt: string;               // ISO 8601
  sourceRevision: number;            // Revision at which this document was generated
  isStale: boolean;                  // true if current project revision > document sourceRevision
  sizeBytes?: number;
}

export interface DocumentListView {
  sourceStateRevision: number;       // Current project revision
  projectId: string;
  hasCompiledDocs: boolean;
  compiledAt?: string;               // ISO 8601
  isManifestStale: boolean;          // true if state has advanced since compilation
  items: DocumentItemView[];
}

// ============================================================================
// 4. Timeline View Model
// ============================================================================

export type TimelineEventKind =
  | 'project_created'
  | 'discovery_turn'
  | 'decision_created'
  | 'decision_confirmed'
  | 'decision_locked'
  | 'decision_unlocked'
  | 'overview_edited'
  | 'question_answered'
  | 'gap_addressed'
  | 'input_added'
  | 'readiness_reviewed'
  | 'readiness_dispositioned'
  | 'documents_compiled'
  | 'provider_failed';

export type TimelineEventVisibility = 'user' | 'system' | 'debug';

export interface TimelineEvent {
  id: string;                        // e.g. "evt-1787450123"
  kind: TimelineEventKind;
  occurredAt: string;                // ISO 8601
  timestamp?: string;                // Backwards compatible alias for occurredAt
  sourceStateRevision: number;       // State revision associated with this event
  title: string;
  summary: string;
  actor: 'user' | 'agent' | 'system';
  relatedRefs: TypedRef[];
  visibility: TimelineEventVisibility;
  metadata?: Record<string, string | number | boolean>; // Safe scalar metadata only
}

export interface TimelineView {
  sourceStateRevision: number;       // Current project revision
  projectId: string;
  totalEvents: number;
  events: TimelineEvent[];
}

// ============================================================================
// 5. Discovery Progress View Model
// ============================================================================

export interface DiscoveryProgressView {
  sourceStateRevision: number;
  projectId: string;
  blockingDecisionCount: number;
  openGapCount: number;
  deferredGapCount: number;
  activeBatchQuestionCount: number;
  answeredBatchQuestionCount: number;
  dismissedBatchQuestionCount: number;
  remainingBatchQuestionCount: number;
  canGenerateNextBatch: boolean;
  nextAction: 'answer' | 'dismiss' | 'organize' | 'review-readiness';
}

// ============================================================================
// 6. Context Diagnostics View Model
// ============================================================================

export interface ContextItemTokenUsage {
  id: string;
  label: string;
  kind: 'decision' | 'input' | 'assumption' | 'question' | 'system';
  estimatedTokens: number;
  percentage: number;
  isExcluded?: boolean;
}

export interface ContextDiagnosticsView {
  projectId: string;
  sourceStateRevision: number;
  totalEstimatedTokens: number;
  contextLimitTokens: number;
  tokenUtilizationPercent: number;
  breakdown: ContextItemTokenUsage[];
}
