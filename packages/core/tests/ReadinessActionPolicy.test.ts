import { describe, it, expect } from 'vitest';
import { ReadinessActionPolicy } from '../src/readiness/ReadinessActionPolicy.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

function createMockSnapshot(overrides?: Partial<ProjectSnapshot>): ProjectSnapshot {
  return {
    metadata: {
      projectId: 'test-policy-proj',
      name: 'Policy Test Project',
      stage: 'readiness-review',
      stateRevision: 3,
      createdAt: '',
      updatedAt: '',
    },
    overview: {
      projectId: 'test-policy-proj',
      schemaVersion: 1,
      areas: {} as any,
      updatedAt: '',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'test-policy-proj',
      items: [
        { id: 'dec-01', area: 'target_user', statement: 'Developers', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-02', area: 'mvp_scope', statement: 'Desktop tool', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-03', area: 'core_features', statement: 'Code generation', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-04', area: 'user_flows', statement: '1. Input, 2. Run', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-05', area: 'page_structure', statement: 'Single page', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-06', area: 'ux_ui_direction', statement: 'Clean dark mode', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-07', area: 'technical_boundary', statement: 'Node.js local', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        { id: 'dec-08', area: 'delivery_plan', statement: 'Phase 1 MVP', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      ],
      updatedAt: '',
    },
    gaps: {
      schemaVersion: 1,
      projectId: 'test-policy-proj',
      gaps: [],
      conflicts: [],
      updatedAt: '',
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'test-policy-proj',
      items: [],
      updatedAt: '',
    },
    questions: {
      schemaVersion: 1,
      projectId: 'test-policy-proj',
      items: [],
      updatedAt: '',
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'test-policy-proj',
      current: {
        id: 'rev-01',
        status: 'ready',
        reviewedAt: '',
        basisRevision: 3,
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
    documents: {
      schemaVersion: 1,
      projectId: 'test-policy-proj',
      items: [],
      updatedAt: '',
    },
    ...overrides,
  };
}

describe('ReadinessActionPolicy', () => {
  it('1. Fully satisfied project has "approved" and "approved-with-warnings" enabled', () => {
    const snapshot = createMockSnapshot();
    const actions = ReadinessActionPolicy.evaluateActions(snapshot);

    const returnAct = actions.find((a) => a.disposition === 'return-to-discovery');
    expect(returnAct?.enabled).toBe(true);

    const approvedAct = actions.find((a) => a.disposition === 'approved');
    expect(approvedAct?.enabled).toBe(true);
    expect(approvedAct?.blockedReasons).toHaveLength(0);

    const warnAct = actions.find((a) => a.disposition === 'approved-with-warnings');
    expect(warnAct?.enabled).toBe(true);
  });

  it('2. Missing core area blocks "approved" with clear reasons', () => {
    const snapshot = createMockSnapshot();
    // Remove delivery_plan
    snapshot.decisions.items = snapshot.decisions.items.filter((d) => d.area !== 'delivery_plan');

    const actions = ReadinessActionPolicy.evaluateActions(snapshot);
    const approvedAct = actions.find((a) => a.disposition === 'approved');

    expect(approvedAct?.enabled).toBe(false);
    expect(approvedAct?.blockedReasons.some((r) => r.includes('交付计划'))).toBe(true);
  });

  it('3. Revision stale blocks all approval actions', () => {
    const snapshot = createMockSnapshot();
    // Snapshot has evolved to rev.5, but readiness was evaluated at rev.3
    snapshot.metadata.stateRevision = 5;
    snapshot.readiness.current.basisRevision = 3;

    const actions = ReadinessActionPolicy.evaluateActions(snapshot);
    const approvedAct = actions.find((a) => a.disposition === 'approved');
    const warnAct = actions.find((a) => a.disposition === 'approved-with-warnings');
    const issueAct = actions.find((a) => a.disposition === 'approved-with-known-issues');

    expect(approvedAct?.enabled).toBe(false);
    expect(approvedAct?.blockedReasons.some((r) => r.includes('过期'))).toBe(true);
    expect(warnAct?.enabled).toBe(false);
    expect(issueAct?.enabled).toBe(false);

    // Return to discovery is still enabled
    const returnAct = actions.find((a) => a.disposition === 'return-to-discovery');
    expect(returnAct?.enabled).toBe(true);
  });

  it('4. Open critical gap disables "approved" but enables "approved-with-known-issues" with required ref', () => {
    const snapshot = createMockSnapshot();
    snapshot.gaps.gaps.push({
      id: 'gap-crit-01',
      area: 'technical_boundary',
      severity: 'critical',
      status: 'open',
      reason: 'No database driver specified',
      impact: 'Blocks persistence',
      suggestedQuestions: [],
      createdAt: '',
      updatedAt: '',
    });

    const actions = ReadinessActionPolicy.evaluateActions(snapshot);
    const approvedAct = actions.find((a) => a.disposition === 'approved');
    expect(approvedAct?.enabled).toBe(false);

    const issueAct = actions.find((a) => a.disposition === 'approved-with-known-issues');
    expect(issueAct?.enabled).toBe(true);
    expect(issueAct?.requiredAcknowledgementRefs).toContain('gap:gap-crit-01');
  });

  it('5. Open critical conflict enables only "approved-with-critical-conflicts"', () => {
    const snapshot = createMockSnapshot();
    snapshot.gaps.conflicts.push({
      id: 'cnf-01',
      severity: 'critical',
      status: 'open',
      propositionA: 'Use SQLite',
      propositionB: 'Use Postgres',
      reason: 'Mutually exclusive DB choices',
      createdAt: '',
      updatedAt: '',
    });

    const actions = ReadinessActionPolicy.evaluateActions(snapshot);
    const approvedAct = actions.find((a) => a.disposition === 'approved');
    const warnAct = actions.find((a) => a.disposition === 'approved-with-warnings');
    const conflictAct = actions.find((a) => a.disposition === 'approved-with-critical-conflicts');

    expect(approvedAct?.enabled).toBe(false);
    expect(warnAct?.enabled).toBe(false);
    expect(conflictAct?.enabled).toBe(true);
    expect(conflictAct?.requiredAcknowledgementRefs).toContain('conflict:cnf-01');
  });
});
