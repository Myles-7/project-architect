import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('Document Compiler E2E — Todo App (Simple Project)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-todo-doc-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Compiles complete verified Markdown document pack for Todo App', async () => {
    const projectPath = join(tempBaseDir, 'todo-app');
    const { snapshot: s0 } = await stateEngine.createProject({
      projectPath,
      name: 'Minimal Todo App',
      idea: 'A minimalist local todo app for personal task tracking',
      projectTags: ['Desktop App', 'Utility'],
    });

    const mockOutput: DiscoveryResult = {
      confirmed: ['Minimal Todo App', 'A minimalist local todo app for personal task tracking'],
      candidates: ['Fast keyboard shortcuts'],
      assumptions: ['Tasks stored in local JSON format'],
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
      userMessage: 'Target user is individual developer. MVP scope is simple list and toggle done. Platform is desktop app.',
    });

    // Confirm decisions explicitly
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'target_user',
      'Individual software developers seeking distraction-free task management',
      s1.metadata.stateRevision,
      'locked'
    );
    const s2 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'mvp_scope',
      'Create, view, check off, and delete local todo items',
      s2.metadata.stateRevision,
      'locked'
    );
    const s3 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(
      projectPath,
      'user_flows',
      '1. Open app; 2. Type task and press Enter; 3. Click checkbox to complete',
      s3.metadata.stateRevision,
      'confirmed'
    );

    // Compile Documents
    const compileResult = await orchestrator.compileDocuments(projectPath);

    expect(compileResult.readiness.ready).toBe(true);
    expect(compileResult.manifest.items.length).toBe(9); // 8 core + DESKTOP_SPEC.md

    // Verify all 8 core markdown documents on disk
    expect(await storage.exists(join(projectPath, 'AGENTS.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'PROJECT.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'PRODUCT.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'USER_FLOWS.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'UX_UI_SPEC.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'TECHNICAL_GUIDE.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'DEVELOPMENT_PLAN.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'ACCEPTANCE.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'docs', 'specs', 'DESKTOP_SPEC.md'))).toBe(true);
    expect(await storage.exists(join(projectPath, 'documents.json'))).toBe(true);

    // Check AGENTS.md content
    const agentsContent = await storage.readText(join(projectPath, 'AGENTS.md'));
    expect(agentsContent).toContain('Minimal Todo App — Coding Agent Guidelines');
    expect(agentsContent).toContain('[Locked: User]');
    expect(agentsContent).toContain('Create, view, check off, and delete local todo items');

    // Verify snapshot stage is documents-generated
    const finalSnapshot = await stateEngine.getSnapshot(projectPath);
    expect(finalSnapshot.metadata.stage).toBe('documents-generated');
    expect(finalSnapshot.documents?.items.length).toBe(9);
  });
});
