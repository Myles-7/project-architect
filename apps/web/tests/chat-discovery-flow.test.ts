import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient } from '../src/api/client.js';
import type {
  ProjectSnapshot,
  RunDiscoveryTurnResponse,
  AnswerQuestionResponse,
} from '@project-architect/contracts';

describe('Phase 5.3: Discovery Chat & Structured Question Flow Integration Tests', () => {
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
      items: [
        {
          id: 'q-01',
          issueRef: 'gap:gap-01',
          importance: 'critical',
          question: 'Should the tagger support remote audio streaming protocols or strictly local filesystem?',
          reason: 'Architecture boundary depends on whether network sockets and auth are required.',
          recommendation: 'Strictly local filesystem only',
          recommendationReason: 'Eliminates cloud dependencies, auth overhead, and token latency.',
          options: [
            { label: 'Strictly local filesystem only', impact: 'Zero cloud dependencies, maximum speed and offline privacy.' },
            { label: 'Hybrid local + DLNA/UPnP streaming', impact: 'Requires network discovery daemon and socket security.' },
          ],
          allowFreeInput: true,
          status: 'shown',
          createdAt: '2026-08-23T00:00:00Z',
        },
      ],
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

  it('1. Send Message triggers exactly ONE discovery request and returns structured output', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      callCount++;
      if (url.includes('/discovery') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.userMessage).toBe('I only care about local FLAC batch metadata editing.');
        expect(body.expectedRevision).toBe(1);

        const updatedSnapshot: ProjectSnapshot = {
          ...mockSnapshotRev1,
          metadata: { ...mockSnapshotRev1.metadata, stateRevision: 2, stage: 'broad-pass' },
        };

        const responseData: RunDiscoveryTurnResponse = {
          discoveryResult: {
            confirmed: ['Local FLAC batch metadata editing'],
            candidates: ['Use libflac or music-metadata for fast parsing'],
            assumptions: ['User has write permissions to audio directories'],
            unknowns: [],
            risks: ['File corruption during batch save without atomic swap'],
            conflicts: [],
            tensions: [],
            gaps: [
              {
                area: 'technical_boundary',
                severity: 'critical',
                reason: 'Network vs local boundary undefined',
                impact: 'Affects socket security model',
                dependency: '',
                should_ask_user: true,
              },
            ],
            questions: [],
          },
          snapshot: updatedSnapshot,
          diagnostics: {
            durationMs: 420,
            totalTokens: 1100,
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: responseData,
            stateRevision: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.runDiscoveryTurn('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      userMessage: 'I only care about local FLAC batch metadata editing.',
      expectedRevision: 1,
    });

    expect(callCount).toBe(1);
    expect(res.discoveryResult.confirmed).toContain('Local FLAC batch metadata editing');
    expect(res.discoveryResult.candidates).toHaveLength(1);
    expect(res.snapshot.metadata.stateRevision).toBe(2);
  });

  it('2. Question Action 1: Record Answer calls only /questions/answer and promotes answer to confirmed decision', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      callCount++;
      if (url.endsWith('/questions/answer') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.questionRef).toBe('question:q-01');
        expect(body.answer).toBe('Strictly local filesystem only');
        expect(body.expectedRevision).toBe(1);

        const responseData: AnswerQuestionResponse = {
          decisionRef: 'decision:dec-01',
          traceRef: 'trace:tr-01',
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: responseData,
            stateRevision: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.answerQuestion('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      questionRef: 'question:q-01',
      answer: 'Strictly local filesystem only',
      expectedRevision: 1,
    });

    expect(callCount).toBe(1);
    expect(res.decisionRef).toBe('decision:dec-01');
  });

  it('3. Question Action 2: Answer & Continue calls only /discovery with questionAnswer payload', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      callCount++;
      if (url.includes('/discovery') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.questionAnswer.questionRef).toBe('question:q-01');
        expect(body.questionAnswer.selectedOption).toBe('Strictly local filesystem only');
        expect(body.expectedRevision).toBe(1);

        const updatedSnapshot: ProjectSnapshot = {
          ...mockSnapshotRev1,
          metadata: { ...mockSnapshotRev1.metadata, stateRevision: 2 },
          questions: {
            ...mockSnapshotRev1.questions,
            items: mockSnapshotRev1.questions.items.map((q) =>
              q.id === 'q-01' ? { ...q, status: 'answered' as const, answer: 'Strictly local filesystem only' } : q
            ),
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              discoveryResult: {
                confirmed: ['Strictly local filesystem only'],
                candidates: [],
                assumptions: [],
                unknowns: [],
                risks: [],
                conflicts: [],
                tensions: [],
                gaps: [],
                questions: [],
              },
              snapshot: updatedSnapshot,
              diagnostics: { durationMs: 350, totalTokens: 900 },
            },
            stateRevision: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.runDiscoveryTurn('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      questionAnswer: {
        questionRef: 'question:q-01',
        selectedOption: 'Strictly local filesystem only',
      },
      expectedRevision: 1,
    });

    expect(callCount).toBe(1);
    expect(res.snapshot.questions.items.find((q) => q.id === 'q-01')?.status).toBe('answered');
  });

  it('4. Provider Error: 502 Bad Gateway preserves state without crashing', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'PROVIDER_PROCESS_FAILED',
            message: 'Antigravity CLI process returned non-zero exit code',
            recoverable: true,
          },
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.runDiscoveryTurn('proj-offline-tagger', {
        projectId: 'proj-offline-tagger',
        userMessage: 'Test prompt',
        expectedRevision: 1,
      });
      expect.fail('Should have thrown 502 ApiClientError');
    } catch (err: any) {
      expect(err.statusCode).toBe(502);
      expect(err.code).toBe('PROVIDER_PROCESS_FAILED');
    }
  });
});
