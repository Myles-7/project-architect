import type { AIProvider } from './AIProvider.js';
import { type AIProviderRequest, type StructuredResult, type ProviderHealthView } from '@project-architect/contracts';
export declare const PLANNING_MODELS: {
    readonly design: "claude-opus-4-6-thinking";
    readonly research: "gemini-3.1-pro-high";
};
/** Model-qualified Gemini effort conflicts with the CLI's generic max setting. */
export declare const planningReasoningEffort: (model: string) => AIProviderRequest["reasoningEffort"];
export declare const PLANNING_TOOL_NAMES: string[];
/** Headless worker: one registered invocation, no retries or free-text recovery. */
export declare class AntigravityCliProvider implements AIProvider {
    private cliExecutable;
    private maxBufferBytes;
    private cliPrefixArgs;
    readonly name = "antigravity-cli";
    private hasObservedPromptCache;
    private modelProbe?;
    constructor(cliExecutable?: string, maxBufferBytes?: number, cliPrefixArgs?: string[]);
    resolveEffectiveExecutable(): string;
    /** Actual installed catalog, without querying project material or changing model settings. */
    preflightModels(): Promise<{
        models: string[];
        error?: string;
    }>;
    private execute;
    complete<T = unknown>(request: AIProviderRequest): Promise<StructuredResult<T>>;
    private extractUsage;
    private emptyUsage;
    healthCheck(): Promise<ProviderHealthView>;
}
//# sourceMappingURL=AntigravityCliProvider.d.ts.map