import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sha256, treeSha256, frozenRunInventory, latestStoredPendingDraft } from './model-transition.mjs';

const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const output = join(root, 'approved-model-transition-opus-20261005.json');
const probePath = resolve('docs/validation/agy-2026-10-04/account-probes/claude-opus-4-6-thinking-1791162606682/result.json');
const probeBytes = await readFile(probePath), probe = JSON.parse(probeBytes.toString('utf8'));
if (probe.model !== 'claude-opus-4-6-thinking' || probe.status !== 'success' || !probe.structuredSuccess) throw new Error('Recorded Opus structured availability probe must have succeeded');
const controls = [];
for (const entry of [
  { mode: 'materials', sourceLabel: 'flash-materials-final-20261005-03', operation: 'quality-from', qualityFile: 'quality-feedback-materials-round7.txt' },
  { mode: 'vague', sourceLabel: 'flash-vague-draft-final-20261005-02', operation: 'draft-from', qualityFile: 'quality-feedback-vague-round2.txt' },
]) {
  const source = join(root, entry.sourceLabel), bytes = await readFile(join(source, 'manifest.json')), manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.activeCallsAtShutdown !== 0 || (manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length ?? 0) !== 0 || !['completed', 'blocked', 'failed'].includes(manifest.status)) throw new Error('Source control must already be stopped');
  const before = await treeSha256(source), inventory = await frozenRunInventory(join(source, 'project-records'));
  const feedbackPath = join(root, entry.qualityFile), feedback = await readFile(feedbackPath);
  const draft = entry.operation === 'draft-from' ? await latestStoredPendingDraft(join(source, 'project-records')) : undefined;
  const after = await treeSha256(source);
  if (before.sha256 !== after.sha256) throw new Error('Source tree changed while preparing transition');
  controls.push({ ...entry, qualityFile: feedbackPath, qualityFileSha256: sha256(feedback), sourceConfig: manifest.requestedConfig, projectRecordsTreeSha256: (await treeSha256(join(source, 'project-records'))).sha256,
    sourceManifestSha256: sha256(bytes), sourceTreeSha256: before.sha256, sourceFileCount: before.fileCount, preparationSourceTreeUnchanged: true, inheritedRuns: inventory,
    ...(draft ? { draftReference: { changeSetId: draft.candidate.id, runId: draft.candidate.runId, sourceStateRevision: draft.sourceStateRevision, candidateSha256: draft.candidateSha256,
      groups: draft.candidate.groups.length, blocks: draft.candidate.groups.reduce((count, group) => count + group.blocks.length, 0), storedStatus: draft.candidate.status,
      strategy: 'new-feedback-with-full-unapproved-reference', executionFragmentsReused: false,
      reason: 'Stopped Flash Run has unfinished scope revision fragments but no final integrated ChangeSet. The latest stored pending candidate has an obsolete basis; public draftChangeSetId rejects it. Do not rebase that record or modify frozen models. Use the approved blueprint as authority and the complete unapproved candidate as hash-labelled reference input for a new feedback Run.' } } : {}) });
}
const plan = { schemaVersion: 1, kind: 'approved-model-transition', recordedAt: new Date().toISOString(),
  authorization: { status: 'authorized', authority: 'delegated-user-authorization', instruction: 'Parent task /root explicitly authorizes claude-opus-4-6-thinking for both design and review. Materials: new quality feedback from completed r6. Notes: new feedback Run uses the full approved blueprint as authority and the complete 43-block/9-group unapproved draft as a hash-labelled reference; all ten quality findings remain in scope. Preserve old Runs, drafts and receipts; do not rewrite stale basis or claim partial execution reuse. Provider launch remains owned by /root. This record is not a claim of human content review or approval of any ChangeSet.' },
  targetConfig: { concurrency: 4, designModel: 'claude-opus-4-6-thinking', reviewModel: 'claude-opus-4-6-thinking' },
  availabilityProbe: { path: probePath, sha256: sha256(probeBytes), model: probe.model, checkedAt: probe.checkedAt, scope: probe.scope }, controls };
await writeFile(output, JSON.stringify(plan, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ output, providerInvoked: false, controls: controls.map(value => ({ sourceLabel: value.sourceLabel, sourceTreeSha256: value.sourceTreeSha256, inheritedRuns: value.inheritedRuns.length, draftReference: value.draftReference })) }));
