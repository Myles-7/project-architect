import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Independent stopped-control observation. No Provider calls or application edits.
const directory = dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const hash = name => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const statuses = items => items.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
const manifest = read('manifest.json');
if (manifest.status !== 'failed' || !manifest.completedAt) throw new Error('Requires frozen stopped terminal control');
const runId = manifest.qualityFeedback.runId;
// Explicit controller cancellation occurred before the top-level feedback copy export.
const frozenRunName = `project-records/runtime/planning/${runId}/run.json`;
const run = read(frozenRunName);
if (run.status !== 'cancelled') throw new Error('Requires authoritative cancelled Runtime record');
const baseline = read('pre-quality-feedback-snapshot.json');
const formalBlueprint = read('project-records/state/blueprint.json');
const formalPlanning = read('project-records/state/planning.json');
const changeSets = read('project-records/state/changesets.json');
const originalMap = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
const formalMismatches = formalBlueprint.blocks.filter(block => !equals(block, originalMap.get(block.id))).map(block => block.id);
const sourceDraft = changeSets.find(item => item.id === run.draftSource.changeSetId);
const finalEvidence = new Map(formalPlanning.evidence.map(item => [item.id, item]));
const missingOrChangedEvidence = baseline.planning.evidence.filter(item => !equals(item, finalEvidence.get(item.id))).map(item => item.id);
const packages = manifest.packages.map(pkg => ({ name: `${pkg.labelSuffix}-development-package`, inheritedFrom: pkg.inheritedFrom ?? null, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, zipSha256: hash(`${pkg.labelSuffix}-development-package.zip`), zipMatchesManifest: hash(`${pkg.labelSuffix}-development-package.zip`) === pkg.zipSha256 }));
const criteria = [
  '四痛点/无序积累与查找/非目标边界/统一Ctrl或Cmd+Enter/AppMeta与持久化提醒接口/诚实隐私探测/Markdown与代码复制',
  '所有现存实体修改必填expectedRevision同事务get-CAS-put/独立create/禁止复活/force再次CAS/原子批量/重复trash保留原状态日期',
  '替换导入本地单调libraryGeneration/同ID版本旧会话失效/合并冲突/取消零写入/失败回滚/导入清理编辑竞争',
  '完整notes/meta备份与严格类型关联校验/元数据标签状态回收往返/未存草稿独立原文导出及恢复身份',
  'sessionStorage按note或新草稿ID与代际隔离/schema/savedAt/baseRevision/raw/明确恢复丢弃和原CAS/可见存储失败/关闭不保证恢复',
  'HTTPS或可信localhost/不支持file部署/已打开离线与SW缓存冷重启区分/安装缓存资源失败前提',
  '导航起始至可交互不超过1秒/输入至DOM可见含80ms防抖nearest-rank P95不超过150ms/固定种子1000条/唯一预热重复/设备浏览器原始样本/未实测',
  '604800000毫秒与>=边界/刷新重开还原/跨到期标出但不暗删/确认取消重复操作/竞争不复活/本地时钟限制/50条过期笔记原子清理不超过200ms',
  '全部正文模型接口错误流程页面task全字段validation acceptance同步/原明确能力保持/目标应用允许IndexedDB',
  '完整当前候选和原44批准正文评审/Core自动批准身份及pending保护/新compiler START_HERE tasks DAG/目标应用与实际浏览器性能验证未执行',
];
const sourceFiles = ['manifest.json', frozenRunName, `project-records/runtime/planning/${runId}/events.ndjson`, 'project-records/state/blueprint.json', 'project-records/state/planning.json', 'project-records/state/changesets.json', 'pre-quality-feedback-snapshot.json', 'migration-start-snapshot.json', 'controller-stop-intent.json'];
const results = {
  schemaVersion: 1,
  reviewKind: 'independent frozen publicly stopped terminal observation; no final candidate content verdict',
  reviewedAt: new Date().toISOString(),
  control: 'flash-vague-draft-final-20261005-03',
  verdict: 'controller-stopped-before-final-artifact-review', contentPassed: null,
  controlStatus: manifest.status, completedAt: manifest.completedAt, controllerError: manifest.error,
  stopIntent: read('controller-stop-intent.json'),
  runtime: { authoritativeRecord: frozenRunName, id: run.id, status: run.status, updatedAt: run.updatedAt, taskCounts: statuses(run.tasks), completedReviewTaskCount: run.tasks.filter(task => task.kind === 'review' && task.status === 'completed').length, cancelledTasks: run.tasks.filter(task => task.status === 'cancelled').map(task => ({ id: task.id, kind: task.kind, attempts: task.attempts })), changeSetId: run.changeSetId ?? null, finalFeedbackCopyExported: existsSync(join(directory, `feedback-${runId}.json`)) },
  provider: { recordedNewCalls: manifest.providerCalls.filter(call => !call.inheritedFrom).length, callStatuses: statuses(manifest.providerCalls), maxActualConcurrent: manifest.maxActiveCalls, activeAtShutdown: manifest.activeCallsAtShutdown },
  approvalCount: manifest.approvals.length, coreNewApproval: false, humanApproval: 'pending',
  finalSnapshotExists: existsSync(join(directory, 'final-snapshot.json')), newPackageCount: packages.filter(pkg => !pkg.inheritedFrom).length, inheritedPackages: packages,
  state: { revision: read('project-records/state/current.json').revision, formalBlockCount: formalBlueprint.blocks.length, formalIdsMatchOriginalBaseline: equals([...originalMap.keys()].sort(), formalBlueprint.blocks.map(block => block.id).sort()), formalBlockMismatches: formalMismatches, originalEvidenceCount: baseline.planning.evidence.length, sourceDraftId: sourceDraft?.id ?? null, sourceDraftStatus: sourceDraft?.status ?? null, sourceDraftGroups: sourceDraft?.groups.map(group => ({ id: group.id, status: group.status })) ?? [], newRunChangeSetCount: changeSets.filter(item => item.runId === run.id).length },
  evidence: { before: baseline.planning.evidence.length, after: formalPlanning.evidence.length, preserved: baseline.planning.evidence.length - missingOrChangedEvidence.length, missingOrChangedEvidence },
  criteria: criteria.map((criterion, index) => ({ id: index + 1, criterion, status: 'not-finally-reviewable', contentVerdict: null })),
  independentReviewer: { providerInvocations: 0, applicationSourceEdits: 0, actualBrowserImePerformanceTests: 'unexecuted', targetApplicationExecution: 'unexecuted' },
  finalReviewBoundary: 'The controller deliberately stopped an invalid run. This is not a verdict on final candidate content. No new compiler package or approved final snapshot exists, and inherited sourceRevision17/23 packages are historical only.',
  frozenHashes: Object.fromEntries(sourceFiles.map(name => [name, hash(name)])),
  report: 'INDEPENDENT_STOPPED_CONTROL_REVIEW_FINAL03_20261005.md',
};
writeFileSync(join(directory, 'review-final03-stopped-results.json'), JSON.stringify(results, null, 2) + '\n');
writeFileSync(join(directory, 'independent-content-review.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ verdict: results.verdict, contentPassed: results.contentPassed, controlStatus: results.controlStatus, runtime: results.runtime, provider: results.provider, approvalCount: results.approvalCount, newPackageCount: results.newPackageCount, state: results.state, evidence: results.evidence, frozenHashes: results.frozenHashes }, null, 2));
