import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStateEngine } from '../src/engine/ProjectStateEngine.js';
import { FileStorage } from '../src/storage/FileStorage.js';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('ProjectStateEngine Core Tests', () => {
  let engine: ProjectStateEngine;
  let testProjectDir: string;
  const storage = new FileStorage();

  beforeEach(async () => {
    engine = new ProjectStateEngine(storage);
    testProjectDir = join(tmpdir(), `pa-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('creates project with all mandatory state files and initial Revision 1', async () => {
    const { snapshot, projectPath } = await engine.createProject({
      name: 'Local Clipboard App',
      idea: 'A pure offline clipboard manager for Windows',
      projectTags: ['Desktop App', 'Local-First'],
      projectPath: testProjectDir,
    });

    expect(projectPath).toBe(testProjectDir);
    expect(snapshot.metadata.name).toBe('Local Clipboard App');
    expect(snapshot.metadata.stateRevision).toBe(1);
    expect(snapshot.decisions.items.length).toBe(1);
    expect(snapshot.decisions.items[0]?.status).toBe('confirmed');
    expect(snapshot.decisions.items[0]?.confirmedBy).toBe('user');
    expect(snapshot.overview.sections.length).toBeGreaterThan(5);

    // Verify files on disk
    expect(await storage.exists(join(testProjectDir, 'project.json'))).toBe(true);
    expect(await storage.exists(join(testProjectDir, 'state', 'overview.json'))).toBe(true);
    expect(await storage.exists(join(testProjectDir, 'state', 'decisions.json'))).toBe(true);
    expect(await storage.exists(join(testProjectDir, 'state', 'gaps.json'))).toBe(true);
    expect(await storage.exists(join(testProjectDir, 'state', 'readiness.json'))).toBe(true);
    expect(await storage.exists(join(testProjectDir, 'inputs', 'inp-01', 'source.txt'))).toBe(true);
  });

  it('supports confirming candidates and converting assumptions with revision bump', async () => {
    await engine.createProject({
      name: 'Test Project',
      idea: 'Initial idea statement',
      projectPath: testProjectDir,
    });

    // 1. Add an AI discovery turn with Candidate & Assumption
    const mockDiscovery: DiscoveryResult = {
      confirmed: [],
      candidates: ['First release should only support plain text format'],
      assumptions: ['Default history buffer size is 100 entries'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [{
        area: 'core_features',
        severity: 'high',
        reason: 'Missing shortcut customization',
        impact: 'User UX',
        dependency: 'none',
        should_ask_user: true,
      }],
      questions: [],
    };

    const snapAfterDiscovery = await engine.applyDiscoveryTurn(testProjectDir, mockDiscovery, 1);
    expect(snapAfterDiscovery.metadata.stateRevision).toBe(2);

    const cand = snapAfterDiscovery.decisions.items.find((d) => d.statement.includes('plain text'));
    expect(cand).toBeDefined();
    expect(cand?.status).toBe('candidate');

    const asm = snapAfterDiscovery.assumptions.items.find((a) => a.statement.includes('100 entries'));
    expect(asm).toBeDefined();
    expect(asm?.status).toBe('active');

    // 2. User confirms the candidate
    const snapAfterConfirm = await engine.confirmDecision(testProjectDir, `decision:${cand!.id}`, 2);
    expect(snapAfterConfirm.metadata.stateRevision).toBe(3);
    const confirmedCand = snapAfterConfirm.decisions.items.find((d) => d.id === cand!.id);
    expect(confirmedCand?.status).toBe('confirmed');
    expect(confirmedCand?.confirmedBy).toBe('user');

    // 3. User confirms the assumption -> converts assumption to converted & creates confirmed decision
    const snapAfterAsmConfirm = await engine.confirmDecision(testProjectDir, `assumption:${asm!.id}`, 3);
    expect(snapAfterAsmConfirm.metadata.stateRevision).toBe(4);
    const convertedAsm = snapAfterAsmConfirm.assumptions.items.find((a) => a.id === asm!.id);
    expect(convertedAsm?.status).toBe('converted');
    const newDec = snapAfterAsmConfirm.decisions.items.find((d) => d.statement.includes('100 entries'));
    expect(newDec?.status).toBe('confirmed');
    expect(newDec?.confirmedBy).toBe('user');
  });

  it('handles locking and unlocking decisions with state revision protection', async () => {
    const { snapshot } = await engine.createProject({
      name: 'Test Project',
      idea: 'Initial idea statement',
      projectPath: testProjectDir,
    });

    const decId = snapshot.decisions.items[0]!.id;

    // Lock confirmed decision
    const lockedSnap = await engine.lockDecision(testProjectDir, `decision:${decId}`, 1);
    expect(lockedSnap.metadata.stateRevision).toBe(2);
    expect(lockedSnap.decisions.items[0]?.status).toBe('locked');

    // AI discovery cannot overwrite locked decision
    const mockDiscovery: DiscoveryResult = {
      confirmed: [],
      candidates: ['Changed statement'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };
    const snapAfterAi = await engine.applyDiscoveryTurn(testProjectDir, mockDiscovery, 2);
    const stillLocked = snapAfterAi.decisions.items.find((d) => d.id === decId);
    expect(stillLocked?.status).toBe('locked');
    expect(stillLocked?.statement).toBe('Initial idea statement');

    // Unlock decision
    const unlockedSnap = await engine.unlockDecision(testProjectDir, `decision:${decId}`, 3);
    expect(unlockedSnap.metadata.stateRevision).toBe(4);
    expect(unlockedSnap.decisions.items[0]?.status).toBe('confirmed');
  });

  it('rejects stale revision requests with STATE_REVISION_CONFLICT', async () => {
    await engine.createProject({
      name: 'Test Project',
      idea: 'Initial idea statement',
      projectPath: testProjectDir,
    });

    // Attempting an action with expectedRevision = 99 when actual is 1
    await expect(
      engine.confirmDecision(testProjectDir, 'decision:dec-01', 99)
    ).rejects.toThrow('State revision conflict');
  });
});
