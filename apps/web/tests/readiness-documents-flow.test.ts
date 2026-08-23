import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient } from '../src/api/client.js';
import type {
  ReadinessView,
  DocumentListView,
  GenerateDocumentsResponse,
  ReadDocumentResponse,
  ProjectSnapshot,
} from '@project-architect/contracts';

describe('Phase 5.5: Readiness Review, Approval Gate & Document Delivery Integration Tests', () => {
  const dummyBaseUrl = 'http://127.0.0.1:3001';

  const mockReadinessView: ReadinessView = {
    sourceStateRevision: 4,
    projectId: 'proj-offline-tagger',
    level: 4,
    score: 88,
    status: 'ready',
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
        areaId: 'mvp_scope',
        title: 'MVP Scope',
        isSatisfied: true,
        decisionRef: 'decision:dec-02',
        blockingGapRefs: [],
      },
      {
        areaId: 'technical_boundary',
        title: 'Technical Boundary',
        isSatisfied: true,
        decisionRef: 'decision:dec-03',
        blockingGapRefs: [],
      },
    ],
    blockingIssues: [],
    warnings: ['Local file permissions assumed'],
    activeAssumptions: [
      {
        ref: 'assumption:asm-01',
        statement: 'User has write access to music folder',
      },
    ],
  };

  const mockDocumentListView: DocumentListView = {
    sourceStateRevision: 5,
    projectId: 'proj-offline-tagger',
    hasCompiledDocs: true,
    compiledAt: '2026-08-23T00:00:00Z',
    isManifestStale: false,
    items: [
      {
        id: 'doc-agents',
        type: 'agents_md',
        title: 'AGENTS.md Project Constitution',
        path: 'AGENTS.md',
        status: 'fresh',
        generatedAt: '2026-08-23T00:00:00Z',
        sourceRevision: 5,
        isStale: false,
      },
      {
        id: 'doc-01',
        type: 'product_definition',
        title: '01 Product Boundary & Goals',
        path: 'docs/01_PRODUCT_DEFINITION.md',
        status: 'fresh',
        generatedAt: '2026-08-23T00:00:00Z',
        sourceRevision: 5,
        isStale: false,
      },
    ],
  };

  it('1. GET /readiness returns pure derived readiness view', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/readiness')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: mockReadinessView,
            stateRevision: 4,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const view = await client.getProjectReadiness('proj-offline-tagger');

    expect(view.projectId).toBe('proj-offline-tagger');
    expect(view.level).toBe(4);
    expect(view.score).toBe(88);
    expect(view.status).toBe('ready');
    expect(view.canGenerateDocs).toBe(true);
    expect(view.areas).toHaveLength(3);
    expect(view.areas[0].isSatisfied).toBe(true);
  });

  it('2. POST /readiness/approve records user disposition with expectedRevision', async () => {
    let called = false;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/readiness/approve') && init?.method === 'POST') {
        called = true;
        const body = JSON.parse(init.body as string);
        expect(body.disposition).toBe('approved');
        expect(body.expectedRevision).toBe(4);

        const dummySnapshot: Partial<ProjectSnapshot> = {
          metadata: {
            schemaVersion: 1,
            projectId: 'proj-offline-tagger',
            name: 'Offline Tagger',
            stage: 'approved',
            stateRevision: 5,
            projectTags: [],
            inputRefs: [],
            createdAt: '2026-08-23T00:00:00Z',
            updatedAt: '2026-08-23T00:00:00Z',
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: { snapshot: dummySnapshot },
            stateRevision: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.approveReadiness('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      disposition: 'approved',
      expectedRevision: 4,
    });

    expect(called).toBe(true);
    expect(res.snapshot.metadata.stage).toBe('approved');
    expect(res.snapshot.metadata.stateRevision).toBe(5);
  });

  it('3. POST /documents/generate compiles blueprints when approved', async () => {
    let called = false;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/documents/generate') && init?.method === 'POST') {
        called = true;
        const body = JSON.parse(init.body as string);
        expect(body.expectedRevision).toBe(5);

        const responseData: GenerateDocumentsResponse = {
          manifest: {
            schemaVersion: 1,
            projectId: 'proj-offline-tagger',
            compiledAt: '2026-08-23T00:00:00Z',
            sourceStateRevision: 5,
            isStale: false,
            documents: [
              {
                id: 'doc-agents',
                type: 'agents_md',
                title: 'AGENTS.md Project Constitution',
                path: 'AGENTS.md',
                status: 'fresh',
                generatedAt: '2026-08-23T00:00:00Z',
                sourceRevision: 5,
              },
            ],
            updatedAt: '2026-08-23T00:00:00Z',
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: responseData,
            stateRevision: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.generateDocuments('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      expectedRevision: 5,
    });

    expect(called).toBe(true);
    expect(res.manifest.documents).toHaveLength(1);
    expect(res.manifest.documents[0].path).toBe('AGENTS.md');
  });

  it('4. POST /documents/generate blocked with 422 if project not approved', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'READINESS_NOT_SATISFIED',
            message: 'Cannot generate documents: user has not approved readiness.',
            recoverable: false,
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.generateDocuments('proj-offline-tagger', {
        projectId: 'proj-offline-tagger',
        expectedRevision: 1,
      });
      expect.fail('Should have thrown 422 ApiClientError');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('READINESS_NOT_SATISFIED');
    }
  });

  it('5. POST /documents/read safely returns Markdown content for relative path', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/documents/read') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        expect(body.docPath).toBe('AGENTS.md');

        const responseData: ReadDocumentResponse = {
          content: '# AGENTS.md\n\n## 1. Absolute Rules\nSingle agent runtime only.',
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: responseData,
            stateRevision: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const res = await client.readDocument('proj-offline-tagger', {
      projectId: 'proj-offline-tagger',
      docPath: 'AGENTS.md',
    });

    expect(res.content).toContain('# AGENTS.md');
    expect(res.content).toContain('Single agent runtime only.');
  });

  it('6. GET /documents returns document list view with compilation status', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/documents')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: mockDocumentListView,
            stateRevision: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);
    const docs = await client.getProjectDocuments('proj-offline-tagger');

    expect(docs.hasCompiledDocs).toBe(true);
    expect(docs.items).toHaveLength(2);
    expect(docs.items[0].path).toBe('AGENTS.md');
    expect(docs.items[0].isStale).toBe(false);
  });
});
