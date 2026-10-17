export class MockAIProvider {
    name = 'mock-ai-provider';
    mockResponses = new Map();
    defaultResponse;
    constructor(defaultResponse) {
        this.defaultResponse = defaultResponse || {
            confirmed: [],
            candidates: [
                {
                    decision_key: 'dk-platform',
                    area: 'technical_boundary',
                    statement: 'Mock Suggested candidate for desktop platform',
                    rationale: 'Lightweight and fast execution',
                },
            ],
            assumptions: [
                {
                    decision_key: 'dk-storage',
                    area: 'technical_boundary',
                    statement: 'Default setting is stored locally in JSON',
                    reason: 'No cloud server dependency',
                },
            ],
            unknowns: [],
            risks: [
                {
                    risk_key: 'rk-permission',
                    area: 'technical_boundary',
                    statement: 'File permission might require elevation',
                    impact: 'Potential write failure in protected folders',
                    severity: 'low',
                },
            ],
            conflicts: [],
            tensions: [],
            gaps: [
                {
                    decision_key: 'target_user:primary_persona',
                    depends_on: [],
                    area: 'target_user',
                    severity: 'high',
                    reason: 'Target user segment is not fully specified',
                    impact: 'Core flow priority',
                    should_ask_user: true,
                },
            ],
            questions: [
                {
                    decision_key: 'target_user:primary_persona',
                    depends_on: [],
                    importance: 'high',
                    question: 'What is the primary target user persona?',
                    reason: 'Clarifies MVP boundary',
                    recommendation: 'Individual developers and power users',
                    recommendation_reason: 'Matches lightweight desktop requirement',
                    recommended_option_key: 'power_users',
                    options: [
                        { key: 'power_users', label: 'Individual power users', impact: 'Focus on speed', reversibility: 'moderate' },
                        { key: 'general_users', label: 'General non-technical users', impact: 'Focus on simplicity', reversibility: 'moderate' },
                    ],
                    allow_free_input: true,
                },
            ],
        };
    }
    setMockResponse(taskOrResponse, maybeResponse) {
        if (typeof taskOrResponse === 'string' && maybeResponse !== undefined) {
            this.mockResponses.set(taskOrResponse, maybeResponse);
        }
        else {
            this.defaultResponse = taskOrResponse;
            this.mockResponses.set('discovery-turn', taskOrResponse);
        }
    }
    async complete(request) {
        if (request.abortSignal?.aborted) {
            return {
                status: 'cancelled',
                structuredSuccess: false,
                structuredOutput: null,
                rawEnvelope: null,
                stderr: 'Discovery run was cancelled before mock execution.',
                exitCode: null,
                durationMs: 0,
                usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    thinkingTokens: 0,
                    totalTokens: 0,
                    cacheReadTokens: 0,
                },
                provider: this.name,
            };
        }
        const output = this.normalizeB3Fixture(this.mockResponses.get(request.task) || this.defaultResponse);
        if (output === null || output === undefined) {
            return {
                status: 'failed',
                structuredSuccess: false,
                structuredOutput: null,
                rawEnvelope: { mock: true, internal_leak: 'secret_envelope_content' },
                stderr: 'Mock provider failure triggered',
                exitCode: 1,
                durationMs: 10,
                usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    thinkingTokens: 0,
                    totalTokens: 0,
                    cacheReadTokens: 0,
                },
                provider: this.name,
            };
        }
        return {
            status: 'success',
            structuredSuccess: true,
            structuredOutput: output,
            rawEnvelope: { mock: true, structured_output: output },
            stderr: null,
            exitCode: 0,
            durationMs: 150,
            usage: {
                inputTokens: 1200,
                outputTokens: 450,
                thinkingTokens: 1000,
                totalTokens: 2650,
                cacheReadTokens: 0,
            },
            provider: this.name,
        };
    }
    async healthCheck() {
        return {
            status: 'ready',
            providerName: 'Mock AI Provider',
            modelName: 'mock-heuristic-v1',
            inferenceLocation: 'local',
            sendsProjectContextOffDevice: false,
            structuredOutput: 'supported',
            promptCache: 'supported',
            checkedAt: new Date().toISOString(),
            guidance: '单轮单次结构化推演模式已激活。Mock 引擎仅用于单元测试与离线演示，所有推演均在内存中执行。',
        };
    }
    /** Keeps legacy test fixtures concise while production providers remain bound to the strict B3 schema. */
    normalizeB3Fixture(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return value;
        const output = structuredClone(value);
        const normalizeKey = (text, fallback) => {
            const normalized = String(text || '').toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').replace(/^_+|_+$/g, '');
            return normalized || fallback;
        };
        if (Array.isArray(output.candidates)) {
            output.candidates = output.candidates.map((candidate, index) => {
                if (typeof candidate === 'string') {
                    return {
                        decision_key: normalizeKey(candidate, `fixture:candidate_${index}`),
                        area: 'mvp_scope',
                        statement: candidate,
                        rationale: 'Legacy test fixture normalized by MockAIProvider.',
                    };
                }
                return {
                    ...candidate,
                    decision_key: candidate.decision_key || normalizeKey(candidate.statement, `fixture:candidate_${index}`),
                    area: candidate.area || 'mvp_scope',
                    rationale: candidate.rationale || 'Legacy test fixture normalized by MockAIProvider.',
                };
            });
        }
        if (Array.isArray(output.assumptions)) {
            output.assumptions = output.assumptions.map((assumption, index) => {
                if (typeof assumption === 'string') {
                    return {
                        decision_key: normalizeKey(assumption, `fixture:assumption_${index}`),
                        area: 'mvp_scope',
                        statement: assumption,
                        reason: 'Legacy test fixture normalized by MockAIProvider.',
                    };
                }
                return {
                    ...assumption,
                    decision_key: assumption.decision_key || normalizeKey(assumption.statement, `fixture:assumption_${index}`),
                    area: assumption.area || 'mvp_scope',
                    reason: assumption.reason || 'Legacy test fixture normalized by MockAIProvider.',
                };
            });
        }
        if (Array.isArray(output.risks)) {
            output.risks = output.risks.map((risk, index) => {
                if (typeof risk === 'string') {
                    return {
                        risk_key: normalizeKey(risk, `fixture:risk_${index}`),
                        area: 'technical_boundary',
                        statement: risk,
                        impact: risk,
                        severity: 'medium',
                    };
                }
                return {
                    ...risk,
                    risk_key: risk.risk_key || normalizeKey(risk.statement, `fixture:risk_${index}`),
                    area: risk.area || 'technical_boundary',
                    impact: risk.impact || risk.statement,
                    severity: risk.severity || 'medium',
                };
            });
        }
        const gaps = Array.isArray(output.gaps) ? output.gaps : [];
        gaps.forEach((gap, index) => {
            gap.decision_key ??= `${String(gap.area || 'gap').toLowerCase().replace(/[^a-z0-9_]+/g, '_')}:fixture_${index}`;
            gap.depends_on ??= gap.dependency && gap.dependency !== 'none' ? [gap.dependency] : [];
        });
        if (Array.isArray(output.questions)) {
            output.questions.forEach((question, index) => {
                question.decision_key ??= gaps[index]?.decision_key || `fixture:question_${index}`;
                question.depends_on ??= [];
                question.allow_free_input ??= true;
                if (Array.isArray(question.options)) {
                    question.options.forEach((option, optionIndex) => {
                        option.key ??= `opt_${optionIndex + 1}`;
                    });
                    question.recommended_option_key ??= question.options[0]?.key;
                }
            });
        }
        return output;
    }
}
//# sourceMappingURL=MockAIProvider.js.map