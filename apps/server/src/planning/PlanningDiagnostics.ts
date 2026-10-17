import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, join } from 'node:path';
import type { PlanningDiagnosticBasis, PlanningHistoricalDocument, PlanningHistoryView, ProjectPlanningDiagnostics, ProjectSnapshot } from '@project-architect/contracts';
import { planningInspectionBasis, readProjectSnapshotReadOnly, WorkspaceGuard, PlanningError } from '@project-architect/core';
import type { PlanningRuntime } from './PlanningRuntime.js';

/** Derive only IDs explicitly recorded by Core or Runtime's versioned operation keys. */
export function referencedPlanningRuns(snapshot: ProjectSnapshot): string[] {
  const ids = new Set<string>();
  for (const change of snapshot.planning?.changeSets ?? []) if (typeof change?.runId === 'string' && /^run-[a-z0-9-]+$/.test(change.runId)) ids.add(change.runId);
  for (const operation of snapshot.planning?.operations ?? []) {
    if (typeof operation?.id !== 'string') continue;
    const questions = /^questions:(run-[a-z0-9-]+)-delivery-[0-9]+$/.exec(operation.id) ?? /^questions:(run-[a-z0-9-]+)$/.exec(operation.id);
    const cancelled = /^cancel:(run-[a-z0-9-]+):[0-9]+$/.exec(operation.id);
    const proposal = /^proposal:change-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-delivery-[0-9]+$/.exec(operation.id);
    if (questions) ids.add(questions[1]!);
    if (cancelled) ids.add(cancelled[1]!);
    if (proposal) ids.add(`run-${proposal[1]}`);
  }
  return [...ids];
}

function diagnosticBasis(snapshot: ProjectSnapshot): PlanningDiagnosticBasis {
  return { ...planningInspectionBasis(snapshot), source: 'effective-planning-projection', materialBasis: { source: 'committed-input-refs', integrity: 'unchecked' } };
}

export async function planningHistory(path: string, projectId: string, runtime: PlanningRuntime): Promise<PlanningHistoryView> {
  const snapshot = await readProjectSnapshotReadOnly(path);
  if (snapshot.metadata.projectId !== projectId) throw new PlanningError('STATE_VALIDATION_FAILED', '注册项目位置与保存的项目身份不同');
  const basisProjection = diagnosticBasis(snapshot);
  const observed = await runtime.inspect(path, projectId, basisProjection.hash, referencedPlanningRuns(snapshot), false);
  return { sourceStateRevision: snapshot.metadata.stateRevision, snapshot, state: snapshot.planning!, basisProjection, runs: observed.runtime.runs, runtime: { availability: observed.runtime.availability, reasons: observed.runtime.reasons } };
}

export async function planningHistoricalDocument(path: string, projectId: string, documentId: string): Promise<PlanningHistoricalDocument> {
  const snapshot = await readProjectSnapshotReadOnly(path);
  if (snapshot.metadata.projectId !== projectId) throw new PlanningError('STATE_VALIDATION_FAILED', '注册项目位置与保存的项目身份不同');
  const item = snapshot.documents?.items.find(item => item.id === documentId);
  if (!item) throw new PlanningError('ACCESS_DENIED', '历史文档未登记在已提交状态中');
  let source: string;
  try { source = new WorkspaceGuard(path).assertContained(path, join(path, item.path), 'Historical document'); }
  catch { throw new PlanningError('ACCESS_DENIED', '历史文档路径越过注册项目边界或无法安全解析'); }
  const content = await readFile(source, 'utf8');
  return { content, documentId: item.id, docPath: item.path, sourceStateRevision: snapshot.metadata.stateRevision, sourceRevision: Number.isSafeInteger(item.sourceRevision) ? item.sourceRevision : null, storedContentHash: typeof item.contentHash === 'string' && /^[a-f0-9]{64}$/i.test(item.contentHash) ? item.contentHash : null, historical: true, source: 'committed-legacy-document', integrity: 'unchecked' };
}

export async function planningDiagnostics(path: string, projectId: string, configPath: string, runtime: PlanningRuntime): Promise<ProjectPlanningDiagnostics> {
  const snapshot = await readProjectSnapshotReadOnly(path);
  if (snapshot.metadata.projectId !== projectId) throw new PlanningError('STATE_VALIDATION_FAILED', '注册项目位置与保存的项目身份不同');
  const items = await Promise.all(snapshot.metadata.inputRefs.map(async input => {
    let readable: boolean | null = null, reason: string | null = null;
    try {
      const source = new WorkspaceGuard(path).assertContained(path, join(path, input.storageRef), 'Diagnostic material');
      await access(source, constants.R_OK); readable = (await stat(source)).isFile();
      if (!readable) reason = 'NOT_A_FILE';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      readable = code === 'ENOENT' ? false : null;
      reason = typeof code === 'string' && /^[A-Z_]+$/.test(code) ? code : 'MATERIAL_UNREADABLE';
    }
    return { id: input.id, filename: basename(input.storageRef), status: input.status, analysisAvailability: input.analysisAvailability ?? null, readable, reason };
  }));
  const materialReasons = [...new Set(items.flatMap(item => item.reason ? [item.reason] : []))];
  const basisProjection = diagnosticBasis(snapshot);
  const inspected = await runtime.inspect(path, projectId, basisProjection.hash, referencedPlanningRuns(snapshot));
  const current = runtime.getConfig();
  return { schemaVersion: 1, observedAt: new Date().toISOString(), sourceStateRevision: snapshot.metadata.stateRevision, basisProjection,
    project: { availability: 'available', reasons: [], projectId, revision: snapshot.metadata.stateRevision, projectPath: path },
    configuration: { availability: 'available', reasons: [], scope: 'workspace', configPath, current, schedulingConcurrency: current.concurrency },
    ...inspected, materials: { availability: materialReasons.length ? 'partial' : 'available', reasons: materialReasons, items } };
}
