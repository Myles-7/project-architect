import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/server.js';
import { FileStorage } from '@project-architect/core';

describe('Stage S2 Server Endpoints (HTML Bundle Export & Incremental Diff)', () => {
  let testDir: string;
  let app: any;
  const storage = new FileStorage();

  beforeEach(async () => {
    testDir = join(tmpdir(), `pa-s2-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
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

  it('GET /api/projects/:id/documents/export-html returns self-contained HTML bundle and JSON meta', async () => {
    // 1. Create a project with local-first-desktop preset
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Exportable Desktop Tool',
        presetId: 'local-first-desktop',
      });

    expect(createRes.status).toBe(200);
    const { projectId } = createRes.body.data;

    // 2. Query HTML bundle with format=json
    const metaRes = await request(app)
      .get(`/api/projects/${projectId}/documents/export-html`)
      .query({ format: 'json' });

    expect(metaRes.status).toBe(200);
    expect(metaRes.body.success).toBe(true);
    expect(metaRes.body.data.filename).toBe(`${projectId}-spec-bundle.html`);
    expect(metaRes.body.data.totalDocuments).toBeGreaterThanOrEqual(8);
    expect(metaRes.body.data.html).toContain('<!DOCTYPE html>');
    expect(metaRes.body.data.html).toContain('Exportable Desktop Tool');

    // 3. Query HTML bundle directly as text/html attachment
    const htmlRes = await request(app)
      .get(`/api/projects/${projectId}/documents/export-html`);

    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers['content-type']).toContain('text/html');
    expect(htmlRes.headers['content-disposition']).toContain('attachment');
    expect(htmlRes.text).toContain('<!DOCTYPE html>');
    expect(htmlRes.text).toContain('data-theme="dark"');
    // Ensure zero remote script CDN imports
    expect(htmlRes.text).not.toContain('cdn.jsdelivr.net');
    expect(htmlRes.text).not.toContain('unpkg.com');
  });

  it('GET /api/projects/:id/documents/diff respects query areas for decoupled stale detection', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Diff Area Project',
        presetId: 'local-first-desktop',
      });

    expect(createRes.status).toBe(200);
    const { projectId } = createRes.body.data;

    // Diff specifically for technical-guide without modifying database area
    const diffRes = await request(app)
      .get(`/api/projects/${projectId}/documents/diff`)
      .query({ areas: 'technical-guide' });

    expect(diffRes.status).toBe(200);
    expect(diffRes.body.success).toBe(true);
    expect(Array.isArray(diffRes.body.data.diffs)).toBe(true);
  });
});
