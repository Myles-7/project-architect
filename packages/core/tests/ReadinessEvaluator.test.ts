import { describe, it, expect, beforeEach } from 'vitest';
import { ReadinessEvaluator } from '../src/readiness/ReadinessEvaluator.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('ReadinessEvaluator Unit Tests (Phase 4.2)', () => {
  let evaluator: ReadinessEvaluator;

  beforeEach(() => {
    evaluator = new ReadinessEvaluator();
  });

  function createBaseSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-eval-test',
        name: 'Test Project',
        stage: 'created',
        stateRevision: 1,
        projectTags: ['Desktop App'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-eval-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'mostly-clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-eval-test',
        items: [
          {
            id: 'dec-01',
            area: 'project_overview',
            statement: 'A desktop utility tool',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: '',
            updatedAt: '',
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-eval-test',
        items: [
          { id: 'asm-01', statement: 'Default setting in local JSON', reason: 'Reversible default', status: 'active', createdAt: '' },
        ],
        updatedAt: '',
      },
      gaps: { schemaVersion: 1, projectId: 'proj-eval-test', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-eval-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-eval-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-eval-test',
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

  it('1. Empty / newly created project fails readiness review due to missing Target User and MVP scope', () => {
    const snapshot = createBaseSnapshot();
    const result = evaluator.evaluate(snapshot);

    expect(result.ready).toBe(false);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.blockingIssues.some((i) => i.includes('目标用户'))).toBe(true);
    expect(result.blockingIssues.some((i) => i.includes('MVP'))).toBe(true);
  });

  it('2. Project with critical conflicts or critical gaps is blocked', () => {
    const snapshot = createBaseSnapshot();
    snapshot.decisions.items.push(
      { id: 'dec-u1', area: 'target_user', statement: '面向独立开发者用户', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-m1', area: 'mvp_scope', statement: '首发版本范围：极简单机列表', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' }
    );

    // Add critical conflict
    snapshot.gaps.conflicts.push({
      id: 'cnf-01',
      propositionA: '必须完全离线',
      propositionB: '自动云端实时同步',
      decisionRefs: [],
      severity: 'critical',
      reason: '100% 离线与云同步排他冲突',
      status: 'open',
    });

    const result = evaluator.evaluate(snapshot);
    expect(result.ready).toBe(false);
    expect(result.blockingIssues.some((i) => i.includes('排他性冲突'))).toBe(true);
  });

  it('3. Complete project passes readiness review with positive score and captures warnings/assumptions', () => {
    const snapshot = createBaseSnapshot();
    snapshot.decisions.items.push(
      { id: 'dec-u1', area: 'target_user', statement: '面向独立开发者用户', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-m1', area: 'mvp_scope', statement: '首发版本范围：极简单机列表', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-f1', area: 'user_flows', statement: '主流程：启动应用 -> 输入任务 -> 按回车保存', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
      { id: 'dec-t1', area: 'technical_boundary', statement: '技术约束：纯本地桌面应用，无外部网络依赖', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' }
    );

    const result = evaluator.evaluate(snapshot);
    expect(result.ready).toBe(true);
    expect(result.blockingIssues.length).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.assumptions.length).toBe(1);
    expect(result.assumptions[0]).toContain('Default setting in local JSON');
  });
});
