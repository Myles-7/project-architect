import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SpecDriftAuditor } from '../src/auditor/SpecDriftAuditor.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('SpecDriftAuditor (方案 8 — pa verify)', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `pa-audit-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  function createMockSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
    return {
      schemaVersion: '1.0.0',
      metadata: {
        projectId: 'proj-audit-test',
        name: 'Audit Test Project',
        stage: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stateRevision: 3,
        projectTags: ['local-first'],
      },
      decisions: {
        items: [
          {
            id: 'dec-1',
            decisionKey: 'storage.local-only',
            areaId: 'technical_boundary',
            title: '禁止引入数据库，采用纯本地文件存储',
            summary: '零数据库原则',
            status: 'locked',
            source: 'user',
            choice: 'zero-db',
            updatedAt: new Date().toISOString(),
            revision: 1,
          },
        ],
      },
      documents: {
        items: [
          {
            path: 'AGENTS.md',
            title: 'Agent Guidelines',
            sourceRevision: 3,
            isStale: false,
          },
          {
            path: 'docs/TECHNICAL_GUIDE.md',
            title: 'Technical Guide',
            sourceRevision: 1,
            isStale: true, // Deliberately stale
          },
        ],
      },
      ...overrides,
    };
  }

  it('1. Flags forbidden database dependency drift when project decision is Zero-DB', async () => {
    // Write package.json with sqlite3
    const pkgJson = {
      name: 'drifting-project',
      dependencies: {
        sqlite3: '^5.1.7',
      },
    };
    await fsp.writeFile(join(testDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

    const snapshot = createMockSnapshot();
    const report = await SpecDriftAuditor.audit(testDir, snapshot);

    expect(report.isCompliant).toBe(false);
    expect(report.errorCount).toBeGreaterThanOrEqual(1);

    const dbViolation = report.violations.find((v) => v.category === 'dependency' && v.title.includes('sqlite3'));
    expect(dbViolation).toBeDefined();
    expect(dbViolation?.severity).toBe('error');
    expect(dbViolation?.remediation).toContain('移除 "sqlite3"');
  });

  it('2. Flags stale document drift as warning', async () => {
    const pkgJson = { name: 'clean-project', dependencies: {} };
    await fsp.writeFile(join(testDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

    const snapshot = createMockSnapshot();
    const report = await SpecDriftAuditor.audit(testDir, snapshot);

    const docViolation = report.violations.find((v) => v.category === 'document' && v.filePath === 'docs/TECHNICAL_GUIDE.md');
    expect(docViolation).toBeDefined();
    expect(docViolation?.severity).toBe('warning');
    expect(docViolation?.remediation).toContain('重新编译');
  });

  it('3. Flags illegal cross-boundary private imports in source files', async () => {
    await fsp.mkdir(join(testDir, 'src'), { recursive: true });
    // Write illegal deep private internal cross-boundary import
    const code = "import { something } from '../../packages/core/src/internal/secret.js';";
    await fsp.writeFile(join(testDir, 'src', 'illegal.ts'), code, 'utf8');

    const snapshot = createMockSnapshot();
    const report = await SpecDriftAuditor.audit(testDir, snapshot);

    const boundaryViolation = report.violations.find((v) => v.category === 'boundary');
    expect(boundaryViolation).toBeDefined();
    expect(boundaryViolation?.severity).toBe('error');
    expect(boundaryViolation?.title).toContain('非法跨边界');
  });

  it('4. Passes with 0 errors when clean and compliant', async () => {
    // Clean package.json
    await fsp.writeFile(join(testDir, 'package.json'), JSON.stringify({ name: 'good-project' }), 'utf8');
    // AGENTS.md exists
    await fsp.writeFile(join(testDir, 'AGENTS.md'), '# Guidelines', 'utf8');

    const cleanSnapshot = createMockSnapshot({
      documents: {
        items: [
          {
            path: 'AGENTS.md',
            title: 'Agent Guidelines',
            sourceRevision: 3,
            isStale: false,
          },
        ],
      },
    });

    const report = await SpecDriftAuditor.audit(testDir, cleanSnapshot);
    expect(report.errorCount).toBe(0);
    expect(report.isCompliant).toBe(true);
  });
});
