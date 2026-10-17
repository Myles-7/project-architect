import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePlanningToolGate } from '../src/tools/PlanningToolGate.js';
import { preparePlanningContextAccess, readPlanningContext } from '../src/tools/PlanningContextAccess.js';
let root: string | undefined;
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = undefined; });
describe('planning native tool gate', () => {
  it('blocks review finish until every mandatory frozen entry is fully read and fails closed on tampering', async () => {
    root = await mkdtemp(join(tmpdir(), 'pa-context-gate-'));
    const { access } = preparePlanningContextAccess(JSON.stringify({ constraints: '完整', workerResults: { draft: { groups: [] } } }), root, 'review');
    const gate = preparePlanningToolGate(root, ['mcp_project_architect_planning_context'], [], [], access);
    const finish = () => { const result = spawnSync(process.execPath, [gate.scriptPath], { input: JSON.stringify({ toolCall: { name: 'finish' } }), encoding: 'utf8' }); expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout); };
    expect(finish().reason).toContain('INCOMPLETE_REVIEW_CONTEXT');
    for (const key of access.requiredKeys) readPlanningContext(access, { action: 'read', key });
    expect(finish().decision).toBe('allow');
    await writeFile(access.sourcePath, '{}'); expect(finish().decision).toBe('deny');
  });
  it('hard-denies subagents, filesystem edits, shell commands and unregistered MCP servers', async () => { root = await mkdtemp(join(tmpdir(), 'pa-gate-')); const gate = preparePlanningToolGate(root, ['mcp_project_architect_material_read']); const run = (name: string, args = {}) => JSON.parse(spawnSync(process.execPath, [gate.scriptPath], { input: JSON.stringify({ toolCall: { name, args } }), encoding: 'utf8' }).stdout); for (const tool of ['invoke_subagent', 'browser_subagent', 'define_subagent', 'run_command', 'write_to_file', 'view_file', 'search_web']) expect(run(tool).decision).toBe('deny'); expect(run('call_mcp_tool', { ServerName: 'evil', ToolName: 'material_read' }).decision).toBe('deny'); expect(run('call_mcp_tool', { ServerName: 'project_architect', ToolName: 'material_read' }).decision).toBe('allow'); expect(run('call_mcp_tool', { ServerName: 'project_architect', ToolName: 'run_command' }).decision).toBe('deny'); expect(run('finish').decision).toBe('allow'); expect((await readFile(gate.auditPath, 'utf8')).split('\n').filter(Boolean)).toHaveLength(11); });
  it('allows the exact registered real image and denies other files including a redirected path', async () => { root = await mkdtemp(join(tmpdir(), 'pa-image-gate-')); const materials = join(root, 'materials'); await mkdir(materials); const image = join(materials, 'opaque.png'); const outside = join(root, 'secret.png'); const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=', 'base64'); await writeFile(image, png); await writeFile(outside, png); const gate = preparePlanningToolGate(root, [], [image], [materials]); const run = (path: string) => JSON.parse(spawnSync(process.execPath, [gate.scriptPath], { input: JSON.stringify({ toolCall: { name: 'view_file', args: { AbsolutePath: path } } }), encoding: 'utf8' }).stdout); expect(run(image).decision).toBe('allow'); expect(run(outside).decision).toBe('deny'); expect(() => preparePlanningToolGate(root, [], [outside], [materials])).toThrow('escapes'); await rm(image); let redirected = false; try { await symlink(outside, image, 'file'); redirected = true; } catch { /* Windows without symlink privilege still covers canonical root containment. */ } if (redirected) expect(run(image).decision).toBe('deny'); });
});
