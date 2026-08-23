import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { WorkspaceGuard, ProjectStateEngine, FileStorage } from '@project-architect/core';
import { MockAIProvider, AIOrchestrator } from '@project-architect/agent';
import { ErrorCode } from '@project-architect/contracts';
import type { Express } from 'express';

describe('Phase 4.8.7 Reliability Hardening: Resilient API Server, Error Mapping & Authorization Flow', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let app: Express;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-hardening-487-'));
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
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. HTTP Error Code Mapping: Maps validation, not found, revision conflict, readiness, and provider failures accurately', async () => {
    // 1.1 400 Bad Request (Validation failure)
    const res400 = await request(app)
      .post('/api/projects')
      .send({ name: '' }); // missing idea and empty name
    expect(res400.status).toBe(400);
    expect(res400.body.error.code).toBe(ErrorCode.STATE_VALIDATION_FAILED);

    // Create a valid project for subsequent tests
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Error Map App', idea: 'Testing error codes' });
    expect(createRes.status).toBe(200);
    const projectId = createRes.body.data.projectId;
    const rev = createRes.body.stateRevision;

    // 1.2 404 Not Found
    const res404 = await request(app).get('/api/projects/non-existent-proj-id');
    expect(res404.status).toBe(404);
    expect(res404.body.error.code).toBe(ErrorCode.PROJECT_NOT_FOUND);

    // 1.3 409 Conflict (Stale stateRevision)
    const res409 = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        filename: 'notes.txt',
        content: 'hello',
        expectedRevision: rev + 99, // stale revision
      });
    expect(res409.status).toBe(409);
    expect(res409.body.error.code).toBe(ErrorCode.STATE_REVISION_CONFLICT);

    // 1.4 422 Unprocessable (Readiness not approved)
    // Move to readiness review
    await request(app).post(`/api/projects/${projectId}/readiness/review`).send({});
    const res422 = await request(app)
      .post(`/api/projects/${projectId}/documents/generate`)
      .send({ expectedRevision: rev + 1 });
    expect(res422.status).toBe(422);
    expect(res422.body.error.code).toBe(ErrorCode.READINESS_NOT_APPROVED);
  });

  it('2. Registry Persistence: Server restart recovers recent projects list from workspace JSON', async () => {
    // 1. Create 2 projects in app1
    await request(app)
      .post('/api/projects')
      .send({ name: 'Project Alpha', idea: 'First app' });
    await request(app)
      .post('/api/projects')
      .send({ name: 'Project Beta', idea: 'Second app' });

    // 2. Create app2 with new instances but same workspace root
    const app2 = createApp({
      guard,
      workspaceRoot,
      engine: new ProjectStateEngine(storage, guard),
      useMockAI: true,
    });

    // 3. Query list recent projects on app2
    const listRes = await request(app2).get('/api/projects');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.projects.length).toBe(2);
    const names = listRes.body.data.projects.map((p: any) => p.name);
    expect(names).toContain('Project Alpha');
    expect(names).toContain('Project Beta');
  });

  it('3. Provider Failure Sanitization: 502/504 errors do not leak raw envelope, prompts, or stack traces', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Secure Provider Project', idea: 'Safety test' });
    const projectId = createRes.body.data.projectId;
    const rev = createRes.body.stateRevision;

    // Simulate provider failure
    mockProvider.setMockResponse(null as any);

    const failRes = await request(app)
      .post(`/api/projects/${projectId}/discovery`)
      .send({ userMessage: 'Trigger failure', expectedRevision: rev });

    expect(failRes.status).toBe(502);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error).toBeDefined();

    // Sensitive details must be stripped
    const details = failRes.body.error.details || {};
    expect(details.rawEnvelope).toBeUndefined();
    expect(details.prompt).toBeUndefined();
    expect(details.stack).toBeUndefined();
    expect(failRes.body.error.message).not.toContain('C:\\');
    expect(failRes.body.error.message).not.toContain('/Users/');
  });

  it('4. Full Lifecycle & Document Flow: Readiness Review -> Disposition -> Document Compile -> Read Document', async () => {
    // 1. Create project & add core decisions
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'E2E Flow App', idea: 'Comprehensive lifecycle' });
    const projectId = createRes.body.data.projectId;
    let rev = createRes.body.stateRevision;

    const snap0 = (await request(app).get(`/api/projects/${projectId}`)).body.data.snapshot;
    const pPath = guard.resolveProjectPath(projectId);
    await engine.addDecision(pPath, 'target_user', 'Engineers', snap0.metadata.stateRevision, 'confirmed');
    const snap1 = (await request(app).get(`/api/projects/${projectId}`)).body.data.snapshot;
    await engine.addDecision(pPath, 'mvp_scope', 'Local compiler', snap1.metadata.stateRevision, 'confirmed');
    const snap2 = (await request(app).get(`/api/projects/${projectId}`)).body.data.snapshot;
    rev = snap2.metadata.stateRevision;

    // 2. Evaluate readiness
    const reviewRes = await request(app)
      .post(`/api/projects/${projectId}/readiness/review`)
      .send({ expectedRevision: rev });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.projectSnapshot.metadata.stage).toBe('readiness-review');
    rev = reviewRes.body.stateRevision;

    // 3. User Disposition: Approve
    const approveRes = await request(app)
      .post(`/api/projects/${projectId}/readiness/approve`)
      .send({
        disposition: 'approved',
        expectedRevision: rev,
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.snapshot.metadata.stage).toBe('approved');
    rev = approveRes.body.stateRevision;

    // 4. Generate Documents
    const genRes = await request(app)
      .post(`/api/projects/${projectId}/documents/generate`)
      .send({ expectedRevision: rev });
    expect(genRes.status).toBe(200);
    expect(genRes.body.data.manifest.items.length).toBeGreaterThan(0);

    // 5. Read Document
    const readRes = await request(app)
      .post(`/api/projects/${projectId}/documents/read`)
      .send({ docPath: 'AGENTS.md' });
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.content).toContain('Coding Agent Guidelines');
  });
});
