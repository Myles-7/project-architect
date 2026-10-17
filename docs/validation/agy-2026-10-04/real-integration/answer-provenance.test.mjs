import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, PlanningService, planningBasis } from '../../../../packages/core/dist/index.js';
import { verifyAnswerProvenance } from './answer-provenance.mjs';

async function frozenAnswer(label) {
  const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
  const load = relative => readFile(join(root, relative), 'utf8').then(JSON.parse);
  const manifest = await load('manifest.json');
  const operation = manifest.answers.at(-1);
  const revisions = (await readdir(join(root, 'project-records/state/revisions'))).map(Number).sort((a, b) => a - b);
  let afterRevision;
  for (const revision of revisions) {
    const planning = await load(`project-records/state/revisions/${revision}/planning.json`);
    if (planning.operations.some(value => value.id === operation.operationId)) { afterRevision = revision; break; }
  }
  assert.ok(afterRevision, 'Frozen answer operation must have a real Core revision');
  const before = {}, after = {};
  for (const name of ['decisions', 'planning', 'questions']) {
    before[name] = await load(`project-records/state/revisions/${afterRevision - 1}/${name}.json`);
    after[name] = await load(`project-records/state/revisions/${afterRevision}/${name}.json`);
  }
  return { before, after, ...operation };
}
const reopened = await frozenAnswer('flash-materials-chinese-resume-20261005-05');
const legacyMixed = await frozenAnswer('flash-vague-resume-20261005-06');
async function currentPublicCoreAnswer() {
  const root = await mkdtemp(join(tmpdir(), 'pa-answer-provenance-'));
  try {
    const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root)), path = join(root, 'project');
    await engine.createProject({ name: 'Answer provenance regression', idea: '测试结构化答案与委托的状态边界', projectPath: path, projectId: 'proj-answer-provenance' });
    const service = new PlanningService(engine);
    let s = await service.get(path);
    const source = reopened.before.questions.items.find(q => q.id === reopened.answers[0].questionId);
    const questions = ['selection', 'delegation'].map(kind => {
      const q = { ...structuredClone(source), id: `regression-${kind}`, decisionKey: `regression.${kind}`, issueRef: `regression.${kind}`, status: 'proposed' };
      for (const key of ['batchId', 'basisRevision', 'basisHash', 'batchStage', 'reopenReason']) delete q[key];
      return q;
    });
    s = await service.installQuestions(path, planningBasis(s), questions, 'run-regression');
    const before = structuredClone(s), operationId = 'simulated-regression-selection-and-delegation';
    const answers = [
      { questionId: s.questions.items.find(q => q.decisionKey === 'regression.selection').id, kind: 'selection', optionKeys: [questions[0].recommendedOptionKey] },
      { questionId: s.questions.items.find(q => q.decisionKey === 'regression.delegation').id, kind: 'delegate', text: '  模拟用户输入：明确委托 AI 拟定，原文保留，设计结果仍待批准。\n  ' }
    ];
    await service.answer(path, answers, s.metadata.stateRevision, operationId);
    const after = await new PlanningService(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root))).get(path);
    return { before, after, answers, operationId };
  } finally {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('pa-answer-provenance-')) throw new Error('Unexpected regression cleanup directory');
    await rm(root, { recursive: true, force: true });
  }
}
const mixed = await currentPublicCoreAnswer();
const verify = fixture => verifyAnswerProvenance(fixture.before, fixture.after, fixture.answers, fixture.operationId);

test('real reopened selection replaces an effective confirmed decision without increasing count', () => {
  const result = verify(reopened);
  assert.equal(result.counts.beforeConfirmed, 9);
  assert.equal(result.counts.afterConfirmed, 9);
  assert.equal(result.counts.selections, 1);
  assert.equal(result.pass, true, JSON.stringify(result));
});
test('current public Core mixed selection and delegation confirms only the selected question and preserves delegation after reload', () => {
  const result = verify(mixed);
  assert.ok(result.counts.nonSelections > 0);
  assert.equal(result.pass, true, JSON.stringify(result));
});
test('historical mixed answers without saved structured answer fields remain rejected by the strict current verifier', () => {
  const result = verify(legacyMixed);
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.name === 'selection-confirmed-from-exact-answer-provenance').pass, false);
  assert.equal(result.checks.find(check => check.name === 'delegation-does-not-confirm').pass, false);
});
test('a replacement without the old decision being superseded fails', () => {
  const fixture = structuredClone(reopened);
  fixture.after.decisions.items.find(d => d.status === 'superseded' && d.decisionKey === 'dec-visual-layout-mapping').status = 'confirmed';
  assert.equal(verify(fixture).pass, false);
});
test('a confirmed decision with a wrong answer provenance fails', () => {
  const fixture = structuredClone(reopened);
  fixture.after.decisions.items.at(-1).approvalSource = 'answer:unrelated';
  assert.equal(verify(fixture).pass, false);
});
test('a delegated answer creating a confirmed decision fails even if the total count looks valid', () => {
  const fixture = structuredClone(mixed), delegated = fixture.answers.find(answer => answer.kind === 'delegate');
  const selected = fixture.after.decisions.items.find(d => d.approvalSource === `answer:${fixture.operationId}`);
  selected.evidenceRefs = [`question:${delegated.questionId}`];
  assert.equal(verify(fixture).pass, false);
});
test('silently confirming an existing candidate fails', () => {
  const fixture = structuredClone(mixed);
  fixture.after.decisions.items.find(d => d.status === 'candidate').status = 'confirmed';
  assert.equal(verify(fixture).pass, false);
});
test('changing the saved delegation original text fails', () => {
  const fixture = structuredClone(mixed), delegated = fixture.answers.find(answer => answer.kind === 'delegate');
  fixture.after.planning.inputs.find(input => input.questionId === delegated.questionId).raw += ' rewritten';
  assert.equal(verify(fixture).pass, false);
});
