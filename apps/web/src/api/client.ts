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
  type AnswerQuestionRequest,
  type AnswerQuestionResponse,
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
}

export const defaultApiClient = new ProjectArchitectApiClient();
