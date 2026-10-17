import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, PlanningService, ProjectStateEngine, WorkspaceGuard, planningBasis } from '../src/index.js';
import { seedLegacyPlanningProject, directoryFileHashes } from '../../../tests/fixtures/legacy-planning.mjs';

describe('Old-format project migration on copies', () => {
  let root: string, path: string, original: Awaited<ReturnType<typeof seedLegacyPlanningProject>>, sourceHashes: Record<string, string>, service: PlanningService;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-legacy-migration-'));
    original = await seedLegacyPlanningProject(root); sourceHashes = await directoryFileHashes(original.path);
    path = join(root, 'project-copy'); await cp(original.path, path, { recursive: true });
    service = new PlanningService(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)));
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('reads additively without modifying files, retains history and diagnoses ambiguous records', async () => {
    const copyHashes = await directoryFileHashes(path);
    const s = await service.get(path);
    expect(s.metadata.stateRevision).toBe(1);
    expect(s.planning!.blueprint.blocks).toEqual([]);
    expect(Object.values(s.planning!.blueprint.stages)).toEqual(['not-designed', 'not-designed', 'not-designed']);
    expect(s.questions.items[0]!.decisionKey).toBe('storage:location');
    expect(s.questions.items[0]!.answerKind).toBeUndefined();
    expect(s.questions.items[0]!.selectedOptionKeys).toBeUndefined();
    expect(s.decisions.items.find(d => d.id === 'legacy-linked')!.decisionKey).toBe('storage:location');
    expect(s.decisions.items.find(d => d.id === 'legacy-locked')!.status).toBe('locked');
    expect(s.decisions.items.find(d => d.id === 'legacy-unlinked')!.decisionKey).toBeUndefined();
    expect(s.planning!.diagnostics.join('\n')).toContain('多个有效旧决定');
    expect(s.planning!.diagnostics.join('\n')).toContain('legacy-research-question');
    expect(s.planning!.diagnostics.join('\n')).toContain('legacy-unlinked');
    const cleanup = s.planning!.changeSets.find(c => c.runId === 'migration')!;
    expect(cleanup.status).toBe('pending'); expect(cleanup.approvals).toEqual([]);
    expect(cleanup.groups.flatMap(g => g.rejectDecisionIds ?? [])).toEqual(expect.arrayContaining(['legacy-linked', 'legacy-locked', 'legacy-research-question']));
    expect(s.decisions.items.map(d => ({ id: d.id, statement: d.statement, status: d.status }))).toEqual(original.originalItems.map(d => ({ id: d.id, statement: d.statement, status: d.status })));
    expect(s.documents!.items).toEqual([original.documentReference]);
    expect(s.readiness.history[0]!.credibilityScore).toBe(100);
    expect(await readFile(join(path, 'documents/OLD_PROJECT.md'), 'utf8')).toBe(original.document);
    expect(await directoryFileHashes(path)).toEqual(copyHashes);
    expect(await directoryFileHashes(original.path)).toEqual(sourceHashes);
  });

  it('persists the new files only at a normal commit and retains the recoverable old revision', async () => {
    const s = await service.get(path);
    const saved = await service.recordInput(path, '请检查历史方案中的冲突，暂时保留原记录。', s.metadata.stateRevision, 'migration-normal-input');
    expect(saved.metadata.stateRevision).toBe(2);
    const manifest = JSON.parse(await readFile(join(path, 'state/revisions/2/manifest.json'), 'utf8'));
    expect(manifest.files.map((file: { filename: string }) => file.filename)).toEqual(expect.arrayContaining(['planning.json', 'blueprint.json', 'changesets.json']));
    const old = JSON.parse(await readFile(join(path, 'state/revisions/1/manifest.json'), 'utf8'));
    expect(old.files.some((file: { filename: string }) => ['planning.json', 'blueprint.json', 'changesets.json'].includes(file.filename))).toBe(false);
    expect(JSON.parse(await readFile(join(path, 'state/revisions/1/decisions.json'), 'utf8')).items).toEqual(original.originalItems);
    const reloaded = await service.get(path);
    expect(reloaded.decisions.items.find(d => d.id === 'legacy-research-question')!.status).toBe('confirmed');
    expect(reloaded.planning!.changeSets.some(c => c.runId === 'migration' && c.status === 'pending')).toBe(true);
    expect(reloaded.documents!.items).toEqual([original.documentReference]);
    expect(await directoryFileHashes(original.path)).toEqual(sourceHashes);
  });

  it('requires explicit cleanup approval and unlock, preserving all original records as history', async () => {
    let s = await service.get(path), cleanup = s.planning!.changeSets.find(c => c.runId === 'migration')!;
    await expect(service.approve(path, cleanup.id, { operationId: 'without-unlock', expectedRevision: s.metadata.stateRevision, groupIds: ['cleanup-legacy-locked'] })).rejects.toMatchObject({ code: 'LOCKED_CONFLICT' });
    expect((await service.get(path)).decisions.items.find(d => d.id === 'legacy-locked')!.status).toBe('locked');
    s = await service.approve(path, cleanup.id, { operationId: 'review-question', expectedRevision: s.metadata.stateRevision, groupIds: ['cleanup-legacy-research-question'] });
    expect(s.decisions.items.find(d => d.id === 'legacy-research-question')!).toMatchObject({ status: 'rejected', statement: '有没有 GitHub 项目能实现？', rejectionReason: `approved-cleanup:${cleanup.id}` });
    expect(s.decisions.items.find(d => d.id === 'legacy-linked')!.status).toBe('confirmed');
    s = await service.get(path); cleanup = s.planning!.changeSets.find(c => c.runId === 'migration' && ['pending', 'partially-approved'].includes(c.status))!;
    s = await service.approve(path, cleanup.id, { operationId: 'review-unlock', expectedRevision: s.metadata.stateRevision, groupIds: ['cleanup-legacy-locked'], unlockIds: ['legacy-locked'] });
    expect(s.decisions.items.find(d => d.id === 'legacy-locked')!.status).toBe('rejected');
    expect(s.decisions.items).toHaveLength(original.originalItems.length);
    expect(s.planning!.topics.find(t => t.key === 'storage:location')!.history).toEqual(expect.arrayContaining(['legacy-linked', 'legacy-locked']));
    expect((await service.get(path)).documents!.items).toEqual([original.documentReference]);
    expect(await directoryFileHashes(original.path)).toEqual(sourceHashes);
  });

  it('does not duplicate the remaining cleanup groups after a partial approval', async () => {
    let s = await service.get(path);
    const cleanup = s.planning!.changeSets.find(c => c.runId === 'migration')!;
    s = await service.approve(path, cleanup.id, { operationId: 'partial-cleanup', expectedRevision: s.metadata.stateRevision, groupIds: ['cleanup-legacy-research-question'] });
    const hashes = await directoryFileHashes(path);
    for (let read = 0; read < 2; read++) {
      s = await service.get(path);
      const open = s.planning!.changeSets.filter(c => c.runId === 'migration' && ['pending', 'partially-approved'].includes(c.status) && c.basis.hash === planningBasis(s).hash);
      expect(open).toHaveLength(1);
      expect(open[0]!.id).toBe(cleanup.id);
      expect(open.flatMap(c => c.groups.filter(g => g.status === 'pending')).filter(g => g.rejectDecisionIds?.includes('legacy-locked'))).toHaveLength(1);
    }
    expect(await directoryFileHashes(path)).toEqual(hashes);
    expect(await directoryFileHashes(original.path)).toEqual(sourceHashes);
  });

  it('honors rejected cleanup for the same record text across unrelated input, but reviews changed text again', async () => {
    let s = await service.get(path);
    const cleanup = s.planning!.changeSets.find(c => c.runId === 'migration')!;
    s = await service.reject(path, cleanup.id, ['cleanup-legacy-research-question'], s.metadata.stateRevision, 'retain-old-record');
    s = await service.recordInput(path, '补充材料仅供参考，不改变保留历史记录的选择。', s.metadata.stateRevision, 'unrelated-input');
    s = await new PlanningService(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root))).get(path);
    const suggested = (snapshot: typeof s) => snapshot.planning!.changeSets.filter(c => c.runId === 'migration' && ['pending', 'partially-approved'].includes(c.status)).flatMap(c => c.groups.filter(g => g.status === 'pending'));
    expect(suggested(s).some(g => g.rejectDecisionIds?.includes('legacy-research-question'))).toBe(false);
    expect(s.decisions.items.find(d => d.id === 'legacy-research-question')!).toMatchObject({ status: 'confirmed', statement: '有没有 GitHub 项目能实现？' });
    expect(s.planning!.diagnostics.join('\n')).toContain('legacy-research-question');
    s.decisions.items.find(d => d.id === 'legacy-research-question')!.statement = '有没有 GitHub 项目能实现新要求？';
    await new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)).commitPlanningState(path, s, s.metadata.stateRevision);
    s = await service.get(path);
    expect(suggested(s).filter(g => g.rejectDecisionIds?.includes('legacy-research-question'))).toHaveLength(1);
    expect(await directoryFileHashes(original.path)).toEqual(sourceHashes);
  });
});
