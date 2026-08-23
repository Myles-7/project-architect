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
      expect(parsed.properties.confirmed).toBeDefined();
      expect(parsed.properties.candidates).toBeDefined();
      expect(parsed.properties.questions).toBeDefined();
      expect(parsed.properties.gaps).toBeDefined();
    }
  });

  it('2. Falls back to b2-unified schema if unknown mode is requested', async () => {
    const fallbackPath = await schemaResolver.resolveSchemaPath('unknown-mode' as any);
    expect(fallbackPath).toContain('b2-unified.schema.json');
  });
});
