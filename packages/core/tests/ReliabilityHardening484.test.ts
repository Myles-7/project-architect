import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine } from '../src/engine/ProjectStateEngine.js';
import { FileStorage } from '../src/storage/FileStorage.js';
import { DocumentCompiler } from '../src/documents/DocumentCompiler.js';
import { DocumentRenderer } from '../src/documents/DocumentRenderer.js';
import type { GapItem, ConflictItem, DecisionItem } from '@project-architect/contracts';

describe('Phase 4.8.4 Reliability Hardening: Gap Precision, Readiness Gate & Grounded Document Generation', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let compiler: DocumentCompiler;
  let renderer: DocumentRenderer;
  let projectPath: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-hardening-484-'));
    projectPath = join(tempBaseDir, 'test-project');
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    compiler = new DocumentCompiler(storage);
    renderer = new DocumentRenderer(storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Gap Precision: Confirming a decision only closes specifically linked gaps, leaving unrelated gaps open', async () => {
    // 1. Create project
    await stateEngine.createProject({
      projectPath,
      name: 'Precision Project',
      idea: 'Testing fine-grained gap resolution',
      projectTags: ['Developer Tool'],
    });

    // 2. Add two distinct open gaps
    const snap = await stateEngine.getSnapshot(projectPath);
    const gap1: GapItem = {
      id: 'gap-user-01',
      area: 'target_user',
      topic: 'Target persona unclear',
      reason: 'Need user segment definition',
      severity: 'normal',
      status: 'open',
    };
    const gap2: GapItem = {
      id: 'gap-db-02',
      area: 'technical_boundary',
      topic: 'Database choice unclear',
      reason: 'Need local storage format decision',
      severity: 'critical',
      status: 'open',
    };
    snap.gaps.gaps.push(gap1, gap2);

    // Add candidate decision linked specifically to gap-user-01
    const candidateDec: DecisionItem = {
      id: 'dec-user-01',
      area: 'target_user',
      statement: 'Individual developers and open source contributors',
      status: 'candidate',
      origin: 'ai-suggestion',
      evidenceRefs: ['gap:gap-user-01'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    snap.decisions.items.push(candidateDec);

    await stateEngine['commitManager'].commit(projectPath, snap.metadata.stateRevision + 1, {
      metadata: snap.metadata,
      decisions: snap.decisions,
      gaps: snap.gaps,
    });

    const s1 = await stateEngine.getSnapshot(projectPath);
    expect(s1.gaps.gaps.find((g) => g.id === 'gap-user-01')?.status).toBe('open');
    expect(s1.gaps.gaps.find((g) => g.id === 'gap-db-02')?.status).toBe('open');

    // 3. Confirm decision dec-user-01
    const s2 = await stateEngine.confirmDecision(
      projectPath,
      'decision:dec-user-01',
      s1.metadata.stateRevision
    );

    // gap-user-01 must be addressed, BUT gap-db-02 MUST REMAIN OPEN!
    const targetGap = s2.gaps.gaps.find((g) => g.id === 'gap-user-01');
    const unrelatedGap = s2.gaps.gaps.find((g) => g.id === 'gap-db-02');

    expect(targetGap?.status).toBe('addressed');
    expect(unrelatedGap?.status).toBe('open');
  });

  it('2. Readiness Gate: Unapproved readiness review or return-to-discovery rejects document compilation and preserves stage', async () => {
    // 1. Create project with core areas
    await stateEngine.createProject({
      projectPath,
      name: 'Unapproved Project',
      idea: 'Testing approval gate',
      projectTags: ['Desktop App'],
    });

    const s0 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(projectPath, 'target_user', 'Engineers', s0.metadata.stateRevision, 'confirmed');
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(projectPath, 'mvp_scope', 'Core local features', s1.metadata.stateRevision, 'confirmed');

    // Historical fixture stays in memory; the legacy write API is retired.
    const s2 = await stateEngine.getSnapshot(projectPath);
    await expect(stateEngine.evaluateReadiness(projectPath, s2.metadata.stateRevision)).rejects.toMatchObject({ code: 'LEGACY_WORKFLOW_RETIRED' });
    const s3 = structuredClone(s2); s3.metadata.stage = 'readiness-review';
    expect(s3.metadata.stage).toBe('readiness-review');
    expect(s3.readiness.current?.userDisposition).toBe('pending');

    // 3. Attempt compile without user approval -> MUST FAIL
    await expect(compiler.compile(projectPath, s3, undefined, false)).rejects.toThrow(
      /Project is under readiness review and requires explicit user approval/
    );

    // 4. Stage must NOT have been changed to documents-generated
    const sAfterFail = await stateEngine.getSnapshot(projectPath);
    expect(sAfterFail).toEqual(s2);

    // 5. If user disposition is return-to-discovery -> MUST ALSO FAIL
    await expect(stateEngine.setUserDisposition(projectPath, 'return-to-discovery', sAfterFail.metadata.stateRevision)).rejects.toMatchObject({ code: 'LEGACY_WORKFLOW_RETIRED' });
    const sReturned = structuredClone(s3); sReturned.readiness.current!.userDisposition = 'return-to-discovery';

    await expect(compiler.compile(projectPath, sReturned, undefined, false)).rejects.toThrow(
      /User disposition returned project to discovery/
    );
  });

  it('3. Critical Conflict Gate: Open critical conflict blocks compilation unless explicitly acknowledged and approved', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'Conflict Project',
      idea: 'Testing conflict gate',
      projectTags: ['Desktop App'],
    });

    const s0 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(projectPath, 'target_user', 'Engineers', s0.metadata.stateRevision, 'confirmed');
    const s1 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(projectPath, 'mvp_scope', 'Scope', s1.metadata.stateRevision, 'confirmed');

    // Inject an open Critical Conflict
    const s2 = await stateEngine.getSnapshot(projectPath);
    const conflict: ConflictItem = {
      id: 'conf-critical-01',
      propositionA: '100% Offline execution',
      propositionB: 'Real-time cloud database sync',
      reason: 'Irreconcilable architectural conflict between offline mode and mandatory cloud sync',
      severity: 'critical',
      status: 'open',
    };
    s2.gaps.conflicts.push(conflict);
    await stateEngine['commitManager'].commit(projectPath, s2.metadata.stateRevision + 1, {
      metadata: s2.metadata,
      gaps: s2.gaps,
    });

    const s3 = await stateEngine.getSnapshot(projectPath);

    // Attempt compile -> MUST FAIL
    await expect(compiler.compile(projectPath, s3, undefined, false)).rejects.toThrow(
      /unresolved critical conflict/
    );

    // Only an in-memory historical fixture can exercise the retired rendering gate.
    const sApproved = structuredClone(s3);
    sApproved.readiness.current!.userDisposition = 'approved-with-critical-conflicts';
    sApproved.readiness.current!.basisRevision = sApproved.metadata.stateRevision;
    sApproved.readiness.current!.criticalConflictAcknowledgements = ['conflict:conf-critical-01'];
    expect(sApproved.readiness.current?.userDisposition).toBe('approved-with-critical-conflicts');

    // Compile must now succeed
    const result = await compiler.compile(projectPath, sApproved, undefined, false);
    expect(result.manifest.items.length).toBeGreaterThan(0);
  });

  it('4. Grounded Document Rendering: Does not fabricate ungrounded facts, replaces missing areas with explicit Warning markers', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'Minimal Clean Project',
      idea: 'A project with minimal confirmed decisions to test document grounding',
      projectTags: ['CLI Tool'],
    });

    const s0 = await stateEngine.getSnapshot(projectPath);
    await stateEngine.addDecision(projectPath, 'target_user', 'Terminal users', s0.metadata.stateRevision, 'confirmed');

    const s1 = await stateEngine.getSnapshot(projectPath);

    // Render PROJECT.md and PRODUCT.md
    const renderedProject = await renderer.renderDocument(
      { type: 'project', title: 'PROJECT.md', path: 'docs/PROJECT.md', required: true },
      s1
    );
    const renderedProduct = await renderer.renderDocument(
      { type: 'product', title: 'PRODUCT.md', path: 'docs/PRODUCT.md', required: true },
      s1
    );

    // Must NOT contain fabricated default strings
    expect(renderedProject).not.toContain('通用开发者与技术人员 (General Developers)');
    expect(renderedProduct).not.toContain('数据全部保存在本地，无云端同步');

    // Must contain explicit grounded source marker for confirmed target_user in PROJECT.md
    expect(renderedProject).toContain('Terminal users');
    expect(renderedProject).toContain('Source: Decision');

    // Unconfirmed areas must contain explicit Warning markers
    expect(renderedProduct).toContain('*(Warning: No explicit decision or assumption confirmed for "mvp_scope"');
    expect(renderedProject).toContain('*(Warning: No explicit decision or assumption confirmed for "core_problem"');
  });
});
