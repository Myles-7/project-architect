import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm, readFile } from 'node:fs/promises';
import { ProjectStateEngine } from '../../packages/core/src/engine/ProjectStateEngine.js';
import { ErrorCode } from '../../packages/contracts/src/errors.js';
import type { DiscoveryResult } from '../../packages/contracts/src/provider.js';

describe('Product Hardening Phase 2: Suggestion Transition & Reference-based Authorization', () => {
  let stateEngine: ProjectStateEngine;
  let testProjectDir: string;

  beforeEach(async () => {
    stateEngine = new ProjectStateEngine();
    testProjectDir = join(
      tmpdir(),
      `pa-trans-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    );
  });

  afterEach(async () => {
    await rm(testProjectDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('Task 2.1: B3 Schema Structure Verification', () => {
    it('requires structured objects for candidates, assumptions, and risks', async () => {
      const schemaPath = join(process.cwd(), 'experiments', 'agent-benchmark', 'schemas', 'b3-discovery.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf8'));

      // 1. Candidate must be an object with decision_key, area, statement, rationale
      const candItems = schema.properties.candidates.items;
      expect(candItems.type).toBe('object');
      expect(candItems.required).toContain('decision_key');
      expect(candItems.required).toContain('area');
      expect(candItems.required).toContain('statement');
      expect(candItems.required).toContain('rationale');

      // 2. Assumption must be an object with decision_key, area, statement, reason
      const asmItems = schema.properties.assumptions.items;
      expect(asmItems.type).toBe('object');
      expect(asmItems.required).toContain('decision_key');
      expect(asmItems.required).toContain('area');
      expect(asmItems.required).toContain('statement');
      expect(asmItems.required).toContain('reason');

      // 3. Risk must be an object with risk_key, area, statement, impact, severity
      const riskItems = schema.properties.risks.items;
      expect(riskItems.type).toBe('object');
      expect(riskItems.required).toContain('risk_key');
      expect(riskItems.required).toContain('area');
      expect(riskItems.required).toContain('statement');
      expect(riskItems.required).toContain('impact');
      expect(riskItems.required).toContain('severity');
    });
  });

  describe('Task 2.2: Reference-based Decision & Assumption Confirmation', () => {
    it('promotes a Candidate to Confirmed via decision:<id> preserving declared area', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Candidate Test',
        idea: 'Testing candidate promotion',
      });

      const discoveryOutput: DiscoveryResult = {
        confirmed: ['Candidate Test'],
        candidates: [
          {
            decision_key: 'dk-flow',
            area: 'user_flows',
            statement: 'Drag-and-drop workflow canvas for visual node editing',
            rationale: 'High efficiency for power users',
          },
        ],
        assumptions: [],
        unknowns: [],
        risks: [],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [],
      };

      const afterTurn = await stateEngine.applyDiscoveryTurn(
        testProjectDir,
        discoveryOutput,
        s0.metadata.stateRevision
      );

      const candidate = afterTurn.decisions.items.find((d) => d.status === 'candidate');
      expect(candidate).toBeDefined();
      expect(candidate!.area).toBe('user_flows');
      expect(candidate!.decisionKey).toBe('dk-flow');

      // Confirm candidate via TypedRef
      const confirmedSnapshot = await stateEngine.confirmDecision(
        testProjectDir,
        `decision:${candidate!.id}`,
        afterTurn.metadata.stateRevision
      );

      const promoted = confirmedSnapshot.decisions.items.find((d) => d.id === candidate!.id);
      expect(promoted).toBeDefined();
      expect(promoted!.status).toBe('confirmed');
      expect(promoted!.confirmedBy).toBe('user');
      // Must retain its declared area, NOT default to mvp_scope!
      expect(promoted!.area).toBe('user_flows');

      // Candidate count should decrease to 0
      const remainingCandidates = confirmedSnapshot.decisions.items.filter((d) => d.status === 'candidate');
      expect(remainingCandidates.length).toBe(0);
    });

    it('converts an Assumption to Confirmed via assumption:<id> and marks assumption resolved', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Assumption Test',
        idea: 'Testing assumption resolution',
      });

      const discoveryOutput: DiscoveryResult = {
        confirmed: ['Assumption Test'],
        candidates: [],
        assumptions: [
          {
            decision_key: 'dk-offline',
            area: 'technical_boundary',
            statement: '100% local SQLite storage with zero telemetry',
            reason: 'Zero cloud latency requirement',
          },
        ],
        unknowns: [],
        risks: [],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [],
      };

      const afterTurn = await stateEngine.applyDiscoveryTurn(
        testProjectDir,
        discoveryOutput,
        s0.metadata.stateRevision
      );

      const assumption = afterTurn.assumptions.items.find((a) => a.status === 'active');
      expect(assumption).toBeDefined();
      expect(assumption!.area).toBe('technical_boundary');

      // Convert assumption via TypedRef
      const confirmedSnapshot = await stateEngine.confirmDecision(
        testProjectDir,
        `assumption:${assumption!.id}`,
        afterTurn.metadata.stateRevision
      );

      // Assumption must be marked resolved and have resolvedDecisionRef
      const updatedAsm = confirmedSnapshot.assumptions.items.find((a) => a.id === assumption!.id);
      expect(updatedAsm).toBeDefined();
      expect(updatedAsm!.status).toBe('resolved');
      expect(updatedAsm!.resolvedDecisionRef).toBeDefined();
      expect(updatedAsm!.resolvedDecisionRef).toMatch(/^decision:/);

      // Newly created decision must have the assumption's declared canonical area
      const newDecisionId = updatedAsm!.resolvedDecisionRef!.replace('decision:', '');
      const newDecision = confirmedSnapshot.decisions.items.find((d) => d.id === newDecisionId);
      expect(newDecision).toBeDefined();
      expect(newDecision!.status).toBe('confirmed');
      expect(newDecision!.confirmedBy).toBe('user');
      expect(newDecision!.area).toBe('technical_boundary');
      expect(newDecision!.statement).toBe(assumption!.statement);

      // Assumption is no longer active
      const activeAssumptions = confirmedSnapshot.assumptions.items.filter((a) => a.status === 'active');
      expect(activeAssumptions.length).toBe(0);
    });

    it('idempotently handles confirmDecision on already confirmed or locked decisions', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Idempotency Test',
        idea: 'Testing idempotency',
      });

      const s1 = await stateEngine.addDecision(
        testProjectDir,
        'technical_boundary',
        'Offline JSON file storage',
        s0.metadata.stateRevision,
        'confirmed'
      );

      const decId = s1.decisions.items[s1.decisions.items.length - 1].id;
      const initialCount = s1.decisions.items.length;

      // Call confirmDecision again on already confirmed decision
      const s2 = await stateEngine.confirmDecision(
        testProjectDir,
        `decision:${decId}`,
        s1.metadata.stateRevision
      );

      expect(s2.decisions.items.length).toBe(initialCount);
      expect(s2.decisions.items.find((d) => d.id === decId)?.status).toBe('confirmed');
    });

    it('rejects confirmDecision on rejected, superseded, or resolved items with DECISION_STATE_INVALID', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Error Handling Test',
        idea: 'Testing invalid transition rejection',
      });

      const s1 = await stateEngine.addDecision(
        testProjectDir,
        'mvp_scope',
        'Cloud synchronization',
        s0.metadata.stateRevision,
        'confirmed'
      );
      const dec = s1.decisions.items[s1.decisions.items.length - 1];
      dec.status = 'rejected';

      const rev2 = s1.metadata.stateRevision + 1;
      await (stateEngine as any).commitManager.commit(
        testProjectDir,
        rev2,
        {
          metadata: { ...s1.metadata, stateRevision: rev2 },
          decisions: s1.decisions,
        },
        s1.metadata.stateRevision
      );

      let caughtErr: any;
      try {
        await stateEngine.confirmDecision(
          testProjectDir,
          `decision:${dec.id}`,
          rev2
        );
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeDefined();
      expect(caughtErr.code).toBe(ErrorCode.DECISION_STATE_INVALID);
    });

    it('does not confuse two suggestions with identical statements but different IDs', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Duplicate Statement Test',
        idea: 'Testing reference distinction',
      });

      const s1 = await stateEngine.getSnapshot(testProjectDir);
      s1.decisions.items.push(
        {
          id: 'cand-A',
          area: 'technical_boundary',
          statement: 'Local SQLite engine',
          status: 'candidate',
          origin: 'agent',
          evidenceRefs: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cand-B',
          area: 'technical_boundary',
          statement: 'Local SQLite engine',
          status: 'candidate',
          origin: 'agent',
          evidenceRefs: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );

      const rev1 = s0.metadata.stateRevision + 1;
      await (stateEngine as any).commitManager.commit(
        testProjectDir,
        rev1,
        {
          metadata: { ...s0.metadata, stateRevision: rev1 },
          decisions: s1.decisions,
        },
        s0.metadata.stateRevision
      );

      // Confirm only cand-A
      const afterA = await stateEngine.confirmDecision(
        testProjectDir,
        'decision:cand-A',
        rev1
      );

      expect(afterA.decisions.items.find((d) => d.id === 'cand-A')?.status).toBe('confirmed');
      expect(afterA.decisions.items.find((d) => d.id === 'cand-B')?.status).toBe('candidate');
    });

    it('never overwrites a locked decision during discovery suggestions ingestion', async () => {
      const { snapshot: s0 } = await stateEngine.createProject({
        projectPath: testProjectDir,
        name: 'Locked Protection Test',
        idea: 'Testing locked protection',
      });

      const s1 = await stateEngine.addDecision(
        testProjectDir,
        'technical_boundary',
        'Zero database, file-only persistence',
        s0.metadata.stateRevision,
        'locked'
      );

      const discoveryOutput: DiscoveryResult = {
        confirmed: ['Locked Protection Test'],
        candidates: [
          {
            decision_key: 'dk-db',
            area: 'technical_boundary',
            statement: 'Zero database, file-only persistence',
            rationale: 'Attempt to overwrite locked rule',
          },
        ],
        assumptions: [],
        unknowns: [],
        risks: [],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [],
      };

      const afterTurn = await stateEngine.applyDiscoveryTurn(
        testProjectDir,
        discoveryOutput,
        s1.metadata.stateRevision
      );

      const locked = afterTurn.decisions.items.find((d) => d.statement.includes('Zero database'));
      expect(locked).toBeDefined();
      expect(locked!.status).toBe('locked');
      // Must not create candidate with same statement
      const candidates = afterTurn.decisions.items.filter((d) => d.status === 'candidate');
      expect(candidates.length).toBe(0);
    });
  });
});
