import type { AIProvider } from './AIProvider.js';
import type { AIProviderRequest, StructuredResult, ProviderHealthView } from '@project-architect/contracts';
export declare class MockAIProvider implements AIProvider {
    readonly name = "mock-ai-provider";
    private mockResponses;
    private defaultResponse;
    constructor(defaultResponse?: unknown);
    setMockResponse(taskOrResponse: string | unknown, maybeResponse?: unknown): void;
    complete<T = unknown>(request: AIProviderRequest): Promise<StructuredResult<T>>;
    healthCheck(): Promise<ProviderHealthView>;
    /** Keeps legacy test fixtures concise while production providers remain bound to the strict B3 schema. */
    private normalizeB3Fixture;
}
//# sourceMappingURL=MockAIProvider.d.ts.map