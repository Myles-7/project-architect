import { describe, it, expect, beforeEach } from 'vitest';
import { GapDetectionEngine } from '../src/gaps/GapDetectionEngine.js';
import type {
  ProjectSnapshot,
  MergedChecklistHint,
  DiscoveryResult,
} from '@project-architect/contracts';

describe('GapDetectionEngine Unit Tests (Phase 2.1)', () => {
  let engine: GapDetectionEngine;

  beforeEach(() => {
    engine = new GapDetectionEngine();
  });

  function createBaseSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-test-gap',
        name: 'Smart Bookmark Tool',
        stage: 'initial-analysis',
        stateRevision: 1,
        projectTags: ['Desktop App', 'Utility Tool'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-test-gap',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'mostly-clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'user_flows', title: '流程', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'technical_boundary', title: '技术', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-test-gap',
        items: [
          {
            id: 'dec-01',
            area: 'project_overview',
            statement: 'A smart bookmark manager for local browser links',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: { schemaVersion: 1, projectId: 'proj-test-gap', items: [], updatedAt: '' },
      gaps: { schemaVersion: 1, projectId: 'proj-test-gap', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-test-gap', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-test-gap', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-test-gap',
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

  it('1. Blurry Idea: detects missing target_user and mvp_scope as high priority', () => {
    const snapshot = createBaseSnapshot();
    const hints: MergedChecklistHint[] = [
      { id: 'chk-univ-target-user', area: 'target_user', criterion: '核心目标用户明确', importance: 'critical' },
      { id: 'chk-univ-mvp-boundary', area: 'mvp_scope', criterion: 'MVP范围明确', importance: 'critical' },
      { id: 'chk-univ-platform', area: 'technical_boundary', criterion: '首发运行环境明确', importance: 'normal' },
    ];

    const detected = engine.detectAndPrioritizeGaps(snapshot, hints);

    expect(detected.length).toBeGreaterThan(1);
    const topGap = detected[0];
    expect(topGap?.area).toBe('target_user');
    expect(topGap?.source).toBe('checklist');
    expect(topGap?.severity).toBe('critical');
  });

  it('2. Well-specified project: filters out already clear/locked areas', () => {
    const snapshot = createBaseSnapshot();
    // Mark target_user and mvp_scope as clear
    snapshot.overview.sections.find((s) => s.id === 'target_user')!.maturity = 'clear';
    snapshot.overview.sections.find((s) => s.id === 'mvp_scope')!.maturity = 'locked';

    const hints: MergedChecklistHint[] = [
      { id: 'chk-univ-target-user', area: 'target_user', criterion: '核心目标用户明确', importance: 'critical' },
      { id: 'chk-univ-mvp-boundary', area: 'mvp_scope', criterion: 'MVP范围明确', importance: 'critical' },
      { id: 'chk-univ-platform', area: 'technical_boundary', criterion: '首发运行环境明确', importance: 'high' },
    ];

    const detected = engine.detectAndPrioritizeGaps(snapshot, hints);

    // target_user and mvp_scope must be filtered out
    expect(detected.some((g) => g.area === 'target_user')).toBe(false);
    expect(detected.some((g) => g.area === 'mvp_scope')).toBe(false);
    expect(detected.some((g) => g.area === 'technical_boundary')).toBe(true);
  });

  it('3. Product First: Product and User gaps strictly outrank Technical constraints', () => {
    const snapshot = createBaseSnapshot();
    const hints: MergedChecklistHint[] = [
      { id: 'chk-tech-runtime', area: 'technical_boundary', criterion: '运行环境细节', importance: 'critical' },
      { id: 'chk-user-persona', area: 'target_user', criterion: '用户画像画像清晰', importance: 'high' },
    ];

    const detected = engine.detectAndPrioritizeGaps(snapshot, hints);

    const userGapIndex = detected.findIndex((g) => g.area === 'target_user');
    const techGapIndex = detected.findIndex((g) => g.area === 'technical_boundary');

    expect(userGapIndex).toBeLessThan(techGapIndex);
  });

  it('4. Fuses AI Discovery gaps with Checklist hints and deduplicates cleanly', () => {
    const snapshot = createBaseSnapshot();
    const hints: MergedChecklistHint[] = [
      { id: 'chk-univ-target-user', area: 'target_user', criterion: 'Checklist 用户标准', importance: 'high' },
    ];

    const discoveryResult: DiscoveryResult = {
      confirmed: [],
      candidates: [],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'critical',
          reason: 'AI 识别出目标用户缺乏具体使用场景界定',
          impact: '主流程设计缺乏锚点',
          dependency: 'none',
          should_ask_user: true,
        },
        {
          area: 'user_flows',
          severity: 'high',
          reason: 'AI 识别出书签搜索与标签分类主流程尚未闭环',
          impact: '核心操作链路不完整',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [],
    };

    const detected = engine.detectAndPrioritizeGaps(snapshot, hints, discoveryResult);

    expect(detected.length).toBe(2);
    const userGap = detected.find((g) => g.area === 'target_user');
    expect(userGap).toBeDefined();
    expect(userGap?.source).toBe('ai');
    expect(userGap?.severity).toBe('critical');
    expect(userGap?.reason).toContain('AI 识别出');
  });
});
