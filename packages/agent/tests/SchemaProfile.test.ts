import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaResolver } from '../src/schemas/SchemaResolver.js';
import { FileStorage } from '@project-architect/core';
import type { AgentMode } from '@project-architect/contracts';

describe('Schema Profile System Unit Tests (Phase 3.5.2)', () => {
  let schemaResolver: SchemaResolver;
  let storage: FileStorage;

  beforeEach(() => {
    storage = new FileStorage();
    schemaResolver = new SchemaResolver(process.cwd(), storage);
  });

  const modes: AgentMode[] = [
    'idea-analysis',
    'gap-analysis',
    'question-generation',
    'decision-review',
    'readiness-review',
    'document-compile',
  ];

  it('1. Resolves valid schema path for all 6 AgentModes', async () => {
    for (const mode of modes) {
      const schemaPath = await schemaResolver.resolveSchemaPath(mode);
      expect(schemaPath).toBeDefined();
      expect(await storage.exists(schemaPath)).toBe(true);

      const content = await storage.readText(schemaPath);
      const parsed = JSON.parse(content);
      expect(parsed.$schema).toBeDefined();
      expect(parsed.properties).toBeDefined();
      expect(parsed.title).toBe('B3 Planning task result');
      expect(parsed.properties.summary).toBeDefined();
      expect(parsed.properties.groups).toBeDefined();
      expect(parsed.properties.questions).toBeDefined();
      expect(parsed.properties.evidence).toBeDefined();
      expect(parsed.properties.blockers).toBeDefined();
      expect(parsed.properties.followUp).toBeDefined();
      expect(parsed.properties.clarification).toBeDefined();
      expect(parsed.properties.confirmed).toBeUndefined();
      expect(parsed.properties.candidates).toBeUndefined();
    }
  });

  it('2. Always resolves the active B3 schema for unknown modes', async () => {
    const fallbackPath = await schemaResolver.resolveSchemaPath('unknown-mode' as any);
    expect(fallbackPath).toContain('b3-discovery.schema.json');
  });
});
