import { cp, rename, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { FileStorage } from '../storage/FileStorage.js';
import type { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import type { ProjectStateEngine } from '../engine/ProjectStateEngine.js';
import type { ProjectSnapshot } from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';

export interface ForkProjectOptions {
  sourcePath: string;
  newName: string;
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
  /**
   * Performs an atomic, fully verified project fork:
   * 1. Copies to a temporary staging directory within workspaceRoot.
   * 2. Rewrites projectId across all canonical state files.
   * 3. Resets unapplicable in-flight job/turn status and readiness approvals.
   * 4. Injects forkedFrom traceability metadata.
   * 5. Validates project state using engine.loadProject.
   * 6. Atomically renames staging directory to targetPath.
   */
  static async forkProject(options: ForkProjectOptions): Promise<ForkProjectResult> {
    const { sourcePath, newName, storage, guard, engine } = options;

    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      const err: any = new Error('New project name is required');
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    if (!(await storage.exists(sourcePath))) {
      const err: any = new Error(`Source project not found at: ${sourcePath}`);
      err.code = ErrorCode.STATE_RECOVERY_REQUIRED;
      throw err;
    }

    // Load source metadata to get source projectId and revision
    const sourceMetadata = await storage.readJson<{ projectId: string; stateRevision: number }>(
      join(sourcePath, 'project.json')
    );
    const sourceProjectId = sourceMetadata.projectId;
    const sourceRevision = sourceMetadata.stateRevision || 1;

    const newProjectId = options.newProjectId
      ? guard.validateProjectId(options.newProjectId)
      : `${sourceProjectId}-fork-${Date.now().toString(36).slice(-4)}`;

    const targetPath = options.targetPath
      ? guard.assertContained(guard.projectsDir, options.targetPath, 'Target project path')
      : guard.resolveProjectPath(newProjectId);

    if (await storage.exists(targetPath)) {
      const err: any = new Error(`Target project directory already exists: ${targetPath}`);
      err.code = ErrorCode.STATE_COMMIT_FAILED;
      throw err;
    }

    // Staging temp directory
    const tmpBase = join(guard.workspaceRoot, '.tmp');
    await mkdir(tmpBase, { recursive: true });
    const tempStagingDir = join(
      tmpBase,
      `fork-${newProjectId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    );

    try {
      // 1. Recursive copy to staging
      await cp(sourcePath, tempStagingDir, { recursive: true });

      const timestamp = new Date().toISOString();

      // 2. Rewrite project.json
      const projectJsonPath = join(tempStagingDir, 'project.json');
      if (await storage.exists(projectJsonPath)) {
        const metadata = await storage.readJson<any>(projectJsonPath);
        metadata.projectId = newProjectId;
        metadata.name = newName.trim();
        metadata.updatedAt = timestamp;
        metadata.forkedFrom = {
          sourceProjectId,
          sourceRevision,
          forkedAt: timestamp,
        };
        await storage.writeJson(projectJsonPath, metadata);
      }

      // 3. Rewrite state/*.json files
      const stateDir = join(tempStagingDir, 'state');
      if (await storage.exists(stateDir)) {
        const stateFiles = [
          'overview.json',
          'manifest.json',
          'decisions.json',
          'gaps.json',
          'questions.json',
          'assumptions.json',
          'risks.json',
          'documents.json',
          'readiness.json',
          'timeline.json',
        ];

        for (const fileName of stateFiles) {
          const filePath = join(stateDir, fileName);
          if (await storage.exists(filePath)) {
            const data = await storage.readJson<any>(filePath);
            if (data && typeof data === 'object') {
              data.projectId = newProjectId;

              // Specific state adjustments for fork
              if (fileName === 'readiness.json' && data.current) {
                // Reset approval disposition on newly branched project
                data.current.userDisposition = 'pending';
                delete data.current.userApprovedAt;
                delete data.current.approvedBy;
              }

              await storage.writeJson(filePath, data);
            }
          }
        }

        // 3.1 Rewrite state/revisions/*/*.json files
        const revisionsDir = join(tempStagingDir, 'state', 'revisions');
        if (await storage.exists(revisionsDir)) {
          const revDirs = await storage.listFiles(revisionsDir);
          for (const revName of revDirs) {
            const revPath = join(revisionsDir, revName);
            const revFiles = await storage.listFiles(revPath);
            for (const fileName of revFiles) {
              if (fileName.endsWith('.json')) {
                const filePath = join(revPath, fileName);
                const data = await storage.readJson<any>(filePath);
                if (data && typeof data === 'object') {
                  data.projectId = newProjectId;
                  if (fileName === 'metadata.json') {
                    data.name = newName.trim();
                    data.forkedFrom = {
                      sourceProjectId,
                      sourceRevision,
                      forkedAt: timestamp,
                    };
                  }
                  if (fileName === 'readiness.json' && data.current) {
                    data.current.userDisposition = 'pending';
                    delete data.current.userApprovedAt;
                    delete data.current.approvedBy;
                  }
                  await storage.writeJson(filePath, data);
                }
              }
            }
          }
        }
      }

      // 3.2 Rewrite documents/manifest.json
      const docManifestPath = join(tempStagingDir, 'documents', 'manifest.json');
      if (await storage.exists(docManifestPath)) {
        const docManifest = await storage.readJson<any>(docManifestPath);
        if (docManifest && typeof docManifest === 'object') {
          docManifest.projectId = newProjectId;
          await storage.writeJson(docManifestPath, docManifest);
        }
      }

      // 4. Rewrite runtime/*.json files
      const runtimeDir = join(tempStagingDir, 'runtime');
      if (await storage.exists(runtimeDir)) {
        const turnsPath = join(runtimeDir, 'discovery-turns.json');
        if (await storage.exists(turnsPath)) {
          const turnsData = await storage.readJson<any>(turnsPath);
          const turns = Array.isArray(turnsData) ? turnsData : turnsData?.turns;
          if (Array.isArray(turns)) {
            for (const turn of turns) {
              turn.projectId = newProjectId;
              if (turn.status === 'running' || turn.status === 'queued') {
                turn.status = 'cancelled';
              }
            }
            await storage.writeJson(
              turnsPath,
              Array.isArray(turnsData) ? turns : { ...turnsData, turns }
            );
          }
        }

        const jobsPath = join(runtimeDir, 'discovery-jobs.json');
        if (await storage.exists(jobsPath)) {
          const jobsData = await storage.readJson<any>(jobsPath);
          if (jobsData && typeof jobsData === 'object') {
            if (jobsData.currentJob) {
              jobsData.currentJob.projectId = newProjectId;
              jobsData.currentJob.status = 'cancelled';
            }
            await storage.writeJson(jobsPath, jobsData);
          }
        }
      }

      // 5. Complete validation by loading through engine
      const snapshot = await engine.loadProject(tempStagingDir);
      if (snapshot.metadata.projectId !== newProjectId) {
        throw new Error(`Integrity check failed: expected projectId "${newProjectId}", but found "${snapshot.metadata.projectId}"`);
      }

      // 6. Atomic rename to targetPath
      await mkdir(dirname(targetPath), { recursive: true });
      await rename(tempStagingDir, targetPath);

      // Return fresh snapshot from targetPath
      const finalSnapshot = await engine.loadProject(targetPath);
      return {
        newProjectId,
        targetPath,
        snapshot: finalSnapshot,
      };
    } catch (err) {
      // Clean up staging directory on failure
      await rm(tempStagingDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }
}
