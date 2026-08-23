import { describe, it, expect, beforeEach } from 'vitest';
import { ReadinessEvaluator } from '../src/readiness/ReadinessEvaluator.js';
import { KnowledgeChecklist } from '../src/readiness/KnowledgeChecklist.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Knowledge Completeness Readiness Model Unit Tests (Phase 4.5.2)', () => {
  let checklist: KnowledgeChecklist;
  let evaluator: ReadinessEvaluator;

  beforeEach(() => {
    checklist = new KnowledgeChecklist();
    evaluator = new ReadinessEvaluator();
  });

  function createSampleSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-know-test',
        name: 'Knowledge Test App',
        stage: 'broad-pass',
        stateRevision: 3,
        projectTags: ['Desktop App', 'AI Product'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-know-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-02'] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-03'] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-know-test',
        items: [
          { id: 'dec-01', area: 'project_overview', statement: 'AI Powered Knowledge Assistant', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-02', area: 'target_user', statement: 'Technical researchers and engineers', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-03', area: 'mvp_scope', statement: 'Document search and local summary', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-know-test',
        items: [],
        updatedAt: '',
      },
      gaps: { schemaVersion: 1, projectId: 'proj-know-test', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-know-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-know-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-know-test',
        current: {
          id: 'rdn-01',
          status: 'ready',
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

  it('1. KnowledgeChecklist evaluates 8 knowledge pillars and computes structured scores', () => {
    const snapshot = createSampleSnapshot();
    const result = checklist.evaluate(snapshot);

    expect(result.requirements.vision.satisfied).toBe(true);
    expect(result.requirements.user.satisfied).toBe(true);
    expect(result.requirements.scope.satisfied).toBe(true);
    expect(result.knowledgeScore.vision).toBe(100);
    expect(result.knowledgeScore.user).toBe(100);
    expect(result.knowledgeScore.scope).toBe(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.maturityLevel).toBe('Level 4: Development Ready');
  });

  it('2. Missing required knowledge pillar results in Level 1 Idea / Level 2 Defined and blocks readiness', () => {
    const snapshot = createSampleSnapshot();
    // Remove target_user decision
    snapshot.decisions.items = snapshot.decisions.items.filter((d) => d.area !== 'target_user');

    const evalResult = evaluator.evaluate(snapshot);
    expect(evalResult.ready).toBe(false);
    expect(evalResult.blockingIssues.some((i) => i.includes('目标用户'))).toBe(true);
    expect(evalResult.maturityLevel).not.toBe('Level 4: Development Ready');
    expect(evalResult.maturityLevel).not.toBe('Level 5: Stable');
  });

  it('3. Fully specified project reaches Level 5 Stable and passes readiness review', () => {
    const snapshot = createSampleSnapshot();
    snapshot.decisions.items.push(
      { id: 'dec-04', area: 'core_problem', statement: 'Scattered notes with low retrieval speed', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-05', area: 'user_flows', statement: '1. Ingest files; 2. Embed; 3. Query', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-06', area: 'ux_ui', statement: 'Three-column layout with quick search', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-07', area: 'technical_boundary', statement: 'Local SQLite-vec with ONNX runtime', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-08', area: 'acceptance', statement: 'Search response < 500ms for 10,000 notes', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' }
    );

    const evalResult = evaluator.evaluate(snapshot);
    expect(evalResult.ready).toBe(true);
    expect(evalResult.maturityLevel).toBe('Level 5: Stable');
    expect(evalResult.score).toBeGreaterThanOrEqual(95);
    expect(evalResult.blockingIssues.length).toBe(0);
  });
});
