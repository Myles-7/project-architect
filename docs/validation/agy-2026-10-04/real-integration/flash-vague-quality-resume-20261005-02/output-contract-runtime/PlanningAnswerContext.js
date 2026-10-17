/** Labels and formal decision statements are references, never evidence of submitted option keys. */
export function planningAnswerContext(questions) {
    return questions.filter(question => question.status === 'answered' || question.status === 'dismissed').map(question => {
        const keys = question.answerKind === 'selection' && Array.isArray(question.selectedOptionKeys) ? question.selectedOptionKeys : [];
        const validSelection = keys.length > 0 && new Set(keys).size === keys.length
            && (question.selectionMode === 'multiple' || keys.length === 1)
            && keys.every(key => question.options.filter(option => option.key === key).length === 1);
        let answerKind = 'unknown';
        if (validSelection)
            answerKind = 'selection';
        else if (question.answerKind === 'custom' || question.answerKind === 'delegate' || question.answerKind === 'defer')
            answerKind = question.answerKind;
        const selectedOptionKeys = validSelection ? [...keys] : [];
        return {
            questionId: question.id, decisionKey: question.decisionKey, question: question.question,
            reason: question.reason, whyNow: question.whyNow, recommendation: question.recommendation,
            recommendationReason: question.recommendationReason, recommendedOptionKey: question.recommendedOptionKey,
            selectionMode: question.selectionMode, status: question.status, answeredAt: question.answeredAt,
            answerKind, answer: question.answer, options: structuredClone(question.options), selectedOptionKeys,
            selectedOptions: selectedOptionKeys.map(key => structuredClone(question.options.find(option => option.key === key))),
        };
    });
}
//# sourceMappingURL=PlanningAnswerContext.js.map