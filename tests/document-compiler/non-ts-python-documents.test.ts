import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Document Compiler E2E — Python Cloud Microservice (Zero-Bias Verification)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-python-doc-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles objective Python cloud microservice specification without TypeScript or Local-First biases', async () => {
    const projectPath = join(tempBaseDir, 'python-service');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Cloud Data Pipeline',
      idea: 'Python-based asynchronous event processing service streaming events to PostgreSQL',
      projectTags: ['Python', 'Cloud Service', 'Backend', 'Database'],
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['Cloud Data Pipeline', 'Python-based asynchronous event processing service'],
      candidates: ['Kafka connector'],
      assumptions: ['Runs in Docker container with Python 3.12'],
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
      userMessage: 'Target user is backend platform teams. MVP scope is FastAPI ingestion and PostgreSQL persistence.',
    });

    // Confirm decisions explicitly
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Data engineering teams building high-throughput event processing pipelines',
      s1.metadata.stateRevision,
      'locked'
    );

    const s2 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'mvp_scope',
      'FastAPI event ingest endpoint, async worker pool, and PostgreSQL commit queue',
      s2.metadata.stateRevision,
      'locked'
    );

    const s3 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'technical_boundary',
      'Python 3.12, FastAPI, Asyncpg, PostgreSQL database',
      s3.metadata.stateRevision,
      'locked'
    );

    const s4 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'user_flows',
      '1. Producer posts JSON event; 2. FastAPI validates schema; 3. Worker batches write to Postgres',
      s4.metadata.stateRevision,
      'confirmed'
    );

    // Compile Documents
    const compileResult = await orchestrator.compileDocuments(projectPath);

    expect(compileResult.readiness.ready).toBe(true);
    // Should have 8 core documents (no dynamic specs since no AI/desktop/etc)
    expect(compileResult.manifest.items.length).toBe(8);

    // Verify 8 core markdown documents on disk
    expect(await storage.exists(join(projectPath, 'AGENTS.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'PROJECT.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'PRODUCT.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'USER_FLOWS.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'UX_UI_SPEC.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'TECHNICAL_GUIDE.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'DEVELOPMENT_PLAN.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'ACCEPTANCE.md'))).toBe(true);

    // 1. Verify ACCEPTANCE.md is objective and has NO TypeScript bias
    const acceptanceContent = await storage.readText(join(projectPath, 'docs', 'ACCEPTANCE.md'));
    expect(acceptanceContent).not.toContain('TypeScript compilation');
    expect(acceptanceContent).toContain('Python code builds cleanly with static type checks');
    expect(acceptanceContent).toContain('Database transactions and relational consistency');

    // 2. Verify TECHNICAL_GUIDE.md includes platform and delegated freedom
    const techGuideContent = await storage.readText(join(projectPath, 'docs', 'TECHNICAL_GUIDE.md'));
    expect(techGuideContent).toContain('Python 3.12, FastAPI, Asyncpg, PostgreSQL database');
    expect(techGuideContent).toContain('Delegated Technical Freedom for Coding Agents');

    // 3. Verify AGENTS.md does NOT impose "Local Data First" on cloud service
    const agentsContent = await storage.readText(join(projectPath, 'AGENTS.md'));
    expect(agentsContent).not.toContain('Local Data First');
    expect(agentsContent).toContain('Strictly respect the platform, data, and runtime boundaries');
    expect(agentsContent).toContain('docs/TECHNICAL_GUIDE.md');
  });
});
