import { rename, rm, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileStorage } from '../storage/FileStorage.js';
import type { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import { ErrorCode } from '@project-architect/contracts';

export interface MoveToTrashOptions {
  projectId: string;
  projectPath: string;
  storage: FileStorage;
  guard: WorkspaceGuard;
}

export interface MoveToTrashResult {
  trashPath: string;
  trashedAt: string;
}

export interface RestoreFromTrashOptions {
  projectId: string;
  trashPath: string;
  targetPath?: string;
  storage: FileStorage;
  guard: WorkspaceGuard;
}

export interface RestoreFromTrashResult {
  projectPath: string;
}

export interface PurgeFromTrashOptions {
  trashPath: string;
  storage: FileStorage;
  guard: WorkspaceGuard;
}

export class ProjectTrashService {
  /**
   * Moves a project directory into the workspace .trash folder (<workspaceRoot>/.trash/<projectId>-<timestamp>).
   */
  static async moveToTrash(options: MoveToTrashOptions): Promise<MoveToTrashResult> {
    const { projectId, projectPath, storage, guard } = options;

    const cleanId = guard.validateProjectId(projectId);
    guard.assertContained(guard.projectsDir, projectPath, 'Project directory');

    if (!(await storage.exists(projectPath))) {
      const err: any = new Error(`Cannot trash: project directory not found at ${projectPath}`);
      err.code = ErrorCode.STATE_RECOVERY_REQUIRED;
      throw err;
    }

    const timestamp = Date.now();
    const trashedAt = new Date(timestamp).toISOString();
    const trashPath = guard.resolveTrashPath(cleanId, timestamp);

    await mkdir(guard.trashDir, { recursive: true });
    await rename(projectPath, trashPath);

    return {
      trashPath,
      trashedAt,
    };
  }

  /**
   * Restores a trashed project back to the active projects folder.
   */
  static async restoreFromTrash(options: RestoreFromTrashOptions): Promise<RestoreFromTrashResult> {
    const { projectId, trashPath, targetPath: explicitTarget, storage, guard } = options;

    guard.validateProjectId(projectId);
    guard.assertTrashContained(trashPath);

    if (!(await storage.exists(trashPath))) {
      const err: any = new Error(`Cannot restore: trashed project not found at ${trashPath}`);
      err.code = ErrorCode.STATE_RECOVERY_REQUIRED;
      throw err;
    }

    const targetPath = explicitTarget
      ? guard.resolveAndValidateProjectLocation(explicitTarget, projectId)
      : guard.resolveProjectPath(projectId);

    if (await storage.exists(targetPath)) {
      const err: any = new Error(`Cannot restore: target directory already exists at ${targetPath}`);
      err.code = ErrorCode.STATE_COMMIT_FAILED;
      throw err;
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await rename(trashPath, targetPath);

    return {
      projectPath: targetPath,
    };
  }

  /**
   * Permanently deletes a trashed project directory from the .trash folder.
   * Path must strictly reside within the workspace .trash directory.
   */
  static async purgeFromTrash(options: PurgeFromTrashOptions): Promise<void> {
    const { trashPath, storage, guard } = options;

    // Strict path validation against workspace .trash directory
    guard.assertTrashContained(trashPath);

    if (await storage.exists(trashPath)) {
      await rm(trashPath, { recursive: true, force: true });
    }
  }
}
