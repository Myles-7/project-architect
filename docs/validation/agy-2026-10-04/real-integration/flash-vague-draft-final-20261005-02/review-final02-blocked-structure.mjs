import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const directory = dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const hash = name => createHash('sha256').update(readFileSync(join(directory, name))).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const manifest = read('manifest.json');
const run = read('feedback-run-89597c52-0b0c-487e-95ca-a7789b4768c3.json');
const frozenRuntimeRun = read('project-records/runtime/planning/run-89597c52-0b0c-487e-95ca-a7789b4768c3/run.json');
const baseline = read('pre-quality-feedback-snapshot.json');
const formalBlueprint = read('project-records/state/blueprint.json');
const changeSets = read('project-records/state/changesets.json');
const sourceDraft = changeSets.find(changeSet => changeSet.id === run.draftSource.changeSetId);
const beforeMap = new Map(baseline.planning.blueprint.blocks.map(block => [block.id, block]));
const formalMismatches = formalBlueprint.blocks.filter(block => !equals(block, beforeMap.get(block.id))).map(block => block.id);
const statuses = values => values.reduce((map, value) => ({ ...map, [value.status]: (map[value.status] ?? 0) + 1 }), {});
const packages = manifest.packages.map(pkg => ({ label: pkg.labelSuffix, inheritedFrom: pkg.inheritedFrom ?? null, sourceRevision: pkg.manifest.sourceRevision, revision: pkg.manifest.revision, zipSha256: hash(pkg.labelSuffix + '-development-package.zip'), zipMatches: hash(pkg.labelSuffix + '-development-package.zip') === pkg.zipSha256 }));
const originalTenCriteria = [
  '四痛点/标签查找/非目标边界/统一Ctrl或Cmd+Enter/AppMeta及持久化提醒接口/诚实隐私探测/Markdown及代码复制保留',
  '所有现存实体修改必填expectedRevision同事务get-CAS-put/独立create/禁止复活/force再次CAS/所有状态与批量事务/重复trash保留原状态日期',
  '替换导入本地单调libraryGeneration/即使ID和版本相同旧会话失效/合并冲突规则/取消零写入/失败回滚/导入清理编辑竞争',
  '完整notes/meta备份及严格结构类型关联校验/元数据标签状态回收区往返/未存草稿独立原文导出与恢复身份',
  'sessionStorage按note或新草稿ID和代际隔离/schema/savedAt/baseRevision/raw/显式恢复丢弃保留原CAS/损坏访问配额可见失败/关闭不保证恢复',
  'HTTPS或可信localhost/目标不支持file部署/已打开离线和SW缓存冷重启区别/安装资源缓存失败前提诚实',
  '导航起始至可交互<=1秒/真实输入至DOM可见含80ms防抖nearest-rank P95<=150ms/固定种子1000条/唯一预热重复规则/设备浏览器原始样本/未实测',
  '604800000毫秒及>=边界/刷新重开还原/跨到期可见但不暗删/确认取消重复操作/清理还原编辑竞争不复活/本地时钟限制',
  '所有正文模型接口错误流程页面task全字段validation acceptance同步/无关能力保持/目标应用允许IndexedDB',
  'review完整当前候选和旧批准基线/Core自动批准身份及pending保护/真实新compiler START_HERE tasks DAG/无目标应用或实际浏览器性能验证',
];
const results = {
  schemaVersion: 1,
  kind: 'independent frozen blocked terminal observation; no final candidate content verdict',
  reviewedAt: new Date().toISOString(),
  verdict: 'blocked-before-final-artifact-review', contentPassed: null,
  controlStatus: manifest.status, controlCompletedAt: manifest.completedAt, controlError: manifest.error,
  runtime: { id: run.id, status: run.status, updatedAt: run.updatedAt, error: run.error, canonicalTerminalCopiesMatch: equals(run, frozenRuntimeRun), taskCounts: statuses(run.tasks), reviewTaskCount: run.tasks.filter(task => task.kind === 'review').length, changeSetId: run.changeSetId ?? null, pausedTasks: run.tasks.filter(task => task.status === 'paused').map(task => ({ id: task.id, kind: task.kind, attempts: task.attempts, error: task.error ?? null })), queuedTasks: run.tasks.filter(task => task.status === 'queued').map(task => ({ id: task.id, kind: task.kind, attempts: task.attempts })) },
  provider: { recordedNewCalls: manifest.providerCalls.length, callStatuses: statuses(manifest.providerCalls), maxActualConcurrent: manifest.maxActiveCalls, activeAtShutdown: manifest.activeCallsAtShutdown },
  approvalCount: manifest.approvals.length,
  humanApproval: 'pending', coreNewApproval: false,
  finalSnapshotExists: existsSync(join(directory, 'final-snapshot.json')),
  newPackageCount: packages.filter(pkg => !pkg.inheritedFrom).length, packages,
  state: { revision: read('project-records/state/current.json').revision, formalBlockCount: formalBlueprint.blocks.length, formalIdsMatchBaseline: equals([...beforeMap.keys()].sort(), formalBlueprint.blocks.map(block => block.id).sort()), formalBlockMismatches: formalMismatches, sourceDraftId: sourceDraft.id, sourceDraftStatus: sourceDraft.status, sourceDraftGroups: sourceDraft.groups.map(group => ({ id: group.id, status: group.status })), newRunChangeSetCount: changeSets.filter(changeSet => changeSet.runId === run.id).length },
  criteria: originalTenCriteria.map((criterion, index) => ({ id: index + 1, criterion, status: 'not-finally-reviewable', contentVerdict: null })),
  independentReviewer: { providerInvocations: 0, sourceEdits: 0, nativeBrowserImePerformanceTests: 'unexecuted', targetApplicationExecution: 'unexecuted' },
  frozenHashes: Object.fromEntries(['manifest.json', 'feedback-run-89597c52-0b0c-487e-95ca-a7789b4768c3.json', 'project-records/runtime/planning/run-89597c52-0b0c-487e-95ca-a7789b4768c3/events.ndjson', 'project-records/state/blueprint.json', 'project-records/state/changesets.json', 'pre-quality-feedback-snapshot.json', 'migration-start-snapshot.json'].map(name => [name, hash(name)])),
};
writeFileSync(join(directory, 'review-final02-blocked-results.json'), JSON.stringify(results, null, 2) + '\n');
writeFileSync(join(directory, 'independent-content-review.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ verdict: results.verdict, contentPassed: results.contentPassed, runtime: results.runtime, provider: results.provider, packages: results.packages, state: results.state, frozenHashes: results.frozenHashes }, null, 2));
