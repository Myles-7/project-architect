import { describe, it, expect } from 'vitest';
import type { ProjectSnapshot } from '@project-architect/contracts';
import { ProjectStateMigration } from '../src/migrations/ProjectStateMigration.js';

function createLegacySnapshot(): ProjectSnapshot {
  return {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-legacy-01',
      name: 'Legacy Project',
      stage: 'broad-pass',
      stateRevision: 1,
      projectTags: [],
      inputRefs: [],
      createdAt: '2026-08-20T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-legacy-01',
      sections: [
        { id: 'project_overview', title: '项目概述', maturity: 'mostly-clear', itemRefs: [] },
        { id: 'core_problem', title: '核心问题', maturity: 'unexplored', itemRefs: [] },
        { id: 'ux_ui', title: 'UI设计', maturity: 'unexplored', itemRefs: [] },
      ],
      updatedAt: '2026-08-20T00:00:00Z',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-legacy-01',
      items: [
        {
          id: 'dec-01',
          area: 'core_problem',
          statement: '考研学生复习时间碎片化且缺少系统规划',
          status: 'confirmed',
          origin: 'user',
          evidenceRefs: ['input:in-01'],
          confirmedBy: 'user',
          createdAt: '2026-08-20T00:00:00Z',
          updatedAt: '2026-08-20T00:00:00Z',
        },
        {
          id: 'dec-02',
          area: 'trust_safety',
          statement: '用户数据 100% 离线保存在本地，绝无云端泄露风险',
          status: 'locked',
          origin: 'user',
          evidenceRefs: ['input:in-01'],
          confirmedBy: 'user',
          createdAt: '2026-08-20T00:00:00Z',
          updatedAt: '2026-08-20T00:00:00Z',
        },
        {
          id: 'dec-03',
          area: 'mysterious_unknown_area',
          statement: '某种未知业务逻辑决策',
          status: 'candidate',
          origin: 'agent',
          evidenceRefs: [],
          createdAt: '2026-08-20T00:00:00Z',
          updatedAt: '2026-08-20T00:00:00Z',
        },
      ],
      updatedAt: '2026-08-20T00:00:00Z',
    },
    assumptions: { schemaVersion: 1, projectId: 'proj-legacy-01', items: [], updatedAt: '' },
    gaps: {
      schemaVersion: 1,
      projectId: 'proj-legacy-01',
      gaps: [
        {
          id: 'gap-01',
          area: 'acceptance',
          severity: 'high',
          reason: '验收标准未明确',
          impact: '交付无依据',
          dependency: 'none',
          shouldAskUser: true,
          status: 'open',
        },
      ],
      conflicts: [],
      tensions: [],
      updatedAt: '',
    },
    risks: { schemaVersion: 1, projectId: 'proj-legacy-01', items: [], updatedAt: '' },
    questions: { schemaVersion: 1, projectId: 'proj-legacy-01', items: [], updatedAt: '' },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-legacy-01',
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

describe('ProjectStateMigration (In-Memory Area Normalization)', () => {
  it('Task 1.4: Migrates legacy areas in decisions and gaps while recording diagnostics', () => {
    const legacy = createLegacySnapshot();
    const { snapshot, diagnostics } = ProjectStateMigration.migrateInMemory(legacy);

    // dec-01: core_problem -> target_user
    const dec1 = snapshot.decisions.items.find((d) => d.id === 'dec-01')!;
    expect(dec1.area).toBe('target_user');
    expect(dec1.sourceArea).toBe('core_problem');

    // dec-02 (Locked): trust_safety -> technical_boundary, while preserving locked statement & status & evidenceRefs
    const dec2 = snapshot.decisions.items.find((d) => d.id === 'dec-02')!;
    expect(dec2.area).toBe('technical_boundary');
    expect(dec2.sourceArea).toBe('trust_safety');
    expect(dec2.status).toBe('locked');
    expect(dec2.statement).toBe('用户数据 100% 离线保存在本地，绝无云端泄露风险');
    expect(dec2.evidenceRefs).toEqual(['input:in-01']);

    // dec-03 (Unknown): mysterious_unknown_area -> project_overview with diagnostics
    const dec3 = snapshot.decisions.items.find((d) => d.id === 'dec-03')!;
    expect(dec3.area).toBe('project_overview');
    expect(dec3.sourceArea).toBe('mysterious_unknown_area');

    // gap-01: acceptance -> delivery_plan
    const gap1 = snapshot.gaps.gaps.find((g) => g.id === 'gap-01')!;
    expect(gap1.area).toBe('delivery_plan');

    // Diagnostics
    expect(diagnostics.normalizedAreas).toBeGreaterThanOrEqual(3);
    expect(diagnostics.unknownAreas).toContain('mysterious_unknown_area');
  });

  it('Task 1.4: Does not add sourceArea if area is already canonical', () => {
    const legacy = createLegacySnapshot();
    legacy.decisions.items[0]!.area = 'target_user';
    const { snapshot } = ProjectStateMigration.migrateInMemory(legacy);
    const dec1 = snapshot.decisions.items.find((d) => d.id === 'dec-01')!;
    expect(dec1.area).toBe('target_user');
    expect(dec1.sourceArea).toBeUndefined();
  });
});
