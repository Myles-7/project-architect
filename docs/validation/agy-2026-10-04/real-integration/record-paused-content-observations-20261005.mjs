import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

// Record independently read counterexamples, not a keyword-based pass gate.
// Only a stopped candidate with actual known contradictions is marked unaccepted.
const observations = [
  {
    label: 'flash-vague-draft-final-20261005-09',
    feedback: 'quality-feedback-notes-final-consistency-20261005.txt',
    findings: [
      { id: 'N3', blocks: ['interface-service-contracts'], reason: 'hardDeleteNote(id) has neither expected revision nor library generation; the other lifecycle/batch interfaces also fail to carry the complete concurrency basis. A stale action can target an imported record with the same identity.' },
      { id: 'N7', blocks: ['interface-service-contracts', 'acceptance-foundation-and-storage'], reason: 'The same save conflict is specified as throwing ConcurrentEditConflictError and returning conflict:true. The public Promise result and calling code need one consistent convention.' },
      { id: 'N8', blocks: ['acceptance-search-filter'], reason: 'The archived-view search scenario explicitly expects the active record X. That contradicts the archived view state filter.' },
      { id: 'N6', blocks: ['tech-core-architecture', 'deployment-and-build-specification', 'acceptance-storage-and-search-benchmark'], reason: 'Arbitrary HTTP is labelled a secure context; automated input and WebKit driver observations are conflated with physical keyboard and real Safari. These capabilities remain future unexecuted target tests.' },
    ],
  },
  {
    label: 'flash-materials-final-20261005-09',
    feedback: 'quality-feedback-materials-final-consistency-20261005.txt',
    findings: [
      { id: 'M1', blocks: ['blk-feat-input-display', 'blk-flow-input-display', 'blk-tech-interface'], reason: 'The input-display feature/flow increment inputGeneration before replacement; the technical contract increments only at successful commit. These two related input blocks need localized synchronization.' },
      { id: 'M2', blocks: ['blk-tech-interface'], reason: 'captureSnapshot is outside the illustrative try block although its failure is promised to be caught by handleReset.' },
      { id: 'M3', blocks: ['blk-tech-interface'], reason: 'Initialization declares isInitialized=true before binding, rendering and focus finish. Initialization failures and retry/one-listener semantics need a coherent ready commit point.' },
    ],
  },
];
for (const item of observations) {
  const directory = resolve('docs/validation/agy-2026-10-04/real-integration', item.label);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.status !== 'blocked' || manifest.activeCallsAtShutdown !== 0 || manifest.sharedProviderSlots.ownedLeasesAtShutdown.length) throw new Error('Only stopped blocked controls may be annotated');
  const previewBytes = await readFile(join(directory, 'candidate-review-preview.json'));
  const preview = JSON.parse(previewBytes.toString('utf8'));
  const blocks = new Map(preview.candidateBlocks.map(block => [block.id, block]));
  if (item.findings.some(finding => finding.blocks.some(id => !blocks.has(id)))) throw new Error('Manual finding names a missing block');
  const contextBytes = await readFile(preview.contextPath);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  if (digest(contextBytes) !== preview.contextSha256) throw new Error('Read candidate context changed');
  const result = {
    label: item.label, checkedAt: new Date().toISOString(), status: 'blocked', contentPassed: false,
    scope: 'Independent reading of concrete counterexamples in the latest frozen review input. Full final content acceptance and final compiled package checks have not completed; no successful final verdict is implied.',
    finalReviewStatus: 'pending', humanReview: 'pending', targetApplicationExecution: 'unexecuted',
    candidateContextSha256: preview.contextSha256, candidatePreviewSha256: digest(previewBytes),
    taskId: preview.taskId, blockCount: blocks.size, findings: item.findings,
    proposedQualityFeedback: join('..', item.feedback), feedbackApplied: false,
  };
  await writeFile(join(directory, 'independent-content-review.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ label: item.label, status: result.status, contentPassed: result.contentPassed, findings: item.findings.length }));
}
