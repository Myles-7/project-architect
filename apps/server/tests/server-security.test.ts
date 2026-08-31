import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { join, resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { createApp, resolveRepositoryRoot } from '../src/server.js';
import { FileStorage, ProjectStateEngine, WorkspaceGuard } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';

describe('Server Security & Hardening Tests (Phase 4.8.1)', () => {
  let app: any;
  let testProjectDir: string;
  let mockProvider: MockAIProvider;
  let engine: ProjectStateEngine;
  let orchestrator: AIOrchestrator;
  const storage = new FileStorage();

  it('resolves active B3 agent assets from the repository root when the server runs from apps/server', async () => {
    const repositoryRoot = resolveRepositoryRoot(resolve(process.cwd(), 'apps', 'server', 'dist'));

    expect(repositoryRoot).toBe(process.cwd());
    await expect(
      access(
        resolve(repositoryRoot, 'experiments', 'agent-benchmark', 'schemas', 'b3-discovery.schema.json'),
        constants.R_OK
      )
    ).resolves.toBeUndefined();
  });

  beforeEach(() => {
    testProjectDir = join(tmpdir(), `pa-sec-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const guard = new WorkspaceGuard(testProjectDir);
    engine = new ProjectStateEngine(storage, guard);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);
    app = createApp({ engine, orchestrator, guard, useMockAI: true, workspaceRoot: testProjectDir });
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('1. Localhost CORS: Allows legitimate local development origins (localhost, 127.0.0.1, vscode-webview)', async () => {
    const resLocalhost = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(resLocalhost.status).toBe(200);
    expect(resLocalhost.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const res127 = await request(app)
      .get('/api/health')
      .set('Origin', 'http://127.0.0.1:3000');

    expect(res127.status).toBe(200);
    expect(res127.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');

    const resWebview = await request(app)
      .get('/api/health')
      .set('Origin', 'vscode-webview://webview-panel-id');

    expect(resWebview.status).toBe(200);
    expect(resWebview.headers['access-control-allow-origin']).toBe('vscode-webview://webview-panel-id');
  });

  it('2. CORS Protection: Rejects unauthorized non-localhost origins', async () => {
    const resEvil = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil-attacker.com');

    expect(resEvil.status).toBe(403);
    expect(resEvil.body.success).toBe(false);
    expect(resEvil.body.error.message).toContain('CORS policy blocked');
    expect(resEvil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('3. Error Sanitization: API error responses never leak raw provider envelopes or internal prompts', async () => {
    // 1. Create a project
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Sanitization Test Project',
        idea: 'Testing error responses',
        projectId: 'proj-sec-sanitization',
        projectTags: ['Utility'],
      });
    expect(createRes.status).toBe(200);
    const { projectId } = createRes.body.data;

    // 2. Set mock provider to fail with simulated raw envelope
    mockProvider.setMockResponse(null);

    const discRes = await request(app)
      .post(`/api/projects/${projectId}/discovery`)
      .send({
        userMessage: 'Trigger validation failure',
        expectedRevision: 1,
      });

    // 3. Verify response status (502 Bad Gateway for provider failure) and that no rawEnvelope is present
    expect(discRes.status).toBe(502);
    expect(discRes.body.success).toBe(false);
    expect(discRes.body.error).toBeDefined();
    expect(discRes.body.error.details?.rawEnvelope).toBeUndefined();
    expect(discRes.body.error.details?.rawDiagnostics).toBeUndefined();
    expect(discRes.body.error.details?.prompt).toBeUndefined();
  });
});
