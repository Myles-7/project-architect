import type { TypedRef } from './refs.js';

export type QuestionImportance = 'normal' | 'high' | 'critical';
export type QuestionBatchStage = 'initial' | 'explore' | 'converge' | 'readiness' | 'legacy';
export type QuestionAnswerKind = 'selection' | 'custom' | 'delegate' | 'defer';

export interface QuestionOption {
  key: string;
  label: string;
  approach?: string;
  gain?: string;
  sacrifice?: string;
  impact: string;
  tradeoffs?: string;
  reversibility?: 'easy' | 'moderate' | 'hard';
}

export interface QuestionItem {
  id: string;                       // e.g. "q-01"
  issueRef: TypedRef;               // Points to the triggering gap, conflict, or risk
  gapRef?: TypedRef;                // Alias for issueRef
  importance: QuestionImportance;
  priority?: QuestionImportance;    // Alias for importance
  question: string;
  /** Product area this question constrains; retained when saved as an assumption. */
  area?: string;
  reason: string;                   // Why ask now
  whyNow?: string;                  // Convenience alias for reason
  impact?: string;                  // High-level impact summary
  recommendation: string;           // Product-level recommended direction
  recommendationReason: string;     // Rationale and tradeoffs for recommendation
  recommendedOptionKey?: string;    // Key of the recommended option
  options: QuestionOption[];
  allowFreeInput: true;             // Always true
  selectionMode?: 'single' | 'multiple';
  reopenReason?: string;
  /** Stable B3 decision topic used for exact Gap/Question matching and deduplication. */
  decisionKey?: string;
  /** Decision topics that must already be confirmed or locked before this question is shown. */
  dependsOn?: string[];
  /** Local question-set metadata; never supplied as a user-confirmed fact by the Agent. */
  batchId?: string;
  batchStage?: QuestionBatchStage;
  basisRevision?: number;
  basisHash?: string;
  status: 'proposed' | 'shown' | 'answered' | 'dismissed' | 'superseded';
  answer?: string;
  /** Explicit submitted intent; absent on historical answers and never inferred from answer text. */
  answerKind?: QuestionAnswerKind;
  /** Exact submitted option keys, present only for an explicit structured selection. */
  selectedOptionKeys?: string[];
  createdAt: string;                // ISO 8601
  answeredAt?: string;              // ISO 8601
}

export interface QuestionBatchInfo {
  activeBatchId: string | null;
  totalQuestions: number;
  answeredCount: number;
  remainingCount: number;
  isComplete: boolean;
}

export interface AnswerAsAssumptionRequest {
  projectId: string;
  questionRef: TypedRef;
  assumptionStatement: string;
  rationale?: string;
  expectedRevision: number;
}

export interface AnswerAsAssumptionResponse {
  assumptionRef: TypedRef;
}

export interface QuestionsState {
  schemaVersion: number;
  projectId: string;
  items: QuestionItem[];
  updatedAt: string;                // ISO 8601
}
