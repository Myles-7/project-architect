import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient } from '../src/api/client.js';
import type {
  ProjectOverviewView,
  ProjectSnapshot,
} from '@project-architect/contracts';

describe('Phase 5.2: Workspace Overview Integration Tests', () => {
  const dummyBaseUrl = 'http://127.0.0.1:3001';

  const mockOverviewViewRev1: ProjectOverviewView = {
    sourceStateRevision: 1,
    projectId: 'proj-offline-tagger',
    projectName: 'Offline Tagger',
    projectStage: 'created',
    updatedAt: '2026-08-23T00:00:00Z',
    overallMaturity: 'unexplored',
    totalConfirmedDecisions: 1,
    totalLockedDecisions: 0,
    totalCandidates: 1,
    sections: [
      {
        id: 'target_user',
        title: 'Target User',
        kind: 'fixed',
        maturity: 'unexplored',
        hasUnresolvedGaps: true,
        unresolvedGapCount: 1,
        items: [
          {
            ref: 'decision:cand-01',
            statement: 'Audiophiles with local FLAC collection',
            status: 'candidate',
            origin: 'agent',
            isLocked: false,
            hasWarning: false,
          },
        ],
      },
      {
        id: 'technical_boundary',
        title: 'Technical Boundary',
        kind: 'fixed',
        maturity: 'mostly-clear',
        hasUnresolvedGaps: false,
        unresolvedGapCount: 0,
        items: [
          {
            ref: 'decision:dec-01',
            statement: 'Native offline desktop application (Windows 10/11)',
            status: 'confirmed',
            origin: 'user',
            isLocked: false,
            hasWarning: false,
          },
        ],
      },
    ],
  };

  const mockSnapshotRev2: ProjectSnapshot = {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      name: 'Offline Tagger',
      stage: 'created',
      stateRevision: 2,
      projectTags: [],
      inputRefs: [],
      createdAt: '2026-08-23T00:00:00Z',
      updatedAt: '2026-08-23T00:00:00Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      sections: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      items: [
        {
          id: 'dec-01',
          area: 'technical_boundary',
          statement: 'Native offline desktop application (Windows 10/11)',
          status: 'confirmed',
          origin: 'user',
          createdAt: '2026-08-23T00:00:00Z',
          updatedAt: '2026-08-23T00:00:00Z',
        },
        {
          id: 'cand-01',
          area: 'target_user',
          statement: 'Audiophiles with local FLAC collection',
          status: 'confirmed',
          origin: 'user',
          createdAt: '2026-08-23T00:00:00Z',
          updatedAt: '2026-08-23T00:00:00Z',
        },
      ],
      traces: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      items: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    gaps: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      gaps: [],
      conflicts: [],
      tensions: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    risks: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      items: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    questions: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      items: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      current: {
        id: 'readiness-01',
        status: 'not-ready',
        reviewedAt: '2026-08-23T00:00:00Z',
        requiredAreas: [],
        warnings: [],
        issues: [],
        assumptionRefs: [],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'pending',
      },
      history: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
  };

  it('1. GET /api/projects/:id/overview returns valid pure projection', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/overview')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: mockOverviewViewRev1,
            stateRevision: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const view = await client.getProjectOverview('proj-offline-tagger');

    expect(view.projectId).toBe('proj-offline-tagger');
    expect(view.sourceStateRevision).toBe(1);
    expect(view.sections).toHaveLength(2);
    expect(view.sections[0].items[0].status).toBe('candidate');
    expect(view.sections[0].hasUnresolvedGaps).toBe(true);
    expect(view.sections[1].items[0].status).toBe('confirmed');
  });

  it('2. Confirm Candidate Action: Submits expectedRevision and receives updated snapshot', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/decisions/confirm') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.targetRef).toBe('decision:cand-01');
        expect(body.expectedRevision).toBe(1);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              snapshot: mockSnapshotRev2,
            },
            stateRevision: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const result = await client.confirmDecision('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      targetRef: 'decision:cand-01',
      expectedRevision: 1,
    });

    expect(result.snapshot.metadata.stateRevision).toBe(2);
    expect(result.snapshot.decisions.items).toHaveLength(2);
  });

  it('3. Lock & Unlock Action: Submits expectedRevision and updates decision lock status', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/decisions/lock') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.decisionRef).toBe('decision:dec-01');
        expect(body.expectedRevision).toBe(2);

        const lockedSnapshot: ProjectSnapshot = {
          ...mockSnapshotRev2,
          metadata: { ...mockSnapshotRev2.metadata, stateRevision: 3 },
          decisions: {
            ...mockSnapshotRev2.decisions,
            items: mockSnapshotRev2.decisions.items.map((d) =>
              d.id === 'dec-01' ? { ...d, status: 'locked' as const } : d
            ),
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: { snapshot: lockedSnapshot },
            stateRevision: 3,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.endsWith('/decisions/unlock') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.decisionRef).toBe('decision:dec-01');
        expect(body.expectedRevision).toBe(3);

        const unlockedSnapshot: ProjectSnapshot = {
          ...mockSnapshotRev2,
          metadata: { ...mockSnapshotRev2.metadata, stateRevision: 4 },
          decisions: {
            ...mockSnapshotRev2.decisions,
            items: mockSnapshotRev2.decisions.items.map((d) =>
              d.id === 'dec-01' ? { ...d, status: 'confirmed' as const } : d
            ),
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: { snapshot: unlockedSnapshot },
            stateRevision: 4,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    // Lock
    const lockRes = await client.lockDecision('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      decisionRef: 'decision:dec-01',
      expectedRevision: 2,
    });
    expect(lockRes.snapshot.metadata.stateRevision).toBe(3);
    expect(lockRes.snapshot.decisions.items.find((d) => d.id === 'dec-01')?.status).toBe('locked');

    // Unlock
    const unlockRes = await client.unlockDecision('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      decisionRef: 'decision:dec-01',
      expectedRevision: 3,
    });
    expect(unlockRes.snapshot.metadata.stateRevision).toBe(4);
    expect(unlockRes.snapshot.decisions.items.find((d) => d.id === 'dec-01')?.status).toBe('confirmed');
  });

  it('4. Edit Overview Item: Records explicit user statement as Confirmed decision', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/overview/edit') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.sectionId).toBe('technical_boundary');
        expect(body.newStatement).toBe('Windows 11 only, 64-bit architecture');
        expect(body.expectedRevision).toBe(1);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              decisionRef: 'decision:dec-02',
              snapshot: mockSnapshotRev2,
            },
            stateRevision: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const editRes = await client.editOverviewItem('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      sectionId: 'technical_boundary',
      newStatement: 'Windows 11 only, 64-bit architecture',
      expectedRevision: 1,
    });

    expect(editRes.decisionRef).toBe('decision:dec-02');
    expect(editRes.snapshot.metadata.stateRevision).toBe(2);
  });

  it('5. Concurrency Protection: Returns HTTP 409 conflict when revision is outdated', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'STATE_REVISION_CONFLICT',
            message: 'State revision mismatch: expected 1, current 2',
            recoverable: true,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.confirmDecision('proj-offline-tagger', {
        projectId: 'proj-offline-tagger',
        targetRef: 'decision:cand-01',
        expectedRevision: 1,
      });
      expect.fail('Should have thrown 409 ApiClientError');
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('STATE_REVISION_CONFLICT');
    }
  });

  it('6. Decision Locked Protection: Returns HTTP 422 when attempting to directly edit a locked decision', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'DECISION_LOCKED',
            message: 'Decision "decision:dec-01" is locked and cannot be edited directly. Unlock it first.',
            recoverable: true,
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.editOverviewItem('proj-offline-tagger', {
        projectId: 'proj-offline-tagger',
        sectionId: 'technical_boundary',
        itemRef: 'decision:dec-01',
        newStatement: 'Modifying locked decision',
        expectedRevision: 3,
      });
      expect.fail('Should have thrown 422 ApiClientError');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('DECISION_LOCKED');
    }
  });
});
