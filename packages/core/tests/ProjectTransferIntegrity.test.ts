import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FileStorage, WorkspaceGuard, ProjectStateEngine, ProjectForkService, ProjectExportImportService, StateCommitManager } from '../src/index.js';
import { PlanningRuntime } from '../../../apps/server/src/planning/PlanningRuntime.js';
import { PlanningPackageCompiler } from '../../../apps/server/src/planning/PlanningPackageCompiler.js';
import type { AIProviderRequest } from '@project-architect/contracts';

async function inventory(path: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(directory: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(join(directory, entry.name), `${relative}/`);
      else files[relative] = createHash('sha256').update(await readFile(join(directory, entry.name))).digest('hex');
    }
  }
  await walk(path);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

const frozen = resolve('docs/validation/agy-2026-10-04/real-integration/flash-materials-quality-20261005-01/project-records');
const canonicalFiles = ['overview', 'decisions', 'assumptions', 'gaps', 'risks', 'questions', 'readiness', 'documents'];

describe('Project transfer integrity against genuine frozen Core state', () => {
  let frozenBefore: Record<string, string>;
  let root: string;
  let storage: FileStorage;
  let guard: WorkspaceGuard;
  let engine: ProjectStateEngine;
  let service: ProjectExportImportService;

  beforeAll(async () => { frozenBefore = await inventory(frozen); });
  afterAll(async () => { expect(await inventory(frozen)).toEqual(frozenBefore); });
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-transfer-integrity-'));
    storage = new FileStorage(); guard = new WorkspaceGuard(root);
    engine = new ProjectStateEngine(storage, guard); service = new ProjectExportImportService(storage);
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('preserves every historical byte through fork, new-ID import, collision import and same-ID round trip', async () => {
    const metadata = JSON.parse(await readFile(join(frozen, 'project.json'), 'utf8'));
    const source = guard.resolveProjectPath(metadata.projectId);
    await cp(frozen, source, { recursive: true });
    const sourceBefore = await inventory(source);
    const sourceMetadataBytes = await readFile(join(source, 'project.json'));
    const sourceBlueprint = await storage.readJson<any>(join(source, 'state', 'blueprint.json'));
    const sourceChanges = await storage.readJson<any[]>(join(source, 'state', 'changesets.json'));
    const sourceLedger = await storage.readJson<any>(join(source, 'state', 'planning.json'));
    expect(metadata.stateRevision).toBe(21);
    expect(sourceBlueprint.blocks).toHaveLength(30);
    expect(sourceLedger.package).toBeDefined();
    expect(await new StateCommitManager(storage).verifySnapshot(source, 21)).toBe(true);
    const oldRevisions = await inventory(join(source, 'state', 'revisions'));
    const oldRuntime = await inventory(join(source, 'runtime'));
    const oldInputs = await inventory(join(source, 'inputs'));
    const oldArtifacts = await inventory(join(source, 'artifacts'));

    const fork = await ProjectForkService.forkProject({ sourcePath: source, newProjectId: 'genuine-fork', newName: '材料规划副本', storage, guard, engine });
    const archive = await service.exportProject(source);
    const forced = await service.importProject(archive.zipBuffer, guard.projectsDir, 'genuine-import');
    const same = await service.importProject(archive.zipBuffer, join(root, 'round-trip'));
    const existingBefore = await inventory(same.projectPath);
    const collision = await service.importProject(archive.zipBuffer, join(root, 'round-trip'));
    expect(collision.renamed).toBe(true);
    expect(await inventory(same.projectPath)).toEqual(existingBefore);

    for (const result of [
      { path: fork.targetPath, snapshot: fork.snapshot, changed: true },
      { path: forced.projectPath, snapshot: forced.snapshot, changed: true },
      { path: collision.projectPath, snapshot: collision.snapshot, changed: true },
      { path: same.projectPath, snapshot: same.snapshot, changed: false },
    ]) {
      expect(result.snapshot.metadata.stateRevision).toBe(result.changed ? 22 : 21);
      expect(await new StateCommitManager(storage).verifySnapshot(result.path, result.snapshot.metadata.stateRevision)).toBe(true);
      const transferredRevisions = await inventory(join(result.path, 'state', 'revisions'));
      for (const [file, digest] of Object.entries(oldRevisions)) expect(transferredRevisions[file], file).toBe(digest);
      expect(await inventory(join(result.path, 'inputs'))).toEqual(oldInputs);
      expect(await inventory(join(result.path, 'artifacts'))).toEqual(oldArtifacts);
      expect(result.snapshot.metadata.inputRefs).toEqual(metadata.inputRefs);
      expect(result.snapshot.planning!.blueprint).toEqual(sourceBlueprint);
      for (const original of sourceChanges) {
        const transferred = result.snapshot.planning!.changeSets.find(change => change.id === original.id)!;
        expect(transferred.approvals).toEqual(original.approvals);
        expect(transferred.groups).toEqual(original.groups);
        if (original.status === 'approved') expect(transferred).toEqual(original);
      }
      for (const file of canonicalFiles) {
        expect((await storage.readJson<any>(join(result.path, 'state', `${file}.json`))).projectId).toBe(result.snapshot.metadata.projectId);
      }
      const transferNames = await readdir(join(result.path, 'history', 'transfers'));
      const transferPath = join(result.path, 'history', 'transfers', transferNames[0]!);
      expect(await inventory(join(transferPath, 'runtime'))).toEqual(oldRuntime);
      expect(await storage.readJson(join(transferPath, 'transfer.json'))).toMatchObject({ sourceProjectId: metadata.projectId, sourceRevision: 21, runtimeDisposition: 'isolated-historical' });
      expect(await storage.exists(join(result.path, 'runtime', 'planning'))).toBe(false);
      const runtime = new PlanningRuntime(engine, { complete: async () => { throw new Error('No Provider calls permitted in transfer verification'); } });
      expect(await runtime.list(result.path)).toEqual([]);
      const oldRuns = await readdir(join(source, 'runtime', 'planning'));
      await expect(runtime.resume(result.path, oldRuns.find(name => name.startsWith('run-'))!)).rejects.toThrow();
      if (result.changed) {
        expect(result.snapshot.metadata.forkedFrom).toMatchObject({ sourceProjectId: metadata.projectId, sourceRevision: 21 });
        expect(result.snapshot.planning!.package).toBeUndefined();
        await expect(new PlanningPackageCompiler(runtime.service).export(result.path)).rejects.toMatchObject({ code: 'PACKAGE_INCOMPLETE' });
      } else {
        expect(await readFile(join(result.path, 'project.json'))).toEqual(sourceMetadataBytes);
        expect(result.snapshot.planning!.package).toEqual(sourceLedger.package);
        expect(await new PlanningPackageCompiler(runtime.service).export(result.path)).toBeInstanceOf(Buffer);
      }
    }
    expect(await inventory(source)).toEqual(sourceBefore);
  }, 90000);

  it('isolates an in-flight run without changing its receipts and permits a fresh registered run', async () => {
    const source = guard.resolveProjectPath('running-source');
    await engine.createProject({ name: '运行隔离', idea: '输入项目名', projectId: 'running-source', projectPath: source });
    const runId = 'run-transfer-inflight';
    await storage.writeJson(join(source, 'runtime', 'planning', runId, 'run.json'), { id: runId, projectId: 'running-source', status: 'running', createdAt: new Date().toISOString(), tasks: [{ id: 'old-task', status: 'running' }] });
    await storage.writeBuffer(join(source, 'runtime', 'planning', runId, 'receipt.json'), Buffer.from('{"raw":"original Provider evidence"}\r\n'));
    const runtimeBefore = await inventory(join(source, 'runtime'));
    const sourceBefore = await inventory(source);
    const fork = await ProjectForkService.forkProject({ sourcePath: source, newProjectId: 'running-fork', newName: '运行副本', storage, guard, engine });
    const provider = { async complete(request: AIProviderRequest) {
      await new Promise<void>(resolveWait => { if (request.abortSignal?.aborted) resolveWait(); else request.abortSignal?.addEventListener('abort', () => resolveWait(), { once: true }); });
      throw new Error('Synthetic cancellation');
    } };
    const runtime = new PlanningRuntime(engine, provider, {}, [1, 2]);
    try {
      expect(await runtime.list(fork.targetPath)).toEqual([]);
      await expect(runtime.resume(fork.targetPath, runId)).rejects.toThrow();
      const fresh = await runtime.start(fork.targetPath, { stage: 'clarify', expectedRevision: 2, operationId: 'fresh-after-transfer' });
      expect(fresh.id).not.toBe(runId);
      expect(fresh.projectId).toBe('running-fork');
      await runtime.cancel(fork.targetPath, fresh.id);
    } finally { await runtime.shutdown(); }
    const [transferId] = await readdir(join(fork.targetPath, 'history', 'transfers'));
    expect(await inventory(join(fork.targetPath, 'history', 'transfers', transferId!, 'runtime'))).toEqual(runtimeBefore);
    expect(await inventory(source)).toEqual(sourceBefore);
  });

  it('rejects a corrupt current revision even when a valid predecessor exists and leaves no partial target', async () => {
    const source = guard.resolveProjectPath('corrupt-source');
    await engine.createProject({ name: '损坏检测', idea: '输入项目名', projectId: 'corrupt-source', projectPath: source });
    await engine.confirmDecision(source, 'decision:dec-01', 1);
    const validArchive = await service.exportProject(source);
    const corruptBody = '{"projectId":"corrupt-source","items":[],"traces":[]}';
    await writeFile(join(source, 'state', 'revisions', '2', 'decisions.json'), corruptBody);
    expect(await new StateCommitManager(storage).verifySnapshot(source, 1)).toBe(true);
    expect(await new StateCommitManager(storage).verifySnapshot(source, 2)).toBe(false);
    const sourceBefore = await inventory(source);
    await expect(ProjectForkService.forkProject({ sourcePath: source, newProjectId: 'invalid-fork', newName: '无效副本', storage, guard, engine })).rejects.toThrow(/failed verification/);
    await expect(service.exportProject(source)).rejects.toThrow(/failed verification/);
    const internal = service as unknown as { extractZip(buffer: Buffer): Array<{ path: string; data: Buffer }>; buildZipBuffer(files: Array<{ path: string; data: Buffer }>): Buffer };
    const archiveFiles = internal.extractZip(validArchive.zipBuffer);
    archiveFiles.find(file => file.path === 'state/revisions/2/decisions.json')!.data = Buffer.from(corruptBody);
    await expect(service.importProject(internal.buildZipBuffer(archiveFiles), guard.projectsDir, 'invalid-import')).rejects.toThrow(/failed verification/);
    expect(await storage.exists(guard.resolveProjectPath('invalid-fork'))).toBe(false);
    expect(await storage.exists(guard.resolveProjectPath('invalid-import'))).toBe(false);
    expect(await readdir(join(root, '.tmp'))).toEqual([]);
    expect((await readdir(guard.projectsDir)).filter(name => name.startsWith('.import-'))).toEqual([]);
    expect(await inventory(source)).toEqual(sourceBefore);
  });

  it('preserves readiness and document history while staling unapproved proposals in the new identity', async () => {
    const source = guard.resolveProjectPath('approval-source');
    const { snapshot } = await engine.createProject({ name: '审批来源', idea: '保存历史', projectId: 'approval-source', projectPath: source });
    snapshot.readiness.current.userDisposition = 'approved';
    const currentApproval = structuredClone(snapshot.readiness.current);
    const changes = [{ id: 'pending-change', runId: 'run-old', stage: 'product', basis: { revision: 2, hash: 'old' }, summary: '来源提议', status: 'partially-approved', groups: [], evidence: [], approvals: [{ operationId: 'approved-group', groupIds: ['g1'], at: snapshot.metadata.updatedAt, revision: 2 }], createdAt: snapshot.metadata.updatedAt }];
    await new StateCommitManager(storage).commit(source, 2, { readiness: snapshot.readiness, documents: snapshot.documents, manifest: snapshot.documents, planning: { schemaVersion: 1, evidence: [], topics: [], inputs: [], operations: [], diagnostics: [] }, blueprint: snapshot.planning!.blueprint, changesets: changes }, 1);
    const sourceManifest = await readFile(join(source, 'documents', 'manifest.json'));
    const sourceBefore = await inventory(source);
    const fork = await ProjectForkService.forkProject({ sourcePath: source, newProjectId: 'approval-fork', newName: '审批副本', storage, guard, engine });
    expect(fork.snapshot.readiness.current.userDisposition).toBe('pending');
    expect(fork.snapshot.readiness.history).toContainEqual(currentApproval);
    expect(fork.snapshot.planning!.changeSets[0]).toEqual({ ...changes[0], status: 'stale' });
    expect((await storage.readJson<any>(join(fork.targetPath, 'documents', 'manifest.json'))).projectId).toBe('approval-fork');
    const [transferId] = await readdir(join(fork.targetPath, 'history', 'transfers'));
    expect(await readFile(join(fork.targetPath, 'history', 'transfers', transferId!, 'documents', 'manifest.json'))).toEqual(sourceManifest);
    expect(await new StateCommitManager(storage).verifySnapshot(fork.targetPath, 2)).toBe(true);
    expect(await new StateCommitManager(storage).verifySnapshot(fork.targetPath, 3)).toBe(true);
    expect(await inventory(source)).toEqual(sourceBefore);
  });

  it('cleans failed Core commits and never overwrites an existing target', async () => {
    const source = guard.resolveProjectPath('failure-source');
    await engine.createProject({ name: '失败保护', idea: '输入项目名', projectId: 'failure-source', projectPath: source });
    const existing = guard.resolveProjectPath('existing');
    await engine.createProject({ name: '已存在目标', idea: '已存在项目', projectId: 'existing', projectPath: existing });
    const sourceBefore = await inventory(source), existingBefore = await inventory(existing);
    await expect(ProjectForkService.forkProject({ sourcePath: source, newProjectId: 'existing', newName: '冲突', storage, guard, engine })).rejects.toThrow(/already exists/);
    class FailingStorage extends FileStorage {
      override async writeText(path: string, content: string): Promise<void> {
        if (path.includes(`${join('revisions', '2')}`)) throw new Error('Injected Core snapshot write failure');
        await super.writeText(path, content);
      }
    }
    const failing = new FailingStorage();
    await expect(ProjectForkService.forkProject({ sourcePath: source, newProjectId: 'failed-fork', newName: '失败', storage: failing, guard, engine })).rejects.toThrow(/Injected Core/);
    const archive = await service.exportProject(source);
    await expect(new ProjectExportImportService(failing).importProject(archive.zipBuffer, guard.projectsDir, 'failed-import')).rejects.toThrow(/Injected Core/);
    expect(await inventory(source)).toEqual(sourceBefore);
    expect(await inventory(existing)).toEqual(existingBefore);
    expect(await readdir(join(root, '.tmp'))).toEqual([]);
    expect((await readdir(guard.projectsDir)).sort()).toEqual(['existing', 'failure-source']);
  });

  it('rejects material corruption, path traversal and duplicate archive paths before registration', async () => {
    const source = guard.resolveProjectPath('archive-source');
    await engine.createProject({ name: '归档校验', idea: '原始材料', projectId: 'archive-source', projectPath: source });
    const archive = await service.exportProject(source);
    const corrupted = Buffer.from(archive.zipBuffer);
    const sourceBytes = Buffer.from('原始材料');
    const materialOffset = corrupted.indexOf(sourceBytes);
    expect(materialOffset).toBeGreaterThan(-1);
    corrupted[materialOffset] = corrupted[materialOffset]! ^ 1;
    await expect(service.importProject(corrupted, guard.projectsDir, 'bad-material')).rejects.toThrow(/checksum mismatch/);
    const internal = service as unknown as { extractZip(buffer: Buffer): Array<{ path: string; data: Buffer }>; buildZipBuffer(files: Array<{ path: string; data: Buffer }>): Buffer };
    const files = internal.extractZip(archive.zipBuffer);
    await expect(service.importProject(internal.buildZipBuffer([...files, { path: '../escape.txt', data: Buffer.from('escape') }]), guard.projectsDir)).rejects.toThrow(/unsafe file path/);
    await expect(service.importProject(internal.buildZipBuffer([...files, files[0]!]), guard.projectsDir)).rejects.toThrow(/duplicate file path/);
    await expect(service.importProject(archive.zipBuffer, guard.projectsDir, '../escape')).rejects.toThrow(/Invalid project ID/);
    expect((await readdir(guard.projectsDir)).sort()).toEqual(['archive-source']);
  });
});
