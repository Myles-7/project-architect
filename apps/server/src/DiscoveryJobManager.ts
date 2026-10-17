import type { AIOrchestrator } from '@project-architect/agent';
import type { DiscoveryJobView, ProjectSnapshot } from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';
import { DiscoveryTurnStore, FileStorage, type ProjectStateEngine } from '@project-architect/core';

interface ActiveDiscoveryJob {
  view: DiscoveryJobView;
  controller: AbortController;
  projectPath: string;
  userMessage?: string;
  turnId?: string;
  allowRebase?: boolean;
  baselineSuggestionRefs: Set<string>;
}

/**
 * Runs at most one advisory discovery turn per project in the local server.
 * Integrates with DiscoveryTurnStore for immutable turn logs.
 */
export class DiscoveryJobManager {
  private readonly jobs = new Map<string, ActiveDiscoveryJob>();
  private readonly turnStore: DiscoveryTurnStore;

  constructor(
    private readonly orchestrator: AIOrchestrator,
    private readonly getSnapshot: (projectPath: string) => Promise<ProjectSnapshot>,
    turnStore?: DiscoveryTurnStore,
    private readonly stateEngine?: ProjectStateEngine,
  ) {
    this.turnStore = turnStore || new DiscoveryTurnStore(new FileStorage());
  }

  async schedule(
    projectId: string,
    projectPath: string,
    expectedRevision: number,
    userMessage?: string,
    turnId?: string,
    allowRebase = false,
  ): Promise<DiscoveryJobView> {
    const snapshot = await this.getSnapshot(projectPath);
    if (snapshot.metadata.stateRevision !== expectedRevision) {
      throw this.revisionConflict(expectedRevision, snapshot.metadata.stateRevision);
    }

    const existing = this.jobs.get(projectId);
    if (existing && (existing.view.status === 'queued' || existing.view.status === 'running')) {
      return { ...existing.view };
    }

    let effectiveUserMessage = userMessage;
    let activeTurnId = turnId;

    if (activeTurnId && !effectiveUserMessage && this.stateEngine) {
      const turns = await this.turnStore.loadTurns(projectPath);
      const turn = turns.find((t) => t.id === activeTurnId);
      if (turn?.inputRef) {
        effectiveUserMessage = await this.stateEngine.readInputContent(projectPath, turn.inputRef);
      }
    }

    if (!activeTurnId) {
      const turns = await this.turnStore.loadTurns(projectPath);
      const recordedTurn = [...turns].reverse().find((t) => t.status === 'recorded' && t.sourceRevision === expectedRevision);
      if (recordedTurn) {
        activeTurnId = recordedTurn.id;
        if (!effectiveUserMessage && recordedTurn.inputRef && this.stateEngine) {
          effectiveUserMessage = await this.stateEngine.readInputContent(projectPath, recordedTurn.inputRef);
        }
      }
    }

    if (activeTurnId) {
      await this.turnStore.updateTurn(projectPath, activeTurnId, { status: 'queued' }).catch(() => {});
    }

    const job: ActiveDiscoveryJob = {
      view: {
        projectId,
        status: 'queued',
        sourceRevision: expectedRevision,
        createdAt: new Date().toISOString(),
      },
      controller: new AbortController(),
      projectPath,
      userMessage: effectiveUserMessage,
      turnId: activeTurnId,
      allowRebase,
      baselineSuggestionRefs: this.suggestionRefs(snapshot),
    };
    this.jobs.set(projectId, job);

    void Promise.resolve().then(() => this.run(projectPath, job));
    return { ...job.view };
  }

  get(projectId: string): DiscoveryJobView {
    const job = this.jobs.get(projectId);
    return job ? { ...job.view } : { projectId, status: 'idle' };
  }

  cancel(projectId: string): DiscoveryJobView {
    const job = this.jobs.get(projectId);
    if (!job || !['queued', 'running'].includes(job.view.status)) {
      return this.get(projectId);
    }

    job.controller.abort();
    if (job.turnId) {
      void this.turnStore.updateTurn(job.projectPath, job.turnId, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    job.view = {
      ...job.view,
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
      message: '已取消后台整理；已确认的用户决策保持不变。',
    };
    return { ...job.view };
  }

  private async run(projectPath: string, job: ActiveDiscoveryJob): Promise<void> {
    if (job.controller.signal.aborted) return;
    job.view = { ...job.view, status: 'running', startedAt: new Date().toISOString() };
    if (job.turnId) {
      await this.turnStore.updateTurn(projectPath, job.turnId, {
        status: 'running',
        startedAt: job.view.startedAt,
      }).catch(() => {});
    }

    try {
      const result = await this.orchestrator.runDiscoveryTurn(
        projectPath,
        {
          expectedRevision: job.view.sourceRevision!,
          userMessage: job.userMessage,
        },
        undefined,
        job.controller.signal,
        {
          allowRebase: job.allowRebase ?? false,
          onPhaseChange: (phase) => {
            job.view.currentPhase = phase;
          },
        },
      );

      if (job.controller.signal.aborted) {
        if (job.turnId) {
          await this.turnStore.updateTurn(projectPath, job.turnId, {
            status: 'cancelled',
            completedAt: new Date().toISOString(),
          }).catch(() => {});
        }
        return;
      }

      const acceptedRefs = [...this.suggestionRefs(result.snapshot)]
        .filter((ref) => !job.baselineSuggestionRefs.has(ref));

      if (job.turnId) {
        await this.turnStore.updateTurn(projectPath, job.turnId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          providerResult: result.discoveryResult,
          acceptedRefs,
          diagnostics: (result.runTrace?.diagnostics || result.diagnostics) as any,
        }).catch(() => {});
      }

      job.view = {
        ...job.view,
        status: 'completed',
        stateRevisionAfter: result.snapshot.metadata.stateRevision,
        finishedAt: new Date().toISOString(),
        diagnostics: result.diagnostics,
        batchId: result.diagnostics.questionBatch?.id,
        batchStage: result.diagnostics.questionBatch?.stage,
        generatedQuestionCount: result.diagnostics.questionBatch?.generatedQuestionCount,
        questionSelection: result.diagnostics.questionBatch?.selection,
        message: '已根据最新已确认决策整理出下一组建议与问题。',
      };
    } catch (error: any) {
      if (job.controller.signal.aborted || error?.code === ErrorCode.DISCOVERY_CANCELLED) {
        if (job.turnId) {
          await this.turnStore.updateTurn(projectPath, job.turnId, {
            status: 'cancelled',
            completedAt: new Date().toISOString(),
          }).catch(() => {});
        }
        return;
      }
      if (error?.code === ErrorCode.STATE_REVISION_CONFLICT) {
        if (job.turnId) {
          await this.turnStore.updateTurn(projectPath, job.turnId, {
            status: 'stale',
            completedAt: new Date().toISOString(),
          }).catch(() => {});
        }
        job.view = {
          ...job.view,
          status: 'stale',
          finishedAt: new Date().toISOString(),
          message: '整理期间项目已有新决策，旧结果已丢弃；可按最新状态重新整理。',
        };
        return;
      }
      if (job.turnId) {
        await this.turnStore.updateTurn(projectPath, job.turnId, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          errorCode: error?.code || 'UNKNOWN',
        }).catch(() => {});
      }
      job.view = {
        ...job.view,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        message: '后台整理失败；已确认的用户决策保持不变。',
      };
    }
  }

  private revisionConflict(expectedRevision: number, currentRevision: number): Error {
    const error: any = new Error(
      `Revision conflict: expected ${expectedRevision} but found ${currentRevision}`,
    );
    error.code = ErrorCode.STATE_REVISION_CONFLICT;
    return error;
  }

  private suggestionRefs(snapshot: ProjectSnapshot): Set<string> {
    return new Set([
      ...(snapshot.decisions.items || [])
        .filter((decision) => decision.status === 'candidate')
        .map((decision) => `decision:${decision.id}`),
      ...(snapshot.assumptions.items || [])
        .filter((assumption) => assumption.status === 'active')
        .map((assumption) => `assumption:${assumption.id}`),
      ...(snapshot.risks?.items || []).map((risk) => `risk:${risk.id}`),
    ]);
  }
}
