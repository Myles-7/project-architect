import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/server.js';
import { FileStorage, ProjectStateEngine, WorkspaceGuard } from '@project-architect/core';
import { AIOrchestrator, type AIProvider } from '@project-architect/agent';
import type { AIProviderRequest, DiscoveryResult, StructuredResult } from '@project-architect/contracts';

const discoveryOutput: DiscoveryResult = {
  confirmed: [], candidates: [], assumptions: [], unknowns: [], risks: [], conflicts: [], tensions: [],
  gaps: [], questions: [],
};

class DeferredProvider implements AIProvider {
  readonly name = 'deferred-test-provider';
  private pending: Array<(result: StructuredResult<DiscoveryResult>) => void> = [];
  private nextOutput: DiscoveryResult = discoveryOutput;

  setOutput(output: DiscoveryResult): void { this.nextOutput = output; }

  async complete<T = unknown>(request: AIProviderRequest): Promise<StructuredResult<T>> {
    return new Promise<StructuredResult<T>>((resolve) => {
      const resolveCancelled = () => resolve({
        status: 'cancelled', structuredSuccess: false, structuredOutput: null, rawEnvelope: null,
        stderr: 'cancelled', exitCode: null, durationMs: 1,
        usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0, cacheReadTokens: 0 },
        provider: this.name,
      });
      if (request.abortSignal?.aborted) return resolveCancelled();
      request.abortSignal?.addEventListener('abort', resolveCancelled, { once: true });
      this.pending.push(resolve as (result: StructuredResult<DiscoveryResult>) => void);
    });
  }

  releaseNext(): void {
    const resolve = this.pending.shift();
    if (!resolve) throw new Error('No background provider call is pending.');
    resolve({
      status: 'success', structuredSuccess: true, structuredOutput: this.nextOutput, rawEnvelope: null,
      stderr: null, exitCode: 0, durationMs: 1,
      usage: { inputTokens: 1, outputTokens: 1, thinkingTokens: 1, totalTokens: 3, cacheReadTokens: 0 },
      provider: this.name,
    });
  }

  get pendingCount(): number { return this.pending.length; }
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for background discovery state.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Background discovery jobs', () => {
  let tempDir: string;
  let app: any;
  let provider: DeferredProvider;
  const storage = new FileStorage();

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pa-discovery-job-'));
    const guard = new WorkspaceGuard(tempDir);
    const engine = new ProjectStateEngine(storage, guard);
    provider = new DeferredProvider();
    const orchestrator = new AIOrchestrator(provider, engine, process.cwd(), storage);
    app = createApp({ guard, engine, orchestrator, workspaceRoot: tempDir, projectsDir: tempDir });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('keeps user decisions, discards stale AI results, and cancels a running job', async () => {
    const created = await request(app).post('/api/projects').send({
      name: 'Background discovery', idea: 'A local planning tool', projectId: 'proj-background-job',
    }).expect(200);
    const projectId = created.body.data.projectId;

    const scheduled = await request(app).post(`/api/projects/${projectId}/discovery/jobs`)
      .send({ expectedRevision: 1 }).expect(200);
    expect(scheduled.body.data.job.status).toBe('queued');
    await waitFor(() => provider.pendingCount === 1);

    await request(app).post(`/api/projects/${projectId}/overview/edit`).send({
      sectionId: 'mvp_scope', newStatement: 'First release is offline only.', expectedRevision: 1,
    }).expect(200);

    provider.releaseNext();
    await waitFor(async () => {
      const status = await request(app).get(`/api/projects/${projectId}/discovery/jobs/current`).expect(200);
      return status.body.data.job.status === 'stale';
    });

    const afterStale = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(afterStale.body.stateRevision).toBe(2);
    expect(afterStale.body.data.snapshot.decisions.items.some((item: any) => item.statement === 'First release is offline only.')).toBe(true);

    await request(app).post(`/api/projects/${projectId}/discovery/jobs`)
      .send({ expectedRevision: 2 }).expect(200);
    await waitFor(() => provider.pendingCount === 1);

    const cancelled = await request(app).post(`/api/projects/${projectId}/discovery/jobs/cancel`).send({}).expect(200);
    expect(cancelled.body.data.job.status).toBe('cancelled');

    const afterCancel = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(afterCancel.body.stateRevision).toBe(2);
  });

  it('pre-persists user input, runs discovery turn with turnId, and records complete turn history', async () => {
    const created = await request(app).post('/api/projects').send({
      name: 'Persistence flow test',
      idea: 'Desktop local markdown editor',
      projectId: 'proj-persist-flow',
    }).expect(200);
    const projectId = created.body.data.projectId;

    // 1. Record free input
    const inputRes = await request(app)
      .post(`/api/projects/${projectId}/discovery/inputs`)
      .send({
        text: 'User requests offline canvas editor with zero telemetry',
        expectedRevision: 1,
      })
      .expect(201);

    expect(inputRes.body.data.inputRef).toMatch(/^input:/);
    expect(inputRes.body.data.turnId).toMatch(/^turn-/);
    expect(inputRes.body.stateRevision).toBe(2);

    const turnId = inputRes.body.data.turnId;

    // 2. Schedule job with turnId
    const scheduled = await request(app)
      .post(`/api/projects/${projectId}/discovery/jobs`)
      .send({
        expectedRevision: 2,
        turnId,
      })
      .expect(200);

    expect(scheduled.body.data.job.status).toBe('queued');
    await waitFor(() => provider.pendingCount === 1);

    provider.releaseNext();
    await waitFor(async () => {
      const status = await request(app).get(`/api/projects/${projectId}/discovery/jobs/current`).expect(200);
      return status.body.data.job.status === 'completed';
    });

    // 3. Fetch turns
    const turnsRes = await request(app)
      .get(`/api/projects/${projectId}/discovery/turns`)
      .expect(200);

    expect(turnsRes.body.data.turns.length).toBe(1);
    const turn = turnsRes.body.data.turns[0];
    expect(turn.id).toBe(turnId);
    expect(turn.status).toBe('completed');
    expect(turn.inputRef).toBe(inputRes.body.data.inputRef);
  });

  it('records only suggestion refs created by the current turn', async () => {
    const created = await request(app).post('/api/projects').send({
      name: 'Accepted refs delta', idea: 'Local document utility', projectId: 'proj-accepted-ref-delta',
    }).expect(200);
    const projectId = created.body.data.projectId;
    const candidateA = {
      decision_key: 'pdf_export', area: 'core_features' as const,
      statement: 'Support exporting documents to PDF format', rationale: 'Useful delivery format',
    };
    const candidateB = {
      decision_key: 'docx_export', area: 'core_features' as const,
      statement: 'Support exporting documents to DOCX format', rationale: 'Useful editing format',
    };

    const runTurn = async (text: string, expectedRevision: number, candidates: DiscoveryResult['candidates']) => {
      const input = await request(app).post(`/api/projects/${projectId}/discovery/inputs`)
        .send({ text, expectedRevision }).expect(201);
      provider.setOutput({ ...discoveryOutput, candidates });
      await request(app).post(`/api/projects/${projectId}/discovery/jobs`)
        .send({ expectedRevision: expectedRevision + 1, turnId: input.body.data.turnId }).expect(200);
      await waitFor(() => provider.pendingCount === 1);
      provider.releaseNext();
      await waitFor(async () => {
        const status = await request(app).get(`/api/projects/${projectId}/discovery/jobs/current`).expect(200);
        return status.body.data.job.status === 'completed';
      });
      return input.body.data.turnId as string;
    };

    const firstTurnId = await runTurn('First suggestion', 1, [candidateA]);
    const secondTurnId = await runTurn('Second suggestion', 3, [candidateA, candidateB]);
    const turns = (await request(app).get(`/api/projects/${projectId}/discovery/turns`).expect(200)).body.data.turns;
    const first = turns.find((turn: any) => turn.id === firstTurnId);
    const second = turns.find((turn: any) => turn.id === secondTurnId);

    expect(first.acceptedRefs).toHaveLength(1);
    expect(second.acceptedRefs).toHaveLength(1);
    expect(second.acceptedRefs[0]).not.toBe(first.acceptedRefs[0]);
  });
});
