import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const label = process.argv[2];
if (!label) throw new Error('Usage: diagnose-answer-provenance.mjs <frozen-control-label>');
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const evidenceFiles = [];
async function json(relative) {
  const bytes = await readFile(join(root, relative));
  evidenceFiles.push({ relative, bytes: bytes.length, sha256: sha256(bytes) });
  return JSON.parse(bytes.toString('utf8'));
}
const manifest = await json('manifest.json');
const operation = manifest.answers.at(-1);
if (!operation) throw new Error('No answer operation to diagnose');
const current = await json('project-records/state/current.json');
const beforeRevision = current.revision - 1;
const before = {}, after = {};
for (const name of ['decisions', 'planning', 'questions']) {
  before[name] = await json(`project-records/state/revisions/${beforeRevision}/${name}.json`);
  after[name] = await json(`project-records/state/revisions/${current.revision}/${name}.json`);
}
const originalHarness = await readFile(resolve('docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs'));
const harnessCopy = 'diagnostic-original-run-flows-models.mjs';
await writeFile(join(root, harnessCopy), originalHarness, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
const frozenHarness = await readFile(join(root, harnessCopy));
const originalAssertion = frozenHarness.toString('utf8').split(/\r?\n/).find(line => line.includes("check('delegation-does-not-confirm'"));
const beforeIds = new Set(before.decisions.items.map(d => d.id));
const newDecisions = after.decisions.items.filter(d => !beforeIds.has(d.id));
const changes = before.decisions.items.flatMap(prior => {
  const next = after.decisions.items.find(d => d.id === prior.id);
  return JSON.stringify(prior) === JSON.stringify(next) ? [] : [{ before: prior, after: next }];
});
const answers = operation.answers.map(answer => {
  const question = before.questions.items.find(q => q.id === answer.questionId);
  const afterQuestion = after.questions.items.find(q => q.id === answer.questionId);
  const beforeTopic = before.planning.topics.find(t => t.key === question?.decisionKey || t.aliases.includes(question?.decisionKey ?? ''));
  const afterTopic = after.planning.topics.find(t => t.key === question?.decisionKey || t.aliases.includes(question?.decisionKey ?? ''));
  const created = newDecisions.filter(d => d.approvalSource === `answer:${operation.operationId}` && d.evidenceRefs?.includes(`question:${answer.questionId}`));
  return { answer, question, afterQuestion, beforeTopic, afterTopic, createdDecisions: created, delegationInputs: after.planning.inputs.filter(i => i.questionId === answer.questionId && i.kind === 'delegation') };
});
const beforeConfirmed = before.decisions.items.filter(d => d.status === 'confirmed').length;
const afterConfirmed = after.decisions.items.filter(d => d.status === 'confirmed').length;
const diagnostic = {
  kind: 'Frozen real Core answer provenance; simulated input, not human approval',
  label, observedAt: new Date().toISOString(), operationId: operation.operationId,
  revisions: { before: beforeRevision, after: current.revision },
  originalAssertion: { text: originalAssertion, harnessCopy, sha256: sha256(frozenHarness), beforeConfirmed, afterConfirmed, actualDelta: afterConfirmed - beforeConfirmed, expectedDelta: operation.answers.filter(a => a.kind === 'selection').length, passed: afterConfirmed - beforeConfirmed === operation.answers.filter(a => a.kind === 'selection').length },
  answers, newDecisions, existingDecisionChanges: changes,
  evidenceFiles,
  providerBoundary: { activeCallsAtShutdown: manifest.activeCallsAtShutdown, ownedLeasesAtShutdown: manifest.sharedProviderSlots?.ownedLeasesAtShutdown },
  disposition: 'Diagnostic only; original control and manifest remain unchanged. No restart authorized by this artifact.'
};
await writeFile(join(root, 'answer-provenance-diagnostic.json'), JSON.stringify(diagnostic, null, 2));
console.log(JSON.stringify({ label, diagnostic: join(root, 'answer-provenance-diagnostic.json'), revisions: diagnostic.revisions, originalAssertion: diagnostic.originalAssertion, answers: answers.map(value => ({ kind: value.answer.kind, questionId: value.answer.questionId, decisionKey: value.question?.decisionKey, beforeEffective: value.beforeTopic?.effectiveDecisionId, afterEffective: value.afterTopic?.effectiveDecisionId, created: value.createdDecisions.map(d => ({ id: d.id, status: d.status, approvalSource: d.approvalSource, evidenceRefs: d.evidenceRefs })) })), existingDecisionChanges: changes.map(change => ({ id: change.before.id, decisionKey: change.before.decisionKey, beforeStatus: change.before.status, afterStatus: change.after?.status, supersededBy: change.after?.supersededBy })), providerBoundary: diagnostic.providerBoundary }, null, 2));
