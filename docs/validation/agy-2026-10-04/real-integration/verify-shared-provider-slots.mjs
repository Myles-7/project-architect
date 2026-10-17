import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const group = process.argv[2];
if (!/^[a-z0-9-]+$/.test(group ?? '')) throw new Error('Shared Provider group required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const directory = join(root, 'global-provider-slots', group);
const checks = [];
function check(name, pass, details) {
  checks.push({ name, pass: !!pass, ...(details === undefined ? {} : { details }) });
  if (!pass) throw new Error(name);
}
const controls = [];
const actualCli = [];
const effortFor = model => model === 'claude-opus-4-6-thinking' ? null : ['gemini-3.8-flash-high','gemini-3.1-pro-high'].includes(model) ? 'high' : undefined;
let maxConcurrentCalls = 0, journalSha256, error;
try {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let manifest;
    try { manifest = JSON.parse(await readFile(join(root, entry.name, 'manifest.json'), 'utf8')); }
    catch (caught) { if (caught.code === 'ENOENT') continue; throw caught; }
    if (manifest.sharedProviderSlots?.group !== group) continue;
    controls.push({ label: entry.name, status: manifest.status, calls: manifest.providerCalls, requestedConfig:manifest.requestedConfig, activeCallsAtShutdown: manifest.activeCallsAtShutdown, ownedLeasesAtShutdown: manifest.sharedProviderSlots.ownedLeasesAtShutdown });
  }
  check('shared-controls-found', controls.length > 0, controls.map(control => control.label));
  check('every-control-terminal-and-shut-down', controls.every(control => ['completed', 'failed', 'blocked'].includes(control.status) && control.activeCallsAtShutdown === 0 && Array.isArray(control.ownedLeasesAtShutdown) && control.ownedLeasesAtShutdown.length === 0), controls.map(({ calls, ...control }) => control));
  const calls = controls.flatMap(control => control.calls.map(call => ({ ...call, label: control.label, allowedModels:[control.requestedConfig.designModel,control.requestedConfig.reviewModel] })));
  check('every-actual-call-has-complete-interval-and-lease', calls.every(call => call.sharedLease?.group === group && call.sharedLease.label === call.label && call.sharedLease.requestId === call.requestId && Number.isFinite(Date.parse(call.startedAt)) && Number.isFinite(Date.parse(call.completedAt)) && Date.parse(call.completedAt) >= Date.parse(call.startedAt)), calls.map(call => ({ label: call.label, requestId: call.requestId, startedAt: call.startedAt, completedAt: call.completedAt, token: call.sharedLease?.token })));
  check('all-calls-match-frozen-explicit-model-profile', calls.every(call => call.allowedModels.includes(call.model) && effortFor(call.model) !== undefined && call.reasoningEffort === (effortFor(call.model) === null ? 'model-native-thinking' : effortFor(call.model))));
  for (const call of calls) {
    const bytes = await readFile(call.logPath), envelopes = bytes.toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const invocations = envelopes.filter(envelope => envelope.stream === 'invocation');
    const invocation = invocations[0]?.data, args = invocation?.args ?? [];
    const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
    check('actual-cli-invokes-exact-profile-once-without-duration-cutoff', invocations.length === 1 && args.includes('--model') && option('--model') === call.model && option('--effort') === effortFor(call.model) && args.includes('--print-timeout') && option('--print-timeout') === '0' && invocation.timeoutMs === null, { label: call.label, requestId: call.requestId, args, timeoutMs: invocation?.timeoutMs });
    const initModels = [];
    const stdout = envelopes.filter(value => value.stream === 'stdout').map(envelope => envelope.data).join('');
    for (const line of stdout.split('\n').filter(Boolean)) {
      let event; try { event = JSON.parse(line); } catch { continue; }
      if (event.event === 'init') initModels.push(event.init?.model);
    }
    check('actual-stream-init-does-not-change-model', initModels.every(model => model === call.model), { label: call.label, requestId: call.requestId, initModels, observed:initModels.length>0 });
    actualCli.push({ label: call.label, requestId: call.requestId, logPath: call.logPath, logSha256: createHash('sha256').update(bytes).digest('hex'), invocationCount: invocations.length, model: option('--model'), effort: option('--effort'), initModels });
  }
  const journalBytes = await readFile(join(directory, 'events.ndjson'));
  journalSha256 = createHash('sha256').update(journalBytes).digest('hex');
  const events = journalBytes.toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const acquisitions = events.filter(event => event.event === 'acquired'), releases = events.filter(event => event.event === 'released');
  check('journal-has-exact-call-acquisition-and-release-count', acquisitions.length === calls.length && releases.length === calls.length, { calls: calls.length, acquisitions: acquisitions.length, releases: releases.length });
  check('journal-records-at-most-four-exclusive-slots', events.every(event => Array.isArray(event.occupiedSlots) && event.occupiedSlots.length <= 4 && new Set(event.occupiedSlots).size === event.occupiedSlots.length && event.occupiedSlots.every(name => /^slot-[0-3]\.json$/.test(name))));
  const tokens = new Set();
  for (const call of calls) {
    const lease = call.sharedLease, acquired = acquisitions.filter(event => event.token === lease.token), released = releases.filter(event => event.token === lease.token);
    check('one-unique-owned-lease-per-call', !tokens.has(lease.token) && acquired.length === 1 && released.length === 1 && acquired[0].pid === lease.pid && released[0].pid === lease.pid && acquired[0].label === call.label && released[0].label === call.label && acquired[0].requestId === call.requestId && released[0].requestId === call.requestId && acquired[0].index === lease.index && released[0].index === lease.index && lease.index >= 0 && lease.index < 4 && Date.parse(lease.acquiredAt) <= Date.parse(call.startedAt) && Date.parse(released[0].at) >= Date.parse(call.completedAt), { label: call.label, requestId: call.requestId, token: lease.token, index: lease.index });
    if (released[0].recovery) {
      const proofBytes = await readFile(released[0].proofPath);
      const proof = JSON.parse(proofBytes.toString('utf8'));
      const item = proof.calls.find(item => item.requestId === call.requestId && item.token === lease.token);
      const previousManifest = await readFile(join(root, call.label, 'manifest-before-exited-recovery.json'));
      check('interrupted-controller-release-has-honest-recovery-proof',
        call.status === 'interrupted' && call.intervalEndSource?.includes('upper bound') &&
        item?.controllerAbsent === true && item.controllerPid === lease.pid &&
        proof.observedAt === call.completedAt && proof.recoveringProcessId === released[0].recoveredByPid &&
        proof.previousManifestSha256 === createHash('sha256').update(previousManifest).digest('hex') &&
        item.partialLogSha256 === actualCli.find(record => record.label === call.label && record.requestId === call.requestId)?.logSha256,
        { label: call.label, requestId: call.requestId, proofPath: released[0].proofPath, scope: 'Recovery observation closes a conservative interval; this is not successful model completion or an exact exit timestamp.' });
    }
    tokens.add(lease.token);
  }
  // Use Provider intervals, not append ordering: journal appends can race after a slot is released.
  const timeline = calls.flatMap(call => [{ at: Date.parse(call.startedAt), delta: 1, token: call.sharedLease.token }, { at: Date.parse(call.completedAt), delta: -1, token: call.sharedLease.token }]).sort((left, right) => left.at - right.at || left.delta - right.delta);
  let active = 0;
  for (const event of timeline) { active += event.delta; maxConcurrentCalls = Math.max(maxConcurrentCalls, active); check('provider-interval-count-valid', active >= 0 && active <= 4, { at: new Date(event.at).toISOString(), active }); }
  check('final-provider-interval-count-zero', active === 0);
  for (let index = 0; index < 4; index++) {
    const slotCalls = calls.filter(call => call.sharedLease.index === index).sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
    check('same-exclusive-slot-never-overlaps-provider-calls', slotCalls.every((call, position) => position === 0 || Date.parse(slotCalls[position - 1].completedAt) <= Date.parse(call.startedAt)), { index, calls: slotCalls.length });
  }
  const remaining = (await readdir(directory)).filter(name => /^slot-[0-3]\.json$/.test(name));
  check('shared-gate-has-zero-remaining-leases', remaining.length === 0, remaining);
} catch (caught) { error = String(caught); process.exitCode = 1; }
const result = { group, checkedAt: new Date().toISOString(), status: error ? 'failed' : 'passed', error, maxConcurrentCalls, journalSha256, controls: controls.map(({ calls, ...control }) => ({ ...control, actualCalls: calls.length })), actualCli, checks };
await writeFile(join(directory, 'shared-provider-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ group, status: result.status, maxConcurrentCalls, controls: result.controls, checks: checks.length, error }));
