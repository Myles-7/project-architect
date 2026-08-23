import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult, QuestionRef } from '@project-architect/contracts';

describe('Full Multi-Turn Discovery Closed Loop (Phase 3.4)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-full-discovery-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Executes comprehensive multi-round discovery lifecycle for AI Knowledge Management Tool', async () => {
    // ==========================================
    // Round 0: Initial Raw Idea & Project Creation
    // ==========================================
    const { projectPath, snapshot: s0 } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'ai-knowledge-base'),
      name: 'AI Knowledge Vault',
      idea: '我要做一个AI知识管理工具',
      projectTags: ['Desktop App', 'AI Product', 'Local-First'],
    });

    expect(s0.metadata.stateRevision).toBe(1);
    expect(s0.metadata.stage).toBe('created');

    // Round 0 AI Response: Idea Understanding (Mode: idea-analysis)
    const round0Output: DiscoveryResult = {
      confirmed: ['AI知识管理工具'],
      candidates: ['支持本地文档解析与智能语义检索', '支持Markdown笔记双向链接'],
      assumptions: ['默认支持本地 Markdown 与 PDF 文档导入'],
      unknowns: ['目标受众是个人还是团队', 'AI推理是完全本地还是依赖云端API'],
      risks: ['本地模型对硬件显存要求较高'],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'critical',
          reason: '核心用户画像与痛点场景未明确',
          impact: '决定交互模式是面向个人单机还是团队协同',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [],
    };

    mockProvider.setMockResponse(round0Output);

    const res0 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '我要做一个AI知识管理工具',
    });

    const s1 = res0.snapshot;
    expect(s1.metadata.stateRevision).toBe(2);
    expect(s1.metadata.stage).toBe('broad-pass');
    expect(s1.gaps.gaps.some((g) => g.area === 'target_user')).toBe(true);

    // ==========================================
    // Round 1: Target User Clarification (Mode: question-generation)
    // ==========================================
    const round1Output: DiscoveryResult = {
      confirmed: ['AI知识管理工具'],
      candidates: [],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'critical',
          reason: '核心用户画像与痛点场景未明确',
          impact: '决定交互模式是面向个人单机还是团队协同',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【target_user】：核心用户画像与痛点场景未明确，您的首发版本规划是什么？',
          reason: '因为用户画像直接决定产品是走轻量个人单机工具还是团队知识库。',
          recommendation: '建议首发版本聚焦个人开发者与独立研究员',
          recommendation_reason: '单机离线可用，闭环验证快',
          options: [
            { label: '面向个人开发者和独立研究员，聚焦技术文献与代码笔记', impact: '单机轻量，隐私安全' },
            { label: '面向初创团队与中小企业，聚焦多端协同与知识沉淀', impact: '商业价值大，但需多端协同' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(round1Output);

    const res1 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 2,
      userMessage: '请继续帮我梳理首要问题。',
    });

    const s2 = res1.snapshot;
    expect(s2.metadata.stateRevision).toBe(3);
    expect(s2.questions.items.length).toBeGreaterThan(0);
    const userQuestion = s2.questions.items[0]!;
    expect(userQuestion.importance).toBe('critical');

    // User answers Question and confirms decision
    const selectedUserOption = userQuestion.options[0]!.label;
    const { snapshot: s3 } = await stateEngine.editOverviewItem(
      projectPath,
      'target_user',
      undefined,
      `目标用户定位：${selectedUserOption}`,
      3
    );

    expect(s3.metadata.stateRevision).toBe(4);
    const confirmedUserDec = s3.decisions.items.find((d) => d.area === 'target_user');
    expect(confirmedUserDec?.status).toBe('confirmed');
    expect(confirmedUserDec?.confirmedBy).toBe('user');

    // ==========================================
    // Round 2: MVP Scope Clarification
    // ==========================================
    const round2Output: DiscoveryResult = {
      confirmed: ['目标用户定位：面向个人开发者和独立研究员，聚焦技术文献与代码笔记'],
      candidates: ['支持本地轻量向量混合检索（BM25 + Vector）'],
      assumptions: ['单库知识文档上限设定为 10,000 篇'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'mvp_scope',
          severity: 'critical',
          reason: '首发版本是否支持云端大模型与多端同步尚未界定',
          impact: '决定底层存储架构与隐私边界',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【mvp_scope】：首发版本是否支持云端大模型与多端同步尚未界定，您的首发版本规划是什么？',
          reason: '影响初版技术架构与离线承诺。',
          recommendation: '建议首发版本坚持 100% 纯本地运行，排除云端同步',
          recommendation_reason: '最高数据隐私与本地响应速度',
          options: [
            { label: '第一版采用纯本地轻量向量检索，不连云端模型', impact: '绝对离线安全，单机运行' },
            { label: '支持可选配置 OpenAI/Claude 等公网大模型 API', impact: '检索能力更强，需用户提供 API Key' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(round2Output);

    const res2 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 4,
      userMessage: '用户定位已确认，请继续推进范围界定。',
      questionAnswer: {
        questionRef: userQuestion.id as QuestionRef,
        selectedOption: selectedUserOption,
      },
    });

    const s4 = res2.snapshot;
    expect(s4.metadata.stateRevision).toBe(6);
    const activeQuestion = s4.questions.items.find((q) => q.status === 'proposed');
    expect(activeQuestion).toBeDefined();

    // User confirms MVP Scope
    const { snapshot: s5 } = await stateEngine.editOverviewItem(
      projectPath,
      'mvp_scope',
      undefined,
      '首发版本范围：纯本地轻量向量检索，100% 离线运行，排除公网云端依赖',
      6
    );

    expect(s5.metadata.stateRevision).toBe(7);

    // ==========================================
    // Round 3: Overview Projection & Convergence Verification
    // ==========================================
    const finalSnapshot = await stateEngine.getSnapshot(projectPath);

    // Verify Overview Projection
    const targetUserSection = finalSnapshot.overview.sections.find((s) => s.id === 'target_user');
    const mvpSection = finalSnapshot.overview.sections.find((s) => s.id === 'mvp_scope');

    expect(targetUserSection?.maturity).toBe('mostly-clear');
    expect(mvpSection?.maturity).toBe('mostly-clear');
    expect(targetUserSection?.itemRefs.length).toBeGreaterThan(0);
    expect(mvpSection?.itemRefs.length).toBeGreaterThan(0);

    // Verify Decisions
    expect(finalSnapshot.decisions.items.some((d) => d.status === 'confirmed' && d.area === 'target_user')).toBe(true);
    expect(finalSnapshot.decisions.items.some((d) => d.status === 'confirmed' && d.area === 'mvp_scope')).toBe(true);

    // Verify Active Assumptions
    expect(finalSnapshot.assumptions.items.some((a) => a.status === 'active')).toBe(true);
  });
});
