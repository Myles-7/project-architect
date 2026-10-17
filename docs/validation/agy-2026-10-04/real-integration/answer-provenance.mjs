export function verifyAnswerProvenance(before, after, answers, operationId) {
  const beforeIds = new Set(before.decisions.items.map(d => d.id));
  const created = after.decisions.items.filter(d => !beforeIds.has(d.id));
  const source = `answer:${operationId}`;
  const replacements = new Map();
  const selections = [], delegations = [];
  const topicFor = (snapshot, key) => snapshot.planning.topics.find(t => t.key === key || t.aliases.includes(key ?? ''));
  for (const answer of answers) {
    const q = before.questions.items.find(value => value.id === answer.questionId);
    const next = after.questions.items.find(value => value.id === answer.questionId);
    const priorTopic = topicFor(before, q?.decisionKey);
    const nextTopic = topicFor(after, priorTopic?.key ?? q?.decisionKey);
    const sourced = created.filter(d => d.approvalSource === source && d.evidenceRefs?.includes(`question:${answer.questionId}`));
    if (answer.kind === 'selection') {
      const decision = sourced[0], prior = before.decisions.items.find(d => d.id === priorTopic?.effectiveDecisionId);
      const selectedKeys = answer.optionKeys ?? [];
      const validQuestion = !!q && ['shown', 'proposed'].includes(q.status) && next?.status === 'answered' && next.answerKind === 'selection' && JSON.stringify(next.selectedOptionKeys) === JSON.stringify(selectedKeys) && selectedKeys.length > 0 && selectedKeys.every(key => q.options.some(option => option.key === key));
      const validDecision = sourced.length === 1 && decision.status === 'confirmed' && decision.origin === 'user' && decision.confirmedBy === 'user' && decision.decisionKey === (priorTopic?.key ?? q?.decisionKey);
      const validTopic = !!decision && nextTopic?.effectiveDecisionId === decision.id && nextTopic.lastAnswerKind === 'selection' && nextTopic.lastAnsweredQuestionId === answer.questionId && nextTopic.history.includes(decision.id);
      const nextPrior = prior && after.decisions.items.find(d => d.id === prior.id);
      const validReplacement = !prior || prior.status !== 'locked' && nextPrior?.status === 'superseded' && nextPrior.supersededBy === `decision:${decision?.id}`;
      if (prior && decision) replacements.set(prior.id, decision.id);
      selections.push({ questionId: answer.questionId, decisionKey: q?.decisionKey, priorDecisionId: prior?.id, decisionId: decision?.id, validQuestion, validDecision, validTopic, validReplacement });
    } else {
      const raw = answer.text?.trim() ? answer.text : answer.kind === 'delegate' ? '交给 AI 拟定' : answer.kind === 'defer' ? '暂不决定' : '';
      const rawPreserved = answer.kind !== 'delegate' || after.planning.inputs.some(i => i.questionId === answer.questionId && i.kind === 'delegation' && i.raw === raw);
      delegations.push({ questionId: answer.questionId, kind: answer.kind, createdDecisionIds: sourced.map(d => d.id), noDecisionCreated: sourced.length === 0, effectiveDecisionPreserved: nextTopic?.effectiveDecisionId === priorTopic?.effectiveDecisionId, questionAnswered: !!q && next?.status === (answer.kind === 'defer' ? 'dismissed' : 'answered') && next.answerKind === answer.kind && next.answer === raw, rawPreserved });
    }
  }
  const authorizedNewIds = new Set(selections.map(item => item.decisionId).filter(Boolean));
  const unrelatedChanges = before.decisions.items.flatMap(prior => {
    const next = after.decisions.items.find(d => d.id === prior.id);
    if (JSON.stringify(prior) === JSON.stringify(next)) return [];
    const replacement = replacements.get(prior.id);
    const expected = { ...prior, status: 'superseded', supersededBy: `decision:${replacement}` };
    return replacement && JSON.stringify(next) === JSON.stringify(expected) ? [] : [{ id: prior.id, beforeStatus: prior.status, afterStatus: next?.status }];
  });
  const checks = [
    { name: 'selection-confirmed-from-exact-answer-provenance', pass: selections.every(item => item.validQuestion && item.validDecision && item.validTopic), details: selections },
    { name: 'selection-replaces-original-topic-decision', pass: selections.every(item => item.validReplacement), details: selections },
    { name: 'delegation-does-not-confirm', pass: delegations.every(item => item.noDecisionCreated && item.effectiveDecisionPreserved && item.questionAnswered) && created.length === selections.length && created.every(d => authorizedNewIds.has(d.id)), details: { delegations, createdDecisionIds: created.map(d => d.id) } },
    { name: 'answer-does-not-mutate-unrelated-decisions', pass: unrelatedChanges.length === 0, details: unrelatedChanges },
    { name: 'delegation-original-text-preserved', pass: delegations.every(item => item.rawPreserved), details: delegations }
  ];
  return { pass: checks.every(check => check.pass), checks, counts: { beforeConfirmed: before.decisions.items.filter(d => d.status === 'confirmed').length, afterConfirmed: after.decisions.items.filter(d => d.status === 'confirmed').length, selections: selections.length, nonSelections: delegations.length } };
}
