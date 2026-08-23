import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Discovery Runtime End-to-End Integration Tests (Phase 2.4)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-runtime-e2e-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Executes full 5-turn Discovery Intelligence lifecycle with anti-repetition and locked protection', async () => {
    // Turn 1: Create project with initial idea
    const { projectPath, snapshot: s1 } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'smart-clipboard-dev'),
      name: 'Smart Clipboard Dev',
      idea: 'A smart clipboard manager for developers to store local code snippets',
      projectTags: ['Desktop App', 'Developer Tool'],
    });

    expect(s1.metadata.stateRevision).toBe(1);
    expect(s1.metadata.stage).toBe('created');

    // Turn 2: First Discovery Turn (AI finds gaps, Question Engine emits single critical question)
    const turn1AiResult: DiscoveryResult = {
      confirmed: ['Smart clipboard manager for local code snippets'],
      candidates: ['Support syntax highlighting for 20+ programming languages'],
      assumptions: ['Default clipboard history retention is 30 days'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'critical',
          reason: '核心开发者画像与日常高频场景未清晰界定',
          impact: '产品交互与快捷键设计无法收敛',
          dependency: 'none',
          should_ask_user: true,
        },
        {
          area: 'mvp_scope',
          severity: 'critical',
          reason: '首发版本是否支持富文本与大图片尚未定义',
          impact: '内存占用与性能指标无法评估',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【target_user】：核心开发者画像与日常高频场景未清晰界定，您的首发版本规划是什么？',
          reason: '阻塞快捷键与检索体验设计',
          recommendation: '建议首发版本聚焦独立开发者与前端工程师日常代码片段',
          recommendation_reason: '降低初版复杂度，快速验证本地剪贴板核心价值',
          options: [
            { label: '聚焦个人独立开发者与代码片段管理', impact: '范围聚焦，开发敏捷' },
            { label: '面向全职全栈团队与多语言环境', impact: '覆盖面广，但初版复杂度高' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(turn1AiResult);

    const resTurn1 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '我想做一个面向开发者的本地剪贴板工具，请帮我梳理缺口。',
    });

    const s2 = resTurn1.snapshot;
    expect(s2.metadata.stateRevision).toBe(2);
    expect(s2.metadata.stage).toBe('broad-pass');

    // Verify Gap Detection: Gaps are populated and prioritized
    expect(s2.gaps.gaps.length).toBeGreaterThanOrEqual(2);
    expect(s2.gaps.gaps[0]?.area).toBe('target_user');

    // Verify Question Engine: Exactly 1 Critical question produced
    expect(s2.questions.items.length).toBe(1);
    const q1 = s2.questions.items[0]!;
    expect(q1.importance).toBe('critical');
    expect(q1.question).toContain('target_user');
    expect(q1.options.length).toBe(2);

    // Verify Policy Engine: Low risk assumption is recorded
    expect(s2.assumptions.items.some((a) => a.statement.includes('30 days'))).toBe(true);

    // Turn 3: User answers the question & confirms decision
    const userSelectedOption = q1.options[0]!.label;
    // Mark question as answered in state
    q1.status = 'answered';
    q1.answer = userSelectedOption;

    const { snapshot: s3 } = await stateEngine.editOverviewItem(
      projectPath,
      'target_user',
      undefined,
      `目标用户定位：${userSelectedOption}`,
      2
    );

    expect(s3.metadata.stateRevision).toBe(3);
    const confirmedUserDec = s3.decisions.items.find((d) => d.area === 'target_user');
    expect(confirmedUserDec?.status).toBe('confirmed');
    expect(confirmedUserDec?.confirmedBy).toBe('user');

    // Turn 4: Next Discovery Turn (Anti-repetition advances to next gap: mvp_scope)
    const turn2AiResult: DiscoveryResult = {
      confirmed: ['目标用户定位：聚焦个人独立开发者与代码片段管理'],
      candidates: ['支持本地全文即时搜索（<50ms响应）'],
      assumptions: ['默认支持纯文本与 Markdown 格式'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'mvp_scope',
          severity: 'critical',
          reason: '首发版本是否支持富文本与大图片尚未定义',
          impact: '内存占用与性能指标无法评估',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【mvp_scope】：首发版本是否支持富文本与大图片尚未定义，您的首发版本规划是什么？',
          reason: '影响初版内存与持久化模型',
          recommendation: '建议首发版本仅支持纯文本与代码片段，排除富文本与大文件图片',
          recommendation_reason: '极简高性能',
          options: [
            { label: '仅支持纯文本与代码片段', impact: '内存占用极低，检索响应极快' },
            { label: '支持图文混合剪贴板', impact: '体积膨胀，需要本地大文件缓存' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(turn2AiResult);

    const resTurn2 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 3,
      userMessage: `我已经确认了用户定位：${userSelectedOption}。请继续分析。`,
    });

    const s4 = resTurn2.snapshot;
    expect(s4.metadata.stateRevision).toBe(4);
    // Anti-repetition: Question Engine advanced to mvp_scope question!
    const activeQuestion = s4.questions.items.find((q) => q.status === 'proposed');
    expect(activeQuestion).toBeDefined();
    expect(activeQuestion?.question).toContain('mvp_scope');

    // Turn 5: User locks a technical constraint & AI introduces conflicting suggestion
    const { decisionRef: lockedDecRef, snapshot: _s5 } = await stateEngine.editOverviewItem(
      projectPath,
      'technical_boundary',
      undefined,
      '100% 本地离线运行，绝对禁止连接云端',
      4
    );
    const s6 = await stateEngine.lockDecision(
      projectPath,
      lockedDecRef,
      5
    );

    expect(s6.metadata.stateRevision).toBe(6);

    // AI introduces conflicting suggestion: auto cloud sync
    const turn3AiResult: DiscoveryResult = {
      confirmed: [],
      candidates: ['自动将剪贴板历史同步到远程云端服务器备份'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    mockProvider.setMockResponse(turn3AiResult);

    const resTurn3 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 6,
      userMessage: '后续是否有云端备份扩展？',
    });

    const s7 = resTurn3.snapshot;
    expect(s7.metadata.stateRevision).toBe(7);

    // Locked decision remains locked
    const lockedDec = s7.decisions.items.find((d) => d.statement.includes('本地离线'));
    expect(lockedDec?.status).toBe('locked');

    // Conflict generated
    expect(s7.gaps.conflicts.length).toBe(1);
    expect(s7.gaps.conflicts[0]?.severity).toBe('critical');

    // Final check: Load freshly from disk
    const freshEngine = new ProjectStateEngine(storage);
    const loadedSnapshot = await freshEngine.loadProject(projectPath);
    expect(loadedSnapshot.metadata.stateRevision).toBe(7);
    expect(loadedSnapshot.decisions.items.length).toBe(s7.decisions.items.length);
    expect(loadedSnapshot.assumptions.items.length).toBe(s7.assumptions.items.length);
    expect(loadedSnapshot.gaps.conflicts.length).toBe(1);
  });
});
