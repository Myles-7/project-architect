import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Read-only verification of a completed frozen control; never calls Provider.
if (!process.argv[2]) throw new Error('Pass a completed frozen materials control directory');
const directory = resolve(process.argv[2]);
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const hash = name => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const clean = block => { const value = { ...block }; delete value.approvedBy; delete value.approvedAt; return value; };
const manifest = read('manifest.json');
if (manifest.status !== 'completed') throw new Error('Final artifact audit requires manifest.status=completed');
const runId = manifest.qualityFeedback.runId;
const run = read(`feedback-${runId}.json`);
const snapshot = read('final-snapshot.json');
const baseline = read('pre-quality-feedback-snapshot.json');
const proposal = read(`feedback-${runId}-proposal.json`);
const finalBlocks = snapshot.planning.blueprint.blocks;
const baselineBlocks = baseline.planning.blueprint.blocks;
const beforeMap = new Map(baselineBlocks.map(block => [block.id, block]));
const finalMap = new Map(finalBlocks.map(block => [block.id, block]));
const changedIds = finalBlocks.filter(block => !equals(clean(block), clean(beforeMap.get(block.id) ?? {}))).map(block => block.id);
const unchangedIds = finalBlocks.filter(block => equals(clean(block), clean(beforeMap.get(block.id) ?? {}))).map(block => block.id);
const allowedChangedIds = ['blk-feat-reset', 'blk-flow-reset', 'blk-page-main-layout', 'blk-acc-reset', 'blk-tech-data-model', 'blk-tech-interface', 'blk-tech-error', 'blk-deliv-task-reset-workflow', 'blk-deliv-task-error-handling', 'blk-deliv-acc-full-e2e', 'blk-deliv-val-standalone-runtime', 'blk-tech-module'];
const correctedRelatedIds = [...allowedChangedIds];
const trulyUnrelatedIds = baselineBlocks.filter(block => !correctedRelatedIds.includes(block.id)).map(block => block.id);
const afterEvidence = new Map(snapshot.planning.evidence.map(evidence => [evidence.id, evidence]));
const missingOrChangedEvidence = baseline.planning.evidence.filter(evidence => !equals(evidence, afterEvidence.get(evidence.id))).map(evidence => evidence.id);

const reviewTask = run.tasks.filter(task => task.kind === 'review').at(-1);
const context = read(`observed-inputs/${reviewTask.id}-${reviewTask.attempts}.context.json`);
const reviewerCandidate = new Map(context.blueprint.blocks.map(block => [block.id, block]));
for (const block of context.workerResults.draft.groups.flatMap(group => group.blocks ?? [])) reviewerCandidate.set(block.id, block);
const reviewResultName = `project-records/runtime/planning/${runId}/${reviewTask.outputRef}`;
const providerReview = read(reviewResultName);

const newPackages = manifest.packages.filter(pkg => !pkg.inheritedFrom);
if (newPackages.length !== 1) throw new Error(`Expected one new package; found ${newPackages.length}`);
const pkg = newPackages[0];
const packageName = `${pkg.labelSuffix}-development-package`;
const fileChecks = pkg.manifest.files.map(file => ({ ...file, actualSha256: hash(`${packageName}/${file.name}`), matches: file.sha256 === hash(`${packageName}/${file.name}`) }));
const tasks = read(`${packageName}/tasks.json`).tasks;
const oldTasks = read('quality-reviewed-r7-development-package/tasks.json').tasks;
const taskMap = new Map(tasks.map(task => [task.id, task]));
const dangling = tasks.flatMap(task => task.dependsOn.filter(dep => !taskMap.has(dep)).map(dep => ({ task: task.id, dependency: dep })));
const cycles = [];
function visit(id, path = []) {
  if (path.includes(id)) { cycles.push([...path, id]); return; }
  for (const dep of taskMap.get(id)?.dependsOn ?? []) visit(dep, [...path, id]);
}
tasks.forEach(task => visit(task.id));
const taskFieldMismatches = tasks.flatMap(task => Object.entries(finalMap.get(task.id)?.task ?? {}).filter(([field, value]) => !equals(value, task[field])).map(([field]) => ({ id: task.id, field })));
const allMarkdown = pkg.manifest.files.filter(file => file.name.endsWith('.md')).map(file => readFileSync(join(directory, packageName, file.name), 'utf8')).join('\n');
const interfaceContent = finalMap.get('blk-tech-interface').content;
const markers = [...interfaceContent.matchAll(/```javascript([\s\S]*?)```/g)].map(match => ({ lines: match[1].trim().split('\n').length, nonExecutableMarker: match[1].includes('非执行示意') }));
const results = {
  kind: 'independent completed frozen control structure and compiler projection audit',
  controlStatus: manifest.status, completedAt: manifest.completedAt,
  runtimeStatus: run.status, runtimeTasks: run.tasks.map(task => ({ id: task.id, kind: task.kind, status: task.status })),
  newProviderCalls: manifest.providerCalls.filter(call => !call.inheritedFrom).length,
  approvalIdentities: manifest.approvals.map(approval => approval.kind), humanApproval: 'pending',
  blocks: { before: baselineBlocks.length, after: finalBlocks.length, stableIds: equals(baselineBlocks.map(block => block.id).sort(), finalBlocks.map(block => block.id).sort()), changedIds, unchangedIds, outsideAllowedScope: changedIds.filter(id => !allowedChangedIds.includes(id)), proposalIds: proposal.groups.flatMap(group => group.blocks ?? []).map(block => block.id) },
  correctedScope: { relatedIds: correctedRelatedIds, trulyUnrelatedIds, trulyUnrelatedPreserved: trulyUnrelatedIds.every(id => equals(clean(beforeMap.get(id)), clean(finalMap.get(id)))) },
  evidence: { before: baseline.planning.evidence.length, after: snapshot.planning.evidence.length, preserved: baseline.planning.evidence.length - missingOrChangedEvidence.length, missingOrChangedEvidence },
  reviewer: { taskId: reviewTask.id, approvedUnchangedCount: context.blueprint.blocks.length, overrideCount: context.workerResults.draft.groups.flatMap(group => group.blocks ?? []).length, assembledCount: reviewerCandidate.size, historicalBaselineCount: context.changeReviewBaseline.blocks.length, candidateMismatches: finalBlocks.filter(block => !equals(clean(block), clean(reviewerCandidate.get(block.id) ?? {}))).map(block => block.id), historicalBaselineMismatches: context.changeReviewBaseline.blocks.filter(block => !equals(clean(block), clean(beforeMap.get(block.id) ?? {}))).map(block => block.id), providerBlockers: providerReview.blockers, providerResultHash: hash(reviewResultName) },
  package: { name: packageName, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, fileChecks, zipSha256: hash(`${packageName}.zip`), zipMatchesManifest: hash(`${packageName}.zip`) === pkg.zipSha256, missingBlockBodies: finalBlocks.filter(block => !allMarkdown.includes(block.content)).map(block => block.id) },
  tasks: { count: tasks.length, ids: tasks.map(task => task.id), dangling, cycles, taskFieldMismatches, edgeChanges: oldTasks.filter(task => !equals([...task.dependsOn].sort(), [...(taskMap.get(task.id)?.dependsOn ?? [])].sort())).map(task => task.id) },
  illustrativeCode: { markers, declaredNonExecutable: interfaceContent.includes('非执行示意，非CodingAgent直接复制的参考实现'), stillDeclaresFullExecutableTemplate: interfaceContent.includes('完整自包含 JavaScript') || interfaceContent.includes('无 ReferenceError 风险') },
  frozenHashes: Object.fromEntries(['manifest.json', 'final-snapshot.json', 'pre-quality-feedback-snapshot.json', `feedback-${runId}.json`, `feedback-${runId}-proposal.json`].map(name => [name, hash(name)])),
};
writeFileSync(join(directory, 'review-r8-structure-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
