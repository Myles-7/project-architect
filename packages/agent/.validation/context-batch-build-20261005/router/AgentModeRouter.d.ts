import type { ProjectSnapshot, AgentMode, RunDiscoveryTurnRequest } from '@project-architect/contracts';
export interface RouteContext {
    snapshot: ProjectSnapshot;
    request: Omit<RunDiscoveryTurnRequest, 'projectId'>;
    explicitMode?: AgentMode;
}
export declare class AgentModeRouter {
    /**
     * Evaluates project state and user intent to determine the active AgentMode.
     */
    route(context: RouteContext): AgentMode;
}
//# sourceMappingURL=AgentModeRouter.d.ts.map