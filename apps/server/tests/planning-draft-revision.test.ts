import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import type { AgentTaskResult, ChangeSet, PlanningStage } from '@project-architect/contracts';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, hashValue, planningBasis } from '@project-architect/core';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { planningDraftSource } from '../src/planning/PlanningDraftRevision.js';
import { createApp } from '../src/server.js';
import { group, result, question } from '../../../tests/fixtures/planning.mjs';

let root: string, path: string, engine: ProjectStateEngine, runtime: PlanningRuntime, app: any;
const contexts: any[] = [];
function provider(fail = false) {
  return { complete: vi.fn(async (req: any) => {
    const context = JSON.parse(req.contextText); contexts.push({ prompt: req.prompt, context });
    if (fail) return { structuredSuccess: false, status: 'failed', stderr: 'Permission denied', durationMs: 1, exitCode: 1 };
    let output: AgentTaskResult = result();
    if (!req.prompt.includes('你是独立评审者') && !req.prompt.includes('你负责官方资料研究')) {
      const current = context.currentDraft ?? context.workerResults?.draft;
      output = current ? structuredClone(current) : result({ groups: [group(context.stage)] });
      output.summary = '按用户反馈修订当前草案，保留已完成范围。';
      for (const item of output.groups) for (const block of item.blocks) {
        delete block.locked; delete block.approvedAt; delete block.approvedBy;
        if (block.id === 'notes') block.content = 'SOURCE_CANDIDATE_KEEP_已修好；增加失败时回焦。';
      }
    }
    return { structuredSuccess: true, status: 'success', structuredOutput: output, durationMs: 1, exitCode: 0 };
  }) };
}
beforeEach(async () => {
  contexts.length = 0;
  root = await mkdtemp(join(tmpdir(), 'pa-draft-revision-'));
  const guard = new WorkspaceGuard(root);
  engine = new ProjectStateEngine(new FileStorage(), guard);
  runtime = new PlanningRuntime(engine, provider() as any, {}, [1, 2]);
  app = createApp({ workspaceRoot: root, engine, planningRuntime: runtime });
  const created = await request(app).post('/api/projects').send({ name: '草案修订测试', idea: '个人笔记工具' }).expect(200);
  path = guard.resolveProjectPath(created.body.data.projectId);
});
afterEach(async () => { vi.restoreAllMocks(); await runtime.shutdown(); await rm(root, { recursive: true, force: true }); });
async function files(directory = path, prefix = ''): Promise<Record<string, string>> {
  const bytes: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name), key = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(bytes, await files(file, key + '/'));
    else bytes[key] = (await readFile(file)).toString('base64');
  }
  return bytes;
}
async function seed(partial = false, locked = false) {
  let snapshot = await runtime.service.get(path);
  const candidate = group('product');
  candidate.blocks.find((block: any) => block.id === 'notes')!.content = 'SOURCE_CANDIDATE_KEEP_已修好';
  const groups = partial ? [{ ...candidate, id: 'approved-prefix', blocks: candidate.blocks.slice(0, 2) }, { ...candidate, id: 'remaining', blocks: candidate.blocks.slice(2) }] : [candidate];
  const evidence = [{ id: 'source-evidence', kind: 'user' as const, content: '个人笔记工具', source: 'project:idea', obtainedAt: '2026-10-04T00:00:00Z', applicability: '当前候选来源' }];
  candidate.blocks.find((block: any) => block.id === 'notes')!.evidenceIds = ['source-evidence'];
  const source: ChangeSet = { id: 'source-pending', runId: 'run-source', stage: 'product', basis: planningBasis(snapshot), summary: '已经有正确候选的草案', groups, evidence, status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [] };
  snapshot = await runtime.service.propose(path, source);
  if (locked) {
    const edited = structuredClone(snapshot.planning!.changeSets.find(item => item.id === source.id)!.groups);
    edited[0]!.blocks.find(block => block.id === 'notes')!.locked = true;
    snapshot = await runtime.service.edit(path, source.id, edited, snapshot.metadata.stateRevision, 'user-lock-source');
  }
  if (partial) snapshot = await runtime.service.approve(path, source.id, { expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-prefix', groupIds: ['approved-prefix'] });
  return { snapshot, source: structuredClone(snapshot.planning!.changeSets.find(item => item.id === source.id)!) };
}
async function settled(id: string) {
  await vi.waitFor(() => expect((runtime as any).active.has(id)).toBe(false), { timeout: 5000 });
  return runtime.get(path, id);
}
function intent(revision: number, stage: PlanningStage = 'product') {
  return { stage, expectedRevision: revision, operationId: 'revise-source', draftChangeSetId: 'source-pending', feedback: '  请修订当前草案：保留已经修好的候选，只补失败时回焦。\n保持其他范围。  ' };
}

it('revises an unapproved first product through HTTP, keeps the source candidate and never approves it', async () => {
  const { snapshot, source } = await seed();
  const reply = await request(app).post(`/api/projects/${snapshot.metadata.projectId}/planning/runs`).send(intent(snapshot.metadata.stateRevision)).expect(202);
  const run = await settled(reply.body.data.id);
  expect(run.status).toBe('reviewable');
  expect(run.draftSource).toMatchObject({ changeSetId: source.id, sourceRunId: source.runId, hash: hashValue(source), groupIds: source.groups.map(item => item.id) });
  const design = contexts.find(item => item.prompt.includes('你负责设计方案'))?.context ?? contexts.find(item => item.context.currentDraft)?.context;
  expect(design.currentDraft.groups).toEqual(source.groups);
  expect(design.currentDraft.evidence).toEqual(source.evidence);
  expect(design.draftRevisionSource).toMatchObject({ changeSetId: source.id, candidateStatus: 'pending-user-approval' });
  const current = await runtime.service.get(path);
  expect(current.planning!.blueprint.blocks).toEqual([]);
  const historical = current.planning!.changeSets.find(item => item.id === source.id)!;
  expect(historical.status).toBe('stale');
  expect(historical.groups).toEqual(source.groups); expect(historical.approvals).toEqual(source.approvals); expect(historical.evidence).toEqual(source.evidence);
  expect(current.planning!.inputs.at(-1)!.raw).toBe(intent(snapshot.metadata.stateRevision).feedback);
  const newDraft = current.planning!.changeSets.find(item => item.id === run.changeSetId)!;
  expect(newDraft.status).toBe('pending'); expect(newDraft.approvals).toEqual([]);
  expect(newDraft.groups.flatMap(item => item.blocks).find(block => block.id === 'notes')!.content).toContain('SOURCE_CANDIDATE_KEEP_已修好');
  const review = contexts.find(item => item.prompt.includes('你是独立评审者'))!.context;
  expect(review.draftRevisionBaseline.groups).toEqual(source.groups);
  expect(review.workerResults.draft.groups.flatMap((item: any) => item.blocks).find((block: any) => block.id === 'notes').content).toContain('增加失败时回焦');
  const calls = contexts.length;
  const repeated = await runtime.start(path, intent(snapshot.metadata.stateRevision));
  expect(repeated.id).toBe(run.id); expect(contexts).toHaveLength(calls);
  await expect(runtime.start(path, { ...intent(snapshot.metadata.stateRevision), feedback: '另一份反馈' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});

it('never unlocks or overwrites a locked formal block while revising a pending feedback source', async () => {
  let snapshot = await runtime.service.get(path);
  const baseline = [group('product'), group('technical'), group('delivery')];
  snapshot = await runtime.service.propose(path, { id: 'formal-base', runId: 'run-base', stage: 'product', basis: planningBasis(snapshot), summary: '正式完整方案', groups: baseline, evidence: [], status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [] });
  const edited = structuredClone(baseline); edited[0]!.blocks.find((block: any) => block.id === 'notes')!.locked = true;
  snapshot = await runtime.service.edit(path, 'formal-base', edited, snapshot.metadata.stateRevision, 'human-lock-formal');
  snapshot = await runtime.service.approve(path, 'formal-base', { expectedRevision: snapshot.metadata.stateRevision, operationId: 'human-approve-base', groupIds: baseline.map(item => item.id) });
  const formal = structuredClone(snapshot.planning!.blueprint);
  const changed = { ...group('product'), blocks: [group('product').blocks.find((block: any) => block.id === 'notes')!] };
  snapshot = await runtime.service.propose(path, { id: 'source-pending', runId: 'run-source', stage: 'feedback', basis: planningBasis(snapshot), summary: '修改锁定正文的建议', groups: [changed], evidence: [], status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [] });
  const run = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision, 'feedback'))).id);
  expect(run.status).toBe('reviewable'); snapshot = await runtime.service.get(path);
  expect(snapshot.planning!.blueprint).toEqual(formal);
  const next = snapshot.planning!.changeSets.find(item => item.id === run.changeSetId)!;
  await expect(runtime.service.approve(path, next.id, { expectedRevision: snapshot.metadata.stateRevision, operationId: 'without-unlock', groupIds: next.groups.map(item => item.id) })).rejects.toMatchObject({ code: 'LOCKED_CONFLICT' });
  expect((await runtime.service.get(path)).planning!.blueprint).toEqual(formal);
});

it.each(['approved', 'rejected'] as const)('rejects a %s source without saving new feedback', async status => {
  let { snapshot, source } = await seed();
  snapshot = status === 'approved' ? await runtime.service.approve(path, source.id, { expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-source', groupIds: source.groups.map(item => item.id) }) : await runtime.service.reject(path, source.id, source.groups.map(item => item.id), snapshot.metadata.stateRevision, 'reject-source');
  const before = await files();
  await expect(runtime.start(path, intent(snapshot.metadata.stateRevision))).rejects.toMatchObject({ code: 'INVALID_CHANGESET' });
  expect(await files()).toEqual(before); expect(contexts).toEqual([]);
});

it('does not ignore unrelated input when retrying an interrupted prepared start', async () => {
  const { snapshot } = await seed();
  const storage = (runtime as any).storage, write = storage.writeJson.bind(storage); let interrupted = false;
  vi.spyOn(storage, 'writeJson').mockImplementation(async (location: string, value: any) => {
    if (!interrupted && location.endsWith('run.json') && value.draftSource && !value.pendingStart) { interrupted = true; throw new Error('EIO after feedback commit'); }
    return write(location, value);
  });
  const originalRequest = intent(snapshot.metadata.stateRevision);
  await expect(runtime.start(path, originalRequest)).rejects.toThrow('EIO after feedback commit');
  const current = await runtime.service.get(path);
  await runtime.service.recordInput(path, '另外的新约束', current.metadata.stateRevision, 'unrelated-after-start');
  await runtime.shutdown(); runtime = new PlanningRuntime(engine, provider() as any, {}, [1, 2]);
  const before = await files();
  await expect(runtime.start(path, originalRequest)).rejects.toMatchObject({ code: 'STALE_BASIS' });
  expect(await files()).toEqual(before); expect(contexts).toEqual([]);
});

it('freezes only pending groups of a partial approval and preserves the approved prefix as Core facts', async () => {
  const { snapshot, source } = await seed(true);
  const formal = structuredClone(snapshot.planning!.blueprint);
  const run = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision))).id);
  expect(run.status).toBe('reviewable');
  const initial = contexts.find(item => item.context.currentDraft)?.context;
  expect(initial.currentDraft.groups.map((item: any) => item.id)).toEqual(['remaining']);
  expect(initial.blueprint.blocks).toEqual(formal.blocks);
  const current = await runtime.service.get(path);
  expect(current.planning!.blueprint).toEqual(formal);
  expect(current.planning!.changeSets.find(item => item.id === source.id)!.approvals).toEqual(source.approvals);
  expect(current.planning!.changeSets.find(item => item.id === run.changeSetId)!.groups.every(item => item.status === 'pending')).toBe(true);
});

it('atomically carries only the source manual pending lock intent to the same stable block through Core', async () => {
  const { snapshot } = await seed(false, true);
  const run = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision))).id);
  expect(run.status).toBe('reviewable');
  const current = await runtime.service.get(path), next = current.planning!.changeSets.find(item => item.id === run.changeSetId)!;
  expect(next.groups.flatMap(item => item.blocks).find(block => block.id === 'notes')?.locked).toBe(true);
  expect(next.groups.flatMap(item => item.blocks).filter(block => block.locked).map(block => block.id)).toEqual(['notes']);
  expect(current.planning!.blueprint.blocks).toEqual([]);
  expect(current.planning!.operations.some(item => item.id === `draft-locks:${next.id}`)).toBe(true);
  expect(current.planning!.operations.find(item => item.id === `draft-locks:${next.id}`)!.revision).toBe(current.planning!.operations.find(item => item.id === `proposal:${next.id}`)!.revision);
});

it.each([
  ['wrong stage', (req: any) => ({ ...req, stage: 'feedback' }), 'INVALID_CHANGESET'],
  ['missing source', (req: any) => ({ ...req, draftChangeSetId: 'missing' }), 'INVALID_CHANGESET'],
  ['empty source id', (req: any) => ({ ...req, draftChangeSetId: '' }), 'INVALID_INTENT'],
  ['malformed source id', (req: any) => ({ ...req, draftChangeSetId: 7 }), 'INVALID_INTENT'],
  ['missing feedback', (req: any) => ({ ...req, feedback: undefined }), 'INVALID_INTENT'],
  ['wrong revision', (req: any) => ({ ...req, expectedRevision: -1 }), 'STATE_REVISION_CONFLICT'],
])('rejects %s before any formal or runtime writes', async (_name, change, code) => {
  const { snapshot } = await seed(), before = await files();
  await expect(runtime.start(path, change(intent(snapshot.metadata.stateRevision)))).rejects.toMatchObject({ code });
  expect(await files()).toEqual(before); expect(contexts).toEqual([]);
});

it('rejects a stale source before recording additional feedback', async () => {
  const { snapshot } = await seed();
  const changed = await runtime.service.recordInput(path, '新材料改变了依据', snapshot.metadata.stateRevision, 'unrelated-input');
  const before = await files();
  await expect(runtime.start(path, intent(changed.metadata.stateRevision))).rejects.toMatchObject({ code: 'STALE_BASIS' });
  expect(await files()).toEqual(before); expect(contexts).toEqual([]);
});

it('continues a cancelled draft revision from its frozen candidate after server restart', async () => {
  const { snapshot, source } = await seed();
  (runtime as any).provider = provider(true);
  const paused = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision))).id);
  expect(paused.status).toBe('paused');
  await runtime.cancel(path, paused.id); await runtime.shutdown();
  contexts.length = 0; runtime = new PlanningRuntime(engine, provider() as any, {}, [1, 2]);
  await runtime.resume(path, paused.id);
  expect((await settled(paused.id)).status).toBe('reviewable');
  expect(contexts.find(item => item.context.currentDraft)?.context.currentDraft.groups).toEqual(source.groups);
  expect((await runtime.service.get(path)).planning!.blueprint.blocks).toEqual([]);
});

it.each(['changed', 'missing'])('refuses %s frozen source on restart without accepting it or calling a Provider', async mode => {
  const { snapshot } = await seed(); (runtime as any).provider = provider(true);
  const paused = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision))).id);
  const frozen = join(path, 'runtime', 'planning', paused.id, 'draft-source.json');
  if (mode === 'changed') { const source = JSON.parse(await readFile(frozen, 'utf8')); source.groups[0].blocks[0].content = 'corrupted-source'; await writeFile(frozen, JSON.stringify(source)); }
  else await rm(frozen);
  await runtime.shutdown(); const nextProvider = provider(); contexts.length = 0;
  runtime = new PlanningRuntime(engine, nextProvider as any, {}, [1, 2]); const before = await files();
  await expect(runtime.resume(path, paused.id)).rejects.toMatchObject({ code: 'RESULT_MODIFIED' });
  expect(await files()).toEqual(before); expect(nextProvider.complete).not.toHaveBeenCalled();
});

it('recovers a start interrupted after feedback commit by replaying its exact operation once', async () => {
  const { snapshot, source } = await seed();
  const storage = (runtime as any).storage, write = storage.writeJson.bind(storage); let interrupted = false;
  vi.spyOn(storage, 'writeJson').mockImplementation(async (location: string, value: any) => {
    if (!interrupted && location.endsWith('run.json') && value.draftSource && !value.pendingStart) { interrupted = true; throw new Error('EIO after feedback commit'); }
    return write(location, value);
  });
  const request = intent(snapshot.metadata.stateRevision);
  await expect(runtime.start(path, request)).rejects.toThrow('EIO after feedback commit');
  expect((await runtime.service.get(path)).planning!.inputs.filter(item => item.raw === request.feedback)).toHaveLength(1);
  expect(contexts).toEqual([]); await runtime.shutdown();
  runtime = new PlanningRuntime(engine, provider() as any, {}, [1, 2]);
  const done = await settled((await runtime.start(path, request)).id);
  expect(done.status).toBe('reviewable'); expect(done.pendingStart).toBeUndefined();
  expect(done.draftSource?.hash).toBe(hashValue(source));
  expect((await runtime.service.get(path)).planning!.inputs.filter(item => item.raw === request.feedback)).toHaveLength(1);
});

it.each(['technical', 'delivery'] as const)('does not let a pending %s source bypass its preceding approval', async stage => {
  let snapshot = await runtime.service.get(path);
  const candidate = { ...group(stage), blocks: group(stage).blocks.map((block: any) => ({ ...block, requirementIds: [], dependsOn: [] })) };
  snapshot = await runtime.service.propose(path, { id: 'source-pending', runId: 'run-source', stage, basis: planningBasis(snapshot), summary: '尚无前序批准的候选', groups: [candidate], evidence: [], status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [] });
  const before = await files();
  await expect(runtime.start(path, intent(snapshot.metadata.stateRevision, stage))).rejects.toMatchObject({ code: 'STAGE_NOT_APPROVED' });
  expect(await files()).toEqual(before); expect(contexts).toEqual([]);
});

it('retains the latest revised candidate and its frozen source across a question answer and server restart', async () => {
  const { snapshot, source } = await seed();
  const base = provider(); let asked = false;
  (runtime as any).provider = { complete: async (req: any) => {
    const output = await base.complete(req);
    if (!asked && req.prompt.includes('交付本阶段完整、自洽')) {
      asked = true;
      output.structuredOutput.groups[0]!.blocks.find((block: any) => block.id === 'notes')!.content = 'LATEST_REVISED_KEEP_已修好失败回焦';
      output.structuredOutput.questions = [question('draft:export', 'q-draft-export')];
    }
    return output;
  } };
  const waiting = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision))).id);
  expect(waiting.status).toBe('paused'); expect(waiting.pendingQuestions).toHaveLength(1);
  let current = await runtime.service.get(path);
  current = await runtime.service.answer(path, [{ questionId: waiting.pendingQuestions[0]!.id, kind: 'delegate' }], current.metadata.stateRevision, 'delegate-draft-export');
  await runtime.shutdown(); contexts.length = 0;
  const next = provider();
  runtime = new PlanningRuntime(engine, { complete: async (req: any) => {
    if (req.prompt.includes('依据本轮已明确回答或委托')) {
      const context = JSON.parse(req.contextText);
      expect(context.currentDraft.groups[0].blocks.find((block: any) => block.id === 'notes').content).toBe('LATEST_REVISED_KEEP_已修好失败回焦');
      expect(context.draftRevisionSource.hash).toBe(hashValue(source));
    }
    const output = await next.complete(req); output.structuredOutput.questions = []; return output;
  } } as any, {}, [1, 2]);
  await runtime.resume(path, waiting.id);
  const done = await settled(waiting.id);
  expect(done.status).toBe('reviewable'); expect(done.draftSource?.hash).toBe(hashValue(source));
  expect(contexts.some(item => item.prompt.includes('依据本轮已明确回答或委托'))).toBe(true);
  expect((await runtime.service.get(path)).planning!.blueprint.blocks).toEqual([]);
});

function candidate(source: ChangeSet, snapshot: any, id = 'atomic-revision'): ChangeSet {
  const groups = structuredClone(source.groups.filter(group => group.status === 'pending'));
  for (const group of groups) for (const block of group.blocks) delete block.locked;
  return { ...structuredClone(source), id, runId: 'run-atomic-revision', basis: planningBasis(snapshot), groups, approvals: [], status: 'pending' };
}

it('exposes no pending proposal before its inherited lock intent and trace commit, including an approval race', async () => {
  const { source, snapshot } = await seed(false, true);
  const basis = await runtime.service.recordInput(path, '只修订失败提示', snapshot.metadata.stateRevision, 'atomic-feedback');
  const proposal = candidate(source, basis), reference = planningDraftSource(source);
  const commit = engine.commitPlanningState.bind(engine);
  let reached!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => reached = resolve), gate = new Promise<void>(resolve => release = resolve);
  const spy = vi.spyOn(engine, 'commitPlanningState').mockImplementation(async (location, next, revision) => {
    const pending = next.planning!.changeSets.find(item => item.id === proposal.id);
    expect(pending!.groups.flatMap(group => group.blocks).find(block => block.id === 'notes')!.locked).toBe(true);
    expect(next.planning!.operations.find(item => item.id === `draft-locks:${proposal.id}`)!.revision).toBe(next.planning!.operations.find(item => item.id === `proposal:${proposal.id}`)!.revision);
    reached(); await gate; return commit(location, next, revision);
  });
  const publishing = runtime.service.proposeRevision(path, proposal, source, reference);
  await entered;
  expect((await runtime.service.get(path)).planning!.changeSets.some(item => item.id === proposal.id)).toBe(false);
  await expect(runtime.service.approve(path, proposal.id, { expectedRevision: basis.metadata.stateRevision, operationId: 'race-approve', groupIds: proposal.groups.map(group => group.id) })).rejects.toMatchObject({ code: 'INVALID_CHANGESET' });
  release();
  const published = await publishing;
  expect(published.planning!.blueprint.blocks).toEqual([]);
  expect(published.planning!.changeSets.find(item => item.id === proposal.id)!.approvals).toEqual([]);
  const replay = await runtime.service.proposeRevision(path, proposal, source, reference);
  expect(replay.metadata.stateRevision).toBe(published.metadata.stateRevision); expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
  const approved = await runtime.service.approve(path, proposal.id, { expectedRevision: published.metadata.stateRevision, operationId: 'explicit-human-approve', groupIds: proposal.groups.map(group => group.id) });
  expect(approved.planning!.blueprint.blocks.find(block => block.id === 'notes')!.locked).toBe(true);
});

it.each(['before', 'after'] as const)('handles EIO %s the atomic proposal commit without publishing a lockless draft', async timing => {
  const { source, snapshot } = await seed(false, true);
  const basis = await runtime.service.recordInput(path, '原子修订反馈', snapshot.metadata.stateRevision, 'atomic-feedback');
  const proposal = candidate(source, basis), reference = planningDraftSource(source), before = await files();
  const commit = engine.commitPlanningState.bind(engine);
  const spy = vi.spyOn(engine, 'commitPlanningState').mockImplementation(async (location, next, revision) => {
    if (timing === 'after') await commit(location, next, revision);
    throw new Error(`EIO ${timing} atomic commit`);
  });
  if (timing === 'before') {
    await expect(runtime.service.proposeRevision(path, proposal, source, reference)).rejects.toThrow('EIO before atomic commit');
    expect(await files()).toEqual(before);
    expect((await runtime.service.get(path)).planning!.changeSets.some(item => item.id === proposal.id)).toBe(false);
  } else {
    const published = await runtime.service.proposeRevision(path, proposal, source, reference);
    expect(published.planning!.changeSets.find(item => item.id === proposal.id)!.groups.flatMap(group => group.blocks).find(block => block.id === 'notes')!.locked).toBe(true);
    const revision = published.metadata.stateRevision;
    expect((await runtime.service.proposeRevision(path, proposal, source, reference)).metadata.stateRevision).toBe(revision);
    expect(spy).toHaveBeenCalledTimes(1);
  }
});

it.each(['changed-source', 'changed-reference', 'provider-lock'] as const)('refuses %s at the Core revision boundary without writes', async mode => {
  const { source, snapshot } = await seed(false, true);
  const basis = await runtime.service.recordInput(path, '修订反馈', snapshot.metadata.stateRevision, 'atomic-feedback');
  const proposal = candidate(source, basis), reference = planningDraftSource(source), frozen = structuredClone(source);
  if (mode === 'changed-source') frozen.groups[0]!.blocks[0]!.content = '伪造旧来源';
  if (mode === 'changed-reference') reference.groupIds = ['not-a-pending-group'];
  if (mode === 'provider-lock') proposal.groups[0]!.blocks[0]!.locked = true;
  const before = await files();
  await expect(runtime.service.proposeRevision(path, proposal, frozen, reference)).rejects.toMatchObject({ code: mode === 'provider-lock' ? 'INVALID_CHANGESET' : 'RESULT_MODIFIED' });
  expect(await files()).toEqual(before);
});

it('refuses a source edited after capture rather than accepting its formerly matching reference', async () => {
  const { source, snapshot } = await seed(false, true);
  const edited = structuredClone(source.groups); edited[0]!.blocks[0]!.content = '用户在冻结后编辑了来源';
  const changed = await runtime.service.edit(path, source.id, edited, snapshot.metadata.stateRevision, 'new-human-source-edit');
  const basis = await runtime.service.recordInput(path, '修订反馈', changed.metadata.stateRevision, 'atomic-feedback');
  const before = await files();
  await expect(runtime.service.proposeRevision(path, candidate(source, basis), source, planningDraftSource(source))).rejects.toMatchObject({ code: 'RESULT_MODIFIED' });
  expect(await files()).toEqual(before);
});

it('resumes a failed atomic Runtime proposal without leaving an earlier lockless pending package', async () => {
  const { source, snapshot } = await seed(false, true);
  const commit = engine.commitPlanningState.bind(engine); let failed = false;
  vi.spyOn(engine, 'commitPlanningState').mockImplementation(async (location, next, revision) => {
    if (!failed && next.planning!.operations.some(item => item.id.startsWith('draft-locks:'))) { failed = true; throw new Error('EIO atomic proposal'); }
    return commit(location, next, revision);
  });
  const waiting = await settled((await runtime.start(path, intent(snapshot.metadata.stateRevision))).id);
  expect(waiting.status).toBe('paused');
  expect((await runtime.service.get(path)).planning!.changeSets.filter(item => item.id !== source.id)).toEqual([]);
  await runtime.resume(path, waiting.id);
  const done = await settled(waiting.id), current = await runtime.service.get(path);
  expect(done.status).toBe('reviewable');
  const generated = current.planning!.changeSets.filter(item => item.id !== source.id);
  expect(generated).toHaveLength(1);
  expect(generated[0]!.groups.flatMap(group => group.blocks).find(block => block.id === 'notes')!.locked).toBe(true);
  expect(generated[0]!.approvals).toEqual([]); expect(current.planning!.blueprint.blocks).toEqual([]);
});

it('rechecks its frozen source before a transient Provider retry and rejects the altered bytes', async () => {
  const { snapshot } = await seed(); const calls: string[] = [], base = provider();
  runtime = new PlanningRuntime(engine, { complete: async (req: any) => {
    calls.push(req.requestId);
    if (req.prompt.includes('生成本阶段完整设计')) return { structuredSuccess: false, status: 'failed', stderr: '503 temporary unavailable', durationMs: 1, exitCode: 1 };
    return base.complete(req);
  } } as any, {}, [100, 100]);
  const run = await runtime.start(path, intent(snapshot.metadata.stateRevision));
  let altered!: () => void;
  const changed = new Promise<void>(resolve => altered = resolve);
  runtime.on(run.id, async event => {
    if (event.type !== 'retry') return;
    const location = join(path, 'runtime', 'planning', run.id, 'draft-source.json');
    const frozen = JSON.parse(await readFile(location, 'utf8')); frozen.summary = 'retry期间修改来源';
    await writeFile(location, JSON.stringify(frozen)); altered();
  });
  await changed;
  const stopped = await settled(run.id);
  expect(stopped.status).toBe('paused'); expect(stopped.error).toContain('冻结的草案来源');
  expect(calls.some(id => id.endsWith('-2'))).toBe(false);
  expect((await runtime.service.get(path)).planning!.changeSets).toHaveLength(1);
});
