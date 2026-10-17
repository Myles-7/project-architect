import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { AntigravityCliProvider } from '../../../../packages/agent/dist/provider/AntigravityCliProvider.js';
import { preparePlanningWorkspace } from '../../../../packages/agent/dist/tools/PlanningToolsMcpServer.js';
import { planningContextReadIssues } from '../../../../packages/agent/dist/tools/PlanningContextAccess.js';
process.env.PATH = dirname(process.execPath) + ';' + process.env.PATH;
const label = process.argv[2], model = process.argv[3];
if (!/^[a-z0-9-]+$/.test(label ?? '') || !model) throw new Error('Unique label and explicit model required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
await mkdir(root); const marker = randomBytes(12).toString('hex');
const stress = process.argv.includes('stress-escaping');
const source = { projectName: '完整上下文传输能力验证', constraints: '只读测试，不是正式需求或批准', rawInputs: [{ id: 'input-opaque', raw: (stress ? '甲😀\\"\n\t'.repeat(1500) : '这是合成输入。'.repeat(1000)) + '\n末尾唯一验证码：' + marker }], workerResults: { draft: { summary: '核对原文末尾验证码', groups: [{ id: 'pending', blocks: [{ id: 'candidate', content: '这是未批准候选，不能自动成为正式事实。' }] }], blockers: [] } }, taskHistory: [{ historicalOnly: '历史只用于追溯，不应作为当前未解决问题。'.repeat(15000) }] };
const text = JSON.stringify(source, null, 2);
await writeFile(join(root, 'expected-input.json'), text);
const schemaPath = join(root, 'schema.json');
await writeFile(schemaPath, JSON.stringify({ type: 'object', properties: { observedMarker: { type: 'string' }, draftApproved: { type: 'boolean' }, readScope: { type: 'string' } }, required: ['observedMarker', 'draftApproved', 'readScope'], additionalProperties: false }));
await preparePlanningWorkspace({ materialRoots: [], materials: [], experimentRoot: join(root, 'experiments'), evidenceRoot: join(root, 'evidence') }, root);
const startedAt = new Date().toISOString(), provider = new AntigravityCliProvider();
const result = await provider.complete({ requestId: `${label}-actual`, task: 'planning-task', cwd: root, model, schemaPath, allowedTools: ['mcp_project_architect_planning_context'], logPath: join(root, 'stream.ndjson'), contextText: text,
  prompt: '这是一次真实只读完整上下文传输验证。RUNTIME CONTEXT是索引而不是全文，先用planning_context action=index列出各必需section，再逐条action=read完全读完每条的所有页，直到nextOffset为null。独立评审必须读完所有requiredForReview项，否则finish被拒绝。taskHistory是可检索历史，不是本次必需记录。不要调用其他工具或读取文件。最终返回rawInputs[0].raw末尾的唯一验证码observedMarker，按候选实际状态填写draftApproved，readScope简述真实读取范围；验证码没有在此提示词给出，不能猜。' });
const config = JSON.parse(await readFile(join(root, '.agents', 'planning-tools.json'), 'utf8'));
const missing = planningContextReadIssues(config.contextAccess);
const streamed = (await readFile(join(root, 'stream.ndjson'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(event => event.stream === 'stdout').map(event => event.data).join('');
const observations = [];
for (const line of streamed.split('\n').filter(Boolean)) { let event; try { event = JSON.parse(line); } catch { continue; }
  const step = event.step_update;
  if (step?.state !== 'DONE' || step.tool_name !== 'call_mcp_tool' || step.tool_info?.parameters?.ToolName !== 'planning_context') continue;
  const output = step.tool_info.output; let returned; try { returned = JSON.parse(output); } catch { returned = null; }
  observations.push({ stepIndex: step.step_index, action: step.tool_info.parameters.Arguments?.action, outputBytes: Buffer.byteLength(output ?? ''), directlyVisibleJSON: !!returned, returned });
}
const entries = JSON.parse(await readFile(config.contextAccess.entriesPath, 'utf8'));
const observationMissing = entries.filter(entry => config.contextAccess.requiredKeys.includes(entry.key)).filter(entry => {
  let end = 0;
  const pages = observations.filter(item => item.action === 'read' && item.returned?.key === entry.key && item.returned.contextSha256 === config.contextAccess.sourceSha256 && item.returned.sha256 === entry.sha256).map(item => item.returned).sort((a,b) => a.offset - b.offset);
  for (const page of pages) { if (page.offset > end || page.content !== entry.content.slice(page.offset, page.offset + page.content.length)) break; end = Math.max(end, page.offset + page.content.length); }
  return end < entry.characters;
}).map(entry => entry.key);
await writeFile(join(root, 'visible-tool-output-observations.json'), JSON.stringify({ observations, missingMandatoryVisibleRanges: observationMissing, proofScope: 'Actual DONE tool-info output text contained complete JSON pages, not an offload URI; this is transport evidence, not model comprehension.' }, null, 2));
const report = { label, model, startedAt, completedAt: new Date().toISOString(), inputUtf8Bytes: Buffer.byteLength(text), inputSha256: createHash('sha256').update(text).digest('hex'), actualProviderResult: result, contextSha256: config.contextAccess.sourceSha256, missingRequiredReads: missing,
  escapingStress: stress, visibleToolOutputObservations: observations.length, missingMandatoryVisibleRanges: observationMissing,
  passed: result.structuredSuccess && result.structuredOutput.observedMarker === marker && result.structuredOutput.draftApproved === false && missing.length === 0 && observationMissing.length === 0,
  limitation: 'Actual model invocation and complete required read ranges prove transport/observed marker for this synthetic probe, not semantic quality of a full user plan or review comprehension.' };
await writeFile(join(root, 'result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ label, model, passed: report.passed, inputUtf8Bytes: report.inputUtf8Bytes, durationMs: result.durationMs, error: result.stderr, missing: missing.length }));
if (!report.passed) process.exitCode = 1;
