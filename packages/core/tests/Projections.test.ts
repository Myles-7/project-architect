import { describe, it, expect } from 'vitest';
import { projectOverviewProjection } from '../src/view/ProjectOverviewProjection.js';
import { readinessProjection } from '../src/view/ReadinessProjection.js';
import { documentProjection } from '../src/view/DocumentProjection.js';
import { timelineProjection } from '../src/view/TimelineProjection.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Phase 4.9.2b: Pure Function Core Projections', () => {
  const createBaseSnapshot = (): ProjectSnapshot => ({
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      name: 'Projection Test Project',
      stage: 'deep-dive',
      stateRevision: 8,
      projectTags: ['Desktop', 'Local-First'],
      inputRefs: [
        {
          id: 'input:inp-01',
          kind: 'text',
          label: 'specs.md',
          storageRef: 'inputs/inp-01/source.md',
          status: 'ready',
          analysisAvailability: 'available',
          createdAt: '2026-08-23T09:00:00.000Z',
        },
      ],
      updatedAt: '2026-08-23T10:00:00.000Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      sections: [
        {
          id: 'target_user',
          title: 'Target User',
          kind: 'fixed',
          maturity: 'mostly-clear',
          itemRefs: ['decision:dec-01', 'decision:dec-02'],
        },
        {
          id: 'mvp_scope',
          title: 'MVP Scope',
          kind: 'fixed',
          maturity: 'unexplored',
          itemRefs: [],
        },
      ],
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      items: [
        {
          id: 'dec-01',
          area: 'target_user',
          statement: 'Power users managing local lossless libraries',
          status: 'locked',
          origin: 'user',
          evidenceRefs: ['gap:gap-01'],
          resolvedGapRefs: ['gap:gap-01'],
          createdAt: '2026-08-23T09:10:00.000Z',
          updatedAt: '2026-08-23T09:15:00.000Z',
        },
        {
          id: 'dec-02',
          area: 'target_user',
          statement: 'Casual mobile streaming listeners (Candidate)',
          status: 'candidate',
          origin: 'agent',
          evidenceRefs: [],
          createdAt: '2026-08-23T09:20:00.000Z',
          updatedAt: '2026-08-23T09:20:00.000Z',
        },
      ],
      history: [],
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      items: [
        {
          id: 'asm-01',
          area: 'technical_boundary',
          statement: 'Files are encoded in standard UTF-8',
          reason: 'Common standard',
          status: 'active',
          resolvedAt: undefined,
          createdAt: '2026-08-23T09:05:00.000Z',
          updatedAt: '2026-08-23T09:05:00.000Z',
        },
      ],
      history: [],
    },
    gaps: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      gaps: [
        {
          id: 'gap-01',
          area: 'target_user',
          topic: 'Target persona',
          reason: 'Clarify persona',
          severity: 'normal',
          status: 'addressed',
        },
        {
          id: 'gap-02',
          area: 'mvp_scope',
          topic: 'MVP Boundaries',
          reason: 'Need MVP scope',
          severity: 'critical',
          status: 'open',
        },
      ],
      conflicts: [],
      tensions: [],
      history: [],
    },
    risks: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      items: [],
      history: [],
    },
    questions: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      items: [
        {
          id: 'q-01',
          question: 'Do you require cloud sync?',
          reason: 'Boundary check',
          importance: 'high',
          status: 'answered',
          answer: 'No, strictly local',
          options: [{ label: 'No', impact: 'Local-first' }],
          allowFreeInput: true,
          createdAt: '2026-08-23T09:12:00.000Z',
          updatedAt: '2026-08-23T09:14:00.000Z',
        },
      ],
      history: [],
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T10:00:00.000Z',
      current: {
        id: 'readiness-01',
        status: 'not-ready',
        reviewedAt: '2026-08-23T09:30:00.000Z',
        requiredAreas: ['target_user', 'mvp_scope', 'technical_boundary'],
        warnings: ['MVP scope is still open'],
        issues: ['Critical gap in mvp_scope'],
        assumptionRefs: ['assumption:asm-01'],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'pending',
      },
      history: [],
    },
    documents: {
      schemaVersion: 1,
      projectId: 'proj-proj-test',
      updatedAt: '2026-08-23T09:40:00.000Z',
      items: [
        {
          id: 'doc-agents',
          type: 'agents',
          title: 'Coding Agent Guidelines',
          path: 'AGENTS.md',
          status: 'generated',
          generatedAt: '2026-08-23T09:40:00.000Z',
          sourceRevision: 7, // Project is at 8, so docs are stale
        },
      ],
    },
  });

  it('1. Determinism: Same snapshot deterministically yields identical Projections', () => {
    const snap1 = createBaseSnapshot();
    const snap2 = createBaseSnapshot();

    const o1 = projectOverviewProjection(snap1);
    const o2 = projectOverviewProjection(snap2);
    expect(o1).toEqual(o2);

    const r1 = readinessProjection(snap1);
    const r2 = readinessProjection(snap2);
    expect(r1).toEqual(r2);

    const d1 = documentProjection(snap1);
    const d2 = documentProjection(snap2);
    expect(d1).toEqual(d2);

    const t1 = timelineProjection(snap1);
    const t2 = timelineProjection(snap2);
    expect(t1).toEqual(t2);
  });

  it('2. Pure Function & Immutability: Projections do not mutate the input snapshot', () => {
    const snap = createBaseSnapshot();
    const snapBefore = JSON.stringify(snap);

    projectOverviewProjection(snap);
    readinessProjection(snap);
    documentProjection(snap);
    timelineProjection(snap);

    const snapAfter = JSON.stringify(snap);
    expect(snapAfter).toBe(snapBefore);
  });

  it('3. Status Fidelity: Candidate & Assumption are not misrendered as Confirmed', () => {
    const snap = createBaseSnapshot();
    const overview = projectOverviewProjection(snap);

    const userSection = overview.sections.find((s) => s.id === 'target_user');
    expect(userSection).toBeDefined();

    const lockedItem = userSection?.items.find((i) => i.ref === 'decision:dec-01');
    expect(lockedItem?.status).toBe('locked');
    expect(lockedItem?.isLocked).toBe(true);

    const candidateItem = userSection?.items.find((i) => i.ref === 'decision:dec-02');
    expect(candidateItem?.status).toBe('candidate');
    expect(candidateItem?.isLocked).toBe(false);
    expect(candidateItem?.hasWarning).toBe(true);
    expect(candidateItem?.warningReason).toContain('Candidate');

    // Overview total counters must strictly distinguish status
    expect(overview.totalLockedDecisions).toBe(1);
    expect(overview.totalConfirmedDecisions).toBe(0);
    expect(overview.totalCandidates).toBe(1);
  });

  it('4. Truth Grounding: Missing facts are not filled with fabricated defaults', () => {
    const snap = createBaseSnapshot();
    const overview = projectOverviewProjection(snap);

    const mvpSection = overview.sections.find((s) => s.id === 'mvp_scope');
    expect(mvpSection).toBeDefined();
    // Must be empty items list, never filled with fake defaults like "General Todo list"
    expect(mvpSection?.items.length).toBe(0);
    expect(mvpSection?.hasUnresolvedGaps).toBe(true);
    expect(mvpSection?.unresolvedGapCount).toBe(1);

    const readiness = readinessProjection(snap);
    const mvpArea = readiness.areas.find((a) => a.areaId === 'mvp_scope');
    expect(mvpArea?.isSatisfied).toBe(false);
    expect(mvpArea?.decisionRef).toBeUndefined();
    expect(mvpArea?.blockingGapRefs).toContain('gap:gap-02');
  });

  it('5. Document Staleness Calculation: Marks documents stale when stateRevision > sourceRevision', () => {
    const snap = createBaseSnapshot();
    const docView = documentProjection(snap);

    expect(docView.sourceStateRevision).toBe(8);
    expect(docView.hasCompiledDocs).toBe(true);
    expect(docView.isManifestStale).toBe(true); // rev 8 > manifest rev 7
    expect(docView.items[0].isStale).toBe(true);
  });
});
