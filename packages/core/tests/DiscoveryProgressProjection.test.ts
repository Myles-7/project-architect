import { describe, it, expect } from 'vitest';
import { projectDiscoveryProgressProjection } from '../src/view/DiscoveryProgressProjection.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('DiscoveryProgressProjection', () => {
  const createMockSnapshot = (overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-test',
        name: 'Test Project',
        description: 'Testing progress projection',
        version: '1.0.0',
        stage: 'broad-pass',
        stateRevision: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inputRefs: [],
      },
      inputs: [],
      decisions: {
        items: [
          {
            id: 'dec-01',
            area: 'project_overview',
            statement: 'Test core vision',
            status: 'confirmed',
            sourceArea: 'project_overview',
            sourceKind: 'explicit',
            origin: 'user',
            confirmedBy: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      assumptions: {
        items: [
          {
            id: 'asm-01',
            statement: 'Default assumption',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ],
      },
      gaps: {
        gaps: [
          {
            id: 'gap-01',
            area: 'mvp_scope',
            severity: 'critical',
            reason: 'Critical gap reason',
            impact: 'Impact',
            status: 'open',
            shouldAskUser: true,
          },
          {
            id: 'gap-02',
            area: 'delivery_plan',
            severity: 'normal',
            reason: 'Normal gap reason',
            impact: 'Impact',
            status: 'open',
            shouldAskUser: true,
          },
        ],
        conflicts: [],
        tensions: [],
      },
      questions: {
        items: [
          {
            id: 'q-01',
            batchId: 'batch-1',
            issueRef: 'gap:gap-01',
            importance: 'critical',
            question: 'Question 1',
            reason: 'Reason 1',
            recommendation: 'Rec 1',
            recommendationReason: 'Rec Reason 1',
            recommendedOptionKey: 'opt_1',
            options: [{ key: 'opt_1', label: 'Option 1', impact: 'Impact 1' }],
            allowFreeInput: true,
            status: 'proposed',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'q-02',
            batchId: 'batch-1',
            issueRef: 'gap:gap-02',
            importance: 'normal',
            question: 'Question 2',
            reason: 'Reason 2',
            recommendation: 'Rec 2',
            recommendationReason: 'Rec Reason 2',
            recommendedOptionKey: 'opt_1',
            options: [{ key: 'opt_1', label: 'Option 1', impact: 'Impact 1' }],
            allowFreeInput: true,
            status: 'answered',
            createdAt: new Date().toISOString(),
          },
        ],
      },
      overview: {
        sections: [],
      },
      ...overrides,
    };
  };

  it('correctly calculates metrics for an active batch with remaining questions', () => {
    const snapshot = createMockSnapshot();
    const progress = projectDiscoveryProgressProjection(snapshot);

    expect(progress.sourceStateRevision).toBe(3);
    expect(progress.projectId).toBe('proj-test');
    expect(progress.blockingDecisionCount).toBe(1); // 1 critical open gap
    expect(progress.openGapCount).toBe(2);
    expect(progress.deferredGapCount).toBe(1); // 1 active assumption
    expect(progress.activeBatchQuestionCount).toBe(1); // q-01 is proposed
    expect(progress.answeredBatchQuestionCount).toBe(1); // q-02 is answered
    expect(progress.dismissedBatchQuestionCount).toBe(0);
    expect(progress.remainingBatchQuestionCount).toBe(1);
    expect(progress.canGenerateNextBatch).toBe(false);
    expect(progress.nextAction).toBe('answer');
  });

  it('allows next batch and suggests organize when current batch is fully answered or dismissed', () => {
    const snapshot = createMockSnapshot({
      questions: {
        items: [
          {
            id: 'q-01',
            batchId: 'batch-1',
            issueRef: 'gap:gap-01',
            importance: 'critical',
            question: 'Question 1',
            reason: 'Reason 1',
            recommendation: 'Rec 1',
            recommendationReason: 'Rec Reason 1',
            recommendedOptionKey: 'opt_1',
            options: [{ key: 'opt_1', label: 'Option 1', impact: 'Impact 1' }],
            allowFreeInput: true,
            status: 'answered',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'q-02',
            batchId: 'batch-1',
            issueRef: 'gap:gap-02',
            importance: 'normal',
            question: 'Question 2',
            reason: 'Reason 2',
            recommendation: 'Rec 2',
            recommendationReason: 'Rec Reason 2',
            recommendedOptionKey: 'opt_1',
            options: [{ key: 'opt_1', label: 'Option 1', impact: 'Impact 1' }],
            allowFreeInput: true,
            status: 'dismissed',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    const progress = projectDiscoveryProgressProjection(snapshot);

    expect(progress.activeBatchQuestionCount).toBe(0);
    expect(progress.answeredBatchQuestionCount).toBe(1);
    expect(progress.dismissedBatchQuestionCount).toBe(1);
    expect(progress.remainingBatchQuestionCount).toBe(0);
    expect(progress.canGenerateNextBatch).toBe(true);
    expect(progress.nextAction).toBe('organize');
  });

  it('suggests review-readiness when no open gaps remain or readiness review stage is reached', () => {
    const snapshot = createMockSnapshot({
      metadata: {
        ...createMockSnapshot().metadata,
        stage: 'readiness-review',
      },
      gaps: {
        gaps: [],
        conflicts: [],
        tensions: [],
      },
      questions: {
        items: [],
      },
    });

    const progress = projectDiscoveryProgressProjection(snapshot);
    expect(progress.remainingBatchQuestionCount).toBe(0);
    expect(progress.canGenerateNextBatch).toBe(false);
    expect(progress.nextAction).toBe('review-readiness');
  });
});
