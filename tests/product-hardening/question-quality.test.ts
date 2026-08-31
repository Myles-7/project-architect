import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import {
  ProjectStateEngine,
  WorkspaceGuard,
  FileStorage,
  QuestionComposer,
  projectDiscoveryProgressProjection,
} from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import { createApp } from '../../apps/server/src/server.js';
import type { GapItem } from '@project-architect/contracts';

describe('Product Hardening Phase 3: Question Quality & Batch Closed-Loop', () => {
  let tempBaseDir: string;
  let testProjectDir: string;
  let guard: WorkspaceGuard;
  let engine: ProjectStateEngine;
  let orchestrator: AIOrchestrator;
  let mockProvider: MockAIProvider;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-hardening-p3-'));
    guard = new WorkspaceGuard(tempBaseDir);
    testProjectDir = guard.resolveProjectPath('proj-p3-test');

    const storage = new FileStorage();
    engine = new ProjectStateEngine(storage, guard);

    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(engine, mockProvider);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Task 3.1: AIOrchestrator rejects recommended_option_key referencing non-existent option key', async () => {
    const invalidResult = {
      status: 'success' as const,
      structuredSuccess: true,
      rawEnvelope: {},
      structuredOutput: {
        confirmed: [],
        project_name: 'Test Project',
        project_tagline: 'Tagline',
        stage: 'initial-analysis' as const,
        tensions: [],
        unknowns: [],
        candidates: [],
        assumptions: [],
        risks: [],
        conflicts: [],
        gaps: [],
        questions: [
          {
            decision_key: 'univ-platform-choice',
            depends_on: [],
            importance: 'high' as const,
            question: '选择首发平台？',
            reason: '影响技术栈',
            recommendation: 'Windows 桌面',
            recommendation_reason: '单机离线可用',
            recommended_option_key: 'non_existent_key', // Invalid!
            options: [
              { key: 'windows', label: 'Windows', impact: '高性能' },
              { key: 'web', label: 'Web', impact: '免安装' },
            ],
            allow_free_input: true,
          },
        ],
      },
    };

    expect(() => orchestrator.validateOutput(invalidResult as any)).toThrowError(
      /recommended_option_key "non_existent_key" does not match any option key/
    );
  });

  it('Task 3.1: AIOrchestrator rejects duplicate option keys within a question', async () => {
    const invalidResult = {
      status: 'success' as const,
      structuredSuccess: true,
      rawEnvelope: {},
      structuredOutput: {
        confirmed: [],
        project_name: 'Test Project',
        project_tagline: 'Tagline',
        stage: 'initial-analysis' as const,
        tensions: [],
        unknowns: [],
        candidates: [],
        assumptions: [],
        risks: [],
        conflicts: [],
        gaps: [],
        questions: [
          {
            decision_key: 'univ-platform-choice',
            depends_on: [],
            importance: 'high' as const,
            question: '选择首发平台？',
            reason: '影响技术栈',
            recommendation: 'Windows 桌面',
            recommendation_reason: '单机离线可用',
            recommended_option_key: 'dup_key',
            options: [
              { key: 'dup_key', label: 'Windows', impact: '高性能' },
              { key: 'dup_key', label: 'Web', impact: '免安装' }, // Duplicate!
            ],
            allow_free_input: true,
          },
        ],
      },
    };

    expect(() => orchestrator.validateOutput(invalidResult as any)).toThrowError(
      /duplicate option key "dup_key" within question/
    );
  });

  it('Task 3.2: 5 core checklist questions provide tailored, non-generic options and unknown keys fallback safely', () => {
    const composer = new QuestionComposer();

    const coreKeys = [
      'chk-localfirst-ownership',
      'univ-mvp-boundary',
      'univ-primary-flow',
      'univ-platform-choice',
      'univ-success-signal',
    ];

    for (const key of coreKeys) {
      const gap: GapItem = {
        id: `gap-${key}`,
        area: 'technical_boundary',
        severity: 'critical',
        decisionKey: key,
        reason: '测试原因',
        impact: '测试影响',
        status: 'open',
        shouldAskUser: true,
      };

      const q = composer.compose(gap);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.recommendedOptionKey).toBeDefined();

      // Ensure option labels are not generic boundary text
      for (const opt of q.options) {
        expect(opt.key).toBeDefined();
        expect(opt.key.length).toBeGreaterThan(0);
        expect(opt.impact.length).toBeGreaterThan(10);
        expect(opt.label).not.toContain('边界清晰的方案');
        expect(opt.label).not.toContain('覆盖更多使用场景');
      }
    }

    // Unknown key fallback test
    const unknownGap: GapItem = {
      id: 'gap-unknown',
      area: 'technical_boundary',
      severity: 'high',
      decisionKey: 'chk-custom-unknown-feature',
      reason: '用户自定义特性未定',
      impact: '需要用户说明',
      status: 'open',
      shouldAskUser: true,
    };

    const unknownQ = composer.compose(unknownGap);
    expect(unknownQ.options.length).toBe(0); // Free-input fallback
    expect(unknownQ.allowFreeInput).toBe(true);
  });

  it('Task 3.3 & 3.4: Dismissing a question increments revision, creates no decision, and updates progress projection', async () => {
    await engine.createProject({
      projectId: 'proj-p3-test',
      projectPath: testProjectDir,
      projectName: 'Progress & Dismiss Test',
      idea: 'Need a local desktop note-taking app.',
    });

    const initSnap = await engine.getSnapshot(testProjectDir);
    const initialRev = initSnap.metadata.stateRevision;

    const snapWithQ = await engine.applyDiscoveryTurn(
      testProjectDir,
      {
        confirmed: [],
        candidates: [],
        assumptions: [],
        unknowns: [],
        risks: [],
        conflicts: [],
        tensions: [],
        gaps: [
          {
            decision_key: 'univ-platform-choice',
            depends_on: [],
            area: 'technical_boundary',
            severity: 'critical',
            reason: '运行平台未明确',
            impact: '影响底层架构',
            should_ask_user: true,
          },
        ],
        questions: [
          {
            decision_key: 'univ-platform-choice',
            depends_on: [],
            importance: 'critical',
            question: '运行平台未明确？',
            reason: '影响底层架构',
            recommendation: 'Windows 桌面',
            recommendation_reason: '单机离线可用',
            recommended_option_key: 'windows',
            options: [
              { key: 'windows', label: 'Windows', impact: '高性能' },
              { key: 'web', label: 'Web', impact: '免安装' },
            ],
            allow_free_input: true,
          },
        ],
      },
      initialRev
    );
    const revWithQ = snapWithQ.metadata.stateRevision;
    const platformQ = snapWithQ.questions.items[0]!;
    expect(revWithQ).toBe(initialRev + 1);

    // Initial progress check
    const progressBefore = projectDiscoveryProgressProjection(snapWithQ);
    expect(progressBefore.remainingBatchQuestionCount).toBe(1);
    expect(progressBefore.canGenerateNextBatch).toBe(false);
    expect(progressBefore.nextAction).toBe('answer');

    // 2. Start server and dismiss question via API
    let realServer: Server | undefined;
    try {
      const app = createApp({ engine, guard });
      await new Promise<void>((resolve) => {
        realServer = app.listen(0, '127.0.0.1', () => resolve());
      });
      const addr = realServer!.address() as any;
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      const dismissRes = await fetch(`${baseUrl}/api/projects/${snapWithQ.metadata.projectId}/questions/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: snapWithQ.metadata.projectId,
          questionRefs: [`question:${platformQ.id}`],
          expectedRevision: revWithQ,
        }),
      });

      expect(dismissRes.status).toBe(200);
      const dismissBody = await dismissRes.json();
      expect(dismissBody.success).toBe(true);

      const afterSnap = dismissBody.data.snapshot;
      expect(afterSnap.metadata.stateRevision).toBe(revWithQ + 1);

      // Verify no decision or assumption was created from dismiss
      const createdDecisions = afterSnap.decisions.items.filter((d: any) => d.id !== 'dec-01');
      expect(createdDecisions.length).toBe(0);
      expect(afterSnap.assumptions.items.length).toBe(0);

      // Verify progress projection endpoint
      const progressRes = await fetch(`${baseUrl}/api/projects/${snapWithQ.metadata.projectId}/discovery/progress`);
      expect(progressRes.status).toBe(200);
      const progressBody = await progressRes.json();
      expect(progressBody.success).toBe(true);

      const progressAfter = progressBody.data.progress;
      expect(progressAfter.dismissedBatchQuestionCount).toBe(1);
      expect(progressAfter.remainingBatchQuestionCount).toBe(0);
      expect(progressAfter.canGenerateNextBatch).toBe(true);
      expect(progressAfter.nextAction).toBe('organize');
    } finally {
      if (realServer) {
        await new Promise<void>((res) => realServer!.close(() => res()));
      }
    }
  });

  it('Task 3.1 & 3.5: Answering a question records explicit user choice and updates batch progress', async () => {
    const projectId = 'proj-p3-answer-test';
    const answerProjectDir = guard.resolveProjectPath(projectId);
    await engine.createProject({
      projectId,
      projectPath: answerProjectDir,
      projectName: 'Answer Test',
      idea: 'Need a local desktop note-taking app.',
    });

    const initSnap = await engine.getSnapshot(answerProjectDir);
    const snapWithQ = await engine.applyDiscoveryTurn(
      answerProjectDir,
      {
        confirmed: [],
        candidates: [],
        assumptions: [],
        unknowns: [],
        risks: [],
        conflicts: [],
        tensions: [],
        gaps: [
          {
            decision_key: 'univ-platform-choice',
            depends_on: [],
            area: 'technical_boundary',
            severity: 'critical',
            reason: '运行平台未明确',
            impact: '影响底层架构',
            should_ask_user: true,
          },
        ],
        questions: [
          {
            decision_key: 'univ-platform-choice',
            depends_on: [],
            importance: 'critical',
            question: '选择运行平台？',
            reason: '影响底层架构',
            recommendation: '推荐 Windows 原生桌面（纯离线优先）',
            recommendation_reason: '保证离线和性能',
            recommended_option_key: 'windows_native',
            options: [
              { key: 'windows_native', label: 'Windows 原生桌面', impact: '纯离线优先，启动极快', tradeoffs: '需单独适配 Mac/Linux', reversibility: 'hard' },
              { key: 'electron_cross', label: '跨平台 Electron', impact: '全平台覆盖，开发成本低', tradeoffs: '内存占用稍高', reversibility: 'moderate' },
            ],
            allow_free_input: true,
          },
        ],
      },
      initSnap.metadata.stateRevision
    );

    const question = snapWithQ.questions.items[0]!;
    expect(question.recommendedOptionKey).toBe('windows_native');
    expect(question.options[0]?.reversibility).toBe('hard');

    let realServer: Server | undefined;
    try {
      const app = createApp({ engine, guard });
      await new Promise<void>((resolve) => {
        realServer = app.listen(0, '127.0.0.1', () => resolve());
      });
      const addr = realServer!.address() as any;
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      // User selects the option 'Windows 原生桌面'
      const answerRes = await fetch(`${baseUrl}/api/projects/${projectId}/questions/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          questionRef: `question:${question.id}`,
          answer: 'Windows 原生桌面',
          selectedOptionKey: 'windows_native',
          expectedRevision: snapWithQ.metadata.stateRevision,
        }),
      });

      expect(answerRes.status).toBe(200);
      const answerBody = await answerRes.json();
      expect(answerBody.success).toBe(true);

      const answeredSnap = answerBody.data.snapshot;
      const updatedQ = answeredSnap.questions.items.find((q: any) => q.id === question.id);
      expect(updatedQ?.status).toBe('answered');
      expect(updatedQ?.answer).toBe('Windows 原生桌面');

      // Verify progress view
      const progress = projectDiscoveryProgressProjection(answeredSnap);
      expect(progress.answeredBatchQuestionCount).toBe(1);
      expect(progress.remainingBatchQuestionCount).toBe(0);
      expect(progress.canGenerateNextBatch).toBe(true);
    } finally {
      if (realServer) {
        await new Promise<void>((res) => realServer!.close(() => res()));
      }
    }
  });
});
