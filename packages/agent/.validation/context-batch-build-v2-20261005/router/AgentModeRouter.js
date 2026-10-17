export class AgentModeRouter {
    /**
     * Evaluates project state and user intent to determine the active AgentMode.
     */
    route(context) {
        const { snapshot, request, explicitMode } = context;
        // 1. Explicit mode requested by caller
        if (explicitMode) {
            return explicitMode;
        }
        const userMessage = (request.userMessage || '').toLowerCase();
        // 2. Explicit User Intent Triggers (Highest Priority after explicitMode)
        if ((userMessage.includes('生成') && userMessage.includes('文档')) ||
            (userMessage.includes('导出') && userMessage.includes('文档')) ||
            (userMessage.includes('编译') && userMessage.includes('文档')) ||
            userMessage.includes('compile document') ||
            userMessage.includes('generate doc')) {
            return 'document-compile';
        }
        if (userMessage.includes('准备度') ||
            userMessage.includes('开发准备') ||
            userMessage.includes('readiness') ||
            userMessage.includes('可以开始写代码了吗') ||
            userMessage.includes('是否就绪')) {
            return 'readiness-review';
        }
        if (userMessage.startsWith('修改') ||
            userMessage.startsWith('变更') ||
            userMessage.includes('改为') ||
            userMessage.includes('重新定义') ||
            userMessage.includes('modify') ||
            userMessage.includes('change decision')) {
            return 'decision-review';
        }
        // 3. Initial Turn / Brand new project -> idea-analysis
        if (snapshot.metadata.stage === 'created' && !request.questionAnswer) {
            return 'idea-analysis';
        }
        // 4. Question Answering or Critical/High Gaps -> question-generation
        const openCriticalHighGaps = snapshot.gaps.gaps.filter((g) => g.status === 'open' && (g.severity === 'critical' || g.severity === 'high'));
        if (request.questionAnswer || openCriticalHighGaps.length > 0) {
            return 'question-generation';
        }
        // 5. Existing project with open normal gaps -> gap-analysis
        if (snapshot.gaps.gaps.some((g) => g.status === 'open')) {
            return 'gap-analysis';
        }
        // 6. Project is mature with no open gaps -> readiness-review
        if (snapshot.metadata.stage === 'broad-pass' && openCriticalHighGaps.length === 0) {
            return 'readiness-review';
        }
        return 'gap-analysis';
    }
}
//# sourceMappingURL=AgentModeRouter.js.map