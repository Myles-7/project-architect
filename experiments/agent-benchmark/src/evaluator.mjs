const text = (value) => JSON.stringify(value ?? '').toLowerCase();
const clamp = (value) => Math.max(0, Math.min(5, Math.round(value)));

function signalCoverage(output, signals) {
  if (!signals?.length) return { score: null, matched: [] };
  const haystack = text(output);
  const matched = signals.filter((alternatives) => alternatives.some((term) => haystack.includes(term.toLowerCase())));
  return { score: clamp(5 * matched.length / signals.length), matched: matched.length };
}

export function evaluateRecord(record, fixture) {
  const rawOutput = record.output || {};
  const updates = rawOutput.understanding_updates || rawOutput;
  const output = { ...rawOutput, confirmed: updates.confirmed || rawOutput.confirmed || [], candidates: updates.candidates || rawOutput.candidates || [], assumptions: updates.assumptions || rawOutput.assumptions || [], unknowns: rawOutput.unknowns || [], questions: rawOutput.next_step?.questions || rawOutput.questions || [] };
  const questions = output.questions;
  const gaps = output.gaps || [];
  const signals = signalCoverage(output, fixture.evaluation_signals);
  const hasLabeling = ['confirmed', 'candidates', 'assumptions', 'unknowns'].every((key) => Array.isArray(output[key]));
  const meaningfulQuestions = questions.filter((q) => q.question && q.recommendation && q.recommendation_reason).length;
  const challengeCount = (output.risks?.length || 0) + gaps.length + (output.conflicts?.length || 0);
  const overSpecificTerms = ['postgres','mysql','mongodb','sqlite','react','vue','angular','electron','tauri','aws','azure','gcp','oauth','jwt','saml','color palette','配色','数据库','框架','云厂商'];
  const overSpecificCount = (output.assumptions || []).filter((item) => overSpecificTerms.some((term) => String(item).toLowerCase().includes(term))).length;
  const hasOfflineSync = /完全离线|offline/.test(text(fixture.idea)) && /自动同步|sync/.test(text(fixture.idea));
  const conflictText = text(output.conflicts);
  const conflictPrecision = hasOfflineSync ? (conflictText.includes('离线') || conflictText.includes('offline')) && (conflictText.includes('同步') || conflictText.includes('sync')) ? 5 : 1 : 5;
  const scores = {
    key_gap_coverage: signals.score,
    question_relevance: clamp(meaningfulQuestions ? 3 + Math.min(2, meaningfulQuestions / 2) : 0),
    duplicate_question_risk: 5, // manual-review-needed: reliable semantic duplicate detection is not objective here.
    silent_assumption_safety: clamp((hasLabeling ? 3 : 0) + ((output.assumptions?.length || 0) > 0 ? 2 : 0)),
    challenge_ability: clamp(challengeCount ? 3 + Math.min(2, challengeCount / 3) : 0),
    recommendation_quality: clamp(questions.filter((q) => q.recommendation && q.recommendation_reason).length ? 4 : 1),
    structured_output_reliability: record.success ? 5 : 0,
    conciseness: clamp(questions.length <= 5 ? 5 : Math.max(1, 7 - questions.length)),
    assumption_over_specification: clamp(5 - overSpecificCount * 2),
    conflict_precision: conflictPrecision
  };
  const numeric = Object.values(scores).filter(Number.isFinite);
  return { scores, heuristicQuality: numeric.reduce((sum, score) => sum + score, 0) / numeric.length, matchedSignals: signals.matched, notes: { duplicate_question_risk: 'manual-review-needed', recommendation_quality: 'heuristic', key_gap_coverage: 'heuristic using fixture signals', assumption_over_specification: 'heuristic/manual-review-needed', conflict_precision: 'heuristic/manual-review-needed' } };
}
