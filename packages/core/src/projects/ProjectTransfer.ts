import { cp, lstat, mkdir, readdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { ErrorCode, type ChangeSet, type ProjectMetadata, type ProjectSnapshot } from '@project-architect/contracts';
import { StateCommitManager, type CandidateFiles, type CurrentPointer, type RevisionManifest } from '../commit/StateCommitManager.js';
import type { ProjectStateEngine } from '../engine/ProjectStateEngine.js';
import type { FileStorage } from '../storage/FileStorage.js';

const requiredFiles = ['metadata.json', 'overview.json', 'decisions.json', 'assumptions.json', 'gaps.json', 'risks.json', 'questions.json', 'readiness.json'];

function invalid(message: string): never {
  const error = new Error(message) as Error & { code: string };
  error.code = ErrorCode.STATE_VALIDATION_FAILED;
  throw error;
}

/** Reject links before copying: a staged transfer must own every file it can mutate. */
export async function assertTransferTree(path: string): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) invalid(`Project transfer cannot contain symbolic links: ${path}`);
  if (stat.isDirectory()) {
    for (const entry of await readdir(path)) await assertTransferTree(join(path, entry));
  } else if (!stat.isFile()) invalid(`Project transfer contains an unsupported file: ${path}`);
}

/** Validate the exact source pointer before Engine recovery can silently choose another revision. */
export async function verifyTransferSource(path: string, storage: FileStorage): Promise<{ metadata: ProjectMetadata; candidate: CandidateFiles }> {
  const manager = new StateCommitManager(storage);
  let pointer: CurrentPointer;
  try { pointer = await storage.readJson<CurrentPointer>(manager.getCurrentPointerPath(path)); }
  catch { invalid('Project transfer requires a valid current snapshot pointer'); }
  if (!Number.isSafeInteger(pointer.revision) || pointer.revision < 1 || pointer.manifestFile !== 'manifest.json') invalid('Invalid project transfer snapshot pointer');
  if (!(await manager.verifySnapshot(path, pointer.revision))) invalid(`Project transfer source snapshot ${pointer.revision} failed verification`);
  const revisionDir = manager.getRevisionDir(path, pointer.revision);
  const manifest = await storage.readJson<RevisionManifest>(join(revisionDir, 'manifest.json'));
  const names = manifest.files.map(entry => entry.filename);
  if (new Set(names).size !== names.length || requiredFiles.some(file => !names.includes(file))) invalid('Project transfer source snapshot is incomplete');
  const candidate: CandidateFiles = {};
  for (const entry of manifest.files) {
    const data = await storage.readJson<unknown>(join(revisionDir, entry.filename));
    if ((await storage.readBuffer(join(revisionDir, entry.filename))).length !== entry.sizeBytes) invalid(`Project transfer snapshot size mismatch: ${entry.filename}`);
    const key = entry.filename.replace('.json', '') as keyof CandidateFiles;
    (candidate as Record<string, unknown>)[key] = data;
  }
  const metadata = candidate.metadata!;
  if (!metadata || typeof metadata.projectId !== 'string' || metadata.stateRevision !== pointer.revision || manifest.projectId !== metadata.projectId) invalid('Project transfer source identity does not match its snapshot');
  const canonicalMetadata = await storage.readJson<ProjectMetadata>(join(path, 'project.json'));
  if (canonicalMetadata.projectId !== metadata.projectId || canonicalMetadata.stateRevision !== pointer.revision) invalid('Project transfer canonical identity does not match its snapshot');
  for (const [key, value] of Object.entries(candidate)) {
    if ((requiredFiles.includes(`${key}.json`) || key === 'documents') && (!value || typeof value !== 'object' || Array.isArray(value))) invalid(`Project transfer source state is invalid: ${key}`);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const id = (value as { projectId?: unknown }).projectId;
      if ((requiredFiles.includes(`${key}.json`) || key === 'documents') && id !== metadata.projectId) invalid(`Project transfer source identity mismatch: ${key}`);
      if (id !== undefined && id !== metadata.projectId) invalid(`Project transfer source identity mismatch: ${key}`);
    }
  }
  const planningFiles = ['planning.json', 'blueprint.json', 'changesets.json'].filter(file => names.includes(file));
  if (planningFiles.length !== 0 && planningFiles.length !== 3) invalid('Project transfer source planning snapshot is incomplete');
  return { metadata, candidate };
}

/** Only the independent staging tree is transformed; historical snapshots and receipts stay intact. */
export async function prepareProjectTransfer(options: {
  stagingPath: string;
  projectId: string;
  name?: string;
  kind: 'fork' | 'import';
  storage: FileStorage;
  engine: ProjectStateEngine;
}): Promise<ProjectSnapshot> {
  const { stagingPath, projectId, storage, engine, kind } = options;
  const { metadata, candidate } = await verifyTransferSource(stagingPath, storage);
  const name = options.name ?? metadata.name;
  const changed = projectId !== metadata.projectId || name !== metadata.name;
  const timestamp = new Date().toISOString();
  const transferPath = join(stagingPath, 'history', 'transfers', randomUUID());
  const archived: Array<{ source: string; destination: string }> = [];
  // Core commit inherits omitted canonical slices. Quarantine any projection absent from the source manifest.
  for (const key of ['documents', 'planning', 'blueprint', 'changesets'] as const) {
    const source = join(stagingPath, 'state', `${key}.json`);
    if (candidate[key] === undefined && await storage.exists(source)) {
      const destination = join('uncommitted-projections', 'state', `${key}.json`);
      await mkdir(dirname(join(transferPath, destination)), { recursive: true });
      await rename(source, join(transferPath, destination));
      archived.push({ source: `state/${key}.json`, destination: destination.replace(/\\/g, '/') });
    }
  }
  const runtimePath = join(stagingPath, 'runtime');
  if (await storage.exists(runtimePath)) {
    await mkdir(transferPath, { recursive: true });
    await rename(runtimePath, join(transferPath, 'runtime'));
    archived.push({ source: 'runtime', destination: 'runtime' });
  }

  if (changed) {
    for (const [key, value] of Object.entries(candidate)) {
      if (key !== 'metadata' && value && typeof value === 'object' && !Array.isArray(value) && 'projectId' in value) {
        (value as { projectId: string }).projectId = projectId;
      }
      // metadata receives a new updatedAt from the normal commit below.
      if (key !== 'metadata' && value && typeof value === 'object' && !Array.isArray(value) && 'updatedAt' in value) {
        (value as { updatedAt: string }).updatedAt = timestamp;
      }
    }
    candidate.metadata = { ...metadata, projectId, name, forkedFrom: { sourceProjectId: metadata.projectId, sourceRevision: metadata.stateRevision, forkedAt: timestamp } };
    const readiness = candidate.readiness as ProjectSnapshot['readiness'] & { current: { userApprovedAt?: string; approvedBy?: string } };
    if (readiness.current.userDisposition !== 'pending' && !readiness.history.some(entry => entry.id === readiness.current.id)) readiness.history.push(structuredClone(readiness.current));
    readiness.current.userDisposition = 'pending';
    delete readiness.current.userApprovedAt;
    delete readiness.current.approvedBy;
    if (candidate.planning && typeof candidate.planning === 'object') delete (candidate.planning as { package?: unknown }).package;
    const changes = candidate.changesets as ChangeSet[] | undefined;
    for (const change of changes ?? []) if (['pending', 'partially-approved'].includes(change.status)) change.status = 'stale';

    const documentsManifest = join(stagingPath, 'documents', 'manifest.json');
    if (await storage.exists(documentsManifest)) {
      const manifest = await storage.readJson<{ projectId: string }>(documentsManifest);
      if (manifest.projectId !== metadata.projectId) invalid('Project transfer document manifest identity mismatch');
      await mkdir(join(transferPath, 'documents'), { recursive: true });
      await cp(documentsManifest, join(transferPath, 'documents', 'manifest.json'));
      archived.push({ source: 'documents/manifest.json', destination: 'documents/manifest.json' });
      candidate.manifest = { ...manifest, projectId };
    }
    // Preserve all copied history during this commit, including revisions older than Core's default retention.
    const manager = new StateCommitManager(storage, Number.MAX_SAFE_INTEGER);
    const nextRevision = metadata.stateRevision + 1;
    if (await storage.exists(manager.getRevisionDir(stagingPath, nextRevision))) invalid('Project transfer would overwrite an existing historical revision');
    await manager.commit(stagingPath, nextRevision, candidate, metadata.stateRevision);
  }
  const snapshot = await engine.loadProject(stagingPath);
  await verifyTransferSource(stagingPath, storage);
  if (snapshot.metadata.projectId !== projectId || snapshot.metadata.name !== name) invalid('Project transfer final identity mismatch');
  await storage.writeJson(join(transferPath, 'transfer.json'), {
    schemaVersion: 1, kind, transferredAt: timestamp,
    sourceProjectId: metadata.projectId, sourceRevision: metadata.stateRevision,
    projectId, revision: snapshot.metadata.stateRevision,
    runtimeDisposition: 'isolated-historical', archived,
  });
  return snapshot;
}

/** No fallible state work remains after promotion, and concurrent in-process transfers cannot overwrite. */
export async function promoteProjectTransfer(stagingPath: string, targetPath: string, storage: FileStorage): Promise<void> {
  await new StateCommitManager(storage).withProjectLock(targetPath, async () => {
    if (await storage.exists(targetPath)) {
      const error = new Error(`Target project directory already exists: ${targetPath}`) as Error & { code: string };
      error.code = ErrorCode.STATE_COMMIT_FAILED;
      throw error;
    }
    await mkdir(dirname(resolve(targetPath)), { recursive: true });
    await rename(stagingPath, targetPath);
  });
}
