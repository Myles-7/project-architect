import type { TypedRef } from './refs.js';
import type { ProjectMetadata } from './project.js';
import type { DecisionsState } from './decisions.js';
import type { AssumptionsState } from './assumptions.js';
import type { GapsState, RisksState } from './gaps.js';
import type { QuestionsState } from './questions.js';
import type { ReadinessState } from './readiness.js';
import type { DocumentsState } from './documents.js';

export type SectionMaturity =
  | 'unexplored'
  | 'needs-clarification'
  | 'mostly-clear'
  | 'clear'
  | 'locked';

export interface OverviewSection {
  id: string;                       // e.g. "project_overview", "mvp_scope", "target_user", "tech_boundary"
  title: string;
  kind: 'fixed' | 'dynamic';
  maturity: SectionMaturity;
  itemRefs: TypedRef[];             // Strictly holds TypedRefs pointing to canonical decisions/items
}

export interface OverviewState {
  schemaVersion: number;
  projectId: string;
  sections: OverviewSection[];
  updatedAt: string;                // ISO 8601
}

/**
 * Complete consolidated project snapshot sent to client.
 */
export interface ProjectSnapshot {
  metadata: ProjectMetadata;
  overview: OverviewState;
  decisions: DecisionsState;
  assumptions: AssumptionsState;
  gaps: GapsState;
  risks: RisksState;
  questions: QuestionsState;
  readiness: ReadinessState;
  documents?: DocumentsState;
  planning?: import('./planning.js').PlanningState;
}
