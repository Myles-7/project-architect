import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIOrchestrator } from '../src/orchestrator/AIOrchestrator.js';
import { MockAIProvider } from '../src/provider/MockAIProvider.js';
import { PromptLoader } from '../src/prompts/PromptLoader.js';
import { SchemaResolver } from '../src/schemas/SchemaResolver.js';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Phase 4.8.5 Reliability Hardening: Frozen B2.1 Runtime & Output Gate', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let promptLoader: PromptLoader;
  let schemaResolver: SchemaResolver;
  let projectPath: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-hardening-485-'));
    projectPath = join(tempBaseDir, 'b2-test-project');
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    promptLoader = new PromptLoader(process.cwd(), storage);
    schemaResolver = new SchemaResolver(process.cwd());
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Constitution & Prompt Integrity: Final Prompt strictly includes frozen B2.1 constitution and mandatory rules', async () => {
    const promptText = await promptLoader.buildPromptText('broad-pass');

    // Must contain core sections of frozen constitution
    expect(promptText).toContain('Project Architect Constitution — B2.1 Final Candidate');
    expect(promptText).toContain('Capability Before Mechanism — Strict Discovery Gate');
    expect(promptText).toContain('Evidence and Assumption Governance');
    expect(promptText).toContain('Conflict Strict Mode');

    // Must contain injected mandatory runtime rules
    expect(promptText).toContain('Mandatory B2.1 Rules');
    expect(promptText).toContain('Single Agent Runtime: Single primary provider call per turn');
    expect(promptText).toContain('User Authorization SSOT: Only user confirmation makes facts authoritative');
  });

  it('2. Unified Schema: SchemaResolver always resolves strictly to b2-unified.schema.json', async () => {
    const modes = ['broad-pass', 'deep-dive', 'quick-clarification', 'assumption-challenge'] as const;
    for (const mode of modes) {
      const resolvedPath = await schemaResolver.resolveSchemaPath(mode);
      expect(resolvedPath.replace(/\\/g, '/')).toContain('experiments/agent-benchmark/schemas/b2-unified.schema.json');
    }
  });

  it('3. Output Validation Gate: Invalid, missing fields, or wrong enums are strictly rejected without state pollution', () => {
    // A. Missing required array fields
    expect(() =>
      orchestrator.validateOutput({
        requestId: 'r1',
        provider: 'mock',
        durationMs: 10,
        status: 'success',
        structuredSuccess: true,
        structuredOutput: {
          confirmed: ['App'],
          candidates: [],
          // missing assumptions, unknowns, risks, gaps, conflicts, tensions, questions
        } as any,
      })
    ).toThrow(/required array field/);

    // B. Invalid Gap severity enum
    expect(() =>
      orchestrator.validateOutput({
        requestId: 'r2',
        provider: 'mock',
        durationMs: 10,
        status: 'success',
        structuredSuccess: true,
        structuredOutput: {
          confirmed: [],
          candidates: [],
          assumptions: [],
          unknowns: [],
          risks: [],
          conflicts: [],
          tensions: [],
          questions: [],
          gaps: [
            {
              area: 'mvp',
              severity: 'extreme', // Invalid enum
              reason: 'bad',
              impact: 'high',
              dependency: 'none',
              should_ask_user: true,
            },
          ] as any,
        },
      })
    ).toThrow(/gap items must follow schema/);

    // C. Invalid Question importance enum or invalid types
    expect(() =>
      orchestrator.validateOutput({
        requestId: 'r3',
        provider: 'mock',
        durationMs: 10,
        status: 'success',
        structuredSuccess: true,
        structuredOutput: {
          confirmed: [],
          candidates: [],
          assumptions: [],
          unknowns: [],
          risks: [],
          conflicts: [],
          tensions: [],
          gaps: [],
          questions: [
            {
              importance: 'urgent', // Invalid enum
              question: 'Who are users?',
              reason: 'clarity',
              recommendation: 'Engineers',
              recommendation_reason: 'common',
              options: [{ label: 'Eng', impact: 'high' }],
              allow_free_input: true,
            },
          ] as any,
        },
      })
    ).toThrow(/question items must follow schema/);
  });

  it('4. State Protection: When provider output fails validation, stateRevision remains unchanged', async () => {
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Resilient Project',
      idea: 'Testing state safety against bad provider output',
    });
    const revBefore = s0.metadata.stateRevision;

    // Simulate provider returning malformed output missing questions
    mockProvider.setMockResponse({
      confirmed: ['App'],
      candidates: [],
      // missing questions
    } as any);

    await expect(
      orchestrator.runDiscoveryTurn(projectPath, {
        userMessage: 'Explore features',
        expectedRevision: revBefore,
      })
    ).rejects.toThrow();

    // Verify snapshot stateRevision is unchanged
    const snapAfter = await stateEngine.getSnapshot(projectPath);
    expect(snapAfter.metadata.stateRevision).toBe(revBefore);
  });

  it('5. Single Provider Call: Exactly one primary provider call is made per discovery turn', async () => {
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Single Call Project',
      idea: 'Strict single turn verification',
    });

    const validB2Output: DiscoveryResult = {
      confirmed: ['Single Call Project'],
      candidates: ['CLI interface'],
      assumptions: ['Local execution'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };
    mockProvider.setMockResponse(validB2Output);

    const spy = vi.spyOn(mockProvider, 'complete');

    await orchestrator.runDiscoveryTurn(projectPath, {
      userMessage: 'Let us begin discovery',
      expectedRevision: s0.metadata.stateRevision,
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
