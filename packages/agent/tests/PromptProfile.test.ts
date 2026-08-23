import { describe, it, expect, beforeEach } from 'vitest';
import { PromptLoader } from '../src/prompts/PromptLoader.js';
import type { AgentMode } from '@project-architect/contracts';

describe('Prompt Profile System Unit Tests (Phase 3.5.1)', () => {
  let promptLoader: PromptLoader;

  beforeEach(() => {
    promptLoader = new PromptLoader(process.cwd());
  });

  const modes: AgentMode[] = [
    'idea-analysis',
    'gap-analysis',
    'question-generation',
    'decision-review',
    'readiness-review',
    'document-compile',
  ];

  it('1. Successfully loads prompt profiles for all 6 AgentModes', async () => {
    for (const mode of modes) {
      const profile = await promptLoader.loadPromptProfile(mode);
      expect(profile.mode).toBe(mode);
      expect(profile.taskInstruction).toBeDefined();
      expect(profile.taskInstruction.length).toBeGreaterThan(50);
      expect(profile.systemPrompt).toBeDefined();
      expect(profile.b2Rules.length).toBeGreaterThan(0);
    }
  });

  it('2. Mode prompts contain specialized instructions matching their purpose', async () => {
    const ideaProfile = await promptLoader.loadPromptProfile('idea-analysis');
    expect(ideaProfile.taskInstruction).toContain('Idea Analysis');
    expect(ideaProfile.taskInstruction).toContain('Capability Before Mechanism');

    const gapProfile = await promptLoader.loadPromptProfile('gap-analysis');
    expect(gapProfile.taskInstruction).toContain('Gap Analysis');
    expect(gapProfile.taskInstruction).toContain('Product First');

    const qProfile = await promptLoader.loadPromptProfile('question-generation');
    expect(qProfile.taskInstruction).toContain('Question Generation');
    expect(qProfile.taskInstruction).toContain('Strict Question Budget');

    const decProfile = await promptLoader.loadPromptProfile('decision-review');
    expect(decProfile.taskInstruction).toContain('Decision Review');
    expect(decProfile.taskInstruction).toContain('Locked Decision Protection');

    const readProfile = await promptLoader.loadPromptProfile('readiness-review');
    expect(readProfile.taskInstruction).toContain('Readiness Review');

    const docProfile = await promptLoader.loadPromptProfile('document-compile');
    expect(docProfile.taskInstruction).toContain('Document Compilation');
  });

  it('3. buildPromptText combines system prompt and mode task instructions cleanly', async () => {
    const promptText = await promptLoader.buildPromptText('question-generation');
    expect(promptText).toContain('Constitution');
    expect(promptText).toContain('Question Generation');
  });
});
