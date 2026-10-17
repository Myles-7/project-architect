import type { AgentMode } from '@project-architect/contracts';
export interface PromptProfile {
    mode: AgentMode;
    systemPrompt: string;
    taskInstruction: string;
    mandatoryRules: string[];
}
//# sourceMappingURL=PromptProfile.d.ts.map