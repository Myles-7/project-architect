import { describe, it, expect } from 'vitest';
import { createZipArchive, type ZipFileEntry } from '../src/features/documents/exportZip.js';

describe('exportZip: In-Browser ZIP Generation Utility', () => {
  it('1. Generates a valid ZIP Blob containing single file with correct PKZip signatures', async () => {
    const files: ZipFileEntry[] = [
      {
        path: 'AGENTS.md',
        content: '# AGENTS.md\nArchitecture rules and constraints',
      },
    ];

    const blob = createZipArchive(files);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // Local Header Signature 0x04034b50 (PK\x03\x04)
    expect(view.getUint32(0, true)).toBe(0x04034b50);

    // Filename in Local Header at offset 30
    const filenameLen = view.getUint16(26, true);
    expect(filenameLen).toBe(9); // 'AGENTS.md'.length
    const decoder = new TextDecoder();
    const filename = decoder.decode(bytes.slice(30, 30 + filenameLen));
    expect(filename).toBe('AGENTS.md');
  });

  it('2. Correctly handles multiple files with subdirectories and nested paths', async () => {
    const files: ZipFileEntry[] = [
      {
        path: 'AGENTS.md',
        content: '# Master Guidance',
      },
      {
        path: 'docs/PROJECT.md',
        content: '# Project Overview\nBoundary & Scope',
      },
      {
        path: 'docs/TECHNICAL_GUIDE.md',
        content: '# Technical Guide\nLightweight Constraints',
      },
    ];

    const blob = createZipArchive(files);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // Find Central Directory signature 0x02014b50 (PK\x01\x02)
    let cdCount = 0;
    for (let i = 0; i < bytes.length - 4; i++) {
      if (view.getUint32(i, true) === 0x02014b50) {
        cdCount++;
      }
    }
    expect(cdCount).toBe(3);

    // End of Central Directory signature 0x06054b50 (PK\x05\x06)
    const eocdSig = view.getUint32(bytes.length - 22, true);
    expect(eocdSig).toBe(0x06054b50);

    // Number of records in EOCD
    const totalRecords = view.getUint16(bytes.length - 22 + 10, true);
    expect(totalRecords).toBe(3);
  });

  it('3. Supports non-ASCII UTF-8 characters and Chinese path names with 0x0800 EFS flag', async () => {
    const files: ZipFileEntry[] = [
      {
        path: 'docs/架构设计.md',
        content: '# 项目架构设计\n核心模块与高可用方案',
      },
    ];

    const blob = createZipArchive(files);
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    // Verify UTF-8 EFS Bit Flag is set (0x0800)
    const flag = view.getUint16(6, true);
    expect(flag & 0x0800).toBe(0x0800);
  });

  it('4. Handles binary Uint8Array file content seamlessly', async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    const files: ZipFileEntry[] = [
      {
        path: 'assets/logo.png',
        content: binaryData,
      },
    ];

    const blob = createZipArchive(files);
    expect(blob.size).toBeGreaterThan(binaryData.length);
  });
});
