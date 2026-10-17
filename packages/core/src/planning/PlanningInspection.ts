import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectSnapshot, PlanningBasis, PlanningPackageStatus } from '@project-architect/contracts';
import { emptyPlanningState, planningBasis } from './PlanningState.js';
import { PlanningError, PlanningService } from './PlanningService.js';

async function optionalJson(path: string): Promise<any | undefined> {
  try {
    const entry = await lstat(path);
    if (entry.isSymbolicLink() || !entry.isFile()) throw new PlanningError('STATE_VALIDATION_FAILED', '诊断状态文件不是普通文件');
    return JSON.parse(await readFile(path, 'utf8'));
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
const object = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** Exact committed pointer read. No recovery, migration, material extraction or file writes. */
export async function readProjectSnapshotReadOnly(path: string): Promise<ProjectSnapshot> {
  const pointerPath = join(path, 'state', 'current.json');
  const pointer = await optionalJson(pointerPath);
  if (pointer !== undefined && (!object(pointer) || !Number.isSafeInteger(pointer.revision) || pointer.revision < 1 || pointer.manifestFile !== 'manifest.json')) throw new PlanningError('STATE_VALIDATION_FAILED', '当前状态指针无效；诊断不会执行恢复');
  const directory = pointer ? join(path, 'state', 'revisions', String(pointer.revision)) : join(path, 'state');
  if (!pointer) {
    try { if ((await readdir(join(path, 'state', 'revisions'))).some(name => /^[1-9][0-9]*$/.test(name))) throw new PlanningError('STATE_RECOVERY_REQUIRED', '正式版本存在但当前指针缺失；诊断不会选择或恢复版本'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const location of [join(path, 'state'), ...(pointer ? [join(path, 'state', 'revisions'), directory] : [])]) {
    const entry = await lstat(location);
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new PlanningError('STATE_VALIDATION_FAILED', '诊断状态目录无效');
  }
  const metadata = await optionalJson(pointer ? join(directory, 'metadata.json') : join(path, 'project.json'));
  if (!object(metadata) || !Number.isSafeInteger(metadata.stateRevision) || metadata.stateRevision < 1 || typeof metadata.projectId !== 'string' || typeof metadata.name !== 'string' || !Array.isArray(metadata.inputRefs) || !metadata.inputRefs.every((input: unknown) => object(input) && typeof input.id === 'string' && typeof input.storageRef === 'string' && ['text','file','image'].includes(input.kind) && ['saved','processing','ready','used','failed','excluded'].includes(input.status)) || (pointer && metadata.stateRevision !== pointer.revision)) throw new PlanningError('STATE_VALIDATION_FAILED', '诊断无法读取有效的项目版本');
  const slices = await Promise.all(['overview', 'decisions', 'assumptions', 'gaps', 'risks', 'questions', 'readiness', 'documents', 'planning', 'blueprint', 'changesets'].map(key => optionalJson(join(directory, `${key}.json`))));
  const [overview, decisions, assumptions, gaps, risks, questions, readiness, documents, ledger, blueprint, changeSets] = slices;
  if (![overview, decisions, assumptions, gaps, risks, questions, readiness].every(object) || ![overview.sections, decisions.items, assumptions.items, gaps.gaps, gaps.conflicts, gaps.tensions, risks.items, questions.items, readiness.history].every(Array.isArray) || !decisions.items.every((decision: unknown) => object(decision) && typeof decision.id === 'string' && typeof decision.statement === 'string' && (decision.decisionKey === undefined || typeof decision.decisionKey === 'string')) || (documents !== undefined && (!object(documents) || !Array.isArray(documents.items) || !documents.items.every((item: unknown) => object(item) && typeof item.id === 'string' && typeof item.path === 'string')))) throw new PlanningError('STATE_VALIDATION_FAILED', '诊断所需的正式状态不完整');
  const planningSlices = [ledger, blueprint, changeSets].filter(value => value !== undefined).length;
  if (planningSlices !== 0 && planningSlices !== 3) throw new PlanningError('STATE_VALIDATION_FAILED', '正式规划状态片段不完整；诊断不会迁移或修复');
  const planning = { ...emptyPlanningState(), ...ledger, ...(blueprint ? { blueprint } : {}), ...(changeSets ? { changeSets } : {}) };
  if ((ledger !== undefined && !object(ledger)) || !['inputs','evidence','topics','operations','diagnostics','changeSets'].every(key => Array.isArray((planning as any)[key])) || !object(planning.blueprint) || !Array.isArray(planning.blueprint.blocks) || !object(planning.blueprint.stages) || !['product','technical','delivery'].every(key => ['not-designed','draft','approved','needs-revision'].includes(planning.blueprint.stages[key as 'product']))) throw new PlanningError('STATE_VALIDATION_FAILED', '正式规划状态无效');
  const snapshot: ProjectSnapshot = { metadata: metadata as ProjectSnapshot['metadata'], overview, decisions, assumptions, gaps, risks, questions, readiness, documents, planning };
  const after = await optionalJson(pointerPath);
  if (JSON.stringify(after) !== JSON.stringify(pointer)) throw new PlanningError('STATE_REVISION_CONFLICT', '诊断读取期间项目版本已变化，请重试');
  return snapshot;
}

/** Shared formal pure projection over committed inputRefs; material contents are not rehashed. */
export function planningInspectionBasis(snapshot: ProjectSnapshot): PlanningBasis {
  return planningBasis(PlanningService.projectSnapshot(snapshot));
}

export function planningPackageStatus(snapshot: ProjectSnapshot): PlanningPackageStatus {
  const basisHash = planningInspectionBasis(snapshot).hash;
  const manifest = snapshot.planning?.package;
  if (!manifest) return { status: 'missing', reason: '尚未生成开发包', basisHash, packageBasisHash: null };
  return { status: manifest.basisHash === basisHash ? 'current' : 'stale', reason: manifest.basisHash === basisHash ? null : '开发包依据与当前正式规划、输入或材料不一致', basisHash, packageBasisHash: manifest.basisHash ?? null };
}
