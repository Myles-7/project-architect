import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorage } from '../src/storage/FileStorage.js';
import { WorkspaceGuard } from '../src/storage/WorkspaceGuard.js';
import { ProjectStateEngine } from '../src/engine/ProjectStateEngine.js';
import { ProjectExportImportService } from '../src/projects/ProjectExportImportService.js';

describe('ProjectExportImportService Unit Tests', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let guard: WorkspaceGuard;
  let engine: ProjectStateEngine;
  let service: ProjectExportImportService;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-export-test-'));
    storage = new FileStorage();
    guard = new WorkspaceGuard(tempBaseDir);
    engine = new ProjectStateEngine(storage, guard);
    service = new ProjectExportImportService(storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('exports one Core snapshot while a concurrent formal commit waits for archive reading', async () => {
    const path = join(tempBaseDir, 'export-lock');
    await engine.createProject({ name: '一致归档', idea: '保存原快照', projectId: 'export-lock', projectPath: path });
    const originalRead = storage.readBuffer.bind(storage);
    let entered!: () => void, release!: () => void;
    const reading = new Promise<void>(done => { entered = done; });
    const gate = new Promise<void>(done => { release = done; });
    let heldExportRead = false;
    storage.readBuffer = async file => {
      if (!heldExportRead && file === join(path, 'project.json')) { heldExportRead = true; entered(); await gate; }
      return originalRead(file);
    };
    const exporting = service.exportProject(`${path}/`);
    await reading;
    let committed = false;
    const commit = engine.confirmDecision(path, 'decision:dec-01' as any, 1).then(value => { committed = true; return value; });
    try {
      await new Promise(done => setTimeout(done, 40));
      expect(committed).toBe(false);
    } finally { release(); }
    const archive = await exporting;
    await commit;
    const imported = await service.importProject(archive.zipBuffer, join(tempBaseDir, 'consistent-roundtrip'));
    expect(imported.snapshot.metadata.stateRevision).toBe(1);
    expect(imported.snapshot.decisions.items.find(item => item.id === 'dec-01')?.status).toBe('candidate');
  });

  it('rejects a project link before reading files outside the archive tree', async () => {
    const path = join(tempBaseDir, 'export-link'), outside = join(tempBaseDir, 'outside');
    await engine.createProject({ name: '归档路径', idea: '保持独立', projectId: 'export-link', projectPath: path });
    await storage.ensureDir(outside);
    const secret = join(outside, 'outside.txt');await writeFile(secret, 'external content must not be archived');
    await symlink(outside, join(path, 'external-link'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(service.exportProject(path)).rejects.toThrow(/symbolic links/);
    expect(await readFile(secret, 'utf8')).toBe('external content must not be archived');
  });

  it('round-trips nested project.json and same-named historical commit records without treating them as the root', async () => {
    const path = join(tempBaseDir, 'nested-evidence');
    await engine.createProject({ name: '完整历史归档', idea: '保留试验输出', projectId: 'nested-evidence', projectPath: path });
    const records = {
      'runtime/planning/experiment/project.json': '{"ordinaryExperiment":"project.json"}',
      'runtime/planning/experiment/.commit_staging/log.json': '{"ordinaryEvidence":"staging"}',
      'inputs/.commit_marker.json': '{"ordinaryMaterial":"marker"}',
      'history/raw/.commit_staging/receipt.json': '{"ordinaryHistory":"receipt"}',
    };
    for (const [name, content] of Object.entries(records)) await storage.writeText(join(path, name), content);
    await storage.writeText(join(path, 'state', '.commit_marker.json'), '{"transient":true}');
    await storage.writeText(join(path, 'state', '.commit_staging', 'temporary.json'), '{"transient":true}');
    const archive = await service.exportProject(path);
    const internal = service as unknown as { extractZip(buffer: Buffer): Array<{ path: string; data: Buffer }>; buildZipBuffer(files: Array<{ path: string; data: Buffer }>): Buffer };
    const entries = internal.extractZip(archive.zipBuffer);
    for (const [name, content] of Object.entries(records)) expect(entries.find(entry => entry.path === name)?.data.toString()).toBe(content);
    expect(entries.some(entry => entry.path.startsWith('state/.commit_'))).toBe(false);
    const imported = await service.importProject(archive.zipBuffer, join(tempBaseDir, 'nested-roundtrip'));
    const archivedRuntime = (await storage.listFiles(join(imported.projectPath, 'history', 'transfers')))[0]!;
    expect(await storage.readText(join(imported.projectPath, 'history', 'transfers', archivedRuntime, 'runtime', 'planning', 'experiment', 'project.json'))).toBe(records['runtime/planning/experiment/project.json']);
    expect(await storage.readText(join(imported.projectPath, 'inputs', '.commit_marker.json'))).toBe(records['inputs/.commit_marker.json']);
    const wrapped = internal.buildZipBuffer(entries.map(entry => ({ ...entry, path: `portable/${entry.path}` })));
    const wrappedImport = await service.importProject(wrapped, join(tempBaseDir, 'wrapped-roundtrip'));
    expect(wrappedImport.snapshot.metadata.projectId).toBe('nested-evidence');
  });

  it('exports and imports a full project archive accurately without loss', async () => {
    const projectPath = join(tempBaseDir, 'proj-source');
    await storage.ensureDir(projectPath);

    // Initialize project
    const { snapshot: created } = await engine.createProject({
      name: 'Test Portable Backup App',
      idea: 'A portable backup test with local files',
      projectId: 'proj-source',
      projectPath,
    });
    expect(created.metadata.projectId).toBe('proj-source');

    // Confirm a decision
    await engine.confirmDecision(projectPath, 'decision:dec-01' as any, 1);

    // Export project to .pa.zip buffer
    const exportResult = await service.exportProject(projectPath);
    expect(exportResult.zipBuffer).toBeInstanceOf(Buffer);
    expect(exportResult.zipBuffer.length).toBeGreaterThan(0);
    expect(exportResult.filename).toContain('proj-source.pa.zip');
    expect(exportResult.filesCount).toBeGreaterThanOrEqual(5);

    // Import project into a target workspace directory
    const targetDir = join(tempBaseDir, 'imported-projects');
    await storage.ensureDir(targetDir);

    const importResult = await service.importProject(
      exportResult.zipBuffer,
      targetDir,
      'proj-imported-target'
    );

    expect(importResult.projectId).toBe('proj-imported-target');
    expect(importResult.snapshot.metadata.name).toBe('Test Portable Backup App');
    expect(importResult.snapshot.decisions.items.length).toBeGreaterThan(0);

    // Verify files physically exist on disk
    expect(await storage.exists(join(importResult.projectPath, 'project.json'))).toBe(true);
    expect(await storage.exists(join(importResult.projectPath, 'state', 'decisions.json'))).toBe(true);
  });

  it('P0-5: detects collision and renames imported project safely with timestamp suffix when same project exists', async () => {
    const projectPath = join(tempBaseDir, 'proj-source-collision');
    await storage.ensureDir(projectPath);

    await engine.createProject({
      name: 'Original Collision Guard App',
      idea: 'Testing collision detection',
      projectId: 'proj-collision',
      projectPath,
    });

    const exportResult = await service.exportProject(projectPath);

    const targetDir = join(tempBaseDir, 'target-workspace');
    await storage.ensureDir(targetDir);

    // First import: creates 'proj-collision'
    const import1 = await service.importProject(exportResult.zipBuffer, targetDir);
    expect(import1.projectId).toBe('proj-collision');
    expect(import1.renamed).toBe(false);
    expect(import1.snapshot.metadata.name).toBe('Original Collision Guard App');

    // Second import with identical project: should NOT overwrite, should append -imported- suffix
    const import2 = await service.importProject(exportResult.zipBuffer, targetDir);
    expect(import2.renamed).toBe(true);
    expect(import2.projectId).toContain('proj-collision-imported-');
    expect(import2.snapshot.metadata.name).toContain('(导入副本)');
    expect(import2.projectPath).not.toBe(import1.projectPath);

    // Third import with identical project: should NOT overwrite import1 or import2, must create a 3rd distinct instance
    const import3 = await service.importProject(exportResult.zipBuffer, targetDir);
    expect(import3.renamed).toBe(true);
    expect(import3.projectPath).not.toBe(import1.projectPath);
    expect(import3.projectPath).not.toBe(import2.projectPath);

    // All physical projects must coexist on disk intact
    expect(await storage.exists(import1.projectPath)).toBe(true);
    expect(await storage.exists(import2.projectPath)).toBe(true);
    expect(await storage.exists(import3.projectPath)).toBe(true);
    expect(await storage.exists(join(import1.projectPath, 'project.json'))).toBe(true);
    expect(await storage.exists(join(import2.projectPath, 'project.json'))).toBe(true);
    expect(await storage.exists(join(import3.projectPath, 'project.json'))).toBe(true);
  });
});
