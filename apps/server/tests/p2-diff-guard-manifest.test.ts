import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard } from '@project-architect/core';
import { createApp } from '../src/server.js';
import { approvedPlanningFixture } from '../../../tests/fixtures/approved-planning.js';

describe('Planning package publication preserves historical and edited files', () => {
  let root: string, path: string, id: string, revision: number, app: any;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-package-history-'));
    const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
    app = createApp({ workspaceRoot: root, engine, useMockAI: true });
    const created = await request(app).post('/api/projects').send({ name: 'Preserved history', idea: 'Approved package publication' }).expect(200);
    id = created.body.data.projectId; path = join(root, 'projects', id); revision = (await approvedPlanningFixture(engine, path)).metadata.stateRevision;
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  async function compile(operationId = 'package-1', extra = {}) {
    return request(app).post(`/api/projects/${id}/documents/generate`).send({ expectedRevision: revision, operationId, ...extra });
  }
  it('publishes to immutable artifact directories and retains historical root manifests', async () => {
    const legacy = join(path, 'documents.json'); await writeFile(legacy, '{"legacy":true}');
    const response = await compile(); expect(response.status).toBe(200);
    expect(response.body.data.manifest.directory).toMatch(/^artifacts\/packages\//);
    expect(response.body.data.manifest.files.length).toBeGreaterThanOrEqual(10);
    expect(await readFile(legacy, 'utf8')).toBe('{"legacy":true}');
  });
  it('reports modified package files without overwriting an idempotent operation', async () => {
    const initial = await compile(); expect(initial.status).toBe(200);
    const file = join(path, initial.body.data.manifest.directory, 'AGENTS.md');
    const edited = (await readFile(file, 'utf8')) + '\nUser edit remains evidence.\n'; await writeFile(file, edited);
    const response = await compile(); expect(response.status).toBe(422); expect(response.body.error.code).toBe('PACKAGE_MODIFIED'); expect(await readFile(file, 'utf8')).toBe(edited);
  });
  it('does not apply legacy forceOverwrite to historical edits when producing a new package', async () => {
    const initial = await compile(); const file = join(path, initial.body.data.manifest.directory, 'AGENTS.md');
    const edited = (await readFile(file, 'utf8')) + '\nManual rule.\n'; await writeFile(file, edited);
    const latest = await request(app).get(`/api/projects/${id}/planning`).expect(200); revision = latest.body.data.sourceStateRevision;
    const response = await compile('package-2', { forceOverwrite: true }); expect(response.status).toBe(200);
    expect(response.body.data.manifest.directory).not.toBe(initial.body.data.manifest.directory); expect(await readFile(file, 'utf8')).toBe(edited);
  });
});
