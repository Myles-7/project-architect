export class AgentRuntimeRegistry {
    profiles;
    constructor() {
        this.profiles = new Map([
            [
                'idea-analysis',
                {
                    mode: 'idea-analysis',
                    promptProfile: 'idea-analysis',
                    schemaProfile: 'b3-discovery',
                    contextProfile: 'idea-analysis',
                    policyProfile: 'default',
                    task: 'discovery-turn',
                },
            ],
            [
                'gap-analysis',
                {
                    mode: 'gap-analysis',
                    promptProfile: 'gap-analysis',
                    schemaProfile: 'b3-discovery',
                    contextProfile: 'gap-analysis',
                    policyProfile: 'default',
                    task: 'discovery-turn',
                },
            ],
            [
                'question-generation',
                {
                    mode: 'question-generation',
                    promptProfile: 'question-generation',
                    schemaProfile: 'b3-discovery',
                    contextProfile: 'question-generation',
                    policyProfile: 'question-budget',
                    task: 'discovery-turn',
                },
            ],
            [
                'decision-review',
                {
                    mode: 'decision-review',
                    promptProfile: 'decision-review',
                    schemaProfile: 'b3-discovery',
                    contextProfile: 'decision-review',
                    policyProfile: 'impact-conflict',
                    task: 'discovery-turn',
                },
            ],
            [
                'readiness-review',
                {
                    mode: 'readiness-review',
                    promptProfile: 'readiness-review',
                    schemaProfile: 'b3-discovery',
                    contextProfile: 'readiness-review',
                    policyProfile: 'readiness-gate',
                    task: 'discovery-turn',
                },
            ],
            [
                'document-compile',
                {
                    mode: 'document-compile',
                    promptProfile: 'document-compile',
                    schemaProfile: 'b3-discovery',
                    contextProfile: 'document-compile',
                    policyProfile: 'compile-strict',
                    task: 'discovery-turn',
                },
            ],
        ]);
    }
    /**
     * Retrieves the runtime profile bundle for an active AgentMode.
     */
    getProfile(mode) {
        return (this.profiles.get(mode) || {
            mode,
            promptProfile: 'gap-analysis',
            schemaProfile: 'b3-discovery',
            contextProfile: 'gap-analysis',
            policyProfile: 'default',
            task: 'discovery-turn',
        });
    }
}
//# sourceMappingURL=AgentRuntimeRegistry.js.map