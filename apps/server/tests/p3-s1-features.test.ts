import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/server.js';
import { FileStorage } from '@project-architect/core';

describe('Stage S1 Server Endpoints (Presets, DAG, Mermaid Diagrams)', () => {
  let testDir: string;
  let app: any;
  const storage = new FileStorage();

  beforeEach(async () => {
    testDir = join(tmpdir(), `pa-s1-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fsp.mkdir(testDir, { recursive: true });

    app = createApp({
      workspaceRoot: testDir,
      projectsDir: join(testDir, 'projects'),
      useMockAI: true,
    });
  });

  afterEach(async () => {
    await storage.remove(testDir);
  });

  it('GET /api/presets returns all 5 curated presets', async () => {
    const res = await request(app).get('/api/presets');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(5);

    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain('local-first-desktop');
    expect(ids).toContain('cli-developer-tool');
  });

  it('GET /api/presets/:id returns single preset details', async () => {
    const res = await request(app).get('/api/presets/local-first-desktop');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('local-first-desktop');
    expect(res.body.data.initialDecisions.length).toBeGreaterThan(0);
  });

  it('POST /api/projects with presetId seeds initial decisions and tags', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'My Custom CLI Tool',
        presetId: 'cli-developer-tool',
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    const { projectId, snapshot } = createRes.body.data;
    expect(projectId).toBeDefined();

    // Verify preset decisions were seeded
    expect(snapshot.decisions.items.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.metadata.projectTags).toContain('cli');

    // Verify GET /api/projects/:id/dag returns complete DAG
    const dagRes = await request(app).get(`/api/projects/${projectId}/dag`);
    expect(dagRes.status).toBe(200);
    expect(dagRes.body.success).toBe(true);
    expect(dagRes.body.data.nodes.length).toBeGreaterThanOrEqual(2);
    expect(dagRes.body.data.topologicalOrder.length).toBeGreaterThanOrEqual(2);
    expect(dagRes.body.data.hasCycles).toBe(false);

    // Verify GET /api/projects/:id/dag/impact returns cascade analysis
    const targetDecisionId = snapshot.decisions.items[0].id;
    const impactRes = await request(app)
      .get(`/api/projects/${projectId}/dag/impact`)
      .query({ decisionId: targetDecisionId });

    expect(impactRes.status).toBe(200);
    expect(impactRes.body.success).toBe(true);
    expect(impactRes.body.data.targetDecisionId).toBe(targetDecisionId);
    expect(impactRes.body.data.impactedAreas).toBeDefined();

    // Dynamic legacy architecture inference is retired.
    const diagRes = await request(app).get(`/api/projects/${projectId}/diagrams`);
    expect(diagRes.status).toBe(410);
    expect(diagRes.body.error.code).toBe('LEGACY_WORKFLOW_RETIRED');
    expect(diagRes.body.data).toBeUndefined();
  });
});
