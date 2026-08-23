import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient } from '../src/api/client.js';
import type {
  InputRef,
  TimelineView,
  AddInputResponse,
} from '@project-architect/contracts';

describe('Phase 5.4: Input Materials & Event Timeline Integration Tests', () => {
  const dummyBaseUrl = 'http://127.0.0.1:3001';

  it('1. Upload Text Material: Calls POST /inputs with expectedRevision and returns analysis-available inputRef', async () => {
    let called = false;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/inputs') && init?.method === 'POST') {
        called = true;
        const body = JSON.parse(init.body as string);
        expect(body.kind).toBe('text');
        expect(body.filename).toBe('specs.md');
        expect(body.content).toContain('Support FLAC tag parsing');
        expect(body.expectedRevision).toBe(1);

        const inputRef: InputRef = {
          id: 'input:inp-01',
          kind: 'text',
          label: 'specs.md',
          storageRef: 'inputs/inp-01/source.md',
          status: 'ready',
          analysisAvailability: 'available',
          createdAt: '2026-08-23T00:00:00Z',
          summary: 'FLAC audio specification requirements',
        };

        const responseData: AddInputResponse = {
          inputRef,
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
    const res = await client.addInput('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      kind: 'text',
      filename: 'specs.md',
      content: '# Audio Specifications\nSupport FLAC tag parsing without network overhead.',
      expectedRevision: 1,
    });

    expect(called).toBe(true);
    expect(res.inputRef.id).toBe('input:inp-01');
    expect(res.inputRef.analysisAvailability).toBe('available');
    expect(res.inputRef.status).toBe('ready');
  });

  it('2. Upload Image Material: Remains strictly unavailable for LLM textual analysis', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/inputs') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.kind).toBe('image');
        expect(body.filename).toBe('mockup.png');

        const inputRef: InputRef = {
          id: 'input:inp-02',
          kind: 'image',
          label: 'mockup.png',
          storageRef: 'inputs/inp-02/source.png',
          status: 'saved',
          analysisAvailability: 'unavailable',
          createdAt: '2026-08-23T00:00:00Z',
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: { inputRef },
            stateRevision: 3,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.addInput('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      kind: 'image',
      filename: 'mockup.png',
      content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      expectedRevision: 2,
    });

    expect(res.inputRef.kind).toBe('image');
    expect(res.inputRef.analysisAvailability).toBe('unavailable');
  });

  it('3. GET /timeline returns pure derived projection without sensitive path leaks', async () => {
    const mockTimelineData: TimelineView = {
      sourceStateRevision: 3,
      projectId: 'proj-offline-tagger',
      totalEvents: 3,
      events: [
        {
          id: 'evt-01',
          kind: 'project_created',
          occurredAt: '2026-08-23T00:00:00Z',
          sourceStateRevision: 1,
          title: '创建项目',
          summary: '项目 "Offline Tagger" 建立',
          actor: 'user',
          relatedRefs: [],
          visibility: 'user',
        },
        {
          id: 'evt-02',
          kind: 'input_added',
          occurredAt: '2026-08-23T00:05:00Z',
          sourceStateRevision: 2,
          title: '挂载输入材料',
          summary: '添加了 specs.md',
          actor: 'user',
          relatedRefs: ['input:inp-01'],
          visibility: 'user',
        },
        {
          id: 'evt-03',
          kind: 'decision_confirmed',
          occurredAt: '2026-08-23T00:10:00Z',
          sourceStateRevision: 3,
          title: '确立核心决策',
          summary: '确立了: Windows 10/11 离线桌面应用',
          actor: 'user',
          relatedRefs: ['decision:dec-01'],
          visibility: 'user',
        },
      ],
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/timeline')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: mockTimelineData,
            stateRevision: 3,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const timeline = await client.getProjectTimeline('proj-offline-tagger');

    expect(timeline.projectId).toBe('proj-offline-tagger');
    expect(timeline.totalEvents).toBe(3);
    expect(timeline.events[0].kind).toBe('project_created');
    expect(timeline.events[1].kind).toBe('input_added');
    expect(timeline.events[2].kind).toBe('decision_confirmed');
    // Ensure no filesystem absolute paths in summary
    expect(timeline.events[1].summary).not.toContain('C:\\');
    expect(timeline.events[1].summary).not.toContain('/home/');
  });

  it('4. Concurrency Protection: Input upload with outdated revision returns 409', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'STATE_REVISION_CONFLICT',
            message: 'State revision mismatch: expected 1, current 3',
            recoverable: true,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.addInput('proj-offline-tagger', {
        projectId: 'proj-offline-tagger',
        kind: 'text',
        filename: 'notes.txt',
        content: 'some text',
        expectedRevision: 1,
      });
      expect.fail('Should have thrown 409 ApiClientError');
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('STATE_REVISION_CONFLICT');
    }
  });
});
