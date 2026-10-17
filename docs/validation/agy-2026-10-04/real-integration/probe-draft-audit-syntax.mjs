import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const root = resolve('docs/validation/agy-2026-10-04/real-integration/flash-materials-quality-20261005-02');
const manifestBytes = await readFile(join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (!manifest.completedAt || manifest.activeCallsAtShutdown !== 0) throw new Error('Requires stopped frozen control');
const runId = manifest.qualityFeedback.runId;
const runRoot = join(root, 'project-records/runtime/planning', runId);
const run = JSON.parse(await readFile(join(runRoot, 'run.json'), 'utf8'));
const task = run.tasks.find(item => item.kind === 'design' && item.status === 'completed');
const source = `project-records/runtime/planning/${runId}/${task.outputRef}`;
const bytes = await readFile(join(root, source));
const design = JSON.parse(bytes.toString('utf8'));
const block = design.groups.flatMap(group => group.blocks).find(item => item.id === 'blk-deliv-val-security-xss-audit');
const step = block.task.steps[0];
const commandStart = step.indexOf('node -e ');
const openQuote = step.indexOf('"', commandStart);
const closeQuote = step.lastIndexOf('"');
const prefix = step.slice(commandStart, openQuote + 1);
const rawPayloadBetweenQuotes = step.slice(openQuote + 1, closeQuote);
const result = {
  label: manifest.label, checkedAt: new Date().toISOString(), status: 'needs-repair',
  scope: 'Read-only syntax inspection of exact JSON-decoded successful design result. No model result, shell command or target application executed, and no final package accepted.',
  source, sourceSha256: createHash('sha256').update(bytes).digest('hex'), taskId: task.id, blockId: block.id,
  step, commandPrefix: prefix, commandPrefixCodePoints: [...prefix].map(character => character.codePointAt(0)),
  plainDoubleQuotedCommand: prefix === 'node -e "', rawPayloadBetweenQuotes,
  rawPayloadParseSuccess: null, rawPayloadError: null, regexLiteralParses: [],
  verification: block.task.verification,
};
try { new Script(rawPayloadBetweenQuotes); result.rawPayloadParseSuccess = true; }
catch (error) { result.rawPayloadParseSuccess = false; result.rawPayloadError = String(error); }
for (const match of step.matchAll(/regex:\s*(\/[^/\n]*\/)/g)) {
  const literal = match[1], entry = { exactLiteral: literal, codePoints: [...literal].map(character => character.codePointAt(0)), parseSuccess: null, error: null };
  try { new Script(`const checked = ${literal};`); entry.parseSuccess = true; }
  catch (error) { entry.parseSuccess = false; entry.error = String(error); }
  result.regexLiteralParses.push(entry);
}
await writeFile(join(root, 'draft-decoded-audit-syntax-probe.json'), JSON.stringify(result, null, 2));
if (!manifestBytes.equals(await readFile(join(root, 'manifest.json')))) throw new Error('Frozen manifest was modified');
console.log(JSON.stringify({ label: result.label, sourceSha256: result.sourceSha256, plainDoubleQuotedCommand: result.plainDoubleQuotedCommand, rawPayloadParseSuccess: result.rawPayloadParseSuccess, rawPayloadError: result.rawPayloadError, regexLiteralParses: result.regexLiteralParses.map(item => ({ exactLiteral: item.exactLiteral, parseSuccess: item.parseSuccess, error: item.error })), verification: result.verification }));
