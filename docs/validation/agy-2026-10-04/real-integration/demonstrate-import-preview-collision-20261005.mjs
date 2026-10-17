import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Logical counterexample to the candidate specification, not execution of
// SparkNotes (which has not been implemented) or production State writes.
const summarize = notes => ({ libraryGeneration: 1, notesCount: notes.length,
  sumRevision: notes.reduce((sum, note) => sum + note.revision, 0),
  maxRevision: Math.max(...notes.map(note => note.revision)),
  lastUpdatedAt: Math.max(...notes.map(note => note.updatedAt)) });
const before = [
  { id: '10000000-0000-4000-8000-000000000001', revision: 1, updatedAt: 1000, status: 'trashed', content: 'old' },
  { id: '20000000-0000-4000-8000-000000000002', revision: 5, updatedAt: 2000, status: 'active', content: 'retained' },
];
const after = [before[1],
  { id: '30000000-0000-4000-8000-000000000003', revision: 1, updatedAt: 2000, status: 'active', content: 'new' },
];
const sameSummary = JSON.stringify(summarize(before)) === JSON.stringify(summarize(after));
if (!sameSummary || JSON.stringify(before) === JSON.stringify(after)) throw new Error('Counterexample not reproduced');
const source = resolve('docs/validation/agy-2026-10-04/real-integration/flash-vague-contract-closure-20261005-11/candidate-review-preview.json');
const { readFile } = await import('node:fs/promises');
const sourceBytes = await readFile(source);
const result = { checkedAt: new Date().toISOString(), scope: 'Specification-only counterexample; no target application execution, AI invocation or official State mutation',
  source, sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  operations: ['Permanently delete the revision-1 trashed record', 'Create a new revision-1 note while the retained maximum updatedAt is still 2000'],
  before, after, beforeSummary: summarize(before), afterSummary: summarize(after),
  sameSummary, changedIdentityAndData: true, conclusion: 'Aggregate equality cannot prove that no write occurred after preview.' };
await writeFile(resolve('docs/validation/import-preview-collision-20261005.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: 'counterexample-reproduced', sameSummary, targetApplicationExecuted: false }));
