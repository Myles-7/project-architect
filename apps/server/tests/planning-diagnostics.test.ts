import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorage, ProjectStateEngine, WorkspaceGuard, PlanningService, planningBasis, planningInspectionBasis, readProjectSnapshotReadOnly } from '@project-architect/core';
import { createApp } from '../src/server.js';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { inspectPlanningRuntime } from '../src/planning/PlanningInspector.js';
import { referencedPlanningRuns } from '../src/planning/PlanningDiagnostics.js';

const faults = vi.hoisted(() => new Map<string, string>());
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: (...args: any[]) => {
    const code = faults.get(String(args[0]));
    if (code) return Promise.reject(Object.assign(new Error('private filesystem diagnostic'), { code }));
    return (actual.readFile as any)(...args);
  } };
});
describe('Planning diagnostics observes evidence without writes', () => {
  let root: string, path: string, id: string, engine: ProjectStateEngine, runtime: PlanningRuntime, app: any;
  const provider = { name: 'fixture-provider', complete: vi.fn(async () => { throw new Error('diagnostics must not invoke Provider'); }) };
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-diagnostics-')); path = join(root, 'registered-outside-projects');
    engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
    const created = await engine.createProject({ projectPath: path, name: 'Diagnostics', idea: 'Stored evidence' }); id = created.snapshot.metadata.projectId;
    await writeFile(join(root, '.projects-registry.json'), JSON.stringify([{ projectId: id, projectPath: path, name: 'Diagnostics', stage: 'created', updatedAt: '' }]));
    runtime = new PlanningRuntime(engine, provider as any); app = createApp({ workspaceRoot: root, engine, planningRuntime: runtime });
  });
  afterEach(async () => { faults.clear(); vi.restoreAllMocks(); provider.complete.mockClear(); await runtime?.shutdown(); await rm(root, { recursive: true, force: true }); });
  async function bytes(directory = root): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) for (const [key, value] of Object.entries(await bytes(join(directory, entry.name)))) files[`${entry.name}/${key}`] = value;
      else files[entry.name] = (await readFile(join(directory, entry.name))).toString('base64');
    } return files;
  }
  async function run(status = 'running', extra: Record<string, unknown> = {}) {
    const basis = planningInspectionBasis(await readProjectSnapshotReadOnly(path));
    const value: any = { id: 'run-observed', projectId: id, stage: 'product', status, basis, effectiveConfig: { concurrency: 2, designModel: 'frozen-design', reviewModel: 'frozen-review', officialHosts: ['nodejs.org'] }, tasks: [], nextEventSeq: 2, ...extra };
    const directory = join(path, 'runtime', 'planning', value.id); await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'run.json'), JSON.stringify(value)); await writeFile(join(directory, 'events.ndjson'), JSON.stringify({ seq: 1, type: 'run-started' }) + '\n');
    return { value, directory };
  }
  it.each(['running', 'queued'])('projects disk %s as interrupted at the registered external location', async (status) => {
    await run(status); runtime.configure({ concurrency: 4, designModel: 'current-design', reviewModel: 'current-review' });
    const before = await bytes(); const load = vi.spyOn(engine, 'loadProject'), recover = vi.spyOn((engine as any).commitManager, 'recoverIfNeeded'), get = vi.spyOn(runtime, 'get'), list = vi.spyOn(runtime, 'list');
    const response = await request(app).get(`/api/projects/${id}/diagnostics`).expect(200); const data = response.body.data;
    expect(data.project.projectPath).toBe(path); expect(data.configuration).toMatchObject({ scope: 'workspace', configPath: join(root, 'planning-config.json'), schedulingConcurrency: 4, current: { designModel: 'current-design' } });
    expect(data.runtime.runs[0]).toMatchObject({ storedStatus: status, effectiveStatus: 'interrupted', active: false, basisStatus: 'current', effectiveConfig: { designModel: 'frozen-design', concurrency: 2 }, integrity: 'unchecked' });
    expect(data.provider.probe.status).toBe('unchecked'); expect(data.calls.recordedCalls).toBe(0); expect(data.calls.usage.totalTokens).toBeNull();
    expect(load).not.toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled(); expect(provider.complete).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('does not substitute workspace models for a historical Run without frozen preferences', async () => {
    await run('paused', { effectiveConfig: undefined });
    const response = await request(app).get(`/api/projects/${id}/diagnostics`).expect(200);
    expect(response.body.data.runtime.runs[0]).toMatchObject({ effectiveConfig: null, integrity: 'partial', reasons: expect.arrayContaining(['frozen-configuration-unavailable']) });
  });
  it('reports corrupted Run data as unknown instead of zero calls or recovery', async () => {
    const stored = await run(); await writeFile(join(stored.directory, 'run.json'), '{secret prompt'); const before = await bytes();
    const response = await request(app).get(`/api/projects/${id}/diagnostics`).expect(200); const data = response.body.data;
    expect(data.runtime.runs[0].effectiveStatus).toBe('unknown'); expect(data.calls).toMatchObject({ availability: 'partial', recordedCalls: null, incomplete: true });
    expect(JSON.stringify(data)).not.toContain('secret prompt'); expect(await bytes()).toEqual(before);
  });
  it('exposes registered calls and whitelisted metadata while keeping incomplete usage unknown', async () => {
    const stored = await run('paused', { tasks: [{ id: 'task-provider', kind: 'design', status: 'completed', dependsOn: [], model: 'frozen-design', attempts: 2, outputOrigin: 'provider', outputHash: 'a'.repeat(64), goal: 'private goal' }, { id: 'task-assembly', kind: 'integration', status: 'completed', dependsOn: ['task-provider'], model: 'frozen-design', attempts: 0, outputOrigin: 'assembly' }] });
    const directory = join(stored.directory, 'tasks', 'task-provider'); await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'call-1.json'), JSON.stringify({ status: 'success', durationMs: 20, model: 'frozen-design', reasoningEffort: 'high', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, thinkingTokens: 'unavailable', cacheReadTokens: 0 }, error: 'secret stderr', prompt: 'secret prompt', schemaPath: 'C:/private/schema.json', rawEnvelope: { secret: true } }));
    await writeFile(join(directory, 'call-2.json'), '{broken receipt');
    const before = await bytes(); const data = (await request(app).get(`/api/projects/${id}/diagnostics`).expect(200)).body.data;
    expect(data.tasks.items).toHaveLength(2); expect(data.tasks.items[1].outputOrigin).toBe('assembly');
    expect(data.calls).toMatchObject({ recordedCalls: 1, incomplete: true, usage: { totalTokens: null, thinkingTokens: null } });
    expect(data.calls.items[0]).toMatchObject({ availability: 'partial', usage: { totalTokens: 30, thinkingTokens: null } }); expect(data.calls.items[1].availability).toBe('unavailable');
    expect(JSON.stringify(data)).not.toMatch(/private goal|secret stderr|secret prompt|private\/schema|rawEnvelope|broken receipt/); expect(await bytes()).toEqual(before);
  });
  it('distinguishes permission failure from an absent runtime directory', async () => {
    const stored = await run(); const recordPath = join(stored.directory, 'run.json'); faults.set(recordPath, 'EACCES');
    const observed = await inspectPlanningRuntime(path, id, null, [], 'fixture-provider');
    expect(observed.runtime.runs[0].reasons).toContain('run-record:EACCES'); expect(observed.calls.recordedCalls).toBeNull();
    faults.clear(); await rm(join(path, 'runtime'), { recursive: true });
    const absent = await inspectPlanningRuntime(path, id, null, [], 'fixture-provider'); expect(absent.runtime.availability).toBe('available'); expect(absent.calls.recordedCalls).toBe(0);
  });
  it('marks incomplete journals without mutating them or claiming complete usage', async () => {
    const stored = await run('paused'); await writeFile(join(stored.directory, 'events.ndjson'), '{broken'); const before = await bytes();
    const data = (await request(app).get(`/api/projects/${id}/diagnostics`).expect(200)).body.data;
    expect(data.runtime.availability).toBe('partial'); expect(data.calls.incomplete).toBe(true); expect(data.calls.recordedCalls).toBeNull(); expect(await bytes()).toEqual(before);
  });
  it.each([
    { sequences: [1, 3], nextEventSeq: 4, reason: 'SEQUENCE_GAP' },
    { sequences: [2], nextEventSeq: 3, reason: 'SEQUENCE_GAP' },
    { sequences: [1], nextEventSeq: 4, reason: 'NEXT_SEQUENCE_MISMATCH' },
    { sequences: [1], nextEventSeq: undefined, reason: 'NEXT_SEQUENCE_UNAVAILABLE' },
  ])('reports incomplete journal $reason for $sequences without repairing evidence', async ({ sequences, nextEventSeq, reason }) => {
    const stored = await run('paused', { nextEventSeq });
    await writeFile(join(stored.directory, 'events.ndjson'), sequences.map(seq => JSON.stringify({ seq, type: 'run-started' })).join('\n') + '\n');
    const before = await bytes();
    const data = (await request(app).get(`/api/projects/${id}/diagnostics`).expect(200)).body.data;
    expect(data.runtime).toMatchObject({ availability: 'partial', runs: [{ integrity: 'partial', reasons: expect.arrayContaining([`event-journal:${reason}`]) }] });
    expect(data.calls).toMatchObject({ incomplete: true, recordedCalls: null, usage: { totalTokens: null }, reasons: expect.arrayContaining(['run-observed:event-journal-incomplete']) });
    expect(provider.complete).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('rejects corrupted registry and state rather than falling back to canonical data', async () => {
    await writeFile(join(root, '.projects-registry.json'), '{private registry'); app = createApp({ workspaceRoot: root, engine, planningRuntime: runtime }); const before = await bytes();
    const response = await request(app).get(`/api/projects/${id}/diagnostics`).expect(400); expect(response.body.error.code).toBe('STATE_VALIDATION_FAILED'); expect(JSON.stringify(response.body)).not.toContain('private registry'); expect(await bytes()).toEqual(before);
  });
  it('reads an active Run clone without changing the stored interrupted state', async () => {
    const stored = await run('running'); const memory = { ...stored.value, effectiveConfig: { ...stored.value.effectiveConfig, concurrency: 3 } };
    const before = await bytes(); const observed = await inspectPlanningRuntime(path, id, stored.value.basis.hash, [memory], 'fixture-provider');
    expect(observed.runtime.runs[0]).toMatchObject({ active: true, storedStatus: 'running', effectiveStatus: 'running', effectiveConfig: { concurrency: 3 } }); expect(await bytes()).toEqual(before);
  });
  it('distinguishes a new project from a missing runtime directory referenced by formal state', async () => {
    const snapshot = await readProjectSnapshotReadOnly(path);
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const change = { stage: 'product' as const, status: 'approved' as const, basis: planningInspectionBasis(snapshot), summary: 'Stored reference fixture', groups: [], evidence: [], createdAt: '2026-10-04T00:00:00Z', approvals: [] };
    snapshot.planning!.changeSets.push({ ...change, id: 'missing-approved', runId: 'run-approved' }, { ...change, id: 'ignored-migration', runId: 'migration' });
    snapshot.planning!.operations.push(...[
      `questions:run-questions-delivery-2`, `cancel:run-cancelled:4`, `proposal:change-${uuid}-delivery-3`, `feedback:arbitrary-run-text`,
    ].map(id => ({ id, fingerprint: 'fixture', revision: 1 })));
    expect(referencedPlanningRuns(snapshot)).toEqual(['run-approved', 'run-questions', 'run-cancelled', `run-${uuid}`]);
    await (engine as any).commitManager.commit(path, snapshot.metadata.stateRevision + 1, { metadata: snapshot.metadata, planning: snapshot.planning, changesets: snapshot.planning!.changeSets });
    const before = await bytes(); const data = (await request(app).get(`/api/projects/${id}/diagnostics`).expect(200)).body.data;
    expect(data.runtime.availability).toBe('partial'); expect(data.runtime.runs).toHaveLength(4);
    expect(data.runtime.runs.every((run: any) => run.effectiveStatus === 'unknown' && run.reasons.includes('run-record:ENOENT'))).toBe(true);
    expect(data.calls).toMatchObject({ incomplete: true, recordedCalls: null, usage: { totalTokens: null } });
    expect(await bytes()).toEqual(before); expect(provider.complete).not.toHaveBeenCalled();
  });
  it('history polling preserves interrupted commits and Run records without normal loaders', async () => {
    await run('running');
    await mkdir(join(path, 'state', '.commit_staging'), { recursive: true });
    await writeFile(join(path, 'state', '.commit_staging', 'partial.json'), '{partial');
    await writeFile(join(path, 'state', '.commit_marker.json'), JSON.stringify({ targetRevision: 2, status: 'preparing' }));
    const before = await bytes(); const load = vi.spyOn(engine, 'loadProject'), recover = vi.spyOn((engine as any).commitManager, 'recoverIfNeeded'), get = vi.spyOn(runtime, 'get'), list = vi.spyOn(runtime, 'list'), config = vi.spyOn(runtime, 'getConfig');
    for (let requestIndex = 0; requestIndex < 2; requestIndex++) {
      const response = await request(app).get(`/api/projects/${id}/planning/history`).expect(200); const data = response.body.data;
      expect(data.sourceStateRevision).toBe(1); expect(data.snapshot.metadata.stateRevision).toBe(1); expect(data.state).toEqual(data.snapshot.planning);
      expect(data.runs[0]).toMatchObject({ effectiveStatus: 'interrupted', storedStatus: 'running' }); expect(data.configuration).toBeUndefined(); expect(data.provider).toBeUndefined();
    }
    expect(load).not.toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled(); expect(config).not.toHaveBeenCalled(); expect(provider.complete).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it.each([undefined, 'a'.repeat(64)])('history preserves committed blueprint basis %s and labels effective Run comparisons', async (decisionBasisHash) => {
    const snapshot = await readProjectSnapshotReadOnly(path);
    const blueprint = { ...snapshot.planning!.blueprint, stages: { ...snapshot.planning!.blueprint.stages, product: 'approved' as const }, decisionBasisHash };
    await (engine as any).commitManager.commit(path, 2, { metadata: snapshot.metadata, blueprint });
    const savedBlueprint = JSON.parse(await readFile(join(path, 'state', 'revisions', '2', 'blueprint.json'), 'utf8'));
    const committed = await readProjectSnapshotReadOnly(path);
    await run('paused');
    const before = await bytes(); const load = vi.spyOn(engine, 'loadProject'), get = vi.spyOn(runtime, 'get'), list = vi.spyOn(runtime, 'list');
    const history = (await request(app).get(`/api/projects/${id}/planning/history`).expect(200)).body.data;
    const diagnostics = (await request(app).get(`/api/projects/${id}/diagnostics`).expect(200)).body.data;
    expect(history.sourceStateRevision).toBe(2); expect(history.snapshot).toEqual(committed); expect(history.state).toEqual(committed.planning);
    expect(history.state.blueprint).toEqual(savedBlueprint); expect(history.state.blueprint.stages.product).toBe('approved');
    expect(Object.hasOwn(history.state.blueprint, 'decisionBasisHash')).toBe(decisionBasisHash !== undefined);
    expect(history.basisProjection).toEqual({ ...planningInspectionBasis(committed), source: 'effective-planning-projection', materialBasis: { source: 'committed-input-refs', integrity: 'unchecked' } });
    expect(history.basisProjection.hash).not.toBe(planningBasis(committed).hash);
    expect(diagnostics.basisProjection).toEqual(history.basisProjection); expect(diagnostics.sourceStateRevision).toBe(2);
    expect(history.runs[0].basisStatus).toBe('current'); expect(diagnostics.runtime.runs[0].basisStatus).toBe('current');
    expect(load).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled(); expect(provider.complete).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('declares committed material scope when external bytes differ from the normal I/O-loaded basis', async () => {
    const committed = await readProjectSnapshotReadOnly(path), input = committed.metadata.inputRefs[0]!;
    expect(input.contentHash).toBeDefined();
    const stored = await run('paused');
    await writeFile(join(path, input.storageRef), 'Externally changed material contents.');
    const effective = await new PlanningService(engine).get(path);
    expect(effective.metadata.inputRefs[0]!.status).toBe('failed');
    expect(planningBasis(effective).hash).not.toBe(planningInspectionBasis(committed).hash);
    const before = await bytes(), load = vi.spyOn(engine, 'loadProject'), recover = vi.spyOn((engine as any).commitManager, 'recoverIfNeeded');
    const history = (await request(app).get(`/api/projects/${id}/planning/history`).expect(200)).body.data;
    const diagnostics = (await request(app).get(`/api/projects/${id}/diagnostics`).expect(200)).body.data;
    expect(history.snapshot.metadata.inputRefs).toEqual(committed.metadata.inputRefs);
    expect(history.basisProjection).toEqual({ ...stored.value.basis, source: 'effective-planning-projection', materialBasis: { source: 'committed-input-refs', integrity: 'unchecked' } });
    expect(diagnostics.basisProjection).toEqual(history.basisProjection);
    expect(history.runs[0].basisStatus).toBe('current'); expect(diagnostics.runtime.runs[0].basisStatus).toBe('current');
    expect(diagnostics.materials.items[0]).toMatchObject({ status: input.status, readable: true });
    expect(load).not.toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); expect(provider.complete).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('reads a registered historical document without recovering an interrupted commit or updating its hash', async () => {
    const snapshot = await readProjectSnapshotReadOnly(path); await mkdir(join(path, 'docs'), { recursive: true });
    await writeFile(join(path, 'docs', 'HISTORY.md'), '# Saved historical specification\nUser edit.\n');
    await (engine as any).commitManager.commit(path, 2, { metadata: snapshot.metadata, documents: { schemaVersion: 1, projectId: id, items: [{ id: 'history-document', path: 'docs/HISTORY.md', title: 'History', sourceRevision: 1, contentHash: 'a'.repeat(64) }], updatedAt: '' } });
    await mkdir(join(path, 'state', '.commit_staging'), { recursive: true }); await writeFile(join(path, 'state', '.commit_staging', 'partial.json'), '{partial'); await writeFile(join(path, 'state', '.commit_marker.json'), '{interrupted');
    const before = await bytes(); const load = vi.spyOn(engine, 'loadProject'), recover = vi.spyOn((engine as any).commitManager, 'recoverIfNeeded');
    const response = await request(app).get(`/api/projects/${id}/planning/history/documents/history-document`).expect(200);
    expect(response.body.data).toMatchObject({ content: '# Saved historical specification\nUser edit.\n', documentId: 'history-document', docPath: 'docs/HISTORY.md', sourceStateRevision: 2, sourceRevision: 1, storedContentHash: 'a'.repeat(64), historical: true, source: 'committed-legacy-document', integrity: 'unchecked' });
    await request(app).get(`/api/projects/${id}/planning/history/documents/unregistered-document`).expect(403);
    expect(load).not.toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); expect(provider.complete).not.toHaveBeenCalled(); expect(await bytes()).toEqual(before);
  });
  it('rejects registered historical document traversal and does not expose file-system messages', async () => {
    const snapshot = await readProjectSnapshotReadOnly(path); await writeFile(join(root, 'private.md'), 'Private content.');
    await (engine as any).commitManager.commit(path, 2, { metadata: snapshot.metadata, documents: { schemaVersion: 1, projectId: id, items: [{ id: 'escaping-document', path: '../private.md' }], updatedAt: '' } });
    const before = await bytes(); const response = await request(app).get(`/api/projects/${id}/planning/history/documents/escaping-document`).expect(403);
    expect(response.body.error.code).toBe('ACCESS_DENIED'); expect(JSON.stringify(response.body)).not.toContain(root); expect(JSON.stringify(response.body)).not.toContain('Private content.'); expect(await bytes()).toEqual(before);
  });
});
