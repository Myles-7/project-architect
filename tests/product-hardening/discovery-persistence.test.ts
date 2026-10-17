import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { ProjectStateEngine } from '../../packages/core/src/engine/ProjectStateEngine.js';
import { DiscoveryTurnStore } from '../../packages/core/src/discovery/DiscoveryTurnStore.js';
import { FileStorage } from '../../packages/core/src/storage/FileStorage.js';
import type { DiscoveryResult } from '../../packages/contracts/src/provider.js';

describe('Product Hardening Phase 2: Discovery Persistence & Input Immutability', () => {
  let stateEngine: ProjectStateEngine;
  let turnStore: DiscoveryTurnStore;
  let storage: FileStorage;
  let testProjectDir: string;

  beforeEach(async () => {
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine();
    turnStore = new DiscoveryTurnStore(storage);
    testProjectDir = join(
      tmpdir(),
      `pa-disc-persist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    );
  });

  afterEach(async () => {
    await rm(testProjectDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('Task 2.3: User Message Pre-persistence', () => {
    it('persists user message as input material and creates recorded turn before job runs', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Pre-persistence Test',
        idea: 'Testing pre-persistence',
      });

      const { inputRef, turnId, snapshot: s1 } = await stateEngine.recordDiscoveryInput(
        testProjectDir,
        'We must support SQLite offline with encrypted local database',
        s0.metadata.stateRevision
      );
      expect(inputRef).toMatch(/^input:/);
      expect(turnId).toMatch(/^turn-/);
      expect(s1.metadata.stateRevision).toBe(s0.metadata.stateRevision + 1);

      // Verify the input is persisted in Project State
      const inputItem = s1.metadata.inputRefs.find((inp) => inp.id === (inputRef as any));
      expect(inputItem).toBeDefined();
      expect(inputItem!.summary).toContain('SQLite offline');

      // Verify content can be read
      const content = await stateEngine.readInputContent(testProjectDir, inputRef);
      expect(content).toContain('We must support SQLite offline');

      // Verify turn record exists in runtime/discovery-turns.json
      const turns = await turnStore.loadTurns(testProjectDir);
      expect(turns.length).toBe(1);
      expect(turns[0].id).toBe(turnId);
      expect(turns[0].inputRef).toBe(inputRef);
      expect(turns[0].status).toBe('recorded');
      expect(turns[0].sourceRevision).toBe(s1.metadata.stateRevision);

      // Simulate server crash / restart before any AI job is scheduled
      const restartedEngine = new ProjectStateEngine();
      const loadedSnapshot = await restartedEngine.loadProject(testProjectDir);
      expect(loadedSnapshot.metadata.inputRefs.some((i) => i.id === (inputRef as any))).toBe(true);

      const recoveredTurns = await turnStore.loadTurns(testProjectDir);
      expect(recoveredTurns.length).toBe(1);
      expect(recoveredTurns[0].id).toBe(turnId);
      expect(recoveredTurns[0].status).toBe('recorded');
    });
  });

  describe('Task 2.4: Atomic Discovery Turn History & Server Restart Recovery', () => {
    it('accurately recovers full turn records, provider outputs, and accepted refs after reload', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Turn Recovery Test',
        idea: 'Testing turn recovery',
      });

      const { inputRef, turnId, snapshot: s1 } = await stateEngine.recordDiscoveryInput(
        testProjectDir,
        'User clarified requirement for desktop dark mode',
        s0.metadata.stateRevision
      );
      expect(inputRef).toMatch(/^input:/);

      // Update to running
      await turnStore.updateTurn(testProjectDir, turnId, {
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      const mockProviderResult: DiscoveryResult = {
        confirmed: ['Turn Recovery Test'],
        candidates: [
          {
            decision_key: 'dk-theme',
            area: 'ux_ui_direction',
            statement: 'Native OS-adaptive dark mode with high contrast accessibility toggle',
            rationale: 'Reduces eye strain for power developers',
          },
        ],
        assumptions: [
          {
            decision_key: 'dk-font',
            area: 'ux_ui_direction',
            statement: 'System font stack without external web font loading',
            reason: 'Zero network dependency',
          },
        ],
        unknowns: [],
        risks: [
          {
            risk_key: 'rk-canvas-perf',
            area: 'technical_boundary',
            statement: 'Canvas rendering bottleneck on high-DPI multi-monitor setups',
            impact: 'Frame drop during rapid drag gestures',
            severity: 'medium',
          },
        ],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [],
      };

      // Ingest suggestions into project state
      const s2 = await stateEngine.applyDiscoveryTurn(
        testProjectDir,
        mockProviderResult,
        s1.metadata.stateRevision,
        { turnId }
      );

      // Complete turn in TurnStore
      const candidateId = s2.decisions.items.find((d) => d.status === 'candidate')?.id;
      const assumptionId = s2.assumptions.items.find((a) => a.status === 'active')?.id;
      const riskId = s2.risks?.items?.[0]?.id;

      const acceptedRefs = [
        candidateId ? `decision:${candidateId}` : null,
        assumptionId ? `assumption:${assumptionId}` : null,
        riskId ? `risk:${riskId}` : null,
      ].filter(Boolean) as string[];

      await turnStore.updateTurn(testProjectDir, turnId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        providerResult: mockProviderResult,
        acceptedRefs,
        discardedCounts: { duplicateCandidates: 0 },
        diagnostics: { durationMs: 950, totalTokens: 1420 },
      });

      // Simulate full server reboot
      const rebootEngine = new ProjectStateEngine();
      const rebootStore = new DiscoveryTurnStore(storage);

      const rebootSnapshot = await rebootEngine.loadProject(testProjectDir);
      const rebootTurns = await rebootStore.loadTurns(testProjectDir);

      expect(rebootTurns.length).toBe(1);
      const turn = rebootTurns[0];
      expect(turn.id).toBe(turnId);
      expect(turn.status).toBe('completed');
      expect(turn.providerResult?.candidates.length).toBe(1);
      expect(turn.acceptedRefs).toEqual(acceptedRefs);
      expect(turn.diagnostics?.durationMs).toBe(950);

      // Verify Project State holds the candidate, assumption, and risk
      expect(rebootSnapshot.decisions.items.some((d) => d.statement.includes('Native OS-adaptive dark mode'))).toBe(true);
      expect(rebootSnapshot.assumptions.items.some((a) => a.statement.includes('System font stack'))).toBe(true);
      expect(rebootSnapshot.risks?.items?.some((r) => r.statement?.includes('Canvas rendering bottleneck') || r.description.includes('Canvas rendering bottleneck'))).toBe(true);
    });

    it('records cancelled and stale turns without polluting project state with suggestions', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Cancellation Test',
        idea: 'Testing cancellation safety',
      });

      const { turnId, snapshot: s1 } = await stateEngine.recordDiscoveryInput(
        testProjectDir,
        'Instruction that will be cancelled before completion',
        s0.metadata.stateRevision
      );
      expect(s1.metadata.stateRevision).toBe(s0.metadata.stateRevision + 1);

      // Cancel turn
      await turnStore.updateTurn(testProjectDir, turnId, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      });

      const snapshotAfterCancel = await stateEngine.loadProject(testProjectDir);
      // Project state must have NO candidates or assumptions generated from this cancelled turn
      expect(snapshotAfterCancel.decisions.items).toEqual(s0.decisions.items);
      expect(snapshotAfterCancel.decisions.items.every((decision) => decision.status === 'candidate' && decision.confirmedBy === undefined)).toBe(true);
      expect(snapshotAfterCancel.assumptions.items.length).toBe(0);

      // But the turn record in TurnStore must reflect cancelled
      const turns = await turnStore.loadTurns(testProjectDir);
      expect(turns[0].status).toBe('cancelled');
    });
  });

  describe('Task 2.5: Risk Persistence & Deduplication by risk_key', () => {
    it('persists risks to state/risks.json and updates identical risk_key on subsequent turns', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Risk Deduplication Test',
        idea: 'Testing risk key deduplication',
      });

      const turn1Output: DiscoveryResult = {
        confirmed: ['Risk Deduplication Test'],
        candidates: [],
        assumptions: [],
        unknowns: [],
        risks: [
          {
            risk_key: 'rk-auth-expiry',
            area: 'technical_boundary',
            statement: 'OAuth refresh token expiry while user is working offline',
            impact: 'User cannot sync until re-authenticating online',
            severity: 'medium',
          },
        ],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [],
      };

      const s1 = await stateEngine.applyDiscoveryTurn(testProjectDir, turn1Output, s0.metadata.stateRevision);
      expect(s1.risks?.items?.length).toBe(1);
      const risk1 = s1.risks.items[0];
      expect(risk1.riskKey).toBe('rk-auth-expiry');
      expect(risk1.severity).toBe('medium');

      // Turn 2 re-identifies the same risk but escalates severity to 'high'
      const turn2Output: DiscoveryResult = {
        confirmed: ['Risk Deduplication Test'],
        candidates: [],
        assumptions: [],
        unknowns: [],
        risks: [
          {
            risk_key: 'rk-auth-expiry',
            area: 'technical_boundary',
            statement: 'OAuth refresh token expiry while user is working offline (Escalated)',
            impact: 'Severe data divergence on long offline sessions',
            severity: 'high',
          },
        ],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [],
      };

      const s2 = await stateEngine.applyDiscoveryTurn(testProjectDir, turn2Output, s1.metadata.stateRevision);

      // Must update the existing risk rather than appending a second one!
      expect(s2.risks?.items?.length).toBe(1);
      const updatedRisk = s2.risks.items[0];
      expect(updatedRisk.id).toBe(risk1.id);
      expect(updatedRisk.riskKey).toBe('rk-auth-expiry');
      expect(updatedRisk.severity).toBe('high');
      expect(updatedRisk.impact).toContain('Severe data divergence');
    });
  });
});
