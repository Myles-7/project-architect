import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const label = 'flash-materials-quality-20261005-01';
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const manifestBytes = await readFile(join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0) throw new Error('Requires frozen terminal control');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stateBytes = await readFile(join(root, 'final-snapshot.json'));
const state = JSON.parse(stateBytes.toString('utf8'));
const blocks = state.planning.blueprint.blocks;
const blockById = new Map(blocks.map(block => [block.id, block]));
const suffix = manifest.packages.at(-1).labelSuffix;
const tasksBytes = await readFile(join(root, `${suffix}-development-package/tasks.json`));
const tasks = JSON.parse(tasksBytes.toString('utf8')).tasks;
const taskById = new Map(tasks.map(task => [task.id, task]));
const start = await readFile(join(root, `${suffix}-development-package/START_HERE.md`), 'utf8');
const audit = JSON.parse(await readFile(join(root, 'decoded-audit-command-probe.json'), 'utf8'));
if (audit.sha256 !== hash(tasksBytes) || !audit.parseSuccess || !audit.coreExecutionPass || audit.whitespaceVariantPass !== false) throw new Error('Exact decoded probe evidence changed');
const danglingBlockReferences = blocks.flatMap(block => [...block.dependsOn, ...block.requirementIds].filter(id => !blockById.has(id)).map(id => ({ blockId: block.id, id })));
const danglingTaskReferences = tasks.flatMap(task => task.dependsOn.filter(id => !taskById.has(id)).map(id => ({ taskId: task.id, id })));
const taskCycle = [];
const visited = new Set(), visiting = new Set();
function visit(id, path = []) {
  if (visiting.has(id)) { taskCycle.push([...path, id]); return; }
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of taskById.get(id)?.dependsOn ?? []) visit(dependency, [...path, id]);
  visiting.delete(id); visited.add(id);
}
for (const task of tasks) visit(task.id);
const removedIds = ['blk-task-input-display', 'blk-task-reset', 'blk-tech-task-impl', 'blk-tech-val-performance'];
const implementations = ['blk-deliv-task-layout-styling', 'blk-deliv-task-input-workflow', 'blk-deliv-task-reset-workflow', 'blk-deliv-task-error-handling'];
const packageDependencies = taskById.get('blk-deliv-task-package').dependsOn;
const taskGraphPass = danglingBlockReferences.length === 0 && danglingTaskReferences.length === 0 && taskCycle.length === 0 && removedIds.every(id => !blockById.has(id) && !taskById.has(id)) && implementations.every(id => packageDependencies.includes(id));
if (!taskGraphPass || !start.includes('先完成前置验证')) throw new Error('Reviewed dependency/entry evidence changed');
const perf = taskById.get('blk-deliv-val-perf-benchmark');
if (!perf.normalBehavior.includes('50~150ms') || !perf.normalBehavior.includes('305~325ms') || !perf.steps.some(step => step.includes('5 次')) || !perf.verification.some(step => step.includes('10 次'))) throw new Error('Reviewed performance evidence changed');
const result = {
  label, checkedAt: new Date().toISOString(), kind: 'Independent automatic eight-point content review; not human approval',
  acceptance: 'needs-repair', runtimeStatus: manifest.status,
  scope: 'Review of exact approved planning state and exported package. Target prototype implementation, browser/IME behavior, malicious-input DOM display and application performance remain unexecuted. The audit payload was separately executed only against synthetic source fixtures.',
  sources: { manifestSha256: hash(manifestBytes), finalSnapshotSha256: hash(stateBytes), tasksSha256: hash(tasksBytes), packageSuffix: suffix, zipSha256: manifest.packages.at(-1).zipSha256 },
  checks: [
    { id: 1, status: 'passed-design-review', blocks: ['blk-feat-reset', 'blk-flow-reset', 'blk-acc-reset', 'blk-deliv-task-reset-workflow'], finding: 'Current design explicitly requires immediate clearing of input, output and errors, timer cancellation and refocus, with no second confirmation or undo wait. Actual target behavior remains unexecuted.' },
    { id: 2, status: 'passed-consistency-design-review', blocks: ['blk-tech-stack', 'blk-tech-deployment', 'blk-deliv-spec-deployment'], finding: 'Current blocks and effective decisions consistently select a self-contained classic defer script and IIFE organization rather than ESM. Local-file and HTTP modes, existing local resources and absent Service Worker prerequisites are explicit. Cross-browser file loading is a future verification target, not an executed pass.' },
    { id: 3, status: 'passed-text-sink-design-review', blocks: ['blk-prod-outcomes', 'blk-tech-stack', 'blk-deliv-acc-security-edge'], finding: 'Current requirements restrict user content to the text sink and include literal malicious-markup/HTML-entity display, text-node inspection and preservation of original input on failure. They no longer claim proof that the entire app has no DOM XSS. Historical evidence wording is retained as provenance and is not a performed security test.' },
    { id: 4, status: 'needs-repair', blocks: ['blk-tech-interface', 'blk-tech-data-model', 'blk-tech-error', 'blk-deliv-task-reset-workflow'], finding: 'Ordinary input debouncing, IME suppression, cancellation, empty-result placeholders and removal of Enter/confirm paths are present. However compositionend always schedules a new callback and has no invalidated-session rule after clear; clear then late compositionend permits a new timer/error after the required idle reset. Background throttling and resumption also lack a concrete observable acceptance boundary. This is a contract counterexample, not a reproduced browser defect.', exactContract: blockById.get('blk-tech-interface').content, counterexample: ['compositionstart starts an IME session', 'clear cancels the timer and resets isComposing=false and value empty', 'late compositionend from the invalidated session unconditionally schedules a new 300ms task', 'the empty input can be validated into an error after the supposedly final idle reset'] },
    { id: 5, status: 'needs-repair', blocks: ['blk-deliv-val-perf-benchmark', 'blk-tech-deployment', 'blk-deliv-val-standalone-runtime'], finding: 'Safari is correctly marked pending real-device verification and unavailable historical experiments remain unexecuted. Performance normalBehavior nevertheless invents measured ranges of 50~150ms, 305~325ms and 5~20ms without target measurements. Steps/evidence require five rounds while verification requires ten interactions and three cold loads; passCriteria uses averages while verification also requires maxima. Counts, statistics, metric endpoints and passing boundaries are not one closed executable contract.', exactPerformanceTask: perf },
    { id: 6, status: 'passed-image-and-scope-review', blocks: ['blk-page-main-layout', 'blk-prod-scope', 'blk-prod-non-goals'], finding: 'Original image remains layout evidence. Q7M4-8261 is a visual sample, not a fixed business name. Original image hash and native viewing records remain traceable through the stages, and scope remains a personal single page without backend/login/database/collaboration/payment additions.', imageSha256: manifest.image.sha256, nativeImageViewCount: manifest.checks.find(check => check.name === 'exact-original-view-file-recorded').details.length },
    { id: 7, status: 'needs-entry-text-repair', blocks: ['blk-deliv-task-package', 'blk-deliv-task-layout-styling'], finding: 'The actual task graph is repaired: four duplicate product/technical tasks are removed, all four implementations precede packaging, and application validations follow packaging with no dangling block/task references or task cycles. START_HERE nevertheless tells the reader to complete prerequisite validation in the same sentence that names layout implementation as the first executable task. That compiler-generated instruction conflicts with the actual application-validation prerequisites.', graphPass: taskGraphPass, exportedTaskCount: tasks.length, packageDependencies, danglingBlockReferences, danglingTaskReferences, taskCycle, exactEntryLine: start.split('\n').find(line => line.includes('首个可执行任务')) },
    { id: 8, status: 'needs-repair', blocks: ['blk-deliv-val-security-xss-audit', 'blk-deliv-val-perf-benchmark', 'blk-prod-outcomes'], finding: 'The exact JSON-decoded Node audit payload parses and executes correctly on the seven original synthetic cases, replacing the invalid regex. It falsely reports zero dangerous APIs for legal whitespace variants eval (userInput) and new Function (userInput). The new performance definitions correctly distinguish DOM ready and pre-repaint callback timing from completed visible painting, though the clear metric still uses rendering-time wording. No target application was executed.', decodedAuditEvidence: 'decoded-audit-command-probe.json', auditFailures: audit.executionChecks.filter(check => !check.pass) },
  ],
  verification: { preservedReceiptChecks: 41, inheritedSuccessfulReceipts: 37, totalSuccessfulReceipts: 41, newRealCalls: 4, packageChecks: 247, httpUiChecks: 20, httpUiProviderCalls: 0, exactActualInputArtifactCalls: 4, activeCallsAtShutdown: 0, ownedLeasesAtShutdown: manifest.sharedProviderSlots.ownedLeasesAtShutdown },
  correctionPolicy: 'Keep original feedback, manifest, provider outputs, result receipts, state, documents and ZIP byte-identical. Follow-up semantic changes must be registered through new public automatic quality feedback. Product compiler/prompt repairs belong to the implementation owner.',
};
await writeFile(join(root, 'independent-content-review.json'), JSON.stringify(result, null, 2));
if (!manifestBytes.equals(await readFile(join(root, 'manifest.json')))) throw new Error('Frozen manifest was modified');
console.log(JSON.stringify({ label, acceptance: result.acceptance, checks: result.checks.map(check => ({ id: check.id, status: check.status })), taskGraphPass }));
