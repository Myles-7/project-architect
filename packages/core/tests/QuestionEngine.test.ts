import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionEngine } from '../src/questions/QuestionEngine.js';
import type {
  ProjectSnapshot,
  GapItem,
} from '@project-architect/contracts';

describe('QuestionEngine Unit Tests (Phase 2.2)', () => {
  let engine: QuestionEngine;

  beforeEach(() => {
    engine = new QuestionEngine();
  });

  function createBaseSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-test-q',
        name: 'Local Music Tagger',
        stage: 'broad-pass',
        stateRevision: 2,
        projectTags: ['Desktop App'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-test-q',
        sections: [
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'user_flows', title: '流程', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'technical_boundary', title: '技术', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-test-q',
        items: [],
        updatedAt: new Date().toISOString(),
      },
      assumptions: { schemaVersion: 1, projectId: 'proj-test-q', items: [], updatedAt: '' },
      gaps: { schemaVersion: 1, projectId: 'proj-test-q', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-test-q', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-test-q', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-test-q',
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

  it('1. Critical/High Budget: strictly enforces 1 primary question even when multiple critical gaps exist', () => {
    const snapshot = createBaseSnapshot();
    const gaps: GapItem[] = [
      { id: 'gap-01', area: 'target_user', severity: 'critical', reason: '目标用户不明确', impact: '范围失焦', dependency: 'none', shouldAskUser: true, status: 'open' },
      { id: 'gap-02', area: 'mvp_scope', severity: 'critical', reason: 'MVP功能边界未划定', impact: '范围膨胀', dependency: 'none', shouldAskUser: true, status: 'open' },
      { id: 'gap-03', area: 'user_flows', severity: 'high', reason: '核心标签编辑流程缺失', impact: '主链路断裂', dependency: 'none', shouldAskUser: true, status: 'open' },
    ];

    const result = engine.generateQuestions(gaps, snapshot);

    expect(result.questions.length).toBe(1);
    const primaryQ = result.questions[0]!;
    expect(primaryQ.importance).toBe('critical');
    // Follows product-first priority: target_user outranks mvp_scope.
    expect(primaryQ.issueRef).toBe('gap:gap-01');
    expect(primaryQ.whyNow).toBeDefined();
    expect(primaryQ.recommendation).toBeDefined();
    expect(primaryQ.options.length).toBeGreaterThan(0);
  });

  it('2. Normal Batch Budget: returns at most 2 related questions from top normal area', () => {
    const snapshot = createBaseSnapshot();
    const gaps: GapItem[] = [
      { id: 'gap-01', area: 'ux_ui', severity: 'medium', reason: '暗黑模式适配偏好', impact: '视觉体验', dependency: 'none', shouldAskUser: true, status: 'open' },
      { id: 'gap-02', area: 'ux_ui', severity: 'medium', reason: '快捷键自定义偏好', impact: '操作效率', dependency: 'none', shouldAskUser: true, status: 'open' },
      { id: 'gap-03', area: 'ux_ui', severity: 'medium', reason: '多语言界面需求', impact: '国际化', dependency: 'none', shouldAskUser: true, status: 'open' },
    ];

    const result = engine.generateQuestions(gaps, snapshot);

    expect(result.questions.length).toBe(2);
    expect(result.questions[0]?.importance).toBe('normal');
    expect(result.questions[1]?.importance).toBe('normal');
  });

  it('3. Low Risk Auto-Assumption: emits 0 questions and produces AssumptionItem proposals', () => {
    const snapshot = createBaseSnapshot();
    const gaps: GapItem[] = [
      { id: 'gap-01', area: 'technical_boundary', severity: 'low', reason: '日志保存周期默认设定为7天', impact: '常规配置', dependency: 'none', shouldAskUser: false, status: 'open' },
      { id: 'gap-02', area: 'ux_ui', severity: 'low', reason: '默认窗口大小设为 1200x800', impact: '常规配置', dependency: 'none', shouldAskUser: false, status: 'open' },
    ];

    const result = engine.generateQuestions(gaps, snapshot);

    expect(result.questions.length).toBe(0);
    expect(result.autoAssumptions.length).toBe(2);
    expect(result.autoAssumptions[0]?.statement).toContain('默认');
    expect(result.autoAssumptions[0]?.status).toBe('active');
  });

  it('4. Anti-Repetition: suppresses questions already answered or in clear/locked areas', () => {
    const snapshot = createBaseSnapshot();
    // Record an already answered question
    snapshot.questions.items.push({
      id: 'q-past-01',
      issueRef: 'gap:gap-01',
      importance: 'critical',
      question: '针对【target_user】：目标用户不明确，您的首发版本规划是什么？',
      reason: 'Why now',
      recommendation: 'Rec',
      recommendationReason: 'Reason',
      options: [],
      allowFreeInput: true,
      status: 'answered',
      answer: '个人独立音乐爱好者',
      createdAt: '',
    });

    const gaps: GapItem[] = [
      { id: 'gap-01', area: 'target_user', severity: 'critical', reason: '目标用户不明确', impact: '范围失焦', dependency: 'none', shouldAskUser: true, status: 'open' },
      { id: 'gap-02', area: 'mvp_scope', severity: 'high', reason: 'MVP功能边界未划定', impact: '范围膨胀', dependency: 'none', shouldAskUser: true, status: 'open' },
    ];

    const result = engine.generateQuestions(gaps, snapshot);

    // target_user question was already answered, so engine advances to mvp_scope
    expect(result.questions.length).toBe(1);
    expect(result.questions[0]?.issueRef).toBe('gap:gap-02');
  });

  it('5. Question Rules: ensures mandatory whyNow, recommendation, and options with impact', () => {
    const snapshot = createBaseSnapshot();
    const gaps: GapItem[] = [
      { id: 'gap-01', area: 'mvp_scope', severity: 'critical', reason: '批量格式转换是否进入第一版', impact: '开发周期翻倍', dependency: 'none', shouldAskUser: true, status: 'open' },
    ];

    const result = engine.generateQuestions(gaps, snapshot);

    expect(result.questions.length).toBe(1);
    const q = result.questions[0]!;
    expect(q.whyNow).toBeTruthy();
    expect(q.recommendation).toBeTruthy();
    expect(q.recommendationReason).toBeTruthy();
    expect(q.options.length).toBeGreaterThanOrEqual(2);
    for (const opt of q.options) {
      expect(opt.label).toBeTruthy();
      expect(opt.impact).toBeTruthy();
    }
  });
});
