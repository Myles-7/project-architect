import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { DocumentCompiler, FileStorage, MermaidGenerator, ProjectStateEngine, SpecDriftAuditor, WorkspaceGuard, planningBasis } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import { createApp } from '../src/server.js';
import { PlanningRuntime } from '../src/planning/PlanningRuntime.js';
import { group } from '../../../tests/fixtures/planning.mjs';

const roots: string[] = [], runtimes: PlanningRuntime[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const runtime of runtimes.splice(0)) await runtime.shutdown(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function bytes(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) for (const [key, value] of Object.entries(await bytes(join(directory, entry.name)))) files[`${entry.name}/${key}`] = value;
    else files[entry.name] = (await readFile(join(directory, entry.name))).toString('base64');
  } return files;
}
async function setup(mode: 'production' | 'mock' | 'injected') {
  const root = await mkdtemp(join(tmpdir(), 'pa-tools-retired-')); roots.push(root);
  const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
  const provider = new MockAIProvider(), runtime = new PlanningRuntime(engine, provider); runtimes.push(runtime);
  const orchestrator = mode === 'injected' ? new AIOrchestrator(provider, engine, process.cwd()) : undefined;
  const app = createApp({ workspaceRoot: root, engine, planningRuntime: runtime, useMockAI: mode === 'mock', ...(orchestrator ? { orchestrator } : {}) });
  const created = await request(app).post('/api/projects').send({ name: 'Retirement', idea: 'Protect project state' }).expect(200);
  const id = created.body.data.projectId, path = join(root, 'projects', id);
  return { root, engine, provider, runtime, orchestrator, app, id, path };
}
describe.each(['production', 'mock', 'injected'] as const)('Legacy tools retirement in %s mode', (mode) => {
  it('returns 410 before project resolution, body parsing, scanning, Provider calls or state writes', async () => {
    const { root, engine, provider, runtime, app, id } = await setup(mode);
    const spies = [vi.spyOn(engine, 'loadProject'), vi.spyOn(engine, 'getSnapshot'), vi.spyOn(engine, 'evaluateReadiness'), vi.spyOn(engine, 'setUserDisposition'), vi.spyOn(provider, 'complete'), vi.spyOn(runtime, 'get'), vi.spyOn(runtime, 'list'), vi.spyOn(MermaidGenerator, 'generateDiagrams'), vi.spyOn(SpecDriftAuditor, 'audit')];
    const before = await bytes(root);
    for (const projectId of [id, 'missing-project', 'bad%2Fid']) {
      for (const route of ['readiness/review', 'readiness/approve', 'verify-drift']) {
        for (const body of ['{broken-json', JSON.stringify({ expectedRevision: -1, disposition: 'approved', path: 'C:/private', operationId: 'repeat' })]) {
          const response = await request(app).post(`/api/projects/${projectId}/${route}`).set('Content-Type', 'application/json').send(body).expect(410);
          expect(response.body).toMatchObject({ success: false, error: { code: 'LEGACY_WORKFLOW_RETIRED', recoverable: false } });
          expect(response.body.stateRevision).toBeUndefined(); expect(response.body.data).toBeUndefined();
        }
      }
      const response = await request(app).get(`/api/projects/${projectId}/diagrams`).expect(410);
      expect(response.body.error.code).toBe('LEGACY_WORKFLOW_RETIRED');
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled(); expect(await bytes(root)).toEqual(before);
  });
  it('generates documents from approved planning and never reapproves historical readiness', async () => {
    const { engine, runtime, app, id, path, orchestrator } = await setup(mode);
    for (const stage of ['product', 'technical', 'delivery'] as const) {
      let snapshot = await runtime.service.get(path);
      snapshot = await runtime.service.propose(path, { id: `tools-${stage}`, runId: 'run-fixture', stage, basis: planningBasis(snapshot), summary: 'Reviewed fixture', groups: [group(stage)], evidence: [], status: 'pending', createdAt: new Date().toISOString(), approvals: [] });
      await runtime.service.approve(path, `tools-${stage}`, { operationId: `approve-${stage}`, expectedRevision: snapshot.metadata.stateRevision, groupIds: [`${stage}-group`] });
    }
    const snapshot = await runtime.service.get(path), readiness = structuredClone(snapshot.readiness);
    const disposition = vi.spyOn(engine, 'setUserDisposition'), oldCompiler = vi.spyOn(DocumentCompiler.prototype, 'compile');
    const oldPublish = orchestrator && vi.spyOn(orchestrator, 'compileDocuments');
    const generated = await request(app).post(`/api/projects/${id}/documents/generate`).send({ expectedRevision: snapshot.metadata.stateRevision, operationId: 'package-tools', autoReApprove: true }).expect(200);
    expect(generated.body.data.manifest.directory).toMatch(/^artifacts\/packages\//); expect(generated.body.data.snapshot.readiness).toEqual(readiness);
    expect(disposition).not.toHaveBeenCalled(); expect(oldCompiler).not.toHaveBeenCalled(); if (oldPublish) expect(oldPublish).not.toHaveBeenCalled();
    const before = await bytes(path); const repeat = await request(app).post(`/api/projects/${id}/documents/generate`).send({ expectedRevision: snapshot.metadata.stateRevision, operationId: 'package-tools' }).expect(200);
    expect(repeat.body.stateRevision).toBe(generated.body.stateRevision); expect(await bytes(path)).toEqual(before);
  });
});
it('exports saved historical documents without inferring new Mermaid architecture', async () => {
  const { engine, app, id, path } = await setup('production');
  const snapshot = await engine.getSnapshot(path); await writeFile(join(path, 'AGENTS.md'), '# Saved user specification\n');
  await (engine as any).commitManager.commit(path, snapshot.metadata.stateRevision + 1, { metadata: snapshot.metadata, documents: { schemaVersion: 1, projectId: id, items: [{ id: 'saved', path: 'AGENTS.md', title: 'Saved specification', status: 'generated' }], updatedAt: '' } });
  const generate = vi.spyOn(MermaidGenerator, 'generateDiagrams'); const response = await request(app).get(`/api/projects/${id}/documents/export-html`).expect(200);
  expect(response.text).toContain('Saved user specification'); expect(generate).not.toHaveBeenCalled();
});
it('pa verify fails explicitly without importing or scanning the given project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pa-cli-retired-')); roots.push(root); await writeFile(join(root, 'private.json'), '{broken'); const before = await bytes(root);
  try { execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'pa.mjs'), 'verify', root], { encoding: 'utf8', stdio: 'pipe' }); throw new Error('retired CLI unexpectedly succeeded'); }
  catch (error: any) { expect(error.status).toBe(1); expect(error.stderr).toContain('LEGACY_WORKFLOW_RETIRED'); }
  expect(await bytes(root)).toEqual(before);
});
