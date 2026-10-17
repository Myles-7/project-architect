import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { planningContextReadIssues } from '../../../../packages/agent/dist/tools/PlanningContextAccess.js';

// Inspect frozen copies and actual stream responses, never invoke a Provider.
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Completed control label required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const manifestBytes = await readFile(join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0) throw new Error('Requires frozen completed control');
const frozen = original => {
  const part = relative(manifest.path, original);
  if (part.startsWith('..') || isAbsolute(part)) throw new Error(`Not a recorded project artifact: ${original}`);
  return join(root, 'project-records', part);
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewTasks = new Map();
for (const record of manifest.runs) {
  const run = JSON.parse(await readFile(join(root, 'project-records/runtime/planning', record.id, 'run.json'), 'utf8'));
  for (const task of run.tasks.filter(task => task.kind === 'review' && task.status === 'completed')) reviewTasks.set(`${task.id}-${task.attempts}`, { runId: run.id, taskId: task.id });
}
const reports = [];
for (const call of manifest.providerCalls.filter(call => call.status === 'success' && reviewTasks.has(call.requestId))) {
  const config = JSON.parse(await readFile(join(frozen(call.cwd), '.agents/planning-tools.json'), 'utf8'));
  const access = { ...config.contextAccess };
  for (const key of ['sourcePath', 'entriesPath', 'readsPath']) access[key] = frozen(access[key]);
  const ledgerMissing = planningContextReadIssues(access);
  const entries = JSON.parse(await readFile(access.entriesPath, 'utf8'));
  const log = await readFile(frozen(call.logPath), 'utf8');
  const observations = [], visible = [];
  for (const line of log.split('\n').filter(Boolean)) {
    const chunk = JSON.parse(line);
    if (chunk.stream !== 'stdout') continue;
    for (const part of chunk.data.split('\n').filter(Boolean)) {
      let event; try { event = JSON.parse(part); } catch { continue; }
      const step = event.step_update;
      if (step?.state !== 'DONE' || step.tool_name !== 'call_mcp_tool' || step.tool_info?.parameters?.ToolName !== 'planning_context') continue;
      let output; try { output = JSON.parse(step.tool_info.output); } catch {}
      const action = step.tool_info.parameters.Arguments?.action;
      observations.push({ action, directlyVisibleJSON: Boolean(output), outputBytes: Buffer.byteLength(step.tool_info.output ?? '') });
      if (Array.isArray(output?.parts)) visible.push(...output.parts.map(value => ({ ...value, contextSha256: output.contextSha256 })));
      else if (action === 'read' && output?.key) visible.push(output);
    }
  }
  const required = new Set(access.requiredKeys);
  const missingVisible = entries.filter(entry => required.has(entry.key)).filter(entry => {
    let end = 0;
    const ranges = visible.filter(value => value.key === entry.key && value.sha256 === entry.sha256 && value.contextSha256 === access.sourceSha256 && Number.isInteger(value.offset) && value.offset >= 0 && typeof value.content === 'string').sort((a, b) => a.offset - b.offset);
    for (const range of ranges) {
      if (range.offset > end || range.content !== entry.content.slice(range.offset, range.offset + range.content.length)) break;
      end = Math.max(end, range.offset + range.content.length);
    }
    return end < entry.characters;
  }).map(entry => ({ key: entry.key, path: entry.path }));
  reports.push({ ...reviewTasks.get(call.requestId), requestId: call.requestId, contextSha256: access.sourceSha256, streamSha256: digest(log), requiredRecords: access.requiredKeys.length, ledgerMissing, missingVisible, observations, status: access.requiredKeys.length && !ledgerMissing.length && !missingVisible.length ? 'passed' : 'failed' });
}
const result = { label, checkedAt: new Date().toISOString(), status: reports.length && reports.every(report => report.status === 'passed') ? 'passed' : 'failed', scope: 'New successful independent review calls: exact raw visible character coverage and ledger integrity from frozen artifacts. Does not prove understanding, content acceptance, image inspection or human approval.', reports, sourceManifestUnchanged: manifestBytes.equals(await readFile(join(root, 'manifest.json'))) };
if (!result.sourceManifestUnchanged) result.status = 'failed';
await writeFile(join(root, 'final-visible-context-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ label, status: result.status, reviews: reports.map(({ requestId, requiredRecords, ledgerMissing, missingVisible, status }) => ({ requestId, requiredRecords, ledgerMissing: ledgerMissing.length, missingVisible: missingVisible.length, status })) }));
if (result.status !== 'passed') process.exitCode = 1;
