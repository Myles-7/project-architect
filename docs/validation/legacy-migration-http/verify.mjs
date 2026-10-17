import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { registerHooks } from 'node:module';
import { createApp } from '../../../apps/server/dist/server.js';
import { PlanningRuntime } from '../../../apps/server/dist/planning/PlanningRuntime.js';
import { planningAnswerContext } from '../../../apps/server/dist/planning/PlanningAnswerContext.js';
import { ProjectStateEngine, FileStorage, WorkspaceGuard, planningBasis } from '../../../packages/core/dist/index.js';

const reportRoot = dirname(fileURLToPath(import.meta.url));
const repository = resolve(reportRoot, '../../..');
const fixtureUrl = pathToFileURL(join(repository, 'tests/fixtures/legacy-planning.mjs')).href;
// The root fixture normally uses Vitest's workspace alias. Bind only its core
// import to the same compiled module used by the production HTTP app.
const fixtureHook = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@project-architect/core' && context.parentURL === fixtureUrl) {
    return { url: pathToFileURL(join(repository, 'packages/core/dist/index.js')).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { seedLegacyPlanningProject, directoryFileHashes } = await import(fixtureUrl).finally(() => fixtureHook.deregister());
const label = process.argv[2] ?? `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Evidence label must be a single directory name');
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('This verification requires compiled Node 24');
const directory = join(reportRoot, label);
await mkdir(directory, { recursive: false });
await mkdir(join(directory, 'http'));
const result = {
  status: 'running', startedAt: new Date().toISOString(), node: process.version, nodeExecutable: process.execPath,
  mode: 'Compiled production modules; public HTTP operations on a synthetic legacy-project copy',
  limits: 'Synthetic compatibility and fault-injection evidence only; no genuine user data, model calls or human approvals',
  providerCalls: 0, checks: [], requests: [], services: [],
};
const save = async (name, value) => writeFile(join(directory, name), JSON.stringify(value, null, 2) + '\n');
const digest = value => createHash('sha256').update(value).digest('hex');
const normalizedHashes = async path => Object.fromEntries(Object.entries(await directoryFileHashes(path)).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
function check(name, condition, details) {
  result.checks.push({ name, passed: Boolean(condition), ...(details === undefined ? {} : { details }) });
  if (!condition) throw new Error(name);
}
async function exists(path) {
  try { await readFile(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
let original, sourceBefore, untouched, untouchedBefore, operated, operatedBefore, runtime, server, base;
async function startServer(workspace) {
  const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(workspace));
  runtime = new PlanningRuntime(engine, { async complete() { result.providerCalls++; throw new Error('Legacy migration verification must never invoke a Provider'); } });
  const app = createApp({ workspaceRoot: workspace, engine, planningRuntime: runtime, useMockAI: true });
  server = await new Promise((resolveServer, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener));
    listener.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  result.services.push({ base, startedAt: new Date().toISOString(), stopped: false });
}
async function stopServer() {
  if (!server) return;
  await runtime.shutdown();
  server.closeAllConnections();
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  result.services.at(-1).stopped = true;
  result.services.at(-1).stoppedAt = new Date().toISOString();
  server = undefined;
}
async function http(name, method, route, body, expectedStatus = 200) {
  const response = await fetch(base + route, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  const record = { name, method, route, expectedStatus, status: response.status, request: body, response: JSON.parse(text), responseSha256: digest(text) };
  const file = `http/${String(result.requests.length + 1).padStart(2, '0')}-${name}.json`;
  await save(file, record);
  result.requests.push({ name, method, route, status: response.status, evidence: file });
  check(`${name}-http-status`, response.status === expectedStatus, { actual: response.status, expected: expectedStatus, evidence: file });
  return record.response;
}
function currentCleanups(view, snapshot) {
  const basis = planningBasis({ ...snapshot, planning: view.state });
  return view.state.changeSets.filter(change => change.runId === 'migration' && ['pending', 'partially-approved'].includes(change.status) && change.basis.hash === basis.hash);
}
function cleanup(view, snapshot, groupId) {
  return currentCleanups(view, snapshot).find(change => groupId === undefined || change.groups.some(group => group.id === groupId && group.status === 'pending'));
}

try {
  const compiled = ['apps/server/dist/server.js', 'apps/server/dist/planning/PlanningRuntime.js', 'apps/server/dist/planning/PlanningAnswerContext.js', 'packages/core/dist/engine/ProjectStateEngine.js', 'packages/core/dist/planning/PlanningService.js', 'packages/core/dist/commit/StateCommitManager.js'];
  await save('compiled-module-hashes.json', Object.fromEntries(await Promise.all(compiled.map(async file => [file, digest(await readFile(join(repository, file)))]))));
  original = await seedLegacyPlanningProject(join(directory, 'synthetic-source'));
  sourceBefore = await normalizedHashes(original.path);
  const workspace = join(directory, 'operated-workspace');
  operated = join(workspace, 'projects', original.projectId);
  untouched = join(directory, 'untouched-copy');
  await cp(original.path, untouched, { recursive: true });
  await cp(original.path, operated, { recursive: true });
  untouchedBefore = await normalizedHashes(untouched); operatedBefore = await normalizedHashes(operated);
  result.paths = { source: original.path, untouchedCopy: untouched, operatedCopy: operated, evidence: directory };
  await save('source-hashes-before.json', sourceBefore);
  await save('untouched-copy-hashes-before.json', untouchedBefore);
  await save('operated-copy-hashes-before.json', operatedBefore);
  check('source-and-both-copies-start-identical', isDeepStrictEqual(sourceBefore, untouchedBefore) && isDeepStrictEqual(sourceBefore, operatedBefore));
  const oldManifest = JSON.parse(await readFile(join(operated, 'state/revisions/1/manifest.json'), 'utf8'));
  check('fixture-has-no-planning-files-and-preserves-old-ready-format', !oldManifest.files.some(file => ['planning.json', 'blueprint.json', 'changesets.json'].includes(file.filename)));
  await startServer(workspace);
  const prefix = `/api/projects/${original.projectId}`;
  const view = (await http('initial-planning-read', 'GET', prefix + '/planning')).data;
  const snapshot = (await http('initial-snapshot-read', 'GET', prefix)).data.snapshot;
  check('legacy-readiness-is-ready-and-approved-as-fixture-input', snapshot.readiness.current.status === 'ready' && snapshot.readiness.current.userDisposition === 'approved' && snapshot.readiness.history[0].credibilityScore === 100);
  check('legacy-readiness-does-not-approve-empty-blueprint', view.state.blueprint.blocks.length === 0 && Object.values(view.state.blueprint.stages).every(stage => stage === 'not-designed') && view.status !== '已批准' && view.canGenerateProduct === false);
  check('explicit-question-gap-link-restores-decision-key', snapshot.questions.items[0].decisionKey === 'storage:location' && snapshot.decisions.items.find(item => item.id === 'legacy-linked').decisionKey === 'storage:location');
  check('unlinked-decision-remains-unassigned', snapshot.decisions.items.find(item => item.id === 'legacy-unlinked').decisionKey === undefined);
  const answerContext = planningAnswerContext(snapshot.questions.items);
  await save('legacy-answer-context.json', answerContext);
  check('historical-answer-is-unknown-with-full-options-and-no-selection-keys', answerContext.length === 1 && answerContext[0].answerKind === 'unknown' && answerContext[0].selectedOptionKeys.length === 0 && answerContext[0].selectedOptions.length === 0 && isDeepStrictEqual(answerContext[0].options, snapshot.questions.items[0].options) && snapshot.questions.items[0].answerKind === undefined && snapshot.questions.items[0].selectedOptionKeys === undefined);
  check('migration-diagnostics-are-traceable-to-ambiguous-records', view.state.diagnostics.some(item => item.includes('多个有效旧决定')) && view.state.diagnostics.some(item => item.includes('legacy-research-question')) && view.state.diagnostics.some(item => item.includes('legacy-unlinked')), view.state.diagnostics);
  const initialCleanup = cleanup(view, snapshot);
  const originalRecordSummary = original.originalItems.map(({ id, statement, status }) => ({ id, statement, status }));
  const currentRecordSummary = snapshot.decisions.items.map(({ id, statement, status }) => ({ id, statement, status }));
  check('cleanup-is-unapproved-and-retains-all-original-records', initialCleanup?.approvals.length === 0 && ['legacy-linked', 'legacy-locked', 'legacy-research-question'].every(id => initialCleanup.groups.some(group => group.rejectDecisionIds?.includes(id))) && isDeepStrictEqual(currentRecordSummary, originalRecordSummary));
  const refusal = await http('ready-cannot-compile-package', 'POST', prefix + '/planning/package', { expectedRevision: 1, operationId: 'legacy-ready-no-package' }, 422);
  check('package-generation-requires-actual-stage-approval', refusal.error.code === 'STAGE_NOT_APPROVED');
  const locked = await http('cleanup-without-unlock', 'POST', prefix + `/planning/changesets/${initialCleanup.id}/approve`, { expectedRevision: 1, operationId: 'legacy-without-unlock', groupIds: ['cleanup-legacy-locked'] }, 422);
  check('locked-cleanup-requires-explicit-unlock', locked.error.code === 'LOCKED_CONFLICT');
  const afterRead = await normalizedHashes(operated); await save('operated-copy-hashes-after-read-and-refusals.json', afterRead);
  check('compatible-http-reads-and-rejected-writes-do-not-change-project-files', isDeepStrictEqual(afterRead, operatedBefore));

  const saved = (await http('normal-input-commit', 'POST', prefix + '/planning/inputs', { raw: '请检查历史方案中的冲突，暂时保留原记录。', expectedRevision: 1, operationId: 'legacy-normal-input' })).data.snapshot;
  check('normal-operation-persists-new-structure-at-version-2', saved.metadata.stateRevision === 2);
  const manifest2 = JSON.parse(await readFile(join(operated, 'state/revisions/2/manifest.json'), 'utf8')); await save('revision-2-manifest.json', manifest2);
  check('normal-operation-uses-verified-two-phase-manifest', manifest2.verified && ['planning.json', 'blueprint.json', 'changesets.json'].every(name => manifest2.files.some(file => file.filename === name && /^[a-f0-9]{64}$/.test(file.sha256))));
  let current = (await http('planning-after-normal-input', 'GET', prefix + '/planning')).data;
  check('normal-input-does-not-auto-cleanup-or-confirm-blueprint', saved.decisions.items.find(item => item.id === 'legacy-research-question').status === 'confirmed' && Object.values(current.state.blueprint.stages).every(stage => stage === 'not-designed') && cleanup(current, saved)?.status === 'pending');
  const questionCleanup = cleanup(current, saved, 'cleanup-legacy-research-question');
  const reviewed = (await http('approve-question-cleanup', 'POST', prefix + `/planning/changesets/${questionCleanup.id}/approve`, { expectedRevision: current.sourceStateRevision, operationId: 'legacy-review-question', groupIds: ['cleanup-legacy-research-question'] })).data.snapshot;
  check('explicit-cleanup-retains-rejected-record-and-approval-source', reviewed.decisions.items.find(item => item.id === 'legacy-research-question').status === 'rejected' && reviewed.decisions.items.find(item => item.id === 'legacy-research-question').statement === '有没有 GitHub 项目能实现？' && reviewed.decisions.items.find(item => item.id === 'legacy-research-question').rejectionReason.startsWith('approved-cleanup:'));
  const afterPartialApproval = await normalizedHashes(operated);
  await save('operated-copy-hashes-after-partial-approval.json', afterPartialApproval);
  current = (await http('planning-before-explicit-unlock', 'GET', prefix + '/planning')).data;
  const openCleanups = currentCleanups(current, reviewed);
  const remainingGroups = openCleanups.flatMap(change => change.groups.filter(group => group.status === 'pending'));
  const expectedRemainingIds = questionCleanup.groups.filter(group => group.id !== 'cleanup-legacy-research-question').map(group => group.id).sort();
  check('partial-cleanup-keeps-only-one-current-basis-review-package', openCleanups.length === 1 && openCleanups[0].id === questionCleanup.id && openCleanups[0].status === 'partially-approved');
  const remainingTargets = remainingGroups.flatMap(group => group.rejectDecisionIds ?? []);
  check('partial-cleanup-remaining-groups-and-targets-are-unique', isDeepStrictEqual(remainingGroups.map(group => group.id).sort(), expectedRemainingIds) && new Set(remainingTargets).size === remainingTargets.length && !remainingTargets.includes('legacy-research-question'), { packageId: questionCleanup.id, remainingGroupIds: expectedRemainingIds, remainingDecisionIds: remainingTargets });
  for (let read = 1; read <= 2; read++) {
    current = (await http(`partial-cleanup-repeat-read-${read}`, 'GET', prefix + '/planning')).data;
    const repeated = currentCleanups(current, reviewed);
    check(`partial-cleanup-repeat-read-${read}-reuses-the-same-remaining-groups`, current.sourceStateRevision === reviewed.metadata.stateRevision && repeated.length === 1 && repeated[0].id === questionCleanup.id && repeated[0].status === 'partially-approved' && isDeepStrictEqual(repeated[0].groups.filter(group => group.status === 'pending'), remainingGroups));
  }
  const afterPartialReads = await normalizedHashes(operated);
  await save('operated-copy-hashes-after-partial-repeated-reads.json', afterPartialReads);
  check('partial-cleanup-repeated-http-reads-preserve-all-project-file-bytes', isDeepStrictEqual(afterPartialReads, afterPartialApproval));
  const unlockCleanup = cleanup(current, reviewed, 'cleanup-legacy-locked');
  check('second-cleanup-approval-reuses-the-partially-approved-package', unlockCleanup?.id === questionCleanup.id && unlockCleanup.status === 'partially-approved');
  const unlocked = (await http('approve-unlocked-cleanup', 'POST', prefix + `/planning/changesets/${unlockCleanup.id}/approve`, { expectedRevision: current.sourceStateRevision, operationId: 'legacy-review-unlock', groupIds: ['cleanup-legacy-locked'], unlockIds: ['legacy-locked'] })).data.snapshot;
  const finalRevision = unlocked.metadata.stateRevision;
  check('explicit-unlock-permits-cleanup-without-deleting-history', unlocked.decisions.items.find(item => item.id === 'legacy-locked').status === 'rejected' && unlocked.decisions.items.length === original.originalItems.length && original.originalItems.every(item => unlocked.decisions.items.some(savedItem => savedItem.id === item.id && savedItem.statement === item.statement)) && ['legacy-linked', 'legacy-locked'].every(id => unlocked.planning.topics.find(topic => topic.key === 'storage:location').history.includes(id)));
  check('cleanup-approvals-are-recorded-in-formal-history', ['legacy-review-question', 'legacy-review-unlock'].every(id => unlocked.planning.changeSets.some(change => change.approvals.some(approval => approval.operationId === id))));
  const persistedQuestions = JSON.parse(await readFile(join(operated, 'state/questions.json'), 'utf8'));
  check('normal-commit-persists-linked-question-without-inventing-old-selection', persistedQuestions.schemaVersion === 2 && persistedQuestions.items[0].decisionKey === 'storage:location' && persistedQuestions.items[0].answerKind === undefined && persistedQuestions.items[0].selectedOptionKeys === undefined);
  check('historical-document-and-ready-history-retained-after-commits', isDeepStrictEqual(unlocked.documents.items, [original.documentReference]) && unlocked.readiness.history[0].credibilityScore === 100 && await readFile(join(operated, original.documentReference.path), 'utf8') === original.document);
  const oldAfter = await normalizedHashes(join(operated, 'state/revisions/1'));
  const oldBefore = Object.fromEntries(Object.entries(operatedBefore).filter(([file]) => file.startsWith('state\\revisions\\1\\') || file.startsWith('state/revisions/1/')).map(([file, hash]) => [file.replace(/^state[\\/]revisions[\\/]1[\\/]/, ''), hash]));
  check('original-legacy-revision-is-preserved-byte-for-byte', isDeepStrictEqual(oldAfter, oldBefore));
  await save('old-revision-hashes-after-normal-operations.json', oldAfter);
  const acceptedPointer = JSON.parse(await readFile(join(operated, 'state/current.json'), 'utf8'));
  const finalManifest = JSON.parse(await readFile(join(operated, `state/revisions/${finalRevision}/manifest.json`), 'utf8'));
  const finalRevisionHashes = await normalizedHashes(join(operated, `state/revisions/${finalRevision}`));
  await save('accepted-pointer-before-fault.json', acceptedPointer); await save('accepted-revision-manifest.json', finalManifest);
  check('accepted-pointer-matches-last-complete-approved-operation', acceptedPointer.revision === finalRevision && finalManifest.verified);
  await stopServer();

  // Fault injection is confined to the operated synthetic copy, after its server is stopped.
  const incompleteRevision = finalRevision + 1;
  await mkdir(join(operated, `state/revisions/${incompleteRevision}`), { recursive: true });
  await writeFile(join(operated, `state/revisions/${incompleteRevision}/decisions.json`), '{"incomplete":true}\n');
  await mkdir(join(operated, 'state/.commit_staging'), { recursive: true });
  await writeFile(join(operated, 'state/.commit_staging/pending.json'), '{"incomplete":true}\n');
  await writeFile(join(operated, 'state/.commit_marker.json'), JSON.stringify({ targetRevision: incompleteRevision, timestamp: new Date().toISOString(), files: ['decisions.json'] }));
  await writeFile(join(operated, 'state/current.json'), JSON.stringify({ revision: incompleteRevision, timestamp: new Date().toISOString(), manifestFile: 'manifest.json' }));
  await writeFile(join(operated, 'state/decisions.json'), '{"incomplete":true}\n');
  await save('fault-injection.json', { scope: 'operated synthetic copy only', acceptedRevision: finalRevision, incompleteRevision, partialRevisionHasManifest: false, stagedMarker: true, corruptedCanonicalMirror: true, corruptedPointer: true });
  await startServer(workspace);
  const recoveredView = (await http('planning-after-restart-recovery', 'GET', prefix + '/planning')).data;
  const recoveredSnapshot = (await http('snapshot-after-restart-recovery', 'GET', prefix)).data.snapshot;
  check('public-http-read-recovers-last-verified-version', recoveredView.sourceStateRevision === finalRevision && recoveredSnapshot.metadata.stateRevision === finalRevision && isDeepStrictEqual(recoveredSnapshot.decisions.items, unlocked.decisions.items));
  check('recovery-restores-formal-structure-without-approving-blueprint', Object.values(recoveredView.state.blueprint.stages).every(stage => stage === 'not-designed') && recoveredView.state.package === undefined && recoveredSnapshot.questions.items[0].selectedOptionKeys === undefined && recoveredSnapshot.questions.items[0].answerKind === undefined);
  check('recovery-removes-incomplete-revision-marker-and-staging', !await exists(join(operated, 'state/.commit_marker.json')) && !(await readdir(join(operated, 'state'))).includes('.commit_staging') && !(await readdir(join(operated, 'state/revisions'))).includes(String(incompleteRevision)));
  const restoredPointer = JSON.parse(await readFile(join(operated, 'state/current.json'), 'utf8'));
  check('recovery-does-not-rewrite-last-complete-snapshot', restoredPointer.revision === finalRevision && isDeepStrictEqual(await normalizedHashes(join(operated, `state/revisions/${finalRevision}`)), finalRevisionHashes));
  check('recovery-preserves-legacy-revision-and-historical-document', isDeepStrictEqual(await normalizedHashes(join(operated, 'state/revisions/1')), oldAfter) && await readFile(join(operated, original.documentReference.path), 'utf8') === original.document && isDeepStrictEqual(recoveredSnapshot.documents.items, [original.documentReference]));
  await save('recovered-pointer.json', restoredPointer);
  await save('operated-copy-hashes-after-recovery.json', await normalizedHashes(operated));
  check('no-provider-calls', result.providerCalls === 0);
  result.status = 'passed';
} catch (error) {
  result.status = 'failed'; result.error = { message: String(error), stack: error.stack }; process.exitCode = 1;
} finally {
  try { await stopServer(); } catch (error) { result.status = 'failed'; result.shutdownError = String(error); process.exitCode = 1; }
  if (original && sourceBefore) {
    const sourceAfter = await normalizedHashes(original.path); await save('source-hashes-after.json', sourceAfter);
    const unchanged = isDeepStrictEqual(sourceBefore, sourceAfter); result.checks.push({ name: 'original-synthetic-source-never-modified', passed: unchanged });
    if (!unchanged) { result.status = 'failed'; process.exitCode = 1; }
  }
  if (untouched && untouchedBefore) {
    const copyAfter = await normalizedHashes(untouched); await save('untouched-copy-hashes-after.json', copyAfter);
    const unchanged = isDeepStrictEqual(untouchedBefore, copyAfter); result.checks.push({ name: 'unoperated-copy-never-modified', passed: unchanged });
    if (!unchanged) { result.status = 'failed'; process.exitCode = 1; }
  }
  result.finishedAt = new Date().toISOString();
  result.allServicesStopped = result.services.every(service => service.stopped);
  await save('verification.json', result);
  const failed = result.checks.filter(check => !check.passed);
  const summary = `# 旧格式迁移副本 HTTP 验证\n\n结果：${result.status}；Node：${result.node}；Provider 调用：${result.providerCalls}；服务全部停止：${result.allServicesStopped}。\n\n本验证只使用 tests/fixtures/legacy-planning.mjs 创建的合成源和副本，未访问用户 .workspace。使用已编译生产模块与 public HTTP 接口，清理审批是自动验收操作。历史回答 unknown 的检查调用编译后的上下文投影，输入来自 HTTP snapshot；不声称 GET planning 本身返回工作者上下文。\n\n通过 ${result.checks.filter(check => check.passed).length} 项检查，失败 ${failed.length} 项。${result.error ? `\n\n阻塞：${result.error.message}` : ''}\n\n兼容读及拒绝操作不改项目文件；正常提交写入已校验新结构；Locked 清理须显式 unlock。恢复验证在停止服务后，只对操作副本注入未完成 revision、marker、staging、镜像与指针，再经重启 HTTP 读取恢复。源与未操作副本的前后 SHA-256 文件清单、逐次 HTTP 响应、批准版本 manifest 和恢复结果均保留在本目录。\n\n复现：在 Node 24 环境运行 node ${relative(repository, fileURLToPath(import.meta.url)).replaceAll('\\', '/')}，可选第二参数指定新证据目录标签。\n`;
  await writeFile(join(directory, 'REPORT.md'), summary);
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, failed: failed.length, providerCalls: result.providerCalls, allServicesStopped: result.allServicesStopped, evidenceDirectory: directory, error: result.error?.message }));
}
