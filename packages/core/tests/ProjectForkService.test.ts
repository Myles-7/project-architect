import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileStorage,
  WorkspaceGuard,
  ProjectStateEngine,
  ProjectForkService,
  DiscoveryTurnStore,
} from '../src/index.js';

describe('ProjectForkService Unit Tests', () => {
  let tempBaseDir: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-fork-test-'));
    guard = new WorkspaceGuard(tempBaseDir);
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage, guard);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('atomically forks project, rewrites all state file projectIds, resets readiness, and injects forkedFrom', async () => {
    const sourceProjectId = 'source-project';
    const sourcePath = guard.resolveProjectPath(sourceProjectId);

    await engine.createProject({
      projectId: sourceProjectId,
      projectPath: sourcePath,
      projectName: 'Source App',
      idea: 'A source project for forking',
    });

    // Simulate an approved readiness disposition
    const readyPath = join(sourcePath, 'state', 'readiness.json');
    const readyData = await storage.readJson<any>(readyPath);
    readyData.current = {
      userDisposition: 'approved',
      userApprovedAt: new Date().toISOString(),
      approvedBy: 'architect',
    };
    await storage.writeJson(readyPath, readyData);

    const turnStore = new DiscoveryTurnStore(storage);
    await turnStore.appendTurn(sourcePath, {
      id: 'turn-running',
      projectId: sourceProjectId,
      sourceRevision: 1,
      status: 'running',
      createdAt: new Date().toISOString(),
      acceptedRefs: [],
      discardedCounts: {},
    });

    // Fork the project
    const newProjectId = 'forked-project';
    const newName = 'Forked App';
    const result = await ProjectForkService.forkProject({
      sourcePath,
      newName,
      newProjectId,
      storage,
      guard,
      engine,
    });

    expect(result.newProjectId).toBe(newProjectId);
    expect(result.snapshot.metadata.projectId).toBe(newProjectId);
    expect(result.snapshot.metadata.name).toBe(newName);
    expect(result.snapshot.metadata.forkedFrom).toEqual({
      sourceProjectId,
      sourceRevision: (await engine.getSnapshot(sourcePath)).metadata.stateRevision,
      forkedAt: expect.any(String),
    });

    // Verify all state files in target directory have their projectId updated
    const targetDir = result.targetPath;
    const filesToCheck = [
      'project.json',
      'state/overview.json',
      'state/decisions.json',
      'state/gaps.json',
      'state/questions.json',
      'state/assumptions.json',
      'state/risks.json',
      'state/documents.json',
      'state/readiness.json',
    ];

    for (const relPath of filesToCheck) {
      const filePath = join(targetDir, relPath);
      expect(await storage.exists(filePath), `Expected ${relPath} to exist`).toBe(true);
      const json = await storage.readJson<any>(filePath);
      expect(json.projectId, `Expected ${relPath} to have projectId ${newProjectId}`).toBe(newProjectId);
    }

    // Verify readiness approval disposition was reset to 'pending'
    const forkedReadiness = await storage.readJson<any>(join(targetDir, 'state', 'readiness.json'));
    expect(forkedReadiness.current.userDisposition).toBe('pending');
    expect(forkedReadiness.current.userApprovedAt).toBeUndefined();

    const forkedTurns = await new DiscoveryTurnStore(storage).loadTurns(targetDir);
    expect(forkedTurns).toHaveLength(1);
    expect(forkedTurns[0]).toMatchObject({
      projectId: newProjectId,
      status: 'cancelled',
    });

    // Verify original source project is unchanged
    const originalSnap = await engine.getSnapshot(sourcePath);
    expect(originalSnap.metadata.projectId).toBe(sourceProjectId);
  });

  it('rejects fork if target project directory already exists', async () => {
    const sourceProjectId = 'source-exist';
    const sourcePath = guard.resolveProjectPath(sourceProjectId);
    await engine.createProject({
      projectId: sourceProjectId,
      projectPath: sourcePath,
      projectName: 'Source Exist',
      idea: 'Test',
    });

    // Create another project that will collide
    const existingTargetId = 'target-collide';
    const existingTargetPath = guard.resolveProjectPath(existingTargetId);
    await engine.createProject({
      projectId: existingTargetId,
      projectPath: existingTargetPath,
      projectName: 'Target Collide',
      idea: 'Collision',
    });

    await expect(
      ProjectForkService.forkProject({
        sourcePath,
        newName: 'Collision Test',
        newProjectId: existingTargetId,
        storage,
        guard,
        engine,
      })
    ).rejects.toThrow(/already exists/);
  });
});
