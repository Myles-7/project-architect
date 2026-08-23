const stringify = (value) => JSON.stringify(value, null, 2);
const limit = (items, count = 8) => Array.isArray(items) ? items.slice(0, count) : [];

export function fullModularContext(fixture, analysis, gaps) {
  return {
    idea: fixture.idea,
    expectedCharacteristics: fixture.expected_characteristics,
    ideaAnalysis: analysis,
    gapAnalysis: gaps
  };
}

export function minimizedGapContext(fixture, analysis) {
  return {
    currentProjectSummary: fixture.idea.slice(0, 1600),
    currentStage: 'pre-coding project definition',
    confirmed: limit(analysis.confirmed, 8),
    assumptions: limit(analysis.assumptions, 5),
    unresolved: limit(analysis.unknowns, 10),
    risks: limit(analysis.risks, 8)
  };
}

export function minimizedQuestionContext(fixture, analysis, gapResult) {
  const ranked = [...(gapResult.gaps || [])].sort((a, b) => ({ critical: 3, high: 2, medium: 1, low: 0 }[b.severity] - { critical: 3, high: 2, medium: 1, low: 0 }[a.severity]));
  return {
    currentHighestPriorityGaps: ranked.slice(0, 3),
    relatedConfirmed: limit(analysis.confirmed, 6),
    necessaryUserContext: fixture.idea.slice(0, 900),
    conflicts: limit(gapResult.conflicts, 3)
  };
}

export const contextText = (context) => stringify(context);

const clip = (value, maxChars) => String(value ?? '').slice(0, maxChars);

/** A bounded context envelope for one-call Variant E. No hidden history is loaded. */
export function buildVariantEContext(fixture, projectState = {}) {
  const budget = { max_context_chars: 2800, max_user_input_chars: 2200, max_array_items: 5, max_item_chars: 280 };
  const userInput = clip(fixture.idea, budget.max_user_input_chars);
  const boundedList = (items) => Array.isArray(items) ? items.slice(0, budget.max_array_items).map((item) => clip(item, budget.max_item_chars)) : [];
  const context = {
    current_stage: 'pre-coding project definition',
    current_user_input: userInput,
    relevant_confirmed_decisions: boundedList(projectState.confirmed),
    relevant_locked_decisions: boundedList(projectState.locked),
    relevant_assumptions: boundedList(projectState.assumptions),
    relevant_open_gaps: boundedList(projectState.openGaps),
    relevant_overview_sections: boundedList(projectState.overviewSections)
  };
  let contextJson = stringify(context);
  if (contextJson.length > budget.max_context_chars) {
    context.current_user_input = clip(userInput, Math.max(0, budget.max_context_chars - 500));
    contextJson = stringify(context);
  }
  return { context, contextText: contextJson, budget, user_input_chars: fixture.idea.length, context_chars: contextJson.length };
}
