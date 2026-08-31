import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { ProjectStateEngine, FileStorage, WorkspaceGuard, projectOverviewProjection } from '@project-architect/core';
import { createApp } from '../../apps/server/src/server.js';

describe('Structured Project Creation (Task 1.3)', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-structured-create-'));
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

  it('Task 1.3: Atomically creates multi-area Confirmed decisions from initialIntent', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '考研计划助手',
        initialIntent: {
          targetUser: '备考研究生的中国大学生',
          coreProblem: '复习时间碎片化，缺乏系统性每日规划与动态调整机制',
          desiredOutcome: '通过桌面端工具获得清晰可行的每日任务安排与复习进度',
          constraints: '纯本地离线使用，首版不包含社交与移动端',
        },
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);

    const snapshot = body.data.snapshot;
    const decisions = snapshot.decisions.items;

    // 1. Desired outcome -> project_overview
    const overviewDec = decisions.find(
      (d: any) => d.area === 'project_overview' && d.statement.includes('清晰可行的每日任务安排')
    );
    expect(overviewDec).toBeDefined();
    expect(overviewDec.status).toBe('confirmed');
    expect(overviewDec.origin).toBe('user');
    expect(overviewDec.confirmedBy).toBe('user');

    // 2. Target user & Core problem -> 2 target_user decisions
    const targetUserDecs = decisions.filter((d: any) => d.area === 'target_user');
    expect(targetUserDecs.length).toBe(2);
    expect(targetUserDecs.some((d: any) => d.statement.includes('备考研究生'))).toBe(true);
    expect(targetUserDecs.some((d: any) => d.statement.includes('复习时间碎片化'))).toBe(true);
    targetUserDecs.forEach((d: any) => {
      expect(d.status).toBe('confirmed');
      expect(d.origin).toBe('user');
      expect(d.confirmedBy).toBe('user');
    });

    // 3. Constraints -> technical_boundary
    const techDec = decisions.find(
      (d: any) => d.area === 'technical_boundary' && d.statement.includes('纯本地离线使用')
    );
    expect(techDec).toBeDefined();
    expect(techDec.status).toBe('confirmed');
    expect(techDec.origin).toBe('user');

    // 4. Evidence reference consistency: all initial decisions link to same initial idea input
    const initialInputRef = snapshot.metadata.inputRefs[0]?.id;
    expect(initialInputRef).toBeDefined();
    for (const d of [overviewDec, ...targetUserDecs, techDec]) {
      expect(d.evidenceRefs).toContain(initialInputRef);
    }

    // 5. Overview projection has populated non-empty sections
    const overviewProjection = projectOverviewProjection(snapshot);
    const populatedSectionIds = overviewProjection.sections.filter((s) => s.items.length > 0).map((s) => s.id);
    expect(populatedSectionIds).toContain('project_overview');
    expect(populatedSectionIds).toContain('target_user');
    expect(populatedSectionIds).toContain('technical_boundary');
  });

  it('Task 1.3: Rejects creation when neither idea nor initialIntent is provided', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '空项目',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('Task 1.3: Supports legacy free-form idea creation', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '自由文本项目',
        idea: '一个极简的桌面倒计时软件',
      }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.snapshot.decisions.items.length).toBeGreaterThanOrEqual(1);
  });
});
