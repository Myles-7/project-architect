import { AreaRegistry } from '../areas/AreaRegistry.js';
import type {
  ProjectSnapshot,
  QuestionBatchStage,
  QuestionBatchInfo,
} from '@project-architect/contracts';

export interface QuestionBatchPolicyResult {
  stage: Exclude<QuestionBatchStage, 'legacy'>;
  targetMin: number;
  maxQuestions: number;
  clearAreaCount: number;
}

/** Local deterministic B3 stage/budget policy. The Agent cannot raise these limits. */
export class QuestionBatchPolicy {
  evaluate(snapshot: ProjectSnapshot): QuestionBatchPolicyResult {
    const clearAreaCount = snapshot.overview.sections.filter((section) =>
      AreaRegistry.isDiscoveryArea(AreaRegistry.normalize(section.id))
      && ['mostly-clear', 'clear', 'locked'].includes(section.maturity)
    ).length;

    if (['readiness-review', 'approved', 'documents-generated'].includes(snapshot.metadata.stage)) {
      return { stage: 'readiness', targetMin: 0, maxQuestions: 2, clearAreaCount };
    }
    if (clearAreaCount <= 2) {
      return { stage: 'initial', targetMin: 8, maxQuestions: 12, clearAreaCount };
    }
    if (clearAreaCount <= 5) {
      return { stage: 'explore', targetMin: 5, maxQuestions: 8, clearAreaCount };
    }
    return { stage: 'converge', targetMin: 2, maxQuestions: 4, clearAreaCount };
  }

  getBudgetForStage(stage: QuestionBatchStage): { targetMin: number; maxQuestions: number } {
    switch (stage) {
      case 'initial':
        return { targetMin: 8, maxQuestions: 12 };
      case 'explore':
        return { targetMin: 5, maxQuestions: 8 };
      case 'converge':
        return { targetMin: 2, maxQuestions: 4 };
      case 'readiness':
      default:
        return { targetMin: 0, maxQuestions: 2 };
    }
  }

  getBatchInfo(snapshot: ProjectSnapshot): QuestionBatchInfo {
    const allQuestions = snapshot.questions?.items || [];
    let activeBatchId: string | null = null;
    for (let i = allQuestions.length - 1; i >= 0; i--) {
      const q = allQuestions[i];
      if (q && q.batchId) {
        activeBatchId = q.batchId;
        break;
      }
    }

    if (!activeBatchId) {
      const validQuestions = allQuestions.filter((q) => q.status !== 'superseded');
      const answeredCount = validQuestions.filter(
        (q) => q.status === 'answered' || q.status === 'dismissed'
      ).length;
      return {
        activeBatchId: null,
        totalQuestions: validQuestions.length,
        answeredCount,
        remainingCount: Math.max(0, validQuestions.length - answeredCount),
        isComplete: validQuestions.length > 0 && validQuestions.length === answeredCount,
      };
    }

    const batchQuestions = allQuestions.filter(
      (q) => q.batchId === activeBatchId && q.status !== 'superseded'
    );
    const answeredCount = batchQuestions.filter(
      (q) => q.status === 'answered' || q.status === 'dismissed'
    ).length;
    const remainingCount = Math.max(0, batchQuestions.length - answeredCount);

    return {
      activeBatchId,
      totalQuestions: batchQuestions.length,
      answeredCount,
      remainingCount,
      isComplete: batchQuestions.length > 0 && remainingCount === 0,
    };
  }
}

