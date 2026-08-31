import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorage } from '../src/storage/FileStorage.js';
import { DocumentExportService } from '../src/documents/DocumentExportService.js';
import type { DocumentManifest } from '@project-architect/contracts';

describe('DocumentExportService Unit Tests', () => {
  let tempDir: string;
  let storage: FileStorage;
  let exportService: DocumentExportService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pa-doc-export-'));
    storage = new FileStorage();
    exportService = new DocumentExportService(storage);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('1. Successfully packages all manifest files into a valid PKZip Buffer', async () => {
    const manifest: DocumentManifest = {
      id: 'man-01',
      projectId: 'proj-export-test',
      sourceRevision: 1,
      readinessReviewId: 'rdn-01',
      readinessBasisRevision: 1,
      generatedAt: new Date().toISOString(),
      documents: [
        {
          id: 'doc-agents',
          type: 'agents',
          path: 'AGENTS.md',
          title: 'AGENTS.md',
          status: 'generated',
          generatedAt: new Date().toISOString(),
          sourceRevision: 1,
          contentHash: 'hash-agents',
        },
        {
          id: 'doc-project',
          type: 'project',
          path: 'docs/PROJECT.md',
          title: 'PROJECT.md',
          status: 'generated',
          generatedAt: new Date().toISOString(),
          sourceRevision: 1,
          contentHash: 'hash-project',
        },
      ],
      warnings: [],
      sourceCoverage: { confirmed: 2, locked: 1, assumptions: 0, generatedStructure: 4 },
    };

    // Write manifest and files
    await storage.ensureDir(join(tempDir, 'documents'));
    await storage.writeJson(join(tempDir, 'documents', 'manifest.json'), manifest);
    await storage.writeText(join(tempDir, 'AGENTS.md'), '# AGENTS.md\nRules and constraints');
    await storage.writeText(join(tempDir, 'docs', 'PROJECT.md'), '# PROJECT.md\nProject overview');

    const result = await exportService.exportZip(tempDir);

    expect(result.filesCount).toBe(2);
    expect(result.filePaths).toEqual(['AGENTS.md', 'docs/PROJECT.md']);
    expect(result.totalBytes).toBeGreaterThan(0);

    // Verify PKZip Local Header signature 0x04034b50
    expect(result.zipBuffer.readUInt32LE(0)).toBe(0x04034b50);
  });

  it('2. Fails atomically if any file in manifest is missing, reporting exact missing files', async () => {
    const manifest: DocumentManifest = {
      id: 'man-02',
      projectId: 'proj-export-test',
      sourceRevision: 1,
      readinessReviewId: 'rdn-01',
      readinessBasisRevision: 1,
      generatedAt: new Date().toISOString(),
      documents: [
        {
          id: 'doc-agents',
          type: 'agents',
          path: 'AGENTS.md',
          title: 'AGENTS.md',
          status: 'generated',
          generatedAt: new Date().toISOString(),
          sourceRevision: 1,
          contentHash: 'hash-agents',
        },
        {
          id: 'doc-missing',
          type: 'product',
          path: 'docs/PRODUCT.md',
          title: 'PRODUCT.md',
          status: 'generated',
          generatedAt: new Date().toISOString(),
          sourceRevision: 1,
          contentHash: 'hash-missing',
        },
      ],
      warnings: [],
      sourceCoverage: { confirmed: 1, locked: 0, assumptions: 0, generatedStructure: 2 },
    };

    await storage.ensureDir(join(tempDir, 'documents'));
    await storage.writeJson(join(tempDir, 'documents', 'manifest.json'), manifest);
    // Write only AGENTS.md, omit docs/PRODUCT.md
    await storage.writeText(join(tempDir, 'AGENTS.md'), '# AGENTS.md');

    await expect(exportService.exportZip(tempDir)).rejects.toThrow(
      /Atomic Document ZIP export failed/
    );

    try {
      await exportService.exportZip(tempDir);
    } catch (err: any) {
      expect(err.details?.missingFiles).toContain('docs/PRODUCT.md');
      expect(err.details?.missingFiles).not.toContain('AGENTS.md');
    }
  });

  it('3. Fails when manifest does not exist', async () => {
    await expect(exportService.exportZip(tempDir)).rejects.toThrow(/No compiled document manifest found/);
  });

  it('4. Rejects manifest paths that escape the project directory', async () => {
    const outsideFile = join(tempDir, '..', `pa-export-secret-${Date.now()}.txt`);
    await storage.writeText(outsideFile, 'must-not-be-exported');
    await storage.ensureDir(join(tempDir, 'documents'));
    await storage.writeJson(join(tempDir, 'documents', 'manifest.json'), {
      id: 'man-traversal',
      projectId: 'proj-export-test',
      sourceRevision: 1,
      readinessReviewId: 'rdn-01',
      readinessBasisRevision: 1,
      generatedAt: new Date().toISOString(),
      documents: [{
        id: 'doc-outside', type: 'project', path: `../${outsideFile.split(/[\\/]/).at(-1)}`,
        title: 'Outside', status: 'generated', generatedAt: new Date().toISOString(),
        sourceRevision: 1, contentHash: 'hash-outside',
      }],
      warnings: [],
      sourceCoverage: { confirmed: 0, locked: 0, assumptions: 0, generatedStructure: 0 },
    } satisfies DocumentManifest);

    await expect(exportService.exportZip(tempDir)).rejects.toMatchObject({
      code: expect.any(String),
    });
    await rm(outsideFile, { force: true });
  });
});
