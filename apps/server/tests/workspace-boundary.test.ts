import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { FileStorage, ProjectStateEngine, WorkspaceGuard } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';

describe('Server Workspace Boundary & Path Traversal Tests (Phase 4.8.2)', () => {
  let tempWorkspace: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let orchestrator: AIOrchestrator;
  let mockProvider: MockAIProvider;
  let app: any;

  beforeEach(async () => {
    tempWorkspace = await mkdtemp(join(tmpdir(), 'pa-srv-ws-'));
    guard = new WorkspaceGuard(tempWorkspace);
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage, guard);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);
    app = createApp({ engine, orchestrator, guard, useMockAI: true });
  });

  afterEach(async () => {
    await rm(tempWorkspace, { recursive: true, force: true });
  });

  it('1. Rejects project creation with traversal in projectId or outside workspace projectPath', async () => {
    // Attempt with traversal in projectId
    const resBadId = await request(app)
      .post('/api/projects')
      .send({
        name: 'Evil Project',
        idea: 'Attempting traversal',
        projectId: '../escaped-project',
      });

    expect(resBadId.status).toBe(400);
    expect(resBadId.body.success).toBe(false);
    expect(resBadId.body.error.message).toContain('Invalid project ID');

    // Attempt with external projectPath
    const resBadPath = await request(app)
      .post('/api/projects')
      .send({
        name: 'Evil Project 2',
        idea: 'Attempting external path',
        projectPath: join(tempWorkspace, '..', 'external-dir'),
      });

    expect(resBadPath.status).toBe(400);
    expect(resBadPath.body.success).toBe(false);
    expect(resBadPath.body.error.message).toContain('traversal rejected');
  });

  it('2. Rejects opening projects located outside the configured workspace', async () => {
    const res = await request(app)
      .post('/api/projects/open')
      .send({
        projectPath: process.platform === 'win32' ? 'C:\\Windows' : '/etc',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('traversal rejected');
  });

  it('3. Rejects input file uploads with path traversal in filename', async () => {
    // 1. Create a legitimate project first
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Input Guard Project',
        idea: 'Testing input filename guard',
        projectId: 'proj-safe-01',
      });

    expect(createRes.status).toBe(200);
    const { projectId } = createRes.body.data;

    // 2. Attempt uploading with traversal in filename
    const uploadRes = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        kind: 'text',
        filename: '../../escaped.txt',
        content: 'Malicious payload',
      });

    expect(uploadRes.status).toBe(400);
    expect(uploadRes.body.success).toBe(false);
    expect(uploadRes.body.error.message).toContain('Invalid filename');
  });

  it('4. Successfully manages projects and inputs using legitimate projectIds and filenames', async () => {
    // 1. Create project
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Valid Project',
        idea: 'Clean workspace execution',
        projectId: 'proj-valid-100',
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.projectId).toBe('proj-valid-100');

    // 2. Add valid input
    const inputRes = await request(app)
      .post('/api/projects/proj-valid-100/inputs')
      .send({
        kind: 'text',
        filename: 'requirements.txt',
        content: 'Legitimate product requirement',
      });

    expect(inputRes.status).toBe(200);
    expect(inputRes.body.success).toBe(true);
    expect(inputRes.body.data.inputRef.label).toBe('requirements.txt');

    // 3. Open project via safe projectId
    const openRes = await request(app)
      .post('/api/projects/open')
      .send({
        projectId: 'proj-valid-100',
      });

    expect(openRes.status).toBe(200);
    expect(openRes.body.success).toBe(true);
    expect(openRes.body.data.snapshot.metadata.projectId).toBe('proj-valid-100');
  });
});
