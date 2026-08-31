import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../apps/server/src/server.js';
import {
  FileStorage,
  WorkspaceGuard,
  ProjectStateEngine,
} from '@project-architect/core';
import {
  MockAIProvider,
  AntigravityCliProvider,
} from '@project-architect/agent';

describe('Product Hardening Phase 4: Provider & Project Data Safety', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-p4-trust-'));
    workspaceRoot = join(tempBaseDir, 'workspace');
    guard = new WorkspaceGuard(workspaceRoot);
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage, guard);

    const app = createApp({
      engine: stateEngine,
      guard,
      workspaceRoot,
      useMockAI: true,
    });

    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server!.close(resolve));
    }
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  describe('4.2 Provider Health & Privacy Honesty', () => {
    it('MockAIProvider reports local execution without sending data off-device', async () => {
      const mock = new MockAIProvider();
      const health = await mock.healthCheck();

      expect(health.status).toBe('ready');
      expect(health.inferenceLocation).toBe('local');
      expect(health.sendsProjectContextOffDevice).toBe(false);
      expect(health.structuredOutput).toBe('supported');
      expect(health.promptCache).toBe('supported');
      expect(health.guidance).toBeDefined();
    });

    it('AntigravityCliProvider returns unavailable when executable is missing', async () => {
      const missingBin = join(tempBaseDir, 'missing-agy.exe');
      const provider = new AntigravityCliProvider(missingBin);
      const health = await provider.healthCheck();

      expect(health.status).toBe('unavailable');
      expect(health.lastFailureCode).toBe('EXECUTABLE_NOT_FOUND');
      expect(health.guidance).toContain('未在本地找到');
    });

    it('AntigravityCliProvider returns degraded and sanitizes error when probe fails', async () => {
      // Create a mock script/executable that exits with non-zero
      const mockScript = join(tempBaseDir, process.platform === 'win32' ? 'failing-agy.cmd' : 'failing-agy.sh');
      if (process.platform === 'win32') {
        await writeFile(mockScript, '@echo off\r\necho internal confidential server error 1>&2\r\nexit /b 1\r\n');
      } else {
        await writeFile(mockScript, '#!/bin/sh\necho "internal confidential server error" >&2\nexit 1\n');
        await chmod(mockScript, 0o755);
      }

      const provider = new AntigravityCliProvider(mockScript);
      const health = await provider.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.lastFailureCode).toBe('PROBE_FAILED');
      // Ensure raw confidential stderr text is NEVER leaked into user guidance
      expect(health.guidance).not.toContain('confidential');
      expect(health.guidance).toContain('脱敏');
    });

    it('Server /api/provider/health exposes inference location and data transfer transparency', async () => {
      const res = await fetch(`${baseUrl}/api/provider/health`);
      expect(res.status).toBe(200);
      const body: any = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ready');
      expect(body.data.inferenceLocation).toBe('local');
      expect(body.data.sendsProjectContextOffDevice).toBe(false);
      expect(body.data.structuredOutput).toBe('supported');
    });
  });

  describe('4.3 Safe Atomic Forking', () => {
    it('forks project end-to-end, updates all state file projectIds and creates forkedFrom metadata', async () => {
      // 1. Create source project
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Source Hardening App',
          idea: 'Initial source concept',
          projectId: 'proj-source-safe',
        }),
      });
      expect(createRes.status).toBe(200);

      // 2. Duplicate / Fork via API
      const forkRes = await fetch(`${baseUrl}/api/projects/proj-source-safe/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: 'Forked Hardening App' }),
      });
      expect(forkRes.status).toBe(200);
      const forkBody: any = await forkRes.json();
      const forkedId = forkBody.data.project.projectId;

      // 3. Verify registry reflects new forked project
      const listRes = await fetch(`${baseUrl}/api/projects`);
      const listBody: any = await listRes.json();
      const registeredFork = listBody.data.projects.find((p: any) => p.projectId === forkedId);
      expect(registeredFork).toBeDefined();
      expect(registeredFork.name).toBe('Forked Hardening App');

      // 4. Verify disk state files have new projectId
      const forkedDir = join(workspaceRoot, 'projects', forkedId);
      const overview = await storage.readJson<any>(join(forkedDir, 'state', 'overview.json'));
      expect(overview.projectId).toBe(forkedId);

      const decisions = await storage.readJson<any>(join(forkedDir, 'state', 'decisions.json'));
      expect(decisions.projectId).toBe(forkedId);

      const readiness = await storage.readJson<any>(join(forkedDir, 'state', 'readiness.json'));
      expect(readiness.projectId).toBe(forkedId);
      expect(readiness.current.userDisposition).toBe('pending');

      const projectMeta = await storage.readJson<any>(join(forkedDir, 'project.json'));
      expect(projectMeta.projectId).toBe(forkedId);
      expect(projectMeta.name).toBe('Forked Hardening App');
      expect(projectMeta.forkedFrom).toBeDefined();
      expect(projectMeta.forkedFrom.sourceProjectId).toBe('proj-source-safe');
    });
  });

  describe('4.4 Recoverable Delete & Trash Lifecycle', () => {
    it('moves deleted project to .trash, allows restore, and permanently purges from trash', async () => {
      // 1. Create project
      const projId = 'proj-trash-lifecycle';
      await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'To Be Trashed',
          idea: 'Temporary project',
          projectId: projId,
        }),
      });

      // 2. Delete project (moves to .trash)
      const deleteRes = await fetch(`${baseUrl}/api/projects/${projId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody: any = await deleteRes.json();
      expect(deleteBody.data.deleted).toBe(true);
      expect(deleteBody.data.trashed).toBe(true);
      expect(deleteBody.data.trashPath).toContain('.trash');

      // 3. Verify it does not appear in default active list
      const activeRes = await fetch(`${baseUrl}/api/projects`);
      const activeBody: any = await activeRes.json();
      expect(activeBody.data.projects.some((p: any) => p.projectId === projId)).toBe(false);

      // Verify it appears when includeTrashed=true
      const allRes = await fetch(`${baseUrl}/api/projects?includeTrashed=true`);
      const allBody: any = await allRes.json();
      const trashedItem = allBody.data.projects.find((p: any) => p.projectId === projId);
      expect(trashedItem).toBeDefined();
      expect(trashedItem.trashedAt).toBeDefined();

      // 4. Restore project
      const restoreRes = await fetch(`${baseUrl}/api/projects/${projId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(restoreRes.status).toBe(200);

      // Verify project is back in active list
      const activeAfterRestore = await fetch(`${baseUrl}/api/projects`);
      const activeAfterBody: any = await activeAfterRestore.json();
      expect(activeAfterBody.data.projects.some((p: any) => p.projectId === projId)).toBe(true);

      // 5. Trash again and purge permanently
      await fetch(`${baseUrl}/api/projects/${projId}`, { method: 'DELETE' });

      const purgeRes = await fetch(`${baseUrl}/api/projects/${projId}/purge`, {
        method: 'DELETE',
      });
      expect(purgeRes.status).toBe(200);
      const purgeBody: any = await purgeRes.json();
      expect(purgeBody.data.purged).toBe(true);

      // Verify completely gone from registry
      const finalAll = await fetch(`${baseUrl}/api/projects?includeTrashed=true`);
      const finalBody: any = await finalAll.json();
      expect(finalBody.data.projects.some((p: any) => p.projectId === projId)).toBe(false);
    });
  });
});
