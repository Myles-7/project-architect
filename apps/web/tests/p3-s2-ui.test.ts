/**
 * @file p3-s2-ui.test.ts
 * @description Stage S2 Web UI Verification: Standalone HTML Spec Bundle Export & Incremental Diff Guard
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultApiClient } from '../src/api/client.js';

describe('Stage S2 Web UI Verification', () => {
  const documentsViewPath = resolve(__dirname, '../src/features/documents/DocumentsView.tsx');

  it('1. Verifies DocumentsView provides Single-File HTML bundle export button and handler', () => {
    expect(existsSync(documentsViewPath)).toBe(true);
    const code = readFileSync(documentsViewPath, 'utf8');

    expect(code).toContain('exportDocumentsHtml');
    expect(code).toContain('handleDownloadHtml');
    expect(code).toContain('isDownloadingHtml');
    expect(code).toContain('导出单文件 HTML');
    expect(code).toContain('-spec.html');
  });

  it('2. Verifies defaultApiClient exposes Stage S2 export methods', () => {
    expect(typeof defaultApiClient.exportDocumentsHtml).toBe('function');
    expect(typeof defaultApiClient.exportDocumentsHtmlMeta).toBe('function');
  });
});
