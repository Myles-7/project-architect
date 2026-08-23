import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Document Compiler E2E — Project Architect (Complex Self-Hosting Project)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-pa-doc-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles self-hosting architecture documentation package with 100% fidelity', async () => {
    const projectPath = join(tempBaseDir, 'project-architect');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Project Architect',
      idea: 'AI project architecture workbench helping users define software ideas before AI coding',
      projectTags: ['Desktop App', 'AI Product', 'Developer Tool', 'Security'],
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['Project Architect', 'AI project architecture workbench'],
      candidates: ['Visual diagram generator'],
      assumptions: ['Local file persistence in JSON format', 'Two-phase state commit with atomic rollback'],
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
      userMessage: 'Target user is software engineers and AI coders. MVP scope is Discovery Engine, State Store, and Document Compiler.',
    });

    // Confirm core architectural decisions
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'AI coding developers, architects, and technical project leads',
      s1.metadata.stateRevision,
      'locked'
    );
    const s2 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'mvp_scope',
      'Core State Engine, Discovery Intelligence, B2.1 Constitution, Document Compiler',
      s2.metadata.stateRevision,
      'locked'
    );
    const s3 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'technical_boundary',
      'Single Provider Call per turn, No external database, Local JSON file persistence',
      s3.metadata.stateRevision,
      'locked'
    );
    const s4 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'user_flows',
      '1. Enter Idea; 2. Answer Clarification Questions; 3. Review Overview; 4. Compile Markdown Pack',
      s4.metadata.stateRevision,
      'confirmed'
    );

    // Compile Documents
    const compileResult = await orchestrator.compileDocuments(projectPath);

    expect(compileResult.readiness.ready).toBe(true);
    // Includes 7 core + AI_SPEC.md + SECURITY.md = 9 documents
    expect(compileResult.manifest.items.length).toBe(9);

    // Verify all files on disk
    expect(await storage.exists(join(projectPath, 'AGENTS.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'PROJECT.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'PRODUCT.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'USER_FLOWS.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'UX_UI_SPEC.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'DEVELOPMENT_PLAN.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'ACCEPTANCE.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'AI_SPEC.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'SECURITY.md'))).toBe(true);

    // Verify AGENTS.md locked decisions
    const agentsContent = await storage.readText(join(projectPath, 'AGENTS.md'));
    expect(agentsContent).toContain('Single Provider Call per turn, No external database');
    expect(agentsContent).toContain('Local file persistence in JSON format');

    // Verify ACCEPTANCE.md
    const acceptanceContent = await storage.readText(join(projectPath, 'docs', 'ACCEPTANCE.md'));
    expect(acceptanceContent).toContain('Definition of Done (DoD)');
  });
});
