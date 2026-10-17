import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { treeSha256 } from './agy-2026-10-04/real-integration/model-transition.mjs';

// Vite writes only apps/web/dist. Do not invoke tsc/project references while
// the real agy controls use the shared server/Core/Agent build.
const directories = ['packages/contracts/dist', 'packages/core/dist', 'packages/agent/dist', 'apps/server/dist'];
const before = Object.fromEntries(await Promise.all(directories.map(async path => [path, await treeSha256(resolve(path))])));
const result = spawnSync(process.execPath, [resolve('apps/web/node_modules/vite/bin/vite.js'), 'build'], {
  cwd: resolve('apps/web'), encoding: 'utf8', env: { ...process.env, PATH: `${dirname(process.execPath)};${process.env.PATH}` },
});
await writeFile(resolve('docs/validation/web-bundle-final-contract-20261005.txt'), `${result.stdout ?? ''}${result.stderr ?? ''}`);
const after = Object.fromEntries(await Promise.all(directories.map(async path => [path, await treeSha256(resolve(path))])));
const unchanged = directories.every(path => before[path].sha256 === after[path].sha256);
const report = { checkedAt: new Date().toISOString(), status: result.status === 0 && unchanged ? 'passed' : 'failed', exitCode: result.status,
  error: result.error ? String(result.error) : null, sharedDistUnchanged: unchanged, before, after,
  scope: 'Web bundle only; shared runtime artifacts byte-identical. This is not the complete workspace TypeScript/build verification.' };
await writeFile(resolve('docs/validation/web-bundle-shared-integrity-final-contract-20261005.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, sharedDistUnchanged: unchanged, exitCode: result.status }));
if (report.status !== 'passed') process.exitCode = 1;
