import { describe, expect, it } from 'vitest';
import { QuestionComposer } from '../src/questions/QuestionComposer.js';
import { QuestionSelector } from '../src/questions/QuestionSelector.js';
import type { GapItem, ProjectSnapshot } from '@project-architect/contracts';

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

  it('selects exactly one high-priority question', () => {
    const selection = selector.select([gap('gap-1', 'high'), gap('gap-2', 'critical', 'target_user')], snapshot());

    expect(selection.gapsToAsk).toHaveLength(1);
    expect(composer.compose(selection.gapsToAsk[0]!).importance).toBe('critical');
  });

  it('keeps normal questions within the frozen B2.1 maximum of two related items', () => {
    const selection = selector.select([
      gap('gap-1', 'medium', 'ux_ui'),
      gap('gap-2', 'medium', 'ux_ui'),
      gap('gap-3', 'medium', 'ux_ui'),
    ], snapshot());

    expect(selection.gapsToAsk).toHaveLength(2);
    expect(selection.gapsToAsk.every((item) => item.area === 'ux_ui')).toBe(true);
  });

  it('routes low-priority gaps to reversible assumptions instead of questions', () => {
    const selection = selector.select([gap('gap-1', 'low')], snapshot());

    expect(selection.gapsToAsk).toHaveLength(0);
    expect(selection.gapsToAssume).toHaveLength(1);
  });
});
