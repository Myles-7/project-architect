import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult, AgentRunTrace } from '@project-architect/contracts';

describe('Workflow Trace Persistence Unit Tests (Phase 3.5.4)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-trace-test-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Persists AgentRunTrace into runtime/agent-runs.json across multiple turns', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'proj-trace'),
      name: 'Trace Verification Project',
      idea: 'Testing AgentRunTrace logging',
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['Testing AgentRunTrace logging'],
      candidates: ['Initial candidate'],
      assumptions: ['Default setting'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'high',
          reason: 'Target user not set',
          impact: 'Scope unknown',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'high',
          question: 'Who is the user?',
          reason: 'Need user',
          recommendation: 'Developers',
          recommendation_reason: 'Simple',
          options: [
            { label: 'Developers', impact: 'Keeps the workflow technical and fast' },
            { label: 'General users', impact: 'Requires a simpler guided workflow' },
          ],
          allow_free_input: true,
        },
      ],
    };

    mockProvider.setMockResponse(mockOutput);

    // Turn 1
    const res1 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: 'First turn',
    });

    expect(res1.activeMode).toBe('idea-analysis');
    expect(res1.runTrace).toBeDefined();
    expect(res1.runTrace?.promptProfile).toBe('idea-analysis');
    expect(res1.runTrace?.schemaProfile).toBe('b3-discovery');
    expect(res1.runTrace?.contextProfile).toBe('idea-analysis');
    expect(res1.runTrace?.stateRevisionBefore).toBe(1);
    expect(res1.runTrace?.stateRevisionAfter).toBe(2);
    expect(res1.runTrace?.diagnostics?.cacheReadTokens).toBe(0);
    expect(res1.diagnostics.cacheReadTokens).toBe(0);

    // Turn 2
    const res2 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 2,
      userMessage: 'Second turn',
    });

    expect(res2.activeMode).toBe('question-generation');
    expect(res2.runTrace?.promptProfile).toBe('question-generation');
    expect(res2.runTrace?.stateRevisionBefore).toBe(2);
    expect(res2.runTrace?.stateRevisionAfter).toBe(3);

    // Verify trace file on disk
    const traceFilePath = join(projectPath, 'runtime', 'agent-runs.json');
    expect(await storage.exists(traceFilePath)).toBe(true);

    const traces = await storage.readJson<AgentRunTrace[]>(traceFilePath);
    expect(traces.length).toBe(2);
    expect(traces[0]?.mode).toBe('idea-analysis');
    expect(traces[1]?.mode).toBe('question-generation');
    expect(traces[0]?.provider).toBe(mockProvider.name);
    expect(traces[0]?.tokens).toBeDefined();
    expect(traces[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
