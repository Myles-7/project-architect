import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { CANONICAL_B3_AREAS, type GapItem } from '@project-architect/contracts';
import {
  ProjectStateEngine,
  FileStorage,
  WorkspaceGuard,
  QuestionComposer,
  projectOverviewProjection,
} from '@project-architect/core';
import { createApp } from '../../apps/server/src/server.js';

describe('Product Hardening Phase 0: Audit Regressions Suite (Expected Failures)', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-audit-regressions-'));
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
      await new Promise((resolve) => server.close(resolve));
      server = undefined;
    }
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Regression A01: CANONICAL_B3_AREAS must be completely consistent with Overview fixed section IDs', async () => {
    const { snapshot } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'proj-a01'),
      name: 'Area Consistency Test',
      idea: '测试领域一致性',
    });
    const overviewSectionIds = snapshot.overview.sections.map((s) => s.id);

    // [Phase 1 Target] All canonical discovery areas must exist in the overview sections without divergence
    expect(overviewSectionIds).toEqual(expect.arrayContaining([...CANONICAL_B3_AREAS]));
  });

  it('Regression A03: Decisions in trust_safety must project into an Overview section', async () => {
    const { projectPath, snapshot: initialSnapshot } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'proj-a03'),
      name: 'Trust Safety Projection Test',
      idea: '测试 trust_safety 投影',
    });

    const { decisionRef, snapshot } = await stateEngine.editOverviewItem(
      projectPath,
      'trust_safety',
      undefined,
      '坚持本地离线与零知识安全隐私承诺',
      initialSnapshot.metadata.stateRevision
    );

    // Verify decision was created
    expect(snapshot.decisions.items.some((d) => d.id === decisionRef.replace('decision:', ''))).toBe(true);

    // Verify that Overview projection has an item representing this decision
    const overview = projectOverviewProjection(snapshot);
    const projectedItem = overview.sections.flatMap((s) => s.items).find((item) => item.ref === decisionRef);

    // [Phase 1 Target] Decisions in trust_safety must be projected into Overview (e.g. mapped to technical_boundary)
    expect(projectedItem).toBeDefined();
  });

  it('Regression A11: Forking a project must rewrite projectId across all state files including overview.json', async () => {
    // 1. Create project via API
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Original Project',
        idea: '原始项目想法',
        projectId: 'proj-fork-source',
      }),
    });
    expect(createRes.status).toBe(200);

    // 2. Fork project
    const forkRes = await fetch(`${baseUrl}/api/projects/proj-fork-source/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'Forked Project' }),
    });
    expect(forkRes.status).toBe(200);
    const forkBody: any = await forkRes.json();
    const forkedProjectId = forkBody.data.project.projectId;

    // 3. Inspect state/overview.json in the forked project folder
    const forkedOverviewPath = join(workspaceRoot, 'projects', forkedProjectId, 'state', 'overview.json');
    const forkedOverview = await storage.readJson<{ projectId: string }>(forkedOverviewPath);

    // [Phase 4 Target] All state files must have their projectId updated to the new forked projectId
    expect(forkedOverview.projectId).toBe(forkedProjectId);
  });

  it('Regression A08: Fallback checklist questions must not generate verbatim identical options across different decision keys', () => {
    const composer = new QuestionComposer();
    const gap1: GapItem = {
      id: 'gap-localfirst',
      area: 'technical_boundary',
      severity: 'critical',
      decisionKey: 'chk-localfirst-ownership',
      reason: '数据本地存储与所有权机制未定义',
      impact: '影响用户数据安全性',
      status: 'open',
      shouldAskUser: true,
      priority: 'critical',
      dependency: 'none',
    };
    const gap2: GapItem = {
      id: 'gap-platform',
      area: 'technical_boundary',
      severity: 'critical',
      decisionKey: 'univ-platform-choice',
      reason: '运行平台选型未明确',
      impact: '影响技术栈选择',
      status: 'open',
      shouldAskUser: true,
      priority: 'critical',
      dependency: 'none',
    };

    const q1 = composer.compose(gap1);
    const q2 = composer.compose(gap2);

    const q1OptionLabels = q1.options.map((o) => o.label);
    const q2OptionLabels = q2.options.map((o) => o.label);

    // [Phase 3 Target] Distinct decision keys must have tailored options instead of identical fallback labels
    expect(q1OptionLabels).not.toEqual(q2OptionLabels);
  });

  it('Regression A10: Provider health check must not report ready when CLI executable is unavailable', async () => {
    const originalEnv = process.env.AGY_CLI;
    process.env.AGY_CLI = join(tempBaseDir, 'non-existent-agy-binary.exe');

    let realServer: Server | undefined;
    try {
      const realApp = createApp({
        engine: stateEngine,
        guard,
        workspaceRoot,
        useMockAI: false,
      });

      realServer = await new Promise<Server>((resolve) => {
        const s = realApp.listen(0, '127.0.0.1', () => resolve(s));
      });
      const realPort = (realServer.address() as any).port;

      const res = await fetch(`http://127.0.0.1:${realPort}/api/provider/health`);
      expect(res.status).toBe(200);
      const body: any = await res.json();

      // [Phase 4 Target] Missing CLI must yield unavailable status, never hardcoded ready
      expect(body.data.status).toBe('unavailable');
    } finally {
      if (realServer) {
        await new Promise((resolve) => realServer!.close(resolve));
      }
      if (originalEnv !== undefined) {
        process.env.AGY_CLI = originalEnv;
      } else {
        delete process.env.AGY_CLI;
      }
    }
  });
});
