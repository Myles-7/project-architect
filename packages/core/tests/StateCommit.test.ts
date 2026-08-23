import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateCommitManager } from '../src/commit/StateCommitManager.js';
import { FileStorage } from '../src/storage/FileStorage.js';
import type { ProjectMetadata } from '@project-architect/contracts';

describe('StateCommitManager Snapshot Versioning & Fault-Injection Recovery (Phase 4.8.3)', () => {
  let commitManager: StateCommitManager;
  let testProjectDir: string;
  const storage = new FileStorage();

  const createBaseMetadata = (revision = 1): ProjectMetadata => ({
    schemaVersion: 1,
    projectId: 'proj-commit-test',
    name: 'Commit Hardening Project',
    stage: 'created',
    stateRevision: revision,
    projectTags: ['Developer Tool'],
    inputRefs: [],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  beforeEach(async () => {
    commitManager = new StateCommitManager(storage, 5);
    testProjectDir = join(
      tmpdir(),
      `pa-commit-fi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    );
    await storage.ensureDir(testProjectDir);
    await storage.ensureDir(join(testProjectDir, 'state'));
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('1. Clean Commit: writes full snapshot to revisions/N/, updates current.json pointer, and syncs canonical state', async () => {
    const meta = createBaseMetadata(1);
    await storage.writeJson(join(testProjectDir, 'project.json'), meta);

    await commitManager.commit(testProjectDir, 2, {
      metadata: meta,
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-commit-test',
        items: [{ id: 'dec-01', area: 'target_user', statement: 'Developers', status: 'confirmed' }],
        updatedAt: new Date().toISOString(),
      },
      overview: { schemaVersion: 1, projectId: 'proj-commit-test', sections: [], updatedAt: '' },
    });

    // Verify snapshot in revisions/2/
    const rev2Dir = commitManager.getRevisionDir(testProjectDir, 2);
    expect(await storage.exists(rev2Dir)).toBe(true);
    expect(await storage.exists(join(rev2Dir, 'manifest.json'))).toBe(true);
    expect(await storage.exists(join(rev2Dir, 'decisions.json'))).toBe(true);
    expect(await storage.exists(join(rev2Dir, 'metadata.json'))).toBe(true);

    // Verify current pointer
    const pointer = await storage.readJson<any>(commitManager.getCurrentPointerPath(testProjectDir));
    expect(pointer.revision).toBe(2);

    // Verify canonical state
    const canonicalMeta = await storage.readJson<ProjectMetadata>(join(testProjectDir, 'project.json'));
    expect(canonicalMeta.stateRevision).toBe(2);
  });

  it('2. Fault Injection 1: Crash during snapshot writing (partial files written, no manifest)', async () => {
    const meta = createBaseMetadata(1);
    await storage.writeJson(join(testProjectDir, 'project.json'), meta);

    // Commit revision 2 successfully
    await commitManager.commit(testProjectDir, 2, {
      metadata: meta,
      decisions: { schemaVersion: 1, projectId: 'proj-commit-test', items: [], updatedAt: '' },
    });

    // Simulate crash during revision 3 (only partial file written, no manifest.json, pointer still 2)
    const rev3Dir = commitManager.getRevisionDir(testProjectDir, 3);
    await storage.ensureDir(rev3Dir);
    await storage.writeText(join(rev3Dir, 'decisions.json'), '{"partial": true}');

    // Run recovery
    const recovery = await commitManager.recoverIfNeeded(testProjectDir);
    expect(recovery.activeRevision).toBe(2);

    // Pointer and canonical state remain at verified revision 2
    const pointer = await storage.readJson<any>(commitManager.getCurrentPointerPath(testProjectDir));
    expect(pointer.revision).toBe(2);
    const checkMeta = await storage.readJson<ProjectMetadata>(join(testProjectDir, 'project.json'));
    expect(checkMeta.stateRevision).toBe(2);
  });

  it('3. Fault Injection 2: Crash after complete snapshot written, but before current.json pointer switch', async () => {
    const meta = createBaseMetadata(1);
    await storage.writeJson(join(testProjectDir, 'project.json'), meta);

    // Revision 1 is active
    await commitManager.commit(testProjectDir, 1, {
      metadata: meta,
      decisions: { schemaVersion: 1, projectId: 'proj-commit-test', items: [], updatedAt: '' },
    });

    // Simulate writing revision 2 completely with manifest, but power cut before current.json updated
    const rev2Dir = commitManager.getRevisionDir(testProjectDir, 2);
    await storage.ensureDir(rev2Dir);
    await storage.writeJson(join(rev2Dir, 'metadata.json'), { ...meta, stateRevision: 2 });
    await storage.writeJson(join(rev2Dir, 'decisions.json'), {
      schemaVersion: 1,
      projectId: 'proj-commit-test',
      items: [{ id: 'dec-recovered', statement: 'Recovered Decision' }],
      updatedAt: '',
    });
    await storage.writeJson(join(rev2Dir, 'manifest.json'), {
      revision: 2,
      projectId: 'proj-commit-test',
      timestamp: new Date().toISOString(),
      files: [
        { filename: 'metadata.json', sizeBytes: 100 },
        { filename: 'decisions.json', sizeBytes: 100 },
      ],
      verified: true,
    });

    // Current pointer still points to 1
    await storage.writeJson(commitManager.getCurrentPointerPath(testProjectDir), {
      revision: 1,
      timestamp: new Date().toISOString(),
      manifestFile: 'manifest.json',
    });

    // Run recovery
    const recovery = await commitManager.recoverIfNeeded(testProjectDir);
    expect(recovery.activeRevision).toBe(1);

    // If current.json is deleted/corrupted, recovery automatically finds latest verified revision 2!
    await storage.remove(commitManager.getCurrentPointerPath(testProjectDir));
    const recovery2 = await commitManager.recoverIfNeeded(testProjectDir);
    expect(recovery2.recovered).toBe(true);
    expect(recovery2.activeRevision).toBe(2);

    const canonicalMeta = await storage.readJson<ProjectMetadata>(join(testProjectDir, 'project.json'));
    expect(canonicalMeta.stateRevision).toBe(2);
  });

  it('4. Fault Injection 3: Corrupted or missing current.json pointer automatically scans and restores to latest verified snapshot', async () => {
    const meta = createBaseMetadata(1);
    await storage.writeJson(join(testProjectDir, 'project.json'), meta);

    // Commit revisions 1, 2, 3
    await commitManager.commit(testProjectDir, 1, { metadata: meta });
    await commitManager.commit(testProjectDir, 2, { metadata: meta });
    await commitManager.commit(testProjectDir, 3, {
      metadata: meta,
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-commit-test',
        items: [{ id: 'dec-3', statement: 'Revision 3 Confirmed' }],
        updatedAt: '',
      },
    });

    // Corrupt current.json
    await storage.writeText(commitManager.getCurrentPointerPath(testProjectDir), '{ corrupt json @@##');

    // Run recovery
    const recovery = await commitManager.recoverIfNeeded(testProjectDir);
    expect(recovery.recovered).toBe(true);
    expect(recovery.activeRevision).toBe(3);

    // Verify pointer was repaired and points to 3
    const pointer = await storage.readJson<any>(commitManager.getCurrentPointerPath(testProjectDir));
    expect(pointer.revision).toBe(3);
    const checkMeta = await storage.readJson<ProjectMetadata>(join(testProjectDir, 'project.json'));
    expect(checkMeta.stateRevision).toBe(3);
  });

  it('5. Fault Injection 4: Concurrent revision commits are safely serialized without corruption', async () => {
    const meta = createBaseMetadata(1);
    await storage.writeJson(join(testProjectDir, 'project.json'), meta);

    // Launch 5 concurrent commits in parallel
    const commitPromises = [2, 3, 4, 5, 6].map((rev) =>
      commitManager.commit(testProjectDir, rev, {
        metadata: { ...meta, stateRevision: rev },
        decisions: {
          schemaVersion: 1,
          projectId: 'proj-commit-test',
          items: [{ id: `dec-${rev}`, statement: `Decision for rev ${rev}` }],
          updatedAt: '',
        },
      })
    );

    await Promise.all(commitPromises);

    // State must be cleanly at revision 6
    const pointer = await storage.readJson<any>(commitManager.getCurrentPointerPath(testProjectDir));
    expect(pointer.revision).toBe(6);

    const checkMeta = await storage.readJson<ProjectMetadata>(join(testProjectDir, 'project.json'));
    expect(checkMeta.stateRevision).toBe(6);

    // Verification of snapshot 6
    const isRev6Valid = await commitManager.verifySnapshot(testProjectDir, 6);
    expect(isRev6Valid).toBe(true);
  });

  it('6. Legacy Migration: Automatically migrates un-versioned legacy projects on first load', async () => {
    // Setup a legacy project structure without current.json or revisions/
    const meta = createBaseMetadata(5);
    await storage.writeJson(join(testProjectDir, 'project.json'), meta);
    await storage.writeJson(join(testProjectDir, 'state', 'decisions.json'), {
      schemaVersion: 1,
      projectId: 'proj-commit-test',
      items: [{ id: 'dec-legacy', statement: 'Legacy decision' }],
      updatedAt: '',
    });

    const recovery = await commitManager.recoverIfNeeded(testProjectDir);
    expect(recovery.recovered).toBe(true);
    expect(recovery.action).toBe('migrated_legacy_state');
    expect(recovery.activeRevision).toBe(5);

    // Verify snapshot 5 was created
    expect(await storage.exists(commitManager.getRevisionDir(testProjectDir, 5))).toBe(true);
    expect(await storage.exists(commitManager.getCurrentPointerPath(testProjectDir))).toBe(true);
  });
});
