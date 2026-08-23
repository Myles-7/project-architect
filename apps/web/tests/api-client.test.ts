import { describe, it, expect, vi } from 'vitest';
import { ProjectArchitectApiClient, ApiClientError } from '../src/api/client.js';
import { ErrorCode } from '@project-architect/contracts';

describe('Phase 5.1: Type-Safe API Client', () => {
  const dummyBaseUrl = 'http://127.0.0.1:3001';

  it('1. Successfully unwraps ApiResponse<T> payloads on GET /api/health and /api/projects', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/health')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { status: 'healthy', time: '2026-08-23T00:00:00Z' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/api/projects')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              projects: [
                {
                  projectId: 'proj-001',
                  name: 'Sample App',
                  stage: 'created',
                  stateRevision: 1,
                  updatedAt: '2026-08-23T00:00:00Z',
                  projectTags: [],
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    const health = await client.checkHealth();
    expect(health.status).toBe('healthy');

    const projects = await client.listRecentProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].projectId).toBe('proj-001');
    expect(projects[0].name).toBe('Sample App');
  });

  it('2. Maps HTTP 404 Project Not Found to typed ApiClientError', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.PROJECT_NOT_FOUND,
            message: 'Project "proj-999" not found in workspace',
            recoverable: false,
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.getProjectSnapshot('proj-999');
      expect.fail('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe(ErrorCode.PROJECT_NOT_FOUND);
      expect(err.message).toBe('Project "proj-999" not found in workspace');
      expect(err.recoverable).toBe(false);
    }
  });

  it('3. Maps HTTP 409 State Revision Conflict properly', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.STATE_REVISION_CONFLICT,
            message: 'State revision mismatch: expected 1, current 2',
            recoverable: true,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.lockDecision('proj-001', {
        decisionRef: 'decision:dec-01',
        expectedRevision: 1,
      });
      expect.fail('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe(ErrorCode.STATE_REVISION_CONFLICT);
    }
  });

  it('4. Maps HTTP 422 Decision Locked / Readiness Gate Failure', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.DECISION_LOCKED,
            message: 'Decision is locked and cannot be edited directly',
            recoverable: true,
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.editOverviewItem('proj-001', {
        sectionId: 'mvp_scope',
        itemRef: 'decision:dec-01',
        newStatement: 'New statement',
        expectedRevision: 2,
      });
      expect.fail('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe(ErrorCode.DECISION_LOCKED);
    }
  });

  it('5. Maps HTTP 502 / 504 Provider Failures', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.PROVIDER_PROCESS_FAILED,
            message: 'AI Provider failed to respond',
            recoverable: true,
          },
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.runDiscoveryTurn('proj-001', {
        task: 'discovery-turn',
        mode: 'broad-pass',
        expectedRevision: 1,
      });
      expect.fail('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.statusCode).toBe(502);
      expect(err.code).toBe(ErrorCode.PROVIDER_PROCESS_FAILED);
    }
  });

  it('6. Handles network disconnect / server offline safely (status 0)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.listRecentProjects();
      expect.fail('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.statusCode).toBe(0);
      expect(err.message).toContain('无法连接到本地服务');
    }
  });

  it('7. Supports AbortController cancellation without uncaught exceptions', async () => {
    const controller = new AbortController();
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        throw error;
      }
      return new Response(JSON.stringify({ success: true, data: { status: 'ok' } }));
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    controller.abort();
    try {
      await client.checkHealth(controller.signal);
      expect.fail('Should have thrown AbortError');
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });

  it('8. Handles non-JSON responses gracefully', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      });
    });

    const client = new ProjectArchitectApiClient(dummyBaseUrl, mockFetch);

    try {
      await client.checkHealth();
      expect.fail('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.statusCode).toBe(502);
      expect(err.message).toContain('服务端响应非有效 JSON');
    }
  });
});
