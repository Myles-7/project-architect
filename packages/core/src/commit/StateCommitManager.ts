import { join, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { FileStorage } from '../storage/FileStorage.js';
import type { ProjectMetadata } from '@project-architect/contracts';

export interface RevisionFileEntry {
  filename: string;
  sizeBytes: number;
  sha256?: string;
}

export interface RevisionManifest {
  revision: number;
  projectId: string;
  timestamp: string;
  files: RevisionFileEntry[];
  verified: boolean;
}

export interface CurrentPointer {
  revision: number;
  timestamp: string;
  manifestFile: string;
}

export interface CommitMarker {
  targetRevision: number;
  timestamp: string;
  files: string[];
}

export interface CandidateFiles {
  metadata?: ProjectMetadata;
  overview?: unknown;
  decisions?: unknown;
  assumptions?: unknown;
  gaps?: unknown;
  risks?: unknown;
  questions?: unknown;
  readiness?: unknown;
  manifest?: unknown;
  documents?: unknown;
  planning?: unknown;
  blueprint?: unknown;
  changesets?: unknown;
}

const projectCommitLocks = new Map<string, Promise<void>>();
const commitLockOwners = new AsyncLocalStorage<Set<string>>();
export class StateCommitManager {
  private storage: FileStorage;
  private projectLocks = projectCommitLocks;
  private maxRetainedRevisions: number;

  constructor(
    storage: FileStorage = new FileStorage(),
    maxRetainedRevisions: number = 10
  ) {
    this.storage = storage;
    this.maxRetainedRevisions = Math.max(5, maxRetainedRevisions);
  }

  getStagingDir(projectPath: string): string {
    return join(projectPath, 'state', '.commit_staging');
  }

  getMarkerPath(projectPath: string): string {
    return join(projectPath, 'state', '.commit_marker.json');
  }

  getCurrentPointerPath(projectPath: string): string {
    return join(projectPath, 'state', 'current.json');
  }

  getRevisionsDir(projectPath: string): string {
    return join(projectPath, 'state', 'revisions');
  }

  getRevisionDir(projectPath: string, revision: number): string {
    return join(projectPath, 'state', 'revisions', String(revision));
  }

  getRevisionManifestPath(projectPath: string, revision: number): string {
    return join(this.getRevisionDir(projectPath, revision), 'manifest.json');
  }

  /**
   * Serializes per-project commits using an async mutex.
   */
  async withProjectLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
    let rawPath = resolve(projectPath);
    try {
      rawPath = (realpathSync as any).native ? (realpathSync as any).native(rawPath) : realpathSync(rawPath);
    } catch {
      // 容错处理：若路径尚不存在或权限受限，保持 resolve 原状
    }
    const key = process.platform === 'win32' ? rawPath.toLowerCase() : rawPath;
    if(commitLockOwners.getStore()?.has(key))return fn();
    while (this.projectLocks.has(key)) {
      await this.projectLocks.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolveLock = res;
    });
    this.projectLocks.set(key, lockPromise);
    try {
      return await commitLockOwners.run(new Set([...(commitLockOwners.getStore()??[]),key]),fn);
    } finally {
      this.projectLocks.delete(key);
      resolveLock();
    }
  }

  /**
   * Verifies and recovers project state from the last complete, verified revision snapshot.
   */
  async recoverIfNeeded(
    projectPath: string
  ): Promise<{ recovered: boolean; action: string; activeRevision?: number }> {
    return this.withProjectLock(projectPath, async () => {
      const revisionsDir = this.getRevisionsDir(projectPath);
      const pointerPath = this.getCurrentPointerPath(projectPath);
      const projectJsonPath = join(projectPath, 'project.json');

      // 1. One-time Legacy Migration: if project.json exists but no revisions/ or current.json
      if (!(await this.storage.exists(pointerPath)) && !(await this.storage.exists(revisionsDir))) {
        if (await this.storage.exists(projectJsonPath)) {
          try {
            const meta = await this.storage.readJson<ProjectMetadata>(projectJsonPath);
            const initialRev = meta.stateRevision || 1;
            await this.migrateLegacyState(projectPath, initialRev, meta);
            return {
              recovered: true,
              action: 'migrated_legacy_state',
              activeRevision: initialRev,
            };
          } catch {
            // fall through
          }
        }
      }

      // 2. Validate current.json pointer
      let currentPointer: CurrentPointer | null = null;
      if (await this.storage.exists(pointerPath)) {
        try {
          currentPointer = await this.storage.readJson<CurrentPointer>(pointerPath);
        } catch {
          currentPointer = null;
        }
      }

      if (currentPointer && typeof currentPointer.revision === 'number') {
        const isCurrentValid = await this.verifySnapshot(projectPath, currentPointer.revision);
        if (isCurrentValid) {
          // Clean legacy staging/markers if any
          await this.cleanStagingAndMarkers(projectPath);
          // Ensure canonical files match verified snapshot
          await this.syncCanonicalStateFromSnapshot(projectPath, currentPointer.revision);
          return {
            recovered: false,
            action: 'verified_current',
            activeRevision: currentPointer.revision,
          };
        }
      }

      // 3. Current pointer is missing or corrupted: scan revisions/ for last verified snapshot
      const availableRevisions = await this.listAvailableRevisions(projectPath);
      for (const rev of availableRevisions) {
        const isValid = await this.verifySnapshot(projectPath, rev);
        if (isValid) {
          // Restore pointer to this last verified revision
          const pointer: CurrentPointer = {
            revision: rev,
            timestamp: new Date().toISOString(),
            manifestFile: 'manifest.json',
          };
          await this.storage.writeJson(pointerPath, pointer);
          await this.syncCanonicalStateFromSnapshot(projectPath, rev);
          await this.cleanStagingAndMarkers(projectPath);
          await this.cleanIncompleteRevisionsAbove(projectPath, rev);

          return {
            recovered: true,
            action: `restored_to_last_verified_revision_${rev}`,
            activeRevision: rev,
          };
        }
      }

      // 4. Fallback: clean lingering staging or markers
      await this.cleanStagingAndMarkers(projectPath);
      return { recovered: false, action: 'no_snapshots_available' };
    });
  }

  async getCurrentRevision(projectPath: string): Promise<number> {
    const pointerPath = this.getCurrentPointerPath(projectPath);
    if (await this.storage.exists(pointerPath)) {
      try {
        const pointer = await this.storage.readJson<CurrentPointer>(pointerPath);
        if (typeof pointer?.revision === 'number') {
          return pointer.revision;
        }
      } catch {
        // ignore
      }
    }
    const projectJsonPath = join(projectPath, 'project.json');
    if (await this.storage.exists(projectJsonPath)) {
      try {
        const meta = await this.storage.readJson<ProjectMetadata>(projectJsonPath);
        if (typeof meta?.stateRevision === 'number') {
          return meta.stateRevision;
        }
      } catch {
        // ignore
      }
    }
    return 0;
  }

  /**
   * Executes a robust, verifiable state commit:
   * 1. Writes full snapshot files to state/revisions/<targetRevision>/
   * 2. Writes and verifies state/revisions/<targetRevision>/manifest.json
   * 3. Atomically switches state/current.json pointer
   * 4. Synchronizes canonical project.json and state/*.json projection
   * 5. Prunes old revisions conservatively
   */
  async commit(
    projectPath: string,
    targetRevision: number,
    candidate: CandidateFiles,
    expectedBaseRevision?: number
  ): Promise<void> {
    return this.withProjectLock(projectPath, async () => {
      if (expectedBaseRevision !== undefined && targetRevision > 1) {
        const currentRev = await this.getCurrentRevision(projectPath);
        if (currentRev !== 0 && currentRev !== expectedBaseRevision) {
          const err: any = new Error(
            `State revision conflict inside commit lock: expected base revision ${expectedBaseRevision}, but current state revision is ${currentRev}`
          );
          err.code = 'STATE_REVISION_CONFLICT';
          throw err;
        }
      }

      const stateDir = join(projectPath, 'state');
      const revDir = this.getRevisionDir(projectPath, targetRevision);
      const manifestPath = this.getRevisionManifestPath(projectPath, targetRevision);
      const pointerPath = this.getCurrentPointerPath(projectPath);
      const timestamp = new Date().toISOString();

      await this.storage.ensureDir(revDir);
      await this.storage.ensureDir(stateDir);

      const writtenFileEntries: RevisionFileEntry[] = [];

      // Helper to write snapshot file
      const writeSnapshotFile = async (filename: string, content: unknown) => {
        if (content !== undefined) {
          const filePath = join(revDir, filename);
          const serialized = JSON.stringify(content, null, 2) + '\n';
          await this.storage.writeText(filePath, serialized);
          writtenFileEntries.push({
            filename,
            sizeBytes: Buffer.byteLength(serialized, 'utf8'),
            sha256: createHash('sha256').update(serialized).digest('hex'),
          });
        }
      };

      // Determine Project ID and Metadata
      const projectJsonPath = join(projectPath, 'project.json');
      let currentMeta: ProjectMetadata | undefined = candidate.metadata;
      if (!currentMeta && (await this.storage.exists(projectJsonPath))) {
        currentMeta = await this.storage.readJson<ProjectMetadata>(projectJsonPath);
      }
      const projectId = currentMeta?.projectId || 'unknown';

      // 1. Write candidate state files into revision directory (inheriting missing parts from canonical state)
      const stateFiles = [
        'overview.json',
        'decisions.json',
        'assumptions.json',
        'gaps.json',
        'risks.json',
        'questions.json',
        'readiness.json',
        'documents.json',
        'planning.json',
        'blueprint.json',
        'changesets.json',
      ];

      for (const file of stateFiles) {
        const key = file.replace('.json', '') as keyof CandidateFiles;
        let content = candidate[key];
        if (key === 'documents' && content === undefined && candidate.manifest !== undefined) {
          content = candidate.manifest;
        }
        if (content !== undefined) {
          await writeSnapshotFile(file, content);
        } else {
          // Inherit from canonical state if file exists
          const canonicalPath = join(stateDir, file);
          if (await this.storage.exists(canonicalPath)) {
            const existing = await this.storage.readJson(canonicalPath);
            await writeSnapshotFile(file, existing);
          }
        }
      }

      // Write metadata inside revision snapshot
      if (currentMeta) {
        const revMeta: ProjectMetadata = {
          ...currentMeta,
          stateRevision: targetRevision,
          updatedAt: timestamp,
        };
        await writeSnapshotFile('metadata.json', revMeta);
      }

      // 2. Build and write Revision Manifest
      const manifest: RevisionManifest = {
        revision: targetRevision,
        projectId,
        timestamp,
        files: writtenFileEntries,
        verified: true,
      };
      await this.storage.writeJson(manifestPath, manifest);

      // 3. Verify snapshot integrity before pointer switch
      const verified = await this.verifySnapshot(projectPath, targetRevision);
      if (!verified) {
        throw new Error(
          `Snapshot verification failed for revision ${targetRevision}: incomplete snapshot files.`
        );
      }

      // 4. Atomic Pointer Switch (Single Visible Point of Truth)
      const pointer: CurrentPointer = {
        revision: targetRevision,
        timestamp,
        manifestFile: 'manifest.json',
      };
      await this.storage.writeJson(pointerPath, pointer);

      // 5. Synchronize canonical root projection
      for (const entry of writtenFileEntries) {
        if (entry.filename === 'metadata.json') {
          const metaContent = await this.storage.readJson(join(revDir, 'metadata.json'));
          await this.storage.writeJson(projectJsonPath, metaContent);
        } else {
          const fileContent = await this.storage.readJson(join(revDir, entry.filename));
          await this.storage.writeJson(join(stateDir, entry.filename), fileContent);
        }
      }

      // Synchronize documents manifest if provided
      if (candidate.manifest !== undefined) {
        const docDir = join(projectPath, 'documents');
        await this.storage.ensureDir(docDir);
        await this.storage.writeJson(join(docDir, 'manifest.json'), candidate.manifest);
      }

      // 6. Conservative Pruning: Keep recent revisions
      await this.pruneOldRevisions(projectPath, targetRevision);

      // 7. Clean up staging & legacy markers
      await this.cleanStagingAndMarkers(projectPath);
    });
  }

  /**
   * Verifies that all files declared in a revision manifest exist and are valid readable JSON.
   */
  async verifySnapshot(projectPath: string, revision: number): Promise<boolean> {
    const revDir = this.getRevisionDir(projectPath, revision);
    const manifestPath = this.getRevisionManifestPath(projectPath, revision);

    if (!(await this.storage.exists(manifestPath))) {
      return false;
    }

    try {
      const manifest = await this.storage.readJson<RevisionManifest>(manifestPath);
      if (manifest.revision !== revision || !manifest.verified || !Array.isArray(manifest.files)) {
        return false;
      }

      for (const entry of manifest.files) {
        if (!['metadata.json','overview.json','decisions.json','assumptions.json','gaps.json','risks.json','questions.json','readiness.json','documents.json','planning.json','blueprint.json','changesets.json'].includes(entry.filename)) return false;
        const filePath = join(revDir, entry.filename);
        if (!(await this.storage.exists(filePath))) {
          return false;
        }
        // Verify JSON parseability
        await this.storage.readJson(filePath);
        if (entry.sha256 && createHash('sha256').update(await this.storage.readText(filePath)).digest('hex') !== entry.sha256) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists available revision numbers in descending order [N, N-1, ...].
   */
  private async listAvailableRevisions(projectPath: string): Promise<number[]> {
    const revisionsDir = this.getRevisionsDir(projectPath);
    if (!(await this.storage.exists(revisionsDir))) {
      return [];
    }

    const entries = await this.storage.listFiles(revisionsDir);
    const revNumbers: number[] = [];
    for (const entry of entries) {
      const num = Number(entry);
      if (!Number.isNaN(num) && num > 0) {
        revNumbers.push(num);
      }
    }

    return revNumbers.sort((a, b) => b - a);
  }

  /**
   * Synchronizes canonical root state files from a verified snapshot directory.
   */
  private async syncCanonicalStateFromSnapshot(
    projectPath: string,
    revision: number
  ): Promise<void> {
    const revDir = this.getRevisionDir(projectPath, revision);
    const stateDir = join(projectPath, 'state');
    const projectJsonPath = join(projectPath, 'project.json');

    const manifest = await this.storage.readJson<RevisionManifest>(join(revDir,'manifest.json'));
    const files = manifest.files.map(entry => entry.filename);
    for (const file of ['planning.json','blueprint.json','changesets.json']) {
      if (!files.includes(file)) await this.storage.remove(join(stateDir,file));
    }
    for (const file of files) {
      if (file === 'manifest.json') continue;
      if (file === 'metadata.json') {
        const meta = await this.storage.readJson(join(revDir, 'metadata.json'));
        await this.storage.writeJson(projectJsonPath, meta);
      } else if (file.endsWith('.json')) {
        const content = await this.storage.readJson(join(revDir, file));
        await this.storage.writeJson(join(stateDir, file), content);
      }
    }
  }

  /**
   * Conservatively prunes historical revisions older than maxRetainedRevisions.
   */
  private async pruneOldRevisions(
    projectPath: string,
    activeRevision: number
  ): Promise<void> {
    const revisions = await this.listAvailableRevisions(projectPath);
    // Keep at least the active revision and the last verified predecessor
    if (revisions.length <= this.maxRetainedRevisions) {
      return;
    }

    const toDelete = revisions.slice(this.maxRetainedRevisions);
    for (const rev of toDelete) {
      if (rev === activeRevision) continue; // Never delete active revision
      const revDir = this.getRevisionDir(projectPath, rev);
      await this.storage.remove(revDir);
    }
  }

  /**
   * Cleans up incomplete revisions created after a crash above the restored revision.
   */
  private async cleanIncompleteRevisionsAbove(
    projectPath: string,
    verifiedRevision: number
  ): Promise<void> {
    const revisions = await this.listAvailableRevisions(projectPath);
    for (const rev of revisions) {
      if (rev > verifiedRevision) {
        const revDir = this.getRevisionDir(projectPath, rev);
        await this.storage.remove(revDir);
      }
    }
  }

  private async cleanStagingAndMarkers(projectPath: string): Promise<void> {
    const stagingDir = this.getStagingDir(projectPath);
    const markerPath = this.getMarkerPath(projectPath);

    if (await this.storage.exists(stagingDir)) {
      await this.storage.remove(stagingDir);
    }
    if (await this.storage.exists(markerPath)) {
      await this.storage.remove(markerPath);
    }
  }

  /**
   * Migrates legacy single-folder state into the versioned snapshot format.
   */
  private async migrateLegacyState(
    projectPath: string,
    revision: number,
    metadata: ProjectMetadata
  ): Promise<void> {
    const stateDir = join(projectPath, 'state');
    const revDir = this.getRevisionDir(projectPath, revision);
    const manifestPath = this.getRevisionManifestPath(projectPath, revision);
    const pointerPath = this.getCurrentPointerPath(projectPath);
    const timestamp = new Date().toISOString();

    await this.storage.ensureDir(revDir);

    const writtenFiles: RevisionFileEntry[] = [];
    const stateFiles = await this.storage.listFiles(stateDir);

    for (const file of stateFiles) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        const content = await this.storage.readText(join(stateDir, file));
        await this.storage.writeText(join(revDir, file), content);
        writtenFiles.push({
          filename: file,
          sizeBytes: Buffer.byteLength(content, 'utf8'),
        });
      }
    }

    // Write metadata.json into snapshot
    const metaSerialized = JSON.stringify(metadata, null, 2) + '\n';
    await this.storage.writeText(join(revDir, 'metadata.json'), metaSerialized);
    writtenFiles.push({
      filename: 'metadata.json',
      sizeBytes: Buffer.byteLength(metaSerialized, 'utf8'),
    });

    // Write manifest
    const manifest: RevisionManifest = {
      revision,
      projectId: metadata.projectId,
      timestamp,
      files: writtenFiles,
      verified: true,
    };
    await this.storage.writeJson(manifestPath, manifest);

    // Write pointer
    const pointer: CurrentPointer = {
      revision,
      timestamp,
      manifestFile: 'manifest.json',
    };
    await this.storage.writeJson(pointerPath, pointer);
  }
}
