import { join } from 'node:path';
import { FileStorage } from '../storage/FileStorage.js';
import { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import { ErrorCode, type DocumentManifest } from '@project-architect/contracts';

// Precomputed CRC-32 table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    const tableVal = CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableVal ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface DocumentExportResult {
  zipBuffer: Buffer;
  filesCount: number;
  filePaths: string[];
  totalBytes: number;
}

export class DocumentExportService {
  private storage: FileStorage;

  constructor(storage: FileStorage = new FileStorage()) {
    this.storage = storage;
  }

  createZip(files: Array<{ path: string; data: Uint8Array }>): Buffer {
    return this.buildZipBuffer(files);
  }

  /**
   * Generates a complete ZIP archive of all compiled project documents in memory.
   *
   * ATOMIC GUARANTEE:
   * If any single document in the manifest is missing or unreadable, the entire
   * export FAILS completely with a detailed list of missing files. It NEVER returns
   * a partial or corrupted ZIP archive.
   */
  async exportZip(projectPath: string): Promise<DocumentExportResult> {
    const guard = new WorkspaceGuard(projectPath);
    const manifestPath = join(projectPath, 'documents', 'manifest.json');
    const legacyPath = join(projectPath, 'documents.json');

    let manifest: DocumentManifest | null = null;
    if (await this.storage.exists(manifestPath)) {
      manifest = await this.storage.readJson<DocumentManifest>(manifestPath);
    } else if (await this.storage.exists(legacyPath)) {
      manifest = await this.storage.readJson<DocumentManifest>(legacyPath);
    }

    if (!manifest) {
      const err: any = new Error(
        `Cannot export document archive: No compiled document manifest found at ${projectPath}. Documents must be compiled before exporting.`
      );
      err.code = ErrorCode.DOCUMENT_NOT_FOUND;
      throw err;
    }

    const docItems = manifest.documents || manifest.items || [];
    if (docItems.length === 0) {
      const err: any = new Error('Cannot export document archive: Document manifest contains 0 items.');
      err.code = ErrorCode.DOCUMENT_NOT_FOUND;
      throw err;
    }

    const missingOrUnreadable: string[] = [];
    const filesToArchive: Array<{ path: string; data: Uint8Array }> = [];

    for (const item of docItems) {
      const relPath = item.path;
      const absPath = guard.assertContained(projectPath, join(projectPath, relPath), 'Document export path');
      try {
        if (!(await this.storage.exists(absPath))) {
          missingOrUnreadable.push(relPath);
          continue;
        }
        const text = await this.storage.readText(absPath);
        filesToArchive.push({
          path: relPath,
          data: Buffer.from(text, 'utf8'),
        });
      } catch {
        missingOrUnreadable.push(relPath);
      }
    }

    // Atomic All-or-Nothing check
    if (missingOrUnreadable.length > 0) {
      const err: any = new Error(
        `Atomic Document ZIP export failed. The following ${missingOrUnreadable.length} required file(s) could not be read:\n${missingOrUnreadable.map((f) => `  - ${f}`).join('\n')}`
      );
      err.code = ErrorCode.DOCUMENT_GENERATION_FAILED;
      err.details = { missingFiles: missingOrUnreadable };
      throw err;
    }

    // Build standard PKZip Buffer
    const zipBuffer = this.buildZipBuffer(filesToArchive);

    return {
      zipBuffer,
      filesCount: filesToArchive.length,
      filePaths: filesToArchive.map((f) => f.path),
      totalBytes: zipBuffer.length,
    };
  }

  private buildZipBuffer(files: Array<{ path: string; data: Uint8Array }>): Buffer {
    const encoder = new TextEncoder();
    const fileRecords: Array<{
      pathBytes: Uint8Array;
      dataBytes: Uint8Array;
      crc: number;
      offset: number;
    }> = [];

    const localChunks: Uint8Array[] = [];
    let currentOffset = 0;

    for (const file of files) {
      const pathBytes = encoder.encode(file.path.replace(/\\/g, '/'));
      const dataBytes = file.data;
      const crc = calculateCrc32(dataBytes);

      // Local header (30 bytes + path length + data length)
      const header = new Uint8Array(30 + pathBytes.length);
      const view = new DataView(header.buffer);

      view.setUint32(0, 0x04034b50, true); // Local file header signature (PK\x03\x04)
      view.setUint16(4, 20, true);          // Version needed to extract (2.0)
      view.setUint16(6, 0x0800, true);      // UTF-8 encoding flag
      view.setUint16(8, 0, true);           // Compression method (0 = store)
      view.setUint16(10, 0, true);          // Time
      view.setUint16(12, 0, true);          // Date
      view.setUint32(14, crc, true);        // CRC-32
      view.setUint32(18, dataBytes.length, true); // Compressed size
      view.setUint32(22, dataBytes.length, true); // Uncompressed size
      view.setUint16(26, pathBytes.length, true); // File name length
      view.setUint16(28, 0, true);          // Extra field length

      header.set(pathBytes, 30);

      fileRecords.push({
        pathBytes,
        dataBytes,
        crc,
        offset: currentOffset,
      });

      localChunks.push(header);
      localChunks.push(dataBytes);

      currentOffset += header.length + dataBytes.length;
    }

    // Central Directory
    const centralChunks: Uint8Array[] = [];
    let centralDirSize = 0;

    for (const record of fileRecords) {
      const cdHeader = new Uint8Array(46 + record.pathBytes.length);
      const view = new DataView(cdHeader.buffer);

      view.setUint32(0, 0x02014b50, true); // Central directory header signature (PK\x01\x02)
      view.setUint16(4, 20, true);          // Version made by
      view.setUint16(6, 20, true);          // Version needed to extract
      view.setUint16(8, 0x0800, true);      // UTF-8 flag
      view.setUint16(10, 0, true);          // Compression method (0 = store)
      view.setUint16(12, 0, true);          // Time
      view.setUint16(14, 0, true);          // Date
      view.setUint32(16, record.crc, true); // CRC-32
      view.setUint32(20, record.dataBytes.length, true); // Compressed size
      view.setUint32(24, record.dataBytes.length, true); // Uncompressed size
      view.setUint16(28, record.pathBytes.length, true); // File name length
      view.setUint16(30, 0, true);          // Extra field length
      view.setUint16(32, 0, true);          // Comment length
      view.setUint16(34, 0, true);          // Disk start
      view.setUint16(36, 0, true);          // Internal attributes
      view.setUint32(38, 0, true);          // External attributes
      view.setUint32(42, record.offset, true); // Relative offset of local header

      cdHeader.set(record.pathBytes, 46);

      centralChunks.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature (PK\x05\x06)
    eocdView.setUint16(4, 0, true);          // Disk number
    eocdView.setUint16(6, 0, true);          // Central directory disk
    eocdView.setUint16(8, fileRecords.length, true);  // Number of central directory records on this disk
    eocdView.setUint16(10, fileRecords.length, true); // Total number of central directory records
    eocdView.setUint32(12, centralDirSize, true);     // Size of central directory
    eocdView.setUint32(16, currentOffset, true);      // Offset of start of central directory
    eocdView.setUint16(20, 0, true);         // Comment length

    // Assemble final buffer
    const totalLength = currentOffset + centralDirSize + eocd.length;
    const finalBuffer = Buffer.alloc(totalLength);
    let writePos = 0;

    for (const chunk of localChunks) {
      finalBuffer.set(chunk, writePos);
      writePos += chunk.length;
    }
    for (const chunk of centralChunks) {
      finalBuffer.set(chunk, writePos);
      writePos += chunk.length;
    }
    finalBuffer.set(eocd, writePos);

    return finalBuffer;
  }
}
