import { describe, it, expect } from 'vitest';
import { PROJECT_TEMPLATES } from '../src/features/home/ProjectTemplates.js';

describe('ProjectTemplates: Inspiration Presets Configuration', () => {
  it('1. Provides predefined typical architecture templates with non-empty metadata', () => {
    expect(PROJECT_TEMPLATES.length).toBeGreaterThanOrEqual(4);

    for (const tmpl of PROJECT_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.badge).toBeTruthy();
      expect(tmpl.defaultProjectName).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.ideaPrompt).toBeTruthy();
      expect(tmpl.ideaPrompt.length).toBeGreaterThan(20);
    }
  });

  it('2. Includes essential archetypes: CLI, Local Desktop, Web SaaS, Browser Extension', () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('cli-tool');
    expect(ids).toContain('local-desktop');
    expect(ids).toContain('web-saas');
    expect(ids).toContain('browser-extension');
    expect(ids).toContain('ai-agent-workflow');
  });

  it('3. Every template contains structured goal and constraint sections in its ideaPrompt', () => {
    for (const tmpl of PROJECT_TEMPLATES) {
      expect(tmpl.ideaPrompt).toMatch(/核心目标/);
      expect(tmpl.ideaPrompt).toMatch(/核心约束/);
    }
  });
});
