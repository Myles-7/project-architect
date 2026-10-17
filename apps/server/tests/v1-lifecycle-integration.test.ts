import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import type { Express } from 'express';
import { ProjectStateEngine, WorkspaceGuard, FileStorage } from '@project-architect/core';
import { approvedPlanningFixture } from '../../../tests/fixtures/approved-planning.js';

describe('Phase 5.7: V1 End-to-End Lifecycle Integration Test (Real Express & Filesystem Tier)', () => {
  let tempWorkspace: string;
  let app: Express;

  beforeEach(async () => {
    tempWorkspace = await mkdtemp(join(tmpdir(), 'pa-v1-lifecycle-'));
    app = createApp({
      workspaceRoot: tempWorkspace,
      useMockAI: true,
    });
  });

  afterEach(async () => {
    if (tempWorkspace) {
      try {
        await rm(tempWorkspace, { recursive: true, force: true });
      } catch {
        // ignore windows busy cleanup
      }
    }
  });

  it('Executes complete 12-step lifecycle with state persistence and concurrency protection', async () => {
    // 1. Create Project
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Lossless Audio Player',
        idea: 'Local-first offline high-res audio playback engine',
      })
      .expect(200);

    expect(createRes.body.success).toBe(true);
    const projectId = createRes.body.data.projectId;
    let rev = createRes.body.stateRevision;
    expect(projectId).toBeDefined();
    expect(rev).toBe(1);

    // Initial snapshot should contain documents state initialized with empty items
    expect(createRes.body.data.snapshot.documents).toBeDefined();
    expect(createRes.body.data.snapshot.documents.items).toEqual([]);

    // 2. Run Discovery Turn
    const discoveryRes = await request(app)
      .post(`/api/projects/${projectId}/discovery`)
      .send({
        userMessage: 'Support FLAC, ALAC, and DSD playback with WASAPI bit-perfect output',
        expectedRevision: rev,
      })
      .expect(200);

    expect(discoveryRes.body.success).toBe(true);
    rev = discoveryRes.body.stateRevision;
    expect(rev).toBe(2);
    expect(discoveryRes.body.data.discoveryResult).toBeDefined();

    // 3. Answer a Question (if question exists or answer custom)
    const questions = discoveryRes.body.data.snapshot.questions.items;
    if (questions.length > 0) {
      const q = questions[0];
      const answerRes = await request(app)
        .post(`/api/projects/${projectId}/questions/answer`)
        .send({
          questionRef: `question:${q.id}`,
          answer: 'WASAPI Exclusive Mode with zero DSP resampling',
          expectedRevision: rev,
        })
        .expect(200);

      expect(answerRes.body.success).toBe(true);
      rev = answerRes.body.stateRevision;
      expect(rev).toBe(3);
    }

    // 4. Add Input Material (Markdown Text)
    const textInputRes = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        kind: 'text',
        filename: 'architecture.md',
        content: '# Core Audio Architecture\nNative WASAPI exclusive stream decoding.',
        contentEncoding: 'utf8',
        expectedRevision: rev,
      })
      .expect(200);

    expect(textInputRes.body.success).toBe(true);
    expect(textInputRes.body.data.inputRef.analysisAvailability).toBe('available');
    rev = textInputRes.body.stateRevision;

    // 5. Add Input Material (Binary Image in Base64)
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const imageInputRes = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        kind: 'image',
        filename: 'mockup.png',
        content: dummyPngBase64,
        contentEncoding: 'base64',
        expectedRevision: rev,
      })
      .expect(200);

    expect(imageInputRes.body.success).toBe(true);
    expect(imageInputRes.body.data.inputRef.analysisAvailability).toBe('available');
    rev = imageInputRes.body.stateRevision;

    // 6. Concurrency Conflict Defense: Repeat write with stale revision -> 409 Conflict
    const staleRes = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        kind: 'text',
        filename: 'stale.md',
        content: 'stale content',
        expectedRevision: 1, // Deliberately outdated revision
      })
      .expect(409);

    expect(staleRes.body.success).toBe(false);
    expect(staleRes.body.error.code).toBe('STATE_REVISION_CONFLICT');

    // 7. Gate Check: Try to generate documents before user approval -> 422 Unprocessable
    const prematureGenRes = await request(app)
      .post(`/api/projects/${projectId}/documents/generate`)
      .send({
        expectedRevision: rev,
        operationId: 'premature-package',
      })
      .expect(422);

    expect(prematureGenRes.body.success).toBe(false);

    // 7.1 Confirm decisions for core areas
    const editRes1 = await request(app)
      .post(`/api/projects/${projectId}/overview/edit`)
      .send({
        sectionId: 'project_overview',
        newStatement: 'Lossless Audio Player with bit-perfect WASAPI exclusive output',
        expectedRevision: rev,
      })
      .expect(200);
    rev = editRes1.body.stateRevision;

    const editRes2 = await request(app)
      .post(`/api/projects/${projectId}/overview/edit`)
      .send({
        sectionId: 'target_user',
        newStatement: 'Audiophiles and music producers who demand bit-perfect local playback',
        expectedRevision: rev,
      })
      .expect(200);
    rev = editRes2.body.stateRevision;

    const editRes3 = await request(app)
      .post(`/api/projects/${projectId}/overview/edit`)
      .send({
        sectionId: 'mvp_scope',
        newStatement: 'Support FLAC, ALAC, and DSD playback with WASAPI exclusive mode and no DSP',
        expectedRevision: rev,
      })
      .expect(200);
    rev = editRes3.body.stateRevision;

    const editRes4 = await request(app)
      .post(`/api/projects/${projectId}/overview/edit`)
      .send({
        sectionId: 'trust_safety',
        newStatement: 'All audio metadata and library cache stored strictly in local JSON and SQLite files without cloud syncing',
        expectedRevision: rev,
      })
      .expect(200);
    rev = editRes4.body.stateRevision;

    // 8-10. Approve the complete Planning fixture and publish its package.
    const fixtureEngine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(tempWorkspace));
    rev = (await approvedPlanningFixture(fixtureEngine, join(tempWorkspace, 'projects', projectId))).metadata.stateRevision;
    const generated = await request(app).post(`/api/projects/${projectId}/documents/generate`).send({ expectedRevision: rev, operationId: 'lifecycle-package' }).expect(200);
    rev = generated.body.stateRevision;
    expect(generated.body.data.manifest.files.length).toBeGreaterThanOrEqual(10);
    const read = await request(app).get(`/api/projects/${projectId}/planning/package/files/AGENTS.md`).expect(200);
    expect(read.text).toContain('Lossless Audio Player');

    // 12. State Recovery & Restart Simulation: Re-create app on same workspace directory
    const reloadedApp = createApp({
      workspaceRoot: tempWorkspace,
      useMockAI: true,
    });

    const reloadProjectRes = await request(reloadedApp)
      .get(`/api/projects/${projectId}`)
      .expect(200);

    expect(reloadProjectRes.body.success).toBe(true);
    const reloadedSnap = reloadProjectRes.body.data.snapshot;
    expect(reloadedSnap.planning.package.directory).toBe(generated.body.data.manifest.directory);
    expect(reloadedSnap.metadata.stateRevision).toBe(rev);
    expect(reloadedSnap.documents).toBeDefined();
    expect(reloadedSnap.documents.items).toEqual([]);
  });
});
