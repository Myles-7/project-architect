import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/server.js';
import { FileStorage } from '@project-architect/core';

describe('Server API Endpoints Tests', () => {
  let app: any;
  let testProjectDir: string;
  const storage = new FileStorage();

  beforeEach(() => {
    testProjectDir = join(tmpdir(), `pa-api-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    app = createApp({ useMockAI: true, workspaceRoot: testProjectDir });
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('handles project creation, state retrieval, and actions via HTTP API', async () => {
    // 1. Create Project
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'API Test Project',
        idea: 'Local-first music tagger',
        projectId: 'proj-api-test-01',
        projectTags: ['Desktop App'],
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    const { projectId, snapshot } = createRes.body.data;
    expect(snapshot.metadata.stateRevision).toBe(1);

    // 2. Fetch snapshot by ID
    const snapRes = await request(app).get(`/api/projects/${projectId}`);
    expect(snapRes.status).toBe(200);
    expect(snapRes.body.data.snapshot.metadata.name).toBe('API Test Project');

    // 3. Run Discovery Turn via API
    const discRes = await request(app)
      .post(`/api/projects/${projectId}/discovery`)
      .send({
        userMessage: 'Support FLAC and MP3 formats',
        expectedRevision: 1,
      });

    expect(discRes.status).toBe(200);
    expect(discRes.body.success).toBe(true);
    expect(discRes.body.stateRevision).toBe(2);

    // 4. Explicitly approve the initial candidate before locking it.
    const decId = snapshot.decisions.items[0].id;
    const confirmed=await request(app).post(`/api/projects/${projectId}/decisions/confirm`).send({targetRef:`decision:${decId}`,expectedRevision:2});
    expect(confirmed.status).toBe(200);
    const lockRes = await request(app)
      .post(`/api/projects/${projectId}/decisions/lock`)
      .send({
        decisionRef: `decision:${decId}`,
        expectedRevision: 3,
      });

    expect(lockRes.status).toBe(200);
    expect(lockRes.body.stateRevision).toBe(4);
    expect(lockRes.body.data.snapshot.decisions.items[0].status).toBe('locked');
  });
});
