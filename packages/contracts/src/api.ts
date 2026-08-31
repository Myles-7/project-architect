import type { ProjectSnapshot } from './overview.js';
import type { InputMaterialKind, InputMaterialStatus, InputRef } from './project.js';
import type { TypedRef, DecisionRef, QuestionRef } from './refs.js';
import type { DiscoveryResult, ReadinessReviewResult, ProviderHealthView } from './provider.js';
import type { ReadinessSnapshot, UserDisposition } from './readiness.js';
import type { DocumentsState } from './documents.js';

// Projects
export interface InitialProjectIntent {
  targetUser: string;
  coreProblem: string;
  desiredOutcome: string;
  constraints?: string;
}

export interface CreateProjectRequest {
  name: string;
  idea?: string;
  initialIntent?: InitialProjectIntent;
  projectId?: string;               // Optional explicit safe identifier
  projectTags?: string[];
  projectPath?: string;             // Deprecated: explicit paths must reside within workspace boundary
}

export interface CreateProjectResponse {
  projectId: string;
  projectPath: string;
  snapshot: ProjectSnapshot;
}

export interface OpenProjectRequest {
  projectId?: string;               // Preferred safe project identifier
  projectPath?: string;             // Deprecated: controlled import path (must reside within workspace)
}

export interface OpenProjectResponse {
  snapshot: ProjectSnapshot;
}

export interface RecentProjectItem {
  projectId: string;
  name: string;
  stage: string;
  updatedAt: string;
  projectPath: string;
  isPinned?: boolean;
  isArchived?: boolean;
  trashedAt?: string;
  trashPath?: string;
  originalPath?: string;
}

export interface ListRecentProjectsResponse {
  projects: RecentProjectItem[];
}

// Inputs
export interface AddInputRequest {
  projectId: string;
  kind: InputMaterialKind;
  filename: string;
  content: string;                  // Plain text or base64
  contentEncoding?: 'utf8' | 'base64';
  expectedRevision: number;         // Mandatory revision protection
}

export interface AddInputResponse {
  inputRef: InputRef;
}

export interface ExcludeInputRequest {
  projectId: string;
  inputId: string;
}

// State Actions
export interface ConfirmDecisionRequest {
  projectId: string;
  targetRef: TypedRef;
  expectedRevision: number;
}

export interface LockDecisionRequest {
  projectId: string;
  decisionRef: DecisionRef;
  expectedRevision: number;
}

export interface UnlockDecisionRequest {
  projectId: string;
  decisionRef: DecisionRef;
  expectedRevision: number;
}

export interface EditOverviewItemRequest {
  projectId: string;
  sectionId: string;
  itemRef?: TypedRef;               // If editing existing item
  newStatement: string;
  expectedRevision: number;
}

export interface EditOverviewItemResponse {
  decisionRef: DecisionRef;
  affectedRefs: TypedRef[];
  snapshot: ProjectSnapshot;
}

export interface AnswerQuestionRequest {
  projectId: string;
  questionRef: QuestionRef;
  answer: string;
  expectedRevision: number;
}

export interface AnswerQuestionResponse {
  decisionRef: DecisionRef;
  traceRef?: string;
  snapshot: ProjectSnapshot;
}

export interface DismissQuestionsRequest {
  projectId: string;
  questionRefs: QuestionRef[];
  expectedRevision: number;
}

export interface ConfirmDecisionRequest {
  projectId: string;
  targetRef: TypedRef;
  expectedRevision: number;
}

export interface ConfirmDecisionResponse {
  snapshot: ProjectSnapshot;
  decisionRef?: DecisionRef;
}

export interface DismissQuestionsResponse {
  snapshot: ProjectSnapshot;
}

// Discovery
export interface RecordDiscoveryInputRequest {
  projectId: string;
  text: string;
  expectedRevision: number;
}

export interface RecordDiscoveryInputResponse {
  inputRef: string;
  turnId: string;
  snapshot: ProjectSnapshot;
}

export interface ScheduleDiscoveryJobRequest {
  projectId: string;
  turnId?: string;
  expectedRevision: number;
  userMessage?: string;
}

export interface GetDiscoveryTurnsResponse {
  turns: import('./discovery.js').DiscoveryTurnRecord[];
}

export interface GetDiscoveryProgressResponse {
  progress: import('./views.js').DiscoveryProgressView;
}

export interface RunDiscoveryTurnRequest {
  projectId: string;
  userMessage?: string;
  questionAnswer?: {
    questionRef: TypedRef;
    selectedOption?: string;
    freeInput?: string;
  };
  expectedRevision: number;
}

export interface RunDiscoveryTurnResponse {
  discoveryResult: DiscoveryResult;
  snapshot: ProjectSnapshot;
  diagnostics: {
    durationMs: number;
    totalTokens: number | 'unavailable';
    cacheReadTokens?: number | 'unavailable';
    questionBatch?: {
      id: string;
      stage: import('./questions.js').QuestionBatchStage;
      generatedQuestionCount: number;
      selection: NonNullable<DiscoveryJobView['questionSelection']>;
    };
  };
}

/**
 * Ephemeral server-side status for a user-requested background discovery run.
 * The underlying user decisions remain in Project State; this only reports
 * whether the advisory AI work is still safe to apply.
 */
export type DiscoveryJobStatus = 'idle' | 'queued' | 'running' | 'completed' | 'stale' | 'cancelled' | 'failed';

export interface DiscoveryJobView {
  projectId: string;
  status: DiscoveryJobStatus;
  sourceRevision?: number;
  stateRevisionAfter?: number;
  /** Confirmed question answers that have not yet been incorporated by a completed discovery run. */
  pendingAnswerCount?: number;
  batchId?: string;
  batchStage?: import('./questions.js').QuestionBatchStage;
  generatedQuestionCount?: number;
  questionSelection?: {
    received: number;
    selected: number;
    deferred: number;
    duplicatesDropped: number;
    invalidDependencies: number;
    dependencyCycles: number;
  };
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  diagnostics?: {
    durationMs?: number;
    totalTokens?: number | 'unavailable';
  };
  message?: string;
}

export interface AnswerQuestionAsAssumptionRequest {
  projectId: string;
  questionRef: QuestionRef;
  assumptionStatement: string;
  rationale?: string;
  expectedRevision: number;
}

export interface AnswerQuestionAsAssumptionResponse {
  assumptionRef: TypedRef;
  snapshot: ProjectSnapshot;
}

export interface ScheduleDiscoveryJobRequest {
  projectId: string;
  expectedRevision: number;
  userMessage?: string;
}

export interface ScheduleDiscoveryJobResponse {
  job: DiscoveryJobView;
}

export interface CancelDiscoveryJobRequest {
  projectId: string;
}

export interface CancelDiscoveryJobResponse {
  job: DiscoveryJobView;
}

// Readiness
export interface RunReadinessReviewRequest {
  projectId?: string;
  expectedRevision: number;
}

export interface RunReadinessReviewResponse {
  snapshot: ReadinessSnapshot;
  projectSnapshot: ProjectSnapshot;
  readinessResult?: ReadinessReviewResult;
}

export interface ApproveDevelopmentPackageRequest {
  projectId: string;
  disposition: UserDisposition;
  acknowledgedIssueRefs?: TypedRef[];
  expectedRevision: number;
}

export interface ApproveDevelopmentPackageResponse {
  snapshot: ProjectSnapshot;
}

// Documents
export interface GenerateDocumentsRequest {
  projectId: string;
  expectedRevision: number;
}

export interface GenerateDocumentsResponse {
  manifest: DocumentsState;
}

export interface ReadDocumentRequest {
  projectId: string;
  docPath: string;
}

export interface ReadDocumentResponse {
  content: string;
}

// Project Management Lifecycle
export interface RenameProjectRequest {
  projectId: string;
  name: string;
}

export interface RenameProjectResponse {
  project: RecentProjectItem;
}

export interface DuplicateProjectRequest {
  projectId: string;
  newName?: string;
}

export interface DuplicateProjectResponse {
  project: RecentProjectItem;
}

export interface ToggleProjectArchiveResponse {
  projectId: string;
  isArchived: boolean;
}

export interface ToggleProjectPinResponse {
  projectId: string;
  isPinned: boolean;
}

export interface DeleteProjectResponse {
  projectId: string;
  deleted: boolean;
  trashed?: boolean;
  trashPath?: string;
  trashedAt?: string;
}

export interface RestoreProjectRequest {
  projectId: string;
  targetPath?: string;
}

export interface RestoreProjectResponse {
  project: RecentProjectItem;
}

export interface PurgeProjectResponse {
  projectId: string;
  purged: boolean;
}

export interface OpenProjectFolderResponse {
  projectId: string;
  projectPath: string;
  opened: boolean;
}

// Material Context Toggle
export interface ToggleInputExclusionRequest {
  projectId: string;
  inputId: string;
  exclude: boolean;
}

export interface ToggleInputExclusionResponse {
  inputId: string;
  status: InputMaterialStatus;
}

// Provider Health & Diagnostics
export interface ProviderHealthResponse extends Partial<ProviderHealthView> {
  status: 'ready' | 'degraded' | 'unavailable';
  providerName: string;
  modelName: string;
  isLocal: boolean;
  latencyMs?: number;
  details?: string;
  health?: ProviderHealthView;
}
