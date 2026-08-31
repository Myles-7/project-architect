import { describe, expect, it } from 'vitest';
import {
  describeContextDestination,
  describeInferenceLocation,
  describePromptCache,
  describeStructuredOutput,
} from '../src/features/settings/ProviderDiagnosticsPanel.js';

describe('Provider diagnostics truthfulness', () => {
  it('does not present unknown capabilities or data destinations as verified', () => {
    expect(describeInferenceLocation('unknown')).toBe('无法确认');
    expect(describeContextDestination('unknown')).toBe('无法确认');
    expect(describeStructuredOutput('unknown')).toBe('尚未确认');
    expect(describePromptCache('unknown')).toBe('尚未确认');
  });

  it('distinguishes observed cache use from declared support', () => {
    expect(describePromptCache('observed')).toBe('已观测到缓存命中');
    expect(describePromptCache('supported')).toBe('Provider 声明支持');
    expect(describePromptCache('unsupported')).toBe('Provider 不支持');
  });
});
