import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient } from '../src/api/client.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Phase 5.1: Home Session & Project Lifecycle Integration Tests', () => {
  const dummyBaseUrl = 'http://127.0.0.1:3001';

  const mockSnapshotRev1: ProjectSnapshot = {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-offline-tagger',
      name: 'Offline Tagger',
      stage: 'created',
      stateRevision: 1,
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
      items: [],
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

  const mockSnapshotRev2: ProjectSnapshot = {
    ...mockSnapshotRev1,
    metadata: {
      ...mockSnapshotRev1.metadata,
      stage: 'broad-pass',
      stateRevision: 2,
    },
  };

  it('1. Create Project Flow: Creates project -> triggers single initial Discovery turn', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      callCount++;
      if (url.endsWith('/api/projects') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.name).toBe('Offline Tagger');
        expect(body.idea).toBe('Local audio tagger for flac files');
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              projectId: 'proj-offline-tagger',
              snapshot: mockSnapshotRev1,
            },
            stateRevision: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/discovery') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.projectId).toBe('proj-offline-tagger');
        expect(body.expectedRevision).toBe(1);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              discoveryResult: {
                turnResult: {
                  summary: 'Initial analysis completed',
                  confidence: 0.85,
                  areasCovered: ['target_user', 'mvp_scope'],
                },
                suggestedOverviewItems: [],
                newGaps: [],
                newRisks: [],
                nextQuestions: [],
              },
              snapshot: mockSnapshotRev2,
              diagnostics: {
                durationMs: 120,
                totalTokens: 500,
              },
            },
            stateRevision: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    // Step 1: Create project
    const createRes = await client.createProject({
      name: 'Offline Tagger',
      idea: 'Local audio tagger for flac files',
    });
    expect(createRes.projectId).toBe('proj-offline-tagger');
    expect(createRes.snapshot.metadata.stateRevision).toBe(1);

    // Step 2: Trigger initial discovery turn
    const discRes = await client.runDiscoveryTurn('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      expectedRevision: 1,
    });
    expect(discRes.snapshot.metadata.stage).toBe('broad-pass');
    expect(discRes.snapshot.metadata.stateRevision).toBe(2);

    // Verified: exactly 2 calls (1 create + 1 discovery)
    expect(callCount).toBe(2);
  });

  it('2. Initial Discovery Failure: Preserves project snapshot without throwing unhandled rejection', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/projects') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              projectId: 'proj-offline-tagger',
              snapshot: mockSnapshotRev1,
            },
            stateRevision: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/discovery')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'PROVIDER_PROCESS_FAILED',
              message: 'Local provider process terminated unexpectedly',
              recoverable: true,
            },
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    const createRes = await client.createProject({
      name: 'Offline Tagger',
      idea: 'Local audio tagger for flac files',
    });
    expect(createRes.projectId).toBe('proj-offline-tagger');

    // Discovery fails with 502
    await expect(
      client.runDiscoveryTurn('proj-offline-tagger', {
        projectId: 'proj-offline-tagger',
        expectedRevision: 1,
      })
    ).rejects.toThrow('Local provider process terminated unexpectedly');
  });

  it('3. Open Project Flow: Returns existing project snapshot by projectId', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/projects/open')) {
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
    const openRes = await client.openProject({ projectId: 'proj-offline-tagger' });

    expect(openRes.snapshot.metadata.projectId).toBe('proj-offline-tagger');
    expect(openRes.snapshot.metadata.stage).toBe('broad-pass');
    expect(openRes.snapshot.metadata.stateRevision).toBe(2);
  });
});
