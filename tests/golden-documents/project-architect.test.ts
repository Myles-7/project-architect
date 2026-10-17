import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage, DocumentDiffEngine } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';
import { renderHistoricalDocuments } from '../fixtures/historical-documents.js';

describe('Historical Golden Document Review 3 — Project Architect (Complex Self-Hosting System)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let diffEngine: DocumentDiffEngine;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-pa-gold-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
    diffEngine = new DocumentDiffEngine();
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles full 9-document specification package with Level 5 stability and locked architecture rules', async () => {
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
      userMessage: 'Target user is software engineers. Core problem is vague requirements before AI coding. MVP scope is Discovery Engine, State Store, and Document Compiler.',
    });

    // Establish complete self-hosting knowledge state
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'AI coding developers, software architects, and tech leads',
      s1.metadata.stateRevision,
      'locked'
    );
    const s2 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'core_problem',
      'AI coding assistants hallucinate or drift in architecture when starting from vague conversational prompts',
      s2.metadata.stateRevision,
      'confirmed'
    );
    const s3 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'mvp_scope',
      'Core State Engine, Discovery Intelligence, B3 Constitution, Document Compiler',
      s3.metadata.stateRevision,
      'locked'
    );
    const s4 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'technical_boundary',
      'Single Provider Call per turn, No external database, Local JSON file persistence',
      s4.metadata.stateRevision,
      'locked'
    );
    const s5 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'user_flows',
      '1. Enter Idea; 2. Answer Clarification Questions; 3. Review Overview; 4. Compile Markdown Pack',
      s5.metadata.stateRevision,
      'confirmed'
    );
    const s6 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'ux_ui',
      'Minimal clean desktop layout with three-column workflow and overview projection',
      s6.metadata.stateRevision,
      'confirmed'
    );
    const s7 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'acceptance',
      '100% automated test coverage, strict source attribution, zero candidate leakages',
      s7.metadata.stateRevision,
      'locked'
    );

    // Render the historical fixture without publication
    const compileResult = await renderHistoricalDocuments(projectPath, storage);
    expect(compileResult.filesAfter).toEqual(compileResult.filesBefore);
    expect(compileResult.manifest.sourceRevision).toBe(compileResult.snapshot.metadata.stateRevision);
    expect(new Set(compileResult.renderedFiles.map(file => file.content)).size).toBe(compileResult.renderedFiles.length);

    // 1. Verify Level 5 Stable readiness
    expect(compileResult.readiness.ready).toBe(true);
    expect(compileResult.readiness.maturityLevel).toBe('Level 5: Stable');
    expect(compileResult.readiness.score).toBeGreaterThanOrEqual(95);

    // 2. Verify all 11 documents generated (8 core + AI_SPEC.md + DESKTOP_SPEC.md + SECURITY_SPEC.md)
    expect(compileResult.manifest.items.length).toBe(11);
    expect(compileResult.has('docs/TECHNICAL_GUIDE.md')).toBe(true);
    expect(compileResult.has('docs/specs/AI_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/specs/DESKTOP_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/specs/SECURITY_SPEC.md')).toBe(true);

    // 3. Verify AGENTS.md locked decisions and source attribution
    const agentsContent = compileResult.content('AGENTS.md');
    expect(agentsContent).toContain('Single Provider Call per turn, No external database');
    expect(agentsContent).toContain('[Locked: User]');
    expect(agentsContent).toContain('Source: Decision');

    // 4. Verify SECURITY_SPEC.md
    const securityContent = compileResult.content('docs/specs/SECURITY_SPEC.md');
    expect(securityContent).toContain('Security & Data Protection Architecture');

    // 5. Verify all documents are up-to-date
    const finalSnapshot = await stateEngine.getSnapshot(projectPath);
    const diff = diffEngine.diff(finalSnapshot, compileResult.manifest);
    expect(diff.every((d) => d.status === 'up-to-date')).toBe(true);
  });
});
