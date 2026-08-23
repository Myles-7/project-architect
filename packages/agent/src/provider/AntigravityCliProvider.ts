import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { AIProvider } from './AIProvider.js';
import {
  DEFAULT_RUNTIME_CONFIG,
  type AIProviderRequest,
  type StructuredResult,
  type ProviderUsage,
} from '@project-architect/contracts';

export class AntigravityCliProvider implements AIProvider {
  readonly name = 'antigravity-cli';
  private cliExecutable: string;
  private maxBufferBytes: number;

  constructor(
    cliExecutable: string = process.env.AGY_CLI || 'agy.exe',
    maxBufferBytes: number = DEFAULT_RUNTIME_CONFIG.provider.maxBufferBytes
  ) {
    this.cliExecutable = cliExecutable;
    this.maxBufferBytes = maxBufferBytes;
  }

  async complete<T = unknown>(request: AIProviderRequest): Promise<StructuredResult<T>> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs || DEFAULT_RUNTIME_CONFIG.provider.timeoutMs || 90_000;
    const absSchemaPath = resolve(request.schemaPath);

    // Build unified invocation prompt: prompt + context
    const fullPrompt = `${request.prompt}\n\n# RUNTIME CONTEXT\n\n${request.contextText}`;

    return new Promise<StructuredResult<T>>((resolvePromise) => {
      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;
      let bufferExceeded = false;
      let closed = false;

      const args = [
        fullPrompt,
        '--output-format',
        'json',
        '--json-schema',
        absSchemaPath,
      ];

      // Use direct spawn with shell: false to eliminate command injection vectors
      const child = spawn(this.cliExecutable, args, {
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const terminateProcess = (pid: number | undefined) => {
        try {
          child.stdout?.destroy();
          child.stderr?.destroy();
          child.stdin?.destroy();
        } catch {}
        if (!pid) return;
        try {
          child.kill('SIGKILL');
        } catch {}
        if (process.platform === 'win32') {
          try {
            spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
              shell: false,
              windowsHide: true,
              stdio: 'ignore',
            });
          } catch {}
        }
      };

      const timer = setTimeout(() => {
        if (closed) return;
        timedOut = true;
        terminateProcess(child.pid);
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer | string) => {
        if (closed) return;
        const len = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        stdoutBytes += len;
        if (stdoutBytes > this.maxBufferBytes) {
          bufferExceeded = true;
          terminateProcess(child.pid);
          return;
        }
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        if (closed) return;
        const len = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        stderrBytes += len;
        if (stderrBytes > this.maxBufferBytes) {
          bufferExceeded = true;
          terminateProcess(child.pid);
          return;
        }
        stderr += chunk.toString();
      });

      child.on('error', (err: any) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolvePromise({
          status: 'failed',
          structuredSuccess: false,
          structuredOutput: null,
          rawEnvelope: null,
          stderr: `Spawn error: ${err.message}`,
          exitCode: -1,
          durationMs,
          usage: this.emptyUsage(),
          provider: this.name,
        });
      });

      child.on('close', (code) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        if (bufferExceeded) {
          return resolvePromise({
            status: 'failed',
            structuredSuccess: false,
            structuredOutput: null,
            rawEnvelope: null,
            stderr: `Process output exceeded maximum buffer limit of ${this.maxBufferBytes} bytes`,
            exitCode: code ?? -1,
            durationMs,
            usage: this.emptyUsage(),
            provider: this.name,
          });
        }

        if (timedOut) {
          return resolvePromise({
            status: 'timed-out',
            structuredSuccess: false,
            structuredOutput: null,
            rawEnvelope: null,
            stderr: `Process timed out after ${timeoutMs}ms`,
            exitCode: code ?? -1,
            durationMs,
            usage: this.emptyUsage(),
            provider: this.name,
          });
        }

        if (code !== 0) {
          return resolvePromise({
            status: 'failed',
            structuredSuccess: false,
            structuredOutput: null,
            rawEnvelope: null,
            stderr: stderr || `Process exited with code ${code}`,
            exitCode: code,
            durationMs,
            usage: this.emptyUsage(),
            provider: this.name,
          });
        }

        try {
          const envelope = JSON.parse(stdout);
          const structuredOutput = envelope.structured_output as T | undefined;
          const usage = this.extractUsage(envelope);

          if (!structuredOutput) {
            return resolvePromise({
              status: 'failed',
              structuredSuccess: false,
              structuredOutput: null,
              rawEnvelope: envelope,
              stderr: 'Envelope missing structured_output field',
              exitCode: code,
              durationMs,
              usage,
              provider: this.name,
            });
          }

          return resolvePromise({
            status: 'success',
            structuredSuccess: true,
            structuredOutput,
            rawEnvelope: envelope,
            stderr: stderr || null,
            exitCode: code,
            durationMs,
            usage,
            provider: this.name,
          });
        } catch (parseErr: any) {
          return resolvePromise({
            status: 'failed',
            structuredSuccess: false,
            structuredOutput: null,
            rawEnvelope: stdout,
            stderr: `JSON parse error of stdout: ${parseErr.message}`,
            exitCode: code,
            durationMs,
            usage: this.emptyUsage(),
            provider: this.name,
          });
        }
      });
    });
  }

  private extractUsage(envelope: any): ProviderUsage {
    const rawUsage = envelope?.usage || envelope?.metrics?.usage || {};
    return {
      inputTokens: rawUsage.input_tokens ?? rawUsage.inputTokens ?? 'unavailable',
      outputTokens: rawUsage.output_tokens ?? rawUsage.outputTokens ?? 'unavailable',
      thinkingTokens: rawUsage.thinking_tokens ?? rawUsage.thinkingTokens ?? 'unavailable',
      totalTokens: rawUsage.total_tokens ?? rawUsage.totalTokens ?? 'unavailable',
      cacheReadTokens: rawUsage.cache_read_tokens ?? rawUsage.cacheReadTokens ?? 'unavailable',
    };
  }

  private emptyUsage(): ProviderUsage {
    return {
      inputTokens: 'unavailable',
      outputTokens: 'unavailable',
      thinkingTokens: 'unavailable',
      totalTokens: 'unavailable',
      cacheReadTokens: 'unavailable',
    };
  }
}
