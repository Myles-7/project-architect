import { readFile, writeFile, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';

const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Frozen evidence label required');
const root = resolve('docs/validation/agy-2026-10-04/real-integration', label);
const manifestBytes = await readFile(join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0) throw new Error('Control must be completed and stopped');
const suffix = manifest.packages.at(-1).labelSuffix;
const file = `${suffix}-development-package/tasks.json`;
const taskBytes = await readFile(join(root, file));
const task = JSON.parse(taskBytes.toString('utf8')).tasks.find(item => item.id === 'blk-deliv-val-security-xss-audit');
const step = task?.steps?.[0];
const command = step?.match(/\bnode\s+-e\s+"([\s\S]*?)"(?:[；;]|$)/)?.[1];
const result = {
  label, checkedAt: new Date().toISOString(), packageSuffix: suffix,
  kind: 'Exact JSON-decoded exported Node -e payload; syntax parsing and child Node execution on isolated synthetic app.js fixtures. No planned target application executed.',
  file, sha256: createHash('sha256').update(taskBytes).digest('hex'), taskId: task?.id, step, command,
  tested: false, parseSuccess: null, executionChecks: [], coreExecutionPass: null, whitespaceVariantPass: null,
  status: 'not-tested', error: null,
};
let directory;
try {
  if (!command) throw new Error('No supported exact decoded Node -e payload found; manually inspect the actual exported audit format');
  if (command.includes('"')) throw new Error('Payload contains shell quoting that requires separate explicit decoding; refuse approximate execution');
  new Script(command, { filename: 'exact-exported-audit-payload.js' });
  result.parseSuccess = true;
  if (process.argv[3] !== '--execute-reviewed') throw new Error('Read and inspect the exact decoded command, then pass --execute-reviewed to execute it on synthetic fixtures');
  directory = await mkdtemp(join(tmpdir(), 'pa-decoded-audit-'));
  const fixtures = [
    { name: 'innerHTML sink', code: 'target.innerHTML = userInput;', expectedExit: 1, core: true },
    { name: 'outerHTML sink', code: 'target.outerHTML = userInput;', expectedExit: 1, core: true },
    { name: 'document.write sink', code: 'document.write(userInput);', expectedExit: 1, core: true },
    { name: 'eval call', code: 'eval(userInput);', expectedExit: 1, core: true },
    { name: 'Function constructor', code: 'new Function(userInput);', expectedExit: 1, core: true },
    { name: 'safe text binding', code: 'target.textContent = userInput;', expectedExit: 0, core: true },
    { name: 'safe renderer', code: 'function render(name) { display.textContent = name; }', expectedExit: 0, core: true },
    { name: 'whitespace before document.write arguments', code: 'document.write (userInput);', expectedExit: 1, core: false },
    { name: 'whitespace before eval arguments', code: 'eval (userInput);', expectedExit: 1, core: false },
    { name: 'whitespace before Function arguments', code: 'new Function (userInput);', expectedExit: 1, core: false },
  ];
  result.tested = true;
  for (const fixture of fixtures) {
    await writeFile(join(directory, 'app.js'), fixture.code);
    const execution = spawnSync(process.execPath, ['-e', command], { cwd: directory, encoding: 'utf8', windowsHide: true });
    result.executionChecks.push({ ...fixture, actualExit: execution.status, stdout: execution.stdout, stderr: execution.stderr, signal: execution.signal, error: execution.error && String(execution.error), pass: execution.status === fixture.expectedExit });
  }
  result.coreExecutionPass = result.executionChecks.filter(check => check.core).every(check => check.pass);
  result.whitespaceVariantPass = result.executionChecks.filter(check => !check.core).every(check => check.pass);
  result.status = result.coreExecutionPass && result.whitespaceVariantPass ? 'passed-synthetic-audit-execution' : 'needs-repair';
} catch (error) {
  result.error = String(error);
  if (result.parseSuccess === null && command) result.parseSuccess = false;
  result.status = result.parseSuccess === false ? 'invalid-syntax' : 'not-tested';
} finally {
  if (directory) {
    await rm(join(directory, 'app.js'), { force: true });
    await rmdir(directory);
  }
}
await writeFile(join(root, 'decoded-audit-command-probe.json'), JSON.stringify(result, null, 2));
if (!manifestBytes.equals(await readFile(join(root, 'manifest.json')))) throw new Error('Frozen manifest changed during probe');
console.log(JSON.stringify(result, null, 2));
