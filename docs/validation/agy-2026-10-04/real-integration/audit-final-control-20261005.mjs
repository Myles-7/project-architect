import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { blueprintCoverage } from '../../../../packages/core/dist/index.js';

// Artifact-only audit. No Provider calls, Core writes or semantic pass verdict.
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Completed control label required');
const directory = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const read = async name => JSON.parse(await readFile(join(directory, name), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const clean = block => { const value = { ...block }; delete value.approvedBy; delete value.approvedAt; return value; };
const manifest = await read('manifest.json');
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0 || manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length) throw new Error('Requires completed and stopped control');
const snapshot = await read('final-snapshot.json');
const baseline = await read('pre-quality-feedback-snapshot.json');
const blocks = snapshot.planning.blueprint.blocks;
const before = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
const after = new Map(blocks.map(block => [block.id, block]));
const newPackages = manifest.packages.filter(pkg => !pkg.inheritedFrom);
if (newPackages.length !== 1) throw new Error(`Expected one new compiled package, got ${newPackages.length}`);
const pkg = newPackages[0], packageName = `${pkg.labelSuffix}-development-package`;
const tasks = (await read(`${packageName}/tasks.json`)).tasks;
const taskMap = new Map(tasks.map(task => [task.id, task]));
// Independent traversal of the documented v2 projection: stop at the first
// task/validation endpoint; requirementIds never invent execution dependencies.
const executionDependencies = (block, map) => {
  const result = new Set(), seen = new Set();
  const walk = id => { if (seen.has(id)) return; seen.add(id); const dependency = map.get(id); if (!dependency) throw new Error(`Missing blueprint dependency ${id}`); if (dependency.task) result.add(id); else dependency.dependsOn.forEach(walk); };
  block.dependsOn.forEach(walk);
  return [...result].sort();
};
const checks = [];
const check = (name, passed, details) => checks.push({ name, passed, details });
check('all-stages-approved', Object.values(snapshot.planning.blueprint.stages).every(status => status === 'approved'), snapshot.planning.blueprint.stages);
const coverage = blueprintCoverage(blocks);
check('deterministic-coverage', coverage.length === 0, coverage);
check('unique-block-ids', after.size === blocks.length);
const removed = [...before.keys()].filter(id => !after.has(id));
const added = [...after.keys()].filter(id => !before.has(id));
const obsoleteNoteValidation = 'val-browser-storage-and-search-perf';
const expectedRemoved = manifest.mode === 'vague' && before.has(obsoleteNoteValidation) ? [obsoleteNoteValidation] : [];
check('stable-block-identities', added.length === 0 && equal(removed, expectedRemoved), { removed, added, expectedRemoved });
const changed = blocks.filter(block => !equal(clean(block), clean(before.get(block.id)))).map(block => block.id);
const retainedEvidence = new Map(snapshot.planning.evidence.map(item => [item.id, item]));
const evidenceChanged = baseline.planning.evidence.filter(item => !equal(item, retainedEvidence.get(item.id))).map(item => item.id);
check('original-evidence-preserved', evidenceChanged.length === 0, { before: baseline.planning.evidence.length, after: snapshot.planning.evidence.length, evidenceChanged });
if (manifest.mode === 'materials') {
  const related = new Set(['blk-feat-reset', 'blk-flow-reset', 'blk-page-main-layout', 'blk-acc-reset', 'blk-tech-data-model', 'blk-tech-interface', 'blk-tech-error', 'blk-deliv-task-reset-workflow', 'blk-deliv-task-error-handling', 'blk-deliv-acc-full-e2e', 'blk-deliv-val-standalone-runtime', 'blk-tech-module', 'blk-feat-input-display', 'blk-flow-input-display', 'blk-deliv-acc-security-edge', 'blk-prod-outcomes']);
  const unrelated = [...before.keys()].filter(id => !related.has(id));
  check('truly-unrelated-whole-objects-preserved', unrelated.every(id => equal(clean(before.get(id)), clean(after.get(id)))), { related: [...related], unrelated, changedUnrelated: changed.filter(id => !related.has(id)), rationale: 'Input-display defines reset sequencing. The security-edge acceptance references blk-tech-error through requirementIds and its any-error editability claim contradicts severe recovery failure; product outcomes share that same guarantee. M7 feedback requires local synchronization of those two statements, not unrelated redesign. All other unrelated whole objects remain protected.' });
  const oldTasks = baseline.planning.blueprint.blocks.filter(block => block.task);
  check('original-task-dag-preserved', oldTasks.every(block => equal(executionDependencies(block, before), [...(taskMap.get(block.id)?.dependsOn ?? [])].sort())), { count: oldTasks.length });
}
const dangling = tasks.flatMap(task => task.dependsOn.filter(id => !taskMap.has(id)).map(id => ({ task: task.id, dependency: id })));
const cycles = [];
const visit = (id, path = []) => { if (path.includes(id)) { cycles.push([...path, id]); return; } for (const dependency of taskMap.get(id)?.dependsOn ?? []) visit(dependency, [...path, id]); };
tasks.forEach(task => visit(task.id));
check('task-dag', taskMap.size === tasks.length && !dangling.length && !cycles.length, { count: tasks.length, dangling, cycles });
const mismatches = tasks.flatMap(task => Object.entries(after.get(task.id)?.task ?? {}).filter(([field, value]) => !equal(value, task[field])).map(([field]) => ({ id: task.id, field })));
check('task-fields-and-dependencies-project-exactly', !mismatches.length && tasks.every(task => equal([...task.dependsOn].sort(), executionDependencies(after.get(task.id), after))) && blocks.filter(block => block.task).length === tasks.length, mismatches);
let markdown = '';
for (const file of pkg.manifest.files) {
  const bytes = await readFile(join(directory, packageName, file.name));
  check(`file-hash:${file.name}`, digest(bytes) === file.sha256);
  if (file.name.endsWith('.md')) markdown += bytes.toString('utf8') + '\n';
}
check('zip-hash', digest(await readFile(join(directory, `${packageName}.zip`))) === pkg.zipSha256);
const missingBodies = blocks.filter(block => !markdown.includes(block.content)).map(block => block.id);
check('all-approved-bodies-in-export', !missingBodies.length, missingBodies);
const reviews = [];
for (const record of manifest.runs) {
  const run = await read(`project-records/runtime/planning/${record.id}/run.json`);
  for (const task of run.tasks.filter(task => task.kind === 'review' && task.status === 'completed')) {
    const output = await read(`project-records/runtime/planning/${run.id}/${task.outputRef}`);
    reviews.push({ runId: run.id, taskId: task.id, attempts: task.attempts, blockers: output.blockers, scope: record.stage, inherited: Boolean(record.inheritedFrom) });
  }
}
check('actual-provider-review-exists', reviews.length > 0, reviews.map(review => ({ ...review, blockers: review.blockers?.slice(0, 3) })));
const result = { label, checkedAt: new Date().toISOString(), status: checks.every(item => item.passed) ? 'passed' : 'failed', contentPassed: false, scope: 'Deterministic artifact and preservation audit; semantic and human review remain separate.', changedBlockIds: changed, checks, reviews, packageName, humanReview: 'pending', targetApplicationExecution: 'unexecuted', finalSnapshotSha256: digest(await readFile(join(directory, 'final-snapshot.json'))) };
if (!process.argv.includes('--stdout-only')) {
  await writeFile(join(directory, 'final-structure-audit.json'), JSON.stringify(result, null, 2));
  await writeFile(join(directory, 'final-content-preview.md'), `# ${label}\n\nSemantic acceptance pending.\n` + blocks.map(block => `\n## ${block.id} / ${block.kind} / ${block.title}\n\nrequirements=${JSON.stringify(block.requirementIds)}; dependencies=${JSON.stringify(block.dependsOn)}\n\n${block.content}\n\nTask=${JSON.stringify(block.task ?? null, null, 2)}\n`).join('\n'));
}
console.log(JSON.stringify({ label, status: result.status, checks: checks.length, failed: checks.filter(item => !item.passed), changedBlockIds: changed, packageName }));
if (result.status !== 'passed') process.exitCode = 1;
