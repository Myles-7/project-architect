import { describe, it, expect } from 'vitest';
import { timelineProjection } from '../src/view/TimelineProjection.js';
import type { ProjectSnapshot, AgentRunTrace } from '@project-architect/contracts';

describe('Phase 4.9.3: Derived Event Timeline Projection', () => {
  const createTestSnapshot = (): ProjectSnapshot => ({
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      name: 'Timeline Audit App',
      stage: 'deep-dive',
      stateRevision: 5,
      projectTags: ['Desktop'],
      inputRefs: [
        {
          id: 'input:inp-01',
          kind: 'text',
          label: 'reqs.txt',
          storageRef: 'inputs/inp-01/source.txt',
          status: 'ready',
          analysisAvailability: 'available',
          createdAt: '2026-08-23T08:05:00.000Z',
        },
      ],
      updatedAt: '2026-08-23T08:30:00.000Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      sections: [],
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      items: [
        {
          id: 'dec-01',
          area: 'target_user',
          statement: 'Lossless audio collectors using D:\\Music\\Local library',
          status: 'locked',
          origin: 'user',
          evidenceRefs: ['question:q-01'],
          resolvedGapRefs: ['gap:gap-01'],
          createdAt: '2026-08-23T08:15:00.000Z',
          updatedAt: '2026-08-23T08:20:00.000Z',
        },
      ],
      traces: [
        {
          id: 'trace-01',
          questionRef: 'question:q-01',
          userAnswer: 'Targeting local FLAC power users',
          decisionRef: 'decision:dec-01',
          stateChanges: [
            { ref: 'decision:dec-01', action: 'decision-confirmed' },
            { ref: 'gap:gap-01', action: 'gap-addressed' },
          ],
          createdAt: '2026-08-23T08:15:00.000Z',
        },
      ],
      history: [],
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      items: [],
      history: [],
    },
    gaps: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      gaps: [
        {
          id: 'gap-01',
          area: 'target_user',
          topic: 'Target persona',
          reason: 'Specify target user',
          severity: 'normal',
          status: 'addressed',
        },
      ],
      conflicts: [],
      tensions: [],
      history: [],
    },
    risks: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      items: [],
      history: [],
    },
    questions: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      items: [
        {
          id: 'q-01',
          question: 'Who is the primary user?',
          reason: 'User clarity',
          importance: 'high',
          status: 'answered',
          answer: 'Targeting local FLAC power users',
          options: [],
          allowFreeInput: true,
          createdAt: '2026-08-23T08:10:00.000Z',
          updatedAt: '2026-08-23T08:15:00.000Z',
        },
      ],
      history: [],
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      current: {
        id: 'readiness-01',
        status: 'ready',
        reviewedAt: '2026-08-23T08:25:00.000Z',
        requiredAreas: ['target_user'],
        warnings: [],
        issues: [],
        assumptionRefs: [],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'approved',
      },
      history: [],
    },
    documents: {
      schemaVersion: 1,
      projectId: 'proj-timeline-test',
      updatedAt: '2026-08-23T08:30:00.000Z',
      manifest: {
        generatedAt: '2026-08-23T08:30:00.000Z',
        sourceRevision: 5,
        items: [
          {
            type: 'agents',
            title: 'Coding Agent Guidelines',
            path: 'AGENTS.md',
          },
        ],
      },
      history: [],
    },
  });

  const mockAgentRuns: AgentRunTrace[] = [
    {
      id: 'run-01',
      mode: 'broad-pass',
      promptProfile: 'default',
      contextProfile: 'default',
      schemaProfile: 'b2-unified',
      startedAt: '2026-08-23T08:08:00.000Z',
      completedAt: '2026-08-23T08:09:00.000Z',
      provider: 'antigravity-cli',
      tokens: 1400,
      durationMs: 1000,
      stateRevisionBefore: 1,
      stateRevisionAfter: 2,
    },
  ];

  it('1. Audit Chain: Traces Question Answer -> Decision Confirmation -> Gap Addressed progression', () => {
    const snap = createTestSnapshot();
    const timeline = timelineProjection(snap, mockAgentRuns);

    // 1.1 Question Answered event
    const qAnswerEvent = timeline.events.find((e) => e.kind === 'question_answered');
    expect(qAnswerEvent).toBeDefined();
    expect(qAnswerEvent?.summary).toContain('Who is the primary user');
    expect(qAnswerEvent?.relatedRefs).toContain('question:q-01');

    // 1.2 Decision Confirmed & Gap Addressed events from DecisionTrace
    const gapAddressedEvent = timeline.events.find((e) => e.kind === 'gap_addressed');
    expect(gapAddressedEvent).toBeDefined();
    expect(gapAddressedEvent?.relatedRefs).toContain('gap:gap-01');
    expect(gapAddressedEvent?.relatedRefs).toContain('decision:dec-01');

    // 1.3 Decision Locked event
    const lockedEvent = timeline.events.find((e) => e.kind === 'decision_locked');
    expect(lockedEvent).toBeDefined();
    expect(lockedEvent?.relatedRefs).toContain('decision:dec-01');
  });

  it('2. Agent Run & Revision Correlation: Correctly correlates discovery runs to state revisions', () => {
    const snap = createTestSnapshot();
    const timeline = timelineProjection(snap, mockAgentRuns);

    const discoveryEvent = timeline.events.find((e) => e.kind === 'discovery_turn');
    expect(discoveryEvent).toBeDefined();
    expect(discoveryEvent?.sourceStateRevision).toBe(2);
    expect(discoveryEvent?.metadata?.durationMs).toBe(1000);
    expect(discoveryEvent?.actor).toBe('agent');
  });

  it('3. Deterministic Sorting & Deduplication: Stable timestamp ordering without duplicate entries', () => {
    const snap = createTestSnapshot();
    const timeline1 = timelineProjection(snap, mockAgentRuns);
    const timeline2 = timelineProjection(snap, mockAgentRuns);

    // Identical output across calls
    expect(timeline1).toEqual(timeline2);

    // Strictly ascending timestamp order
    for (let i = 0; i < timeline1.events.length - 1; i++) {
      const t1 = new Date(timeline1.events[i].occurredAt).getTime();
      const t2 = new Date(timeline1.events[i + 1].occurredAt).getTime();
      expect(t1).toBeLessThanOrEqual(t2);
    }

    // No duplicate event IDs
    const ids = timeline1.events.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('4. Security & Sanitization: Strips host absolute file paths and excludes raw prompt/envelopes', () => {
    const snap = createTestSnapshot();
    const timeline = timelineProjection(snap, mockAgentRuns);

    const serialized = JSON.stringify(timeline);
    expect(serialized).not.toContain('D:\\Music\\Local');
    expect(serialized).toContain('[file-path]');
    expect(serialized).not.toContain('rawEnvelope');
    expect(serialized).not.toContain('promptText');
  });

  it('5. Immutability: Pure function does not mutate input snapshot or agent runs', () => {
    const snap = createTestSnapshot();
    const beforeSnap = JSON.stringify(snap);
    const beforeRuns = JSON.stringify(mockAgentRuns);

    timelineProjection(snap, mockAgentRuns);

    expect(JSON.stringify(snap)).toBe(beforeSnap);
    expect(JSON.stringify(mockAgentRuns)).toBe(beforeRuns);
  });
});
