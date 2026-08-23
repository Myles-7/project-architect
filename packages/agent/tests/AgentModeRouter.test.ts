import { describe, it, expect, beforeEach } from 'vitest';
import { AgentModeRouter } from '../src/router/AgentModeRouter.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('AgentModeRouter Unit Tests (Phase 3.1)', () => {
  let router: AgentModeRouter;

  beforeEach(() => {
    router = new AgentModeRouter();
  });

  function createBaseSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-router-test',
        name: 'AI Knowledge Base',
        stage: 'created',
        stateRevision: 1,
        projectTags: ['Desktop App', 'AI Product'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-router-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'mostly-clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-router-test',
        items: [
          {
            id: 'dec-01',
            area: 'project_overview',
            statement: 'An AI-powered knowledge base for research',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: { schemaVersion: 1, projectId: 'proj-router-test', items: [], updatedAt: '' },
      gaps: { schemaVersion: 1, projectId: 'proj-router-test', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-router-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-router-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-router-test',
        current: {
          id: 'rdn-01',
          status: 'not-ready',
          reviewedAt: '',
          requiredAreas: [],
          warnings: [],
          issues: [],
          assumptionRefs: [],
          knownIssueAcknowledgements: [],
          criticalConflictAcknowledgements: [],
          userDisposition: 'pending',
        },
        history: [],
        updatedAt: '',
      },
    };
  }

  it('1. Routes to idea-analysis for brand-new project initial turn', () => {
    const snapshot = createBaseSnapshot();
    const mode = router.route({
      snapshot,
      request: { expectedRevision: 1, userMessage: '我想做一个AI知识库软件' },
    });
    expect(mode).toBe('idea-analysis');
  });

  it('2. Routes to question-generation when critical/high gaps exist or question answer is provided', () => {
    const snapshot = createBaseSnapshot();
    snapshot.metadata.stage = 'broad-pass';
    snapshot.gaps.gaps.push({
      id: 'gap-01',
      area: 'target_user',
      severity: 'critical',
      reason: '目标用户未明确',
      impact: '影响MVP边界',
      dependency: 'none',
      shouldAskUser: true,
      status: 'open',
    });

    const mode = router.route({
      snapshot,
      request: { expectedRevision: 2, userMessage: '分析后续步骤' },
    });
    expect(mode).toBe('question-generation');

    // Also routes to question-generation when user provides a questionAnswer
    const modeWithAnswer = router.route({
      snapshot,
      request: {
        expectedRevision: 2,
        questionAnswer: { questionRef: 'q-01', selectedOption: '个人研究员' },
      },
    });
    expect(modeWithAnswer).toBe('question-generation');
  });

  it('3. Routes to gap-analysis when only normal gaps exist', () => {
    const snapshot = createBaseSnapshot();
    snapshot.metadata.stage = 'broad-pass';
    // Has confirmed decision beyond initial idea
    snapshot.decisions.items.push({
      id: 'dec-user-01',
      area: 'target_user',
      statement: '目标用户为独立研究员',
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [],
      confirmedBy: 'user',
      createdAt: '',
      updatedAt: '',
    });
    snapshot.overview.sections.find((s) => s.id === 'target_user')!.maturity = 'clear';

    // Only normal gap
    snapshot.gaps.gaps.push({
      id: 'gap-ux-01',
      area: 'ux_ui',
      severity: 'medium',
      reason: '快捷键偏好',
      impact: '操作效率',
      dependency: 'none',
      shouldAskUser: true,
      status: 'open',
    });

    const mode = router.route({
      snapshot,
      request: { expectedRevision: 3, userMessage: '继续检查系统设计' },
    });
    expect(mode).toBe('gap-analysis');
  });

  it('4. Routes to decision-review when user intent is modifying an existing decision', () => {
    const snapshot = createBaseSnapshot();
    snapshot.metadata.stage = 'broad-pass';

    const mode = router.route({
      snapshot,
      request: { expectedRevision: 3, userMessage: '修改目标用户为跨学科研发团队' },
    });
    expect(mode).toBe('decision-review');
  });

  it('5. Routes to readiness-review when user requests development readiness check', () => {
    const snapshot = createBaseSnapshot();
    snapshot.metadata.stage = 'broad-pass';

    const mode = router.route({
      snapshot,
      request: { expectedRevision: 3, userMessage: '请审查当前开发准备度，是否可以开始写代码了？' },
    });
    expect(mode).toBe('readiness-review');
  });

  it('6. Routes to document-compile when user requests document generation', () => {
    const snapshot = createBaseSnapshot();
    snapshot.metadata.stage = 'broad-pass';

    const mode = router.route({
      snapshot,
      request: { expectedRevision: 3, userMessage: '请生成最终的技术规划与需求文档' },
    });
    expect(mode).toBe('document-compile');
  });

  it('7. Respects explicitMode override when provided', () => {
    const snapshot = createBaseSnapshot();
    const mode = router.route({
      snapshot,
      request: { expectedRevision: 1, userMessage: 'Hello' },
      explicitMode: 'readiness-review',
    });
    expect(mode).toBe('readiness-review');
  });
});
