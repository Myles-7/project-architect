import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionPolicyEngine } from '../src/policy/DecisionPolicyEngine.js';
import type {
  ProjectSnapshot,
  DiscoveryResult,
} from '@project-architect/contracts';

describe('DecisionPolicyEngine Unit Tests (Phase 2.3)', () => {
  let policyEngine: DecisionPolicyEngine;

  beforeEach(() => {
    policyEngine = new DecisionPolicyEngine();
  });

  function createBaseSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-test-policy',
        name: 'Offline Markdown Editor',
        stage: 'broad-pass',
        stateRevision: 1,
        projectTags: ['Desktop App', 'Local-First'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-test-policy',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'mostly-clear', itemRefs: ['decision:dec-01'] },
          { id: 'technical_boundary', title: '技术底线', kind: 'fixed', maturity: 'locked', itemRefs: ['decision:dec-locked-01'] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-test-policy',
        items: [
          {
            id: 'dec-01',
            area: 'project_overview',
            statement: 'A local markdown editor for writers',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'dec-locked-01',
            area: 'technical_boundary',
            statement: '100% 离线运行，绝对禁止联网',
            status: 'locked',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-test-policy',
        items: [
          {
            id: 'asm-01',
            statement: '默认窗口大小设为 1200x800',
            reason: '常规窗口默认尺寸',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: '',
      },
      gaps: { schemaVersion: 1, projectId: 'proj-test-policy', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-test-policy', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-test-policy', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-test-policy',
        current: {
          id: 'rdn-01',
          status: 'not-ready',
          reviewedAt: '',
          requiredAreas: [],
          warnings: [],
          issues: [],
          assumptionRefs: [],
          knownIssueAcknowledgements: [],
          criticalConflictAcknowledgements: [],
          userDisposition: 'pending',
        },
        history: [],
        updatedAt: '',
      },
    };
  }

  it('1. Low-risk suggestions are routed to active assumptions without user interruption', () => {
    const snapshot = createBaseSnapshot();
    const discoveryResult: DiscoveryResult = {
      confirmed: [],
      candidates: ['Default logging buffer size is 100 entries', 'Support dark theme toggle'],
      assumptions: ['Auto save every 60 seconds'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    const result = policyEngine.processDiscoverySuggestions(snapshot, discoveryResult);

    expect(result.newAssumptions.length).toBeGreaterThanOrEqual(2);
    expect(result.newAssumptions.some((a) => a.statement.includes('logging buffer'))).toBe(true);
    expect(result.newAssumptions.some((a) => a.statement.includes('Auto save'))).toBe(true);
  });

  it('2. Medium-risk suggestions are routed to candidates awaiting confirmation', () => {
    const snapshot = createBaseSnapshot();
    const discoveryResult: DiscoveryResult = {
      confirmed: [],
      candidates: ['Support exporting document to PDF format'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    const result = policyEngine.processDiscoverySuggestions(snapshot, discoveryResult);

    expect(result.newCandidates.length).toBe(1);
    expect(result.newCandidates[0]?.statement).toContain('exporting document to PDF');
    expect(result.newCandidates[0]?.status).toBe('candidate');
    expect(result.newCandidates[0]?.origin).toBe('agent');
  });

  it('3. Promoting an assumption creates a confirmed decision and marks assumption converted', () => {
    const snapshot = createBaseSnapshot();
    const { updatedAssumption, newDecision } = policyEngine.promoteAssumptionToDecision(
      snapshot,
      'asm-01',
      'ux_ui'
    );

    expect(updatedAssumption.status).toBe('converted');
    expect(updatedAssumption.resolvedAt).toBeDefined();
    expect(updatedAssumption.linkedDecisionRefs).toContain(`decision:${newDecision.id}`);

    expect(newDecision.status).toBe('confirmed');
    expect(newDecision.confirmedBy).toBe('user');
    expect(newDecision.statement).toBe('默认窗口大小设为 1200x800');
  });

  it('4. Promoting a candidate upgrades it to confirmed with user origin', () => {
    const snapshot = createBaseSnapshot();
    snapshot.decisions.items.push({
      id: 'cand-01',
      area: 'mvp_scope',
      statement: 'MVP only supports markdown plain text editing',
      status: 'candidate',
      origin: 'agent',
      evidenceRefs: [],
      createdAt: '',
      updatedAt: '',
    });

    const confirmed = policyEngine.promoteCandidateToConfirmed(snapshot, 'cand-01');

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedBy).toBe('user');
  });

  it('5. Locked decision protection & automatic conflict generation on mutual exclusion', () => {
    const snapshot = createBaseSnapshot();
    const discoveryResult: DiscoveryResult = {
      confirmed: [],
      candidates: ['Auto cloud sync to remote storage on edit'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    const result = policyEngine.processDiscoverySuggestions(snapshot, discoveryResult);

    // Locked decision remains untouched
    const lockedDec = snapshot.decisions.items.find((d) => d.id === 'dec-locked-01');
    expect(lockedDec?.status).toBe('locked');

    // Conflict is generated against the locked decision
    expect(result.newConflicts.length).toBe(1);
    expect(result.newConflicts[0]?.severity).toBe('critical');
    expect(result.newConflicts[0]?.decisionRefs).toContain('decision:dec-locked-01');
  });

  it('6. Direct edit on locked decision marks old item superseded and creates new confirmed decision', () => {
    const snapshot = createBaseSnapshot();
    const { finalDecisionRef, affectedDecision, newDecision } = policyEngine.handleUserDirectEdit(
      snapshot,
      'technical_boundary',
      'decision:dec-locked-01',
      '仅支持局域网同步，不连接公网云端'
    );

    expect(affectedDecision?.status).toBe('superseded');
    expect(affectedDecision?.supersededBy).toBe(finalDecisionRef);

    expect(newDecision.status).toBe('confirmed');
    expect(newDecision.confirmedBy).toBe('user');
    expect(newDecision.statement).toBe('仅支持局域网同步，不连接公网云端');
    expect(newDecision.evidenceRefs).toContain('decision:dec-locked-01');
  });
});
