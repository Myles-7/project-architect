import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';
import { renderHistoricalDocuments } from '../fixtures/historical-documents.js';

describe('Historical Document Renderer — Python Cloud Microservice (Zero-Bias Verification)', () => {
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

    const initialIdea = s0.decisions.items.find((decision) => decision.statement === 'Python-based asynchronous event processing service streaming events to PostgreSQL');
    expect(initialIdea?.status).toBe('candidate');
    const confirmedInitial = await stateEngine.confirmDecision(projectPath, `decision:${initialIdea!.id}`, s0.metadata.stateRevision);
    expect(confirmedInitial.decisions.items.find((decision) => decision.id === initialIdea!.id)?.confirmedBy).toBe('user');

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
      expectedRevision: confirmedInitial.metadata.stateRevision,
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

    // Render the historical fixture without publication
    const compileResult = await renderHistoricalDocuments(projectPath, storage);
    expect(compileResult.filesAfter).toEqual(compileResult.filesBefore);
    expect(compileResult.manifest.sourceRevision).toBe(compileResult.snapshot.metadata.stateRevision);
    expect(new Set(compileResult.renderedFiles.map(file => file.content)).size).toBe(compileResult.renderedFiles.length);

    expect(compileResult.readiness.ready).toBe(true);
    // Should have 8 core documents (no dynamic specs since no AI/desktop/etc)
    expect(compileResult.manifest.items.length).toBe(8);

    // Verify the complete historical document set rendered in memory
    expect(compileResult.has('AGENTS.md')).toBe(true);
    expect(compileResult.has('docs/PROJECT.md')).toBe(true);
    expect(compileResult.has('docs/PRODUCT.md')).toBe(true);
    expect(compileResult.has('docs/USER_FLOWS.md')).toBe(true);
    expect(compileResult.has('docs/UX_UI_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/TECHNICAL_GUIDE.md')).toBe(true);
    expect(compileResult.has('docs/DEVELOPMENT_PLAN.md')).toBe(true);
    expect(compileResult.has('docs/ACCEPTANCE.md')).toBe(true);

    // 1. Verify ACCEPTANCE.md is objective and has NO TypeScript bias
    const acceptanceContent = compileResult.content('docs/ACCEPTANCE.md');
    expect(acceptanceContent).not.toContain('TypeScript compilation');
    expect(acceptanceContent).toContain('Python code builds cleanly with static type checks');
    expect(acceptanceContent).toContain('Database transactions and relational consistency');

    // 2. Verify TECHNICAL_GUIDE.md includes platform and delegated freedom
    const techGuideContent = compileResult.content('docs/TECHNICAL_GUIDE.md');
    expect(techGuideContent).toContain('Python 3.12, FastAPI, Asyncpg, PostgreSQL database');
    expect(techGuideContent).toContain('Delegated Technical Freedom for Coding Agents');

    // 3. Verify AGENTS.md does NOT impose "Local Data First" on cloud service
    const agentsContent = compileResult.content('AGENTS.md');
    expect(agentsContent).not.toContain('Local Data First');
    expect(agentsContent).toContain('Strictly respect the platform, data, and runtime boundaries');
    expect(agentsContent).toContain('docs/TECHNICAL_GUIDE.md');
  });
});
