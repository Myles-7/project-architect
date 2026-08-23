import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AIOrchestrator } from '../src/orchestrator/AIOrchestrator.js';
import { MockAIProvider } from '../src/provider/MockAIProvider.js';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';

describe('AIOrchestrator & Agent Layer Tests', () => {
  let engine: ProjectStateEngine;
  let orchestrator: AIOrchestrator;
  let mockProvider: MockAIProvider;
  let testProjectDir: string;
  const storage = new FileStorage();

  beforeEach(async () => {
    engine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);
    testProjectDir = join(tmpdir(), `pa-agent-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('runs discovery-turn and updates project state with candidates, assumptions, and questions', async () => {
    await engine.createProject({
      name: 'Agent Test Project',
      idea: 'A markdown note taker for developers',
      projectTags: ['Desktop App', 'Developer Tool'],
      projectPath: testProjectDir,
    });

    const response = await orchestrator.runDiscoveryTurn(testProjectDir, {
      userMessage: 'I want to focus on keyboard-driven note search',
      expectedRevision: 1,
    });

    expect(response.discoveryResult).toBeDefined();
    expect(response.snapshot.metadata.stateRevision).toBe(2);
    expect(response.snapshot.metadata.stage).toBe('broad-pass');
    expect(response.snapshot.questions.items.length).toBeGreaterThan(0);
    expect(response.snapshot.decisions.items.some((d) => d.status === 'candidate')).toBe(true);
    expect(response.snapshot.assumptions.items.some((a) => a.status === 'active')).toBe(true);
  });

  it('persists a user question answer as a decision trace before the single discovery call', async () => {
    const created = await engine.createProject({
      name: 'Trace integration project',
      idea: 'A focused planning tool',
      projectPath: testProjectDir,
    });
    const withQuestion = await engine.applyIntegratedDiscoveryTurn(testProjectDir, {
      discoveryResult: { confirmed: [], candidates: [], assumptions: [], unknowns: [], risks: [], conflicts: [], tensions: [], gaps: [], questions: [] },
      prioritizedGaps: [{
        id: 'gap-user', area: 'target_user', severity: 'high', reason: 'Target user is unclear',
        impact: 'The MVP lacks a focus.', dependency: 'none', shouldAskUser: true, status: 'open',
      }],
      questions: [{
        id: 'q-user', issueRef: 'gap:gap-user', importance: 'high', question: 'Who is the first user?',
        reason: 'The first workflow depends on it.', recommendation: 'Start narrow.',
        recommendationReason: 'A narrow MVP is testable.', options: [], allowFreeInput: true, status: 'shown', createdAt: '',
      }],
      autoAssumptions: [], newCandidates: [], newAssumptions: [], newConflicts: [],
    }, created.snapshot.metadata.stateRevision);

    const response = await orchestrator.runDiscoveryTurn(testProjectDir, {
      questionAnswer: { questionRef: 'question:q-user', freeInput: 'Independent developers' },
      expectedRevision: withQuestion.metadata.stateRevision,
    });

    expect(response.snapshot.decisions.traces?.at(-1)).toMatchObject({
      questionRef: 'question:q-user',
      userAnswer: 'Independent developers',
    });
  });
});
