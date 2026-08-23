import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StateCommitManager } from '../../packages/core/src/commit/StateCommitManager.js';
import { ProjectStateEngine } from '../../packages/core/src/engine/ProjectStateEngine.js';
import { FileStorage } from '../../packages/core/src/storage/FileStorage.js';

describe('Reliability Suite 2: State Recovery & Fault Injection', () => {
  let tempBaseDir: string;
  let projectPath: string;
  let storage: FileStorage;
  let commitManager: StateCommitManager;
  let engine: ProjectStateEngine;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-rel-rec-'));
    projectPath = join(tempBaseDir, 'fault-project');
    storage = new FileStorage();
    commitManager = new StateCommitManager(storage);
    engine = new ProjectStateEngine(storage);

    // Initial valid state at revision 1
    await engine.createProject({
      projectPath,
      name: 'Resilience Test Project',
      idea: 'Testing crash recovery and pointer switching',
    });
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Partial Write Recovery: Discards unmanifested snapshot and rolls back to verified revision', async () => {
    const s1 = await engine.getSnapshot(projectPath);
    expect(s1.metadata.stateRevision).toBe(1);

    // Commit valid revision 2
    await engine.addDecision(projectPath, 'target_user', 'Engineers', 1, 'confirmed');
    const s2 = await engine.getSnapshot(projectPath);
    expect(s2.metadata.stateRevision).toBe(2);

    // Simulate crash during revision 3 write (folder created with partial file, no manifest.json)
    const rev3Dir = join(projectPath, 'state', 'revisions', '3');
    await storage.ensureDir(rev3Dir);
    await storage.writeText(join(rev3Dir, 'metadata.json'), '{"stateRevision": 3}'); // partial write

    // Recover project
    const recoveredSnap = await engine.loadProject(projectPath);
    expect(recoveredSnap.metadata.stateRevision).toBe(2);
    expect(recoveredSnap.decisions.items.some((d) => d.statement === 'Engineers')).toBe(true);
  });

  it('2. Corrupted Pointer Recovery: Replaces corrupted current.json pointer with latest valid snapshot', async () => {
    // Commit revision 2
    await engine.addDecision(projectPath, 'target_user', 'Terminal Users', 1, 'confirmed');

    // Corrupt current.json pointer
    const currentPointerFile = join(projectPath, 'state', 'current.json');
    await storage.writeText(currentPointerFile, '{ invalid json corrupted @#$');

    // Load project -> must recover to latest valid revision snapshot (rev 2)
    const recoveredSnap = await engine.loadProject(projectPath);
    expect(recoveredSnap.metadata.stateRevision).toBe(2);
    expect(recoveredSnap.decisions.items.some((d) => d.statement === 'Terminal Users')).toBe(true);
  });

  it('3. Damaged Manifest Recovery: Bypasses revision with corrupted manifest and selects previous healthy revision', async () => {
    // Commit rev 2
    await engine.addDecision(projectPath, 'target_user', 'Designers', 1, 'confirmed');

    // Commit rev 3
    await engine.addDecision(projectPath, 'mvp_scope', 'UI Components', 2, 'confirmed');

    // Corrupt manifest of rev 3
    const rev3Manifest = join(projectPath, 'state', 'revisions', '3', 'manifest.json');
    await storage.writeText(rev3Manifest, '{"revision": 3, "files": ["corrupted.json"]}');

    // Corrupt pointer to trigger search
    const currentPointer = join(projectPath, 'state', 'current.json');
    await storage.writeText(currentPointer, '{"revision": 3}');

    // Load project -> falls back to healthy rev 2
    const recovered = await engine.loadProject(projectPath);
    expect(recovered.metadata.stateRevision).toBe(2);
  });

  it('4. Concurrent Commit Mutex: Serializes simultaneous state commits without data corruption', async () => {
    const s1 = await engine.getSnapshot(projectPath);

    // Launch two parallel operations with mutex locking
    const op1 = commitManager.withProjectLock(projectPath, async () => {
      const snap = await engine.getSnapshot(projectPath);
      return await engine.addDecision(projectPath, 'target_user', 'User Group A', snap.metadata.stateRevision, 'confirmed');
    });

    const op2 = commitManager.withProjectLock(projectPath, async () => {
      const snap = await engine.getSnapshot(projectPath);
      return await engine.addDecision(projectPath, 'mvp_scope', 'Scope B', snap.metadata.stateRevision, 'confirmed');
    });

    const [res1, res2] = await Promise.all([op1, op2]);
    expect(res1.metadata.stateRevision).toBeGreaterThan(s1.metadata.stateRevision);
    expect(res2.metadata.stateRevision).toBeGreaterThan(res1.metadata.stateRevision);

    const finalSnap = await engine.getSnapshot(projectPath);
    expect(finalSnap.metadata.stateRevision).toBe(3);
  });
});
