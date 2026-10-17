import { readFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiagnosticSection, DiagnosticUsage, PlanningRun, PlanningTaskDiagnostic, PlanningCallDiagnostic, ProjectPlanningDiagnostics } from '@project-architect/contracts';

type Inspection = Pick<ProjectPlanningDiagnostics, 'runtime' | 'tasks' | 'calls' | 'provider'>;
const runStatuses = ['queued', 'running', 'paused', 'reviewable', 'failed', 'cancelled', 'stale'];
const kinds = ['clarification', 'design', 'research', 'validation', 'integration', 'review', 'revision', 'decomposition'];
const taskStatuses = ['queued', 'running', 'completed', 'paused', 'cancelled'];
const usageKeys = ['inputTokens', 'outputTokens', 'thinkingTokens', 'totalTokens', 'cacheReadTokens'] as const;
export const unknownUsage = (): DiagnosticUsage => ({ inputTokens: null, outputTokens: null, thinkingTokens: null, totalTokens: null, cacheReadTokens: null });
const finiteNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const safeName = (value: unknown): string | null => typeof value === 'string' && /^[a-z0-9._-]{1,160}$/i.test(value) ? value : null;
const taskId = (value: unknown): value is string => typeof value === 'string' && /^task-[a-z0-9-]+$/.test(value);
class JournalIntegrityError extends Error {
  constructor(readonly diagnosticReason: 'SEQUENCE_GAP' | 'NEXT_SEQUENCE_UNAVAILABLE' | 'NEXT_SEQUENCE_MISMATCH') { super(diagnosticReason); }
}
const reason = (error: unknown): string => error instanceof JournalIntegrityError ? error.diagnosticReason : error instanceof SyntaxError ? 'INVALID_JSON' : /^E[A-Z]+$/.test(String((error as NodeJS.ErrnoException).code)) ? (error as NodeJS.ErrnoException).code! : 'INVALID_RECORD';
const section = (reasons: string[], unavailable = false): DiagnosticSection => ({ availability: unavailable ? 'unavailable' : reasons.length ? 'partial' : 'available', reasons: [...new Set(reasons)] });

async function readJson(path: string): Promise<any> {
  if ((await lstat(path)).isSymbolicLink()) throw new Error('symbolic record');
  return JSON.parse(await readFile(path, 'utf8'));
}
async function names(path: string): Promise<string[]> {
  if ((await lstat(path)).isSymbolicLink()) throw new Error('symbolic directory');
  return readdir(path);
}
async function directory(path: string): Promise<void> {
  const entry = await lstat(path);
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('invalid directory');
}

/** Observes registered metadata only. It never calls Runtime.get/list/resume or a Provider. */
export async function inspectPlanningRuntime(path: string, projectId: string, basisHash: string | null, active: PlanningRun[], providerIdentity: string | null, expectedRunIds: string[] = [], includeCalls = true): Promise<Inspection> {
  const root = join(path, 'runtime', 'planning');
  const runtimeReasons: string[] = [], taskReasons: string[] = [], callReasons: string[] = [];
  let directoryNames: string[] = [], directoryUnavailable = false;
  try { await directory(join(path, 'runtime')); directoryNames = await names(root); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { directoryUnavailable = true; runtimeReasons.push(`runtime-directory:${reason(error)}`); callReasons.push('runtime-directory-unreadable'); } }
  const activeById = new Map(active.map(run => [run.id, run]));
  const ids = [...new Set([...directoryNames.filter(name => /^run-[a-z0-9-]+$/.test(name)), ...activeById.keys(), ...expectedRunIds.filter(id => /^run-[a-z0-9-]+$/.test(id))])];
  const runs: Inspection['runtime']['runs'] = [], tasks: PlanningTaskDiagnostic[] = [], calls: PlanningCallDiagnostic[] = [];
  for (const id of ids) {
    const runReasons: string[] = [];
    let stored: PlanningRun | undefined;
    try { await directory(join(root, id)); stored = await readJson(join(root, id, 'run.json')); }
    catch (error) { runReasons.push(`run-record:${reason(error)}`); }
    const memory = activeById.get(id), run = memory ?? stored;
    const valid = run && run.id === id && run.projectId === projectId && Array.isArray(run.tasks) && runStatuses.includes(run.status);
    if (!valid) {
      runtimeReasons.push(`${id}:invalid-run`); taskReasons.push(`${id}:tasks-unavailable`); callReasons.push(`${id}:calls-unavailable`);
      runs.push({ runId: id, stage: null, storedStatus: null, effectiveStatus: 'unknown', active: Boolean(memory), basisStatus: 'unknown', effectiveConfig: null, integrity: 'partial', reasons: [...runReasons, 'invalid-run'] });
      continue;
    }
    const stage = ['clarify', 'product', 'technical', 'delivery', 'feedback'].includes(run.stage) ? run.stage : null;
    if (!stage) runReasons.push('stage-unavailable');
    try {
      const journalPath = join(root, id, 'events.ndjson');
      if ((await lstat(journalPath)).isSymbolicLink()) throw new Error('symbolic journal');
      const lines = (await readFile(journalPath, 'utf8')).split('\n').filter(Boolean);
      let lastSeq = 0;
      for (const line of lines) {
        const event = JSON.parse(line);
        if (!Number.isSafeInteger(event?.seq) || typeof event.type !== 'string') throw new Error('invalid event');
        if (event.seq !== lastSeq + 1) throw new JournalIntegrityError('SEQUENCE_GAP');
        lastSeq = event.seq;
      }
      if (!Number.isSafeInteger(run.nextEventSeq) || run.nextEventSeq < 1) throw new JournalIntegrityError('NEXT_SEQUENCE_UNAVAILABLE');
      if (run.nextEventSeq !== lastSeq + 1) throw new JournalIntegrityError('NEXT_SEQUENCE_MISMATCH');
    } catch (error) { runReasons.push(`event-journal:${reason(error)}`); callReasons.push(`${id}:event-journal-incomplete`); }
    let frozen = run.effectiveConfig ?? null;
    if (frozen && (!Number.isSafeInteger(frozen.concurrency) || frozen.concurrency < 1 || frozen.concurrency > 16 || !safeName(frozen.designModel) || !safeName(frozen.reviewModel) || (frozen.officialHosts !== undefined && (!Array.isArray(frozen.officialHosts) || !frozen.officialHosts.every(host => typeof host === 'string' && /^[a-z0-9.-]+$/.test(host) && host.includes('.')))))) { frozen = null; runReasons.push('invalid-frozen-configuration'); }
    if (frozen) frozen = { concurrency: frozen.concurrency, designModel: frozen.designModel, reviewModel: frozen.reviewModel, ...(frozen.officialHosts ? { officialHosts: [...frozen.officialHosts] } : {}) };
    if (!frozen) runReasons.push('frozen-configuration-unavailable');
    runs.push({ runId: id, stage, storedStatus: stored && runStatuses.includes(stored.status) ? stored.status : null, effectiveStatus: memory ? run.status : ['running', 'queued'].includes(run.status) ? 'interrupted' : run.status, active: Boolean(memory), basisStatus: basisHash && typeof run.basis?.hash === 'string' ? run.basis.hash === basisHash ? 'current' : 'stale' : 'unknown', effectiveConfig: frozen, integrity: runReasons.length ? 'partial' : 'unchecked', reasons: runReasons });
    runtimeReasons.push(...runReasons.map(value => `${id}:${value}`));
    const taskIds = new Set<string>();
    for (const task of run.tasks) {
      if (!task || !taskId(task.id) || !kinds.includes(task.kind) || !taskStatuses.includes(task.status) || !Array.isArray(task.dependsOn) || !task.dependsOn.every(taskId)) { taskReasons.push(`${id}:invalid-task`); callReasons.push(`${id}:uninspectable-task`); continue; }
      if (taskIds.has(task.id)) { taskReasons.push(`${id}:duplicate-task`); callReasons.push(`${id}:registration-incomplete`); continue; }
      taskIds.add(task.id);
      const attempts = Number.isSafeInteger(task.attempts) && task.attempts >= 0 ? task.attempts : null;
      tasks.push({ runId: id, taskId: task.id, kind: task.kind, status: task.status, dependsOn: [...task.dependsOn], requestedModel: safeName(task.model), attempts, outputOrigin: ['provider', 'assembly'].includes(task.outputOrigin ?? '') ? task.outputOrigin! : null, outputHash: typeof task.outputHash === 'string' && /^[a-f0-9]{64}$/i.test(task.outputHash) ? task.outputHash : null, integrity: 'unchecked' });
      if (!includeCalls) continue;
      if (attempts === null) { taskReasons.push(`${task.id}:attempts-unknown`); callReasons.push(`${task.id}:attempts-unknown`); }
      let files: string[] = [];
      try { await directory(join(root, id, 'tasks')); files = await names(join(root, id, 'tasks', task.id)); }
      catch (error) { if (attempts !== 0 || (error as NodeJS.ErrnoException).code !== 'ENOENT') callReasons.push(`${task.id}:call-directory:${reason(error)}`); }
      const recorded = new Set<number>();
      for (const file of files.filter(name => /^call-[1-9][0-9]*\.json$/.test(name))) {
        const attempt = Number(file.slice(5, -5));
        if (!Number.isSafeInteger(attempt)) { callReasons.push(`${task.id}:invalid-call-number`); continue; }
        recorded.add(attempt);
        let record: any, errorReason: string | undefined;
        try { record = await readJson(join(root, id, 'tasks', task.id, file)); if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('invalid call'); }
        catch (error) { errorReason = reason(error); }
        const reasons: string[] = errorReason ? [errorReason] : [];
        const usage = unknownUsage(); for (const key of usageKeys) usage[key] = finiteNumber(record?.usage?.[key]);
        if (usageKeys.some(key => usage[key] === null)) reasons.push('usage-incomplete');
        const status = safeName(record?.status), durationMs = finiteNumber(record?.durationMs);
        if (!status || durationMs === null) reasons.push('metrics-incomplete');
        if (attempts === null || attempt > attempts) reasons.push('registration-incomplete');
        const item: PlanningCallDiagnostic = { runId: id, taskId: task.id, attempt, status, durationMs, requestedModel: safeName(record?.model), reasoningEffort: safeName(record?.reasoningEffort), usage, ...section(reasons, Boolean(errorReason)) };
        calls.push(item); callReasons.push(...reasons.map(value => `${task.id}:call-${attempt}:${value}`));
      }
      if (attempts !== null && recorded.size < attempts) callReasons.push(`${task.id}:missing-call-receipts`);
    }
  }
  const usage = unknownUsage();
  const incomplete = directoryUnavailable || runtimeReasons.some(value => value.includes('invalid-run') || value.includes('run-record')) || callReasons.length > 0;
  if (!incomplete && calls.length) for (const key of usageKeys) if (calls.every(call => call.usage[key] !== null)) usage[key] = calls.reduce((total, call) => total + call.usage[key]!, 0);
  const recordedCalls = calls.filter(call => call.availability !== 'unavailable').length;
  return { runtime: { ...section(runtimeReasons, directoryUnavailable && !active.length), runs }, tasks: { ...section(taskReasons, directoryUnavailable && !active.length), items: tasks }, calls: { ...section(callReasons, directoryUnavailable && !active.length), recordedCalls: incomplete && !recordedCalls ? null : recordedCalls, incomplete, usage, items: calls }, provider: { ...section(providerIdentity ? [] : ['provider-identity-unavailable'], !providerIdentity), identity: providerIdentity, probe: { status: 'unchecked', checkedAt: null, scope: null } } };
}
