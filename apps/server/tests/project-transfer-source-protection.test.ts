import { afterEach, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorage, ProjectStateEngine, StateCommitManager, WorkspaceGuard } from '@project-architect/core';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { createApp } from '../src/server.js';

async function inventory(path: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(directory: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(join(directory, entry.name), `${name}/`);
      else files[name] = createHash('sha256').update(await readFile(join(directory, entry.name))).digest('hex');
    }
  }
  await walk(path);
  return files;
}

let root: string, storage: FileStorage, guard: WorkspaceGuard, engine: ProjectStateEngine, runtime: PlanningRuntime, app: ReturnType<typeof createApp>;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pa-transfer-http-'));
  storage = new FileStorage(); guard = new WorkspaceGuard(root); engine = new ProjectStateEngine(storage, guard);
  runtime = new PlanningRuntime(engine, { complete: async () => { throw new Error('Provider calls are forbidden in transfer tests'); } } as any);
  app = createApp({ workspaceRoot: root, guard, engine, planningRuntime: runtime });
});
afterEach(async () => { await runtime.shutdown(); await rm(root, { recursive: true, force: true }); });

async function source(registered: boolean): Promise<string> {
  const path = guard.resolveProjectPath('transfer-source');
  const options = { projectId: 'transfer-source', name: '精确快照名称', idea: '保留来源历史', projectPath: path };
  if (registered) await request(app).post('/api/projects').send(options).expect(200);
  else await engine.createProject(options);
  await engine.confirmDecision(path, 'decision:dec-01', 1);
  return path;
}

it.each([
  [true, 'duplicate'], [false, 'duplicate'], [true, 'export'], [false, 'export'],
] as const)('rejects corrupt current state without recovering any source bytes (registered=%s, route=%s)', async (registered, route) => {
  const path = await source(registered);
  await writeFile(join(path, 'state', 'revisions', '2', 'decisions.json'), '{"projectId":"transfer-source","items":[],"traces":[]}');
  const manager = new StateCommitManager(storage);
  expect(await manager.verifySnapshot(path, 1)).toBe(true);
  expect(await manager.verifySnapshot(path, 2)).toBe(false);
  const before = await inventory(path);
  const response = route === 'duplicate'
    ? await request(app).post('/api/projects/transfer-source/duplicate').send({})
    : await request(app).get('/api/projects/transfer-source/export');
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('STATE_VALIDATION_FAILED');
  expect(response.body.error.message).toMatch(/snapshot 2 failed verification/);
  expect(await inventory(path)).toEqual(before);
  expect(await readdir(guard.projectsDir)).toEqual(['transfer-source']);
  if (await storage.exists(join(root, '.tmp'))) expect(await readdir(join(root, '.tmp'))).toEqual([]);
});

it.each([true, false])('uses verified snapshot metadata for the default fork name and keeps valid source bytes intact (registered=%s)', async registered => {
  const path = await source(registered);
  const metadata = await storage.readJson<any>(join(path, 'project.json'));
  // A stale presentation name must not replace the exact committed metadata.
  await writeFile(join(path, 'project.json'), JSON.stringify({ ...metadata, name: '过时的显示名称' }, null, 4) + '\r\n');
  const before = await inventory(path);
  const copied = await request(app).post('/api/projects/transfer-source/duplicate').send({}).expect(200);
  expect(copied.body.data.project.name).toBe('精确快照名称 (副本)');
  const forkPath = guard.resolveProjectPath(copied.body.data.project.projectId);
  expect((await storage.readJson<any>(join(forkPath, 'project.json'))).name).toBe('精确快照名称 (副本)');
  const exported = await request(app).get('/api/projects/transfer-source/export').buffer(true).parse((response, done) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => done(null, Buffer.concat(chunks)));
  }).expect(200);
  expect(Buffer.isBuffer(exported.body)).toBe(true);
  expect(await inventory(path)).toEqual(before);
});
