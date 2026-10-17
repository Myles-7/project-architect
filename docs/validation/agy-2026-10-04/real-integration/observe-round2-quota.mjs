import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const labels = ['flash-vague-quality-resume-20261005-07', 'flash-materials-quality-20261005-02'];
const controls = [];
for (const label of labels) {
  const bytes = await readFile(join(root, label, 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (!manifest.completedAt || manifest.activeCallsAtShutdown !== 0) throw new Error('Control must be frozen');
  const failures = manifest.providerCalls.filter(call => call.error?.includes('Individual quota reached')).map(call => {
    const match = call.error.match(/Resets in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    const delayMs = match ? ((Number(match[1] || 0) * 60 + Number(match[2] || 0)) * 60 + Number(match[3] || 0)) * 1000 : null;
    return {
      requestId: call.requestId, model: call.model, completedAt: call.completedAt, error: call.error,
      reportedDelayMs: delayMs,
      estimateFromCompletionUTC: delayMs === null ? null : new Date(Date.parse(call.completedAt) + delayMs).toISOString(),
      scope: 'Provider estimate only. Completion can follow the actual error event; this does not guarantee availability.'
    };
  });
  controls.push({
    label, manifestSha256: createHash('sha256').update(bytes).digest('hex'), status: manifest.status,
    completedAt: manifest.completedAt, actualNewCalls: manifest.providerCalls.length,
    successes: manifest.providerCalls.filter(call => call.status === 'success').length,
    inheritedReceiptCount: manifest.migration.receipts.length, activeCallsAtShutdown: manifest.activeCallsAtShutdown,
    failures, nextLabel: label.includes('vague') ? 'flash-vague-quality-resume-20261005-08' : 'flash-materials-quality-resume-20261005-03',
    nextArgs: ['docs/validation/agy-2026-10-04/real-integration/run-flows.mjs', manifest.mode,
      label.includes('vague') ? 'flash-vague-quality-resume-20261005-08' : 'flash-materials-quality-resume-20261005-03',
      manifest.requestedConfig.designModel, manifest.requestedConfig.reviewModel,
      `resume-from=${label}`, 'shared-group=flash-m8-20261005']
  });
}
const result = {
  observedAtUTC: new Date().toISOString(), status: 'waiting_external_quota', controls,
  continuation: 'Resume publicly in a fresh process after the estimated reset. Preserve completed candidate/result/receipt bytes. Do not repeatedly call an exhausted service or automatically switch models.',
  acceptance: 'No new final quality package exists. Runtime review/integration and independent final artifact checks remain required; approvals are automated API acceptance, not human review.'
};
await writeFile(join(root, 'round2-quota-recovery.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(controls.map(control => ({ label: control.label, status: control.status, calls: control.actualNewCalls, successes: control.successes, estimatedReset: control.failures.at(-1)?.estimateFromCompletionUTC }))));
