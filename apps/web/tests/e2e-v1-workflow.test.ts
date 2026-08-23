import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient } from '../src/api/client.js';
import type {
  ProjectSnapshot,
  RunDiscoveryTurnResponse,
  AnswerQuestionResponse,
  ReadinessView,
  GenerateDocumentsResponse,
  ReadDocumentResponse,
  TimelineView,
} from '@project-architect/contracts';

describe('Phase 5.6: API Client Workflow Test (Client Mock Tier)', () => {
  const dummyBaseUrl = 'http://127.0.0.1:3001';

  it('Executes full 10-step lifecycle: Create -> Discover -> Answer -> Lock -> Upload -> Timeline -> Review -> Approve -> Generate -> Read', async () => {
    let currentRevision = 1;
    const projectId = 'proj-flac-tagger';

    // In-memory simulated server state
    let serverSnapshot: ProjectSnapshot = {
      metadata: {
        schemaVersion: 1,
        projectId,
        name: 'FLAC Audio Tagger',
        stage: 'created',
        stateRevision: 1,
        projectTags: ['audio', 'desktop'],
        inputRefs: [],
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      },
      overview: {
        schemaVersion: 1,
        projectId,
        sections: [],
        updatedAt: '2026-08-23T00:00:00Z',
      },
      decisions: {
        schemaVersion: 1,
        projectId,
        items: [],
        traces: [],
        updatedAt: '2026-08-23T00:00:00Z',
      },
      assumptions: {
        schemaVersion: 1,
        projectId,
        items: [],
        updatedAt: '2026-08-23T00:00:00Z',
      },
      gaps: {
        schemaVersion: 1,
        projectId,
        gaps: [],
        conflicts: [],
        tensions: [],
        updatedAt: '2026-08-23T00:00:00Z',
      },
      risks: {
        schemaVersion: 1,
        projectId,
        items: [],
        updatedAt: '2026-08-23T00:00:00Z',
      },
      questions: {
        schemaVersion: 1,
        projectId,
        items: [],
        updatedAt: '2026-08-23T00:00:00Z',
      },
      readiness: {
        schemaVersion: 1,
        projectId,
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

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      // 1. Create Project
      if (url.endsWith('/api/projects') && method === 'POST') {
        currentRevision = 1;
        serverSnapshot.metadata.stateRevision = currentRevision;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              projectId,
              projectPath: `C:\\projects\\${projectId}`,
              snapshot: serverSnapshot,
            },
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 2. Initial Discovery
      if (url.includes('/discovery') && method === 'POST') {
        expect(body.expectedRevision).toBe(currentRevision);
        currentRevision++;
        serverSnapshot.metadata.stateRevision = currentRevision;
        serverSnapshot.questions.items = [
          {
            id: 'q-01',
            issueRef: 'gap:gap-01',
            importance: 'critical',
            question: 'Is network socket streaming in scope or strictly local offline?',
            reason: 'Determines security and protocol architecture.',
            recommendation: 'Strictly offline local filesystem',
            recommendationReason: 'Eliminates auth dependencies.',
            options: [
              { label: 'Strictly offline local filesystem', impact: 'Zero cloud latency' },
              { label: 'Hybrid streaming', impact: 'Adds socket listener' },
            ],
            allowFreeInput: true,
            status: 'shown',
            createdAt: '2026-08-23T00:00:00Z',
          },
        ];

        const discoveryRes: RunDiscoveryTurnResponse = {
          discoveryResult: {
            confirmed: ['Local FLAC Tag Editor'],
            candidates: ['Native Windows desktop application'],
            assumptions: ['User runs Windows 10 or 11 64-bit'],
            unknowns: [],
            risks: ['File locking by audio players during tag write'],
            conflicts: [],
            tensions: [],
            gaps: [],
            questions: [],
          },
          snapshot: serverSnapshot,
          diagnostics: { durationMs: 250, totalTokens: 850 },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: discoveryRes,
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Answer Question
      if (url.endsWith('/questions/answer') && method === 'POST') {
        expect(body.expectedRevision).toBe(currentRevision);
        expect(body.questionRef).toBe('question:q-01');
        currentRevision++;
        serverSnapshot.metadata.stateRevision = currentRevision;
        serverSnapshot.decisions.items.push({
          id: 'dec-01',
          area: 'technical_boundary',
          statement: 'Strictly offline local filesystem',
          status: 'confirmed',
          origin: 'user',
          createdAt: '2026-08-23T00:00:00Z',
          updatedAt: '2026-08-23T00:00:00Z',
        });

        const ansRes: AnswerQuestionResponse = {
          decisionRef: 'decision:dec-01',
          traceRef: 'trace:tr-01',
        };
        return new Response(
          JSON.stringify({
            success: true,
            data: ansRes,
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 4. Lock Decision
      if (url.endsWith('/decisions/lock') && method === 'POST') {
        expect(body.expectedRevision).toBe(currentRevision);
        expect(body.decisionRef).toBe('decision:dec-01');
        currentRevision++;
        serverSnapshot.metadata.stateRevision = currentRevision;
        serverSnapshot.decisions.items[0].status = 'locked';

        return new Response(
          JSON.stringify({
            success: true,
            data: { snapshot: serverSnapshot },
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 5. Upload Material
      if (url.endsWith('/inputs') && method === 'POST') {
        expect(body.expectedRevision).toBe(currentRevision);
        currentRevision++;
        serverSnapshot.metadata.stateRevision = currentRevision;

        const inputRef = {
          id: 'input:inp-01',
          kind: body.kind,
          label: body.filename,
          storageRef: `inputs/inp-01/${body.filename}`,
          status: 'ready' as const,
          analysisAvailability: (body.kind === 'text' ? 'available' : 'unavailable') as 'available' | 'unavailable',
          createdAt: '2026-08-23T00:00:00Z',
        };
        serverSnapshot.metadata.inputRefs.push(inputRef);

        return new Response(
          JSON.stringify({
            success: true,
            data: { inputRef },
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 6. View Timeline
      if (url.endsWith('/timeline') && method === 'GET') {
        const timelineView: TimelineView = {
          sourceStateRevision: currentRevision,
          projectId,
          totalEvents: 4,
          events: [
            {
              id: 'evt-01',
              kind: 'project_created',
              occurredAt: '2026-08-23T00:00:00Z',
              sourceStateRevision: 1,
              title: '创建项目',
              summary: '项目建立',
              actor: 'user',
              relatedRefs: [],
              visibility: 'user',
            },
            {
              id: 'evt-02',
              kind: 'question_answered',
              occurredAt: '2026-08-23T00:05:00Z',
              sourceStateRevision: 3,
              title: '确立决策',
              summary: '回答了问题并确立决策',
              actor: 'user',
              relatedRefs: ['decision:dec-01'],
              visibility: 'user',
            },
          ],
        };
        return new Response(
          JSON.stringify({
            success: true,
            data: timelineView,
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 7. Readiness Review
      if (url.endsWith('/readiness/review') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              readinessResult: {
                status: 'ready',
                warnings: [],
                issues: [],
                assumptions: [],
                missing_areas: [],
                recommended_next_action: 'Proceed to document compilation',
              },
              snapshot: serverSnapshot.readiness.current,
            },
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.endsWith('/readiness') && method === 'GET') {
        const readinessView: ReadinessView = {
          sourceStateRevision: currentRevision,
          projectId,
          level: 4,
          score: 90,
          status: 'ready',
          isReadyForDocs: true,
          userDisposition: serverSnapshot.readiness.current.userDisposition,
          canGenerateDocs: serverSnapshot.readiness.current.userDisposition === 'approved',
          areas: [
            {
              areaId: 'technical_boundary',
              title: 'Technical Boundary',
              isSatisfied: true,
              decisionRef: 'decision:dec-01',
              blockingGapRefs: [],
            },
          ],
          blockingIssues: [],
          warnings: [],
          activeAssumptions: [],
        };
        return new Response(
          JSON.stringify({
            success: true,
            data: readinessView,
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 8. Approve Readiness
      if (url.endsWith('/readiness/approve') && method === 'POST') {
        expect(body.expectedRevision).toBe(currentRevision);
        expect(body.disposition).toBe('approved');
        currentRevision++;
        serverSnapshot.metadata.stateRevision = currentRevision;
        serverSnapshot.metadata.stage = 'approved';
        serverSnapshot.readiness.current.userDisposition = 'approved';

        return new Response(
          JSON.stringify({
            success: true,
            data: { snapshot: serverSnapshot },
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 9. Generate Documents
      if (url.endsWith('/documents/generate') && method === 'POST') {
        expect(body.expectedRevision).toBe(currentRevision);
        expect(serverSnapshot.readiness.current.userDisposition).toBe('approved');

        currentRevision++;
        serverSnapshot.metadata.stateRevision = currentRevision;
        serverSnapshot.metadata.stage = 'documents-generated';

        const genRes: GenerateDocumentsResponse = {
          manifest: {
            schemaVersion: 1,
            projectId,
            compiledAt: '2026-08-23T00:00:00Z',
            sourceStateRevision: currentRevision,
            isStale: false,
            items: [
              {
                id: 'doc-agents',
                type: 'agents',
                title: 'AGENTS.md Project Constitution',
                path: 'AGENTS.md',
                status: 'generated',
                generatedAt: '2026-08-23T00:00:00Z',
                sourceRevision: currentRevision,
              },
            ],
            updatedAt: '2026-08-23T00:00:00Z',
          },
        };

        return new Response(
          JSON.stringify({
            success: true,
            data: genRes,
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 10. Read Document
      if (url.endsWith('/documents/read') && method === 'POST') {
        expect(body.docPath).toBe('AGENTS.md');
        const readRes: ReadDocumentResponse = {
          content: '# AGENTS.md\n\n## 1. Source of Truth\nProject State in packages/core is the sole SSOT.',
        };
        return new Response(
          JSON.stringify({
            success: true,
            data: readRes,
            stateRevision: currentRevision,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Unhandled mock request: ${method} ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    // Step 1: Create Project
    const createRes = await client.createProject({
      name: 'FLAC Audio Tagger',
      idea: 'Offline high-performance audio metadata editor',
    });
    expect(createRes.projectId).toBe(projectId);

    // Step 2: Discovery Turn
    const discoveryRes = await client.runDiscoveryTurn(projectId, {
      projectId,
      userMessage: 'I need batch tagging for FLAC files',
      expectedRevision: 1,
    });
    expect(discoveryRes.snapshot.metadata.stateRevision).toBe(2);

    // Step 3: Answer Question
    const ansRes = await client.answerQuestion(projectId, {
      projectId,
      questionRef: 'question:q-01',
      answer: 'Strictly offline local filesystem',
      expectedRevision: 2,
    });
    expect(ansRes.decisionRef).toBe('decision:dec-01');

    // Step 4: Lock Decision
    const lockRes = await client.lockDecision(projectId, {
      projectId,
      decisionRef: 'decision:dec-01',
      expectedRevision: 3,
    });
    expect(lockRes.snapshot.metadata.stateRevision).toBe(4);

    // Step 5: Upload Material
    const inputRes = await client.addInput(projectId, {
      projectId,
      kind: 'text',
      filename: 'formats.md',
      content: '# Supported Formats: FLAC, MP3, OGG',
      expectedRevision: 4,
    });
    expect(inputRes.inputRef.analysisAvailability).toBe('available');

    // Step 6: View Timeline
    const timeline = await client.getProjectTimeline(projectId);
    expect(timeline.totalEvents).toBe(4);

    // Step 7: Readiness Review
    await client.reviewReadiness(projectId, { projectId });
    const readiness = await client.getProjectReadiness(projectId);
    expect(readiness.level).toBe(4);

    // Step 8: User Approval
    const approveRes = await client.approveReadiness(projectId, {
      projectId,
      disposition: 'approved',
      expectedRevision: 5,
    });
    expect(approveRes.snapshot.metadata.stage).toBe('approved');

    // Step 9: Generate Documents
    const genDocsRes = await client.generateDocuments(projectId, {
      projectId,
      expectedRevision: 6,
    });
    expect(genDocsRes.manifest.items[0].path).toBe('AGENTS.md');

    // Step 10: Read Markdown
    const doc = await client.readDocument(projectId, {
      projectId,
      docPath: 'AGENTS.md',
    });
    expect(doc.content).toContain('Project State in packages/core is the sole SSOT.');
  });
});
