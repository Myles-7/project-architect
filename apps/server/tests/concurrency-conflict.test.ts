import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { WorkspaceGuard } from '@project-architect/core';

describe('V1 Concurrency & Race Condition Integrity Tests', () => {
  let tempDir: string;
  let guard: WorkspaceGuard;
  let app: any;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pa-concurrency-test-'));
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

  it('P0: concurrent decision edits on same base revision must yield 1 success (200) and 1 conflict (409)', async () => {
    // 1. Create project (revision: 1)
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Concurrency Project',
        idea: 'Testing race conditions',
        projectId: 'proj-race-test',
      })
      .expect(200);

    const projectId = createRes.body.data.projectId;
    expect(createRes.body.stateRevision).toBe(1);

    // 2. Concurrently execute two overview edit requests based on revision 1
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/projects/${projectId}/overview/edit`)
        .send({
          sectionId: 'target_user',
          newStatement: 'User statement A',
          expectedRevision: 1,
        }),
      request(app)
        .post(`/api/projects/${projectId}/overview/edit`)
        .send({
          sectionId: 'mvp_scope',
          newStatement: 'Scope statement B',
          expectedRevision: 1,
        }),
    ]);

    const statuses = [resA.status, resB.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const conflictRes = resA.status === 409 ? resA : resB;
    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.error.code).toBe('STATE_REVISION_CONFLICT');

    // 3. Verify that the project state has exactly revision 2, not overwritten or corrupted
    const getRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .expect(200);

    expect(getRes.body.stateRevision).toBe(2);
    const confirmedDecisions = getRes.body.data.snapshot.decisions.items.filter(
      (d: any) => d.status === 'confirmed'
    );
    // Exactly 1 was added by winning request + 1 initial from project creation = 2
    expect(confirmedDecisions.length).toBe(2);
  });

  it('P0: concurrent input uploads on same base revision must yield 1 success (200) and 1 conflict (409)', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Concurrent Input Project',
        idea: 'Testing input upload race',
        projectId: 'proj-input-race',
      })
      .expect(200);

    const projectId = createRes.body.data.projectId;
    expect(createRes.body.stateRevision).toBe(1);

    // Concurrently upload 2 files with base revision 1
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({
          kind: 'text',
          filename: 'doc1.md',
          content: '# Doc 1',
          expectedRevision: 1,
        }),
      request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({
          kind: 'text',
          filename: 'doc2.md',
          content: '# Doc 2',
          expectedRevision: 1,
        }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.error.code).toBe('STATE_REVISION_CONFLICT');

    // Verify snapshot revision
    const getRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(getRes.body.stateRevision).toBe(2);
    expect(getRes.body.data.snapshot.metadata.inputRefs.length).toBe(2);
  });
});
