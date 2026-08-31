import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileStorage,
  WorkspaceGuard,
  ProjectStateEngine,
  ProjectTrashService,
} from '../src/index.js';

describe('ProjectTrashService Unit Tests', () => {
  let tempBaseDir: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-trash-test-'));
    guard = new WorkspaceGuard(tempBaseDir);
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage, guard);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('moves project to .trash folder, allows restoration, and supports safe purging', async () => {
    const projectId = 'proj-trash-lifecycle';
    const projectPath = guard.resolveProjectPath(projectId);

    await engine.createProject({
      projectId,
      projectPath,
      name: 'Trashable Project',
      idea: 'Testing trash and restore',
    });

    expect(await storage.exists(projectPath)).toBe(true);

    // 1. Move to trash
    const trashResult = await ProjectTrashService.moveToTrash({
      projectId,
      projectPath,
      storage,
      guard,
    });

    expect(await storage.exists(projectPath)).toBe(false);
    expect(await storage.exists(trashResult.trashPath)).toBe(true);
    expect(trashResult.trashPath.startsWith(guard.trashDir)).toBe(true);
    expect(Date.parse(trashResult.trashedAt)).not.toBeNaN();

    // 2. Restore from trash
    const restoreResult = await ProjectTrashService.restoreFromTrash({
      projectId,
      trashPath: trashResult.trashPath,
      storage,
      guard,
    });

    expect(restoreResult.projectPath).toBe(projectPath);
    expect(await storage.exists(projectPath)).toBe(true);
    expect(await storage.exists(trashResult.trashPath)).toBe(false);

    // Validate project can be loaded after restoration
    const loadedSnapshot = await engine.loadProject(projectPath);
    expect(loadedSnapshot.metadata.projectId).toBe(projectId);
    expect(loadedSnapshot.metadata.name).toBe('Trashable Project');

    // 3. Trash again and purge
    const trashResult2 = await ProjectTrashService.moveToTrash({
      projectId,
      projectPath,
      storage,
      guard,
    });
    expect(await storage.exists(trashResult2.trashPath)).toBe(true);

    await ProjectTrashService.purgeFromTrash({
      trashPath: trashResult2.trashPath,
      storage,
      guard,
    });

    expect(await storage.exists(trashResult2.trashPath)).toBe(false);
  });

  it('rejects restore if target project location already exists', async () => {
    const projectId = 'proj-conflict-restore';
    const projectPath = guard.resolveProjectPath(projectId);

    await engine.createProject({
      projectId,
      projectPath,
      name: 'Original Conflict',
      idea: 'Test conflict',
    });

    const trashResult = await ProjectTrashService.moveToTrash({
      projectId,
      projectPath,
      storage,
      guard,
    });

    // Recreate active project with same ID before restore
    await engine.createProject({
      projectId,
      projectPath,
      name: 'New Replacement',
      idea: 'Replacement test',
    });

    await expect(
      ProjectTrashService.restoreFromTrash({
        projectId,
        trashPath: trashResult.trashPath,
        storage,
        guard,
      })
    ).rejects.toThrow(/already exists/);
  });

  it('enforces WorkspaceGuard boundaries: rejects purging paths outside .trash', async () => {
    const outsidePath = join(tempBaseDir, 'outside-folder');
    await storage.ensureDir(outsidePath);

    await expect(
      ProjectTrashService.purgeFromTrash({
        trashPath: outsidePath,
        storage,
        guard,
      })
    ).rejects.toThrow(/traversal rejected/);
  });
});
