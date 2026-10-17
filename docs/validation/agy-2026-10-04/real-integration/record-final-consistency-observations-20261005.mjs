import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

// Selected, independently read counterexamples. This is not a full semantic pass.
// Provider output, source context, receipts, and formal state remain unchanged.
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const controls = [
  {
    label: 'flash-vague-final-consistency-20261005-10',
    feedback: 'quality-feedback-notes-contract-closure-20261005.txt',
    findings: [
      { id: 'N9', blocks: ['interface-service-contracts', 'feature-data-portability'], excerpts: ['importOverwrite(file: File)', 'validateBackupFile(file: File)'], reason: 'Import accepts only File. Validation returns no preview database revision/generation or byte identity. The promised re-preview after another tab writes cannot be expressed in the public contract.' },
      { id: 'N10', blocks: ['interface-service-contracts', 'acceptance-foundation-and-storage'], excerpts: ['purgeExpiredTrash(', 'listExpiredTrashedNotes()'], reason: 'Foundation acceptance invokes listExpiredTrashedNotes(), which the latest IStorageService does not declare. Use an existing listNotes plus the documented expiry predicate or define one coherent public method everywhere.' },
      { id: 'N11', blocks: ['data-model-core-entities', 'acceptance-quick-capture'], excerpts: ['export interface SessionDraft', 'sessionStorage.setItem'], reason: 'SessionDraft is a structured, versioned object, but quick-capture acceptance specifies directly storing content text. Producer, getDraft(), restore validation, and draft file export need the same shape.' },
      { id: 'N12', blocks: ['data-model-core-entities', 'feature-data-portability'], excerpts: ['appMeta: AppMeta[]', 'backupTracker: BackupTrackerMeta'], reason: 'Backup duplicates tracker metadata inside an open-ended AppMeta[] and a separate backupTracker; it does not close duplicate-key consistency, library generation handling, imported tracker/reminder policy, or complete per-field validation.' },
      { id: 'N13', blocks: ['feature-quick-capture', 'acceptance-quick-capture'], excerpts: ['#Dexie', 'Dexie'], reason: 'The normative tag rule normalizes case, while quick-capture acceptance expects Dexie after entering #Dexie. Also specify editable-focus and IME guards for N so typing ordinary n never steals the cursor.' },
    ],
  },
  {
    label: 'flash-materials-final-consistency-20261005-10',
    feedback: 'quality-feedback-materials-contract-closure-20261005.txt',
    findings: [
      { id: 'M4', blocks: ['blk-tech-module', 'blk-tech-interface'], excerpts: ['schedulerEpoch = 0，isInitialized = true', '禁止重复调用'], reason: 'Initialization declares ready before binding/render/focus finish, although these can fail. Only missing-dependency failure is specified; safe retry without duplicate input/reset listeners or clearing existing draft is absent.' },
      { id: 'M5', blocks: ['blk-tech-interface', 'blk-flow-reset'], excerpts: ['rollback(snapshot: ResetTransactionSnapshot', 'snapshot 为 null'], reason: 'Snapshot-capture failure sends null to rollback, but the public signature requires a non-null snapshot. The no-snapshot branch must preserve the untouched node, timer, generation, and text without claiming a rollback was performed.' },
      { id: 'M6', blocks: ['blk-tech-module', 'blk-tech-interface', 'blk-feat-reset'], excerpts: ['若挂载失败在控制台输出草稿文本', '若兜底容器缺失或呈现失败，如实明确报错'], reason: 'Fallback mount failure is promised to be visibly reported, but the public technical contract only logs text to console. Define visible failure notification and an honest retention status when no textarea can be shown.' },
    ],
  },
];
for (const item of controls) {
  const directory = join(root, item.label);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.status !== 'blocked' || manifest.activeCallsAtShutdown !== 0 || manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length) throw new Error('Only stopped quota-blocked controls can be annotated');
  const previewBytes = await readFile(join(directory, 'candidate-review-preview.json'));
  const preview = JSON.parse(previewBytes.toString('utf8'));
  const contextBytes = await readFile(preview.contextPath);
  if (digest(contextBytes) !== preview.contextSha256) throw new Error('Candidate context changed');
  const blocks = new Map(preview.candidateBlocks.map(block => [block.id, block]));
  for (const finding of item.findings) {
    const selected = finding.blocks.map(id => { const block = blocks.get(id); if (!block) throw new Error(`Missing observed block ${id}`); return block.content; }).join('\n');
    for (const excerpt of finding.excerpts) if (!selected.includes(excerpt)) throw new Error(`Observed excerpt no longer exists: ${finding.id}: ${excerpt}`);
  }
  const report = {
    label: item.label, checkedAt: new Date().toISOString(), status: 'blocked', contentPassed: false,
    scope: 'Independent reading of selected exact counterexamples in the frozen latest candidate. Not a complete final artifact review or target execution.',
    candidateContextSha256: preview.contextSha256, candidatePreviewSha256: digest(previewBytes),
    taskId: preview.taskId, blockCount: blocks.size, findings: item.findings,
    proposedQualityFeedback: join('..', item.feedback), feedbackApplied: false,
    finalReviewStatus: 'pending', humanReview: 'pending', targetApplicationExecution: 'unexecuted',
  };
  await writeFile(join(directory, 'independent-content-review.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label: item.label, status: report.status, findings: item.findings.length, contentPassed: false }));
}
