import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { approvedModelTransition, treeSha256, frozenRunInventory, verifyInheritedRunTrees, sha256, latestStoredPendingDraft } from './model-transition.mjs';

async function fixture(t, operation = 'quality-from') {
  const root = await mkdtemp(join(tmpdir(), 'pa-transition-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'), project = join(source, 'project-records'), directory = join(project, 'runtime', 'planning', 'run-source');
  await mkdir(directory, { recursive: true });
  const sourceManifest = { mode: 'materials', status: operation === 'quality-from' ? 'completed' : 'blocked', activeCallsAtShutdown: 0, requestedConfig: { concurrency: 4, designModel: 'gemini-3.8-flash-high', reviewModel: 'gemini-3.8-flash-high' } };
  const sourceManifestPath = join(source, 'manifest.json');
  await writeFile(sourceManifestPath, JSON.stringify(sourceManifest));
  await writeFile(join(directory, 'run.json'), JSON.stringify({ id: 'run-source', stage: 'feedback', status: 'paused', effectiveConfig: sourceManifest.requestedConfig, tasks: [{ id: 'task-partial', kind: 'revision', status: 'completed', model: 'gemini-3.8-flash-high', attempts: 1, outputOrigin: 'provider' }] }));
  await mkdir(join(directory, 'tasks', 'task-partial'), { recursive: true });
  await writeFile(join(directory, 'tasks', 'task-partial', 'result.json'), '{"unintegrated":"partial successful scope"}');
  await writeFile(join(directory, 'tasks', 'task-partial', 'result-receipt.json'), '{"frozenModel":"gemini-3.8-flash-high"}');
  await writeFile(join(directory, 'events.ndjson'), '{"seq":1,"type":"paused"}\n');
  const revision = join(project, 'state', 'revisions', '27'); await mkdir(revision, { recursive: true });
  await writeFile(join(project, 'state', 'current.json'), '{"revision":27}');
  await writeFile(join(revision, 'changesets.json'), JSON.stringify([{ id: 'change-pending', runId: 'run-previous', status: 'pending', basis: { hash: 'obsolete' }, groups: [{ id: 'group-1', status: 'pending', blocks: [{ id: 'candidate-1', content: 'Keep unapproved content' }] }] }]));
  const qualityFile = join(root, 'feedback.txt'); await writeFile(qualityFile, '自动质量反馈，不是真人新增需求。');
  const probePath = join(root, 'probe.json'); await writeFile(probePath, JSON.stringify({ model: 'claude-opus-4-6-thinking', status: 'success', structuredSuccess: true }));
  const transitionFile = join(root, 'approved.json'), draft = operation === 'draft-from' ? await latestStoredPendingDraft(project) : undefined;
  const plan = { schemaVersion: 1, kind: 'approved-model-transition', authorization: { status: 'authorized', authority: 'delegated-user-authorization', instruction: 'Synthetic test authorization only' }, targetConfig: { designModel: 'claude-opus-4-6-thinking', reviewModel: 'claude-opus-4-6-thinking' }, availabilityProbe: { path: probePath, sha256: sha256(await readFile(probePath)) }, controls: [{ sourceLabel: 'source', mode: 'materials', operation, sourceConfig: sourceManifest.requestedConfig, sourceManifestSha256: sha256(await readFile(sourceManifestPath)), sourceTreeSha256: (await treeSha256(source)).sha256, qualityFileSha256: sha256(await readFile(qualityFile)), inheritedRuns: await frozenRunInventory(project), ...(draft ? { draftReference: { changeSetId: draft.candidate.id, candidateSha256: draft.candidateSha256, strategy: 'new-feedback-with-full-unapproved-reference' } } : {}) }] };
  await writeFile(transitionFile, JSON.stringify(plan));
  return { root, source, project, directory, sourceManifest, sourceManifestPath, qualityFile, transitionFile, plan,
    args: { transitionFile, sourceManifestPath, sourceManifest, sourceLabel: 'source', mode: 'materials', operation, designModel: 'claude-opus-4-6-thinking', reviewModel: 'claude-opus-4-6-thinking', qualityFile } };
}

test('authorized quality transition separates old model records from new models without modifying source', async t => {
  const f = await fixture(t), before = await treeSha256(f.source), transition = await approvedModelTransition(f.args);
  assert.equal(transition.audit.sourceConfig.designModel, 'gemini-3.8-flash-high');
  assert.equal(transition.audit.targetConfig.designModel, 'claude-opus-4-6-thinking');
  assert.equal(transition.audit.inheritedRuns[0].tasks[0].model, 'gemini-3.8-flash-high');
  assert.deepEqual(await treeSha256(f.source), before);
  const copied = join(f.root, 'copy'); await cp(f.project, copied, { recursive: true });
  assert.equal((await verifyInheritedRunTrees(copied, transition.audit.inheritedRuns))[0].pass, true);
  await writeFile(join(copied, 'runtime', 'planning', 'run-source', 'tasks', 'task-partial', 'result.json'), '{"changed":true}');
  await assert.rejects(verifyInheritedRunTrees(copied, transition.audit.inheritedRuns), /bytes changed/);
});

test('a stale stored pending candidate is retained as full unapproved reference, never rebased', async t => {
  const f = await fixture(t, 'draft-from'), transition = await approvedModelTransition(f.args);
  assert.equal(transition.draftCandidate.basis.hash, 'obsolete');
  assert.equal(transition.draftCandidate.status, 'pending');
  assert.equal(transition.draftCandidate.groups[0].blocks[0].content, 'Keep unapproved content');
  assert.equal(transition.audit.draftReference.strategy, 'new-feedback-with-full-unapproved-reference');
});

test('ordinary resume cannot use a transition record to change inherited frozen models', async t => {
  const f = await fixture(t);
  await assert.rejects(approvedModelTransition({ ...f.args, operation: 'resume-from' }), /original Runs cannot change frozen models/);
});

test('missing authorization or different target models fail before any run creation', async t => {
  const f = await fixture(t);
  await assert.rejects(approvedModelTransition({ ...f.args, designModel: 'other-model' }), /target models/);
  delete f.plan.authorization; await writeFile(f.transitionFile, JSON.stringify(f.plan));
  await assert.rejects(approvedModelTransition(f.args), /authorization record required/);
});

test('changed frozen tree or feedback cannot inherit earlier authorization', async t => {
  const f = await fixture(t);
  await writeFile(f.qualityFile, 'Changed feedback');
  await assert.rejects(approvedModelTransition(f.args), /feedback differs/);
  await writeFile(f.qualityFile, '自动质量反馈，不是真人新增需求。');
  await writeFile(join(f.directory, 'events.ndjson'), '{"altered":true}');
  await assert.rejects(approvedModelTransition(f.args), /source tree differs/);
});

test('source with active calls cannot be transitioned despite an otherwise valid record', async t => {
  const f = await fixture(t);
  await assert.rejects(approvedModelTransition({ ...f.args, sourceManifest: { ...f.sourceManifest, activeCallsAtShutdown: 1 } }), /no active calls/);
});
