import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIOrchestrator } from '../../packages/agent/src/orchestrator/AIOrchestrator.js';
import { MockAIProvider } from '../../packages/agent/src/provider/MockAIProvider.js';
import { PromptLoader } from '../../packages/agent/src/prompts/PromptLoader.js';
import { SchemaResolver } from '../../packages/agent/src/schemas/SchemaResolver.js';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Reliability Suite 4: Agent Runtime & B3 Contract Integrity', () => {
  let tempBaseDir: string;
  let projectPath: string;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let promptLoader: PromptLoader;
  let schemaResolver: SchemaResolver;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-rel-rt-'));
    projectPath = join(tempBaseDir, 'runtime-project');
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    promptLoader = new PromptLoader(process.cwd(), storage);
    schemaResolver = new SchemaResolver(process.cwd());
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);

    await engine.createProject({
      projectPath,
      name: 'Runtime Verification Project',
      idea: 'Strict B3 execution test',
    });
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Prompt Integrity: Final prompt includes B3 Constitution and mandatory runtime rules', async () => {
    const prompt = await promptLoader.buildPromptText('broad-pass');
    expect(prompt).toContain('Project Architect Constitution — B3 Adaptive Question Sets');
    expect(prompt).toContain('Capability Before Mechanism');
    expect(prompt).toContain('Strict Conflict Classification');
    expect(prompt).toContain('Mandatory B3 Rules');
  });

  it('2. Schema Strictness: SchemaResolver always maps to b3-discovery.schema.json across all modes', async () => {
    const modes = ['idea-analysis', 'gap-analysis', 'question-generation', 'decision-review'] as const;
    for (const mode of modes) {
      const p = await schemaResolver.resolveSchemaPath(mode as any);
      expect(p.replace(/\\/g, '/')).toContain('experiments/agent-benchmark/schemas/b3-discovery.schema.json');
    }
  });

  it('3. Structured Output Gate: Invalid output fails locally and prevents state revision advancement', async () => {
    const s0 = await engine.getSnapshot(projectPath);
    const revBefore = s0.metadata.stateRevision;

    // Set invalid response (missing questions array)
    mockProvider.setMockResponse({
      confirmed: [],
      candidates: ['Some idea'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      // missing questions
    } as any);

    await expect(
      orchestrator.runDiscoveryTurn(projectPath, {
        userMessage: 'Explore idea',
        expectedRevision: revBefore,
      })
    ).rejects.toThrow();

    const sAfter = await engine.getSnapshot(projectPath);
    expect(sAfter.metadata.stateRevision).toBe(revBefore);
  });

  it('4. Single Provider Call: Exactly one primary provider invocation per discovery turn', async () => {
    const s0 = await engine.getSnapshot(projectPath);
    const validOutput: DiscoveryResult = {
      confirmed: ['Verified idea'],
      candidates: ['Candidate feature'],
      assumptions: ['Reversible default'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };
    mockProvider.setMockResponse(validOutput);
    const completeSpy = vi.spyOn(mockProvider, 'complete');

    await orchestrator.runDiscoveryTurn(projectPath, {
      userMessage: 'Continue discovery',
      expectedRevision: s0.metadata.stateRevision,
    });

    expect(completeSpy).toHaveBeenCalledTimes(1);
  });
});
