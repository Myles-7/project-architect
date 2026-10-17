import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';

describe('End-to-End Multi-Turn State Flow Test', () => {
  let engine: ProjectStateEngine;
  let orchestrator: AIOrchestrator;
  let mockProvider: MockAIProvider;
  let testProjectDir: string;
  const storage = new FileStorage();

  beforeEach(async () => {
    engine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);
    testProjectDir = join(tmpdir(), `pa-multiturn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('completes 5-turn flow: Idea -> Discovery -> Confirm -> Lock -> Conflict Detection', async () => {
    // === Turn 1: Create Project with Idea ===
    const { snapshot: t1Snap } = await engine.createProject({
      name: 'Local Clipboard Manager',
      idea: 'A pure offline clipboard history tool for Windows',
      projectTags: ['Desktop App', 'Local-First'],
      projectPath: testProjectDir,
    });
    expect(t1Snap.metadata.stateRevision).toBe(1);

    // === Turn 2: Run AI Discovery Turn ===
    mockProvider.setMockResponse('discovery-turn', {
      confirmed: [],
      candidates: ['Store clipboard entries in local SQLite/JSON storage'],
      assumptions: ['Maximum 500 history items stored by default'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'security',
          severity: 'high',
          reason: 'Sensitive password clipboard clearing',
          impact: 'Privacy leak',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'high',
          question: 'Should the tool automatically clear passwords after 30 seconds?',
          reason: 'Privacy and security baseline',
          recommendation: 'Yes, clear sensitive passwords automatically',
          recommendation_reason: 'Protects user credentials',
          options: [
            { label: 'Yes, auto clear', impact: 'High security' },
            { label: 'No, retain history', impact: 'Convenience' },
          ],
          allow_free_input: true,
        },
      ],
    });

    const t2Res = await orchestrator.runDiscoveryTurn(testProjectDir, {
      userMessage: 'Let us start analyzing requirements',
      expectedRevision: 1,
    });
    expect(t2Res.snapshot.metadata.stateRevision).toBe(2);

    // === Turn 3: User answers and confirms Candidate ===
    const cand = t2Res.snapshot.decisions.items.find((d) => d.statement === 'Store clipboard entries in local SQLite/JSON storage');
    expect(cand).toBeDefined();
    expect(cand?.status).toBe('candidate');

    const t3Snap = await engine.confirmDecision(testProjectDir, `decision:${cand!.id}`, 2);
    expect(t3Snap.metadata.stateRevision).toBe(3);
    const confirmedItem = t3Snap.decisions.items.find((d) => d.id === cand!.id);
    expect(confirmedItem?.status).toBe('confirmed');

    // === Turn 4: User Locks Hard Constraint Decision ===
    const t4Snap = await engine.lockDecision(testProjectDir, `decision:${confirmedItem!.id}`, 3);
    expect(t4Snap.metadata.stateRevision).toBe(4);
    expect(t4Snap.decisions.items.find((d) => d.id === confirmedItem!.id)?.status).toBe('locked');

    // === Turn 5: AI Turn with Contradictory Input -> Triggers Conflict Protection ===
    mockProvider.setMockResponse('discovery-turn', {
      confirmed: [],
      candidates: ['Auto cloud sync to remote servers on port 443'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    });

    // Explicitly confirm and lock the separate initial offline constraint.
    const initDec = t4Snap.decisions.items.find((d) => d.statement === 'A pure offline clipboard history tool for Windows');
    expect(initDec?.status).toBe('candidate');
    const initialConfirmed = await engine.confirmDecision(testProjectDir, `decision:${initDec!.id}`, t4Snap.metadata.stateRevision);
    const initialLocked = await engine.lockDecision(testProjectDir, `decision:${initDec!.id}`, initialConfirmed.metadata.stateRevision);
    expect(initialLocked.decisions.items.find((decision) => decision.id === initDec!.id)?.status).toBe('locked');

    const t5Res = await orchestrator.runDiscoveryTurn(testProjectDir, {
      userMessage: 'Could we also sync automatically to cloud?',
      expectedRevision: initialLocked.metadata.stateRevision,
    });

    expect(t5Res.snapshot.metadata.stateRevision).toBe(initialLocked.metadata.stateRevision + 1);
    expect(t5Res.snapshot.decisions.items.find((decision) => decision.id === initDec!.id)).toMatchObject({ status: 'locked', statement: initDec!.statement });
    // Conflict detector must have identified the conflict against the locked offline decision
    expect(t5Res.snapshot.gaps.conflicts.length).toBeGreaterThan(0);
    const conflict = t5Res.snapshot.gaps.conflicts[0];
    expect(conflict?.severity).toBe('critical');
  });
});
