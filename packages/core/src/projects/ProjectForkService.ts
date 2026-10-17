import { cp, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileStorage } from '../storage/FileStorage.js';
import type { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import type { ProjectStateEngine } from '../engine/ProjectStateEngine.js';
import type { ProjectSnapshot } from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';
import { StateCommitManager } from '../commit/StateCommitManager.js';
import { assertTransferTree, prepareProjectTransfer, promoteProjectTransfer, verifyTransferSource } from './ProjectTransfer.js';

export interface ForkProjectOptions {
  sourcePath: string;
  newName?: string;
  newProjectId?: string;
  targetPath?: string;
  storage: FileStorage;
  guard: WorkspaceGuard;
  engine: ProjectStateEngine;
}

export interface ForkProjectResult {
  newProjectId: string;
  targetPath: string;
  snapshot: ProjectSnapshot;
}

export class ProjectForkService {
  /** Copy and verify first, then commit a complete new identity without rewriting source history. */
  static async forkProject(options: ForkProjectOptions): Promise<ForkProjectResult> {
    const { sourcePath, newName, storage, guard, engine } = options;
    if (newName !== undefined && (typeof newName !== 'string' || !newName.trim())) {
      const error = new Error('New project name is required') as Error & { code: string };
      error.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw error;
    }
    if (!(await storage.exists(sourcePath))) {
      const error = new Error(`Source project not found at: ${sourcePath}`) as Error & { code: string };
      error.code = ErrorCode.STATE_RECOVERY_REQUIRED;
      throw error;
    }
    const tmpBase = guard.assertContained(guard.workspaceRoot, join(guard.workspaceRoot, '.tmp'), 'Fork staging');
    await mkdir(tmpBase, { recursive: true });
    const stagingRoot = await mkdtemp(join(tmpBase, 'fork-'));
    const stagingPath = join(stagingRoot, 'project');
    try {
      // Shared Core lock fixes the snapshot basis while copying. No source load/recovery writes occur.
      await new StateCommitManager(storage).withProjectLock(sourcePath, async () => {
        await assertTransferTree(sourcePath);
        await cp(sourcePath, stagingPath, { recursive: true, force: false, errorOnExist: true });
      });
      const { metadata } = await verifyTransferSource(stagingPath, storage);
      const name = newName === undefined ? `${metadata.name} (副本)` : newName.trim();
      const newProjectId = guard.validateProjectId(options.newProjectId ?? `${metadata.projectId}-fork-${Date.now().toString(36)}`);
      if (newProjectId === metadata.projectId) throw new Error('A fork requires a new project ID');
      const targetPath = options.targetPath
        ? guard.assertContained(guard.projectsDir, options.targetPath, 'Target project path')
        : guard.resolveProjectPath(newProjectId);
      if (await storage.exists(targetPath)) throw new Error(`Target project directory already exists: ${targetPath}`);
      const snapshot = await prepareProjectTransfer({ stagingPath, projectId: newProjectId, name, kind: 'fork', storage, engine });
      await promoteProjectTransfer(stagingPath, targetPath, storage);
      return { newProjectId, targetPath, snapshot };
    } finally {
      await rm(stagingRoot, { recursive: true, force: true });
    }
  }
}
