import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, planningBasis, hashValue } from '@project-architect/core';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { clarification, group, result } from '../../../tests/fixtures/planning.mjs';

const roots: string[] = [], runtimes: PlanningRuntime[] = [];
const scopeLabel = '本次完整候选范围 requiredBlockIds：';
const success = (output: any) => ({ structuredSuccess: true, status: 'success', structuredOutput: output, durationMs: 1, exitCode: 0 });
const ids = (groups: any[]) => groups.flatMap(item => [...item.blocks.map((block: any) => block.id), ...item.removeBlockIds]);
const subset = (groups: any[], selected: string[]) => groups.map(item => ({ ...item, blocks: item.blocks.filter((block: any) => selected.includes(block.id)), removeBlockIds: item.removeBlockIds.filter((id: string) => selected.includes(id)) })).filter(item => item.blocks.length || item.removeBlockIds.length);
const promptScope = (prompt: string): string[] => JSON.parse(prompt.split(scopeLabel)[1]?.split('\n')[0] ?? 'null');
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(runtime => runtime.shutdown()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
async function setup(provider: any) {
  const root = await mkdtemp(join(tmpdir(), 'pa-ordinary-prompt-')); roots.push(root);
  const path = join(root, 'project'), engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
  await engine.createProject({ name: '普通修订完整职责', idea: '个人笔记工具', projectPath: path });
  const runtime = new PlanningRuntime(engine, provider, { concurrency: 1 }, [1, 2]); runtimes.push(runtime);
  return { path, runtime };
}
async function baseline(runtime: PlanningRuntime, path: string) {
  const groups = [group('product'), group('technical'), group('delivery')];
  groups[2]!.blocks.push(...Array.from({ length: 28 }, (_, index) => ({ ...groups[2]!.blocks[1], id: `accept-extra-${index}` })));
  let snapshot = await runtime.service.get(path);
  snapshot = await runtime.service.propose(path, { id: 'baseline-44', runId: 'baseline', stage: 'product', basis: planningBasis(snapshot), summary: '完整正式基线', groups, evidence: [], status: 'pending', createdAt: new Date().toISOString(), approvals: [] });
  await runtime.service.approve(path, 'baseline-44', { expectedRevision: snapshot.metadata.stateRevision, operationId: 'approve-baseline-44', groupIds: groups.map(item => item.id) });
  expect(ids(groups)).toHaveLength(44);
  return groups;
}
async function feedback(runtime: PlanningRuntime, path: string, operationId: string) {
  const snapshot = await runtime.service.get(path);
  return runtime.start(path, { stage: 'feedback', expectedRevision: snapshot.metadata.stateRevision, operationId, feedback: '明确修订当前候选，保留已经修好的行为与删除建议。' });
}
async function settled(runtime: PlanningRuntime, path: string, id: string) {
  await vi.waitFor(() => expect((runtime as any).active.has(id)).toBe(false), { timeout: 8000 });
  return runtime.get(path, id);
}
function assertCompleteDuty(prompt: string, required: string[]) {
  expect(promptScope(prompt)).toEqual(required);
  expect(prompt).toContain('本任务目标列出的是待解决的问题，不是完整输出范围');
  expect(prompt).toContain('必须保留本 Run 已经修好的候选块及明确删除动作');
  expect(prompt).toContain('groups.blocks'); expect(prompt).toContain('groups.removeBlockIds');
  expect(prompt).toContain('完整、自洽的待批准变更包');
  expect(prompt).toContain('未改变且与本次候选无关的正式块仍不复制');
}

describe('Actual ordinary revision Provider requests distinguish issues from complete candidate scope', () => {
  it.each(['replace', 'remove'] as const)('keeps all 44 same-run actions in each prompt through complementary 3/41 partial outputs (%s)', async action => {
    let complete: any[], partialThree: any[], partialFortyOne: any[], revisions = 0, reviews = 0;
    const requests: any[] = [];
    const { runtime, path } = await setup({ complete: async (request: any) => {
      requests.push(request);
      if (request.prompt.includes('你负责官方资料研究')) return success(result());
      if (request.prompt.includes('你是独立评审者')) return success(result({ blockers: ++reviews === 1 ? ['本次只需修正 accept-extra-25、accept-extra-26、accept-extra-27 的错误说明'] : [] }));
      if (request.prompt.includes('本任务目标：修订最新草案')) return success(result({ groups: ++revisions === 1 ? partialThree : revisions === 2 ? partialFortyOne : complete }));
      return success(result({ groups: complete }));
    } });
    const formal = await baseline(runtime, path); complete = structuredClone(formal);
    complete[0]!.blocks.find((block: any) => block.id === 'notes-flow')!.content = '同 Run 已修好：保存失败保留完整输入及恢复入口。';
    if (action === 'remove') { complete[2]!.blocks = complete[2]!.blocks.filter((block: any) => block.id !== 'accept-extra-27'); complete[2]!.removeBlockIds = ['accept-extra-27']; }
    const all = ids(complete), three = ['accept-extra-25', 'accept-extra-26', 'accept-extra-27'];
    partialThree = subset(complete, three); partialFortyOne = subset(complete, all.filter(id => !three.includes(id)));
    const formalHash = hashValue((await runtime.service.get(path)).planning!.blueprint);
    const started = await feedback(runtime, path, `same-run-${action}`), done = await settled(runtime, path, started.id);
    expect(done.status).toBe('reviewable'); expect(revisions).toBe(3); expect(reviews).toBe(2);
    const revisionTasks = done.tasks.filter(task => task.kind === 'revision' && !task.partition);
    const revisionRequests = requests.filter(request => request.prompt.includes('本任务目标：修订最新草案'));
    for (const [index, request] of revisionRequests.entries()) {
      expect(revisionTasks[index]!.requiredBlockIds).toEqual(all);
      assertCompleteDuty(request.prompt, all);
    }
    expect(revisionTasks[1]!.repairIssues).toContain('登记范围尚未完成：target'); expect(revisionTasks[1]!.repairIssues).not.toContain('登记范围尚未完成：accept-extra-25');
    expect(revisionTasks[2]!.repairIssues).toContain('登记范围尚未完成：accept-extra-25'); expect(revisionTasks[2]!.repairIssues).not.toContain('登记范围尚未完成：target');
    for (const [index, request] of revisionRequests.entries()) {
      expect(JSON.parse(request.contextText).currentIssues).toEqual(revisionTasks[index]!.repairIssues);
      expect(revisionTasks[index]!.goal.length).toBeLessThan(150); expect(revisionTasks[index]!.goal).not.toContain('登记范围尚未完成：');
    }
    expect(JSON.parse(revisionRequests[1]!.contextText).unfinishedScopes.flatMap((scope: any) => scope.previousCandidateBlocks ?? []).find((block: any) => block.id === 'notes-flow')?.content).toContain('同 Run 已修好');
    for (const [index, task] of revisionTasks.slice(0, 2).entries()) {
      const raw = JSON.parse(await readFile(join(path, 'runtime/planning', done.id, 'tasks', task.id, 'result.json'), 'utf8'));
      const receipt = JSON.parse(await readFile(join(path, 'runtime/planning', done.id, 'tasks', task.id, 'result-receipt.json'), 'utf8'));
      expect(raw).toEqual(result({ groups: index ? partialFortyOne : partialThree })); expect(receipt.hash).toBe(hashValue(raw));
    }
    const snapshot = await runtime.service.get(path);
    expect(snapshot.planning!.changeSets.find(change => change.runId === done.id)?.groups).toEqual(complete);
    expect(hashValue(snapshot.planning!.blueprint)).toBe(formalHash);
  });

  it('scopes a new feedback revision to its own three actions rather than 44 formal or earlier-run candidate actions', async () => {
    let previous: any[], current: any[], runNumber = 1, reviews = 0;
    const requests: any[] = [];
    const { runtime, path } = await setup({ complete: async (request: any) => {
      requests.push(request);
      if (request.prompt.includes('你负责官方资料研究')) return success(result());
      if (request.prompt.includes('你是独立评审者')) return success(result({ blockers: runNumber === 2 && ++reviews === 1 ? ['仅需修正 accept-extra-25 的说明'] : [] }));
      return success(result({ groups: runNumber === 1 ? previous : current }));
    } });
    previous = await baseline(runtime, path);
    const first = await feedback(runtime, path, 'earlier-full-run'); expect((await settled(runtime, path, first.id)).status).toBe('reviewable');
    runNumber = 2; current = subset(previous, ['accept-extra-25', 'accept-extra-26', 'accept-extra-27']);
    const second = await feedback(runtime, path, 'new-three-action-run'), done = await settled(runtime, path, second.id);
    expect(done.status).toBe('reviewable');
    const revision = done.tasks.find(task => task.kind === 'revision')!, request = requests.find(item => item.prompt.includes('本任务目标：修订最新草案'));
    expect(revision.requiredBlockIds).toEqual(ids(current)); assertCompleteDuty(request.prompt, ids(current));
    expect(promptScope(request.prompt)).not.toContain('target'); expect(promptScope(request.prompt)).not.toContain('notes-api');
    expect(done.tasks.some(task => task.id === revision.assemblyBaseTaskId)).toBe(true);
    expect(JSON.parse(request.contextText).currentDraft.groups).toEqual(current);
  });

  it('keeps clarification repair outside the ordinary complete-blueprint prompt', async () => {
    const requests: any[] = [];
    const { runtime, path } = await setup({ complete: async (request: any) => { requests.push(request); return success(requests.length === 1 ? result() : result({ clarification })); } });
    const snapshot = await runtime.service.get(path), started = await runtime.start(path, { stage: 'clarify', expectedRevision: snapshot.metadata.stateRevision, operationId: 'clarification-repair' });
    expect((await settled(runtime, path, started.id)).status).toBe('reviewable');
    const repair = requests.find(request => request.prompt.includes('本任务目标：修订最新草案'));
    expect(repair).toBeDefined(); expect(repair.prompt).not.toContain(scopeLabel);
  });

  it('keeps revision slices on their own registered partition prompt', async () => {
    let candidate: any[], reviews = 0;
    const requests: any[] = [], selected = ['accept-extra-25', 'accept-extra-26', 'accept-extra-27'];
    const { runtime, path } = await setup({ complete: async (request: any) => {
      requests.push(request); const context = JSON.parse(request.contextText);
      if (context.workPartition) return success(result({ groups: subset(candidate, context.workPartition.blockIds).map(item => ({ ...item, id: context.workPartition.id })) }));
      if (request.prompt.includes('任务拆分')) return success(result({ workItems: [{ id: 'slice-a', goal: '第一块', blockIds: selected.slice(0, 1), dependsOn: [] }, { id: 'slice-b', goal: '其余两块', blockIds: selected.slice(1), dependsOn: [] }] }));
      if (request.prompt.includes('你负责官方资料研究')) return success(result());
      if (request.prompt.includes('你是独立评审者')) return success(result({ blockers: ++reviews === 1 ? ['修正交付说明'] : [] }));
      if (request.prompt.includes('本任务目标：修订最新草案')) return { structuredSuccess: false, status: 'failed', stderr: 'Your previous response was cut off because it exceeded the output token limit', durationMs: 1, exitCode: 0 };
      return success(result({ groups: candidate }));
    } });
    candidate = subset(await baseline(runtime, path), selected);
    const started = await feedback(runtime, path, 'revision-partition'), done = await settled(runtime, path, started.id);
    expect(done.status).toBe('reviewable');
    const slices = requests.filter(request => JSON.parse(request.contextText).workPartition);
    expect(slices).toHaveLength(2);
    for (const request of slices) { expect(request.prompt).toContain('本次只输出 workPartition.blockIds'); expect(request.prompt).not.toContain(scopeLabel); }
    const ordinary = requests.find(request => request.prompt.includes('本任务目标：修订最新草案') && !JSON.parse(request.contextText).workPartition);
    assertCompleteDuty(ordinary.prompt, selected);
  });
  it('stores a large repeated review finding once and shares it through registered repair fragments while preserving all 44 actions', async () => {
    const issue = `当前仍需核对的完整观察：${'明确保留当前行为与真实失败恢复。'.repeat(1200)}`;
    let candidate: any[], reviews = 0; const requests: any[] = [];
    const { runtime, path } = await setup({ complete: async (request: any) => {
      requests.push(request); const context = JSON.parse(request.contextText);
      if (context.workPartition) {
        expect(context.currentIssues).toEqual([issue]);
        if (context.workPartition.id === 'slice-b') {
          const first = Object.values(context.workerResults).find((output: any) => output.groups.some((item: any) => item.id.endsWith('-slice-a'))) as any;
          expect(ids(first.groups)).toEqual(ids(candidate).slice(0, 22));
        }
        return success(result({ groups: subset(candidate, context.workPartition.blockIds).map(item => ({ ...item, id: `${item.id}-${context.workPartition.id}` })) }));
      }
      if (request.prompt.includes('任务拆分')) {
        expect(context.currentIssues).toEqual([issue]);
        return success(result({ workItems: [{ id: 'slice-a', goal: '前半完整范围', blockIds: ids(candidate).slice(0, 22), dependsOn: [] }, { id: 'slice-b', goal: '后半完整范围', blockIds: ids(candidate).slice(22), dependsOn: ['slice-a'] }] }));
      }
      if (request.prompt.includes('你负责官方资料研究')) return success(result());
      if (request.prompt.includes('你是独立评审者')) return success(result({ blockers: ++reviews === 1 ? [issue, issue, issue] : [] }));
      if (request.prompt.includes('本任务目标：修订最新草案')) {
        expect(context.currentIssues).toEqual([issue]); assertCompleteDuty(request.prompt, ids(candidate));
        return { structuredSuccess: false, status: 'failed', stderr: 'Your previous response was cut off because it exceeded the output token limit', durationMs: 1, exitCode: 0 };
      }
      return success(result({ groups: candidate }));
    } });
    candidate = await baseline(runtime, path);const started = await feedback(runtime, path, 'large-repair-finding'), done = await settled(runtime, path, started.id);
    expect(done.status).toBe('reviewable'); expect(reviews).toBe(2);
    const repair = done.tasks.find(task => task.kind === 'revision' && !task.partition)!, children = done.tasks.filter(task => repair.partitionTaskIds?.includes(task.id));
    expect(repair.repairIssues).toEqual([issue]); expect(repair.requiredBlockIds).toEqual(ids(candidate)); expect(children).toHaveLength(2);
    expect(done.tasks.find(task => task.id === repair.partitionPlanTaskId)!.repairSourceTaskId).toBe(repair.id);
    for (const task of children) { expect(task.repairSourceTaskId).toBe(repair.id); expect(task.repairIssues).toBeUndefined(); expect(task.goal.length).toBeLessThan(150); expect(task.goal).not.toContain(issue); }
    expect(repair.goal.length).toBeLessThan(150); expect(repair.goal).not.toContain(issue);
    const snapshot = await runtime.service.get(path), proposal = snapshot.planning!.changeSets.find(change => change.runId === done.id)!;
    expect(ids(proposal.groups)).toEqual(ids(candidate)); expect(proposal.groups.flatMap(item => item.blocks)).toEqual(candidate.flatMap(item => item.blocks));
    const review = done.tasks.find(task => task.kind === 'review')!;
    const raw = JSON.parse(await readFile(join(path, 'runtime/planning', done.id, 'tasks', review.id, 'result.json'), 'utf8'));
    expect(raw.blockers).toEqual([issue]); expect(requests.filter(request => request.prompt.includes('任务拆分'))).toHaveLength(1);
  });
});
