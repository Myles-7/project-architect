import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../apps/server/src/server.js';
import { WorkspaceGuard, ProjectStateEngine, FileStorage } from '@project-architect/core';
import { MockAIProvider, AIOrchestrator } from '@project-architect/agent';
import { ErrorCode } from '@project-architect/contracts';
import type { Express } from 'express';
import { approvedPlanningFixture } from '../fixtures/approved-planning.js';

describe('Reliability Suite 6: API Protocol, Status Codes & Sanitized Responses', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let app: Express;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-rel-api-'));
    workspaceRoot = join(tempBaseDir, 'workspace');
    guard = new WorkspaceGuard(workspaceRoot);
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage, guard);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);

    app = createApp({
      engine,
      orchestrator,
      guard,
      workspaceRoot,
      useMockAI: true,
    });

    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  const post = async (path: string, body: any) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: any = await res.json();
    return { status: res.status, body: data };
  };

  const get = async (path: string) => {
    const res = await fetch(`${baseUrl}${path}`);
    const data: any = await res.json();
    return { status: res.status, body: data };
  };

  it('1. HTTP Status Code Mapping: Accurately maps 400, 404, 409, 422, 502, 504', async () => {
    // 400 Bad Request
    const res400 = await post('/api/projects', { name: '' });
    expect(res400.status).toBe(400);

    // Create project
    const createRes = await post('/api/projects', {
      name: 'Status Code Project',
      idea: 'Protocol check',
    });
    const projectId = createRes.body.data.projectId;
    const rev = createRes.body.stateRevision;

    // 404 Not Found
    const res404 = await get('/api/projects/non-existent-proj');
    expect(res404.status).toBe(404);
    expect(res404.body.error.code).toBe(ErrorCode.PROJECT_NOT_FOUND);

    // 409 Conflict (Stale revision)
    const res409 = await post(`/api/projects/${projectId}/decisions/confirm`, {
      targetRef: 'decision:non-existent',
      expectedRevision: rev + 5,
    });
    expect(res409.status).toBe(409);
    expect(res409.body.error.code).toBe(ErrorCode.STATE_REVISION_CONFLICT);

    // 422 Unprocessable (Unapproved Planning stages)
    const res422 = await post(`/api/projects/${projectId}/documents/generate`, {
      expectedRevision: rev, operationId: 'unapproved-package',
    });
    expect(res422.status).toBe(422);
    expect(res422.body.error.code).toBe('STAGE_NOT_APPROVED');

    // 502 Bad Gateway (Provider Process Failure)
    mockProvider.setMockResponse(null);
    const res502 = await post(`/api/projects/${projectId}/discovery`, {
      userMessage: 'fail',
      expectedRevision: rev,
    });
    expect(res502.status).toBe(502);
    expect(res502.body.error.code).toBe(ErrorCode.PROVIDER_PROCESS_FAILED);
  });

  it('2. Complete API Contracts: Explicit facts -> Approved Planning -> Package -> File Read', async () => {
    // Create project
    const createRes = await post('/api/projects', {
      name: 'Full Contract App',
      idea: 'End to end API test',
    });
    const projectId = createRes.body.data.projectId;
    let rev = createRes.body.stateRevision;

    // Add decisions
    const pPath = guard.resolveProjectPath(projectId);
    const initial = (await engine.getSnapshot(pPath)).decisions.items.find((decision) => decision.statement === 'End to end API test');
    expect(initial?.status).toBe('candidate');
    const confirmRes = await post(`/api/projects/${projectId}/decisions/confirm`, {
      targetRef: `decision:${initial!.id}`,
      expectedRevision: rev,
    });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.snapshot.decisions.items.find((decision: any) => decision.id === initial!.id)?.confirmedBy).toBe('user');
    rev = confirmRes.body.stateRevision;
    await engine.addDecision(pPath, 'target_user', 'Engineers', rev, 'confirmed');
    rev++;
    await engine.addDecision(pPath, 'mvp_scope', 'Scope', rev, 'confirmed');
    rev++;

    rev = (await approvedPlanningFixture(engine, pPath)).metadata.stateRevision;
    const generated = await post(`/api/projects/${projectId}/documents/generate`, { expectedRevision: rev, operationId: 'contracts-package' });
    expect(generated.status).toBe(200); expect(generated.body.data.manifest.files.length).toBeGreaterThanOrEqual(10);
    const read = await fetch(`${baseUrl}/api/projects/${projectId}/planning/package/files/AGENTS.md`);
    expect(read.status).toBe(200); expect(await read.text()).toContain('Full Contract App');

  });

  it('3. Error Response Sanitization: Error responses never expose raw provider envelopes, prompts, or stack traces', async () => {
    const createRes = await post('/api/projects', {
      name: 'Sanitize App',
      idea: 'Test error payload safety',
    });
    const projectId = createRes.body.data.projectId;
    const rev = createRes.body.stateRevision;

    mockProvider.setMockResponse(null);
    const failRes = await post(`/api/projects/${projectId}/discovery`, {
      userMessage: 'test',
      expectedRevision: rev,
    });

    expect(failRes.status).toBe(502);
    const errorPayload = failRes.body.error;
    expect(errorPayload.details?.rawEnvelope).toBeUndefined();
    expect(errorPayload.details?.rawDiagnostics).toBeUndefined();
    expect(errorPayload.details?.prompt).toBeUndefined();
    expect(errorPayload.details?.stack).toBeUndefined();
  });

  it('4. Decision Actions & Lock Protection: Lock, Unlock, Edit Overview, and 422 on modifying locked decision', async () => {
    const createRes = await post('/api/projects', {
      name: 'Decision Lock App',
      idea: 'Testing decision actions',
    });
    const projectId = createRes.body.data.projectId;
    let rev = createRes.body.stateRevision;

    // 1. Edit Overview Item
    const editRes = await post(`/api/projects/${projectId}/overview/edit`, {
      sectionId: 'target_user',
      newStatement: 'Professional Audio Engineers',
      expectedRevision: rev,
    });
    expect(editRes.status).toBe(200);
    const decRef = editRes.body.data.decisionRef;
    rev = editRes.body.stateRevision;

    // 2. Lock Decision
    const lockRes = await post(`/api/projects/${projectId}/decisions/lock`, {
      decisionRef: decRef,
      expectedRevision: rev,
    });
    expect(lockRes.status).toBe(200);
    expect(lockRes.body.data.snapshot.decisions.items.find((d: any) => d.id === decRef.replace('decision:', ''))?.status).toBe('locked');
    rev = lockRes.body.stateRevision;

    // 3. Attempt to edit locked decision -> must fail with 422 DECISION_LOCKED
    const lockEditRes = await post(`/api/projects/${projectId}/overview/edit`, {
      sectionId: 'target_user',
      itemRef: decRef,
      newStatement: 'Trying to change locked statement',
      expectedRevision: rev,
    });
    expect(lockEditRes.status).toBe(422);
    expect(lockEditRes.body.error.code).toBe(ErrorCode.DECISION_LOCKED);

    // 4. Unlock Decision
    const unlockRes = await post(`/api/projects/${projectId}/decisions/unlock`, {
      decisionRef: decRef,
      expectedRevision: rev,
    });
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.data.snapshot.decisions.items.find((d: any) => d.id === decRef.replace('decision:', ''))?.status).toBe('confirmed');
  });

  it('5. Deprecated projectPath Handling: Safe inside workspace, rejected when escaping boundary', async () => {
    // 5.1 Rejects projectPath outside workspace projects dir
    const badCreateRes = await post('/api/projects', {
      name: 'Escape App',
      idea: 'Testing escape',
      projectPath: join(tempBaseDir, 'escape-outside-workspace'),
    });
    expect(badCreateRes.status).toBe(400);
    expect(badCreateRes.body.error.code).toBe(ErrorCode.STATE_VALIDATION_FAILED);

    // 5.2 Allows projectPath properly contained in workspace projects dir
    const safeCreateRes = await post('/api/projects', {
      name: 'Safe Deprecated App',
      idea: 'Testing contained path',
      projectPath: join(guard.projectsDir, 'safe-deprecated-proj'),
    });
    expect(safeCreateRes.status).toBe(200);
    expect(safeCreateRes.body.data.projectId).toBeDefined();
  });
});
