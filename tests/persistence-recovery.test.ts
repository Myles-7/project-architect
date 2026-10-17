import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';

describe('Project State Persistence & Reload Test', () => {
  let engine: ProjectStateEngine;
  let testProjectDir: string;
  const storage = new FileStorage();

  beforeEach(async () => {
    engine = new ProjectStateEngine(storage);
    testProjectDir = join(tmpdir(), `pa-persistence-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('persists project state and restores identical state after process restart', async () => {
    // 1. Create project
    const { snapshot: created } = await engine.createProject({
      name: 'Persistence Test Project',
      idea: 'Testing full persistence lifecycle across restarts',
      projectTags: ['Developer Tool'],
      projectPath: testProjectDir,
    });

    // 2. Perform state mutations
    await engine.addInput(testProjectDir, 'text', 'notes.md', '# Development Notes\nNeed low latency.');
    await engine.editOverviewItem(testProjectDir, 'mvp_scope', undefined, 'Local-first offline storage', 2);
    const initial = created.decisions.items.find((decision) => decision.statement === 'Testing full persistence lifecycle across restarts');
    expect(initial?.status).toBe('candidate');
    const confirmed = await engine.confirmDecision(testProjectDir, `decision:${initial!.id}`, 3);
    const locked = await engine.lockDecision(testProjectDir, `decision:${initial!.id}`, confirmed.metadata.stateRevision);

    // 3. Simulate process shutdown by instantiating a completely new StateEngine instance
    const freshEngineInstance = new ProjectStateEngine(new FileStorage());
    const reloadedSnapshot = await freshEngineInstance.loadProject(testProjectDir);

    expect(reloadedSnapshot.metadata.name).toBe('Persistence Test Project');
    expect(reloadedSnapshot.metadata.stateRevision).toBe(locked.metadata.stateRevision);
    expect(reloadedSnapshot.metadata.inputRefs.length).toBe(2);
    expect(reloadedSnapshot.decisions.items.find((decision) => decision.id === initial!.id)).toMatchObject({ status: 'locked', confirmedBy: 'user', statement: initial!.statement });
    expect(reloadedSnapshot.planning?.inputs[0]?.raw).toBe('Testing full persistence lifecycle across restarts');
    expect(reloadedSnapshot.overview.sections.find((s) => s.id === 'project_overview')?.maturity).toBe('locked');
  });
});
