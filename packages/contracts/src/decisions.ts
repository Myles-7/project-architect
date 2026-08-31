import type { DecisionRef, QuestionRef, TypedRef } from './refs.js';

export type DecisionStatus =
  | 'candidate'
  | 'confirmed'
  | 'locked'
  | 'superseded'
  | 'rejected';

export type DecisionOrigin = 'user' | 'agent';

export interface DecisionItem {
  id: string;                       // e.g. "dec-01"
  area: string;                     // e.g. "mvp_scope", "target_user", "platform"
  statement: string;
  status: DecisionStatus;
  origin: DecisionOrigin;
  evidenceRefs: TypedRef[];         // Pointing to input/question/etc.
  confirmedBy?: 'user';             // Required when status is 'confirmed' or 'locked'
  supersededBy?: DecisionRef;       // Points to the new decision replacing this one
  decisionKey?: string;             // Topic key from B3 Discovery
  rationale?: string;               // Justification / tradeoffs
  affectedAreas?: string[];         // Secondary areas impacted by this decision
  sourceArea?: string;              // Preserved original area before migration/normalization
  createdAt: string;                // ISO 8601
  updatedAt: string;                // ISO 8601
}

export interface CandidateDecisionItem extends DecisionItem {
  status: 'candidate';
  decisionKey?: string;
  rationale?: string;
  affectedAreas?: string[];
}


export type DecisionTraceAction =
  | 'question-answered'
  | 'decision-created'
  | 'decision-confirmed'
  | 'assumption-converted'
  | 'gap-addressed';

export interface DecisionTraceStateChange {
  ref: TypedRef;
  action: DecisionTraceAction;
}

/**
 * Immutable audit record for a user-authorized decision. This keeps the
 * evidence chain visible without introducing a general requirement graph.
 */
export interface DecisionTrace {
  id: string;
  questionRef: QuestionRef;
  userAnswer: string;
  decisionRef: DecisionRef;
  stateChanges: DecisionTraceStateChange[];
  createdAt: string;
}

export interface DecisionsState {
  schemaVersion: number;
  projectId: string;
  items: DecisionItem[];
  /** Optional for backward-compatible loading of pre-Phase-2.5 project state. New writes populate it. */
  traces?: DecisionTrace[];
  updatedAt: string;                // ISO 8601
}
