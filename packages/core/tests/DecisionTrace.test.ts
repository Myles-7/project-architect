import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage } from '../src/storage/FileStorage.js';
import { ProjectStateEngine } from '../src/engine/ProjectStateEngine.js';

describe('Decision trace', () => {
  const storage = new FileStorage();
  let projectPath: string;
  let engine: ProjectStateEngine;

  beforeEach(async () => {
    projectPath = join(tmpdir(), `pa-decision-trace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    engine = new ProjectStateEngine(storage);
    await engine.createProject({ name: 'Trace test', idea: 'A small planning tool', projectPath });
  });

  afterEach(async () => {
    await storage.remove(projectPath);
  });

  it('records the question, user answer, resulting decision, and affected state', async () => {
    const created = await engine.getSnapshot(projectPath);
    const withQuestion = await engine.applyIntegratedDiscoveryTurn(projectPath, {
      discoveryResult: { confirmed: [], candidates: [], assumptions: [], unknowns: [], risks: [], conflicts: [], tensions: [], gaps: [], questions: [] },
      prioritizedGaps: [{
        id: 'gap-user', area: 'target_user', severity: 'high', reason: 'Target user is unclear',
        impact: 'The MVP cannot be prioritised.', dependency: 'none', shouldAskUser: true, status: 'open',
      }],
      questions: [{
        id: 'q-user', issueRef: 'gap:gap-user', importance: 'high', question: 'Who is the first user?',
        reason: 'The MVP depends on it.', recommendation: 'Start with one clear user group.',
        recommendationReason: 'A narrow user makes the MVP testable.', options: [], allowFreeInput: true,
        status: 'shown', createdAt: '2026-08-23T00:00:00.000Z',
      }],
      autoAssumptions: [], newCandidates: [], newAssumptions: [], newConflicts: [], newRisks: [],
    }, created.metadata.stateRevision);

    expect(withQuestion.gaps.gaps.find((gap) => gap.id === 'gap-user')?.status).toBe('open');

    const result = await engine.answerQuestion(projectPath, 'question:q-user', 'Independent developers', withQuestion.metadata.stateRevision);

    expect(result.questions.items.find((item) => item.id === 'q-user')?.status).toBe('answered');
    const trace = result.decisions.traces.at(-1);
    expect(trace).toMatchObject({ questionRef: 'question:q-user', userAnswer: 'Independent developers' });
    expect(result.decisions.items.find((item) => item.id === trace?.decisionRef.slice('decision:'.length))?.confirmedBy).toBe('user');
    expect(trace?.stateChanges.some((change) => change.ref === 'gap:gap-user' && change.action === 'gap-addressed')).toBe(true);
  });
});
