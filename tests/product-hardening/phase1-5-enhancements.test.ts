import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import {
  ProjectStateEngine,
  FileStorage,
  WorkspaceGuard,
  DocumentCompiler,
} from '@project-architect/core';
import { AntigravityCliProvider } from '@project-architect/agent';
import { createApp } from '../../apps/server/src/server.js';

describe('Phase 1 - 5 Enhancements Test Suite', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-p15-test-'));
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

  it('Phase 1: AntigravityCliProvider resolves executable properly', () => {
    const provider = new AntigravityCliProvider('agy');
    const resolved = provider.resolveEffectiveExecutable();
    expect(typeof resolved).toBe('string');
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('Phase 2: ProjectStateEngine applies discovery turn with allowRebase = true without conflict', async () => {
    const { projectPath } = await stateEngine.createProject({ name: 'Rebase Test', idea: 'Testing rebase' });

    // Make an edit so revision increments to 2
    await stateEngine.editOverviewItem(projectPath, 'mvp_scope', undefined, 'Scope statement', 1);
    const snapRev2 = await stateEngine.getSnapshot(projectPath);
    expect(snapRev2.metadata.stateRevision).toBe(2);

    // Call applyIntegratedDiscoveryTurn with expectedRevision = 1 and allowRebase = true
    const updatedSnap = await stateEngine.applyIntegratedDiscoveryTurn(
      projectPath,
      {
        discoveryResult: {
          candidates: [{ category: 'tech_stack', statement: 'Use TypeScript' }],
          gaps: [],
          questions: [],
          assumptions: [],
          risks: [],
        },
        prioritizedGaps: [],
        questions: [],
        autoAssumptions: [],
        newCandidates: [
          {
            id: 'dec-cand-1' as any,
            statement: 'Use TypeScript',
            status: 'candidate',
            scope: 'implementation',
            area: 'tech_stack',
            proposedBy: 'agent',
          },
        ],
        newAssumptions: [],
        newConflicts: [],
        newRisks: [],
      },
      1, // Stale base revision!
      true // allowRebase!
    );

    expect(updatedSnap.metadata.stateRevision).toBe(3);
    expect(updatedSnap.decisions.items.some((d) => d.statement === 'Use TypeScript')).toBe(true);
  });

  it('Phase 3: isDraft cannot bypass approval of current Planning stages', async () => {
    const { snapshot } = await stateEngine.createProject({ name: 'Draft Test', idea: 'Testing draft mode' });

    const res = await fetch(`${baseUrl}/api/projects/${snapshot.metadata.projectId}/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: 1,
        isDraft: true,
        operationId: 'draft-cannot-bypass',
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error.code).toBe('STAGE_NOT_APPROVED');

    // Read AGENTS.md to verify draft banner
    const readRes = await fetch(`${baseUrl}/api/projects/${snapshot.metadata.projectId}/documents/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docPath: 'AGENTS.md' }),
    });
    const readBody = await readRes.json();
    expect(readRes.status).toBe(403);
    expect(readBody.error.code).toBe('ACCESS_DENIED');
  });

  it('Phase 4: Documents write and export-to-path work cleanly', async () => {
    const { snapshot, projectPath } = await stateEngine.createProject({ name: 'Doc Write Test', idea: 'Testing doc writing' });

    // Materialize a saved historical fixture; the legacy compiler only renders in memory.
    const rendered = await new DocumentCompiler(storage).compile(projectPath, snapshot, undefined, false, { isDraft: true });
    for (const file of rendered.renderedFiles) await storage.writeText(join(projectPath, file.path), file.content);
    await storage.writeJson(join(projectPath, 'documents', 'manifest.json'), rendered.manifest);
    await stateEngine['commitManager'].commit(projectPath, 2, { metadata: snapshot.metadata, documents: { schemaVersion: 1, projectId: snapshot.metadata.projectId, items: rendered.manifest.items, updatedAt: '' } });

    // Write edited document content
    const writeRes = await fetch(`${baseUrl}/api/projects/${snapshot.metadata.projectId}/documents/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docPath: 'AGENTS.md',
        content: '# Modified AGENTS.md content for testing',
      }),
    });
    expect(writeRes.status).toBe(200);

    // Read back to verify
    const readRes = await fetch(`${baseUrl}/api/projects/${snapshot.metadata.projectId}/documents/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docPath: 'AGENTS.md' }),
    });
    const readBody = await readRes.json();
    expect(readBody.data.content).toBe('# Modified AGENTS.md content for testing');

    // Export to external folder
    const exportTargetDir = join(tempBaseDir, 'exported-codebase');
    const exportRes = await fetch(`${baseUrl}/api/projects/${snapshot.metadata.projectId}/documents/export-to-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDirectory: exportTargetDir }),
    });
    const exportBody = await exportRes.json();
    expect(exportRes.status).toBe(200);
    expect(exportBody.data.copiedCount).toBeGreaterThan(0);
    expect(await storage.exists(join(exportTargetDir, 'AGENTS.md'))).toBe(true);
  });

  it('Phase 5: Historical rollback is retired without changing the current state', async () => {
    const { projectPath, snapshot } = await stateEngine.createProject({ name: 'Rollback Test', idea: 'Testing rollback' });

    // Rev 2: add decision
    await stateEngine.editOverviewItem(projectPath, 'mvp_scope', undefined, 'Scope Version 1', 1);
    // Rev 3: change decision
    await stateEngine.editOverviewItem(projectPath, 'mvp_scope', undefined, 'Scope Version 2', 2);

    const snapRev3 = await stateEngine.getSnapshot(projectPath);
    expect(snapRev3.metadata.stateRevision).toBe(3);

    // The retired rollback endpoint must preserve Rev 3.
    const rollbackRes = await fetch(`${baseUrl}/api/projects/${snapshot.metadata.projectId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRevision: 2 }),
    });
    const rollbackBody = await rollbackRes.json();
    expect(rollbackRes.status).toBe(410);
    expect(rollbackBody.error.code).toBe('LEGACY_WORKFLOW_RETIRED');
    expect(rollbackBody).not.toHaveProperty('stateRevision');

    const unchangedSnap = await stateEngine.getSnapshot(projectPath);
    expect(unchangedSnap).toEqual(snapRev3);
  });

  it('Real-world AGY hardening: Health check reports provider status and executable path', async () => {
    const res = await fetch(`${baseUrl}/api/provider/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBeDefined();
  });
});
