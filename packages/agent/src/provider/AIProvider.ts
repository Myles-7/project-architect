import type { AIProviderRequest, StructuredResult } from '@project-architect/contracts';

export interface AIProvider {
  readonly name: string;
  complete<T = unknown>(request: AIProviderRequest): Promise<StructuredResult<T>>;
}
