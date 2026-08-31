export interface AppRuntimeConfig {
  workspace: {
    workspaceRoot: string;
    projectsSubdir: string;
  };
  provider: {
    cliExecutable: string;
    timeoutMs: number;
    warningDurationMs: number;
    maxBufferBytes: number;
  };
  context: {
    maxTotalContextChars: number;
    maxContextDecisions: number;
    maxContextGaps: number;
    maxChecklistHints: number;
    maxMaterialExcerptChars: number;
  };
  inputs: {
    maxFileSizeBytes: number;
    maxFilesPerBatch: number;
    supportedExtensions: string[];
  };
  guardrails: {
    tokenWarningThreshold: number;
    tokenHardGuardrail: number;
    maxInputTokens: number;
  };
  observability: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    persistRawDiagnostics: boolean;
  };
}

/**
 * Shared contracts are consumed by both Node.js services and the browser UI.
 * Read Node environment variables through `globalThis` so importing this module
 * never assumes that the browser exposes a `process` global.
 */
function readRuntimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.[name];
}

export const DEFAULT_RUNTIME_CONFIG: AppRuntimeConfig = {
  workspace: {
    workspaceRoot: readRuntimeEnv('PA_WORKSPACE_DIR') || '.workspace',
    projectsSubdir: 'projects',
  },
  provider: {
    cliExecutable: readRuntimeEnv('AGY_CLI') || 'agy.exe',
    timeoutMs: Number(readRuntimeEnv('PA_TIMEOUT_MS')) || 90_000,
    warningDurationMs: 45_000,
    maxBufferBytes: 10 * 1024 * 1024,
  },
  context: {
    maxTotalContextChars: 32_000,
    maxContextDecisions: 20,
    maxContextGaps: 10,
    maxChecklistHints: 10,
    maxMaterialExcerptChars: 4_000,
  },
  inputs: {
    maxFileSizeBytes: 20 * 1024 * 1024,
    maxFilesPerBatch: 10,
    supportedExtensions: ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'],
  },
  guardrails: {
    tokenWarningThreshold: 50_000,
    tokenHardGuardrail: 75_000,
    maxInputTokens: 60_000,
  },
  observability: {
    logLevel: 'info',
    persistRawDiagnostics: true,
  },
};
