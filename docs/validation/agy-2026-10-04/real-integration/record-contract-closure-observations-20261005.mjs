import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const items = [
  { label: 'flash-vague-contract-closure-20261005-11', count: 43, feedback: 'quality-feedback-notes-final-contract-20261005.txt', findings: [
    { id: 'N9', blocks: ['data-model-core-entities', 'feature-data-portability', 'interface-service-contracts', 'acceptance-data-portability'], reason: 'Count/revision-sum/max/time aggregates are not a reliable write version; the saved collision counterexample preserves all aggregates after deletion and creation. Preview payload ownership/execution integrity is also unspecified.', evidence: '../../../import-preview-collision-20261005.json' },
    { id: 'N11', blocks: ['data-model-core-entities', 'interface-service-contracts', 'error-architecture-and-recovery', 'acceptance-quick-capture'], reason: 'SessionDraft shape is now consistent, but corrupt/version/key validation and sessionStorage itself failing remain unspecified. The success message and file export cannot assume an unavailable session store worked.' },
    { id: 'N12', blocks: ['data-model-core-entities', 'feature-data-portability', 'task-data-portability'], reason: 'Canonical backupTracker is duplicated by optional appMeta containing that same key, without equality/rejection rules. appSettings remains untyped and full strong validation is claimed without complete field rules.' },
    { id: 'N14', blocks: ['acceptance-storage-and-search-benchmark', 'val-storage-and-search-benchmark', 'block-outcomes-lightweight-experience'], reason: 'Acceptance calls a requestAnimationFrame callback physical drawing completion and simulated keydown a physical key press. The full-keyword typing duration/startpoint is inconsistent with the bounded processing latency.' },
    { id: 'N15', blocks: ['feature-search-filter', 'flow-search-filter', 'tech-storage-and-search', 'page-main-workspace'], reason: 'Favorite search feature/flow use only isFavorite=true, while technology/page explicitly exclude trashed favorite records.' },
  ] },
  { label: 'flash-materials-contract-closure-20261005-11', count: 30, feedback: 'quality-feedback-materials-final-contract-20261005.txt', findings: [
    { id: 'M4', blocks: ['blk-tech-module', 'blk-tech-interface', 'blk-flow-input-display', 'blk-deliv-task-error-handling'], reason: 'Only reset listener cleanup is specified; input/composition partial binding and retry cleanup lack ownership. focusInput runs before activeInputNode is set, so initialization can silently skip focus and still commit ready.' },
    { id: 'M6', blocks: ['blk-tech-module', 'blk-tech-interface', 'blk-tech-error', 'blk-deliv-acc-full-e2e', 'blk-acc-reset'], reason: 'Global notification creation/mount failure has no honest return boundary. Severe fallback promises a retained local snapshot without durable in-memory ownership or an actual retry/retrieval path after the function returns.' },
    { id: 'M7', blocks: ['blk-deliv-acc-security-edge', 'blk-tech-error', 'blk-prod-outcomes'], reason: 'The general runtime error acceptance promises the draft remains editable for any DOM/script error; the severe rollback contract allows the main editor to be unavailable. The security-edge acceptance is therefore in the affected scope.' },
  ] },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const item of items) {
  const directory = resolve('docs/validation/agy-2026-10-04/real-integration', item.label);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.status !== 'blocked' || manifest.activeCallsAtShutdown !== 0 || manifest.sharedProviderSlots.ownedLeasesAtShutdown.length) throw new Error('Stopped blocked control required');
  const bytes = await readFile(join(directory, 'candidate-review-preview.json'));
  const preview = JSON.parse(bytes.toString('utf8'));
  const contextBytes = await readFile(preview.contextPath);
  if (digest(contextBytes) !== preview.contextSha256 || preview.candidateBlocks.length !== item.count) throw new Error('Candidate source changed');
  const context = JSON.parse(contextBytes.toString('utf8'));
  const map = new Map(context.blueprint.blocks.map(block => [block.id, block]));
  for (const group of context.workerResults.draft.groups) {
    for (const id of group.removeBlockIds ?? []) map.delete(id);
    for (const block of group.blocks) map.set(block.id, block);
  }
  if (JSON.stringify([...map.values()]) !== JSON.stringify(preview.candidateBlocks)) throw new Error('Candidate assembly differs from reviewed input');
  for (const finding of item.findings) for (const id of finding.blocks) if (!map.has(id)) throw new Error(`Missing observed block ${id}`);
  const feedbackBytes = await readFile(join(directory, '..', item.feedback));
  const result = { label: item.label, checkedAt: new Date().toISOString(), status: 'blocked', contentPassed: false,
    scope: 'Independent verification of concrete cross-contract counterexamples in the candidate bodies and related task fields. This blocked report is not a complete final semantic pass; full candidate and compiled-document reading is still required. Provider review has no successful terminal result. No final compiled-package or human acceptance is implied.',
    finalReviewStatus: 'pending', humanReview: 'pending', targetApplicationExecution: 'unexecuted',
    candidateContextSha256: preview.contextSha256, candidatePreviewSha256: digest(bytes),
    taskId: preview.taskId, blockCount: map.size, findings: item.findings,
    proposedQualityFeedback: join('..', item.feedback), feedbackSha256: digest(feedbackBytes), feedbackApplied: false };
  await writeFile(join(directory, 'independent-content-review.json'), JSON.stringify(result, null, 2));
  const latest = manifest.providerCalls.filter(call => call.completedAt).at(-1);
  const duration = latest.error?.match(/Resets in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  const estimate = duration ? new Date(Date.parse(latest.completedAt) + ((Number(duration[1]) || 0) * 3600 + (Number(duration[2]) || 0) * 60 + (Number(duration[3]) || 0)) * 1000) : null;
  console.log(JSON.stringify({ label: item.label, status: result.status, contentPassed: false, findings: item.findings.length,
    completedAtUTC: latest.completedAt, serviceEstimateAsiaShanghai: estimate?.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }), estimateIsNotGuarantee: true }));
}
