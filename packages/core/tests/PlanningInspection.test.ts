import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, PlanningService, planningBasis, planningInputHash, planningInspectionBasis, planningPackageStatus, readProjectSnapshotReadOnly } from '../src/index.js';
import { group, question } from '../../../tests/fixtures/planning.mjs';

describe('Read-only committed planning inspection', () => {
  let root: string, path: string, engine: ProjectStateEngine;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-inspection-')); path = join(root, 'project');
    engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
    await engine.createProject({ projectPath: path, name: 'Inspection', idea: 'Read stored evidence' });
  });
  afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
  async function bytes(directory = path): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) for (const [key, value] of Object.entries(await bytes(file))) result[`${entry.name}/${key}`] = value;
      else result[entry.name] = (await readFile(file)).toString('base64');
    }
    return result;
  }
  async function propose(stage: any, groups: any[], id: string) {
    const service = new PlanningService(engine), snapshot = await service.get(path);
    return service.propose(path, { id, runId: 'run-fixture', stage, basis: planningBasis(snapshot), summary: 'Inspection fixture', groups, evidence: [], status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [] });
  }
  it('reads the exact committed revision without recovery or canonical repair', async () => {
    const pointer = JSON.parse(await readFile(join(path, 'state', 'current.json'), 'utf8'));
    await writeFile(join(path, 'state', 'decisions.json'), '{damaged-canonical');
    const before = await bytes();
    const load = vi.spyOn(engine, 'loadProject');
    const snapshot = await readProjectSnapshotReadOnly(path);
    expect(snapshot.metadata.stateRevision).toBe(pointer.revision);
    expect(load).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it.each(['null', '{broken', JSON.stringify({ revision: '../outside', manifestFile: 'manifest.json' })])('fails an invalid pointer instead of recovering: %s', async (pointer) => {
    await writeFile(join(path, 'state', 'current.json'), pointer); const before = await bytes();
    await expect(readProjectSnapshotReadOnly(path)).rejects.toThrow(); expect(await bytes()).toEqual(before);
  });
  it('does not substitute an empty planning state for partially missing committed slices', async () => {
    const pointer = JSON.parse(await readFile(join(path, 'state', 'current.json'), 'utf8'));
    await unlink(join(path, 'state', 'revisions', String(pointer.revision), 'blueprint.json'));
    const before = await bytes();
    await expect(readProjectSnapshotReadOnly(path)).rejects.toMatchObject({ code: 'STATE_VALIDATION_FAILED' });
    expect(await bytes()).toEqual(before);
  });
  it('does not choose canonical mirrors after a committed current pointer disappears', async () => {
    await unlink(join(path, 'state', 'current.json')); const before = await bytes();
    await expect(readProjectSnapshotReadOnly(path)).rejects.toMatchObject({ code: 'STATE_RECOVERY_REQUIRED' });
    expect(await bytes()).toEqual(before);
  });
  it.each([undefined, 'a'.repeat(64)])('preserves committed approvals and decision basis %s while projecting freshness separately', async (decisionBasisHash) => {
    const snapshot = await readProjectSnapshotReadOnly(path);
    const blueprint = { ...snapshot.planning!.blueprint, stages: { ...snapshot.planning!.blueprint.stages, product: 'approved' as const }, decisionBasisHash };
    await (engine as any).commitManager.commit(path, 2, { metadata: snapshot.metadata, blueprint });
    const saved = JSON.parse(await readFile(join(path, 'state', 'revisions', '2', 'blueprint.json'), 'utf8'));
    const effective = await new PlanningService(engine).get(path);
    const before = await bytes();
    const inspected = await readProjectSnapshotReadOnly(path);
    const committed = structuredClone(inspected);
    const basis = planningInspectionBasis(inspected);
    expect(inspected.metadata.stateRevision).toBe(2);
    expect(inspected.planning!.blueprint).toEqual(saved);
    expect(inspected.planning!.blueprint.stages.product).toBe('approved');
    expect(Object.hasOwn(inspected.planning!.blueprint, 'decisionBasisHash')).toBe(decisionBasisHash !== undefined);
    expect(basis.revision).toBe(2); expect(basis.hash).not.toBe(planningBasis(inspected).hash);
    expect(basis).toEqual(planningBasis(effective));
    expect(effective.planning!.blueprint.stages.product).toBe(decisionBasisHash === undefined ? 'approved' : 'needs-revision');
    expect(inspected).toEqual(committed); expect(await bytes()).toEqual(before);
  });
  it('projects package freshness from the semantic basis while preserving historical artifacts', async () => {
    const snapshot = await readProjectSnapshotReadOnly(path);
    expect(planningPackageStatus(snapshot).status).toBe('missing');
    snapshot.planning!.package = { basisHash: planningInspectionBasis(snapshot).hash, directory: 'artifacts/packages/history' } as any;
    expect(planningPackageStatus(snapshot)).toMatchObject({ status: 'current', reason: null });
    snapshot.metadata.stateRevision += 1;
    expect(planningPackageStatus(snapshot).status).toBe('current');
    snapshot.metadata.name = 'Changed planning basis';
    expect(planningPackageStatus(snapshot)).toMatchObject({ status: 'stale', reason: expect.any(String) });
    expect(snapshot.planning!.package.directory).toBe('artifacts/packages/history');
  });
  it.each(['project_overview', 'tech_stack'])('matches the formal basis after public decision creation in %s without rewriting history', async (area) => {
    const service = new PlanningService(engine);
    let snapshot = await propose('product', [group('product')], 'approved-product');
    snapshot = await service.approve(path, 'approved-product', { expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-product', groupIds: ['product-group'] });
    await engine.addDecision(path, area, 'User chooses the project technology explicitly', snapshot.metadata.stateRevision);
    const effective = await service.get(path), before = await bytes();
    const load = vi.spyOn(engine, 'loadProject'), recover = vi.spyOn((engine as any).commitManager, 'recoverIfNeeded');
    const raw = await readProjectSnapshotReadOnly(path), original = structuredClone(raw);
    const revision = raw.metadata.stateRevision;
    const savedBlueprint = JSON.parse(await readFile(join(path, 'state', 'revisions', String(revision), 'blueprint.json'), 'utf8'));
    const savedDecisions = JSON.parse(await readFile(join(path, 'state', 'revisions', String(revision), 'decisions.json'), 'utf8'));
    expect(revision).toBe(4); expect(raw.planning!.blueprint).toEqual(savedBlueprint); expect(raw.decisions).toEqual(savedDecisions);
    expect(raw.planning!.blueprint.stages.product).toBe('approved'); expect(effective.planning!.blueprint.stages.product).toBe('needs-revision');
    expect(raw.decisions.items.at(-1)!.area).toBe(area);
    expect(effective.decisions.items.at(-1)).toMatchObject(area === 'tech_stack' ? { area: 'technical_boundary', sourceArea: area } : { area });
    expect(planningInspectionBasis(raw)).toEqual(planningBasis(effective));
    expect(raw).toEqual(original); expect(load).not.toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('uses the formal legacy partial-feedback review projection while preserving the committed approvals', async () => {
    const service = new PlanningService(engine);
    for (const stage of ['product','technical','delivery'] as const) {
      const snapshot = await propose(stage, [group(stage)], `base-${stage}`);
      await service.approve(path, `base-${stage}`, { expectedRevision: snapshot.metadata.stateRevision, operationId: `approve-${stage}`, groupIds: [`${stage}-group`] });
    }
    let snapshot = await service.get(path);
    snapshot = await service.recordInput(path, '开发反馈：历史部分批准', snapshot.metadata.stateRevision, 'legacy-input', 'feedback');
    const feedback = (id: string) => ({ id, title: `Feedback ${id}`, impact: 'Review affected stages', dependsOn: [], blocks: ['product','technical','delivery'].flatMap(stage => group(stage).blocks).map((block: any) => ({ ...block, content: `${block.content} 修订 ${id}。` })), removeBlockIds: [], decisions: [], status: 'pending' });
    snapshot = await propose('feedback', [feedback('a'), { ...feedback('b'), blocks: [] }], 'legacy-feedback');
    snapshot = await service.approve(path, 'legacy-feedback', { expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-a', groupIds: ['a'] });
    const change = snapshot.planning!.changeSets.find(c => c.id === 'legacy-feedback')!;
    delete change.feedbackReview;
    snapshot.planning!.blueprint.stages = { product: 'approved', technical: 'approved', delivery: 'approved' };
    snapshot.planning!.blueprint.approvedInputHash = planningInputHash(snapshot);
    change.basis = { ...planningBasis(snapshot), revision: snapshot.metadata.stateRevision + 1 };
    await engine.commitPlanningState(path, snapshot, snapshot.metadata.stateRevision);
    const effective = await service.get(path), before = await bytes();
    const load = vi.spyOn(engine, 'loadProject'), recover = vi.spyOn((engine as any).commitManager, 'recoverIfNeeded');
    const raw = await readProjectSnapshotReadOnly(path), original = structuredClone(raw);
    expect(raw.metadata.stateRevision).toBe(11);
    expect(Object.values(raw.planning!.blueprint.stages)).toEqual(['approved','approved','approved']);
    expect(raw.planning!.blueprint.approvedInputHash).toBeDefined(); expect(raw.planning!.changeSets.find(c => c.id === 'legacy-feedback')!.feedbackReview).toBeUndefined();
    expect(Object.values(effective.planning!.blueprint.stages)).toEqual(['needs-revision','needs-revision','needs-revision']);
    expect(effective.planning!.blueprint.approvedInputHash).toBeUndefined();
    expect(effective.planning!.changeSets.find(c => c.id === 'legacy-feedback')!.feedbackReview).toMatchObject({ affectedStages: ['product','technical','delivery'] });
    expect(planningInspectionBasis(raw)).toEqual(planningBasis(effective));
    expect(raw).toEqual(original); expect(load).not.toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('shares additive linked-question and missing-evidence normalization without changing committed legacy records', async () => {
    const snapshot = await readProjectSnapshotReadOnly(path);
    const legacyQuestion: any = question('legacy:storage', 'q-legacy'); delete legacyQuestion.decisionKey;
    snapshot.questions.items.push(legacyQuestion);
    const decision: any = { id: 'legacy-linked', area: 'tech_stack', statement: 'Store notes locally', status: 'confirmed', origin: 'user', confirmedBy: 'user', evidenceRefs: ['question:q-legacy'], createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z' };
    snapshot.decisions.items.push(decision, { ...decision, id: 'legacy-no-evidence', evidenceRefs: undefined });
    await (engine as any).commitManager.commit(path, 2, { metadata: snapshot.metadata, decisions: snapshot.decisions, questions: snapshot.questions });
    const effective = await new PlanningService(engine).get(path), before = await bytes();
    const load = vi.spyOn(engine, 'loadProject');
    const raw = await readProjectSnapshotReadOnly(path), original = structuredClone(raw);
    expect(raw.decisions.items.find(d => d.id === 'legacy-linked')!.decisionKey).toBeUndefined();
    expect(raw.decisions.items.find(d => d.id === 'legacy-no-evidence')!.evidenceRefs).toBeUndefined();
    expect(effective.decisions.items.find(d => d.id === 'legacy-linked')).toMatchObject({ decisionKey: 'legacy:q-legacy', area: 'technical_boundary', sourceArea: 'tech_stack' });
    expect(effective.decisions.items.find(d => d.id === 'legacy-no-evidence')!.evidenceRefs).toEqual([]);
    expect(planningInspectionBasis(raw)).toEqual(planningBasis(effective));
    expect(raw).toEqual(original); expect(load).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('rejects every legacy Core publication before reading a project', async () => {
    const load = vi.spyOn(engine, 'loadProject'); const before = await bytes();
    await expect(engine.evaluateReadiness('missing', -1)).rejects.toMatchObject({ code: 'LEGACY_WORKFLOW_RETIRED' });
    await expect(engine.setUserDisposition('missing', 'approved', -1)).rejects.toMatchObject({ code: 'LEGACY_WORKFLOW_RETIRED' });
    await expect(engine.completeDocumentCompilation('missing', null as any, undefined, -1)).rejects.toMatchObject({ code: 'LEGACY_WORKFLOW_RETIRED' });
    expect(load).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
});
