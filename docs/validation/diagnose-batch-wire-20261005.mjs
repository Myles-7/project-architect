import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readPlanningContext } from '../../packages/agent/.validation/context-batch-build-20261005/tools/PlanningContextAccess.js';

const directory = resolve('docs/validation/agy-2026-10-04/real-integration', process.argv[2] ?? 'flash-context-batch-real-20261005-01');
const config = JSON.parse(await readFile(join(directory, '.agents', 'planning-tools.json'), 'utf8'));
const rows = [];
for (const line of (await readFile(join(directory, 'stream.ndjson'), 'utf8')).split('\n').filter(Boolean)) {
  const chunk = JSON.parse(line);
  if (chunk.stream !== 'stdout') continue;
  for (const text of chunk.data.split('\n').filter(Boolean)) {
    let event;
    try { event = JSON.parse(text); } catch { continue; }
    const step = event.step_update;
    if (step?.state !== 'DONE' || step.tool_name !== 'call_mcp_tool' || step.tool_info?.parameters?.ToolName !== 'planning_context') continue;
    let input = step.tool_info.parameters.Arguments;
    if (typeof input === 'string') input = JSON.parse(input);
    const value = readPlanningContext(config.contextAccess, input, false);
    const compact = JSON.stringify(value), pretty = JSON.stringify(value, null, 2);
    const mcpWire = JSON.stringify({ content: [{ type: 'text', text: compact }] });
    rows.push({ step: step.step_index, input, records: value.parts?.length, compactBytes: Buffer.byteLength(compact), prettyBytes: Buffer.byteLength(pretty), mcpWireBytes: Buffer.byteLength(mcpWire), visibleBytes: Buffer.byteLength(step.tool_info.output ?? ''), exactCompact: step.tool_info.output === compact, exactPretty: step.tool_info.output === pretty });
  }
}
await writeFile(join(directory, 'wire-size-diagnosis.json'), JSON.stringify({ checkedAtUTC: new Date().toISOString(), scope: 'Read-only deterministic replay using the isolated build that produced this probe. No provider calls or ledger writes.', rows }, null, 2));
for (const row of rows) console.log(JSON.stringify(row));
