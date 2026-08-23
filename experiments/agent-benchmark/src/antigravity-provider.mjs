import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CLI = process.env.AGY_CLI || 'agy.exe';
const TIMEOUT_MS = Number(process.env.AGY_TIMEOUT_MS || 300_000);

function serializeError(error) {
  return { name: error?.name, message: error?.message, code: error?.code };
}

function runProcess(args) {
  return new Promise((resolveRun) => {
    const started = performance.now();
    let stdout = '', stderr = '', timedOut = false, spawnError = null;
    let child;
    try { child = spawn(CLI, args, { shell: false, windowsHide: true }); }
    catch (error) { resolveRun({ stdout, stderr, exitCode: null, spawnError: serializeError(error), timedOut, durationMs: performance.now() - started }); return; }
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { spawnError = serializeError(error); });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolveRun({ stdout, stderr, exitCode, signal, spawnError, timedOut, durationMs: Math.round(performance.now() - started) });
    });
  });
}

/** Calls agy in JSON mode and extracts only envelope.structured_output. */
export async function callAntigravity({ prompt, schemaPath, rawOutputPath }) {
  const run = await runProcess(['-p', prompt, '--output-format', 'json', '--json-schema', schemaPath]);
  await mkdir(resolve(rawOutputPath, '..'), { recursive: true });
  let envelope = null, parseError = null;
  try { envelope = JSON.parse(run.stdout); }
  catch (error) { parseError = serializeError(error); }
  const structuredOutput = envelope?.structured_output ?? null;
  const success = run.exitCode === 0 && !run.timedOut && !run.spawnError && !!structuredOutput;
  const raw = { ...run, envelope, parseError, structuredOutput, success };
  await writeFile(rawOutputPath, JSON.stringify(raw, null, 2), 'utf8');
  return raw;
}
