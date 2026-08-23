import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Golden Project Case 1: Simple Todo App (Phase 3.6)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-golden-todo-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Verifies simple project does not over-question and rapidly converges in 2 turns', async () => {
    // Turn 1: Create simple project
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'simple-todo'),
      name: 'Minimal Todo',
      idea: '我想做一个极简的桌面待办事项清单工具，按天管理任务，支持完成打勾和快捷键添加。',
      projectTags: ['Desktop App', 'Utility Tool'],
    });

    const turn1Output: DiscoveryResult = {
      confirmed: ['极简桌面待办清单工具', '按天管理任务与打勾标记'],
      candidates: ['全局快捷键呼出与极速新建任务'],
      assumptions: ['数据保存在本地单个 todo.json 文件中', '已完成任务默认保留 30 天历史'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'high',
          reason: '首发版本是否需要支持跨设备同步或标签分类',
          impact: '决定 UI 是单列表极简还是多视图',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'high',
          question: '针对【target_user】：首发版本是否需要支持跨设备同步或标签分类？',
          reason: '决定首发版本是单机极简清单还是轻量项目管理工具。',
          recommendation: '建议首发坚持纯单机单列表极简清单，不引入分类与网络同步',
          recommendation_reason: '保持极速响应与零配置上手',
          options: [
            { label: '纯单机极简清单，专注今日任务与快速记录', impact: '极致简单，开箱即用' },
            { label: '支持项目标签分组与归档', impact: '管理能力更强，操作稍多' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(turn1Output);

    const res1 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '我想做一个极简的桌面待办事项清单工具。',
    });

    const s1 = res1.snapshot;
    // Assertion 1: Question budget strictly bounded to 1
    expect(s1.questions.items.length).toBe(1);
    expect(['critical', 'high']).toContain(s1.questions.items[0]?.importance);

    // Assertion 2: Low-risk defaults cleanly captured as active assumptions
    expect(s1.assumptions.items.length).toBeGreaterThanOrEqual(2);
    expect(s1.assumptions.items.some((a) => a.statement.includes('todo.json'))).toBe(true);

    // Turn 2: User answers single question to reach convergence
    const { snapshot: s2 } = await stateEngine.editOverviewItem(
      projectPath,
      'target_user',
      undefined,
      '首发版本定位：纯单机极简清单，专注今日任务与极速记录，排除标签与网络同步',
      2
    );

    expect(s2.metadata.stateRevision).toBe(3);
    const targetSection = s2.overview.sections.find((s) => s.id === 'target_user');
    expect(targetSection?.maturity).toBe('mostly-clear');
  });
});
