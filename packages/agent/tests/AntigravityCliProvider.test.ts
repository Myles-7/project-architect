import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AntigravityCliProvider } from '../src/provider/AntigravityCliProvider.js';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';

describe('AntigravityCliProvider Hardening Tests (Phase 4.8.1)', () => {
  const schemaPath = resolve(process.cwd(), 'experiments/agent-benchmark/schemas/b2-unified.schema.json');
  const csSourcePath = resolve(__dirname, 'MockAgy.cs');
  const mockExePath = resolve(__dirname, 'mock-agy.exe');

  beforeAll(() => {
    if (process.platform === 'win32' && !existsSync(mockExePath)) {
      execSync(
        `powershell -NoProfile -Command "Add-Type -Path '${csSourcePath}' -OutputAssembly '${mockExePath}' -OutputType ConsoleApplication"`,
        { stdio: 'ignore' }
      );
    }
  });

  afterAll(() => {
    delete process.env.MOCK_AGY_MODE;
    if (existsSync(mockExePath)) {
      try {
        unlinkSync(mockExePath);
      } catch {}
    }
  });

  it('1. Shell Metacharacters: Prompts containing &, |, quotes, and shell variables do not execute as shell commands', async () => {
    process.env.MOCK_AGY_MODE = 'default';
    const provider = new AntigravityCliProvider(mockExePath);
    const dangerousPrompt = 'Dangerous Prompt & echo INJECTED | whoami ; "quoted" `pwd` %PATH% $HOME';

    const result = await provider.complete<any>({
      requestId: 'req-shell-test',
      task: 'discovery-turn',
      mode: 'broad-pass',
      prompt: dangerousPrompt,
      schemaPath,
      contextText: 'Context with & characters | pipe',
      timeoutMs: 5000,
    });

    expect(result.status).toBe('success');
    expect(result.structuredSuccess).toBe(true);
    expect(result.structuredOutput?.confirmed).toContain('No Shell Injection');
  });

  it('2. Timeout Handling: Hanging child process is terminated and returns safe timed-out status', async () => {
    process.env.MOCK_AGY_MODE = 'hang';
    const provider = new AntigravityCliProvider(mockExePath);

    const result = await provider.complete<any>({
      requestId: 'req-timeout-test',
      task: 'discovery-turn',
      mode: 'broad-pass',
      prompt: 'Hang test',
      schemaPath,
      contextText: 'timeout context',
      timeoutMs: 400, // short timeout
    });

    expect(result.status).toBe('timed-out');
    expect(result.structuredSuccess).toBe(false);
    expect(result.structuredOutput).toBeNull();
    expect(result.rawEnvelope).toBeNull();
    expect(result.stderr).toContain('Process timed out');
  });

  it('3. Buffer Overflow Protection: Output exceeding maxBufferBytes safely fails without crashing or unbounded memory', async () => {
    process.env.MOCK_AGY_MODE = 'flood';
    // Set maxBufferBytes to 16KB (16384 bytes)
    const provider = new AntigravityCliProvider(mockExePath, 16384);

    const result = await provider.complete<any>({
      requestId: 'req-buffer-test',
      task: 'discovery-turn',
      mode: 'broad-pass',
      prompt: 'Flood test',
      schemaPath,
      contextText: 'buffer overflow context',
      timeoutMs: 5000,
    });

    expect(result.status).toBe('failed');
    expect(result.structuredSuccess).toBe(false);
    expect(result.structuredOutput).toBeNull();
    expect(result.rawEnvelope).toBeNull();
    expect(result.stderr).toContain('Process output exceeded maximum buffer limit');
  });

  it('4. Invalid or non-JSON output returns safe failed status without throwing unhandled exceptions', async () => {
    process.env.MOCK_AGY_MODE = 'invalid_json';
    const provider = new AntigravityCliProvider(mockExePath);

    const result = await provider.complete<any>({
      requestId: 'req-invalid-json',
      task: 'discovery-turn',
      mode: 'broad-pass',
      prompt: 'Invalid JSON test',
      schemaPath,
      contextText: 'invalid json context',
      timeoutMs: 5000,
    });

    expect(result.status).toBe('failed');
    expect(result.structuredSuccess).toBe(false);
    expect(result.structuredOutput).toBeNull();
    expect(result.stderr).toContain('JSON parse error');
  });
});
