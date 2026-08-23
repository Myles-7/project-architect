export type ItemStatus = 
  | 'confirmed' 
  | 'candidate' 
  | 'assumption' 
  | 'unresolved' 
  | 'warning' 
  | 'locked';

export type ImportanceLevel = 'normal' | 'high' | 'critical';

export type SectionMaturity = 
  | 'unexplored' 
  | 'needs_clarity' 
  | 'mostly_clear' 
  | 'confirmed' 
  | 'locked';

export interface OverviewItem {
  id: string;
  title: string;
  content: string;
  status: ItemStatus;
  locked?: boolean;
  note?: string;
  impact?: string;
}

export interface OverviewSection {
  id: string;
  title: string;
  iconName: string;
  category: 'core' | 'dynamic';
  summary: string;
  maturity: SectionMaturity;
  items: OverviewItem[];
}

export interface AttachedFile {
  id: string;
  name: string;
  size: string;
  type: 'markdown' | 'image' | 'text' | 'pdf';
  status: 'parsed' | 'uploaded';
  summary?: string;
}

export interface AnalysisBreakdown {
  confirmed: string[];
  candidates: string[];
  assumptions: string[];
  unresolvedGaps: string[];
  warnings: string[];
  recommendations: Array<{ title: string; rationale: string }>;
}

export interface QuestionOption {
  id: string;
  label: string;
  impact: string;
  isRecommended?: boolean;
}

export interface QuestionItem {
  id: string;
  importance: ImportanceLevel;
  question: string;
  whyAskNow: string;
  recommendation: {
    label: string;
    rationale: string;
  };
  options: QuestionOption[];
  isAnswered?: boolean;
  selectedOptionId?: string;
  customAnswer?: string;
  subQuestions?: Array<{
    id: string;
    question: string;
    options: string[];
    selectedOption?: string;
  }>;
}

export interface ReadinessBucketItem {
  id: string;
  title: string;
  desc: string;
  impact?: string;
  resolution?: string;
}

export interface ReadinessData {
  overallStatus: 'ready' | 'ready_with_warnings' | 'not_ready';
  approved: boolean;
  stateRevision: string;
  buckets: {
    ready: ReadinessBucketItem[];
    warnings: ReadinessBucketItem[];
    highIssues: ReadinessBucketItem[];
    criticalConflicts: ReadinessBucketItem[];
  };
  recommendation: string;
}

export interface DocumentBlueprint {
  id: string;
  filename: string;
  title: string;
  badge: 'Gateway' | 'Core' | 'Flow' | 'UX/UI' | 'Plan' | 'Acceptance';
  targetAudience: string;
  stateRevision: string;
  updatedAt: string;
  isCurrent: boolean;
  contentMarkdown: string;
}

export interface TimelineMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  type: 'idea_prompt' | 'initial_analysis' | 'question_card' | 'user_decision' | 'readiness_card';
  timestamp: string;
  content?: string;
  attachedFiles?: AttachedFile[];
  analysis?: AnalysisBreakdown;
  question?: QuestionItem;
}

export interface ProjectState {
  id: string;
  name: string;
  tagline: string;
  stage: 'discovery' | 'broad_pass' | 'deep_dive' | 'readiness' | 'documented';
  updatedAt: string;
  stateRevision: string;
  tags: string[];
  attachedFiles: AttachedFile[];
  overviewSections: OverviewSection[];
  timeline: TimelineMessage[];
  readiness: ReadinessData;
  documents: DocumentBlueprint[];
}
