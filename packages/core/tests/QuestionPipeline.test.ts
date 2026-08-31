import { describe, expect, it } from 'vitest';
import { QuestionComposer } from '../src/questions/QuestionComposer.js';
import { QuestionSelector } from '../src/questions/QuestionSelector.js';
import type { DiscoveryResult, GapItem, ProjectSnapshot } from '@project-architect/contracts';

function snapshot(): ProjectSnapshot {
  return {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-question-pipeline',
      name: 'Question pipeline test',
      stage: 'broad-pass',
      stateRevision: 1,
      projectTags: [],
      inputRefs: [],
      updatedAt: '2026-08-23T00:00:00.000Z',
      createdAt: '2026-08-23T00:00:00.000Z',
    },
    overview: { schemaVersion: 1, projectId: 'proj-question-pipeline', sections: [], updatedAt: '' },
    decisions: { schemaVersion: 1, projectId: 'proj-question-pipeline', items: [], updatedAt: '' },
    assumptions: { schemaVersion: 1, projectId: 'proj-question-pipeline', items: [], updatedAt: '' },
    gaps: { schemaVersion: 1, projectId: 'proj-question-pipeline', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
    risks: { schemaVersion: 1, projectId: 'proj-question-pipeline', items: [], updatedAt: '' },
    questions: { schemaVersion: 1, projectId: 'proj-question-pipeline', items: [], updatedAt: '' },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-question-pipeline',
      current: {
        id: 'rdn-01', status: 'not-ready', reviewedAt: '', requiredAreas: [], warnings: [], issues: [],
        assumptionRefs: [], knownIssueAcknowledgements: [], criticalConflictAcknowledgements: [], userDisposition: 'pending',
      },
      history: [], updatedAt: '',
    },
  };
}

function gap(id: string, severity: GapItem['severity'], area = 'mvp_scope'): GapItem {
  return {
    id,
    area,
    severity,
    reason: `${area} needs a user decision`,
    impact: 'It affects the first release.',
    dependency: 'none',
    shouldAskUser: severity !== 'low',
    status: 'open',
    priority: severity,
  };
}

describe('Question selection and composition', () => {
  const selector = new QuestionSelector();
  const composer = new QuestionComposer();

  it('selects independent high-priority questions in one B3 batch', () => {
    const selection = selector.select([gap('gap-1', 'high'), gap('gap-2', 'critical', 'target_user')], snapshot());

    expect(selection.gapsToAsk).toHaveLength(2);
    expect(composer.compose(selection.gapsToAsk[0]!).importance).toBe('critical');
  });

  it('keeps distinct normal questions within the B3 stage budget', () => {
    const selection = selector.select([
      gap('gap-1', 'medium', 'ux_ui'),
      gap('gap-2', 'medium', 'ux_ui'),
      gap('gap-3', 'medium', 'ux_ui'),
    ], snapshot());

    expect(selection.gapsToAsk).toHaveLength(3);
    expect(selection.gapsToAsk.every((item) => item.area === 'ux_ui')).toBe(true);
  });

  it('routes low-priority gaps to reversible assumptions instead of questions', () => {
    const selection = selector.select([gap('gap-1', 'low')], snapshot());

    expect(selection.gapsToAsk).toHaveLength(0);
    expect(selection.gapsToAssume).toHaveLength(1);
  });

  it('rejects English provider wording and creates a fully Chinese fallback question', () => {
    const sourceGap = { ...gap('gap-english', 'high'), decisionKey: 'mvp_boundary' };
    const candidate = agentQuestion({
      decision_key: 'mvp_boundary',
      question: 'Which launch scope do you prefer?',
      reason: 'This blocks the launch plan.',
      recommendation: 'Start small.',
      recommendation_reason: 'It is safer.',
      options: [
        { label: 'Small', impact: 'Faster.' },
        { label: 'Large', impact: 'More coverage.' },
      ],
    });

    const matched = composer.matchStructuredQuestion(sourceGap, [candidate], new Set());
    const composed = composer.compose(sourceGap, matched);

    expect(matched).toBeUndefined();
    expect(composed.question).toBe('关于MVP 范围，首发版本应该优先选择哪种方向？');
    expect(composed.reason).toMatch(/[\u3400-\u9fff]/u);
    expect(composed.options.every((option) => /[\u3400-\u9fff]/u.test(option.label + option.impact))).toBe(true);
  });

  it('accepts clear Chinese wording while preserving professional terms', () => {
    const sourceGap = { ...gap('gap-api', 'high', 'core_features'), decisionKey: 'api_scope' };
    const candidate = agentQuestion({ decision_key: 'api_scope' });

    expect(composer.matchStructuredQuestion(sourceGap, [candidate], new Set())).toBe(candidate);
  });

  it('rejects options whose impact does not explain a concrete consequence', () => {
    const sourceGap = { ...gap('gap-vague', 'high'), decisionKey: 'mvp_boundary' };
    const candidate = agentQuestion({
      decision_key: 'mvp_boundary',
      options: [
        { label: '先做基础版本', impact: '这样会更好也更加灵活。' },
        { label: '直接做完整版本', impact: '这个选择的影响比较大。' },
      ],
    });

    expect(composer.matchStructuredQuestion(sourceGap, [candidate], new Set())).toBeUndefined();
  });

  it('normalizes Chinese punctuation and preserves gap semantics for automatic assumptions', () => {
    const sourceGap: GapItem = {
      ...gap('gap-readable', 'high', 'technical_boundary'),
      decisionKey: 'storage_boundary',
      dependsOn: ['mvp_scope'],
      reason: '需要明确数据保存边界。',
      impact: '否则会增加迁移成本。',
    };

    const question = composer.compose(sourceGap);
    const assumption = composer.toAssumption(sourceGap);

    expect(question.question).not.toContain('：需要');
    expect(question.reason).not.toContain('。；');
    expect(question.reason).not.toContain('。。');
    expect(question.recommendation).toMatch(/“[^”]+”/u);
    expect(assumption).toMatchObject({ area: 'technical_boundary', decisionKey: 'storage_boundary' });
  });
});

function agentQuestion(overrides: Partial<DiscoveryResult['questions'][number]> = {}): DiscoveryResult['questions'][number] {
  return {
    decision_key: 'api_scope',
    depends_on: [],
    importance: 'high',
    question: '首发版本是否需要向第三方开放 API 接口？',
    reason: '这个决定会影响首发功能范围和外部用户的接入方式。',
    recommendation: '建议首发版本先提供只读 API。',
    recommendation_reason: '这样可以验证外部用户需求，同时控制开发工作量和数据风险。',
    options: [
      { label: '首发提供只读 API', impact: '外部用户可以读取数据，但不能修改内容，安全风险和开发工作量较低。' },
      { label: '首发提供完整 API', impact: '外部用户可以读写数据，但会增加权限设计、测试工作量和交付时间。' },
    ],
    allow_free_input: true,
    ...overrides,
  };
}
