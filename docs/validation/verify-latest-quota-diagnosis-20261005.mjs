import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('docs/validation');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const hash = async path => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
const summary = await json('refactor-summary.json');
const checks = [];
const check = (name, pass, details) => {
  checks.push({ name, pass: !!pass, details });
  if (!pass) throw new Error(name);
};
for (const [path, expected] of Object.entries(summary.finalEvidenceHashes)) {
  check(`preserved-local-evidence:${path}`, await hash(path) === expected);
}
for (const path of summary.latestGeminiAvailability.actualProbeResults) {
  const probe = await json(path);
  check(`actual-quota-failure:${probe.model}`, probe.status === 'failed' && !probe.structuredSuccess && probe.structuredOutput == null && probe.stderr.includes('RESOURCE_EXHAUSTED') && probe.stderr.includes('429'), {checkedAt: probe.checkedAt});
}
const usage = await json(summary.latestGeminiAvailability.interactiveUsage.report);
check('quota-window-diagnosis-matches-observation', usage.weeklyLimitRemainingPercent === 83.12 && usage.fiveHourLimitRemainingPercent === 0 && !usage.availabilityProven && usage.interactiveProcessExited);
for (const label of summary.resumableGeminiControls) {
  const base = `agy-2026-10-04/real-integration/${label}`;
  const manifest = await json(`${base}/manifest.json`);
  const review = await json(`${base}/independent-content-review.json`);
  check(`source-control-stopped:${label}`, manifest.status === 'blocked' && manifest.activeCallsAtShutdown === 0 && !manifest.sharedProviderSlots.ownedLeasesAtShutdown.length && !manifest.approvals.length && !manifest.packages.some(value => !value.inheritedFrom));
  check(`source-content-acceptance-still-pending:${label}`, review.contentPassed === null);
  for (const [path, expected] of Object.entries(review.frozenHashes)) check(`source-frozen-bytes:${label}/${path}`, await hash(`${base}/${path}`) === expected);
}
check('final-acceptance-not-falsely-promoted', summary.realFullFlow === 'blocked_by_actual_provider_quota_final_content_not_accepted' && summary.humanReview === 'pending');
const report = {checkedAtUTC:new Date().toISOString(),status:'passed',scope:'Current failed probes, transcribed read-only quota observation and preserved local/frozen-source evidence only; no new full-flow execution or content acceptance.',providerInvocations:0,checks};
await writeFile(resolve(root,'agy-quota-diagnosis-verification-20261005.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({status:report.status,checks:checks.length,providerInvocations:0,realFullFlow:summary.realFullFlow}));
