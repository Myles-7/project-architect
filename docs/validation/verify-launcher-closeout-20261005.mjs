import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { checkPorts, waitForServices } from '../../scripts/check-local-services.mjs';

const exec = promisify(execFile);
const root = resolve('.');
const report = { checkedAt: new Date().toISOString(), status: 'running', checks: [], providerCalls: 0, scope: 'Launcher guard and real compiled server/Vite startup on spare ports; no AI content validation.' };
const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
const hashTree = async () => {
  const hash = createHash('sha256');
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) { hash.update(path); hash.update(await readFile(path)); }
    }
  }
  await walk(join(root, '.workspace'));
  return hash.digest('hex');
};
const ps = action => exec('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/local-services.ps1'), action, '-ServerPort', '33091', '-WebPort', '35174'], { cwd: root, env: { ...process.env, PATH: `${dirname(process.execPath)};${process.env.PATH}` }, timeout: 20_000 });
let started = false;
let occupied;
try {
  const before = await hashTree();
  occupied = createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  const port = occupied.address().port;
  await assert.rejects(checkPorts([port]), /No process was stopped/);
  check('occupied port rejected and original listener remains alive', occupied.listening);
  await new Promise(resolve => occupied.close(resolve));
  await checkPorts([port, 33091, 35174]);
  check('available ports accepted and released', true);
  await assert.rejects(waitForServices(20, 33091, 35174), /startup has not been confirmed/);
  check('missing services cannot report startup success', true);
  const defaultBefore = await fetch('http://127.0.0.1:3001/api/health').then(r=>r.ok).catch(()=>false);
  await ps('start'); started = true;
  await waitForServices(30_000, 33091, 35174);
  check('real compiled server and formal Vite page become ready', true);
  const projects = await fetch('http://127.0.0.1:33091/api/projects');
  check('real project list API responds successfully', projects.ok);
  const web = await fetch('http://127.0.0.1:35174');
  check('formal frontend root available', web.ok && (await web.text()).includes('id="root"'));
  await ps('stop'); started = false;
  await checkPorts([33091, 35174]);
  check('launcher-owned services stop and spare ports are released', true);
  if (defaultBefore) check('existing default-port service remains available', await fetch('http://127.0.0.1:3001/api/health').then(r=>r.ok));
  report.workspaceHashBefore = before;
  report.workspaceHashAfter = await hashTree();
  check('original workspace bytes unchanged', before === report.workspaceHashAfter);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (occupied?.listening) await new Promise(resolve => occupied.close(resolve));
  if (started) await ps('stop').catch(error => { report.cleanupError = error.message; process.exitCode = 1; });
  await writeFile(join(root, 'docs/validation/launcher-closeout-20261005.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
