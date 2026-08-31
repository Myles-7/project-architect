import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('shared runtime configuration', () => {
  it('loads without a Node process global in a browser-like runtime', async () => {
    const configUrl = pathToFileURL(
      fileURLToPath(new URL('../dist/config.js', import.meta.url))
    ).href;
    const script = [
      'globalThis.process = undefined;',
      `const config = await import(${JSON.stringify(configUrl)});`,
      'console.log(JSON.stringify(config.DEFAULT_RUNTIME_CONFIG));',
    ].join('\n');

    const { stdout } = await execFileAsync(process.execPath, [
      '--input-type=module',
      '--eval',
      script,
    ]);
    const config = JSON.parse(stdout) as {
      workspace: { workspaceRoot: string };
      provider: { cliExecutable: string; timeoutMs: number };
    };

    expect(config.workspace.workspaceRoot).toBe('.workspace');
    expect(config.provider.cliExecutable).toBe('agy.exe');
    expect(config.provider.timeoutMs).toBe(90_000);
  });
});
