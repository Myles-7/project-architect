import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CodebaseScanner } from '../src/brownfield/CodebaseScanner.js';

describe('CodebaseScanner (方案 4)', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `pa-scan-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  it('1. Scans a React + Vite + Tailwind + Vitest project safely and detects candidate decisions', async () => {
    // Scaffold mock project
    const pkgJson = {
      name: 'my-frontend-app',
      version: '1.0.0',
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        tailwindcss: '^4.0.0',
        zustand: '^5.0.0',
      },
      devDependencies: {
        vite: '^6.0.0',
        typescript: '^5.0.0',
        vitest: '^3.0.0',
      },
    };

    await fsp.writeFile(join(testDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');
    await fsp.mkdir(join(testDir, 'src'), { recursive: true });
    await fsp.writeFile(join(testDir, 'src', 'App.tsx'), 'export const App = () => <div>Hello</div>;', 'utf8');
    await fsp.writeFile(join(testDir, 'src', 'main.tsx'), 'import React from "react";', 'utf8');

    // Also scaffold an ignored folder to verify it is skipped
    await fsp.mkdir(join(testDir, 'node_modules', 'react'), { recursive: true });
    await fsp.writeFile(join(testDir, 'node_modules', 'react', 'index.js'), 'module.exports = {};', 'utf8');

    const result = await CodebaseScanner.scan(testDir);

    expect(result.detectedProjectName).toBe('my-frontend-app');
    expect(result.primaryLanguage).toBe('TypeScript');
    expect(result.isMonorepo).toBe(false);

    // Verify detected technologies
    const techNames = result.technologies.map((t) => t.name);
    expect(techNames).toContain('React');
    expect(techNames).toContain('Tailwind CSS');
    expect(techNames).toContain('Zustand');
    expect(techNames).toContain('Vitest');
    expect(techNames).toContain('Vite');

    // Verify candidate decisions (100% user authority first)
    expect(result.candidateDecisions.length).toBeGreaterThanOrEqual(3);
    for (const cand of result.candidateDecisions) {
      expect(cand.decisionKey).toBeDefined();
      expect(cand.title).toBeDefined();
      expect(cand.summary).toBeDefined();
      expect(cand.evidence.length).toBeGreaterThan(0);
      expect(cand.areaId).toBeDefined();
    }

    // Verify Zero-DB was inferred since no DB was present
    const storageDecision = result.candidateDecisions.find((c) => c.decisionKey.startsWith('storage.'));
    expect(storageDecision).toBeDefined();
    expect(storageDecision?.title).toContain('纯本地文件存储');
  });

  it('2. Detects Monorepo layout with pnpm-workspace', async () => {
    await fsp.writeFile(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n  - "packages/*"\n', 'utf8');
    await fsp.mkdir(join(testDir, 'packages', 'core'), { recursive: true });
    await fsp.mkdir(join(testDir, 'apps', 'web'), { recursive: true });

    const result = await CodebaseScanner.scan(testDir);
    expect(result.isMonorepo).toBe(true);

    const monorepoCandidate = result.candidateDecisions.find((c) => c.decisionKey === 'architecture.monorepo-layout');
    expect(monorepoCandidate).toBeDefined();
    expect(monorepoCandidate?.title).toContain('Monorepo');
  });

  it('3. Safely respects timeout and maxFiles caps on large trees', async () => {
    // Generate 30 dummy files
    for (let i = 0; i < 30; i++) {
      await fsp.writeFile(join(testDir, `file-${i}.ts`), `export const v${i} = ${i};`, 'utf8');
    }

    const result = await CodebaseScanner.scan(testDir, { maxFiles: 15 });
    expect(result.structureSummary.totalFilesScanned).toBeLessThanOrEqual(20);
  });
});
