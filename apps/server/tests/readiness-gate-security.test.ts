import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { WorkspaceGuard } from '@project-architect/core';

describe('V1 Readiness Gate & Documents Security Tests', () => {
  let tempDir: string;
  let guard: WorkspaceGuard;
  let app: any;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pa-gate-security-test-'));
    guard = new WorkspaceGuard(tempDir);
    app = createApp({
      guard,
      projectsDir: tempDir,
      workspaceRoot: tempDir,
      useMockAI: true,
    });
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('P0: unreviewed and not-ready project cannot be approved and cannot generate documents', async () => {
    // 1. Create blank project (revision: 1)
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Gate Project',
        idea: 'Gate security testing',
        projectId: 'proj-gate-test',
      })
      .expect(200);

    const projectId = createRes.body.data.projectId;

    // 2. Attempt to directly approve with disposition "approved" -> must be rejected with 422
    const approveRes = await request(app)
      .post(`/api/projects/${projectId}/readiness/approve`)
      .send({
        disposition: 'approved',
        expectedRevision: 1,
      })
      .expect(410);

    expect(approveRes.body.success).toBe(false);
    expect(approveRes.body.error.code).toBe('LEGACY_WORKFLOW_RETIRED');

    // 3. Attempt to generate documents directly -> must be rejected with 422
    const genRes = await request(app)
      .post(`/api/projects/${projectId}/documents/generate`)
      .send({
        expectedRevision: 1,
        operationId: 'unapproved-package',
      })
      .expect(422);

    expect(genRes.body.success).toBe(false);
    expect(genRes.body.error.code).toBe('STAGE_NOT_APPROVED');
  });

  it('P1: documents read endpoint strictly blocks non-registered files (403 ACCESS_DENIED)', async () => {
    // 1. Create project
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Security Read Project',
        idea: 'Document read boundary testing',
        projectId: 'proj-sec-test',
      })
      .expect(200);

    const projectId = createRes.body.data.projectId;

    // 2. Attempt to read internal project.json -> must be blocked with 403
    const readProjJson = await request(app)
      .post(`/api/projects/${projectId}/documents/read`)
      .send({
        docPath: 'project.json',
      })
      .expect(403);

    expect(readProjJson.body.success).toBe(false);
    expect(readProjJson.body.error.code).toBe('ACCESS_DENIED');

    // 3. Attempt to read state/decisions.json -> must be blocked with 403
    const readState = await request(app)
      .post(`/api/projects/${projectId}/documents/read`)
      .send({
        docPath: 'state/decisions.json',
      })
      .expect(403);

    expect(readState.body.success).toBe(false);
    expect(readState.body.error.code).toBe('ACCESS_DENIED');

    // 4. Attempt path traversal '../project.json' -> must be blocked with 403
    const readTraversal = await request(app)
      .post(`/api/projects/${projectId}/documents/read`)
      .send({
        docPath: '../project.json',
      })
      .expect(403);

    expect(readTraversal.body.success).toBe(false);
    expect(readTraversal.body.error.code).toBe('ACCESS_DENIED');
  });
});
