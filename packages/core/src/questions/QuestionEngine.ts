import type { AssumptionItem, DiscoveryResult, GapItem, ProjectSnapshot, QuestionItem } from '@project-architect/contracts';
import { QuestionComposer } from './QuestionComposer.js';
import { QuestionSelector } from './QuestionSelector.js';

export interface QuestionEngineResult {
  questions: QuestionItem[];
  autoAssumptions: AssumptionItem[];
  batch: {
    id: string;
    stage: import('@project-architect/contracts').QuestionBatchStage;
    diagnostics: import('./QuestionSelector.js').QuestionSelectionDiagnostics;
  };
}

/** Coordinates deterministic question arbitration and structured wording. */
export class QuestionEngine {
  constructor(
    private readonly selector: QuestionSelector = new QuestionSelector(),
    private readonly composer: QuestionComposer = new QuestionComposer(),
  ) {}

  generateQuestions(
    gaps: GapItem[],
    snapshot: ProjectSnapshot,
    aiQuestions?: DiscoveryResult['questions']
  ): QuestionEngineResult {
    const selection = this.selector.select(gaps, snapshot);
    const usedQuestionTexts = new Set(
      snapshot.questions.items
        .filter((question) => question.status !== 'dismissed')
        .map((question) => this.normalizeText(question.question))
    );

    const questions = selection.gapsToAsk.map((gap) => {
      const preferredQuestion = this.composer.matchStructuredQuestion(gap, aiQuestions, usedQuestionTexts);
      const composed = this.composer.compose(gap, preferredQuestion);
      usedQuestionTexts.add(this.normalizeText(composed.question));
      return composed;
    });
    const batchId = `batch-${snapshot.metadata.stateRevision}-${Date.now().toString(36)}`;
    for (const question of questions) {
      question.batchId = batchId;
      question.batchStage = selection.policy.stage;
      question.basisRevision = snapshot.metadata.stateRevision;
    }

    return {
      questions,
      autoAssumptions: selection.gapsToAssume.map((gap) => this.composer.toAssumption(gap)),
      batch: { id: batchId, stage: selection.policy.stage, diagnostics: selection.diagnostics },
    };
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[\s\p{P}]+/gu, '');
  }
}
