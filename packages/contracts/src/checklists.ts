import type { QuestionImportance } from './questions.js';

export interface ChecklistItem {
  id: string;                       // e.g. "chk-univ-mvp-boundary"
  area: string;                     // e.g. "mvp_scope", "target_user"
  criterion: string;                // Product-level inspection condition
  importance: QuestionImportance;   // "normal" | "high" | "critical"
  applicableWhen?: {
    tags?: string[];
    stage?: string[];
  };
}

export interface MergedChecklistHint {
  id: string;
  area: string;
  criterion: string;
  importance: QuestionImportance;
}
