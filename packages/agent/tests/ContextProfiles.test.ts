import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../src/context/ContextManager.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Context Profiles Unit Tests (Phase 3.2)', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  function createBaseSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-context-test',
        name: 'AI Code Reviewer',
        stage: 'broad-pass',
        stateRevision: 3,
        projectTags: ['Developer Tool', 'AI Product'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-context-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-01'], summary: 'Local AI Code Reviewer' },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'mostly-clear', itemRefs: ['decision:dec-02'], summary: 'Frontend developers' },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'unexplored', itemRefs: [] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-context-test',
        items: [
          {
            id: 'dec-01',
            area: 'project_overview',
            statement: 'Local AI code review tool for Git diffs',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'dec-02',
            area: 'target_user',
            statement: 'Target user is senior frontend engineer',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            confirmedBy: 'user',
            createdAt: '',
            updatedAt: '',
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-context-test',
        items: [
          { id: 'asm-01', statement: 'Default max diff size is 1MB', reason: 'Performance buffer', status: 'active', createdAt: '' },
        ],
        updatedAt: '',
      },
      gaps: {
        schemaVersion: 1,
        projectId: 'proj-context-test',
        gaps: [
          { id: 'gap-01', area: 'mvp_scope', severity: 'critical', reason: 'MVP does not define supported languages', impact: 'Scope unknown', dependency: 'none', shouldAskUser: true, status: 'open' },
        ],
        conflicts: [],
        tensions: [],
        updatedAt: '',
      },
      risks: { schemaVersion: 1, projectId: 'proj-context-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-context-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-context-test',
        current: {
          id: 'rdn-01',
          status: 'not-ready',
          reviewedAt: '',
          requiredAreas: [],
          warnings: ['Language support not defined'],
          issues: ['MVP scope missing'],
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

  it('1. Idea Analysis Profile focuses on raw idea and initial instructions', () => {
    const snapshot = createBaseSnapshot();
    const ctx = contextManager.buildContextForMode('idea-analysis', snapshot, {
      userMessage: '我想做一个面向前端的智能代码审查工具',
    });

    expect(ctx).toContain('Idea Analysis');
    expect(ctx).toContain('面向前端的智能代码审查工具');
    expect(ctx).toContain('Mode Focus: Initial Idea Understanding');
  });

  it('2. Gap Analysis Profile includes overview maturity and checklist lens', () => {
    const snapshot = createBaseSnapshot();
    const ctx = contextManager.buildContextForMode('gap-analysis', snapshot, {
      checklistHints: [{ id: 'chk-1', area: 'mvp_scope', criterion: 'MVP范围必须明确', importance: 'critical' }],
    });

    expect(ctx).toContain('Gap Analysis');
    expect(ctx).toContain('Current Overview Section Maturity');
    expect(ctx).toContain('Standard Quality Criteria');
    expect(ctx).toContain('MVP范围必须明确');
  });

  it('3. Question Profile highlights prioritized gaps and question constraints', () => {
    const snapshot = createBaseSnapshot();
    const ctx = contextManager.buildContextForMode('question-generation', snapshot, {
      questionAnswer: { questionRef: 'q-01', selectedOption: 'TypeScript & JavaScript only' },
    });

    expect(ctx).toContain('Question Generation');
    expect(ctx).toContain('Prioritized Gaps Requiring Questioning');
    expect(ctx).toContain('Question Constraints');
    expect(ctx).toContain('TypeScript & JavaScript only');
  });

  it('4. Decision Review Profile highlights modification impact instructions', () => {
    const snapshot = createBaseSnapshot();
    const ctx = contextManager.buildContextForMode('decision-review', snapshot, {
      userMessage: '修改目标用户为全栈开发团队',
    });

    expect(ctx).toContain('Decision Review & Impact Analysis');
    expect(ctx).toContain('Current Project Decisions');
    expect(ctx).toContain('Review Lens: Decision Modification & Ripple Effect');
  });

  it('5. Readiness Profile renders comprehensive overview sections and unresolved issues', () => {
    const snapshot = createBaseSnapshot();
    const ctx = contextManager.buildContextForMode('readiness-review', snapshot, {});

    expect(ctx).toContain('Readiness & Document Compilation Review');
    expect(ctx).toContain('Comprehensive Overview Sections');
    expect(ctx).toContain('Active Assumptions');
    expect(ctx).toContain('Default max diff size is 1MB');
  });

  it('6. Produces distinct specialized context for different modes on the same project snapshot', () => {
    const snapshot = createBaseSnapshot();
    const payload = { userMessage: 'Review project' };

    const ctxIdea = contextManager.buildContextForMode('idea-analysis', snapshot, payload);
    const ctxGap = contextManager.buildContextForMode('gap-analysis', snapshot, payload);
    const ctxQ = contextManager.buildContextForMode('question-generation', snapshot, payload);
    const ctxDec = contextManager.buildContextForMode('decision-review', snapshot, payload);
    const ctxRead = contextManager.buildContextForMode('readiness-review', snapshot, payload);

    expect(ctxIdea).not.toBe(ctxGap);
    expect(ctxGap).not.toBe(ctxQ);
    expect(ctxQ).not.toBe(ctxDec);
    expect(ctxDec).not.toBe(ctxRead);
  });

  it('7. Question refinement keeps the linked gap and locked bounds within its focused 12k budget', () => {
    const snapshot = createBaseSnapshot();
    snapshot.questions.items.push({
      id: 'q-focus', issueRef: 'gap:gap-01', importance: 'high', question: 'Which language scope?',
      reason: 'Defines MVP.', recommendation: 'TypeScript only', recommendationReason: 'Fastest MVP.',
      options: [], allowFreeInput: true, status: 'shown', createdAt: '',
    });
    snapshot.decisions.items.push({
      id: 'dec-locked', area: 'mvp_scope', statement: 'Local-only deployment is non-negotiable',
      status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '',
    });
    for (let index = 0; index < 20; index++) {
      snapshot.decisions.items.push({
        id: `dec-long-${index}`, area: 'secondary', statement: `Unrelated decision ${index}: ${'detail '.repeat(1_000)}`,
        status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '',
      });
    }

    const ctx = contextManager.buildContextForMode('question-generation', snapshot, {
      questionAnswer: { questionRef: 'question:q-focus', selectedOption: 'TypeScript only' },
    });

    expect(ctx.length).toBeLessThanOrEqual(12_000);
    expect(ctx).toContain('MVP does not define supported languages');
    expect(ctx).toContain('Local-only deployment is non-negotiable');
  });
});
