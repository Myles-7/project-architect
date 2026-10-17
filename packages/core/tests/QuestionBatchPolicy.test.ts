import { describe, expect, it } from 'vitest';
import { QuestionBatchPolicy } from '../src/questions/QuestionBatchPolicy.js';
import { QuestionSelector } from '../src/questions/QuestionSelector.js';
import type { GapItem, ProjectSnapshot } from '@project-architect/contracts';

function snapshot(clearCount: number, stage: ProjectSnapshot['metadata']['stage'] = 'broad-pass'): ProjectSnapshot {
  const areas = ['target_user', 'mvp_scope', 'core_features', 'user_flows', 'page_structure', 'ux_ui_direction', 'technical_boundary', 'delivery_plan'];
  return {
    metadata: { schemaVersion: 1, projectId: 'p', name: 'p', stage, stateRevision: 3, projectTags: [], inputRefs: [], createdAt: '', updatedAt: '' },
    overview: { schemaVersion: 1, projectId: 'p', updatedAt: '', sections: areas.map((id, index) => ({ id, title: id, kind: 'fixed', maturity: index < clearCount ? 'mostly-clear' : 'unexplored', itemRefs: [] })) },
    decisions: { schemaVersion: 1, projectId: 'p', items: [], updatedAt: '' },
    assumptions: { schemaVersion: 1, projectId: 'p', items: [], updatedAt: '' },
    gaps: { schemaVersion: 1, projectId: 'p', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
    risks: { schemaVersion: 1, projectId: 'p', items: [], updatedAt: '' },
    questions: { schemaVersion: 1, projectId: 'p', items: [], updatedAt: '' },
    readiness: { schemaVersion: 1, projectId: 'p', current: { id: 'r', status: 'not-ready', reviewedAt: '', requiredAreas: [], warnings: [], issues: [], assumptionRefs: [], knownIssueAcknowledgements: [], criticalConflictAcknowledgements: [], userDisposition: 'pending' }, history: [], updatedAt: '' },
  };
}

function gaps(count: number): GapItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `g-${index}`, area: `area_${index}`, decisionKey: `decision_${index}`, dependsOn: [],
    severity: 'high', reason: `reason ${index}`, impact: 'important', shouldAskUser: true, status: 'open',
  }));
}

describe('B3 question batch policy', () => {
  it.each([
    [0, 'initial', 3], [2, 'initial', 3], [3, 'explore', 3],
    [5, 'explore', 3], [6, 'converge', 3], [8, 'converge', 3],
  ] as const)('maps %i clear areas to %s with max %i', (count, stage, max) => {
    expect(new QuestionBatchPolicy().evaluate(snapshot(count))).toMatchObject({ stage, maxQuestions: max });
  });

  it('caps readiness at two', () => {
    expect(new QuestionBatchPolicy().evaluate(snapshot(4, 'readiness-review'))).toMatchObject({ stage: 'readiness', maxQuestions: 2 });
  });

  it('selects at most three initial questions and defers unresolved dependencies', () => {
    const input = gaps(14);
    input[0]!.dependsOn = ['unknown_parent'];
    const result = new QuestionSelector().select(input, snapshot(0));
    expect(result.gapsToAsk).toHaveLength(3);
    expect(result.gapsToAsk.some((gap) => gap.id === 'g-0')).toBe(false);
    expect(result.diagnostics.invalidDependencies).toBe(1);
  });

  it('deduplicates decision keys', () => {
    const input = gaps(3);
    input[1]!.decisionKey = input[0]!.decisionKey;
    const result = new QuestionSelector().select(input, snapshot(0));
    expect(result.gapsToAsk).toHaveLength(2);
    expect(result.diagnostics.duplicatesDropped).toBe(1);
  });

  it('defers and reports dependency cycles', () => {
    const input = gaps(2);
    input[0]!.dependsOn = ['decision_1'];
    input[1]!.dependsOn = ['decision_0'];
    const result = new QuestionSelector().select(input, snapshot(0));
    expect(result.gapsToAsk).toHaveLength(0);
    expect(result.diagnostics.dependencyCycles).toBe(2);
  });

  it('does not suppress an independent decision key just because another decision in the same area is confirmed', () => {
    const state = snapshot(0);
    state.decisions.items.push({
      id: 'dec-persona', area: 'target_user', decisionKey: 'target_user:persona',
      statement: 'Independent developers', status: 'confirmed', origin: 'user',
      evidenceRefs: [], createdAt: '', updatedAt: '',
    });
    const input: GapItem[] = [{
      id: 'g-channel', area: 'target_user', decisionKey: 'target_user:acquisition_channel',
      dependsOn: [], severity: 'high', reason: 'Channel unclear', impact: 'Launch risk',
      shouldAskUser: true, status: 'open',
    }];

    expect(new QuestionSelector().select(input, state).gapsToAsk).toHaveLength(1);
  });

  it('treats confirmed and locked decision keys as resolved dependencies', () => {
    const state = snapshot(0);
    state.decisions.items.push({
      id: 'dec-platform', area: 'technical_boundary', decisionKey: 'technical_boundary:platform',
      statement: 'Windows desktop', status: 'locked', origin: 'user',
      evidenceRefs: [], createdAt: '', updatedAt: '',
    });
    const input: GapItem[] = [{
      id: 'g-packaging', area: 'delivery_plan', decisionKey: 'delivery_plan:packaging',
      dependsOn: ['technical_boundary:platform'], severity: 'high', reason: 'Packaging unclear',
      impact: 'Cannot ship', shouldAskUser: true, status: 'open',
    }];

    expect(new QuestionSelector().select(input, state).gapsToAsk).toHaveLength(1);
  });
});
