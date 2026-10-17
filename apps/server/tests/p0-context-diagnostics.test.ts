/**
 * @file p0-context-diagnostics.test.ts
 * @description P0 Remediation: Verification of Context Diagnostics Input Serialization & Object Reference Handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import { ContextManager } from '@project-architect/agent';

describe('P0 Context Diagnostics Input Serialization', () => {
  let app: any;
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'pa-p0-diag-'));
    app = createApp({ useMockAI: true, workspaceRoot: workspace });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('correctly extracts InputRef object IDs and labels without [object Object] distortion', async () => {
    // 1. Create a project with initial idea
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Diagnostics Verification Project',
        idea: 'Verifying inputRefs object serialization in context diagnostics',
      })
      .expect(200);

    const projectId = createRes.body.data.projectId;
    expect(createRes.body.data.snapshot.metadata.inputRefs.length).toBeGreaterThanOrEqual(1);

    // 2. Add a second input material via discovery input endpoint
    const inputRes = await request(app)
      .post(`/api/projects/${projectId}/discovery/inputs`)
      .send({
        text: '系统要求零中心化数据库，完全采用本地文件快照两阶段提交。',
        expectedRevision: 1,
      })
      .expect(201);

    expect(inputRes.body.data.snapshot.metadata.inputRefs.length).toBe(2);

    // 3. Add a third input material
    const inputRes2 = await request(app)
      .post(`/api/projects/${projectId}/discovery/inputs`)
      .send({
        text: '补充设计需求：需要支持暗黑与浅色模式，色彩无障碍达标 WCAG AA。',
        expectedRevision: 2,
      })
      .expect(201);

    expect(inputRes2.body.data.snapshot.metadata.inputRefs.length).toBe(3);

    // 4. Request context diagnostics
    const diagRes = await request(app)
      .get(`/api/projects/${projectId}/diagnostics/context`)
      .expect(200);

    expect(diagRes.body.success).toBe(true);
    const breakdown = diagRes.body.data.diagnostics.breakdown;
    expect(Array.isArray(breakdown)).toBe(true);

    // 5. Verify NO [object Object] exists anywhere in breakdown items
    const inputItems = breakdown.filter((item: any) => item.kind === 'input');
    expect(inputItems.length).toBe(3);

    for (const item of breakdown) {
      expect(item.id).not.toContain('[object Object]');
      expect(item.label).not.toContain('[object Object]');
    }

    // 6. Verify the initial input material
    const initialInput = inputItems.find((item: any) => item.id === 'input-inp-01');
    expect(initialInput).toBeDefined();
    expect(initialInput.label).toBe('材料: Initial Idea Prompt');
    expect(initialInput.estimatedTokens).toBeGreaterThan(0);

    // 7. Verify subsequent input materials have valid unique input- IDs
    for (const item of inputItems) {
      expect(item.id).toMatch(/^input-inp-/);
      expect(item.estimatedTokens).toBeGreaterThan(0);
    }

    // 8. Verify all breakdown IDs are strictly unique (preventing React duplicate key warnings)
    const allIds = breakdown.map((item: any) => item.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('ContextManager defensively sanitizes legacy [object Object] ID and respects isExcluded flag', () => {
    const contextManager = new ContextManager();

    const mockSnapshot: any = {
      metadata: {
        projectId: 'test-proj',
        stateRevision: 3,
      },
      decisions: { items: [] },
      assumptions: { items: [] },
      gaps: { gaps: [] },
    };

    const mockMaterials = [
      {
        id: 'inp-valid-1',
        label: '有效材料.txt',
        text: '这是一段测试文本内容，用于计算 Token 预算。',
        isExcluded: false,
      },
      {
        id: '[object Object]', // simulated legacy serialization distortion
        label: '畸变材料.txt',
        text: '已失真的材料内容。',
        isExcluded: true,
      },
      {
        id: 'inp-excluded-2',
        label: '已排除材料.md',
        text: '排除材料的内容。',
        isExcluded: true,
      },
    ];

    const diag = contextManager.getContextDiagnostics(mockSnapshot, mockMaterials);
    const breakdown = diag.breakdown;

    // Zero [object Object] in any breakdown ID or label
    for (const item of breakdown) {
      expect(item.id).not.toContain('[object Object]');
      expect(item.label).not.toContain('[object Object]');
    }

    // Verify excluded items have 0% active context percentage despite non-zero estimatedTokens
    const excluded = breakdown.filter((item) => item.isExcluded);
    expect(excluded.length).toBe(2);
    for (const item of excluded) {
      expect(item.percentage).toBe(0);
      expect(item.estimatedTokens).toBeGreaterThan(0);
    }

    // Verify active items sum up to approximately 100%
    const active = breakdown.filter((item) => !item.isExcluded);
    const activePctSum = active.reduce((acc, item) => acc + item.percentage, 0);
    expect(activePctSum).toBeGreaterThanOrEqual(99.0);
    expect(activePctSum).toBeLessThanOrEqual(101.0);

    // All breakdown item IDs must be strictly unique
    const ids = breakdown.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
