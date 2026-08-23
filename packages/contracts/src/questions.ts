import type { TypedRef } from './refs.js';

export type QuestionImportance = 'normal' | 'high' | 'critical';

export interface QuestionOption {
  label: string;
  impact: string;
}

export interface QuestionItem {
  id: string;                       // e.g. "q-01"
  issueRef: TypedRef;               // Points to the triggering gap, conflict, or risk
  gapRef?: TypedRef;                // Alias for issueRef
  importance: QuestionImportance;
  priority?: QuestionImportance;    // Alias for importance
  question: string;
  reason: string;                   // Why ask now
  whyNow?: string;                  // Convenience alias for reason
  impact?: string;                  // High-level impact summary
  recommendation: string;           // Product-level recommended direction
  recommendationReason: string;     // Rationale and tradeoffs for recommendation
  options: QuestionOption[];
  allowFreeInput: true;             // Always true
  status: 'proposed' | 'shown' | 'answered' | 'dismissed' | 'superseded';
  answer?: string;
  createdAt: string;                // ISO 8601
  answeredAt?: string;              // ISO 8601
}

export interface QuestionsState {
  schemaVersion: number;
  projectId: string;
  items: QuestionItem[];
  updatedAt: string;                // ISO 8601
}
