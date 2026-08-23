import type { AIProvider } from './AIProvider.js';
import type { AIProviderRequest, StructuredResult } from '@project-architect/contracts';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock-ai-provider';
  private mockResponses: Map<string, unknown> = new Map();
  private defaultResponse: unknown;

  constructor(defaultResponse?: unknown) {
    this.defaultResponse = defaultResponse || {
      confirmed: [],
      candidates: ['Mock Suggested candidate for desktop platform'],
      assumptions: ['Default setting is stored locally in JSON'],
      unknowns: [],
      risks: ['File permission might require elevation'],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'high',
          reason: 'Target user segment is not fully specified',
          impact: 'Core flow priority',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'high',
          question: 'What is the primary target user persona?',
          reason: 'Clarifies MVP boundary',
          recommendation: 'Individual developers and power users',
          recommendation_reason: 'Matches lightweight desktop requirement',
          options: [
            { label: 'Individual power users', impact: 'Focus on speed' },
            { label: 'General non-technical users', impact: 'Focus on simplicity' },
          ],
          allow_free_input: true,
        },
      ],
    };
  }

  setMockResponse(taskOrResponse: string | unknown, maybeResponse?: unknown): void {
    if (typeof taskOrResponse === 'string' && maybeResponse !== undefined) {
      this.mockResponses.set(taskOrResponse, maybeResponse);
    } else {
      this.defaultResponse = taskOrResponse;
      this.mockResponses.set('discovery-turn', taskOrResponse);
    }
  }

  async complete<T = unknown>(request: AIProviderRequest): Promise<StructuredResult<T>> {
    const output = (this.mockResponses.get(request.task) || this.defaultResponse) as T;
    if (output === null || output === undefined) {
      return {
        status: 'failed',
        structuredSuccess: false,
        structuredOutput: null,
        rawEnvelope: { mock: true, internal_leak: 'secret_envelope_content' },
        stderr: 'Mock provider failure triggered',
        exitCode: 1,
        durationMs: 10,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          thinkingTokens: 0,
          totalTokens: 0,
          cacheReadTokens: 0,
        },
        provider: this.name,
      };
    }
    return {
      status: 'success',
      structuredSuccess: true,
      structuredOutput: output,
      rawEnvelope: { mock: true, structured_output: output },
      stderr: null,
      exitCode: 0,
      durationMs: 150,
      usage: {
        inputTokens: 1200,
        outputTokens: 450,
        thinkingTokens: 1000,
        totalTokens: 2650,
        cacheReadTokens: 0,
      },
      provider: this.name,
    };
  }
}
