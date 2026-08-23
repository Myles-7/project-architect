import { describe, expect, it } from 'vitest';
import { GapDetectionEngine } from '../src/gaps/GapDetectionEngine.js';
import type { GapItem } from '@project-architect/contracts';

describe('GapDetectionEngine priority factors', () => {
  const engine = new GapDetectionEngine();

  function gap(id: string, priorityFactors: GapItem['priorityFactors']): GapItem {
    return {
      id,
      area: 'mvp_scope',
      severity: 'medium',
      reason: 'MVP boundary needs clarification',
      impact: 'The first release may expand unexpectedly.',
      dependency: 'none',
      shouldAskUser: true,
      status: 'open',
      priorityFactors,
    };
  }

  it('ranks the higher-impact and less-reversible gap first within the same product area', () => {
    const reversibleRefinement = gap('gap-low', {
      impact: 'low',
      uncertainty: 'low',
      dependency: 'low',
      irreversibility: 'low',
      stageRelevance: 'medium',
    });
    const foundationalScopeChoice = gap('gap-high', {
      impact: 'critical',
      uncertainty: 'high',
      dependency: 'high',
      irreversibility: 'critical',
      stageRelevance: 'high',
    });

    expect(engine.calculatePriorityScore(foundationalScopeChoice))
      .toBeGreaterThan(engine.calculatePriorityScore(reversibleRefinement));
    expect(engine.prioritizeGaps([reversibleRefinement, foundationalScopeChoice]).map((item) => item.id))
      .toEqual(['gap-high', 'gap-low']);
    expect(engine.prioritizeGaps([reversibleRefinement, foundationalScopeChoice])[0]?.priority)
      .toBe('critical');
  });
});
