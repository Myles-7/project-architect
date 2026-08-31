import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { AIProvider } from './AIProvider.js';
import {
  DEFAULT_RUNTIME_CONFIG,
  type AIProviderRequest,
  type StructuredResult,
  type ProviderUsage,
  type ProviderHealthView,
} from '@project-architect/contracts';

export class AntigravityCliProvider implements AIProvider {
  readonly name = 'antigravity-cli';
  private cliExecutable: string;
  private maxBufferBytes: number;
  private cliPrefixArgs: string[];
  private hasObservedPromptCache = false;

  constructor(
    cliExecutable: string = process.env.AGY_CLI || 'agy.exe',
    maxBufferBytes: number = DEFAULT_RUNTIME_CONFIG.provider.maxBufferBytes,
    cliPrefixArgs: string[] = []
  ) {
    this.cliExecutable = cliExecutable;
    this.maxBufferBytes = maxBufferBytes;
    this.cliPrefixArgs = [...cliPrefixArgs];
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
      let cancelled = false;
      let closed = false;
      let timer: NodeJS.Timeout | undefined;

      const args = [
        ...this.cliPrefixArgs,
        // Antigravity only accepts a non-interactive prompt through -p/--print.
        // Passing it positionally makes the CLI ignore the whole prompt.
        '-p',
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
            const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
              shell: false,
              windowsHide: true,
              stdio: 'ignore',
            });
            killer.unref();
          } catch {}
        }
      };

      const finishTerminal = (
        status: 'cancelled' | 'timed-out' | 'failed',
        message: string,
        exitCode: number | null
      ) => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        request.abortSignal?.removeEventListener('abort', abortHandler);
        terminateProcess(child.pid);
        resolvePromise({
          status,
          structuredSuccess: false,
          structuredOutput: null,
          rawEnvelope: null,
          stderr: message,
          exitCode,
          durationMs: Date.now() - startTime,
          usage: this.emptyUsage(),
          provider: this.name,
        });
      };

      const abortHandler = () => {
        if (closed) return;
        cancelled = true;
        finishTerminal('cancelled', 'Discovery run was cancelled.', null);
      };

      if (request.abortSignal?.aborted) {
        abortHandler();
      } else {
        request.abortSignal?.addEventListener('abort', abortHandler, { once: true });
      }

      timer = setTimeout(() => {
        if (closed) return;
        timedOut = true;
        finishTerminal('timed-out', `Process timed out after ${timeoutMs}ms`, -1);
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer | string) => {
        if (closed) return;
        const len = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        stdoutBytes += len;
        if (stdoutBytes > this.maxBufferBytes) {
          bufferExceeded = true;
          finishTerminal('failed', `Process output exceeded maximum buffer limit of ${this.maxBufferBytes} bytes`, -1);
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
          finishTerminal('failed', `Process output exceeded maximum buffer limit of ${this.maxBufferBytes} bytes`, -1);
          return;
        }
        stderr += chunk.toString();
      });

      child.on('error', (err: any) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        request.abortSignal?.removeEventListener('abort', abortHandler);
        const durationMs = Date.now() - startTime;
        if (cancelled) {
          resolvePromise({
            status: 'cancelled',
            structuredSuccess: false,
            structuredOutput: null,
            rawEnvelope: null,
            stderr: 'Discovery run was cancelled.',
            exitCode: null,
            durationMs,
            usage: this.emptyUsage(),
            provider: this.name,
          });
          return;
        }
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
        request.abortSignal?.removeEventListener('abort', abortHandler);
        const durationMs = Date.now() - startTime;

        if (cancelled) {
          return resolvePromise({
            status: 'cancelled',
            structuredSuccess: false,
            structuredOutput: null,
            rawEnvelope: null,
            stderr: 'Discovery run was cancelled.',
            exitCode: code ?? null,
            durationMs,
            usage: this.emptyUsage(),
            provider: this.name,
          });
        }

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

          if (typeof usage.cacheReadTokens === 'number' && usage.cacheReadTokens > 0) {
            this.hasObservedPromptCache = true;
          }

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

  async healthCheck(): Promise<ProviderHealthView> {
    const checkedAt = new Date().toISOString();
    const isExplicitPath = this.cliExecutable.includes('/') || this.cliExecutable.includes('\\');
    const promptCacheStatus = this.hasObservedPromptCache ? 'observed' : 'unknown';

    // 1. If explicit path is provided, directly check its existence
    if (isExplicitPath && !existsSync(resolve(this.cliExecutable))) {
      return {
        status: 'unavailable',
        providerName: 'Antigravity CLI',
        modelName: 'Claude 3.5 Sonnet / Gemini via AGY',
        inferenceLocation: 'unknown',
        sendsProjectContextOffDevice: 'unknown',
        structuredOutput: 'supported',
        promptCache: 'unknown',
        checkedAt,
        executable: this.cliExecutable,
        lastFailureCode: 'EXECUTABLE_NOT_FOUND',
        guidance: `未在本地找到指定的 Antigravity CLI 可执行文件 (${this.cliExecutable})。请检查 AGY_CLI 环境变量配置。`,
      };
    }

    // 2. Perform minimal non-sensitive probe (no project data sent)
    try {
      const probe = spawnSync(this.cliExecutable, ['--version'], {
        shell: false,
        windowsHide: true,
        timeout: 5000,
        encoding: 'utf8',
      });

      if (probe.error) {
        const isNotFound = (probe.error as any).code === 'ENOENT';
        return {
          status: isNotFound ? 'unavailable' : 'degraded',
          providerName: 'Antigravity CLI',
          modelName: 'Claude 3.5 Sonnet / Gemini via AGY',
          inferenceLocation: isNotFound ? 'unknown' : 'remote',
          sendsProjectContextOffDevice: isNotFound ? 'unknown' : true,
          structuredOutput: 'supported',
          promptCache: promptCacheStatus,
          checkedAt,
          executable: this.cliExecutable,
          lastFailureCode: isNotFound ? 'EXECUTABLE_NOT_FOUND' : 'PROBE_FAILED',
          guidance: isNotFound
            ? `系统 PATH 中未找到命令 "${this.cliExecutable}"，请安装 Antigravity CLI 或配置 AGY_CLI。`
            : 'CLI 进程启动失败。错误信息已安全脱敏，请检查可执行权限或系统环境。',
        };
      }

      if (probe.status !== 0) {
        return {
          status: 'degraded',
          providerName: 'Antigravity CLI',
          modelName: 'Claude 3.5 Sonnet / Gemini via AGY',
          inferenceLocation: 'remote',
          sendsProjectContextOffDevice: true,
          structuredOutput: 'supported',
          promptCache: promptCacheStatus,
          checkedAt,
          executable: this.cliExecutable,
          lastFailureCode: 'PROBE_FAILED',
          guidance: 'Antigravity CLI 存在但最小版本探测退出码非 0。请检查 CLI 登录授权状态与网络连接。',
        };
      }

      return {
        status: 'ready',
        providerName: 'Antigravity CLI',
        modelName: 'Claude 3.5 Sonnet / Gemini via AGY',
        inferenceLocation: 'remote',
        sendsProjectContextOffDevice: true,
        structuredOutput: 'supported',
        promptCache: promptCacheStatus,
        checkedAt,
        executable: this.cliExecutable,
        lastSuccessAt: checkedAt,
        guidance: 'Antigravity CLI 引擎运行正常。项目文件保存在本地，单轮推演时将选定上下文发往配置模型。',
      };
    } catch {
      return {
        status: 'degraded',
        providerName: 'Antigravity CLI',
        modelName: 'Claude 3.5 Sonnet / Gemini via AGY',
        inferenceLocation: 'remote',
        sendsProjectContextOffDevice: true,
        structuredOutput: 'supported',
        promptCache: promptCacheStatus,
        checkedAt,
        executable: this.cliExecutable,
        lastFailureCode: 'PROBE_EXCEPTION',
        guidance: '健康探测发生异常，已阻断潜在错误泄露。请检查本地运行环境。',
      };
    }
  }
}
