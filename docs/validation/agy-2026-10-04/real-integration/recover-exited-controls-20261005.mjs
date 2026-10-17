import { readFile, writeFile, cp, appendFile, unlink, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { FileStorage, ProjectStateEngine, WorkspaceGuard } from '../../../../packages/core/dist/index.js';
import { PlanningRuntime } from '../../../../apps/server/dist/planning/PlanningRuntime.js';

// Only repair validation-controller bookkeeping after its recorded process has
// exited. Formal run recovery goes through the production public Runtime.get.
const labels = process.argv.slice(2);
if (!labels.length || labels.some(label => !/^[a-z0-9-]+$/.test(label))) throw new Error('Explicit exited control labels required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const absent = pid => {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Missing recorded controller PID');
  try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return; throw error; }
  throw new Error(`Controller PID ${pid} still exists; recovery is forbidden`);
};
for (const label of labels) {
  const directory = join(root, label), manifestPath = join(directory, 'manifest.json');
  const bytes = await readFile(manifestPath), manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.status !== undefined && manifest.status !== 'running' || manifest.completedAt) throw new Error(`${label} is not an interrupted running control`);
  const calls = manifest.providerCalls.filter(call => !call.completedAt);
  if (!calls.length) throw new Error('No recorded incomplete Provider call');
  const leases = [];
  for (const call of calls) {
    const lease = call.sharedLease;
    if (!lease || lease.label !== label || lease.requestId !== call.requestId) throw new Error('Call/lease mismatch');
    absent(lease.pid);
    const expectedPath = join(root, 'global-provider-slots', lease.group, `slot-${lease.index}.json`);
    if (resolve(lease.path) !== expectedPath) throw new Error('Lease path outside exact recorded group');
    const leaseBytes = await readFile(expectedPath), recorded = JSON.parse(leaseBytes.toString('utf8'));
    if (recorded.token !== lease.token || recorded.pid !== lease.pid) throw new Error('Lease was reused');
    leases.push({ call, lease, leaseBytes, expectedPath });
  }
  const proofPath = join(directory, 'exited-controller-recovery.json');
  try { await access(proofPath); throw new Error('Recovery proof already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const observedAt = new Date().toISOString();
  await writeFile(join(directory, 'manifest-before-exited-recovery.json'), bytes);
  const proof = {
    label, observedAt, recoveringProcessId: process.pid, previousManifestSha256: hash(bytes),
    scope: 'Recorded controller PIDs absent; actual process exit instant unknown. Recovery timestamp is a conservative call interval upper bound, never a successful terminal result.',
    calls: await Promise.all(leases.map(async ({ call, lease, leaseBytes }) => ({
      requestId: call.requestId, controllerPid: lease.pid, token: lease.token,
      controllerAbsent: true, leaseSha256: hash(leaseBytes),
      partialLogSha256: hash(await readFile(call.logPath)),
    }))),
    recoveredRuns: [],
  };
  const runtime = new PlanningRuntime(new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(manifest.temp)), {
    async complete() { throw new Error('Exited-controller recovery must not call a model'); },
  }, manifest.actualConfig);
  for (const record of manifest.runs) {
    const run = await runtime.get(manifest.path, record.id);
    proof.recoveredRuns.push({ id: run.id, status: run.status, error: run.error, completedTasks: run.tasks.filter(task => task.status === 'completed').length });
    await writeFile(join(directory, `${run.stage}-${run.id}.json`), JSON.stringify(run, null, 2));
  }
  await runtime.shutdown();
  for (const { call, lease, expectedPath, leaseBytes } of leases) {
    absent(lease.pid);
    if (!(await readFile(expectedPath)).equals(leaseBytes)) throw new Error('Lease changed during recovery');
    call.status = 'interrupted';
    call.completedAt = observedAt;
    call.error = 'Validation controller exited without a terminal result; public restart recovery preserves successful tasks and retries this unfinished call.';
    call.intervalEndSource = 'Recovery observation upper bound; actual process exit time unknown';
    await unlink(expectedPath);
    await appendFile(manifest.sharedProviderSlots.journal, JSON.stringify({
      at: observedAt, event: 'released', token: lease.token, index: lease.index, label,
      pid: lease.pid, requestId: call.requestId, recovery: true, recoveredByPid: process.pid,
      proofPath, occupiedSlots: await Promise.all([0, 1, 2, 3].map(async index => {
        try { await access(join(manifest.sharedProviderSlots.directory, `slot-${index}.json`)); return `slot-${index}.json`; }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      })).then(names => names.filter(Boolean)),
    }) + '\n');
  }
  manifest.status = 'failed';
  manifest.error = 'Validation controller exited; recovered through public Runtime.get. Incomplete review output was not accepted.';
  manifest.completedAt = observedAt;
  manifest.activeCallsAtShutdown = 0;
  manifest.sharedProviderSlots.ownedLeasesAtShutdown = [];
  manifest.exitedControllerRecovery = { proofPath, observedAt, callEndIsUpperBound: true };
  await cp(manifest.path, join(directory, 'project-records'), { recursive: true });
  await writeFile(proofPath, JSON.stringify(proof, null, 2));
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ label, status: manifest.status, incompleteCalls: calls.length, recoveredRuns: proof.recoveredRuns.filter(run => run.status === 'paused') }));
}
