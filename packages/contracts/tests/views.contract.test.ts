import { describe, it, expect } from 'vitest';
import type {
  ProjectOverviewView,
  ReadinessView,
  DocumentListView,
  TimelineView,
  TimelineEvent,
} from '../src/views.js';
import { isTypedRef } from '../src/refs.js';

describe('Shared UI Read Model Contracts (Phase 4.9.2a)', () => {
  it('1. ProjectOverviewView: Validates structure, TypedRefs, and clean JSON serialization', () => {
    const overviewView: ProjectOverviewView = {
      sourceStateRevision: 7,
      projectId: 'proj-music-tagger',
      projectName: 'Local Music Tagger',
      projectStage: 'deep-dive',
      updatedAt: '2026-08-23T10:00:00.000Z',
      overallMaturity: 'mostly-clear',
      totalConfirmedDecisions: 4,
      totalLockedDecisions: 2,
      totalCandidates: 3,
      sections: [
        {
          id: 'target_user',
          title: 'Target User',
          kind: 'fixed',
          maturity: 'locked',
          hasUnresolvedGaps: false,
          unresolvedGapCount: 0,
          items: [
            {
              ref: 'decision:dec-01',
              statement: 'Desktop power users with local lossless FLAC libraries',
              status: 'locked',
              origin: 'user',
              isLocked: true,
              hasWarning: false,
              evidenceRefs: ['gap:gap-01'],
              resolvedGapRefs: ['gap:gap-01'],
            },
          ],
        },
      ],
    };

    // Verify TypedRefs in items
    for (const section of overviewView.sections) {
      for (const item of section.items) {
        expect(isTypedRef(item.ref)).toBe(true);
        if (item.evidenceRefs) {
          for (const ev of item.evidenceRefs) {
            expect(isTypedRef(ev)).toBe(true);
          }
        }
      }
    }

    // Verify JSON serialization roundtrip
    const serialized = JSON.stringify(overviewView);
    const parsed: ProjectOverviewView = JSON.parse(serialized);
    expect(parsed.sourceStateRevision).toBe(7);
    expect(parsed.sections[0].items[0].statement).toContain('lossless FLAC libraries');
    expect(parsed.sections[0].items[0].isLocked).toBe(true);
  });

  it('2. ReadinessView: Validates Level 1~5 metrics, blocking issues, and gate semantics', () => {
    const readinessView: ReadinessView = {
      sourceStateRevision: 10,
      projectId: 'proj-music-tagger',
      level: 4,
      score: 85,
      status: 'ready-with-warnings',
      isReadyForDocs: true,
      userDisposition: 'approved',
      canGenerateDocs: true,
      areas: [
        {
          areaId: 'target_user',
          title: 'Target User',
          isSatisfied: true,
          decisionRef: 'decision:dec-01',
          blockingGapRefs: [],
        },
        {
          areaId: 'technical_boundary',
          title: 'Technical Boundary',
          isSatisfied: true,
          decisionRef: 'decision:dec-02',
          blockingGapRefs: [],
        },
      ],
      blockingIssues: [
        {
          id: 'issue-01',
          severity: 'normal',
          message: 'No packaging script defined for macOS',
          targetRef: 'gap:gap-packaging',
          isAcknowledged: true,
        },
      ],
      warnings: ['Offline metadata fallback is not explicitly specified'],
      activeAssumptions: [
        {
          ref: 'assumption:asm-01',
          statement: 'Local file tags use standard ID3v2.4 format',
          reason: 'Widely supported across music players',
        },
      ],
    };

    expect(readinessView.level).toBeGreaterThanOrEqual(1);
    expect(readinessView.level).toBeLessThanOrEqual(5);
    expect(readinessView.canGenerateDocs).toBe(true);

    // Serialization check
    const parsed: ReadinessView = JSON.parse(JSON.stringify(readinessView));
    expect(parsed.userDisposition).toBe('approved');
    expect(parsed.activeAssumptions[0].ref).toBe('assumption:asm-01');
  });

  it('3. DocumentListView: Validates relative safe paths, staleness flag, and revision metadata', () => {
    const documentListView: DocumentListView = {
      sourceStateRevision: 12,
      projectId: 'proj-music-tagger',
      hasCompiledDocs: true,
      compiledAt: '2026-08-23T10:10:00.000Z',
      isManifestStale: true, // Project advanced to rev 12 while docs were compiled at rev 11
      items: [
        {
          id: 'doc-agents',
          type: 'agents',
          title: 'Coding Agent Guidelines',
          path: 'AGENTS.md',
          status: 'generated',
          generatedAt: '2026-08-23T10:10:00.000Z',
          sourceRevision: 11,
          isStale: true,
          sizeBytes: 3420,
        },
        {
          id: 'doc-project',
          type: 'project',
          title: 'Project Charter',
          path: 'docs/PROJECT.md',
          status: 'generated',
          generatedAt: '2026-08-23T10:10:00.000Z',
          sourceRevision: 11,
          isStale: true,
          sizeBytes: 4120,
        },
      ],
    };

    // Invariant: Document paths must be safe relative paths, never host absolute paths
    for (const doc of documentListView.items) {
      expect(doc.path.startsWith('/')).toBe(false);
      expect(doc.path.includes(':\\')).toBe(false);
      expect(doc.path.includes('../')).toBe(false);
    }

    const parsed: DocumentListView = JSON.parse(JSON.stringify(documentListView));
    expect(parsed.isManifestStale).toBe(true);
    expect(parsed.items.length).toBe(2);
  });

  it('4. TimelineView: Validates chronological event kinds, actors, and metadata isolation', () => {
    const events: TimelineEvent[] = [
      {
        id: 'evt-01',
        timestamp: '2026-08-23T09:00:00.000Z',
        sourceStateRevision: 1,
        kind: 'project_created',
        summary: 'Created project "Local Music Tagger"',
        actor: 'user',
        relatedRefs: [],
        metadata: { initialStage: 'created' },
      },
      {
        id: 'evt-02',
        timestamp: '2026-08-23T09:05:00.000Z',
        sourceStateRevision: 2,
        kind: 'discovery_turn',
        summary: 'Completed Turn 1 Discovery analysis',
        actor: 'agent',
        relatedRefs: ['decision:dec-01', 'gap:gap-01'],
        metadata: { durationMs: 1200, candidatesCount: 3 },
      },
      {
        id: 'evt-03',
        timestamp: '2026-08-23T09:10:00.000Z',
        sourceStateRevision: 3,
        kind: 'decision_locked',
        summary: 'Locked decision "Strict Local File Access"',
        actor: 'user',
        relatedRefs: ['decision:dec-01'],
      },
    ];

    const timelineView: TimelineView = {
      sourceStateRevision: 3,
      projectId: 'proj-music-tagger',
      totalEvents: 3,
      events,
    };

    expect(timelineView.events.length).toBe(3);
    expect(timelineView.events[1].actor).toBe('agent');
    expect(timelineView.events[2].kind).toBe('decision_locked');

    // Serialization check
    const parsed: TimelineView = JSON.parse(JSON.stringify(timelineView));
    expect(parsed.events[0].kind).toBe('project_created');
  });

  it('5. Invariants: View models NEVER leak internal filesystem absolute paths or raw provider envelopes', () => {
    const sampleView: ProjectOverviewView = {
      sourceStateRevision: 1,
      projectId: 'p-1',
      projectName: 'Test',
      projectStage: 'created',
      updatedAt: '2026-08-23T10:00:00.000Z',
      overallMaturity: 'unexplored',
      sections: [],
      totalConfirmedDecisions: 0,
      totalLockedDecisions: 0,
      totalCandidates: 0,
    };

    const serialized = JSON.stringify(sampleView);
    expect(serialized).not.toContain('C:\\');
    expect(serialized).not.toContain('/Users/');
    expect(serialized).not.toContain('rawEnvelope');
    expect(serialized).not.toContain('rawDiagnostics');
  });
});
