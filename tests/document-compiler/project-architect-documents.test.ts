import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';
import { renderHistoricalDocuments } from '../fixtures/historical-documents.js';

describe('Historical Document Renderer — Project Architect (Complex Self-Hosting Project)', () => {
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

    const initialIdea = s0.decisions.items.find((decision) => decision.statement === 'AI project architecture workbench helping users define software ideas before AI coding');
    expect(initialIdea?.status).toBe('candidate');
    const confirmedInitial = await stateEngine.confirmDecision(projectPath, `decision:${initialIdea!.id}`, s0.metadata.stateRevision);
    expect(confirmedInitial.decisions.items.find((decision) => decision.id === initialIdea!.id)?.confirmedBy).toBe('user');

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
      expectedRevision: confirmedInitial.metadata.stateRevision,
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
      'Core State Engine, Discovery Intelligence, B3 Constitution, Document Compiler',
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

    // Render the historical fixture without publication
    const compileResult = await renderHistoricalDocuments(projectPath, storage);
    expect(compileResult.filesAfter).toEqual(compileResult.filesBefore);
    expect(compileResult.manifest.sourceRevision).toBe(compileResult.snapshot.metadata.stateRevision);
    expect(new Set(compileResult.renderedFiles.map(file => file.content)).size).toBe(compileResult.renderedFiles.length);

    expect(compileResult.readiness.ready).toBe(true);
    // Includes 8 core + AI_SPEC.md + DESKTOP_SPEC.md + SECURITY_SPEC.md = 11 documents
    expect(compileResult.manifest.items.length).toBe(11);

    // Verify the complete historical document set rendered in memory
    expect(compileResult.has('AGENTS.md')).toBe(true);
    expect(compileResult.has('docs/PROJECT.md')).toBe(true);
    expect(compileResult.has('docs/PRODUCT.md')).toBe(true);
    expect(compileResult.has('docs/USER_FLOWS.md')).toBe(true);
    expect(compileResult.has('docs/UX_UI_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/TECHNICAL_GUIDE.md')).toBe(true);
    expect(compileResult.has('docs/DEVELOPMENT_PLAN.md')).toBe(true);
    expect(compileResult.has('docs/ACCEPTANCE.md')).toBe(true);
    expect(compileResult.has('docs/specs/AI_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/specs/DESKTOP_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/specs/SECURITY_SPEC.md')).toBe(true);

    // Verify AGENTS.md locked decisions
    const agentsContent = compileResult.content('AGENTS.md');
    expect(agentsContent).toContain('Single Provider Call per turn, No external database');
    expect(agentsContent).toContain('Local file persistence in JSON format');

    // Verify ACCEPTANCE.md
    const acceptanceContent = compileResult.content('docs/ACCEPTANCE.md');
    expect(acceptanceContent).toContain('Definition of Done (DoD)');
  });
});
