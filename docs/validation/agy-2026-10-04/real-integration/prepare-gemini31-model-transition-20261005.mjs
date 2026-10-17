import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sha256, treeSha256, frozenRunInventory } from './model-transition.mjs';

// Additive authorization record for a new Run; never alter the earlier
// Flash control, its frozen model profile, receipts, proposal or package.
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const sourceLabel = 'flash-materials-final-20261005-04';
const source = join(root, sourceLabel);
const model = 'gemini-3.1-pro-high';
const output = join(root, 'approved-model-transition-gemini31-20261005.json');
const probePath = resolve('docs/validation/agy-2026-10-04/account-probes/gemini-3.1-pro-high-1791165367801/result.json');
const probeBytes = await readFile(probePath), probe = JSON.parse(probeBytes);
if (probe.model !== model || probe.status !== 'success' || !probe.structuredSuccess) throw new Error('Recorded Gemini 3.1 structured availability probe must have succeeded');
const bytes = await readFile(join(source, 'manifest.json')), manifest = JSON.parse(bytes);
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0 || (manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length ?? 0) !== 0) throw new Error('Source control must be frozen and stopped');
const review = JSON.parse(await readFile(join(source, 'independent-content-review.json')));
if (review.contentPassed !== false) throw new Error('Require explicit independent content findings before this targeted repair');
const before = await treeSha256(source);
const inheritedRuns = await frozenRunInventory(join(source, 'project-records'));
const qualityFile = join(root, 'quality-feedback-materials-round8.txt'), feedback = await readFile(qualityFile);
const projectTree = await treeSha256(join(source, 'project-records'));
if ((await treeSha256(source)).sha256 !== before.sha256) throw new Error('Source tree changed during preparation');
const plan = {
  schemaVersion: 1, kind: 'approved-model-transition', recordedAt: new Date().toISOString(),
  authorization: { status: 'authorized', authority: 'delegated-user-authorization', instruction: 'The user approved Gemini use, the Gemini 3.1 Pro planning capability and continued completion without cost gates. Parent /root selects gemini-3.1-pro-high for the new registered materials round8 design and independent review to address the frozen r7 module/transaction and initialization findings. Use approved sourceRevision44 as authority, preserve correct r7 work and the truly unrelated 18 blocks. No original Run/model/basis/receipt is rewritten. This authorization is not human content review or approval of a ChangeSet.' },
  targetConfig: { concurrency: 4, designModel: model, reviewModel: model },
  availabilityProbe: { path: probePath, sha256: sha256(probeBytes), model, checkedAt: probe.checkedAt, scope: probe.scope },
  controls: [{ mode: 'materials', sourceLabel, operation: 'quality-from', qualityFile, qualityFileSha256: sha256(feedback), sourceConfig: manifest.requestedConfig, projectRecordsTreeSha256: projectTree.sha256, sourceManifestSha256: sha256(bytes), sourceTreeSha256: before.sha256, sourceFileCount: before.fileCount, preparationSourceTreeUnchanged: true, inheritedRuns }],
};
await writeFile(output, JSON.stringify(plan, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ output, providerInvoked: false, model, sourceLabel, sourceTreeSha256: before.sha256, inheritedRuns: inheritedRuns.length }));
