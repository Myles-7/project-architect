import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Independent observation of frozen publicly cancelled control; no Provider calls.
const directory = dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const hash = name => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const statuses = items => items.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
const manifest = read('manifest.json');
if (manifest.status !== 'failed' || !manifest.completedAt) throw new Error('Requires frozen stopped terminal control');
const runId = manifest.qualityFeedback.runId;
const runName = `project-records/runtime/planning/${runId}/run.json`;
const run = read(runName);
if (run.status !== 'cancelled') throw new Error('Requires cancelled Runtime record');
const baseline = read('pre-quality-feedback-snapshot.json');
const formalBlueprint = read('project-records/state/blueprint.json');
const formalPlanning = read('project-records/state/planning.json');
const changeSets = read('project-records/state/changesets.json');
const originalMap = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
const formalMismatches = formalBlueprint.blocks.filter(block => !equals(block, originalMap.get(block.id))).map(block => block.id);
const finalEvidence = new Map(formalPlanning.evidence.map(item => [item.id, item]));
const missingOrChangedEvidence = baseline.planning.evidence.filter(item => !equals(item, finalEvidence.get(item.id))).map(item => item.id);
const reviewTask = run.tasks.find(task => task.kind === 'review' && task.status === 'completed');
const reviewResultName = `project-records/runtime/planning/${runId}/${reviewTask.outputRef}`;
const review = read(reviewResultName);
const contextName = `observed-inputs/${reviewTask.id}-${reviewTask.attempts}.context.json`;
const context = read(contextName);
const contextFileBytes = readFileSync(join(directory, contextName)).length;
const integrationTask = run.tasks.find(task => task.kind === 'integration' && task.status === 'completed');
const integrationName = `project-records/runtime/planning/${runId}/${integrationTask.outputRef}`;
const integration = read(integrationName);
const integrationIds = integration.groups.flatMap(group => group.blocks ?? []).map(block => block.id);
const inheritedPackages = manifest.packages.map(pkg => ({ name: `${pkg.labelSuffix}-development-package`, inheritedFrom: pkg.inheritedFrom ?? null, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, zipSha256: hash(`${pkg.labelSuffix}-development-package.zip`), zipMatchesManifest: hash(`${pkg.labelSuffix}-development-package.zip`) === pkg.zipSha256 }));
const relatedIds = ['blk-feat-reset', 'blk-flow-reset', 'blk-page-main-layout', 'blk-acc-reset', 'blk-tech-data-model', 'blk-tech-interface', 'blk-tech-error', 'blk-deliv-task-reset-workflow', 'blk-deliv-task-error-handling', 'blk-deliv-acc-full-e2e', 'blk-deliv-val-standalone-runtime', 'blk-tech-module'];
const sourceFiles = ['manifest.json', runName, `project-records/runtime/planning/${runId}/events.ndjson`, 'project-records/state/blueprint.json', 'project-records/state/planning.json', 'project-records/state/changesets.json', 'pre-quality-feedback-snapshot.json', 'migration-start-snapshot.json', 'controller-stop-intent.json', contextName, reviewResultName, integrationName];
const results = {
  schemaVersion: 1,
  reviewKind: 'independent frozen publicly stopped terminal observation; no final candidate content verdict',
  reviewedAt: new Date().toISOString(), control: 'gemini31-materials-final-20261005-01',
  verdict: 'controller-stopped-before-final-artifact-review', contentPassed: null,
  controlStatus: manifest.status, completedAt: manifest.completedAt, controllerError: manifest.error, stopIntent: read('controller-stop-intent.json'),
  runtime: { authoritativeRecord: runName, id: run.id, status: run.status, updatedAt: run.updatedAt, taskCounts: statuses(run.tasks), tasks: run.tasks.map(task => ({ id: task.id, kind: task.kind, status: task.status, attempts: task.attempts })), changeSetId: run.changeSetId ?? null, finalFeedbackCopyExported: existsSync(join(directory, `feedback-${runId}.json`)) },
  provider: { config: run.effectiveConfig, recordedNewCalls: manifest.providerCalls.filter(call => !call.inheritedFrom).length, callStatuses: statuses(manifest.providerCalls), maxActualConcurrent: manifest.maxActiveCalls, activeAtShutdown: manifest.activeCallsAtShutdown },
  reviewConditionFailure: { taskId: reviewTask.id, blockers: review.blockers, savedContextUtf8Bytes: contextFileBytes, approvedFormalCount: context.blueprint.blocks.length, fullCandidateCount: context.workerResults.draft.groups.flatMap(group => group.blocks ?? []).length, historicalBaselineCount: context.changeReviewBaseline.blocks.length, explanation: 'A complete saved context artifact does not prove the model received its complete contents. The actual structured reviewer result explicitly reports a truncated CLI input and inability to see the full candidate. No complete successful content review is established.' },
  intermediateIntegration: { taskId: integrationTask.id, suggestionBlockCount: integrationIds.length, ids: integrationIds, withinCorrected12BlockClosure: integrationIds.every(id => relatedIds.includes(id)), status: 'unapproved intermediate suggestion; not a final delivery' },
  approvalCount: manifest.approvals.length, coreNewApproval: false, humanApproval: 'pending', finalSnapshotExists: existsSync(join(directory, 'final-snapshot.json')), newPackageCount: inheritedPackages.filter(pkg => !pkg.inheritedFrom).length, inheritedPackages,
  state: { revision: read('project-records/state/current.json').revision, formalBlockCount: formalBlueprint.blocks.length, formalIdsMatchBaseline: equals([...originalMap.keys()].sort(), formalBlueprint.blocks.map(block => block.id).sort()), formalBlockMismatches: formalMismatches, newRunChangeSetCount: changeSets.filter(item => item.runId === run.id).length },
  evidence: { before: baseline.planning.evidence.length, after: formalPlanning.evidence.length, preserved: baseline.planning.evidence.length - missingOrChangedEvidence.length, missingOrChangedEvidence },
  independentReviewer: { providerInvocations: 0, applicationSourceEdits: 0, actualBrowserImePerformanceTests: 'unexecuted', targetApplicationExecution: 'unexecuted' },
  nextFinalReview: { originalBlockers: ['R7-B1', 'R7-B2'], relatedIds, unrelatedCount: 18, requirements: ['Consistent generation increment only at successful transaction commit across all relevant blocks', 'Explicit initialization DOM parameters, state and binding order, usable readonly fallback dependency and startup failure checks', 'Preserve all original normal public method contracts, including ValidatorModule.validate, ResetController.captureSnapshot/rollback, FeedbackBanner error methods and DebounceScheduler methods; internal full application JavaScript is not required', 'Preserve single-node rollback, queued empty/whitespace/nonempty drafts, exact raw-text severe fallback and short non-executable illustration boundary', 'Verify actual complete review context read, frozen source preservation, new Core automated approval and genuine new compiler package without claiming human or target-browser approval'] },
  report: 'INDEPENDENT_STOPPED_CONTROL_REVIEW_GEMINI01_20261005.md',
  frozenHashes: Object.fromEntries(sourceFiles.map(name => [name, hash(name)])),
};
writeFileSync(join(directory, 'review-gemini01-stopped-results.json'), JSON.stringify(results, null, 2) + '\n');
writeFileSync(join(directory, 'independent-content-review.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ verdict: results.verdict, contentPassed: results.contentPassed, runtime: results.runtime, provider: { ...results.provider, config: undefined }, reviewConditionFailure: results.reviewConditionFailure, state: results.state, evidence: results.evidence, approvalCount: results.approvalCount, newPackageCount: results.newPackageCount, intermediateIntegration: results.intermediateIntegration }, null, 2));
