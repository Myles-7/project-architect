import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Frozen completed evidence label required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const bytes = await readFile(join(root, 'manifest.json'));
const manifest = JSON.parse(bytes.toString('utf8'));
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0) throw new Error('Control must be completed and stopped');
const suffix = manifest.packages.at(-1).labelSuffix;
const file = `${suffix}-development-package/tasks.json`;
const taskBytes = await readFile(join(root, file)), data = JSON.parse(taskBytes.toString('utf8'));
const task = data.tasks.find(item => item.id === 'blk-deliv-val-security-xss-audit');
const step = task?.steps?.[0];
const pattern = step?.match(/`([^`]+)`/)?.[1];
const result = { label, packageSuffix: suffix, kind: 'Exact decoded exported audit pattern parsing and execution on explicitly synthetic source snippets; no emitted shell command or target application executed', file, sha256: createHash('sha256').update(taskBytes).digest('hex'), taskId: task?.id, step, pattern, patternCodePoints: pattern && [...pattern].map(character => character.codePointAt(0)), tested: false, parseSuccess: null, executionChecks: [], executionPass: null, error: null };
if (pattern) {
  result.tested = true;
  try {
    const regex = new RegExp(pattern); result.parseSuccess = true;
    const snippets = [
      { name: 'innerHTML sink', code: 'target.innerHTML = userInput;', expectedMatch: true },
      { name: 'outerHTML sink', code: 'target.outerHTML = userInput;', expectedMatch: true },
      { name: 'document.write sink', code: 'document.write(userInput);', expectedMatch: true },
      { name: 'eval call', code: 'eval(userInput);', expectedMatch: true },
      { name: 'Function constructor', code: 'new Function(userInput);', expectedMatch: true },
      { name: 'safe text binding', code: 'target.textContent = userInput;', expectedMatch: false },
      { name: 'safe renderer', code: 'function render(name) { display.textContent = name; }', expectedMatch: false }
    ];
    result.executionChecks = snippets.map(snippet => ({ ...snippet, actualMatch: regex.test(snippet.code) }));
    result.executionPass = result.executionChecks.every(check => check.expectedMatch === check.actualMatch);
  }
  catch (error) { result.parseSuccess = false; result.error = String(error); }
}
await writeFile(join(root, 'decoded-audit-probe.json'), JSON.stringify(result, null, 2));
if (!bytes.equals(await readFile(join(root, 'manifest.json')))) throw new Error('Frozen manifest changed during read-only probe');
console.log(JSON.stringify(result, null, 2));
