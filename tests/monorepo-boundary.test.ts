import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

describe('Monorepo Boundary Integrity (Solution 19)', () => {
  const rootDir = resolve(__dirname, '..');

  function collectTsFiles(dir: string): string[] {
    const results: string[] = [];
    if (!statSync(dir).isDirectory()) return results;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      if (entry.isDirectory()) {
        results.push(...collectTsFiles(fullPath));
      } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('prohibits any production code in packages/ and apps/ from importing from frontend/ prototype', () => {
    const targetDirs = [
      join(rootDir, 'packages'),
      join(rootDir, 'apps'),
    ];

    const violations: { file: string; line: string }[] = [];
    const forbiddenPattern = /(from\s+['"][^'"]*frontend[^'"]*['"]|require\s*\(\s*['"][^'"]*frontend[^'"]*['"]\))/;

    for (const targetDir of targetDirs) {
      const files = collectTsFiles(targetDir);
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && forbiddenPattern.test(line)) {
            violations.push({
              file: file.replace(rootDir, ''),
              line: line.trim(),
            });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('exposes dev:mock and dev:prototype scripts in root package.json and apps/web package.json', () => {
    const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
    expect(rootPkg.scripts['dev:mock']).toBeDefined();
    expect(rootPkg.scripts['dev:prototype']).toBeDefined();

    const webPkg = JSON.parse(readFileSync(join(rootDir, 'apps', 'web', 'package.json'), 'utf-8'));
    expect(webPkg.scripts['dev:mock']).toBeDefined();
    expect(webPkg.scripts['dev:prototype']).toBeDefined();
  });
});
