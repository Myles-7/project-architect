import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';

// Independent paused-control and preservation audit. Never invokes Provider.
if (!process.argv[2]) throw new Error('Pass a frozen quota-paused control directory');
const directory = resolve(process.argv[2]);
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const hash = name => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const clean = block => { const value = { ...block }; delete value.approvedBy; delete value.approvedAt; return value; };
const statuses = items => items.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
const manifest = read('manifest.json');
if (manifest.status !== 'blocked' || !manifest.completedAt || manifest.activeCallsAtShutdown !== 0) throw new Error('Requires frozen blocked control with no active calls');
const runId = manifest.qualityFeedback.runId;
const runName = `project-records/runtime/planning/${runId}/run.json`;
const run = read(runName);
if (run.status !== 'paused') throw new Error('Requires authoritative paused Runtime');
const topRunName = `feedback-${runId}.json`;
const baseline = read('pre-quality-feedback-snapshot.json');
const blueprint = read('project-records/state/blueprint.json');
const planning = read('project-records/state/planning.json');
const changeSets = read('project-records/state/changesets.json');
const beforeMap = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
const formalMismatches = blueprint.blocks.filter(block => !equals(block, beforeMap.get(block.id))).map(block => block.id);
const evidenceMap = new Map(planning.evidence.map(item => [item.id, item]));
const alteredEvidence = baseline.planning.evidence.filter(item => !equals(item, evidenceMap.get(item.id))).map(item => item.id);
const packages = manifest.packages.map(pkg => ({ name: `${pkg.labelSuffix}-development-package`, inheritedFrom: pkg.inheritedFrom ?? null, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, zipSha256: hash(`${pkg.labelSuffix}-development-package.zip`), zipMatchesManifest: hash(`${pkg.labelSuffix}-development-package.zip`) === pkg.zipSha256 }));
const inheritedReceiptChecks = (manifest.migration.receipts ?? []).map(item => {
  const prefix = `project-records/runtime/planning/${item.runId}/tasks/${item.taskId}`;
  return { taskId: item.taskId, resultMatches: hash(`${prefix}/result.json`) === item.resultSha256, receiptMatches: hash(`${prefix}/result-receipt.json`) === item.receiptSha256 };
});
const sourceDraft = changeSets.find(item => item.id === run.draftSource?.changeSetId);
const calls = manifest.providerCalls.filter(call => !call.inheritedFrom);
const sourceFiles = ['manifest.json', runName, topRunName, `project-records/runtime/planning/${runId}/events.ndjson`, 'project-records/state/blueprint.json', 'project-records/state/planning.json', 'project-records/state/changesets.json', 'pre-quality-feedback-snapshot.json', 'migration-start-snapshot.json'];
let intermediateRevision = null;
if (basename(directory) === 'gemini31-materials-final-20261005-02') {
  const task = run.tasks.filter(item => item.kind === 'revision' && item.status === 'completed').at(-1);
  const outputName = `project-records/runtime/planning/${runId}/${task.outputRef}`;
  const revision = read(outputName);
  sourceFiles.push(outputName);
  const suggestedBlocks = revision.groups.flatMap(group => group.blocks ?? []);
  const suggestedMap = new Map(suggestedBlocks.map(block => [block.id, block]));
  const candidateMap = new Map(beforeMap);
  for (const group of revision.groups) {
    for (const id of group.removeBlockIds ?? []) candidateMap.delete(id);
    for (const block of group.blocks ?? []) candidateMap.set(block.id, block);
  }
  const relatedIds = ['blk-feat-reset', 'blk-flow-reset', 'blk-page-main-layout', 'blk-acc-reset', 'blk-tech-data-model', 'blk-tech-interface', 'blk-tech-error', 'blk-deliv-task-reset-workflow', 'blk-deliv-task-error-handling', 'blk-deliv-acc-full-e2e', 'blk-deliv-val-standalone-runtime', 'blk-tech-module'];
  const unrelatedIds = [...beforeMap.keys()].filter(id => !relatedIds.includes(id));
  const oldIntegrationName = `../gemini31-materials-final-20261005-01/project-records/runtime/planning/${runId}/tasks/task-9af015e0-a998-483d-8a05-24f5e32998be/result.json`;
  const oldIntegration = read(oldIntegrationName);
  const oldMap = new Map(oldIntegration.groups.flatMap(group => group.blocks ?? []).map(block => [block.id, block]));
  const content = id => candidateMap.get(id)?.content ?? '';
  const interfaceContent = content('blk-tech-interface');
  const baselineInterface = beforeMap.get('blk-tech-interface').content;
  const methodNames = ['bindInputNode', 'focusInput', 'schedule', 'cancel', 'hasPending', 'handleReset', 'captureSnapshot', 'rollback', 'renderProjectName', 'renderPlaceholder', 'showInputError', 'clearInputError', 'showGlobalError', 'showSevereFallbackDraft', 'validate'];
  const methods = methodNames.map(name => {
    const pattern = new RegExp(`\\b${name}\\s*\\(`);
    return { name, existedInApprovedInterface: pattern.test(baselineInterface), occursInCandidateInterface: pattern.test(interfaceContent), occurrenceBlockIds: [...candidateMap.values()].filter(block => pattern.test(block.content + '\n' + JSON.stringify(block.task ?? {}))).map(block => block.id) };
  });
  intermediateRevision = {
    taskId: task.id, attempt: task.attempts, outputName, sourceHash: hash(outputName), status: 'unapproved intermediate observation; no terminal content acceptance',
    suggestionCount: suggestedBlocks.length, ids: suggestedBlocks.map(block => block.id), removals: revision.groups.flatMap(group => group.removeBlockIds ?? []),
    duplicateIds: suggestedBlocks.map(block => block.id).filter((id, index, values) => values.indexOf(id) !== index), outsideRelatedClosure: suggestedBlocks.map(block => block.id).filter(id => !relatedIds.includes(id)),
    relatedIds, candidateAssembledCount: candidateMap.size, candidateIdsMatchBaseline: equals([...candidateMap.keys()].sort(), [...beforeMap.keys()].sort()),
    unrelatedCount: unrelatedIds.length, unrelatedObjectMismatches: unrelatedIds.filter(id => !equals(clean(beforeMap.get(id)), clean(candidateMap.get(id)))),
    priorIntegrationBlockBodyMismatches: suggestedBlocks.filter(block => block.content !== oldMap.get(block.id)?.content).map(block => block.id),
    priorIntegrationFullBlockMismatches: suggestedBlocks.filter(block => !equals(clean(block), clean(oldMap.get(block.id) ?? {}))).map(block => block.id),
    publicMethodOccurrences: methods,
    publicMethodsMissingFromCandidateInterface: methods.filter(item => item.existedInApprovedInterface && !item.occursInCandidateInterface).map(item => item.name),
    initialization: {
      initMethodAppears: /\binit\(elements\)/.test(interfaceContent),
      fiveDependencyNamesPresent: ['displayElement', 'initialInputNode', 'errorContainer', 'resetButton', 'readonlyFallbackContainer'].every(name => interfaceContent.includes(name)),
      initialGenerationAndEpochStated: interfaceContent.includes('inputGeneration=1') && interfaceContent.includes('schedulerEpoch=0'),
      singleResetBindingStated: content('blk-tech-module').includes('仅注册一次') && interfaceContent.includes('一次性绑定'),
      readonlyTextareaSourceStated: content('blk-page-main-layout').includes('readonly textarea') && content('blk-tech-data-model').includes('HTMLTextAreaElement'),
      startupDependencyFailureStated: content('blk-tech-error').includes('缺失任何一项') && content('blk-tech-error').includes('真实可见失败'),
      firstInput300msScenarioPresent: content('blk-deliv-acc-full-e2e').includes('AppController.init') && content('blk-deliv-acc-full-e2e').includes("'E2E-Test-Alpha'"),
      interpretation: 'The initializer name, five dependencies, initial states, single binding and readonly textarea injection now exist across the unapproved candidate. Do not describe init as entirely absent or require TypeScript syntax from native JavaScript merely for formatting. The other original public method contracts remain weakened or absent in the interface block.'
    },
    transactionObservation: { modulePlacesGenerationAtSuccessfulCommit: content('blk-tech-module').includes('全部成功后进行原子提交') && content('blk-tech-module').includes('递增 inputGeneration'), modelPlacesGenerationAtSuccessfulCommit: content('blk-tech-data-model').includes('仅在清空事务全流程成功提交后递增'), interpretation: 'Observed normative text in the intermediate suggestion, not target app execution or final content closure.' },
    providerRevisionBlockers: revision.blockers,
  };
}
const results = {
  schemaVersion: 1, reviewKind: 'independent frozen quota-paused preservation audit and explicitly unapproved intermediate observation',
  reviewedAt: new Date().toISOString(), control: basename(directory), verdict: 'quota-paused-before-final-artifact-review', contentPassed: null,
  controlStatus: manifest.status, completedAt: manifest.completedAt, error: manifest.error,
  runtime: { id: run.id, status: run.status, updatedAt: run.updatedAt, canonicalTerminalCopiesMatch: equals(run, read(topRunName)), taskCounts: statuses(run.tasks), pausedTasks: run.tasks.filter(task => task.status === 'paused').map(task => ({ id: task.id, kind: task.kind, attempts: task.attempts, error: task.error ?? null })), completedHistoricalReviewTaskCount: run.tasks.filter(task => task.kind === 'review' && task.status === 'completed').length },
  provider: { actualConfig: manifest.actualConfig, recordedNewCalls: calls.length, callStatuses: statuses(calls), newSuccessfulReviewCalls: calls.filter(call => call.status === 'success' && run.tasks.some(task => task.kind === 'review' && call.requestId.startsWith(task.id + '-'))).length, quotaFailureCalls: calls.filter(call => /Individual quota reached|RESOURCE_EXHAUSTED|code 429/.test(call.error ?? '')).length, maxActualConcurrent: manifest.maxActiveCalls, activeAtShutdown: manifest.activeCallsAtShutdown },
  state: { revision: read('project-records/state/current.json').revision, formalBlockCount: blueprint.blocks.length, formalIdsMatchBaseline: equals([...beforeMap.keys()].sort(), blueprint.blocks.map(block => block.id).sort()), formalBlockMismatches: formalMismatches, sourceDraftId: sourceDraft?.id ?? null, sourceDraftStatus: sourceDraft?.status ?? null, sourceDraftGroups: sourceDraft?.groups.map(group => ({ id: group.id, status: group.status })) ?? [], newRunChangeSetCount: changeSets.filter(item => item.runId === runId).length },
  evidence: { before: baseline.planning.evidence.length, after: planning.evidence.length, preserved: baseline.planning.evidence.length - alteredEvidence.length, missingOrChangedEvidence: alteredEvidence },
  inheritedReceipts: { count: inheritedReceiptChecks.length, preserved: inheritedReceiptChecks.filter(item => item.resultMatches && item.receiptMatches).length, mismatches: inheritedReceiptChecks.filter(item => !item.resultMatches || !item.receiptMatches) },
  coreNewApproval: false, humanApproval: 'pending', newApprovalCount: manifest.approvals.filter(item => !item.inheritedFrom).length, finalSnapshotExists: existsSync(join(directory, 'final-snapshot.json')), newPackageCount: packages.filter(pkg => !pkg.inheritedFrom).length, inheritedPackages: packages,
  intermediateRevision,
  criteria: basename(directory).startsWith('flash-vague-') ? [
    '四痛点、非目标、统一Ctrl或Cmd+Enter、AppMeta/持久化与提醒接口、诚实隐私探测、Markdown与代码复制',
    '所有现存实体修改必填expectedRevision并在同事务get-CAS-put、独立create、force再次CAS、禁止复活、原子批量及重复trash',
    '替换导入本地单调libraryGeneration、同ID版本旧会话失效、合并冲突、取消零写入、失败回滚和竞争',
    '完整notes/meta备份、严格类型与关联验证、无损元数据回收往返、独立未存草稿原文导出和身份',
    'sessionStorage按note或新草稿ID及代际隔离、schema/savedAt/baseRevision/raw、明确恢复丢弃与原CAS、可见存储失败、关闭不保证恢复',
    'HTTPS或可信localhost、不支持file部署、已打开离线与SW缓存冷重启区分、安装缓存资源失败前提',
    '导航起始至可交互不超过1秒、输入至DOM可见含80ms防抖nearest-rank P95不超过150ms、固定种子1000条、唯一预热重复与设备原始样本',
    '604800000毫秒及>=边界、刷新重开还原、跨到期可见不暗删、确认取消重复与竞争不复活、本地时钟、50条过期原子清理不超过200ms',
    '正文模型接口错误流程页面task全字段validation acceptance同步、原能力保持、目标应用可用IndexedDB',
    '完整候选和原44批准正文评审、pending保护、公开Core自动批准身份、新compiler START_HERE tasks DAG、目标应用与实测未执行',
  ].map((criterion, index) => ({ id: index + 1, criterion, status: 'not-finally-reviewable', contentVerdict: null })) : [],
  finalReviewBoundary: 'No complete successful new Provider review, Core approval or new compiler package exists. Quota failure is not a semantic final content verdict; preserve null contentPassed. Target app, CodingAgent and real browser/IME/performance testing remain unexecuted.',
  independentReviewer: { providerInvocations: 0, applicationSourceEdits: 0, completedArtifactAuditExecuted: false, targetApplicationExecution: 'unexecuted', actualBrowserImePerformanceTests: 'unexecuted' },
  report: 'INDEPENDENT_QUOTA_PAUSED_REVIEW_20261005.md',
  frozenHashes: Object.fromEntries(sourceFiles.map(name => [name, hash(name)])),
};
writeFileSync(join(directory, 'review-quota-paused-results.json'), JSON.stringify(results, null, 2) + '\n');
writeFileSync(join(directory, 'independent-content-review.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ control: results.control, contentPassed: results.contentPassed, taskCounts: results.runtime.taskCounts, provider: { ...results.provider, actualConfig: undefined }, state: results.state, evidence: results.evidence, inheritedReceipts: results.inheritedReceipts, newApprovalCount: results.newApprovalCount, newPackageCount: results.newPackageCount, intermediateRevision }, null, 2));
