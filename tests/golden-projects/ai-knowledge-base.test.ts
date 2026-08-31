import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Golden Project Case 2: AI Knowledge Base (Phase 3.6)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-golden-kb-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Verifies medium complexity project discovers genuine architectural gaps with trade-off recommendations', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'ai-knowledge-base'),
      name: 'AI Second Brain',
      idea: '我想做一个面向独立研究员的本地优先 AI 知识库，支持 PDF/Markdown 导入、本地向量语义搜索以及双向链接笔记。',
      projectTags: ['Desktop App', 'AI Product', 'Local-First'],
    });

    const turn1Output: DiscoveryResult = {
      confirmed: ['面向独立研究员的本地优先 AI 知识库', '支持 PDF/Markdown 导入与本地向量搜索'],
      candidates: ['支持段落级语义检索高亮与来源溯源引用'],
      assumptions: ['向量索引在本地存储与计算，模型离线运行', '默认单个文档切块大小为 500 字符'],
      unknowns: [],
      risks: ['本地大模型初次加载显存消耗较大'],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'technical_boundary',
          severity: 'critical',
          reason: '首发版本的向量嵌入与 LLM 总结能力是纯单机离线还是支持接入公网 API Key',
          impact: '决定安装包体积、运行门槛与绝对隐私边界',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【technical_boundary】：首发版本的向量嵌入与 LLM 总结能力是纯单机离线还是支持接入公网 API Key？',
          reason: '决定产品的绝对隐私承诺与用户硬件门槛。',
          recommendation: '建议首发版本支持纯本地嵌入（如内置轻量 ONNX 模型）+ 可选配置公网 API Key',
          recommendation_reason: '兼顾离线隐私与高质量语义理解',
          options: [
            { label: '双模支持：内置轻量离线模型 + 可选配置外部 API', impact: '兼顾离线与能力上限，体验最佳' },
            { label: '严格纯离线：仅运行本地模型，禁止任何外网调用', impact: '隐私最高，但对本地机器配置有要求' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(turn1Output);

    const res1 = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '我想做一个面向独立研究员的本地优先 AI 知识库。',
    });

    const s1 = res1.snapshot;
    // Assertion 1: Discovered technical boundary trade-off
    expect(s1.gaps.gaps.some((g) => g.area === 'technical_boundary')).toBe(true);

    // Assertion 2: Quality question with whyNow and trade-off options
    expect(s1.questions.items.length).toBeGreaterThan(0);
    expect(s1.questions.items.length).toBeLessThanOrEqual(12);
    const q = s1.questions.items.find((question) => question.options.length >= 2)!;
    expect(q.whyNow).toBeDefined();
    expect(q.recommendation).toBeDefined();
    expect(q.options.length).toBeGreaterThanOrEqual(2);

    // Assertion 3: Capability Before Mechanism (0 leaks)
    const text = JSON.stringify(s1);
    expect(text).not.toMatch(/qdrant|chroma|pgvector|pinecone|sqlite-vss/i);
  });
});
