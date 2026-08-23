import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage, DocumentDiffEngine } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Golden Document Review 1 — SpaceCleaner (Desktop Utility)', () => {
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
      expectedRevision: s0.metadata.stateRevision,
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

    // Compile
    const compileResult = await orchestrator.compileDocuments(projectPath);

    // 1. Check Readiness & Maturity
    expect(compileResult.readiness.ready).toBe(true);
    expect(compileResult.readiness.maturityLevel).toBe('Level 5: Stable');
    expect(compileResult.readiness.score).toBeGreaterThanOrEqual(95);

    // 2. Check Document Manifest
    expect(compileResult.manifest.items.length).toBe(7);

    // 3. Check Source Attribution in AGENTS.md
    const agentsContent = await storage.readText(join(projectPath, 'AGENTS.md'));
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
