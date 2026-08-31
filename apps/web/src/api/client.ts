/**
 * @file client.ts
 * @description Type-safe API Client for Project Architect V1 (Phase 5.1).
 *
 * Guaranteed Invariants:
 * 1. Strictly unwraps ApiResponse<T> payloads and maps status codes (400, 403, 404, 409, 422, 502, 504, 500).
 * 2. Supports AbortSignal to cancel stale or out-of-order in-flight requests.
 * 3. Never leaks host filesystem absolute paths or internal stacks into UI error messages.
 * 4. Never automatically retries state-mutating requests (POST/PUT/DELETE) without explicit user intent.
 */

import { getApiBaseUrl } from './config.js';
import {
  ErrorCode,
  type ApiResponse,
  type ApiErrorPayload,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type OpenProjectRequest,
  type OpenProjectResponse,
  type ListRecentProjectsResponse,
  type RecentProjectItem,
  type ProjectSnapshot,
  type ProjectOverviewView,
  type ReadinessView,
  type DocumentListView,
  type TimelineView,
  type AddInputRequest,
  type AddInputResponse,
  type RunDiscoveryTurnRequest,
  type RunDiscoveryTurnResponse,
  type DiscoveryJobView,
  type ScheduleDiscoveryJobRequest,
  type ScheduleDiscoveryJobResponse,
  type CancelDiscoveryJobRequest,
  type CancelDiscoveryJobResponse,
  type RecordDiscoveryInputRequest,
  type RecordDiscoveryInputResponse,
  type GetDiscoveryTurnsResponse,
  type GetDiscoveryProgressResponse,
  type AnswerQuestionRequest,
  type AnswerQuestionResponse,
  type DismissQuestionsRequest,
  type DismissQuestionsResponse,
  type ConfirmDecisionRequest,
  type LockDecisionRequest,
  type UnlockDecisionRequest,
  type EditOverviewItemRequest,
  type EditOverviewItemResponse,
  type RunReadinessReviewRequest,
  type RunReadinessReviewResponse,
  type ApproveDevelopmentPackageRequest,
  type GenerateDocumentsRequest,
  type GenerateDocumentsResponse,
  type ReadDocumentRequest,
  type ReadDocumentResponse,
  type RenameProjectResponse,
  type DuplicateProjectResponse,
  type ToggleProjectArchiveResponse,
  type ToggleProjectPinResponse,
  type DeleteProjectResponse,
  type RestoreProjectResponse,
  type PurgeProjectResponse,
  type OpenProjectFolderResponse,
  type ProviderHealthResponse,
  type ToggleInputExclusionResponse,
} from '@project-architect/contracts';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly recoverable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    errorPayload?: ApiErrorPayload,
    fallbackMessage?: string
  ) {
    const code = errorPayload?.code ?? ErrorCode.STATE_VALIDATION_FAILED;
    const message = errorPayload?.message || fallbackMessage || `HTTP ${statusCode} Request failed`;
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.recoverable = errorPayload?.recoverable ?? true;
    this.details = errorPayload?.details;
  }
}

export class ProjectArchitectApiClient {
  private readonly baseUrl: string;
  private readonly customFetch?: typeof fetch;

  constructor(baseUrl?: string, customFetch?: typeof fetch) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : getApiBaseUrl();
    this.customFetch = customFetch;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    signal?: AbortSignal
  ): Promise<{ data: T; stateRevision?: number }> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const fetchFn = this.customFetch || fetch;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    let response: Response;
    try {
      response = await fetchFn(url, {
        ...options,
        headers,
        signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      throw new ApiClientError(0, {
        code: ErrorCode.STATE_VALIDATION_FAILED,
        message: '无法连接到本地服务，请确认 Project Architect 后端服务已启动 (端口 3001)。',
        recoverable: true,
      });
    }

    let json: ApiResponse<T>;
    try {
      json = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiClientError(response.status, undefined, `服务端响应非有效 JSON (HTTP ${response.status})`);
    }

    if (!response.ok || !json.success) {
      throw new ApiClientError(response.status, json.error, json.error?.message);
    }

    if (json.data === undefined) {
      throw new ApiClientError(
        response.status,
        json.error,
        'API 响应缺少业务数据载荷 (data payload)'
      );
    }

    return {
      data: json.data,
      stateRevision: json.stateRevision,
    };
  }

  // ==========================================================================
  // 1. Health & Project Lifecycle Endpoints
  // ==========================================================================

  public async checkHealth(signal?: AbortSignal): Promise<{ status: string; time?: string }> {
    const res = await this.request<{ status: string; time?: string }>('/api/health', { method: 'GET' }, signal);
    return res.data;
  }

  public async listRecentProjects(signal?: AbortSignal): Promise<RecentProjectItem[]> {
    const res = await this.request<ListRecentProjectsResponse>('/api/projects', { method: 'GET' }, signal);
    return res.data.projects;
  }

  public async createProject(
    req: CreateProjectRequest,
    signal?: AbortSignal
  ): Promise<CreateProjectResponse> {
    const res = await this.request<CreateProjectResponse>(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async openProject(
    req: OpenProjectRequest,
    signal?: AbortSignal
  ): Promise<OpenProjectResponse> {
    const res = await this.request<OpenProjectResponse>(
      '/api/projects/open',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async getProjectSnapshot(
    projectId: string,
    signal?: AbortSignal
  ): Promise<ProjectSnapshot> {
    const res = await this.request<{ snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      { method: 'GET' },
      signal
    );
    return res.data.snapshot;
  }

  // ==========================================================================
  // 2. Pure Read Projections
  // ==========================================================================

  public async getProjectOverview(
    projectId: string,
    signal?: AbortSignal
  ): Promise<ProjectOverviewView> {
    const res = await this.request<ProjectOverviewView>(
      `/api/projects/${encodeURIComponent(projectId)}/overview`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getProjectReadiness(
    projectId: string,
    signal?: AbortSignal
  ): Promise<ReadinessView> {
    const res = await this.request<ReadinessView>(
      `/api/projects/${encodeURIComponent(projectId)}/readiness`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getProjectDocuments(
    projectId: string,
    signal?: AbortSignal
  ): Promise<DocumentListView> {
    const res = await this.request<DocumentListView>(
      `/api/projects/${encodeURIComponent(projectId)}/documents`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getProjectTimeline(
    projectId: string,
    signal?: AbortSignal
  ): Promise<TimelineView> {
    const res = await this.request<TimelineView>(
      `/api/projects/${encodeURIComponent(projectId)}/timeline`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 3. Input Materials & Discovery Turn
  // ==========================================================================

  public async addInput(
    projectId: string,
    req: AddInputRequest,
    signal?: AbortSignal
  ): Promise<AddInputResponse> {
    const res = await this.request<AddInputResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/inputs`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async runDiscoveryTurn(
    projectId: string,
    req: RunDiscoveryTurnRequest,
    signal?: AbortSignal
  ): Promise<RunDiscoveryTurnResponse> {
    const res = await this.request<RunDiscoveryTurnResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async scheduleDiscoveryJob(
    projectId: string,
    req: ScheduleDiscoveryJobRequest,
    signal?: AbortSignal
  ): Promise<ScheduleDiscoveryJobResponse> {
    const res = await this.request<ScheduleDiscoveryJobResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery/jobs`,
      { method: 'POST', body: JSON.stringify(req) },
      signal
    );
    return res.data;
  }

  public async getCurrentDiscoveryJob(
    projectId: string,
    signal?: AbortSignal
  ): Promise<DiscoveryJobView> {
    const res = await this.request<{ job: DiscoveryJobView }>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery/jobs/current`,
      { method: 'GET' },
      signal
    );
    return res.data.job;
  }

  public async cancelDiscoveryJob(
    projectId: string,
    req: CancelDiscoveryJobRequest,
    signal?: AbortSignal
  ): Promise<CancelDiscoveryJobResponse> {
    const res = await this.request<CancelDiscoveryJobResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery/jobs/cancel`,
      { method: 'POST', body: JSON.stringify(req) },
      signal
    );
    return res.data;
  }

  public async recordDiscoveryInput(
    projectId: string,
    req: RecordDiscoveryInputRequest,
    signal?: AbortSignal
  ): Promise<RecordDiscoveryInputResponse> {
    const res = await this.request<RecordDiscoveryInputResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery/inputs`,
      { method: 'POST', body: JSON.stringify(req) },
      signal
    );
    return res.data;
  }

  public async getDiscoveryTurns(
    projectId: string,
    signal?: AbortSignal
  ): Promise<GetDiscoveryTurnsResponse> {
    const res = await this.request<GetDiscoveryTurnsResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery/turns`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getDiscoveryProgress(
    projectId: string,
    signal?: AbortSignal
  ): Promise<GetDiscoveryProgressResponse> {
    const res = await this.request<GetDiscoveryProgressResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/discovery/progress`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 4. Questions & Decision Governance Mutations
  // ==========================================================================

  public async answerQuestion(
    projectId: string,
    req: AnswerQuestionRequest,
    signal?: AbortSignal
  ): Promise<AnswerQuestionResponse> {
    const res = await this.request<AnswerQuestionResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/questions/answer`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async answerQuestionAsAssumption(
    projectId: string,
    req: import('@project-architect/contracts').AnswerQuestionAsAssumptionRequest,
    signal?: AbortSignal
  ): Promise<import('@project-architect/contracts').AnswerQuestionAsAssumptionResponse> {
    const res = await this.request<import('@project-architect/contracts').AnswerQuestionAsAssumptionResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/questions/answer-assumption`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async dismissQuestions(
    projectId: string,
    req: DismissQuestionsRequest,
    signal?: AbortSignal
  ): Promise<DismissQuestionsResponse> {
    const res = await this.request<DismissQuestionsResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/questions/dismiss`,
      { method: 'POST', body: JSON.stringify(req) },
      signal
    );
    return res.data;
  }

  public async confirmDecision(
    projectId: string,
    req: ConfirmDecisionRequest,
    signal?: AbortSignal
  ): Promise<{ snapshot: ProjectSnapshot }> {
    const res = await this.request<{ snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async lockDecision(
    projectId: string,
    req: LockDecisionRequest,
    signal?: AbortSignal
  ): Promise<{ snapshot: ProjectSnapshot }> {
    const res = await this.request<{ snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions/lock`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async unlockDecision(
    projectId: string,
    req: UnlockDecisionRequest,
    signal?: AbortSignal
  ): Promise<{ snapshot: ProjectSnapshot }> {
    const res = await this.request<{ snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions/unlock`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async editOverviewItem(
    projectId: string,
    req: EditOverviewItemRequest,
    signal?: AbortSignal
  ): Promise<EditOverviewItemResponse> {
    const res = await this.request<EditOverviewItemResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/overview/edit`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 5. Readiness & Document Generation
  // ==========================================================================

  public async reviewReadiness(
    projectId: string,
    req: RunReadinessReviewRequest,
    signal?: AbortSignal
  ): Promise<RunReadinessReviewResponse> {
    const res = await this.request<RunReadinessReviewResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/readiness/review`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async approveReadiness(
    projectId: string,
    req: ApproveDevelopmentPackageRequest,
    signal?: AbortSignal
  ): Promise<{ snapshot: ProjectSnapshot }> {
    const res = await this.request<{ snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}/readiness/approve`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async generateDocuments(
    projectId: string,
    req: GenerateDocumentsRequest,
    signal?: AbortSignal
  ): Promise<GenerateDocumentsResponse> {
    const res = await this.request<GenerateDocumentsResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/documents/generate`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async readDocument(
    projectId: string,
    req: ReadDocumentRequest,
    signal?: AbortSignal
  ): Promise<ReadDocumentResponse> {
    const res = await this.request<ReadDocumentResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/documents/read`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  // Project Management Lifecycle
  public async renameProject(
    projectId: string,
    name: string,
    expectedRevision?: number,
    signal?: AbortSignal
  ): Promise<RecentProjectItem> {
    const res = await this.request<RenameProjectResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/rename`,
      {
        method: 'POST',
        body: JSON.stringify({ name, expectedRevision }),
      },
      signal
    );
    return res.data.project;
  }

  public async duplicateProject(
    projectId: string,
    newName?: string,
    signal?: AbortSignal
  ): Promise<RecentProjectItem> {
    const res = await this.request<DuplicateProjectResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/duplicate`,
      {
        method: 'POST',
        body: JSON.stringify({ newName }),
      },
      signal
    );
    return res.data.project;
  }

  public async archiveProject(projectId: string, signal?: AbortSignal): Promise<boolean> {
    const res = await this.request<ToggleProjectArchiveResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/archive`,
      { method: 'POST' },
      signal
    );
    return res.data.isArchived;
  }

  public async pinProject(projectId: string, signal?: AbortSignal): Promise<boolean> {
    const res = await this.request<ToggleProjectPinResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/pin`,
      { method: 'POST' },
      signal
    );
    return res.data.isPinned;
  }

  public async deleteProject(projectId: string, signal?: AbortSignal): Promise<boolean> {
    const res = await this.request<DeleteProjectResponse>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      { method: 'DELETE' },
      signal
    );
    return res.data.deleted;
  }

  public async restoreProject(
    projectId: string,
    targetPath?: string,
    signal?: AbortSignal
  ): Promise<RecentProjectItem> {
    const res = await this.request<RestoreProjectResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({ targetPath }),
      },
      signal
    );
    return res.data.project;
  }

  public async purgeProject(projectId: string, signal?: AbortSignal): Promise<boolean> {
    const res = await this.request<PurgeProjectResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/purge`,
      { method: 'DELETE' },
      signal
    );
    return res.data.purged;
  }

  public async openProjectFolder(
    projectId: string,
    signal?: AbortSignal
  ): Promise<OpenProjectFolderResponse> {
    const res = await this.request<OpenProjectFolderResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/open-folder`,
      { method: 'POST' },
      signal
    );
    return res.data;
  }

  public async getProviderHealth(signal?: AbortSignal): Promise<ProviderHealthResponse> {
    const res = await this.request<ProviderHealthResponse>('/api/provider/health', undefined, signal);
    return res.data;
  }

  public async toggleInputExclusion(
    projectId: string,
    inputId: string,
    exclude?: boolean,
    expectedRevision?: number,
    signal?: AbortSignal
  ): Promise<ToggleInputExclusionResponse> {
    const res = await this.request<ToggleInputExclusionResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/inputs/${encodeURIComponent(inputId)}/toggle`,
      {
        method: 'POST',
        body: JSON.stringify({ exclude, expectedRevision }),
      },
      signal
    );
    return res.data;
  }
}

export const defaultApiClient = new ProjectArchitectApiClient();
