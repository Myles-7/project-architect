import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRuntimeRegistry } from '../src/runtime/AgentRuntimeRegistry.js';
import type { AgentMode } from '@project-architect/contracts';

describe('Agent Runtime Profile Registry Unit Tests (Phase 3.5.3)', () => {
  let registry: AgentRuntimeRegistry;

  beforeEach(() => {
    registry = new AgentRuntimeRegistry();
  });

  const modes: AgentMode[] = [
    'idea-analysis',
    'gap-analysis',
    'question-generation',
    'decision-review',
    'readiness-review',
    'document-compile',
  ];

  it('1. Returns complete runtime profile bundle for all 6 AgentModes', () => {
    for (const mode of modes) {
      const profile = registry.getProfile(mode);
      expect(profile.mode).toBe(mode);
      expect(profile.promptProfile).toBeDefined();
      expect(profile.schemaProfile).toBeDefined();
      expect(profile.contextProfile).toBeDefined();
      expect(profile.policyProfile).toBeDefined();
      expect(profile.task).toBe('discovery-turn');
    }
  });

  it('2. Returns specialized profiles tailored to specific mode needs', () => {
    const qProf = registry.getProfile('question-generation');
    expect(qProf.policyProfile).toBe('question-budget');

    const decProf = registry.getProfile('decision-review');
    expect(decProf.policyProfile).toBe('impact-conflict');

    const readyProf = registry.getProfile('readiness-review');
    expect(readyProf.policyProfile).toBe('readiness-gate');
  });
});
