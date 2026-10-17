import { FileStorage } from '@project-architect/core';
import type { AgentMode } from '@project-architect/contracts';
import type { PromptProfile } from './PromptProfile.js';
export declare class PromptLoader {
    private storage;
    private rootDir;
    private cachedProfiles;
    constructor(rootDir?: string, storage?: FileStorage);
    /**
     * Loads the specialized prompt profile for a given AgentMode.
     */
    loadPromptProfile(mode: AgentMode): Promise<PromptProfile>;
    /**
     * Combines constitution, mandatory runtime rules, and mode instruction into the final prompt text.
     */
    buildPromptText(mode: AgentMode): Promise<string>;
    private getFallbackInstruction;
}
//# sourceMappingURL=PromptLoader.d.ts.map