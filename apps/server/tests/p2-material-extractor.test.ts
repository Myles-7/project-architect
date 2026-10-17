import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { createApp } from '../src/server.js';
import { DocumentExtractor } from '../src/extractors/DocumentExtractor.js';
import { FileStorage } from '@project-architect/core';
import mammoth from 'mammoth';

// A complete ASCII PDF fixture, including a real page tree and xref offsets.
function makePdf(pageTexts: string[]): Buffer {
  const pageIds = pageTexts.map((_, index) => 4 + index * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (const [index, pageText] of pageTexts.entries()) {
    const escaped = pageText.replace(/([\\()])/g, '\\$1');
    const stream = `BT /F1 12 Tf 50 740 Td (${escaped}) Tj ET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const lastPageRequirement = `LAST_PAGE_REQUIRED_${randomUUID().replaceAll('-', '')}`;
const longPdf = makePdf(Array.from({ length: 51 }, (_, index) => index === 50 ? lastPageRequirement : `Material page ${index + 1}`));
const firstFiftyPages = Array.from({ length: 50 }, (_, index) => ({ num: index + 1, text: `Material page ${index + 1}` }));

describe('P2 Material Extractor & Safety Guard (apps/server)', () => {
  let app: any;
  let testProjectDir: string;
  let projectId: string;
  let stateRev = 1;
  const storage = new FileStorage();

  beforeEach(async () => {
    testProjectDir = join(tmpdir(), `pa-p2-extractor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    app = createApp({ useMockAI: true, workspaceRoot: testProjectDir });

    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Extractor Test Project',
        idea: 'Testing PDF and DOCX safe material ingestion',
      });
    expect(createRes.status).toBe(200);
    projectId = createRes.body.data.projectId;
    stateRev = createRes.body.stateRevision;
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
    vi.restoreAllMocks();
  });

  describe('DocumentExtractor Unit Safety Boundaries', () => {
    it('extracts the random final-page requirement and page markers from all 51 PDF pages', async () => {
      const result = await DocumentExtractor.extractDocumentSafely(longPdf, '.pdf');
      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(51);
      expect(result.extractedPageCount).toBe(51);
      expect(result.pages?.map(page => page.num)).toEqual(Array.from({ length: 51 }, (_, index) => index + 1));
      expect(result.pages?.at(-1)?.text).toContain(lastPageRequirement);
      expect(result.text).toContain(lastPageRequirement);
      expect(result.text).toContain('-- 1 of 51 --');
      expect(result.text).toContain('-- 51 of 51 --');
      expect(result.text).not.toContain('Only the first');
    });

    it('rejects incomplete PDF page coverage instead of returning partial text as success', async () => {
      vi.spyOn(PDFParse.prototype, 'getText').mockResolvedValue({ total: 51, text: 'first fifty pages only', pages: firstFiftyPages } as any);
      const result = await DocumentExtractor.extractDocumentSafely(longPdf, '.pdf');
      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.pageCount).toBe(51);
      expect(result.extractedPageCount).toBe(50);
      expect(result.error).toContain('Incomplete PDF extraction');
    });

    it.each([
      { name: 'duplicate page number', total: 51, pages: [...firstFiftyPages, { num: 50, text: 'duplicate' }] },
      { name: 'out-of-range page number', total: 51, pages: [...firstFiftyPages, { num: 52, text: 'invalid' }] },
      { name: 'mismatched reported total', total: 50, pages: [...firstFiftyPages, { num: 51, text: 'last page' }] },
    ])('rejects $name despite a complete-sized page array', async ({ total, pages }) => {
      vi.spyOn(PDFParse.prototype, 'getText').mockResolvedValue({ total, pages, text: 'looks complete' } as any);
      const result = await DocumentExtractor.extractDocumentSafely(longPdf, '.pdf');
      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.pageCount).toBe(51);
      expect(result.extractedPageCount).toBe(51);
      expect(result.error).toContain('Incomplete PDF extraction');
    });

    it('retains the known PDF page count when text extraction fails and destroys the parser', async () => {
      vi.spyOn(PDFParse.prototype, 'getText').mockRejectedValue(new Error('unable to read page 51'));
      const destroy = vi.spyOn(PDFParse.prototype, 'destroy');
      const result = await DocumentExtractor.extractDocumentSafely(longPdf, '.pdf');
      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.pageCount).toBe(51);
      expect(result.extractedPageCount).toBeUndefined();
      expect(result.error).toContain('unable to read page 51');
      expect(destroy).toHaveBeenCalledOnce();
    });

    it('does not treat page markers alone as extracted text for an empty PDF', async () => {
      const result = await DocumentExtractor.extractDocumentSafely(makePdf(['']), '.pdf');
      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.pageCount).toBe(1);
      expect(result.extractedPageCount).toBe(1);
      expect(result.error).toContain('no extractable text');
    });

    it('keeps legitimate blank pages and their positions when other PDF pages contain text', async () => {
      const result = await DocumentExtractor.extractDocumentSafely(makePdf(['', lastPageRequirement, '']), '.pdf');
      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(3);
      expect(result.extractedPageCount).toBe(3);
      expect(result.pages).toEqual([{ num: 1, text: '' }, { num: 2, text: lastPageRequirement }, { num: 3, text: '' }]);
      expect(result.text).toContain('-- 1 of 3 --');
      expect(result.text).toContain(lastPageRequirement);
      expect(result.text).toContain('-- 3 of 3 --');
    });

    it('rejects files exceeding 20MB safety limit', async () => {
      // 21MB virtual buffer
      const oversizedBuffer = Buffer.alloc(21 * 1024 * 1024, 0);
      const result = await DocumentExtractor.extractDocumentSafely(oversizedBuffer, '.pdf');
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds safety limit of 20MB');
    });

    it('rejects unsupported file formats gracefully', async () => {
      const buffer = Buffer.from('hello world');
      const result = await DocumentExtractor.extractDocumentSafely(buffer, '.exe');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported document format');
    });

    it('guards against zip bomb expansion ratio (>100:1) in DOCX extraction', async () => {
      const tinyBuffer = Buffer.from('tiny-docx-binary'); // ~16 bytes
      // Mock mammoth returning huge text (> 100x buffer size)
      const hugeText = 'A'.repeat(50000); // 50,000 chars vs 16 bytes = >3000:1
      vi.spyOn(mammoth, 'extractRawText').mockResolvedValue({
        value: hugeText,
        messages: [],
      } as any);

      const result = await DocumentExtractor.extractDocumentSafely(tinyBuffer, '.docx');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Potential zip bomb detected');
    });

    it('safely extracts DOCX text when within safety limits', async () => {
      const sampleDocx = Buffer.alloc(2000, 1);
      vi.spyOn(mammoth, 'extractRawText').mockResolvedValue({
        value: 'System Architecture Requirements: Must be offline-first and zero-cloud.',
        messages: [],
      } as any);

      const result = await DocumentExtractor.extractDocumentSafely(sampleDocx, '.docx');
      expect(result.success).toBe(true);
      expect(result.text).toContain('System Architecture Requirements');
    });
  });

  describe('HTTP /api/projects/:id/inputs Integration with DocumentExtractor', () => {
    it('records a PDF with no extractable body text as failed instead of accepting page markers', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({ kind: 'file', filename: 'no-text.pdf', content: makePdf(['', '']).toString('base64'), contentEncoding: 'base64', expectedRevision: stateRev })
        .expect(200);
      expect(res.body.data.inputRef.status).toBe('failed');
      expect(res.body.data.inputRef.analysisAvailability).toBe('unavailable');
      const inputId = res.body.data.inputRef.id.replace('input:', '');
      const extraction = await storage.readJson<any>(join(testProjectDir, 'projects', projectId, 'inputs', inputId, 'extraction.json'));
      expect(extraction.status).toBe('failed');
      expect(extraction.extractedText).toBe('');
      expect(extraction.errorMessage).toBeTruthy();
    });

    it('stores the complete 51-page PDF text with its final-page constraint and positions', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({ kind: 'file', filename: 'complete.pdf', content: longPdf.toString('base64'), contentEncoding: 'base64', expectedRevision: stateRev })
        .expect(200);
      expect(res.body.data.inputRef.status).toBe('ready');
      expect(res.body.data.inputRef.analysisAvailability).toBe('available');
      const inputId = res.body.data.inputRef.id.replace('input:', '');
      const extraction = await storage.readJson<any>(join(testProjectDir, 'projects', projectId, 'inputs', inputId, 'extraction.json'));
      expect(extraction.extractedText).toContain(lastPageRequirement);
      expect(extraction.extractedText).toContain('-- 51 of 51 --');
      expect(extraction.extractedText).not.toContain('Only the first');
    });

    it('never marks partial PDF extraction ready or available', async () => {
      vi.spyOn(PDFParse.prototype, 'getText').mockResolvedValue({ total: 51, text: 'first fifty pages only', pages: firstFiftyPages } as any);
      const res = await request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({ kind: 'file', filename: 'incomplete.pdf', content: longPdf.toString('base64'), contentEncoding: 'base64', expectedRevision: stateRev })
        .expect(200);
      expect(res.body.data.inputRef.status).toBe('failed');
      expect(res.body.data.inputRef.analysisAvailability).toBe('unavailable');
      const inputId = res.body.data.inputRef.id.replace('input:', '');
      const extraction = await storage.readJson<any>(join(testProjectDir, 'projects', projectId, 'inputs', inputId, 'extraction.json'));
      expect(extraction.extractedText).toBe('');
      expect(extraction.status).toBe('failed');
    });

    it('extracts DOCX input, writes extraction.json, and sets ready status with analysis available', async () => {
      vi.spyOn(mammoth, 'extractRawText').mockResolvedValue({
        value: 'Feature specifications: 1. Native playback 2. Bit-perfect output.',
        messages: [],
      } as any);

      const mockDocxBase64 = Buffer.from('fake-docx-content-payload-for-test-30-bytes').toString('base64');
      const res = await request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({
          kind: 'file',
          filename: 'specifications.docx',
          content: mockDocxBase64,
          contentEncoding: 'base64',
          expectedRevision: stateRev,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.inputRef.status).toBe('ready');
      expect(res.body.data.inputRef.analysisAvailability).toBe('available');

      // Verify extraction.json exists in storage
      const inputId = res.body.data.inputRef.id.replace('input:', '');
      const projectPath = join(testProjectDir, 'projects', projectId);
      const extractionPath = join(projectPath, 'inputs', inputId, 'extraction.json');
      const extractionData = await storage.readJson<any>(extractionPath);

      expect(extractionData.status).toBe('ready');
      expect(extractionData.analysisAvailability).toBe('available');
      expect(extractionData.extractedText).toContain('Feature specifications');
      expect(res.body.data.inputRef.summary).toContain('Feature specifications');
    });

    it('gracefully falls back to unextracted when extractor fails without crashing the request', async () => {
      // Send corrupted PDF
      const corruptedPdfBase64 = Buffer.from('NOT_A_VALID_PDF_STREAM').toString('base64');
      const res = await request(app)
        .post(`/api/projects/${projectId}/inputs`)
        .send({
          kind: 'file',
          filename: 'broken.pdf',
          content: corruptedPdfBase64,
          contentEncoding: 'base64',
          expectedRevision: stateRev,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      // Fallback input ref is recorded
      expect(res.body.data.inputRef.label).toBe('broken.pdf');
    });
  });
});
