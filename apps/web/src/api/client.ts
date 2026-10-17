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
  type DeprecateDecisionRequest,
  type DeprecateDecisionResponse,
  type RunReadinessReviewRequest,
  type RunReadinessReviewResponse,
  type ApproveDevelopmentPackageRequest,
  type GenerateDocumentsRequest,
  type GenerateDocumentsResponse,
  type ReadDocumentRequest,
  type ReadDocumentResponse,
  type ImportProjectResponse,
  type GetContextDiagnosticsResponse,
  type ProjectPreset,
  type DecisionGraphView,
  type CascadeImpactResult,
  type DiagramsResult,
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
  type RetractQuestionRequest,
  type RetractQuestionResponse,
  type ValidatePathRequest,
  type ValidatePathResponse,
  type ListDirectoriesResponse,
  type StandaloneHtmlExportResult,
  type CodebaseAnalysisResult,
  type BrownfieldCandidateDecision,
  type SpecDriftReport,
  type PlanningView,
  type PlanningHistoryView,
  type PlanningRun,
  type PlanningEvent,
  type StartPlanningRequest,
  type QuestionAnswerIntent,
  type ChangeGroup,
  type ApproveChangeSetRequest,
  type PlanningRuntimeConfig,
  type PlanningPackageManifest,
  type ProjectPlanningDiagnostics,
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

    if (!json || typeof json !== 'object' || Array.isArray(json) || typeof json.success !== 'boolean') {
      throw new ApiClientError(response.status, undefined, 'API 响应格式无效，请重新读取');
    }
    if (!response.ok || !json.success) {
      throw new ApiClientError(response.status, json.error, json.error?.message);
    }

    if (json.data === undefined || json.data === null) {
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

  public async listRecentProjects(signal?: AbortSignal, includeTrashed = false): Promise<RecentProjectItem[]> {
    const res = await this.request<ListRecentProjectsResponse>(includeTrashed ? '/api/projects?includeTrashed=true' : '/api/projects', { method: 'GET' }, signal);
    if (!Array.isArray(res.data.projects) || !res.data.projects.every(item => item && typeof item.projectId === 'string' && typeof item.name === 'string')) throw new ApiClientError(200, undefined, '项目列表格式无效，请重新读取');
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
    if (!res.data.snapshot?.metadata || !Array.isArray(res.data.snapshot.questions?.items) || !Array.isArray(res.data.snapshot.decisions?.items)) throw new ApiClientError(200, undefined, '项目状态格式无效，请重新读取');
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

  public async retractQuestion(
    projectId: string,
    req: RetractQuestionRequest,
    signal?: AbortSignal
  ): Promise<RetractQuestionResponse> {
    const res = await this.request<RetractQuestionResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/questions/retract`,
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

  public async writeDocument(
    projectId: string,
    req: { docPath: string; content: string },
    signal?: AbortSignal
  ): Promise<{ docPath: string; saved: boolean }> {
    const res = await this.request<{ docPath: string; saved: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/documents/write`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async exportDocumentsToPath(
    projectId: string,
    req: { targetDirectory: string },
    signal?: AbortSignal
  ): Promise<{ targetDirectory: string; copiedCount: number }> {
    const res = await this.request<{ targetDirectory: string; copiedCount: number }>(
      `/api/projects/${encodeURIComponent(projectId)}/documents/export-to-path`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  public async rollbackProject(
    projectId: string,
    targetRevision: number,
    signal?: AbortSignal
  ): Promise<{ snapshot: ProjectSnapshot }> {
    const res = await this.request<{ snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ targetRevision }),
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

  public async deprecateDecision(
    projectId: string,
    payload: DeprecateDecisionRequest,
    signal?: AbortSignal
  ): Promise<DeprecateDecisionResponse> {
    const res = await this.request<DeprecateDecisionResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions/deprecate`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      signal
    );
    return res.data;
  }

  public async exportProject(projectId: string, signal?: AbortSignal): Promise<Blob> {
    const url = `${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/export`;
    const fetchFn = this.customFetch || fetch;
    const response = await fetchFn(url, { signal });
    if (!response.ok) {
      throw new ApiClientError(response.status, undefined, '导出项目失败');
    }
    return response.blob();
  }

  public async importProject(
    contentBase64: string,
    signal?: AbortSignal
  ): Promise<ImportProjectResponse> {
    const res = await this.request<ImportProjectResponse>(
      '/api/projects/import',
      {
        method: 'POST',
        body: JSON.stringify({ contentBase64 }),
      },
      signal
    );
    return res.data;
  }

  public async getContextDiagnostics(
    projectId: string,
    signal?: AbortSignal
  ): Promise<GetContextDiagnosticsResponse> {
    const res = await this.request<GetContextDiagnosticsResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/diagnostics/context`,
      undefined,
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 8. Filesystem Helper APIs
  // ==========================================================================

  public async listDirectories(
    path?: string,
    signal?: AbortSignal
  ): Promise<ListDirectoriesResponse> {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await this.request<ListDirectoriesResponse>(
      `/api/fs/directories${query}`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async validatePath(
    req: ValidatePathRequest,
    signal?: AbortSignal
  ): Promise<ValidatePathResponse> {
    const res = await this.request<ValidatePathResponse>(
      `/api/fs/validate-path`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 9. Stage S1 APIs (Presets, DAG, Diagrams)
  // ==========================================================================

  public async getPresets(signal?: AbortSignal): Promise<ProjectPreset[]> {
    const res = await this.request<ProjectPreset[]>(
      '/api/presets',
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getPreset(id: string, signal?: AbortSignal): Promise<ProjectPreset> {
    const res = await this.request<ProjectPreset>(
      `/api/presets/${encodeURIComponent(id)}`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getProjectDag(projectId: string, signal?: AbortSignal): Promise<DecisionGraphView> {
    const res = await this.request<DecisionGraphView>(
      `/api/projects/${encodeURIComponent(projectId)}/dag`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getDecisionCascadeImpact(
    projectId: string,
    decisionId: string,
    signal?: AbortSignal
  ): Promise<CascadeImpactResult> {
    const res = await this.request<CascadeImpactResult>(
      `/api/projects/${encodeURIComponent(projectId)}/dag/impact?decisionId=${encodeURIComponent(decisionId)}`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  public async getArchitectureDiagrams(
    projectId: string,
    signal?: AbortSignal
  ): Promise<DiagramsResult> {
    const res = await this.request<DiagramsResult>(
      `/api/projects/${encodeURIComponent(projectId)}/diagrams`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 10. Stage S2 APIs (Standalone HTML Export & Incremental Diff)
  // ==========================================================================

  public async exportDocumentsHtml(
    projectId: string,
    signal?: AbortSignal
  ): Promise<Blob> {
    const url = `${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/documents/export-html`;
    const fetchFn = this.customFetch || fetch;
    const response = await fetchFn(url, { signal });
    if (!response.ok) {
      throw new ApiClientError(response.status, undefined, '导出单文件 HTML 规范失败');
    }
    return response.blob();
  }

  public async exportDocumentsHtmlMeta(
    projectId: string,
    signal?: AbortSignal
  ): Promise<StandaloneHtmlExportResult> {
    const res = await this.request<StandaloneHtmlExportResult>(
      `/api/projects/${encodeURIComponent(projectId)}/documents/export-html?format=json`,
      { method: 'GET' },
      signal
    );
    return res.data;
  }

  // ==========================================================================
  // 11. Stage S3 APIs (Brownfield Scan & Spec-Drift Verification)
  // ==========================================================================

  public async scanBrownfieldStateless(
    path: string,
    maxFiles?: number,
    signal?: AbortSignal
  ): Promise<CodebaseAnalysisResult> {
    const res = await this.request<CodebaseAnalysisResult>(
      '/api/brownfield/scan',
      {
        method: 'POST',
        body: JSON.stringify({ path, maxFiles }),
      },
      signal
    );
    return res.data;
  }

  public async scanBrownfield(
    projectId: string,
    path: string,
    maxFiles?: number,
    signal?: AbortSignal
  ): Promise<CodebaseAnalysisResult> {
    const res = await this.request<CodebaseAnalysisResult>(
      `/api/projects/${encodeURIComponent(projectId)}/brownfield/scan`,
      {
        method: 'POST',
        body: JSON.stringify({ path, maxFiles }),
      },
      signal
    );
    return res.data;
  }

  public async applyBrownfieldCandidates(
    projectId: string,
    candidateDecisions: BrownfieldCandidateDecision[],
    expectedRevision?: number,
    signal?: AbortSignal
  ): Promise<{ appliedCount: number; snapshot: ProjectSnapshot }> {
    const res = await this.request<{ appliedCount: number; snapshot: ProjectSnapshot }>(
      `/api/projects/${encodeURIComponent(projectId)}/brownfield/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ candidateDecisions, expectedRevision }),
      },
      signal
    );
    return res.data;
  }

  public async verifySpecDrift(
    projectId: string,
    targetPath?: string,
    maxFiles?: number,
    signal?: AbortSignal
  ): Promise<SpecDriftReport> {
    const res = await this.request<SpecDriftReport>(
      `/api/projects/${encodeURIComponent(projectId)}/verify-drift`,
      {
        method: 'POST',
        body: JSON.stringify({ targetPath, maxFiles }),
      },
      signal
    );
    return res.data;
  }

  public async getPlanning(projectId: string, signal?: AbortSignal): Promise<PlanningView> {
    const data = (await this.request<PlanningView>(`/api/projects/${encodeURIComponent(projectId)}/planning`, {}, signal)).data;
    if (!data.state?.blueprint?.stages || !Array.isArray(data.state.blueprint.blocks) || !Array.isArray(data.state.changeSets) || !Array.isArray(data.state.evidence) || !Array.isArray(data.state.topics) || !Array.isArray(data.state.inputs) || !Array.isArray(data.runs) || !Array.isArray(data.coverageIssues) || !Number.isInteger(data.sourceStateRevision)) throw new ApiClientError(200, undefined, '规划数据格式无效，请重新读取');
    return data;
  }

  public async getPlanningDiagnostics(projectId: string, signal?: AbortSignal): Promise<ProjectPlanningDiagnostics> {
    const data = (await this.request<ProjectPlanningDiagnostics>(`/api/projects/${encodeURIComponent(projectId)}/diagnostics`, {}, signal)).data;
    const sections = [data.project, data.configuration, data.runtime, data.tasks, data.calls, data.materials, data.provider];
    if (data.schemaVersion !== 1 || !sections.every(section => section && ['available', 'partial', 'unavailable'].includes(section.availability) && Array.isArray(section.reasons)) || !data.configuration.current || typeof data.configuration.current.designModel !== 'string' || typeof data.configuration.current.reviewModel !== 'string' || !Array.isArray(data.runtime.runs) || !Array.isArray(data.tasks.items) || !Array.isArray(data.calls.items) || !data.calls.usage || !Array.isArray(data.materials.items) || typeof data.project.projectPath !== 'string') throw new ApiClientError(200, undefined, '诊断数据格式无效，请重新读取');
    return data;
  }

  public async getPlanningHistory(projectId: string, signal?: AbortSignal): Promise<PlanningHistoryView> {
    const data = (await this.request<PlanningHistoryView>(`/api/projects/${encodeURIComponent(projectId)}/planning/history`, {}, signal)).data;
    if (!data.snapshot?.metadata || !Array.isArray(data.state?.changeSets) || !Array.isArray(data.state.inputs) || !Array.isArray(data.snapshot.documents?.items) || !Array.isArray(data.snapshot.decisions?.items) || !Array.isArray(data.runs) || !Array.isArray(data.runtime?.reasons) || !Number.isInteger(data.sourceStateRevision)) throw new ApiClientError(200, undefined, '历史数据格式无效，请重新读取');
    return data;
  }

  public async readHistoricalDocument(projectId: string, documentId: string, signal?: AbortSignal): Promise<{ content: string; historical: true; integrity: 'unchecked' }> {
    const data = (await this.request<{ content: string; historical: true; integrity: 'unchecked' }>(`/api/projects/${encodeURIComponent(projectId)}/planning/history/documents/${encodeURIComponent(documentId)}`, {}, signal)).data;
    if (typeof data.content !== 'string' || data.historical !== true || data.integrity !== 'unchecked') throw new ApiClientError(200, undefined, '历史文档格式无效，请重新读取');
    return data;
  }

  /** draftChangeSetId retains an explicit pending source; Runtime validates it before saving feedback. */
  public async startPlanningRun(projectId: string, req: StartPlanningRequest, signal?: AbortSignal): Promise<PlanningRun> {
    return (await this.request<PlanningRun>(`/api/projects/${encodeURIComponent(projectId)}/planning/runs`, { method: 'POST', body: JSON.stringify(req) }, signal)).data;
  }

  public async getPlanningRun(projectId: string, runId: string, signal?: AbortSignal): Promise<PlanningRun> {
    return (await this.request<PlanningRun>(`/api/projects/${encodeURIComponent(projectId)}/planning/runs/${encodeURIComponent(runId)}`, {}, signal)).data;
  }

  public async controlPlanningRun(projectId: string, runId: string, action: 'cancel' | 'resume', _req: { expectedRevision: number; operationId: string }, signal?: AbortSignal): Promise<PlanningRun> {
    return (await this.request<PlanningRun>(`/api/projects/${encodeURIComponent(projectId)}/planning/runs/${encodeURIComponent(runId)}/${action}`, { method: 'POST' }, signal)).data;
  }

  public async answerPlanningQuestions(projectId: string, req: { answers: QuestionAnswerIntent[]; expectedRevision: number; operationId: string }, signal?: AbortSignal): Promise<{ snapshot: ProjectSnapshot }> {
    return (await this.request<{ snapshot: ProjectSnapshot }>(`/api/projects/${encodeURIComponent(projectId)}/questions/answers`, { method: 'POST', body: JSON.stringify(req) }, signal)).data;
  }

  public async editPlanningChangeSet(projectId: string, changeSetId: string, req: { groups: ChangeGroup[]; expectedRevision: number; operationId: string }, signal?: AbortSignal): Promise<unknown> {
    return (await this.request<unknown>(`/api/projects/${encodeURIComponent(projectId)}/planning/changesets/${encodeURIComponent(changeSetId)}`, { method: 'PATCH', body: JSON.stringify(req) }, signal)).data;
  }

  public async approvePlanningChangeSet(projectId: string, changeSetId: string, req: ApproveChangeSetRequest, signal?: AbortSignal): Promise<unknown> {
    return (await this.request<unknown>(`/api/projects/${encodeURIComponent(projectId)}/planning/changesets/${encodeURIComponent(changeSetId)}/approve`, { method: 'POST', body: JSON.stringify(req) }, signal)).data;
  }

  public async rejectPlanningChangeSet(projectId: string, changeSetId: string, req: Omit<ApproveChangeSetRequest, 'unlockIds'>, signal?: AbortSignal): Promise<unknown> {
    return (await this.request<unknown>(`/api/projects/${encodeURIComponent(projectId)}/planning/changesets/${encodeURIComponent(changeSetId)}/reject`, { method: 'POST', body: JSON.stringify(req) }, signal)).data;
  }

  public async getPlanningConfig(projectId: string, signal?: AbortSignal): Promise<PlanningRuntimeConfig> {
    return (await this.request<PlanningRuntimeConfig>(`/api/projects/${encodeURIComponent(projectId)}/planning/config`, {}, signal)).data;
  }

  public async updatePlanningConfig(projectId: string, req: PlanningRuntimeConfig, signal?: AbortSignal): Promise<PlanningRuntimeConfig> {
    return (await this.request<PlanningRuntimeConfig>(`/api/projects/${encodeURIComponent(projectId)}/planning/config`, { method: 'PUT', body: JSON.stringify(req) }, signal)).data;
  }

  public async compilePlanningPackage(projectId: string, req: { expectedRevision: number; operationId: string }, signal?: AbortSignal): Promise<PlanningPackageManifest> {
    return (await this.request<PlanningPackageManifest>(`/api/projects/${encodeURIComponent(projectId)}/planning/package`, { method: 'POST', body: JSON.stringify(req) }, signal)).data;
  }

  public planningPackageExportUrl(projectId: string): string {
    return `${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/planning/package/export`;
  }

  public planningPackageFileUrl(projectId: string, name: string): string {
    return `${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/planning/package/files/${encodeURIComponent(name)}`;
  }

  public subscribePlanningEvents(projectId: string, runId: string, onEvent: (event: PlanningEvent) => void): () => void {
    const source = new EventSource(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/planning/runs/${encodeURIComponent(runId)}/events`);
    const receive = (event: MessageEvent) => {
      try { onEvent(JSON.parse(event.data) as PlanningEvent); } catch { /* Only structured events drive this projection. */ }
    };
    source.onmessage = receive;
    source.addEventListener('progress', receive as EventListener);
    return () => source.close();
  }
}

export const defaultApiClient = new ProjectArchitectApiClient();
