import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Independent artifact audit only. This utility never invokes Provider or changes Core.
// Invoke with a completed frozen control directory. It writes only a new audit result.
const directory = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the completed frozen control directory');
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const hash = name => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const clean = block => { const value = { ...block }; delete value.approvedBy; delete value.approvedAt; return value; };
const statuses = items => items.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});

const manifest = read('manifest.json');
if (manifest.status !== 'completed') throw new Error('No final artifact content or structure verdict until manifest.status=completed');
const runId = manifest.qualityFeedback.runId;
const run = read(`feedback-${runId}.json`);
const frozenRun = read(`project-records/runtime/planning/${runId}/run.json`);
const snapshot = read('final-snapshot.json');
const baseline = read('pre-quality-feedback-snapshot.json');
const proposal = read(`feedback-${runId}-proposal.json`);
const beforeMap = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
const finalBlocks = snapshot.planning.blueprint.blocks;
const finalMap = new Map(finalBlocks.map(block => [block.id, block]));
const proposedBlocks = proposal.groups.flatMap(group => group.blocks ?? []);
const proposedRemovals = proposal.groups.flatMap(group => group.removeBlockIds ?? []);
const removedIds = [...beforeMap.keys()].filter(id => !finalMap.has(id));
const newIds = [...finalMap.keys()].filter(id => !beforeMap.has(id));
const intendedRemovedId = 'val-browser-storage-and-search-perf';
const changedIds = finalBlocks.filter(block => !equals(clean(block), clean(beforeMap.get(block.id) ?? {}))).map(block => block.id);
const unchangedIds = finalBlocks.filter(block => equals(clean(block), clean(beforeMap.get(block.id) ?? {}))).map(block => block.id);
const afterEvidence = new Map(snapshot.planning.evidence.map(item => [item.id, item]));
const missingOrChangedEvidence = baseline.planning.evidence.filter(item => !equals(item, afterEvidence.get(item.id))).map(item => item.id);

const reviewTask = run.tasks.filter(task => task.kind === 'review' && task.status === 'completed').at(-1);
if (!reviewTask) throw new Error('No completed independent Provider review task');
const contextName = `observed-inputs/${reviewTask.id}-${reviewTask.attempts}.context.json`;
const context = read(contextName);
const candidateMap = new Map(context.blueprint.blocks.map(block => [block.id, block]));
for (const group of context.workerResults.draft.groups) {
  for (const id of group.removeBlockIds ?? []) candidateMap.delete(id);
  for (const block of group.blocks ?? []) candidateMap.set(block.id, block);
}
const historicalBaseline = context.changeReviewBaseline.blocks;
const reviewResultName = `project-records/runtime/planning/${runId}/${reviewTask.outputRef}`;
const providerReview = read(reviewResultName);

const newPackages = manifest.packages.filter(pkg => !pkg.inheritedFrom);
if (newPackages.length !== 1) throw new Error(`Expected exactly one new compiler package, got ${newPackages.length}`);
const pkg = newPackages[0];
const packageName = `${pkg.labelSuffix}-development-package`;
const fileChecks = pkg.manifest.files.map(file => ({ ...file, actualSha256: hash(`${packageName}/${file.name}`), matches: file.sha256 === hash(`${packageName}/${file.name}`) }));
const allMarkdown = pkg.manifest.files.filter(file => file.name.endsWith('.md')).map(file => readFileSync(join(directory, packageName, file.name), 'utf8')).join('\n');
const tasks = read(`${packageName}/tasks.json`).tasks;
const taskMap = new Map(tasks.map(task => [task.id, task]));
const duplicateTaskIds = tasks.map(task => task.id).filter((id, index, values) => values.indexOf(id) !== index);
const dangling = tasks.flatMap(task => task.dependsOn.filter(dep => !taskMap.has(dep)).map(dependency => ({ task: task.id, dependency })));
const cycles = [];
function visit(id, path = []) {
  if (path.includes(id)) { cycles.push([...path, id]); return; }
  for (const dep of taskMap.get(id)?.dependsOn ?? []) visit(dep, [...path, id]);
}
tasks.forEach(task => visit(task.id));
const taskFieldMismatches = tasks.flatMap(task => Object.entries(finalMap.get(task.id)?.task ?? {}).filter(([field, value]) => !equals(value, task[field])).map(([field]) => ({ id: task.id, field })));
const taskDependencyMismatches = tasks.filter(task => !equals([...(finalMap.get(task.id)?.dependsOn ?? [])].sort(), [...task.dependsOn].sort())).map(task => task.id);
const coreTaskIds = finalBlocks.filter(block => block.task).map(block => block.id);
const missingCoreTasks = coreTaskIds.filter(id => !taskMap.has(id));
const unexpectedCompilerTasks = tasks.map(task => task.id).filter(id => !coreTaskIds.includes(id));
const allTerminalTaskCounts = statuses(run.tasks);
const sourceFiles = ['manifest.json', 'final-snapshot.json', 'pre-quality-feedback-snapshot.json', `feedback-${runId}.json`, `feedback-${runId}-proposal.json`, contextName, reviewResultName];
const results = {
  schemaVersion: 1,
  kind: 'independent completed frozen control structure and compiler projection audit; no content acceptance implied',
  controlStatus: manifest.status, completedAt: manifest.completedAt,
  runtime: { id: run.id, status: run.status, canonicalTerminalCopiesMatch: equals(run, frozenRun), taskCounts: allTerminalTaskCounts, tasks: run.tasks.map(task => ({ id: task.id, kind: task.kind, status: task.status, attempts: task.attempts, error: task.error ?? null })) },
  provider: { newCalls: manifest.providerCalls.filter(call => !call.inheritedFrom).length, callStatuses: statuses(manifest.providerCalls), maxActualConcurrent: manifest.maxActiveCalls, invokedByIndependentReviewer: false },
  approvals: manifest.approvals.map(approval => ({ kind: approval.kind, changeSetId: approval.changeSetId ?? null })),
  humanApproval: 'pending', targetApplicationExecution: 'unexecuted', actualBrowserImePerformanceTests: 'unexecuted',
  blocks: { before: beforeMap.size, after: finalMap.size, duplicateFinalIds: finalBlocks.map(block => block.id).filter((id, index, values) => values.indexOf(id) !== index), changedIds, unchangedIds, removedIds, newIds, intendedRemovedId, intendedIdPolicyPassed: equals(removedIds, [intendedRemovedId]) && newIds.length === 0 && finalMap.size === beforeMap.size - 1, proposalBlockIds: proposedBlocks.map(block => block.id), proposalRemovals: proposedRemovals, proposalFinalMismatches: proposedBlocks.filter(block => !equals(clean(block), clean(finalMap.get(block.id) ?? {}))).map(block => block.id) },
  evidence: { before: baseline.planning.evidence.length, after: snapshot.planning.evidence.length, preserved: baseline.planning.evidence.length - missingOrChangedEvidence.length, missingOrChangedEvidence },
  reviewer: { taskId: reviewTask.id, contextName, approvedFormalCount: context.blueprint.blocks.length, fullOverrideCount: context.workerResults.draft.groups.flatMap(group => group.blocks ?? []).length, removalIds: context.workerResults.draft.groups.flatMap(group => group.removeBlockIds ?? []), assembledCount: candidateMap.size, historicalBaselineCount: historicalBaseline.length, candidateMismatches: finalBlocks.filter(block => !equals(clean(block), clean(candidateMap.get(block.id) ?? {}))).map(block => block.id), reviewerOnlyIds: [...candidateMap.keys()].filter(id => !finalMap.has(id)), historicalBaselineMismatches: historicalBaseline.filter(block => !equals(clean(block), clean(beforeMap.get(block.id) ?? {}))).map(block => block.id), historicalMissingIds: [...beforeMap.keys()].filter(id => !historicalBaseline.some(block => block.id === id)), providerBlockers: providerReview.blockers, providerResultHash: hash(reviewResultName) },
  package: { name: packageName, newPackageCount: newPackages.length, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, fileChecks, zipSha256: hash(`${packageName}.zip`), zipMatchesManifest: hash(`${packageName}.zip`) === pkg.zipSha256, missingBlockBodies: finalBlocks.filter(block => !allMarkdown.includes(block.content)).map(block => block.id) },
  tasks: { count: tasks.length, ids: tasks.map(task => task.id), duplicateTaskIds, dangling, cycles, taskFieldMismatches, taskDependencyMismatches, missingCoreTasks, unexpectedCompilerTasks, buildTasks: tasks.filter(task => /build-and-deploy/.test(task.id)).map(task => ({ id: task.id, dependsOn: task.dependsOn })), validationTasks: tasks.filter(task => /^val-/.test(task.id)).map(task => ({ id: task.id, dependsOn: task.dependsOn })) },
  originalPreservationReviewBoundary: 'All 44 original approved bodies require semantic review. The approved duplicate validation removal yields 43 final stable blocks; a broad closure does not excuse lost unrelated capabilities.',
  targetTestingBoundary: 'This audit verifies frozen artifacts and projections only. Runtime completion and automated Core approval do not establish target browser, storage, performance, privacy-mode detection or human content acceptance.',
  frozenHashes: Object.fromEntries(sourceFiles.filter(name => existsSync(join(directory, name))).map(name => [name, hash(name)])),
};
writeFileSync(join(directory, 'review-final03-structure-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ controlStatus: results.controlStatus, completedAt: results.completedAt, runtimeStatus: results.runtime.status, blocks: results.blocks, evidence: results.evidence, reviewer: results.reviewer, package: { ...results.package, fileChecks: fileChecks.map(file => ({ name: file.name, matches: file.matches })) }, tasks: results.tasks }, null, 2));
