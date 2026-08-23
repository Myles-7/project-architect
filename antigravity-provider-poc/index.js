import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const CLI = 'agy';
const TIMEOUT_MS = 45_000;
const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, 'schema.json');

class AgyError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'AgyError';
    this.kind = kind;
    Object.assign(this, details);
  }
}

/** Starts agy directly (no shell) and captures its complete process result. */
function spawnAgy(args, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolveResult, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const settle = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    let child;
    try {
      child = spawn(CLI, args, { shell: false, windowsHide: true });
    } catch (error) {
      settle(reject, new AgyError('spawn', error.message, { cause: error }));
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      const kind = error.code === 'ENOENT' ? 'cli-not-found' : 'spawn';
      settle(reject, new AgyError(kind, `Unable to start ${CLI}: ${error.message}`, { cause: error }));
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        settle(reject, new AgyError('timeout', `${CLI} timed out after ${timeoutMs} ms`, { stdout, stderr, exitCode, signal }));
      } else if (exitCode !== 0) {
        settle(reject, new AgyError('exit-code', `${CLI} exited with code ${exitCode}`, { stdout, stderr, exitCode, signal }));
      } else {
        settle(resolveResult, { stdout, stderr, exitCode, signal });
      }
    });
  });
}

/**
 * Minimal Provider Adapter required by the PoC.
 * @param {string} prompt
 * @returns {Promise<{success:boolean, text:string, raw:any}>}
 */
export async function callAntigravity(prompt) {
  if (typeof prompt !== 'string') throw new TypeError('prompt must be a string');
  try {
    const raw = await spawnAgy(['-p', prompt]);
    return { success: true, text: raw.stdout.trim(), raw };
  } catch (error) {
    return { success: false, text: '', raw: { kind: error.kind ?? 'unknown', message: error.message, stdout: error.stdout ?? '', stderr: error.stderr ?? '', exitCode: error.exitCode ?? null } };
  }
}

function parseEnvelope(stdout) {
  try { return JSON.parse(stdout); }
  catch (cause) { throw new AgyError('invalid-json', 'agy JSON output failed JSON.parse', { cause, stdout }); }
}

function parseNdjson(stdout) {
  const lines = stdout.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new AgyError('invalid-ndjson', 'stream-json returned no non-empty lines', { stdout });
  try { return lines.map(line => JSON.parse(line)); }
  catch (cause) { throw new AgyError('invalid-ndjson', 'stream-json contained a non-JSON line', { cause, stdout }); }
}

async function verify() {
  const results = {};
  try {
    results.version = await spawnAgy(['--version']);
    results.help = await spawnAgy(['--help']);
  } catch (error) {
    return { status: 'blocked', reason: error.kind, message: error.message, results };
  }
  const normal = await callAntigravity('Return exactly: PROVIDER_TEST_OK');
  results.normal = normal;
  if (!normal.success || normal.text !== 'PROVIDER_TEST_OK') return { status: 'failed', results };

  const json = await spawnAgy(['-p', 'Return JSON with fields ok(boolean) and message(string)', '--output-format', 'json']);
  results.json = { ...json, envelope: parseEnvelope(json.stdout) };
  const schema = await spawnAgy(['-p', 'Return only {"ok":true,"message":"schema works"}', '--output-format', 'json', '--json-schema', schemaPath]);
  results.schema = { ...schema, envelope: parseEnvelope(schema.stdout) };
  const stream = await spawnAgy(['-p', 'Say hello and finish', '--output-format', 'stream-json']);
  results.stream = { ...stream, events: parseNdjson(stream.stdout) };
  results.repeated = [];
  for (let i = 0; i < 3; i += 1) {
    const run = await spawnAgy(['-p', 'Return JSON with fields ok(boolean) and message(string)', '--output-format', 'json']);
    results.repeated.push({ ...run, envelope: parseEnvelope(run.stdout) });
  }
  return { status: 'completed', results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verify().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'completed' ? 0 : 1;
  }).catch(error => {
    console.error(JSON.stringify({ status: 'error', kind: error.kind ?? 'unknown', message: error.message, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }, null, 2));
    process.exitCode = 1;
  });
}
