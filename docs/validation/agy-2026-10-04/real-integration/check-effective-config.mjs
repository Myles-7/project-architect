import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../../../../apps/server/dist/server.js';
import { DEFAULT_PLANNING_CONFIG } from '../../../../packages/contracts/dist/index.js';
import { FileStorage } from '../../../../packages/core/dist/index.js';

const workspace = await mkdtemp(join(tmpdir(), 'pa-flash-config-'));
const chosen = { ...DEFAULT_PLANNING_CONFIG, designModel: 'gemini-3.8-flash-high', reviewModel: 'gemini-3.8-flash-high' };
const evidence = { startedAt: new Date().toISOString(), node: process.version, workspace, chosen, checks: [] };
async function serve(action) {
  const server = createApp({ workspaceRoot: workspace }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { return await action(`http://127.0.0.1:${server.address().port}/api`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
async function api(base, route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.equal(response.ok, true, JSON.stringify(result)); assert.equal(result.success, true);
  return result.data;
}
const id = await serve(async base => {
  const project = await api(base, '/projects', 'POST', { name: '显式 Flash 配置验收', idea: '只验证配置，不启动规划。' });
  const result = await api(base, `/projects/${project.projectId}/planning/config`, 'PUT', chosen);
  assert.deepEqual(result, chosen); evidence.checks.push('HTTP PUT effective preferences equal authorized configuration');
  const disk = JSON.parse(await readFile(join(workspace, 'planning-config.json'), 'utf8'));
  assert.deepEqual(disk, chosen); evidence.checks.push('saved preferences equal HTTP response');
  return project.projectId;
});
await serve(async base => {
  const result = await api(base, `/projects/${id}/planning/config`);
  assert.deepEqual(result, chosen); evidence.checks.push('fresh server HTTP GET reloads exact saved configuration');
});

const target = resolve('.workspace/planning-config.json');
let existing;
try { existing = JSON.parse(await readFile(target, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(existing, undefined, 'Preserve an existing preference file; do not silently overwrite it');
await new FileStorage().writeJson(target, chosen);
assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), chosen);
evidence.checks.push('new explicit local-workspace override atomically persisted; existing projects unchanged');
evidence.appliedFile = target; evidence.status = 'passed'; evidence.completedAt = new Date().toISOString();
await writeFile(resolve('docs/validation/agy-2026-10-04/real-integration/effective-flash-config.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
