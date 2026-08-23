import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../apps/server/src/server.js';
import { WorkspaceGuard, ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AntigravityCliProvider } from '@project-architect/agent';

describe('Reliability Suite 1: Security Safeguards', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let app: Express;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-rel-sec-'));
    workspaceRoot = join(tempBaseDir, 'workspace');
    guard = new WorkspaceGuard(workspaceRoot);
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage, guard);

    app = createApp({
      engine,
      guard,
      workspaceRoot,
      useMockAI: true,
    });
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Shell Injection Prevention: AntigravityCliProvider uses direct spawn without shell execution', async () => {
    const provider = new AntigravityCliProvider(
      process.platform === 'win32' ? 'cmd.exe' : 'sh'
    );

    // Attempt shell injection payload in contextText
    const maliciousPayload = 'Test idea & echo INJECTED > injection.txt | whoami';
    const result = await provider.complete({
      requestId: 'req-sec-1',
      task: 'discovery-turn',
      mode: 'broad-pass',
      promptProfile: 'default',
      schemaProfile: 'b2-unified',
      prompt: 'System prompt',
      schemaPath: join(process.cwd(), 'experiments', 'agent-benchmark', 'schemas', 'b2-unified.schema.json'),
      contextText: maliciousPayload,
      timeoutMs: 3000,
    });

    // In direct spawn (shell: false), cmd/sh does not interpret operators as chained commands
    expect(result.status).toBeDefined();
    // Verify no injected file was created in cwd
    expect(await storage.exists(join(process.cwd(), 'injection.txt'))).toBe(false);
  });

  it('2. Path Traversal Guard: Rejects directory traversal and escaped filenames', () => {
    // Project ID traversal
    expect(() => guard.validateProjectId('../escaped-project')).toThrow(/only alphanumeric characters/);
    expect(() => guard.validateProjectId('..\\escaped-project')).toThrow(/only alphanumeric characters/);
    expect(() => guard.validateProjectId('foo/bar')).toThrow(/only alphanumeric characters/);

    // Filename traversal
    expect(() => guard.validateFilename('../../etc/passwd')).toThrow(/forbidden/);
    expect(() => guard.validateFilename('..\\..\\windows\\system32\\calc.exe')).toThrow(/forbidden/);
    expect(() => guard.validateFilename('sub/nested/file.txt')).toThrow(/forbidden/);
  });

  it('3. Workspace Escape via Symlink: Rejects paths pointing outside workspace boundary', async () => {
    const outsideDir = join(tempBaseDir, 'outside-secret');
    await storage.ensureDir(outsideDir);
    await storage.writeText(join(outsideDir, 'secret.json'), '{"secret":true}');

    const symlinkTarget = join(guard.projectsDir, 'symlinked-project');
    await storage.ensureDir(guard.projectsDir);

    try {
      await symlink(outsideDir, symlinkTarget, 'dir');
      // Asserting containment on the symlink must detect resolution outside projectsDir
      expect(() => guard.assertContained(guard.projectsDir, symlinkTarget)).toThrow(
        /Path escapes allowed directory boundary/
      );
    } catch (e: any) {
      // On Windows without Developer Mode, symlink creation may require privilege; test passes if thrown or caught
      if (e.code !== 'EPERM') {
        throw e;
      }
    }
  });

  it('4. Localhost CORS Policy: Rejects untrusted origins, allows localhost and vscode webview', async () => {
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as any).port;
    const url = `http://127.0.0.1:${port}/api/health`;

    try {
      const resForbidden = await fetch(url, {
        headers: { Origin: 'https://malicious-site.com' },
      });
      expect(resForbidden.status).toBe(403);
      const bodyForbidden: any = await resForbidden.json();
      expect(bodyForbidden.error.message).toContain('CORS policy blocked');

      const resAllowed1 = await fetch(url, {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(resAllowed1.status).toBe(200);

      const resAllowed2 = await fetch(url, {
        headers: { Origin: 'vscode-webview://webview-panel' },
      });
      expect(resAllowed2.status).toBe(200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
