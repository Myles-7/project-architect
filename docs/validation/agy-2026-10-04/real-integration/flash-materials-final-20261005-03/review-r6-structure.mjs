import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const directory = dirname(fileURLToPath(import.meta.url));
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const normalizeBlock = block => { const result = { ...block }; delete result.approvedBy; delete result.approvedAt; return result; };
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const snapshot = read(join(directory, 'final-snapshot.json'));
const baseline = read(join(directory, 'pre-quality-feedback-snapshot.json'));
const manifest = read(join(directory, 'manifest.json'));
const proposal = read(join(directory, 'feedback-run-80094931-1ed4-4b40-bfe3-14a90886e7da-proposal.json'));
const run = read(join(directory, 'feedback-run-80094931-1ed4-4b40-bfe3-14a90886e7da.json'));
const context = read(join(directory, 'observed-inputs/task-df2f2464-2dcd-4180-a694-3c0df41dc452-1.context.json'));
const providerReviewPath = join(directory, 'project-records/runtime/planning/run-80094931-1ed4-4b40-bfe3-14a90886e7da/tasks/task-df2f2464-2dcd-4180-a694-3c0df41dc452/result.json');
const providerReview = read(providerReviewPath);
const finalBlocks = snapshot.planning.blueprint.blocks;
const baselineBlocks = baseline.planning.blueprint.blocks;
const finalMap = new Map(finalBlocks.map(block => [block.id, block]));
const baselineMap = new Map(baselineBlocks.map(block => [block.id, block]));
const proposalBlocks = proposal.groups.flatMap(group => group.blocks ?? []);
const changedIds = finalBlocks.filter(block => !equals(normalizeBlock(block), normalizeBlock(baselineMap.get(block.id) ?? {}))).map(block => block.id);
const unchangedIds = baselineBlocks.filter(block => finalMap.has(block.id) && equals(normalizeBlock(block), normalizeBlock(finalMap.get(block.id)))).map(block => block.id);
const finalEvidence = new Map(snapshot.planning.evidence.map(evidence => [evidence.id, evidence]));
const preservedEvidence = baseline.planning.evidence.filter(evidence => equals(evidence, finalEvidence.get(evidence.id))).map(evidence => evidence.id);

const reviewerCandidate = new Map(context.blueprint.blocks.map(block => [block.id, block]));
for (const block of context.workerResults.draft.groups.flatMap(group => group.blocks ?? [])) reviewerCandidate.set(block.id, block);
const reviewerMismatches = finalBlocks.filter(block => !equals(normalizeBlock(block), normalizeBlock(reviewerCandidate.get(block.id) ?? {}))).map(block => block.id);
const reviewerBaselineMismatches = context.changeReviewBaseline.blocks.filter(block => !equals(normalizeBlock(block), normalizeBlock(baselineMap.get(block.id) ?? {}))).map(block => block.id);

const newPackages = manifest.packages.filter(pkg => !pkg.inheritedFrom);
const pkg = newPackages.find(pkg => pkg.labelSuffix === 'quality-reviewed-r6');
const packageDirectory = join(directory, 'quality-reviewed-r6-development-package');
const files = pkg.manifest.files.map(file => ({ ...file, actualSha256: hash(join(packageDirectory, file.name)), matches: hash(join(packageDirectory, file.name)) === file.sha256 }));
const tasks = read(join(packageDirectory, 'tasks.json')).tasks;
const originalTasks = read(join(directory, 'quality-reviewed-r5-development-package/tasks.json')).tasks;
const taskMap = new Map(tasks.map(task => [task.id, task]));
const dangling = tasks.flatMap(task => task.dependsOn.filter(id => !taskMap.has(id)).map(id => ({ task: task.id, dependency: id })));
const cycles = [];
function visit(id, path = []) {
  if (path.includes(id)) { cycles.push([...path, id]); return; }
  for (const dep of taskMap.get(id)?.dependsOn ?? []) visit(dep, [...path, id]);
}
tasks.forEach(task => visit(task.id));
const taskFieldMismatches = tasks.flatMap(task => Object.entries(finalMap.get(task.id).task ?? {}).filter(([key, value]) => !equals(value, task[key])).map(([key]) => ({ id: task.id, field: key })));
const edgeChanges = originalTasks.filter(task => !equals([...task.dependsOn].sort(), [...(taskMap.get(task.id)?.dependsOn ?? [])].sort())).map(task => task.id);
const allMarkdown = pkg.manifest.files.filter(file => file.name.endsWith('.md')).map(file => readFileSync(join(packageDirectory, file.name), 'utf8')).join('\n');
const missingBlockBodies = finalBlocks.filter(block => !allMarkdown.includes(block.content)).map(block => block.id);
const targetValidation = finalBlocks.filter(block => block.kind === 'validation').map(block => ({
  id: block.id,
  mentionsUnexecuted: JSON.stringify(block).includes('unexecuted'),
  executionClaims: /已通过|测试通过|实测通过/.test(block.content),
}));
const results = {
  kind: 'independent frozen state and compiler projection verification',
  controlStatus: manifest.status, completedAt: manifest.completedAt,
  runtimeStatus: run.status, runtimeTasks: run.tasks.map(task => ({ id: task.id, kind: task.kind, status: task.status })),
  actualNewProviderCalls: manifest.providerCalls.filter(call => !call.inheritedFrom).length,
  approvalIdentities: manifest.approvals.map(approval => approval.kind), humanApproval: 'pending',
  blocks: { before: baselineBlocks.length, after: finalBlocks.length, stableIds: equals(baselineBlocks.map(block => block.id).sort(), finalBlocks.map(block => block.id).sort()), changedIds, unchangedIds, proposalIds: proposalBlocks.map(block => block.id) },
  evidence: { before: baseline.planning.evidence.length, after: snapshot.planning.evidence.length, preserved: preservedEvidence.length, alteredOrMissing: baseline.planning.evidence.filter(evidence => !preservedEvidence.includes(evidence.id)).map(evidence => evidence.id) },
  reviewer: { approvedUnchangedCount: context.blueprint.blocks.length, fullOverrideCount: context.workerResults.draft.groups.flatMap(group => group.blocks ?? []).length, assembledCount: reviewerCandidate.size, historicalBaselineCount: context.changeReviewBaseline.blocks.length, candidateMismatches: reviewerMismatches, historicalBaselineMismatches: reviewerBaselineMismatches, providerBlockers: providerReview.blockers, providerResultHash: hash(providerReviewPath) },
  package: { newPackageCount: newPackages.length, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, files, zipSha256: hash(join(directory, 'quality-reviewed-r6-development-package.zip')), zipMatchesManifest: hash(join(directory, 'quality-reviewed-r6-development-package.zip')) === pkg.zipSha256, missingBlockBodies },
  tasks: { count: tasks.length, ids: tasks.map(task => task.id), dangling, cycles, edgeChanges, taskFieldMismatches },
  targetValidation,
  frozenHashes: { finalSnapshot: hash(join(directory, 'final-snapshot.json')), baseline: hash(join(directory, 'pre-quality-feedback-snapshot.json')), manifest: hash(join(directory, 'manifest.json')), proposal: hash(join(directory, 'feedback-run-80094931-1ed4-4b40-bfe3-14a90886e7da-proposal.json')) },
};
writeFileSync(join(directory, 'review-r6-structure-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
