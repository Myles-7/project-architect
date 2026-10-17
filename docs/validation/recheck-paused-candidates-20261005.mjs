import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { blueprintCoverage } from '../../packages/core/dist/index.js';

const labels = process.argv.slice(2);
if (labels.length !== 2 || labels.some(label => !/^[a-z0-9-]+$/.test(label))) throw new Error('Pass stopped notes and materials control labels');
const base = resolve('docs/validation/agy-2026-10-04/real-integration');
const output = resolve('docs/validation/pending-content-recheck-20261005');
await mkdir(output, { recursive: true });
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value)) ?? 'undefined').digest('hex');
const clean = block => { const copy = { ...block }; delete copy.approvedBy; delete copy.approvedAt; return copy; };
const reports = [];
for (const [index, label] of labels.entries()) {
  const directory = join(base, label), manifest = await json(join(directory, 'manifest.json'));
  if (manifest.activeCallsAtShutdown !== 0 || manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length) throw new Error('Control must be stopped');
  const baseline = await json(join(directory, 'pre-quality-feedback-snapshot.json'));
  let blocks, inputSource;
  if (index === 0) {
    const run = await json(join(directory, 'project-records/runtime/planning', manifest.qualityFeedback.runId, 'run.json'));
    const task = run.tasks.filter(item => item.kind === 'revision' && item.status === 'paused').at(-1);
    if (!task) throw new Error('No exact paused revision context');
    const contextPath = join(directory, 'observed-inputs', `${task.id}-${task.attempts}.context.json`), context = await json(contextPath);
    const map = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
    for (const group of context.currentDraft.groups) { for (const id of group.removeBlockIds) map.delete(id); for (const block of group.blocks) map.set(block.id, block); }
    blocks = [...map.values()];
    inputSource = { kind: 'Unapproved candidate in the exact failed revision input; this is not a completed revision result', contextPath, contextSha256: createHash('sha256').update(await readFile(contextPath)).digest('hex'), taskId: task.id, attempt: task.attempts, currentIssues: context.currentIssues };
  } else {
    const blueprintPath = join(directory, 'project-records/state/blueprint.json');
    blocks = (await json(blueprintPath)).blocks;
    inputSource = { kind: 'Automated-approved technical feedback before paused product/dependent-stage revalidation; this is not a completed final package', blueprintPath, blueprintSha256: createHash('sha256').update(await readFile(blueprintPath)).digest('hex') };
  }
  const report = { label, checkedAt: new Date().toISOString(), status: 'pending', contentPassed: false, controlStatus: manifest.status, boundary: 'Preliminary read-only checks cannot stand in for completed manifest, final independent semantic review, package acceptance or human review.', inputSource, blockCount: blocks.length, blockHashes: blocks.map(block => ({ id: block.id, hash: hash(clean(block)) })), coverageIssues: blueprintCoverage(blocks) };
  if (index === 1) {
    const related = new Set(['blk-feat-reset', 'blk-flow-reset', 'blk-page-main-layout', 'blk-acc-reset', 'blk-tech-data-model', 'blk-tech-interface', 'blk-tech-error', 'blk-deliv-task-reset-workflow', 'blk-deliv-task-error-handling', 'blk-deliv-acc-full-e2e', 'blk-deliv-val-standalone-runtime', 'blk-tech-module']);
    const unrelated = baseline.planning.blueprint.blocks.filter(block => !related.has(block.id));
    const state = await json(join(directory, 'project-records/state/planning.json'));
    report.preservation = { unrelatedCount: unrelated.length, changedUnrelatedIds: unrelated.filter(block => hash(clean(block)) !== hash(clean(blocks.find(item => item.id === block.id)))).map(block => block.id), missingOrChangedEvidenceIds: baseline.planning.evidence.filter(evidence => hash(evidence) !== hash(state.evidence.find(item => item.id === evidence.id))).map(evidence => evidence.id) };
  }
  await writeFile(join(output, `${index ? 'materials' : 'notes'}-preview.md`), `# ${label} — preliminary only\n\nControl: ${manifest.status}; final content acceptance pending.\n` + blocks.map(block => `\n## ${block.id} / ${block.kind} / ${block.title}\n\n${block.content}\n\nTask=${JSON.stringify(block.task ?? null, null, 2)}\n`).join('\n'));
  await writeFile(join(output, `${index ? 'materials' : 'notes'}-report.json`), JSON.stringify(report, null, 2));
  reports.push({ label, status: report.status, blocks: blocks.length, coverageIssues: report.coverageIssues, preservation: report.preservation });
}
console.log(JSON.stringify({ output, reports }));
