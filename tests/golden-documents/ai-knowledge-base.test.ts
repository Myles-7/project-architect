import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage, DocumentDiffEngine } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';
import { renderHistoricalDocuments } from '../fixtures/historical-documents.js';

describe('Historical Golden Document Review 2 — AI Knowledge Base (AI Application)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let diffEngine: DocumentDiffEngine;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-aikb-gold-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
    diffEngine = new DocumentDiffEngine();
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles verified AI documentation with AI_SPEC and detects revision staleness upon modification', async () => {
    const projectPath = join(tempBaseDir, 'ai-kb');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'SecondBrain AI',
      idea: 'Local-first personal second brain with hybrid vector search and local AI chat assistant',
      projectTags: ['Desktop App', 'AI Product', 'Knowledge Base'],
    });

    const initialIdea = s0.decisions.items.find((decision) => decision.statement === 'Local-first personal second brain with hybrid vector search and local AI chat assistant');
    expect(initialIdea?.status).toBe('candidate');
    const confirmedInitial = await stateEngine.confirmDecision(projectPath, `decision:${initialIdea!.id}`, s0.metadata.stateRevision);
    expect(confirmedInitial.decisions.items.find((decision) => decision.id === initialIdea!.id)?.confirmedBy).toBe('user');

    const mockOutput: DiscoveryResult = {
      confirmed: ['SecondBrain AI', 'Local-first personal second brain'],
      candidates: ['Cloud sync integration'],
      assumptions: ['Local vector index uses SQLite-vec format'],
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
      userMessage: 'Target user is knowledge workers. MVP scope is note ingestion and local semantic search.',
    });

    // Establish complete confirmed state
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Researchers, knowledge workers, and software engineers managing technical notes',
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

    // Render the historical fixture without publication
    const compileResult = await renderHistoricalDocuments(projectPath, storage);
    expect(compileResult.filesAfter).toEqual(compileResult.filesBefore);
    expect(compileResult.manifest.sourceRevision).toBe(compileResult.snapshot.metadata.stateRevision);
    expect(new Set(compileResult.renderedFiles.map(file => file.content)).size).toBe(compileResult.renderedFiles.length);
    expect(compileResult.readiness.ready).toBe(true);
    expect(compileResult.manifest.items.length).toBe(10); // 8 core + AI_SPEC.md + DESKTOP_SPEC.md

    // Verify TECHNICAL_GUIDE.md and specs/AI_SPEC.md exists and has source attribution
    expect(compileResult.has('docs/TECHNICAL_GUIDE.md')).toBe(true);
    expect(compileResult.has('docs/specs/DESKTOP_SPEC.md')).toBe(true);
    const aiSpecContent = compileResult.content('docs/specs/AI_SPEC.md');
    expect(aiSpecContent).toContain('AI & Intelligence Specification');

    // Simulate state change (User changes target_user to team developers)
    const currentSnap = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Small engineering teams and collaborative research squads',
      currentSnap.metadata.stateRevision,
      'locked'
    );

    // Use Diff Engine to detect outdated documents
    const updatedSnap = await stateEngine.getSnapshot(projectPath);
    const diff = diffEngine.diff(updatedSnap, compileResult.manifest, ['target_user']);

    const targetUserAffected = diff.filter((d) => d.status === 'outdated');
    expect(targetUserAffected.length).toBeGreaterThan(0);
    expect(diff.find((d) => d.document === 'PROJECT.md')?.status).toBe('outdated');
    expect(diff.find((d) => d.document === 'PRODUCT.md')?.status).toBe('outdated');
  });
});
