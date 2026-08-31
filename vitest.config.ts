import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@project-architect/contracts': resolve(__dirname, './packages/contracts/src/index.ts'),
      '@project-architect/core': resolve(__dirname, './packages/core/src/index.ts'),
      '@project-architect/agent': resolve(__dirname, './packages/agent/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
      },
    },
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
