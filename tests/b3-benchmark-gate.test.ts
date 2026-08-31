import { describe, expect, it } from 'vitest';
import {
  evaluateB3Quality,
  summarizeManualReviews,
} from '../experiments/agent-benchmark/src/b3-quality-evaluator.mjs';

const score = (reviewer: string, value = 4) => ({
  reviewer,
  evidence: `review://${reviewer}`,
  relevance: value,
  decisionValue: value,
  independentAnswerability: value,
  clarity: value,
  impactUsefulness: value,
});

describe('B3 benchmark release evidence', () => {
  it('never fabricates manual reviews when no evidence is supplied', () => {
    const result = evaluateB3Quality({ questions: [] }, { stage: 'initial' });
    expect(result.manual_reviews).toEqual([]);
    expect(summarizeManualReviews([{ b3: result }]).passed).toBe(false);
  });

  it('requires two valid independent reviews for every record', () => {
    const result = evaluateB3Quality(
      { questions: [] },
      { stage: 'initial', manualReviews: [score('A'), score('B')] }
    );
    const summary = summarizeManualReviews([{ b3: result }]);
    expect(summary).toMatchObject({ complete: true, passed: true, average_score: 4 });
  });

  it('fails when any review dimension averages below four', () => {
    const weak = score('A', 5);
    weak.independentAnswerability = 2;
    const result = evaluateB3Quality(
      { questions: [] },
      { stage: 'initial', manualReviews: [weak, score('B', 5)] }
    );
    expect(summarizeManualReviews([{ b3: result }]).passed).toBe(false);
  });
});
