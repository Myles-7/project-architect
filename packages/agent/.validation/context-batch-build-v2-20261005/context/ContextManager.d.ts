import type { ProjectSnapshot, MergedChecklistHint, AppRuntimeConfig, AgentMode } from '@project-architect/contracts';
export interface DiscoveryContextPayload {
    userMessage?: string;
    questionAnswer?: {
        questionRef: string;
        selectedOption?: string;
        freeInput?: string;
    };
    checklistHints?: MergedChecklistHint[];
    inputMaterials?: Array<{
        label: string;
        text: string;
    }>;
}
export declare class ContextManager {
    private config;
    private profiles;
    constructor(config?: AppRuntimeConfig);
    getConfig(): AppRuntimeConfig;
    /**
     * Assembles a compact, high-relevance Markdown text context for a specific AgentMode.
     */
    buildContextForMode(mode: AgentMode, snapshot: ProjectSnapshot, payload: DiscoveryContextPayload): string;
    /**
     * Backwards-compatible discovery context builder.
     */
    buildDiscoveryContext(snapshot: ProjectSnapshot, payload: DiscoveryContextPayload, mode?: AgentMode): string;
    /**
     * Computes a structured Token & Context budget distribution breakdown for diagnostics.
     */
    getContextDiagnostics(snapshot: ProjectSnapshot, inputMaterials?: Array<{
        id: string;
        label: string;
        text: string;
        isExcluded?: boolean;
    }>): import('@project-architect/contracts').ContextDiagnosticsView;
}
//# sourceMappingURL=ContextManager.d.ts.map