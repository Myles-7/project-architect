import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine } from '../../packages/core/src/engine/ProjectStateEngine.js';
import { FileStorage } from '../../packages/core/src/storage/FileStorage.js';
import { DocumentCompiler } from '../../packages/core/src/documents/DocumentCompiler.js';
import { DocumentRenderer } from '../../packages/core/src/documents/DocumentRenderer.js';
import type { GapItem, DecisionItem } from '@project-architect/contracts';

describe('Reliability Suite 3: User Trust & Fact Grounding', () => {
  let tempBaseDir: string;
  let projectPath: string;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let compiler: DocumentCompiler;
  let renderer: DocumentRenderer;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-rel-trust-'));
    projectPath = join(tempBaseDir, 'trust-project');
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage);
    compiler = new DocumentCompiler(storage);
    renderer = new DocumentRenderer(storage);

    await engine.createProject({
      projectPath,
      name: 'Trust Safeguard Project',
      idea: 'Testing fine-grained authority and fact grounding',
    });
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Gap Resolution Precision: Confirming candidate A resolves ONLY gap A; unrelated gap B remains open', async () => {
    const snap = await engine.getSnapshot(projectPath);

    const gapUser: GapItem = {
      id: 'gap-user',
      area: 'target_user',
      topic: 'User group unspecified',
      reason: 'Need target user definition',
      severity: 'normal',
      status: 'open',
    };
    const gapDb: GapItem = {
      id: 'gap-db',
      area: 'technical_boundary',
      topic: 'Storage mechanism unspecified',
      reason: 'Need database choice',
      severity: 'critical',
      status: 'open',
    };
    snap.gaps.gaps.push(gapUser, gapDb);

    const candUser: DecisionItem = {
      id: 'dec-user',
      area: 'target_user',
      statement: 'Independent Software Engineers',
      status: 'candidate',
      origin: 'agent',
      evidenceRefs: ['gap:gap-user'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    snap.decisions.items.push(candUser);

    await engine['commitManager'].commit(projectPath, snap.metadata.stateRevision + 1, {
      metadata: snap.metadata,
      decisions: snap.decisions,
      gaps: snap.gaps,
    });

    const s1 = await engine.getSnapshot(projectPath);
    // Confirm dec-user
    const s2 = await engine.confirmDecision(projectPath, 'decision:dec-user', s1.metadata.stateRevision);

    // Gap A (gap-user) resolved, Gap B (gap-db) MUST REMAIN OPEN
    expect(s2.gaps.gaps.find((g) => g.id === 'gap-user')?.status).toBe('addressed');
    expect(s2.gaps.gaps.find((g) => g.id === 'gap-db')?.status).toBe('open');
  });

  it('2. Unapproved Document Gate: Blocks compile without explicit user disposition and preserves stage', async () => {
    const s0 = await engine.getSnapshot(projectPath);
    await engine.addDecision(projectPath, 'target_user', 'Engineers', s0.metadata.stateRevision, 'confirmed');
    const s1 = await engine.getSnapshot(projectPath);
    await engine.addDecision(projectPath, 'mvp_scope', 'Local compiler', s1.metadata.stateRevision, 'confirmed');

    // Read-only historical rendering fixture; no retired write is invoked.
    const s2 = await engine.getSnapshot(projectPath);
    const sReview = structuredClone(s2); sReview.metadata.stage = 'readiness-review';
    expect(sReview.metadata.stage).toBe('readiness-review');
    expect(sReview.readiness.current?.userDisposition).toBe('pending');

    // Compile attempt must throw
    await expect(compiler.compile(projectPath, sReview, undefined, false)).rejects.toThrow(/requires explicit user approval/);

    // Stage must not change
    const afterAttempt = await engine.getSnapshot(projectPath);
    expect(afterAttempt).toEqual(s2);
  });

  it('3. Fact Grounding in Generated Docs: Eliminates hallucinated facts, outputs explicit warning markers for missing areas', async () => {
    const s0 = await engine.getSnapshot(projectPath);
    await engine.addDecision(projectPath, 'target_user', 'Command-line power users', s0.metadata.stateRevision, 'confirmed');
    const snap = await engine.getSnapshot(projectPath);

    const renderedProject = await renderer.renderDocument(
      { type: 'project', title: 'PROJECT.md', path: 'docs/PROJECT.md', required: true },
      snap
    );
    const renderedProduct = await renderer.renderDocument(
      { type: 'product', title: 'PRODUCT.md', path: 'docs/PRODUCT.md', required: true },
      snap
    );

    // 1. Must NOT contain fabricated defaults
    expect(renderedProject).not.toContain('通用开发者与技术人员 (General Developers)');
    expect(renderedProduct).not.toContain('数据全部保存在本地，无云端同步');

    // 2. Must contain grounded statement and source attribution
    expect(renderedProject).toContain('Command-line power users');
    expect(renderedProject).toContain('Source: Decision');

    // 3. Unresolved areas must contain explicit Warning markers
    expect(renderedProduct).toContain('*(Warning: No explicit decision or assumption confirmed for "mvp_scope"');
  });
});
