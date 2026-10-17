import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage, DocumentDiffEngine } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';
import { renderHistoricalDocuments } from '../fixtures/historical-documents.js';

describe('Historical Golden Document Review 1 — SpaceCleaner (Desktop Utility)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let diffEngine: DocumentDiffEngine;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-space-cleaner-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
    diffEngine = new DocumentDiffEngine();
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles high-trust development pack with strict Source Attribution and Level 5 readiness', async () => {
    const projectPath = join(tempBaseDir, 'space-cleaner');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'SpaceCleaner',
      idea: 'Fast local disk cleaner for software developers cleaning build artifacts and cache folders',
      projectTags: ['Desktop App', 'Utility', 'Developer Tool'],
    });

    const initialIdea = s0.decisions.items.find((decision) => decision.statement === 'Fast local disk cleaner for software developers cleaning build artifacts and cache folders');
    expect(initialIdea?.status).toBe('candidate');
    const confirmedInitial = await stateEngine.confirmDecision(projectPath, `decision:${initialIdea!.id}`, s0.metadata.stateRevision);
    expect(confirmedInitial.decisions.items.find((decision) => decision.id === initialIdea!.id)?.confirmedBy).toBe('user');

    const mockOutput: DiscoveryResult = {
      confirmed: ['SpaceCleaner', 'Fast local disk cleaner for developers'],
      candidates: ['Cloud statistics upload'],
      assumptions: ['Deletions move files to OS Recycle Bin safely'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };
    mockProvider.setMockResponse(mockOutput);

    // Turn 1 Discovery
    await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: confirmedInitial.metadata.stateRevision,
      userMessage: 'Target user is software engineers. Core problem is build cache node_modules consuming disk space. MVP scope is scan and safely delete.',
    });

    // Establish complete confirmed knowledge state
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Software engineers and power users needing rapid cleanup of bulky build artifacts',
      s1.metadata.stateRevision,
      'locked'
    );
    const s2 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'core_problem',
      'Build artifacts (node_modules, target, .cache) silently accumulate and waste gigabytes of disk storage',
      s2.metadata.stateRevision,
      'confirmed'
    );
    const s3 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'mvp_scope',
      'Scan user-selected directories for known artifact patterns and delete via Recycle Bin',
      s3.metadata.stateRevision,
      'locked'
    );
    const s4 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'user_flows',
      '1. Select root directory; 2. Click Scan; 3. Review discovered artifact list; 4. Click Clean',
      s4.metadata.stateRevision,
      'confirmed'
    );
    const s5 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'technical_boundary',
      '100% Offline execution, no telemetry, direct native filesystem access',
      s5.metadata.stateRevision,
      'locked'
    );

    // Render the historical fixture without publication
    const compileResult = await renderHistoricalDocuments(projectPath, storage);
    expect(compileResult.filesAfter).toEqual(compileResult.filesBefore);
    expect(compileResult.manifest.sourceRevision).toBe(compileResult.snapshot.metadata.stateRevision);
    expect(new Set(compileResult.renderedFiles.map(file => file.content)).size).toBe(compileResult.renderedFiles.length);

    // 1. Check Readiness & Maturity
    expect(compileResult.readiness.ready).toBe(true);
    expect(compileResult.readiness.maturityLevel).toBe('Level 5: Stable');
    expect(compileResult.readiness.score).toBeGreaterThanOrEqual(95);

    // 2. Check Document Manifest
    expect(compileResult.manifest.items.length).toBe(10); // 8 core + DESKTOP_SPEC.md + PRIVACY_SPEC.md
    expect(compileResult.has('docs/TECHNICAL_GUIDE.md')).toBe(true);
    expect(compileResult.has('docs/specs/DESKTOP_SPEC.md')).toBe(true);
    expect(compileResult.has('docs/specs/PRIVACY_SPEC.md')).toBe(true);

    // 3. Check Source Attribution in AGENTS.md
    const agentsContent = compileResult.content('AGENTS.md');
    expect(agentsContent).toContain('[Locked: User]');
    expect(agentsContent).toContain('Source: Decision');
    expect(agentsContent).toContain('100% Offline execution, no telemetry');
    expect(agentsContent).toContain('[Active Assumption]');

    // 4. Verify Diff Engine reports all documents up-to-date
    const finalSnapshot = await stateEngine.getSnapshot(projectPath);
    const diff = diffEngine.diff(finalSnapshot, compileResult.manifest);
    expect(diff.every((d) => d.status === 'up-to-date')).toBe(true);
  });
});
