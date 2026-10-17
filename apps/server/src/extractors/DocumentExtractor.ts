import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export interface ExtractionResult {
  success: boolean;
  text: string;
  error?: string;
  pageCount?: number;
  extractedPageCount?: number;
  pages?: Array<{ num: number; text: string }>;
}

export class DocumentExtractor {
  static readonly MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
  static readonly TIMEOUT_MS = 10000; // 10s
  static readonly MAX_ZIP_BOMB_RATIO = 100; // 100:1

  static async extractDocumentSafely(
    fileBuffer: Buffer,
    ext: string
  ): Promise<ExtractionResult> {
    if (fileBuffer.byteLength > this.MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        text: '',
        error: `File size (${fileBuffer.byteLength} bytes) exceeds safety limit of 20MB.`,
      };
    }

    const normalizedExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<ExtractionResult>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${this.TIMEOUT_MS / 1000}s`));
      }, this.TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([
        this.doExtract(fileBuffer, normalizedExt),
        timeoutPromise,
      ]);
      return result;
    } catch (err: any) {
      return {
        success: false,
        text: '',
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private static async doExtract(
    fileBuffer: Buffer,
    ext: string
  ): Promise<ExtractionResult> {
    if (ext === '.pdf') {
      return this.extractPdf(fileBuffer);
    } else if (ext === '.docx') {
      return this.extractDocx(fileBuffer);
    } else {
      return {
        success: false,
        text: '',
        error: `Unsupported document format "${ext}" for extraction.`,
      };
    }
  }

  private static async extractPdf(fileBuffer: Buffer): Promise<ExtractionResult> {
    let parser: InstanceType<typeof PDFParse> | null = null;
    let pageCount: number | undefined;
    let extractedPageCount: number | undefined;
    try {
      parser = new PDFParse({ data: fileBuffer });
      const info = await parser.getInfo();
      if (!Number.isSafeInteger(info.total) || info.total < 1) {
        throw new Error(`Invalid PDF page count: ${info.total}.`);
      }
      pageCount = info.total;
      // Read the complete document. MCP transports this stored text in pages;
      // reducing a model's context must never remove source document pages.
      const textResult = await parser.getText();
      const pages = textResult.pages;
      extractedPageCount = Array.isArray(pages) ? pages.length : undefined;
      if (textResult.total !== pageCount || !Array.isArray(pages) || pages.length !== pageCount ||
          pages.some((page, index) => page.num !== index + 1 || typeof page.text !== 'string')) {
        throw new Error(`Incomplete PDF extraction: expected ${pageCount} ordered pages, received ${extractedPageCount ?? 'unknown'} page records with reported total ${textResult.total}.`);
      }
      if (!pages.some(page => page.text.trim().length > 0)) {
        throw new Error('PDF contains no extractable text.');
      }

      return {
        success: true,
        text: textResult.text.trim(),
        pageCount,
        extractedPageCount,
        pages: pages.map(page => ({ num: page.num, text: page.text })),
      };
    } catch (err: any) {
      return {
        success: false,
        text: '',
        error: `Failed to parse PDF: ${err?.message || String(err)}`,
        ...(pageCount === undefined ? {} : { pageCount }),
        ...(extractedPageCount === undefined ? {} : { extractedPageCount }),
      };
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // ignore cleanup error
        }
      }
    }
  }

  private static async extractDocx(fileBuffer: Buffer): Promise<ExtractionResult> {
    try {
      const mammothFn = (mammoth as any).extractRawText || (mammoth as any).default?.extractRawText;
      if (typeof mammothFn !== 'function') {
        throw new Error('Mammoth extractRawText function is unavailable.');
      }

      const result = await mammothFn({ buffer: fileBuffer });
      const text = (result?.value || '').trim();

      // Zip bomb protection: check ratio of extracted text to compressed buffer
      const expansionRatio = text.length / Math.max(1, fileBuffer.byteLength);
      if (expansionRatio > this.MAX_ZIP_BOMB_RATIO) {
        return {
          success: false,
          text: '',
          error: `Potential zip bomb detected: uncompressed text expansion ratio (${expansionRatio.toFixed(1)}:1) exceeds safety threshold of ${this.MAX_ZIP_BOMB_RATIO}:1.`,
        };
      }

      return {
        success: true,
        text,
      };
    } catch (err: any) {
      return {
        success: false,
        text: '',
        error: `Failed to parse DOCX: ${err?.message || String(err)}`,
      };
    }
  }
}
