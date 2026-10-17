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

describe('Phase 4.9.2b: Read-Only Projection Endpoints', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let app: Express;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-proj-endpoints-'));
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

  it('1. Read Projections Lifecycle: Overview, Readiness, Documents, Timeline endpoints return pure projections', async () => {
    // 1. Create project
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Projection App', idea: 'Testing read projections' });
    expect(createRes.status).toBe(200);
    const projectId = createRes.body.data.projectId;
    const initialRev = createRes.body.stateRevision;

    // Add a confirmed decision
    const pPath = guard.resolveProjectPath(projectId);
    await engine.addDecision(pPath, 'target_user', 'Engineers', initialRev, 'confirmed');

    // 2. GET /api/projects/:id/overview
    const overviewRes = await request(app).get(`/api/projects/${projectId}/overview`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.success).toBe(true);
    expect(overviewRes.body.stateRevision).toBe(initialRev + 1);
    expect(overviewRes.body.data.projectId).toBe(projectId);
    expect(overviewRes.body.data.sourceStateRevision).toBe(initialRev + 1);
    expect(overviewRes.body.data.totalConfirmedDecisions).toBe(1);
    const userSection = overviewRes.body.data.sections.find((s: any) => s.id === 'target_user');
    expect(userSection.items[0].statement).toBe('Engineers');
    expect(userSection.items[0].status).toBe('confirmed');

    // 3. GET /api/projects/:id/readiness
    const readinessRes = await request(app).get(`/api/projects/${projectId}/readiness`);
    expect(readinessRes.status).toBe(200);
    expect(readinessRes.body.success).toBe(true);
    expect(readinessRes.body.data.level).toBeDefined();
    expect(readinessRes.body.data.score).toBeDefined();
    expect(readinessRes.body.data.sourceStateRevision).toBe(initialRev + 1);

    // 4. GET /api/projects/:id/documents
    const docsRes = await request(app).get(`/api/projects/${projectId}/documents`);
    expect(docsRes.status).toBe(200);
    expect(docsRes.body.success).toBe(true);
    expect(docsRes.body.data.hasCompiledDocs).toBe(false);
    expect(docsRes.body.data.items).toEqual([]);

    // 5. GET /api/projects/:id/timeline
    const timelineRes = await request(app).get(`/api/projects/${projectId}/timeline`);
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.success).toBe(true);
    expect(timelineRes.body.data.totalEvents).toBeGreaterThanOrEqual(2); // create + decision
    expect(timelineRes.body.data.events[0].kind).toBe('project_created');
  });

  it('2. Immutability & Concurrency: Read endpoints do NOT bump stateRevision', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Revision App', idea: 'Checking revision stability' });
    const projectId = createRes.body.data.projectId;
    const revBefore = createRes.body.stateRevision;

    // Call all read endpoints multiple times
    await request(app).get(`/api/projects/${projectId}/overview`);
    await request(app).get(`/api/projects/${projectId}/readiness`);
    await request(app).get(`/api/projects/${projectId}/documents`);
    await request(app).get(`/api/projects/${projectId}/timeline`);
    await request(app).get(`/api/projects/${projectId}`); // Snapshot

    const snapRes = await request(app).get(`/api/projects/${projectId}`);
    expect(snapRes.body.stateRevision).toBe(revBefore);
    expect(snapRes.body.data.snapshot.metadata.stateRevision).toBe(revBefore);
  });

  it('3. Error Handling: Read endpoints return 404 for non-existent project', async () => {
    const res404Overview = await request(app).get('/api/projects/non-existent-proj/overview');
    expect(res404Overview.status).toBe(404);
    expect(res404Overview.body.error.code).toBe(ErrorCode.PROJECT_NOT_FOUND);

    const res404Readiness = await request(app).get('/api/projects/non-existent-proj/readiness');
    expect(res404Readiness.status).toBe(404);

    const res404Docs = await request(app).get('/api/projects/non-existent-proj/documents');
    expect(res404Docs.status).toBe(404);

    const res404Timeline = await request(app).get('/api/projects/non-existent-proj/timeline');
    expect(res404Timeline.status).toBe(404);
  });
});
