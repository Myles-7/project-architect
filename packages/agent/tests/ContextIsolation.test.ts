import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../src/context/ContextManager.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Context Isolation & Budget Verification Unit Tests (Phase 3.5.5)', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  function createSampleSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-iso-test',
        name: 'AI Agent Workbench',
        stage: 'broad-pass',
        stateRevision: 4,
        projectTags: ['Desktop App', 'AI Product', 'Developer Tool'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-iso-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-02'] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'mostly-clear', itemRefs: ['decision:dec-03'] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-iso-test',
        items: [
          { id: 'dec-01', area: 'project_overview', statement: 'AI Agent Workbench for Developers', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-02', area: 'target_user', statement: 'Target user is solo software developer', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-03', area: 'mvp_scope', statement: 'Desktop only, 100% local JSON files', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-iso-test',
        items: [
          { id: 'asm-01', statement: 'Default theme is dark', reason: 'Developer preference', status: 'active', createdAt: '' },
        ],
        updatedAt: '',
      },
      gaps: {
        schemaVersion: 1,
        projectId: 'proj-iso-test',
        gaps: [
          { id: 'gap-01', area: 'user_flows', severity: 'critical', reason: 'Core agent turn loop undefined', impact: 'Runtime blocked', dependency: 'none', shouldAskUser: true, status: 'open' },
        ],
        conflicts: [],
        tensions: [],
        updatedAt: '',
      },
      risks: { schemaVersion: 1, projectId: 'proj-iso-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-iso-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-iso-test',
        current: {
          id: 'rdn-01',
          status: 'ready-with-warnings',
          reviewedAt: '',
          requiredAreas: [],
          warnings: ['User flow details pending'],
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

  it('1. idea-analysis context focuses strictly on raw input and avoids checklist noise', () => {
    const snapshot = createSampleSnapshot();
    const ctx = contextManager.buildContextForMode('idea-analysis', snapshot, {
      userMessage: '我想做一个 AI Agent 工作台',
      checklistHints: [{ id: 'chk-1', area: 'technical_boundary', criterion: 'Checklist criterion', importance: 'critical' }],
    });

    expect(ctx).toContain('AI Agent 工作台');
    expect(ctx).toContain('Idea Analysis');
    // Does NOT pollute with checklist criteria
    expect(ctx).not.toContain('Checklist Quality Criteria');
  });

  it('2. question-generation context emphasizes prioritized gaps and anti-repetition decisions', () => {
    const snapshot = createSampleSnapshot();
    const ctx = contextManager.buildContextForMode('question-generation', snapshot, {
      questionAnswer: { questionRef: 'q-01', selectedOption: '单步骤自动推进' },
    });

    expect(ctx).toContain('Question Generation');
    expect(ctx).toContain('Core agent turn loop undefined');
    expect(ctx).toContain('Desktop only, 100% local JSON files');
    expect(ctx).toContain('Question Constraints');
  });

  it('3. readiness-review context encompasses full overview maturity, assumptions, and remaining gaps', () => {
    const snapshot = createSampleSnapshot();
    const ctx = contextManager.buildContextForMode('readiness-review', snapshot, {});

    expect(ctx).toContain('Readiness & Document Compilation Review');
    expect(ctx).toContain('Comprehensive Overview Sections');
    expect(ctx).toContain('Default theme is dark');
    expect(ctx).toContain('Core agent turn loop undefined');
  });

  it('4. All generated context profiles strictly comply with total character limits (<32k chars)', () => {
    const snapshot = createSampleSnapshot();
    const payload = { userMessage: 'Check all modes' };

    const modes = ['idea-analysis', 'gap-analysis', 'question-generation', 'decision-review', 'readiness-review', 'document-compile'] as const;
    for (const m of modes) {
      const ctx = contextManager.buildContextForMode(m, snapshot, payload);
      expect(ctx.length).toBeLessThanOrEqual(32000);
    }
  });
});
