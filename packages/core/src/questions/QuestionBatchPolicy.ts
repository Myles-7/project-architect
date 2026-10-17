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
  evaluate(snapshot: ProjectSnapshot, intensity?: import('@project-architect/contracts').DiscoveryIntensity): QuestionBatchPolicyResult {
    const clearAreaCount = snapshot.overview.sections.filter((section) =>
      AreaRegistry.isDiscoveryArea(AreaRegistry.normalize(section.id))
      && ['mostly-clear', 'clear', 'locked'].includes(section.maturity)
    ).length;

    if (intensity === 'lite') {
      return { stage: 'converge', targetMin: 1, maxQuestions: 2, clearAreaCount };
    }
    if (intensity === 'deep') {
      return { stage: 'explore', targetMin: 1, maxQuestions: 3, clearAreaCount };
    }

    if (['readiness-review', 'approved', 'documents-generated'].includes(snapshot.metadata.stage)) {
      return { stage: 'readiness', targetMin: 0, maxQuestions: 2, clearAreaCount };
    }
    if (clearAreaCount <= 2) {
      return { stage: 'initial', targetMin: 1, maxQuestions: 3, clearAreaCount };
    }
    if (clearAreaCount <= 5) {
      return { stage: 'explore', targetMin: 1, maxQuestions: 3, clearAreaCount };
    }
    return { stage: 'converge', targetMin: 1, maxQuestions: 3, clearAreaCount };
  }

  getBudgetForStage(stage: QuestionBatchStage): { targetMin: number; maxQuestions: number } {
    switch (stage) {
      case 'initial':
        return { targetMin: 1, maxQuestions: 3 };
      case 'explore':
        return { targetMin: 1, maxQuestions: 3 };
      case 'converge':
        return { targetMin: 1, maxQuestions: 3 };
      case 'readiness':
      default:
        return { targetMin: 0, maxQuestions: 2 };
    }
  }

  getBatchInfo(snapshot: ProjectSnapshot): QuestionBatchInfo {
    const allQuestions = snapshot.questions?.items || [];
    let activeBatchId: string | null = null;
    const byRecency = [...allQuestions].filter((q) => q.status !== 'superseded')
      .sort((a, b) => (b.basisRevision ?? 0) - (a.basisRevision ?? 0) || b.createdAt.localeCompare(a.createdAt));
    for (const q of byRecency) {
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

