import { readFileSync, writeFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// Independent paused-control and preservation audit. Never invokes Provider.
if (!process.argv[2]) throw new Error('Pass a frozen quota-paused control directory');
const directory = resolve(process.argv[2]);

const auditNames = new Set(['review-quota-paused-structure.mjs','review-quota-paused-results.json','independent-content-review.json','INDEPENDENT_QUOTA_PAUSED_REVIEW_20261005.md']);
function treeObservation(root, excludeAudit = false) {
  const rows=[];
  function walk(at,prefix='') {
    if (lstatSync(at).isSymbolicLink()) throw new Error('Frozen input symlink unsupported');
    for(const entry of readdirSync(at,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (!prefix && excludeAudit && auditNames.has(entry.name)) continue;
      const rel=prefix?prefix+'/'+entry.name:entry.name;
      if(entry.isSymbolicLink()) throw new Error('Frozen input symlink unsupported');
      if(entry.isDirectory()) walk(join(at,entry.name),rel);
      else if(entry.isFile()) rows.push([rel,createHash('sha256').update(readFileSync(join(at,entry.name))).digest('hex')]);
      else throw new Error('Unsupported frozen input entry');
    }
  }
  walk(root);return {sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),fileCount:rows.length};
}
const frozenInputsBefore=treeObservation(directory,true);

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

// These additions independently verify provenance and stopped cross-process leases.
const absoluteHash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const absoluteRead=path=>JSON.parse(readFileSync(path,'utf8'));
const transition=manifest.modelTransition;
const approval=absoluteRead(transition.approvalPath);
const approvedControl=approval.controls.find(value=>value.sourceLabel===transition.sourceLabel&&value.mode===manifest.mode&&value.operation===transition.operation);
if(!approvedControl) throw new Error('No matching authorization control');
const sourceDirectory=dirname(manifest.migration.sourceManifestPath);
const sourceTree=treeObservation(sourceDirectory);
const sourceRecords=treeObservation(join(sourceDirectory,'project-records'));
const sourceManifest=absoluteRead(manifest.migration.sourceManifestPath);
const inheritedRunChecks=transition.inheritedRuns.map(item=>{
 const root=join(directory,'project-records/runtime/planning',item.runId); const inheritedRun=absoluteRead(join(root,'run.json')); const tree=treeObservation(root);
 return {runId:item.runId,files:tree.fileCount,treeMatches:tree.sha256===item.tree.sha256,runMatches:absoluteHash(join(root,'run.json'))===item.runSha256,configMatches:equals(inheritedRun.effectiveConfig,item.effectiveConfig),tasksMatch:equals(inheritedRun.tasks.map(task=>({id:task.id,kind:task.kind,status:task.status,model:task.model??null,attempts:task.attempts,outputOrigin:task.outputOrigin??null})),item.tasks)};
});
const probe=absoluteRead(approval.availabilityProbe.path);
const approvalChecks={
 approvalFileSha256Matches:absoluteHash(transition.approvalPath)===transition.approvalSha256,
 executionAuthorized:approval.kind==='approved-model-transition'&&approval.authorization?.status==='authorized'&&approval.authorization?.authority==='delegated-user-authorization'&&Boolean(approval.authorization?.instruction),
 manifestAuthorizationMatches:equals(transition.authorization,approval.authorization),
 sourceManifestMatches:absoluteHash(manifest.migration.sourceManifestPath)===approvedControl.sourceManifestSha256&&transition.sourceManifestSha256===approvedControl.sourceManifestSha256&&manifest.migration.sourceManifestSha256===approvedControl.sourceManifestSha256,
 sourceTreeMatches:sourceTree.sha256===approvedControl.sourceTreeSha256&&transition.sourceTreeSha256===approvedControl.sourceTreeSha256&&manifest.sourceCopy.sourceTreeSha256===approvedControl.sourceTreeSha256,
 sourceRecordsMatch:sourceRecords.sha256===approvedControl.projectRecordsTreeSha256&&transition.projectRecordsTreeSha256===approvedControl.projectRecordsTreeSha256&&manifest.sourceCopy.copiedProjectTreeSha256===approvedControl.projectRecordsTreeSha256,
 sourceConfigMatches:equals(sourceManifest.requestedConfig,approvedControl.sourceConfig)&&equals(transition.sourceConfig,approvedControl.sourceConfig),
 targetConfigMatches:equals(approval.targetConfig,manifest.requestedConfig)&&equals(approval.targetConfig,{concurrency:manifest.actualConfig.concurrency,designModel:manifest.actualConfig.designModel,reviewModel:manifest.actualConfig.reviewModel})&&equals(approval.targetConfig,transition.targetConfig)&&run.effectiveConfig.designModel===approval.targetConfig.designModel&&run.effectiveConfig.reviewModel===approval.targetConfig.reviewModel&&run.effectiveConfig.concurrency===approval.targetConfig.concurrency,
 qualityFeedbackMatches:absoluteHash(manifest.qualityFeedback.sourceFile)===approvedControl.qualityFileSha256&&transition.qualityFileSha256===approvedControl.qualityFileSha256&&manifest.qualityFeedback.sourceFileTextSha256===approvedControl.qualityFileSha256,
 probeMatches:absoluteHash(approval.availabilityProbe.path)===approval.availabilityProbe.sha256&&probe.status==='success'&&probe.structuredSuccess===true&&probe.model===approval.targetConfig.designModel,
 sourceWasStopped:sourceManifest.activeCallsAtShutdown===0&&(sourceManifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length??0)===0&&['completed','blocked','failed'].includes(sourceManifest.status),
 newRunRegistered:!transition.inheritedRuns.some(item=>item.runId===runId)&&calls.every(call=>run.tasks.some(task=>call.requestId===task.id+'-'+task.attempts)),
 inheritedRunsMatch:inheritedRunChecks.every(item=>item.treeMatches&&item.runMatches&&item.configMatches&&item.tasksMatch),
};
const journalRows=readFileSync(manifest.sharedProviderSlots.journal,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const leaseChecks=calls.map(call=>{
 const lease=call.sharedLease, events=journalRows.filter(item=>item.token===lease.token&&item.label===manifest.label&&item.requestId===call.requestId);const acquired=events.filter(item=>item.event==='acquired'),released=events.filter(item=>item.event==='released');
 const matchingAcquisition=acquired.length===1&&acquired[0].model===call.model&&new Date(acquired[0].at)<=new Date(call.startedAt);
 const matchingRelease=released.length===1&&new Date(released[0].at)>=new Date(call.completedAt)&&new Date(released[0].at)<=new Date(manifest.completedAt);
 return {requestId:call.requestId,token:lease.token,acquiredAt:acquired[0]?.at??null,releasedAt:released[0]?.at??null,matchingAcquisition,matchingRelease};
});
const currentLeaseFiles=readdirSync(manifest.sharedProviderSlots.directory).filter(name=>/^slot-\d+\.json$/.test(name));
const currentOwnedLeases=currentLeaseFiles.map(name=>({name,value:absoluteRead(join(manifest.sharedProviderSlots.directory,name))})).filter(item=>item.value.label===manifest.label||calls.some(call=>item.value.requestId===call.requestId)).map(item=>({name:item.name,requestId:item.value.requestId,label:item.value.label}));
const inputChecks=calls.map(call=>({requestId:call.requestId,taskKind:run.tasks.find(task=>call.requestId.startsWith(task.id+'-'))?.kind,contextUtf8Bytes:readFileSync(call.inputArtifacts.contextPath).length,contextBytesMatch:readFileSync(call.inputArtifacts.contextPath).length===call.inputObservation.runtimeContextUtf8Bytes,contextHashMatches:absoluteHash(call.inputArtifacts.contextPath)===call.inputObservation.runtimeContextSha256,promptHashMatches:absoluteHash(call.inputArtifacts.promptPath)===call.inputObservation.rolePromptSha256,schemaHashMatches:absoluteHash(call.inputArtifacts.schemaPath)===call.inputArtifacts.schemaSha256}));
const pointer=read('project-records/state/current.json');
const authoritativeStateChecks=['blueprint','planning','changesets'].map(name=>({name,projectionMatchesCurrentRevision:equals(read('project-records/state/'+name+'.json'),read('project-records/state/revisions/'+pointer.revision+'/'+name+'.json'))}));
const pendingReferenceId=manifest.qualityFeedback.sourceDraftId??manifest.qualityFeedback.pendingReference?.changeSetId??null;
const pendingReference=pendingReferenceId?changeSets.find(item=>item.id===pendingReferenceId):null;
const originalChangeSets=absoluteRead(join(sourceDirectory,'project-records/state/changesets.json'));
const originalPending=pendingReferenceId?originalChangeSets.find(item=>item.id===pendingReferenceId):null;
const storedPendingReference=pendingReferenceId?read('unapproved-pending-reference.json'):null;
const pendingProtection=pendingReferenceId?{changeSetId:pendingReferenceId,sourceStatus:originalPending?.status??null,storedReferenceStatus:storedPendingReference?.status??null,currentStateStatus:pendingReference?.status??null,groupCount:pendingReference?.groups?.length??0,pendingGroupCount:pendingReference?.groups?.filter(group=>group.status==='pending').length??0,approvalCount:pendingReference?.approvals?.length??0,fullCurrentObjectPreserved:equals(pendingReference,originalPending),currentOnlyTopLevelStatusChanged:equals({...pendingReference,status:originalPending.status},originalPending),storedReferenceFullObjectPreserved:equals(storedPendingReference,originalPending),referenceFileHash:absoluteHash(join(directory,'unapproved-pending-reference.json')),expectedCandidateSha256:manifest.qualityFeedback.sourceDraftSha256,storedReferenceCandidateSha256:createHash('sha256').update(JSON.stringify(storedPendingReference)).digest('hex'),currentCandidateSha256:createHash('sha256').update(JSON.stringify(pendingReference)).digest('hex'),basisInterpretation:'The original pending candidate is preserved exactly as a frozen reference. The copied current state marks its top-level status stale after new feedback registration; all groups remain pending, basis/content/evidence unchanged, and no approvals exist. Its obsolete original basis is not rewritten and old execution is not reused.'}:null;
const frozenInputsAfter=treeObservation(directory,true);
results.reviewKind='independent frozen Opus quota-paused preservation, authorization and stopped-lease audit';
results.authorizationLineage={approvalPath:transition.approvalPath,approvalSha256:absoluteHash(transition.approvalPath),recordedAt:approval.recordedAt,authorization:approval.authorization,sourceLabel:transition.sourceLabel,operation:transition.operation,targetConfig:approval.targetConfig,checks:approvalChecks,sourceTreeObserved:sourceTree,sourceRecordsObserved:sourceRecords,interpretation:'This is a durable delegated execution authorization record attributed to parent /root and the original user authorization. It is not a human content approval, and this audit does not independently reconstruct the original human transcript. The manifest top-level authorization string only identifies simulated input and API automated acceptance.'};
results.inheritedRuns={count:inheritedRunChecks.length,allOriginalBytesConfigAndTaskModelsPreserved:approvalChecks.inheritedRunsMatch,checks:inheritedRunChecks};
results.shutdownLeases={sharedCapacity:manifest.sharedProviderSlots.capacity,ownedAtShutdown:manifest.sharedProviderSlots.ownedLeasesAtShutdown,recordedShutdownEmpty:manifest.sharedProviderSlots.ownedLeasesAtShutdown.length===0,allNewCallsAcquiredThenReleased:leaseChecks.every(item=>item.matchingAcquisition&&item.matchingRelease),checks:leaseChecks,currentOwnedLeases,currentOwnedEmpty:currentOwnedLeases.length===0,globalCurrentSlotFileCount:currentLeaseFiles.length,externalJournalPath:manifest.sharedProviderSlots.journal,journalObservedSha256:absoluteHash(manifest.sharedProviderSlots.journal),scope:'Only these controls own the two tokens each; unrelated controls need not have zero global leases.'};
results.savedInputEvidence={checks:inputChecks,allHashesAndBytesMatch:inputChecks.every(item=>item.contextBytesMatch&&item.contextHashMatches&&item.promptHashMatches&&item.schemaHashMatches),newReviewTaskCount:run.tasks.filter(task=>task.kind==='review').length,newSuccessfulProviderReview:false,boundary:'Exact saved registered design/research contexts and schemas are evidence of saved input only. Both calls per control failed; no complete successful Provider review or candidate quality conclusion exists.'};
results.authoritativeStateChecks=authoritativeStateChecks;
results.pendingReferenceProtection=pendingProtection;
results.immutableInputs={before:frozenInputsBefore,after:frozenInputsAfter,unchanged:equals(frozenInputsBefore,frozenInputsAfter),excludedNewAuditFiles:[...auditNames]};
results.preservationPassed=results.runtime.canonicalTerminalCopiesMatch&&results.state.formalIdsMatchBaseline&&results.state.formalBlockMismatches.length===0&&results.evidence.missingOrChangedEvidence.length===0&&results.inheritedReceipts.mismatches.length===0&&results.inheritedPackages.every(item=>item.zipMatchesManifest)&&results.newApprovalCount===0&&results.newPackageCount===0&&results.state.newRunChangeSetCount===0&&!results.finalSnapshotExists&&Object.values(approvalChecks).every(Boolean)&&results.shutdownLeases.recordedShutdownEmpty&&results.shutdownLeases.allNewCallsAcquiredThenReleased&&results.shutdownLeases.currentOwnedEmpty&&results.savedInputEvidence.allHashesAndBytesMatch&&authoritativeStateChecks.every(item=>item.projectionMatchesCurrentRevision)&&results.immutableInputs.unchanged&&(!pendingProtection||(pendingProtection.storedReferenceFullObjectPreserved&&pendingProtection.currentOnlyTopLevelStatusChanged&&['pending','stale'].includes(pendingProtection.currentStateStatus)&&pendingProtection.pendingGroupCount===pendingProtection.groupCount&&pendingProtection.approvalCount===0&&pendingProtection.storedReferenceCandidateSha256===pendingProtection.expectedCandidateSha256));
results.formalAndHistoricalPreservationPassed=results.state.formalBlockMismatches.length===0&&results.evidence.missingOrChangedEvidence.length===0&&results.inheritedReceipts.mismatches.length===0&&approvalChecks.inheritedRunsMatch;
results.pendingCurrentStateChanged=pendingProtection?pendingProtection.currentStateStatus!==pendingProtection.sourceStatus:false;
results.contentPassed=null;
const note=(manifest.mode==='vague'?'原笔记正式44块及33个证据完整对象保持；冻结参考完整保留源pending草案。新副本current revision=28中该草案顶层status已变为stale，唯一对象差异是顶层status；9组仍pending、0批准。旧basis、组正文和证据未改写，旧执行片段未复用。':'原材料正式30块及42个证据完整对象保持；来源r7的既有内容结论仍由原独立报告负责，本次暂停不证明R7-B1/R7-B2或公共方法契约问题已修复。');
const report=[
 '# Opus 额度暂停控制独立核验 — 2026-10-05',
 '',
 '控制：'+manifest.label+'。独立审计仅核对冻结状态、原事实保持性、授权与租约；contentPassed=null。preservationPassed='+results.preservationPassed+'。',
 '',
 '1. 控制在 '+manifest.completedAt+' UTC 冻结为blocked，权威Run '+runId+' 为paused。新增2次Opus调用分别为design/research，均因Individual quota reached失败；新增完整评审0、审批0、变更包0、compiler新包0。两个任务均paused，没有可作最终质量判断的新结构化建议。',
 '2. '+note+'当前state投影与current revision中的blueprint/planning/changesets完整对象相同。正式区块ID、全部字段和证据对象与pre-quality基线相同。',
 '3. '+results.inheritedReceipts.count+'组继承result.json/result-receipt.json哈希全部相同；'+results.inheritedRuns.count+'个继承Run的全目录字节、配置与任务模型全部相同。'+results.inheritedPackages.length+'个继承ZIP均匹配manifest；它们是历史包，不能归为本轮产物。',
 '4. 源控制 '+transition.sourceLabel+' 的manifest、整个冻结目录和project-records哈希与授权记录相符。仅本目录新增审计脚本、JSON和报告；原manifest、快照、输入、结果、收据、包和启动构建未改动。冻结输入审计前后'+frozenInputsBefore.fileCount+'文件哈希树一致：'+frozenInputsBefore.sha256+'。',
 '5. 每个新增调用在实际调用之前获得独占共享槽，完成之后、控制冻结之前释放；两个token均有匹配acquired/released事件。activeCallsAtShutdown=0，ownedLeasesAtShutdown=[]，审计时该控制现存租约为0。共享总容量4；检查范围不要求其他控制租约为空。',
 '6. 转模授权来源为 '+transition.approvalPath+'，SHA-256 '+absoluteHash(transition.approvalPath)+'，recordedAt '+approval.recordedAt+'。记录authority=delegated-user-authorization，声明原用户Opus许可及/root执行选择，目标design/review均claude-opus-4-6-thinking、concurrency=4。来源、反馈、探针、目标配置及新Run登记逐项匹配。此为执行授权记录，不等于真人审阅或ChangeSet批准；本审计不另行重构最初真人对话。顶层manifest.authorization只说明模拟输入/自动审批身份，不能单独作为转模授权证据。',
 '7. 已保存的design/research context分别为 '+inputChecks.map(item=>item.contextUtf8Bytes).join(' / ')+' UTF-8字节，context/prompt/schema哈希匹配调用记录。保存完整请求上下文不证明Provider完整阅读或完成质量评审；本轮没有review任务或成功评审。探针只证明当时结构化调用可用，也不证明之后额度或设计质量。',
 '8. 本审计Provider调用0、生产代码修改0、完成产物内容审计未执行。目标应用、CodingAgent、真实浏览器/原生IME、辅助技术、布局和性能测试均未执行。暂停是环境额度结果；内容通过与失败都不能据此推断。',
 '',
 '机器证据：independent-content-review.json、review-quota-paused-results.json。可复核脚本：review-quota-paused-structure.mjs。',
 '',
 '审计完成后此代理停止写入本控制目录；后续恢复应创建授权登记的新动作，不能将本报告当作已完成内容验收。',
 '',
].join('\n');
writeFileSync(join(directory,results.report),report);
if(!results.preservationPassed) process.exitCode=1;

writeFileSync(join(directory, 'review-quota-paused-results.json'), JSON.stringify(results, null, 2) + '\n');
writeFileSync(join(directory, 'independent-content-review.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ preservationPassed: results.preservationPassed, authorizationChecks: results.authorizationLineage.checks, shutdownLeaseChecksPassed: results.shutdownLeases.allNewCallsAcquiredThenReleased, immutableInputTreeUnchanged: results.immutableInputs.unchanged, control: results.control, contentPassed: results.contentPassed, taskCounts: results.runtime.taskCounts, provider: { ...results.provider, actualConfig: undefined }, state: results.state, evidence: results.evidence, inheritedReceipts: results.inheritedReceipts, newApprovalCount: results.newApprovalCount, newPackageCount: results.newPackageCount, intermediateRevision }, null, 2));
