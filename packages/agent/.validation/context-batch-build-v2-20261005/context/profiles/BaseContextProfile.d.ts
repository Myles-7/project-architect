import type { ProjectSnapshot, MergedChecklistHint, AppRuntimeConfig } from '@project-architect/contracts';
export interface ContextProfilePayload {
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
export declare abstract class BaseContextProfile {
    protected config: AppRuntimeConfig;
    constructor(config?: AppRuntimeConfig);
    abstract build(snapshot: ProjectSnapshot, payload: ContextProfilePayload): string;
    protected renderProjectHeader(snapshot: ProjectSnapshot, modeName: string): string;
    protected renderDecisions(snapshot: ProjectSnapshot): string;
    protected renderUserInput(payload: ContextProfilePayload): string;
    protected truncateToBudget(text: string, maxChars?: number): string;
}
//# sourceMappingURL=BaseContextProfile.d.ts.map