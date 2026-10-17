import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, planningBasis, hashValue } from '@project-architect/core';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { planningBlueprintContext } from '../src/planning/PlanningBlueprintContext.js';
import { planningWorkerContext } from '../src/planning/PlanningContext.js';
import { group, result } from '../../../tests/fixtures/planning.mjs';

let root: string, runtime: PlanningRuntime;
afterEach(async () => { await runtime?.shutdown(); if (root) await rm(root, { recursive: true, force: true }); });

it('supplies the pending view and an explicitly historical comparison baseline to review while preserving formal state', async () => {
  root = await mkdtemp(join(tmpdir(), 'pa-candidate-context-'));
  const path = join(root, 'project'), engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
  await engine.createProject({ name: '候选上下文', idea: '个人笔记', projectPath: path });
  const baseline = [group('product'), group('technical'), group('delivery')];
  const old = baseline[0]!.blocks.find((block: any) => block.kind === 'feature')!;
  old.content = 'OLD_APPROVED_BODY_KEEP_ONLY_ON_DISK';
  let reviewContext: any;
  const candidate = structuredClone(baseline[0]!);
  candidate.blocks.find((block: any) => block.id === old.id)!.content = 'NEW_PENDING_BODY_NOT_APPROVED';
  runtime = new PlanningRuntime(engine, { complete: async (request: any) => {
    const context = JSON.parse(request.contextText);
    if (request.prompt.includes('你是独立评审者')) {
      reviewContext = context;
      return { structuredSuccess: true, status: 'success', structuredOutput: result(), durationMs: 1, exitCode: 0 };
    }
    const output = request.prompt.includes('你负责官方资料研究') ? result() : result({ groups: [candidate] });
    return { structuredSuccess: true, status: 'success', structuredOutput: output, durationMs: 1, exitCode: 0 };
  } } as any, {}, [1, 2]);
  let snapshot = await runtime.service.get(path);
  snapshot = await runtime.service.propose(path, { id: 'baseline', runId: 'baseline', stage: 'product', basis: planningBasis(snapshot), summary: '基线', groups: baseline, evidence: [], status: 'pending', createdAt: new Date().toISOString(), approvals: [] });
  const lockIntent = structuredClone(baseline);
  lockIntent[0]!.blocks.find((block: any) => block.id === old.id)!.locked = true;
  snapshot = await runtime.service.edit(path, 'baseline', lockIntent, snapshot.metadata.stateRevision, 'lock-baseline');
  snapshot = await runtime.service.approve(path, 'baseline', { expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-baseline', groupIds: baseline.map(item => item.id) });
  const formalHash = hashValue(snapshot.planning!.blueprint);
  const run = await runtime.start(path, { stage: 'feedback', expectedRevision: snapshot.metadata.stateRevision, operationId: 'feedback', feedback: '明确变更：请使用新的失败恢复规则，保留正式状态等待我批准。' });
  await vi.waitFor(() => expect((runtime as any).active.has(run.id)).toBe(false), { timeout: 5000 });
  expect((await runtime.get(path, run.id)).status).toBe('reviewable');
  expect(reviewContext).toBeDefined();
  expect(JSON.stringify(reviewContext.blueprint)).not.toContain(old.content);
  expect(reviewContext.changeReviewBaseline.status).toBe('previous-approved-for-change-comparison-only');
  expect(reviewContext.changeReviewBaseline.blocks.find((block: any) => block.id === old.id)?.content).toBe(old.content);
  expect(reviewContext.workerResults.draft.groups.flatMap((item: any) => item.blocks).find((block: any) => block.id === old.id)?.content).toBe('NEW_PENDING_BODY_NOT_APPROVED');
  expect(reviewContext.blueprint.blocks.find((block: any) => block.id === baseline[1]!.blocks[0]!.id)).toMatchObject(baseline[1]!.blocks[0]);
  expect(reviewContext.blueprintContext.shadowedApprovedBlocks.find((block: any) => block.id === old.id)).toMatchObject({ locked: true, change: 'replacement' });
  snapshot = await runtime.service.get(path);
  expect(hashValue(snapshot.planning!.blueprint)).toBe(formalHash);
  expect(snapshot.planning!.blueprint.blocks.find(block => block.id === old.id)?.content).toBe(old.content);
});

it('shows removed approved scope only in the review comparison baseline and keeps it out of the effective candidate', () => {
  const blocks = group('product').blocks;
  blocks[0].content = '原批准边界：不做目录树，不做重型富文本编辑';
  const approved: any = { schemaVersion: 1, blocks, stages: { product: 'approved', technical: 'approved', delivery: 'approved' } };
  const draft = result({ groups: [{ ...group('product'), blocks: [], removeBlockIds: [blocks[0].id] }] });
  const hashes = [hashValue(approved), hashValue(draft)];
  const author = planningBlueprintContext(approved, draft);
  expect('changeReviewBaseline' in author).toBe(false);
  const review = planningBlueprintContext(approved, draft, [], [], true);
  expect(review.blueprint.blocks.some(block => block.id === blocks[0].id)).toBe(false);
  expect(review.changeReviewBaseline?.blocks).toEqual([blocks[0]]);
  expect(review.changeReviewBaseline?.status).toBe('previous-approved-for-change-comparison-only');
  expect([hashValue(approved), hashValue(draft)]).toEqual(hashes);
});

it('keeps the complete approved context when no actual candidate is supplied', () => {
  const approved: any = { schemaVersion: 1, blocks: group('product').blocks, stages: { product: 'approved', technical: 'approved', delivery: 'approved' } };
  expect(planningBlueprintContext(approved)).toEqual({ blueprint: approved });
  expect(planningBlueprintContext(approved).blueprint).toBe(approved);
});

it('omits explicit removals and missing-scope replacements while preserving formal metadata, untouched bodies and both raw sources', () => {
  const blocks = group('product').blocks;
  blocks[0] = { ...blocks[0], locked: true, approvedBy: 'human-approval', approvedAt: '2026-10-04T00:00:00Z' };
  const approved: any = { schemaVersion: 1, blocks, stages: { product: 'approved', technical: 'approved', delivery: 'approved' } };
  const candidate = result({ groups: [{ ...group('product'), blocks: [], removeBlockIds: [blocks[0].id] }] });
  const replacement = { ...blocks[1], content: '最近合法局部修订的正文' };
  const references = [{ previousCandidateBlocks: [replacement], previousCandidateRemoveIds: [] }];
  const originalHashes = [hashValue(approved), hashValue(candidate), hashValue(references)];
  const context = planningBlueprintContext(approved, candidate, references);
  expect(context.blueprint.blocks).toEqual(blocks.slice(2));
  expect(context.blueprintContext?.shadowedApprovedBlocks[0]).toMatchObject({ id: blocks[0].id, change: 'removal', locked: true, approvedBy: 'human-approval', approvedAt: '2026-10-04T00:00:00Z' });
  expect(context.blueprintContext?.shadowedApprovedBlocks[1]?.change).toBe('replacement');
  expect(context.blueprintContext?.candidateStatus).toBe('pending-user-approval');
  expect([hashValue(approved), hashValue(candidate), hashValue(references)]).toEqual(originalHashes);
});

it('keeps conflicting replacement and removal actions visible without choosing or rewriting either', () => {
  const blocks = group('product').blocks, approved: any = { schemaVersion: 1, blocks, stages: { product: 'approved', technical: 'approved', delivery: 'approved' } };
  const candidate = result({ groups: [{ ...group('product'), blocks: [blocks[0]], removeBlockIds: [blocks[0].id] }] });
  const original = hashValue(candidate), context = planningBlueprintContext(approved, candidate);
  expect(context.blueprintContext?.shadowedApprovedBlocks[0]?.change).toBe('replacement-and-removal');
  expect(hashValue(candidate)).toBe(original);
  expect(candidate.groups[0]?.blocks).toEqual([blocks[0]]);
  expect(candidate.groups[0]?.removeBlockIds).toEqual([blocks[0].id]);
});

it('never lets legacy support bodies or a paused authoring result shadow the approved plan', () => {
  const approved: any = { schemaVersion: 1, blocks: group('product').blocks, stages: { product: 'approved', technical: 'approved', delivery: 'approved' } };
  const state: any = { blueprint: approved, changeSets: [], evidence: [] };
  const tasks: any[] = [{ id: 'legacy-research', kind: 'research', status: 'completed' }, { id: 'paused-author', kind: 'revision', status: 'paused' }];
  const results = new Map(tasks.map(task => [task.id, result({ groups: [group('product')] })]));
  const current = planningWorkerContext(tasks, results, state, { id: 'review', kind: 'review', dependsOn: [] } as any);
  expect(current.workerResults.draft).toBeNull();
  expect(planningBlueprintContext(approved, current.workerResults.draft).blueprint.blocks).toEqual(approved.blocks);
  expect(results.get('legacy-research')?.groups).toHaveLength(1);
});

it('also shadows real authoring dependency bodies supplied to a design fragment while leaving support bodies excluded', () => {
  const approved: any = { schemaVersion: 1, blocks: group('technical').blocks, stages: { product: 'approved', technical: 'approved', delivery: 'approved' } };
  const changed = group('technical'); changed.blocks = [{ ...changed.blocks[2], content: '结构schemaVersion与记录revision分开' }];
  const state: any = { blueprint: approved, changeSets: [], evidence: [] };
  const tasks: any[] = [{ id: 'real-author', kind: 'design', status: 'completed' }, { id: 'legacy-support', kind: 'research', status: 'completed' }];
  const results = new Map([['real-author', result({ groups: [changed] })], ['legacy-support', result({ groups: [group('technical')] })]]);
  const context = planningWorkerContext(tasks, results, state, { id: 'fragment', kind: 'design', dependsOn: tasks.map(task => task.id) } as any);
  const projected = planningBlueprintContext(approved, undefined, [], Object.values(context.workerResults).filter((result): result is any => Boolean(result)));
  expect(projected.blueprint.blocks.some(block => block.id === changed.blocks[0].id)).toBe(false);
  expect(projected.blueprint.blocks).toEqual(approved.blocks.filter((block: any) => block.id !== changed.blocks[0].id));
  expect(context.workerResults['real-author']?.groups[0]?.blocks[0]?.content).toBe(changed.blocks[0].content);
  expect(context.workerResults['legacy-support']?.groups).toEqual([]);
});
