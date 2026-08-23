#!/usr/bin/env node
/**
 * Minimal subprocess PoC. No SDKs, credentials, shell automation, or config access.
 * Usage: node test-antigravity-provider.mjs [normal|json|stream]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.argv[2] ?? 'json';
const timeoutMs = 45_000;
const schema = resolve(import.meta.dirname, 'result.schema.json');
const prompt = mode === 'normal'
  ? 'Return exactly: ANTIGRAVITY_HEADLESS_OK'
  : 'Return a JSON object with ok=true, message="structured output works", and provider="antigravity-cli". Return only the object.';

const args = ['-p', prompt];
if (mode === 'json') args.push('--output-format', 'json', '--json-schema', schema);
if (mode === 'stream') args.push('--output-format', 'stream-json');
if (!['normal', 'json', 'stream'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
if (mode === 'json' && !existsSync(schema)) throw new Error(`Schema missing: ${schema}`);

function run(command, commandArgs) {
  return new Promise((resolveRun, rejectRun) => {
    let stdout = '', stderr = '', timedOut = false;
    let child;
    try {
      child = spawn(command, commandArgs, { shell: false, windowsHide: true });
    } catch (error) {
      rejectRun(error);
      return;
    }
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', error => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') rejectRun(new Error('agy CLI not found on PATH. Install/authenticate it before retrying.'));
      else rejectRun(error);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolveRun({ exitCode, signal, timedOut, stdout, stderr });
    });
  });
}

try {
  const result = await run('agy', args);
  const report = { mode, args: ['-p', '<prompt>', ...args.slice(2)], ...result };
  if (result.timedOut) throw new Error(`agy timed out after ${timeoutMs} ms; stderr: ${result.stderr}`);
  if (result.exitCode !== 0) throw new Error(`agy exited ${result.exitCode}; stderr: ${result.stderr}`);
  if (mode === 'json') {
    try { report.parsed = JSON.parse(result.stdout); }
    catch { throw new Error('agy returned exit code 0 but stdout was not valid JSON.'); }
  }
  if (mode === 'stream') {
    try { report.events = result.stdout.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse); }
    catch { throw new Error('agy stream-json stdout was not valid NDJSON.'); }
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`ANTIGRAVITY_PROVIDER_POC_ERROR: ${error.message}`);
  process.exitCode = 1;
}
