import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import {
  FileStorage,
  PlanningService,
  ProjectStateEngine,
  StateCommitManager,
  WorkspaceGuard,
  planningBasis,
} from '@project-architect/core';
import { createApp } from '../src/server.js';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { FixturePlanningProvider, group } from '../../../tests/fixtures/planning.mjs';

const retiredCode = 'LEGACY_WORKFLOW_RETIRED';
const modes = ['production', 'mock', 'injected-orchestrator'] as const;
const projectId = 'proj-rollback-retirement';
const formalFiles = [
  'project.json',
  ...['overview', 'decisions', 'assumptions', 'gaps', 'risks', 'questions', 'readiness',
    'documents', 'planning', 'blueprint', 'changesets', 'current'].map(name => `state/${name}.json`),
];

interface ProjectBytes {
  directoryListing: Buffer;
  files: Record<string, Buffer>;
}

// Capture every directory entry and file byte, including all revisions and manifests.
async function projectBytes(path: string): Promise<ProjectBytes> {
  const entries: string[] = [];
  const files: Record<string, Buffer> = {};
  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const absolute = join(directory, child.name);
      const name = relative(path, absolute).split(sep).join('/');
      entries.push(`${child.isDirectory() ? 'directory' : 'file'}:${name}`);
      if (child.isDirectory()) await visit(absolute);
      else files[name] = await readFile(absolute);
    }
  }
  await visit(path);
  return { directoryListing: Buffer.from(entries.join('\n')), files };
}

async function expectUnchanged(path: string, before: ProjectBytes): Promise<void> {
  const after = await projectBytes(path);
  expect(after.directoryListing).toEqual(before.directoryListing);
  expect(Object.keys(after.files)).toEqual(Object.keys(before.files));
  for (const [name, bytes] of Object.entries(before.files)) expect(after.files[name], name).toEqual(bytes);
}

describe('Retired historical rollback on real Core project copies', () => {
  let root: string;
  let seedPath: string;
  let targetRevision: number;
  let currentRevision: number;
  let copies: number;
  const runtimes: PlanningRuntime[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-rollback-retirement-'));
    copies = 0;
    const guard = new WorkspaceGuard(join(root, 'seed'));
    const engine = new ProjectStateEngine(new FileStorage(), guard);
    const created = await engine.createProject({ name: '回滚停用副本', idea: '整理个人笔记', projectId });
    seedPath = created.projectPath;
    const service = new PlanningService(engine);
    let snapshot = await service.propose(seedPath, {
      id: 'original-product', runId: 'fixture-original', stage: 'product', basis: planningBasis(created.snapshot),
      summary: '原批准方案', groups: [group('product')], evidence: [], status: 'pending',
      createdAt: new Date().toISOString(), approvals: [],
    });
    snapshot = await service.approve(seedPath, 'original-product', {
      expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-original', groupIds: ['product-group'],
    });
    targetRevision = snapshot.metadata.stateRevision;
    snapshot = await service.recordInput(seedPath, '开发反馈：保留更新后的笔记保存提示。', targetRevision, 'new-input', 'feedback');
    const changed = group('product');
    changed.blocks = changed.blocks.map(block => block.id === 'notes'
      ? { ...block, content: `${block.content} 新版保存失败提示必须继续保留。` } : block);
    snapshot = await service.propose(seedPath, {
      id: 'newer-product', runId: 'fixture-newer', stage: 'product', basis: planningBasis(snapshot),
      summary: '新版批准方案', groups: [changed], evidence: [], status: 'pending',
      createdAt: new Date().toISOString(), approvals: [],
    });
    snapshot = await service.approve(seedPath, 'newer-product', {
      expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-newer', groupIds: ['product-group'],
    });
    currentRevision = snapshot.metadata.stateRevision;
    const original = JSON.parse(await readFile(join(seedPath, 'state', 'revisions', String(targetRevision), 'blueprint.json'), 'utf8'));
    expect(original.blocks.find((block: any) => block.id === 'notes').content).not.toContain('新版保存失败提示');
    expect(snapshot.planning!.blueprint.blocks.find(block => block.id === 'notes')!.content).toContain('新版保存失败提示');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const runtime of runtimes.splice(0)) await runtime.shutdown();
    expect(resolve(root).startsWith(`${resolve(tmpdir())}${sep}`)).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  async function copyProject(tampered = false) {
    const workspace = join(root, `copy-${++copies}`);
    const guard = new WorkspaceGuard(workspace);
    const path = guard.resolveProjectPath(projectId);
    await cp(seedPath, path, { recursive: true });
    const storage = new FileStorage();
    const engine = new ProjectStateEngine(storage, guard);
    if (tampered) {
      const manifestPath = join(path, 'state', 'revisions', String(targetRevision), 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.files.find((file: any) => file.filename === 'metadata.json').sha256 = '0'.repeat(64);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      expect(await new StateCommitManager(storage).verifySnapshot(path, targetRevision)).toBe(false);
    }
    const before = await projectBytes(path);
    for (const file of formalFiles) expect(before.files[file], `fixture includes ${file}`).toBeDefined();
    expect(JSON.parse(before.files['state/current.json'].toString()).revision).toBe(currentRevision);
    return { workspace, guard, storage, engine, path, before };
  }

  it.each([false, true])('rejects repeated direct Core calls without reading or modifying the project (tampered=%s)', async tampered => {
    const fixture = await copyProject(tampered);
    const reads = vi.spyOn(fixture.storage, 'readJson');
    const loads = vi.spyOn(fixture.engine, 'loadProject');
    const recovery = vi.spyOn(StateCommitManager.prototype, 'recoverIfNeeded');
    for (const revision of [targetRevision, targetRevision, currentRevision, 999999]) {
      await expect(fixture.engine.rollbackToRevision(fixture.path, revision)).rejects.toMatchObject({ code: retiredCode });
      await expectUnchanged(fixture.path, fixture.before);
    }
    expect(reads).not.toHaveBeenCalled();
    expect(loads).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
  });

  it('rejects direct Core calls before inspecting even a missing project', async () => {
    const storage = new FileStorage();
    const engine = new ProjectStateEngine(storage, new WorkspaceGuard(root));
    const reads = vi.spyOn(storage, 'exists');
    await expect(engine.rollbackToRevision(join(root, 'missing-project'), targetRevision)).rejects.toMatchObject({ code: retiredCode });
    expect(reads).not.toHaveBeenCalled();
  });

  it.each(modes)('returns 410 before project loading in %s, including repeated and stale requests', async mode => {
    await verifyHttp(mode, false);
  });

  it.each(modes)('keeps tampered target manifest untouched and history readable in %s', async mode => {
    await verifyHttp(mode, true);
  });

  async function verifyHttp(mode: typeof modes[number], tampered: boolean): Promise<void> {
    const fixture = await copyProject(tampered);
    const provider = new FixturePlanningProvider();
    const runtime = new PlanningRuntime(fixture.engine, provider as any);
    runtimes.push(runtime);
    const app = createApp({
      engine: fixture.engine, guard: fixture.guard, workspaceRoot: fixture.workspace, planningRuntime: runtime,
      useMockAI: mode === 'mock',
      ...(mode === 'injected-orchestrator' ? { orchestrator: new AIOrchestrator(new MockAIProvider(), fixture.engine) } : {}),
    });
    const loads = vi.spyOn(fixture.engine, 'loadProject');
    const snapshots = vi.spyOn(fixture.engine, 'getSnapshot');
    const rollback = vi.spyOn(fixture.engine, 'rollbackToRevision');
    const recovery = vi.spyOn(StateCommitManager.prototype, 'recoverIfNeeded');
    const stale = { targetRevision, expectedRevision: targetRevision, operationId: 'stale-confirmation' };
    for (const payload of [stale, stale, { targetRevision: currentRevision, expectedRevision: 0 }, { targetRevision: 999999 }, {}]) {
      const response = await request(app).post(`/api/projects/${projectId}/rollback`).send(payload).expect(410);
      expect(response.body).toMatchObject({ success: false, error: { code: retiredCode, recoverable: false } });
      expect(response.body).not.toHaveProperty('stateRevision');
      await expectUnchanged(fixture.path, fixture.before);
    }
    await request(app).post('/api/projects/missing-project/rollback').send(stale).expect(410);
    expect(loads).not.toHaveBeenCalled();
    expect(snapshots).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
    const history = await request(app).get(`/api/projects/${projectId}/timeline`).expect(200);
    expect(history.body.stateRevision).toBe(currentRevision);
    expect(history.body.data.events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'project_created' })]));
    await expectUnchanged(fixture.path, fixture.before);
    expect(provider.calls).toHaveLength(0);
  }
});
