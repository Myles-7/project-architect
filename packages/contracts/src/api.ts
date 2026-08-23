import type { ProjectSnapshot } from './overview.js';
import type { InputMaterialKind, InputRef } from './project.js';
import type { TypedRef, DecisionRef, QuestionRef } from './refs.js';
import type { DiscoveryResult, ReadinessReviewResult } from './provider.js';
import type { ReadinessSnapshot, UserDisposition } from './readiness.js';
import type { DocumentsState } from './documents.js';

// Projects
export interface CreateProjectRequest {
  name: string;
  idea: string;
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

// Discovery
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
  };
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
