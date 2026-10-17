import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStorage } from '@project-architect/core';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class PromptLoader {
    storage;
    rootDir;
    cachedProfiles = new Map();
    constructor(rootDir = process.cwd(), storage = new FileStorage()) {
        this.rootDir = rootDir;
        this.storage = storage;
    }
    /**
     * Loads the specialized prompt profile for a given AgentMode.
     */
    async loadPromptProfile(mode) {
        if (this.cachedProfiles.has(mode)) {
            return this.cachedProfiles.get(mode);
        }
        const profilePath = join(__dirname, 'profiles', `${mode}.md`);
        let taskInstruction = '';
        if (await this.storage.exists(profilePath)) {
            taskInstruction = await this.storage.readText(profilePath);
        }
        else {
            taskInstruction = this.getFallbackInstruction(mode);
        }
        const constitutionPath = join(this.rootDir, 'experiments', 'agent-benchmark', 'prompts', 'constitution-b3.md');
        let systemPrompt = '';
        if (await this.storage.exists(constitutionPath)) {
            systemPrompt = await this.storage.readText(constitutionPath);
        }
        else {
            throw new Error(`B3 constitution is missing at ${constitutionPath}`);
        }
        const mandatoryRules = [
            'Registered Planning Tasks: Multiple recorded provider calls and independent review are permitted; never delegate unregistered work.',
            'Capability Before Mechanism: Focus on product capabilities, not concrete frameworks/databases.',
            'User Authorization SSOT: Only user confirmation makes facts authoritative.',
            'Locked Decision Protection: Never overwrite locked decisions without explicit user intervention.',
            'B3 Adaptive Batch: At most three mutually independent questions with complete option tradeoffs.',
            'Stable Decision Keys: Every production question includes decisionKey and dependsOn; do not repeat answered topics without a changed requirement.',
        ];
        const profile = {
            mode,
            systemPrompt,
            taskInstruction,
            mandatoryRules,
        };
        this.cachedProfiles.set(mode, profile);
        return profile;
    }
    /**
     * Combines constitution, mandatory runtime rules, and mode instruction into the final prompt text.
     */
    async buildPromptText(mode) {
        const profile = await this.loadPromptProfile(mode);
        const rulesList = profile.mandatoryRules.map((r) => `- ${r}`).join('\n');
        return `${profile.systemPrompt}\n\n## Mandatory B3 Rules\n${rulesList}\n\n---\n\n${profile.taskInstruction}`;
    }
    getFallbackInstruction(mode) {
        return `# Mode Profile: ${mode}\nOperate strictly under the B3 Constitution for mode: ${mode}.`;
    }
}
//# sourceMappingURL=PromptLoader.js.map