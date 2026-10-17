import { readFile, readdir, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Frozen evidence is hashed by relative names and exact bytes, never normalized. */
export async function treeSha256(root) {
  const rows = [];
  async function walk(path, prefix = '') {
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Frozen evidence may not use symbolic links');
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error('Frozen evidence may not use symbolic links');
      if (entry.isDirectory()) await walk(join(path, entry.name), relative);
      else if (entry.isFile()) rows.push([relative, sha256(await readFile(join(path, entry.name)))]);
      else throw new Error('Frozen evidence contains an unsupported filesystem entry');
    }
  }
  await walk(root);
  return { sha256: sha256(JSON.stringify(rows)), fileCount: rows.length };
}

export async function frozenRunInventory(projectPath) {
  const root = join(projectPath, 'runtime', 'planning'), records = [];
  for (const id of (await readdir(root)).sort()) {
    if (!/^run-[a-z0-9-]+$/.test(id)) continue;
    const directory = join(root, id), bytes = await readFile(join(directory, 'run.json'));
    const run = JSON.parse(bytes.toString('utf8'));
    if (run.id !== id || !Array.isArray(run.tasks) || ['queued', 'running'].includes(run.status)) throw new Error('Model transition requires stopped inherited Runs');
    records.push({ runId: id, stage: run.stage, status: run.status, runSha256: sha256(bytes), tree: await treeSha256(directory), effectiveConfig: run.effectiveConfig ?? null,
      tasks: run.tasks.map(task => ({ id: task.id, kind: task.kind, status: task.status, model: task.model ?? null, attempts: task.attempts, outputOrigin: task.outputOrigin ?? null })) });
  }
  return records;
}

export async function latestStoredPendingDraft(projectPath) {
  const pointer = JSON.parse(await readFile(join(projectPath, 'state', 'current.json'), 'utf8'));
  if (!Number.isSafeInteger(pointer.revision) || pointer.revision < 1) throw new Error('Invalid frozen state pointer');
  const changes = JSON.parse(await readFile(join(projectPath, 'state', 'revisions', String(pointer.revision), 'changesets.json'), 'utf8'));
  const candidate = changes.filter(change => ['pending', 'partially-approved'].includes(change.status) && change.groups?.some(group => group.status === 'pending')).at(-1);
  if (!candidate) throw new Error('Frozen source has no stored pending candidate');
  return { candidate, sourceStateRevision: pointer.revision, candidateSha256: sha256(JSON.stringify(candidate)) };
}

export async function verifyInheritedRunTrees(projectPath, inventory) {
  const observations = [];
  for (const record of inventory) {
    const directory = join(projectPath, 'runtime', 'planning', record.runId), tree = await treeSha256(directory);
    const runHash = sha256(await readFile(join(directory, 'run.json')));
    observations.push({ runId: record.runId, expectedTreeSha256: record.tree.sha256, actualTreeSha256: tree.sha256,
      pass: tree.sha256 === record.tree.sha256 && runHash === record.runSha256 });
  }
  if (observations.some(record => !record.pass)) throw new Error('Inherited Run/task/result/receipt/journal bytes changed during model transition');
  return observations;
}

/** Explicit authorized transitions create new Runs. They cannot relax ordinary resume model freezing. */
export async function approvedModelTransition({ transitionFile, sourceManifestPath, sourceManifest, sourceLabel, mode, operation, designModel, reviewModel, qualityFile }) {
  if (!transitionFile) return undefined;
  if (!['quality-from', 'draft-from'].includes(operation)) throw new Error('Model transition requires quality-from or draft-from; original Runs cannot change frozen models');
  const approvalPath = resolve(transitionFile), approvalBytes = await readFile(approvalPath), plan = JSON.parse(approvalBytes.toString('utf8'));
  if (plan.schemaVersion !== 1 || plan.kind !== 'approved-model-transition' || plan.authorization?.status !== 'authorized' || plan.authorization?.authority !== 'delegated-user-authorization' || !plan.authorization?.instruction) throw new Error('Explicit model transition authorization record required');
  const control = plan.controls?.find(value => value.sourceLabel === sourceLabel && value.mode === mode && value.operation === operation);
  if (!control || plan.targetConfig?.designModel !== designModel || plan.targetConfig?.reviewModel !== reviewModel) throw new Error('Requested model transition does not match authorized source/mode/target models');
  if (sourceManifest.activeCallsAtShutdown !== 0 || !['completed', 'blocked', 'failed'].includes(sourceManifest.status) || (sourceManifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length ?? 0) !== 0) throw new Error('Model transition requires a frozen source with no active calls or leases');
  if (operation === 'quality-from' && sourceManifest.status !== 'completed') throw new Error('Quality transition requires a completed source');
  if (JSON.stringify(sourceManifest.requestedConfig) !== JSON.stringify(control.sourceConfig)) throw new Error('Frozen source configuration differs from the authorization record');
  const sourceBytes = await readFile(sourceManifestPath), sourceTree = await treeSha256(dirname(sourceManifestPath));
  if (sha256(sourceBytes) !== control.sourceManifestSha256 || sourceTree.sha256 !== control.sourceTreeSha256) throw new Error('Frozen source tree differs from the authorization record');
  const feedbackBytes = await readFile(resolve(qualityFile));
  if (sha256(feedbackBytes) !== control.qualityFileSha256) throw new Error('Quality feedback differs from the authorization record');
  const probeBytes = await readFile(plan.availabilityProbe.path), probe = JSON.parse(probeBytes.toString('utf8'));
  if (sha256(probeBytes) !== plan.availabilityProbe.sha256 || probe.status !== 'success' || !probe.structuredSuccess || ![designModel, reviewModel].every(model => model === probe.model)) throw new Error('Availability probe does not support the recorded target model');
  const inventory = await frozenRunInventory(join(dirname(sourceManifestPath), 'project-records'));
  if (JSON.stringify(inventory) !== JSON.stringify(control.inheritedRuns)) throw new Error('Inherited Run inventory differs from the authorization record');
  const draft = operation === 'draft-from' ? await latestStoredPendingDraft(join(dirname(sourceManifestPath), 'project-records')) : undefined;
  if (draft && (draft.candidate.id !== control.draftReference?.changeSetId || draft.candidateSha256 !== control.draftReference?.candidateSha256 || control.draftReference?.strategy !== 'new-feedback-with-full-unapproved-reference')) throw new Error('Latest stored pending reference differs from the authorized fallback');
  return { draftCandidate: draft?.candidate, audit: { approvalPath, approvalSha256: sha256(approvalBytes), authorization: plan.authorization,
    sourceLabel, operation, sourceConfig: control.sourceConfig, targetConfig: plan.targetConfig, sourceManifestSha256: control.sourceManifestSha256,
    sourceTreeSha256: sourceTree.sha256, projectRecordsTreeSha256: control.projectRecordsTreeSha256, qualityFileSha256: control.qualityFileSha256, availabilityProbe: plan.availabilityProbe,
    execution: 'New registered Run only; inherited Runs, tasks, models and all receipt/output bytes are immutable', inheritedRuns: inventory,
    ...(draft ? { draftReference: control.draftReference } : {}), contentAcceptance: 'Independent final content review pending; availability probe is not planning quality evidence' } };
}
