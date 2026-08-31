import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Golden Project Case 3: Project Architect (Self-Hosting Complexity) (Phase 3.6)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-golden-self-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Verifies complex software decomposition, layered architecture and token metric logging', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'project-architect-self'),
      name: 'Project Architect V1',
      idea: '构建一个帮助用户在 AI Coding 前进行产品构思与架构收敛的本地工作台，采用单一 Agent 运行时与本地 JSON 状态管理。',
      projectTags: ['Desktop App', 'AI Product', 'Developer Tool'],
    });

    const complexDiscoveryOutput: DiscoveryResult = {
      confirmed: [
        'AI 产品规划工作台',
        '本地 JSON 状态持久化与单 Agent 运行时',
      ],
      candidates: [
        '四层架构：Core Engine、AI Integration、Workspace UI、Document Compiler',
        '两阶段原子状态提交与崩溃恢复保障',
      ],
      assumptions: [
        '所有数据保存在用户本地磁盘目录，无数据库依赖',
        '每次 Discovery Turn 最多触发单次主要 Provider 推理',
      ],
      unknowns: [],
      risks: [
        '若引入复杂多 Agent 轮询可能导致状态一致性破坏',
      ],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'user_flows',
          severity: 'critical',
          reason: '用户从完成 Discovery 到进入 Document Compiler 的交接标准尚未形式化',
          impact: '影响阶段流转与 Readiness 评审准确性',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【user_flows】：用户从完成 Discovery 到进入 Document Compiler 的交接标准是什么？',
          reason: '确保进入文档编译前所有关键架构决策均已被用户授权锁定。',
          recommendation: '建议通过形式化 Readiness Review（准备度评审门禁）作为前置条件',
          recommendation_reason: '防止未解决的严重冲突或空缺直接污染生成代码',
          options: [
            { label: '强制必须通过 Readiness 检查（0 阻断项）方可生成文档', impact: '工程严密性最高，保证交付物质量' },
            { label: '允许用户显式跳过告警强制导出草稿', impact: '灵活性高，但草稿文档可能不完整' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(complexDiscoveryOutput);

    const res = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '构建 Project Architect V1 架构。',
    });

    const s = res.snapshot;

    // 1. Layered candidates & assumptions safely registered
    expect(s.decisions.items.some((d) => d.statement.includes('四层架构'))).toBe(true);
    expect(s.assumptions.items.some((a) => a.statement.includes('单次主要 Provider 推理'))).toBe(true);

    // 2. B3 independent question set includes at least one critical decision.
    expect(s.questions.items.length).toBeGreaterThan(0);
    expect(s.questions.items.length).toBeLessThanOrEqual(12);
    expect(s.questions.items.some((question) => question.importance === 'critical')).toBe(true);

    // 3. Diagnostics and Token metric logging
    expect(res.diagnostics.totalTokens).toBeDefined();
    expect(res.diagnostics.durationMs).toBeGreaterThanOrEqual(0);
  });
});
