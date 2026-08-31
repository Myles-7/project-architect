import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Document Compiler E2E — AI Knowledge Base (Medium Dynamic Project)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-aikb-doc-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles verified Markdown document pack including dynamic AI_SPEC.md', async () => {
    const projectPath = join(tempBaseDir, 'ai-knowledge-base');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'AI Knowledge Base',
      idea: 'Local-first personal second brain with local and cloud model embedding support',
      projectTags: ['Desktop App', 'AI Product', 'Knowledge Base'],
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['AI Knowledge Base', 'Local-first personal second brain'],
      candidates: ['Vector semantic search'],
      assumptions: ['Local embedding model default is ONNX based'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };
    mockProvider.setMockResponse(mockOutput);

    // Turn 1
    await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: s0.metadata.stateRevision,
      userMessage: 'Target user is knowledge workers. MVP scope is markdown ingestion, hybrid search, and local vector index.',
    });

    // Confirm decisions explicitly
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Researchers, knowledge workers, and engineers managing private notes',
      s1.metadata.stateRevision,
      'locked'
    );
    const s2 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'mvp_scope',
      'Local markdown parsing, SQLite-vec semantic search, and dual embedding options',
      s2.metadata.stateRevision,
      'locked'
    );
    const s3 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'technical_boundary',
      '100% Local data ownership, optional user-configured cloud API keys',
      s3.metadata.stateRevision,
      'locked'
    );
    const s4 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'user_flows',
      '1. Import notes; 2. Auto-embed in background; 3. Ask question via semantic search',
      s4.metadata.stateRevision,
      'confirmed'
    );

    // Compile Documents
    const compileResult = await orchestrator.compileDocuments(projectPath);

    expect(compileResult.readiness.ready).toBe(true);
    expect(compileResult.manifest.items.length).toBe(10); // 8 core + AI_SPEC.md + DESKTOP_SPEC.md

    // Verify TECHNICAL_GUIDE.md and specs/AI_SPEC.md are generated
    expect(await storage.exists(join(projectPath, 'docs', 'TECHNICAL_GUIDE.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'specs', 'AI_SPEC.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'specs', 'DESKTOP_SPEC.md'))).toBe(true);
    const aiSpecContent = await storage.readText(join(projectPath, 'docs', 'specs', 'AI_SPEC.md'));
    expect(aiSpecContent).toContain('AI & Intelligence Specification');

    // Verify AGENTS.md locked decisions
    const agentsContent = await storage.readText(join(projectPath, 'AGENTS.md'));
    expect(agentsContent).toContain('100% Local data ownership');
    expect(agentsContent).toContain('dual embedding options');

    // Verify PRODUCT.md
    const productContent = await storage.readText(join(projectPath, 'docs', 'PRODUCT.md'));
    expect(productContent.toLowerCase()).toContain('dual embedding options');
  });
});
