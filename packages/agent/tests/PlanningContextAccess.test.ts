import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePlanningContextAccess, readPlanningContext, planningContextReadIssues, type PlanningContextAccess } from '../src/tools/PlanningContextAccess.js';
import { PlanningToolsService } from '../src/tools/PlanningToolsService.js';
let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'pa-context-pages-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const fixture = () => ({ projectName: '测试', constraints: ['完整保留'], rawInputs: [{ id: 'feedback', raw: '甲😀\\\n'.repeat(40000) }], blueprint: { blocks: [{ id: 'approved', content: '已批准' }] }, workerResults: { draft: { groups: [{ id: 'g', blocks: [{ id: 'candidate', title: '完整候选', content: '重要接口及失败恢复'.repeat(4000), task: { goal: '可独立验收' } }], decisions: [] }], evidence: [{ id: 'e1', content: '完整来源', hash: 'abc' }], blockers: ['必须独立复核，不能机械视为未解决'] } }, taskHistory: [{ blockers: ['旧问题'], body: '旧记录'.repeat(3000) }], knownEvidence: [{ record: { id: 'old-evidence' } }] });
function entries(access: PlanningContextAccess) {
  const values: { key: string; path: string; characters: number }[] = []; let offset: number | null = 0;
  do { const result = readPlanningContext(access, { action: 'index', offset: offset!, length: 30 }); values.push(...(result as any).entries); offset = result.nextOffset; } while (offset !== null);
  return values;
}
function readAll(access: PlanningContextAccess, key: string) {
  let text = '', offset: number | null = 0;
  do { const page = readPlanningContext(access, { action: 'read', key, offset: offset!, length: 4000 }) as any; expect(Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(page) }] }))).toBeLessThanOrEqual(6000); text += page.content; offset = page.nextOffset; } while (offset !== null);
  return text;
}
describe('complete frozen planning context transport', () => {
  it('makes progress on a one-character emoji page and rejects a split surrogate offset', () => {
    const { access } = preparePlanningContextAccess(JSON.stringify({ text: '😀' }), root, 'unicode');
    const page = readPlanningContext(access, { action: 'read', key: 'c0', offset: 1, length: 1 }) as any;
    expect(page.content).toBe('😀'); expect(page.nextOffset).toBe(3);
    expect(() => readPlanningContext(access, { action: 'read', key: 'c0', offset: 2, length: 1 })).toThrow('Unicode boundary');
  });
  it('escapes every JSON Pointer segment and distinguishes real @structure keys from generated parent metadata', () => {
    const { access } = preparePlanningContextAccess(JSON.stringify({ 'a/b~c': { '@structure': '真实值', giant: '甲'.repeat(7000) } }), root, 'pointer');
    const indexed = entries(access); expect(new Set(indexed.map(item => item.path)).size).toBe(indexed.length);
    const item = indexed.find(entry => entry.path === '/a~1b~0c/@structure')!;
    expect(JSON.parse(readAll(access, item.key))).toBe('真实值');
  });
  it('retains every byte beyond the prior CLI cutoff, pages Unicode safely and accounts for all mandatory review reads', async () => {
    const text = JSON.stringify(fixture(), null, 2), prepared = preparePlanningContextAccess(text, root, 'review-1');
    expect(text.length).toBeGreaterThan(200000); expect(await readFile(prepared.access.sourcePath, 'utf8')).toBe(text);
    expect(JSON.stringify(prepared.overview).length).toBeLessThan(2000);
    const indexed = entries(prepared.access), raw = indexed.find(item => item.path.endsWith('/raw'))!;
    expect(JSON.parse(readAll(prepared.access, raw.key))).toBe(fixture().rawInputs[0]!.raw);
    expect(planningContextReadIssues(prepared.access).length).toBeGreaterThan(0);
    indexed.filter(item => prepared.access.requiredKeys.includes(item.key)).forEach(item => readAll(prepared.access, item.key));
    expect(planningContextReadIssues(prepared.access)).toEqual([]);
    expect(prepared.access.requiredKeys.length).toBeLessThan(indexed.length); // history stays retrievable
    const candidate = indexed.find(item => item.path.endsWith('/blocks/0/content'))!;
    expect(JSON.parse(readAll(prepared.access, candidate.key))).toBe(fixture().workerResults.draft.groups[0]!.blocks[0]!.content);
  });
  it('does not accept only the last page or noncontiguous reads as a complete review', () => {
    const { access } = preparePlanningContextAccess(JSON.stringify(fixture()), root, 'review-gap');
    const raw = entries(access).find(item => item.path.endsWith('/raw'))!;
    readPlanningContext(access, { action: 'read', key: raw.key, offset: raw.characters - 10, length: 10 });
    expect(planningContextReadIssues(access)).toContain(`${raw.key} ${raw.path}`);
    readPlanningContext(access, { action: 'read', key: raw.key, offset: 0, length: 10 });
    expect(planningContextReadIssues(access)).toContain(`${raw.key} ${raw.path}`);
  });
  it('rejects modified frozen source or index, unknown keys, arbitrary paths and invalid ranges', async () => {
    const { access } = preparePlanningContextAccess(JSON.stringify(fixture()), root, 'integrity');
    expect(() => readPlanningContext(access, { action: 'read', key: '../../secret' })).toThrow('Unknown');
    expect(() => readPlanningContext(access, { action: 'read', key: 'c0', offset: -1 })).toThrow('offset');
    expect(() => readPlanningContext(access, { action: 'read', key: 'c0', length: 4001 })).toThrow('range');
    const bytes = await readFile(access.entriesPath); await writeFile(access.entriesPath, '[]');
    expect(() => readPlanningContext(access, { action: 'index' })).toThrow('index was modified');
    await writeFile(access.entriesPath, bytes); await writeFile(access.sourcePath, '{}');
    expect(() => planningContextReadIssues(access)).toThrow('context was modified');
  });
  it('isolates successive invocations and never inherits the prior invocation read receipt', () => {
    const text = JSON.stringify(fixture()), first = preparePlanningContextAccess(text, root, 'attempt-1');
    entries(first.access).filter(item => first.access.requiredKeys.includes(item.key)).forEach(item => readAll(first.access, item.key));
    expect(planningContextReadIssues(first.access)).toEqual([]);
    const second = preparePlanningContextAccess(text, root, 'attempt-2');
    expect(second.access.readsPath).not.toBe(first.access.readsPath);
    expect(planningContextReadIssues(second.access).length).toBeGreaterThan(0);
  });
  it('exposes only registered indexed context through the MCP service without turning it into new evidence', async () => {
    const { access } = preparePlanningContextAccess(JSON.stringify({ currentDraft: { groups: [] }, rawInputs: [] }), root, 'design');
    expect(access.requiredKeys).toEqual([]);
    const service = new PlanningToolsService({ materialRoots: [], materials: [], experimentRoot: join(root, 'experiments'), evidenceRoot: join(root, 'evidence'), contextAccess: access });
    const result = await service.readContext({ action: 'read', key: 'c0' });
    expect(result.contextSha256).toBe(access.sourceSha256);
    expect((await service.materialIndex())).toEqual([]);
    const audit = await readFile(join(root, 'evidence', 'tool-events.ndjson'), 'utf8'); expect(audit).toContain('planning_context'); expect(audit).not.toContain('evidence_record');
  });
  it('never records a successful read when the MCP tool audit failed before returning content', async () => {
    const { access } = preparePlanningContextAccess(JSON.stringify({ workerResults: { draft: { groups: [] } }, constraints: '不可跳过' }), root, 'audit-failure');
    const auditPath = join(root, 'not-a-directory'); await writeFile(auditPath, '阻止日志目录创建');
    const service = new PlanningToolsService({ materialRoots: [], materials: [], experimentRoot: join(root, 'experiments'), evidenceRoot: auditPath, contextAccess: access });
    for (const key of access.requiredKeys) await expect(service.readContext({ action: 'read', key })).rejects.toThrow();
    expect((await readFile(access.readsPath, 'utf8')).trim()).toBe('');
    expect(planningContextReadIssues(access).length).toBe(access.requiredKeys.length);
  });
});
