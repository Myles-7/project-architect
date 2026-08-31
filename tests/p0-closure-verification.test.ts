import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ProjectStateEngine,
  FileStorage,
  QuestionBatchPolicy,
  readinessProjection,
  DocumentRenderer,
} from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import { DiscoveryJobManager } from '../apps/server/src/DiscoveryJobManager.js';
import type {
  DiscoveryResult,
  QuestionItem,
  QuestionRef,
} from '@project-architect/contracts';
import { CANONICAL_B3_AREAS } from '@project-architect/contracts';

describe('P0 Closure Verification Suite (All 6 P0 Issues Addressed)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let jobManager: DiscoveryJobManager;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-p0-verify-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
    jobManager = new DiscoveryJobManager(orchestrator, (p) => stateEngine.getSnapshot(p));
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // P0-1: All AI Discovery Runs As Background Job With User Message & Cancel
  // ==========================================================================
  it('P0-1: Schedules asynchronous discovery job with userMessage and supports non-blocking cancellation', async () => {
    const projectPath = join(tempBaseDir, 'p0-job');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Async Background Project',
      idea: 'Testing non-blocking background discovery execution',
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['Async Background Project'],
      candidates: ['Fast PostgreSQL database storage'],
      assumptions: ['Runs in Docker container'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };
    mockProvider.setMockResponse(mockOutput);

    // Schedule job with userMessage
    const jobView = await jobManager.schedule(
      s0.metadata.projectId,
      projectPath,
      s0.metadata.stateRevision,
      'User requested background optimization'
    );
    expect(jobView.status).toBe('queued');
    expect(jobView.sourceRevision).toBe(s0.metadata.stateRevision);

    // Cancel job
    const cancelledView = jobManager.cancel(s0.metadata.projectId);
    expect(cancelledView.status).toBe('cancelled');
  });

  // ==========================================================================
  // P0-2: Question Answering Semantic Safety & Answer-As-Assumption Channel
  // ==========================================================================
  it('P0-2: Degrades uncertain answers safely into Assumptions without creating Confirmed/Locked decisions', async () => {
    const projectPath = join(tempBaseDir, 'p0-assumption');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Question Semantics Project',
      idea: 'Testing safe fallback to assumptions',
    });

    // Populate question
    const q1: QuestionItem = {
      id: 'q-sync-policy',
      issueRef: 'gap:gap-01' as any,
      area: 'technical_boundary',
      decisionKey: 'technical_boundary:sync_transport',
      dependsOn: [],
      importance: 'high',
      question: 'Should synchronization be real-time WebSocket or polling?',
      reason: 'Architecture depends on sync model',
      recommendation: 'WebSocket streaming',
      recommendationReason: 'Low latency push',
      recommendedOptionKey: 'opt-ws',
      options: [
        {
          key: 'opt-ws',
          label: 'WebSocket streaming',
          gain: 'Real-time updates without polling overhead',
          sacrifice: 'Requires stateful connection management',
          impact: 'High complexity in connection recovery',
          reversibility: 'moderate',
        },
        {
          key: 'opt-poll',
          label: 'HTTP polling',
          gain: 'Stateless and simple to scale',
          sacrifice: 'Higher network traffic and latency',
          impact: 'Simpler client recovery',
          reversibility: 'easy',
        },
      ],
      allowFreeInput: true,
      status: 'shown',
      createdAt: new Date().toISOString(),
    };

    // Populate question via state engine
    const seeded = await stateEngine.applyDiscoveryTurn(
      projectPath,
      {
        confirmed: [],
        candidates: [],
        assumptions: [],
        unknowns: [],
        risks: [],
        conflicts: [],
        tensions: [],
        gaps: [],
        questions: [q1],
      },
      s0.metadata.stateRevision
    );

    const questionItem = seeded.questions.items[0]!;
    expect(questionItem).toBeDefined();

    // User chooses "I am not sure, keep recommendation as an Assumption"
    const { assumptionRef, snapshot: updated } = await stateEngine.answerQuestionAsAssumption(
      projectPath,
      `question:${questionItem.id}` as QuestionRef,
      'WebSocket streaming as initial assumed transport',
      seeded.metadata.stateRevision,
      'User selected provisional assumption from recommendation'
    );

    expect(assumptionRef).toContain('assumption:');

    // Verify Question is marked answered with [Assumption] tag
    const answeredQ = updated.questions.items.find((q) => q.id === questionItem.id);
    expect(answeredQ?.status).toBe('answered');
    expect(answeredQ?.answer).toContain('[Assumption]');

    // Verify AssumptionItem was created
    const createdAsm = updated.assumptions.items.find((a) =>
      a.statement.includes('WebSocket streaming as initial assumed transport')
    );
    expect(createdAsm).toBeDefined();
    expect(createdAsm?.status).toBe('active');
    expect(createdAsm?.area).toBe('technical_boundary');
    expect(createdAsm?.decisionKey).toBe('technical_boundary:sync_transport');

    // CRITICAL: Verify NO Confirmed or Locked Decision was created for this answer!
    const illegitimateDecision = updated.decisions.items.find((d) =>
      d.statement.includes('WebSocket streaming')
    );
    expect(illegitimateDecision).toBeUndefined();
  });

  // ==========================================================================
  // P0-3: Batch Integrity & QuestionBatchPolicy.getBatchInfo
  // ==========================================================================
  it('P0-3: Accurately tracks batch info and does not allow partial answers to drop unfinished questions', async () => {
    const projectPath = join(tempBaseDir, 'p0-batch');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Batch Integrity Project',
      idea: 'Testing batch tracking',
    });

    const batchPolicy = new QuestionBatchPolicy();

    // Create 3 questions in batch-01
    s0.questions.items = [
      {
        id: 'q-b1-1',
        batchId: 'batch-01',
        issueRef: 'gap:g1' as any,
        importance: 'high',
        question: 'Q1',
        reason: 'R1',
        recommendation: 'Rec1',
        recommendationReason: 'RR1',
        options: [],
        allowFreeInput: true,
        status: 'answered',
        answer: 'Ans1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q-b1-2',
        batchId: 'batch-01',
        issueRef: 'gap:g2' as any,
        importance: 'high',
        question: 'Q2',
        reason: 'R2',
        recommendation: 'Rec2',
        recommendationReason: 'RR2',
        options: [],
        allowFreeInput: true,
        status: 'shown',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q-b1-3',
        batchId: 'batch-01',
        issueRef: 'gap:g3' as any,
        importance: 'high',
        question: 'Q3',
        reason: 'R3',
        recommendation: 'Rec3',
        recommendationReason: 'RR3',
        options: [],
        allowFreeInput: true,
        status: 'shown',
        createdAt: new Date().toISOString(),
      },
    ];

    const batchInfo = batchPolicy.getBatchInfo(s0);
    expect(batchInfo.activeBatchId).toBe('batch-01');
    expect(batchInfo.totalQuestions).toBe(3);
    expect(batchInfo.answeredCount).toBe(1);
    expect(batchInfo.remainingCount).toBe(2);
    expect(batchInfo.isComplete).toBe(false);
  });

  // ==========================================================================
  // P0-4: Candidate Real Area Mapping (Never "discovery")
  // ==========================================================================
  it('P0-4: Ingests candidates into specific architecture/product areas instead of dumping into "discovery"', async () => {
    const projectPath = join(tempBaseDir, 'p0-candidate');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Candidate Mapping Project',
      idea: 'Testing candidate area inference and ingestion',
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['Candidate Mapping Project'],
      candidates: [
        'PostgreSQL database with async connection pool',
        'Enterprise engineering teams and system administrators',
        'Dark mode desktop application UI layout',
      ],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    const updated = await stateEngine.applyDiscoveryTurn(
      projectPath,
      mockOutput,
      s0.metadata.stateRevision
    );

    const candidates = updated.decisions.items.filter((d) => d.status === 'candidate');
    expect(candidates.length).toBe(3);

    // None should be in 'discovery'
    for (const c of candidates) {
      expect(c.area).not.toBe('discovery');
    }

    // Check specific inferences
    const dbCand = candidates.find((c) => c.statement.includes('PostgreSQL'));
    expect(dbCand?.area).toBe('technical_boundary');

    const userCand = candidates.find((c) => c.statement.includes('Enterprise engineering'));
    expect(userCand?.area).toBe('target_user');

    const uiCand = candidates.find((c) => c.statement.includes('Dark mode'));
    expect(uiCand?.area).toBe('ux_ui_direction');
  });

  // ==========================================================================
  // P0-5: Readiness 8-Area Alignment, BasisRevision Invalidation & Zero Bonus for Assumptions
  // ==========================================================================
  it('P0-5: Enforces 8 canonical areas, resets approval on state changes, and eliminates assumption score bonuses', async () => {
    const projectPath = join(tempBaseDir, 'p0-readiness');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Readiness Project',
      idea: 'Testing readiness invalidation',
    });

    // 1. Initial readiness requiredAreas contains 8 canonical areas
    expect(s0.readiness.current.requiredAreas).toEqual(expect.arrayContaining([...CANONICAL_B3_AREAS]));
    expect(s0.readiness.current.basisRevision).toBe(1);

    // 2. Add an assumption and verify projection does NOT award arbitrary 10 points
    s0.assumptions.items.push({
      id: 'asm-test',
      statement: 'Assumed low latency network',
      reason: 'Standard local network',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    const proj1 = readinessProjection(s0);

    // Score without assumptions vs with assumptions
    const s0NoAsm = JSON.parse(JSON.stringify(s0));
    s0NoAsm.assumptions.items = [];
    const projNoAsm = readinessProjection(s0NoAsm);

    // Active assumptions must NEVER raise the readiness score!
    expect(proj1.score).toBeLessThanOrEqual(projNoAsm.score);

    // 3. Stale Approval Invalidation: User approves with acknowledged issues on rev 1
    const openGaps = s0.gaps.gaps.filter((g) => g.status === 'open');
    await stateEngine.setUserDisposition(
      projectPath,
      'approved-with-known-issues',
      1,
      { knownIssues: openGaps.map((g) => `gap:${g.id}`) }
    );
    const snapApproved = await stateEngine.getSnapshot(projectPath);
    expect(snapApproved.readiness.current.userDisposition).toBe('approved-with-known-issues');
    expect(snapApproved.readiness.current.basisRevision).toBe(1);

    // Next, mutate project with a new decision (current revision is 2, becomes 3)
    const snapMutated = await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Enterprise platform engineers',
      snapApproved.metadata.stateRevision,
      'confirmed'
    );
    expect(snapMutated.metadata.stateRevision).toBe(3);

    // Re-evaluate readiness on revision 3
    const reevaluated = await stateEngine.evaluateReadiness(projectPath, 3);

    // The user disposition must be automatically reset to 'pending' because project was mutated after approval!
    expect(reevaluated.readiness.current.userDisposition).toBe('pending');
    expect(reevaluated.readiness.current.basisRevision).toBe(3);
  });

  // ==========================================================================
  // P0-6: Evidence-Based Acceptance Criteria DoD Generation
  // ==========================================================================
  it('P0-6: Renders evidence-based Acceptance criteria derived from user flows and locked boundaries', async () => {
    const renderer = new DocumentRenderer();
    const snapshot: any = {
      metadata: {
        name: 'DoD Test App',
        stateRevision: 3,
        projectTags: ['Web', 'Cloud'],
      },
      overview: { sections: [] },
      decisions: {
        items: [
          {
            id: 'dec-flow-1',
            area: 'user_flows',
            statement: 'User uploads CSV and sees summary report table',
            status: 'confirmed',
            origin: 'user',
          },
          {
            id: 'dec-lock-1',
            area: 'technical_boundary',
            statement: 'Zero external cloud telemetry',
            status: 'locked',
            origin: 'user',
          },
        ],
      },
      assumptions: { items: [] },
      gaps: { conflicts: [], gaps: [] },
      risks: { items: [] },
    };

    const rendered = await renderer.renderDocument(
      { path: 'docs/ACCEPTANCE.md', type: 'acceptance', title: 'Acceptance Criteria' },
      snapshot
    );

    // Verifies categorized DoD sections instead of flat mechanical output
    expect(rendered).toContain('#### 核心端到端功能验收 (Core User Journey Verification)');
    expect(rendered).toContain('User uploads CSV and sees summary report table');
    expect(rendered).toContain('*(Source: Decision dec-flow-1)*');

    expect(rendered).toContain('#### 架构与安全底线验证 (Architecture & Boundary Compliance)');
    expect(rendered).toContain('Zero external cloud telemetry');
    expect(rendered).toContain('*(Source: Decision dec-lock-1)*');
  });
});
