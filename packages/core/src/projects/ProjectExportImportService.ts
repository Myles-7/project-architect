import { join, resolve, relative } from 'node:path';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { constants as bufferConstants } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { FileStorage } from '../storage/FileStorage.js';
import { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import { ErrorCode, type ProjectSnapshot } from '@project-architect/contracts';
import { assertTransferTree, prepareProjectTransfer, promoteProjectTransfer, verifyTransferSource } from './ProjectTransfer.js';
import { StateCommitManager } from '../commit/StateCommitManager.js';

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

/** Classic ZIP field widths are a file-format limit, not a planning budget. */
export function validateProjectZipLayout(entries: Array<{ nameBytes: number; dataBytes: number }>): { localBytes: number; centralBytes: number; totalBytes: number } {
  const invalid = (message: string): never => {
    const error = new Error(`Project ZIP ${message}`) as Error & { code: string };
    error.code = ErrorCode.STATE_VALIDATION_FAILED;
    throw error;
  };
  if (entries.length > 0xffff) invalid('entry count exceeds the classic ZIP limit of 65535');
  let localBytes = 0, centralBytes = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.nameBytes) || entry.nameBytes < 1 || entry.nameBytes > 0xffff) invalid('file name must contain 1–65535 UTF-8 bytes');
    if (!Number.isSafeInteger(entry.dataBytes) || entry.dataBytes < 0 || entry.dataBytes > 0xffffffff) invalid('file size exceeds the 32-bit ZIP limit');
    localBytes += 30 + entry.nameBytes + entry.dataBytes;
    centralBytes += 46 + entry.nameBytes;
    if (localBytes > 0xffffffff || centralBytes > 0xffffffff) invalid('local records or central directory exceed the 32-bit ZIP limit');
  }
  const totalBytes = localBytes + centralBytes + 22;
  if (totalBytes > bufferConstants.MAX_LENGTH) invalid('archive exceeds the supported buffer size');
  return { localBytes, centralBytes, totalBytes };
}

export interface ExportProjectResult {
  zipBuffer: Buffer;
  projectId: string;
  filename: string;
  filesCount: number;
  totalBytes: number;
}

export interface ImportProjectResult {
  projectId: string;
  projectPath: string;
  snapshot: ProjectSnapshot;
  renamed: boolean;
}

export class ProjectExportImportService {
  private storage: FileStorage;

  constructor(storage: FileStorage = new FileStorage()) {
    this.storage = storage;
  }

  /**
   * Recursively collects all files within a directory relative to project root.
   */
  private async collectProjectFiles(
    dir: string,
    baseDir: string
  ): Promise<Array<{ relPath: string; absPath: string }>> {
    const entries = await this.storage.listFiles(dir);
    const files: Array<{ relPath: string; absPath: string }> = [];

    for (const entry of entries) {
      const absPath = join(dir, entry);
      const rel = relative(baseDir, absPath).replace(/\\/g, '/');
      // Only these root-state paths are Core's transient commit files. The
      // same basenames in materials or historical records are ordinary data.
      if (rel === 'state/.commit_staging' || rel === 'state/.commit_marker.json') continue;
      const isDir = await this.storage.isDirectory(absPath);
      if (isDir) {
        const sub = await this.collectProjectFiles(absPath, baseDir);
        files.push(...sub);
      } else {
        files.push({ relPath: rel, absPath });
      }
    }
    return files;
  }

  /**
   * Packs an entire project directory into a single standalone `.pa.zip` buffer.
   */
  async exportProject(projectPath: string): Promise<ExportProjectResult> {
    const path = resolve(projectPath);
    return new StateCommitManager(this.storage).withProjectLock(path, async () => {
      await assertTransferTree(path);
      const { metadata } = await verifyTransferSource(path, this.storage);
      return this.exportLocked(path, metadata);
    });
  }

  private async exportLocked(projectPath: string, metadata: { projectId: string; name: string }): Promise<ExportProjectResult> {
    const files = await this.collectProjectFiles(projectPath, projectPath);
    const entries = [];
    for (const file of files) entries.push({ nameBytes: Buffer.byteLength(file.relPath, 'utf8'), dataBytes: (await stat(file.absPath)).size });
    validateProjectZipLayout(entries);

    const filesToArchive: Array<{ path: string; data: Uint8Array }> = [];
    for (const f of files) {
      const buffer = await this.storage.readBuffer(f.absPath);
      filesToArchive.push({
        path: f.relPath,
        data: buffer,
      });
    }

    const zipBuffer = this.buildZipBuffer(filesToArchive);
    const safeName = (metadata.name || metadata.projectId || 'project')
      .replace(/[^\w\u4e00-\u9fa5\-_]/g, '_');
    const filename = `${safeName}-${metadata.projectId}.pa.zip`;

    return {
      zipBuffer,
      projectId: metadata.projectId,
      filename,
      filesCount: filesToArchive.length,
      totalBytes: zipBuffer.length,
    };
  }

  /**
   * Extracts and validates a `.pa.zip` project bundle into the workspace.
   */
  async importProject(
    zipBuffer: Buffer,
    workspaceProjectsDir: string,
    targetProjectId?: string
  ): Promise<ImportProjectResult> {
    const extractedFiles = this.extractZip(zipBuffer);
    const rootMetadata = extractedFiles.filter(file => file.path === 'project.json');
    // Our archives have a root metadata file. Also accept one common wrapper
    // directory, while keeping nested material/history project.json as data.
    const metadataEntries = rootMetadata.length ? rootMetadata : extractedFiles.filter(file => /^[^/]+\/project\.json$/.test(file.path));
    if (metadataEntries.length !== 1) {
      const error = new Error('Invalid project bundle: exactly one project.json is required.') as Error & { code: string };
      error.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw error;
    }
    const metadataEntry = metadataEntries[0]!;
    const prefix = metadataEntry.path.slice(0, -'project.json'.length);
    const projectsDir = resolve(workspaceProjectsDir);
    const guard = new WorkspaceGuard(projectsDir);
    if (targetProjectId !== undefined) guard.validateProjectId(targetProjectId);
    // The staging container has no project.json and is on the destination filesystem.
    await mkdir(projectsDir, { recursive: true });
    const stagingRoot = await mkdtemp(join(projectsDir, '.import-'));
    const stagingPath = join(stagingRoot, 'project');
    try {
      const seen = new Set<string>();
      for (const file of extractedFiles) {
        if (!file.path.startsWith(prefix)) throw new Error('Invalid project bundle: files outside project root');
        const relative = file.path.slice(prefix.length);
        const segments = relative.split('/');
        if (!relative || segments.some(segment => !segment || segment === '.' || segment === '..' || /[:\x00]/.test(segment) || (process.platform === 'win32' && (/[. ]$/.test(segment) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))))) {
          throw new Error('Invalid project bundle: unsafe file path');
        }
        const key = process.platform === 'win32' ? relative.toLowerCase() : relative;
        if (seen.has(key)) throw new Error('Invalid project bundle: duplicate file path');
        seen.add(key);
        const destination = guard.assertContained(stagingPath, join(stagingPath, relative), 'Extracted project file');
        await this.storage.writeBuffer(destination, file.data);
      }
      const { metadata } = await verifyTransferSource(stagingPath, this.storage);
      let projectId = guard.validateProjectId(targetProjectId ?? metadata.projectId);
      let projectPath = guard.assertContained(projectsDir, join(projectsDir, projectId), 'Project import path');
      let renamed = false;
      if (await this.storage.exists(projectPath)) {
        renamed = true;
        const base = `${projectId}-imported-${Date.now().toString(36)}`;
        let counter = 0;
        do {
          projectId = counter ? `${base}-${counter}` : base;
          projectPath = guard.assertContained(projectsDir, join(projectsDir, projectId), 'Project import path');
          counter++;
        } while (await this.storage.exists(projectPath));
      }
      const { ProjectStateEngine } = await import('../engine/ProjectStateEngine.js');
      const engine = new ProjectStateEngine(this.storage, guard);
      const snapshot = await prepareProjectTransfer({
        stagingPath, projectId, name: renamed ? `${metadata.name} (导入副本)` : metadata.name,
        kind: 'import', storage: this.storage, engine,
      });
      await promoteProjectTransfer(stagingPath, projectPath, this.storage);
      return { projectId, projectPath, snapshot, renamed };
    } finally {
      await rm(stagingRoot, { recursive: true, force: true });
    }
  }

  private extractZip(zipBuffer: Buffer): Array<{ path: string; data: Buffer }> {
    const files: Array<{ path: string; data: Buffer }> = [];
    const len = zipBuffer.length;
    const invalidZip = (message: string): never => {
      const error = new Error(`Invalid zip format: ${message}`) as Error & { code: string };
      error.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw error;
    };

    // Find EOCD (PK\x05\x06) in last 65KB
    let eocdOffset = -1;
    for (let i = len - 22; i >= Math.max(0, len - 65557); i--) {
      if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      const err: any = new Error('Invalid zip format: EOCD not found.');
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    const cdCount = zipBuffer.readUInt16LE(eocdOffset + 10);
    const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
    const cdSize = zipBuffer.readUInt32LE(eocdOffset + 12);
    if (zipBuffer.readUInt16LE(eocdOffset + 4) !== 0 || zipBuffer.readUInt16LE(eocdOffset + 6) !== 0 || zipBuffer.readUInt16LE(eocdOffset + 8) !== cdCount || cdOffset + cdSize !== eocdOffset || eocdOffset + 22 + zipBuffer.readUInt16LE(eocdOffset + 20) !== len) invalidZip('incomplete or unsupported central directory');

    let offset = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      if (offset + 46 > eocdOffset) invalidZip('truncated central directory');
      const sig = zipBuffer.readUInt32LE(offset);
      if (sig !== 0x02014b50) invalidZip('invalid central directory header');

      const compression = zipBuffer.readUInt16LE(offset + 10);
      const flags = zipBuffer.readUInt16LE(offset + 8);
      const crc = zipBuffer.readUInt32LE(offset + 16);
      const compSize = zipBuffer.readUInt32LE(offset + 20);
      const originalSize = zipBuffer.readUInt32LE(offset + 24);
      const nameLen = zipBuffer.readUInt16LE(offset + 28);
      const extraLen = zipBuffer.readUInt16LE(offset + 30);
      const commentLen = zipBuffer.readUInt16LE(offset + 32);
      const localOffset = zipBuffer.readUInt32LE(offset + 42);
      if (offset + 46 + nameLen + extraLen + commentLen > eocdOffset || flags & 1 || ![0, 8].includes(compression)) invalidZip('truncated or unsupported entry');

      const filePath = zipBuffer.toString('utf8', offset + 46, offset + 46 + nameLen);
      offset += 46 + nameLen + extraLen + commentLen;

      if (filePath.endsWith('/')) continue; // Skip directory entries

      // Read from Local Header
      if (localOffset + 30 > cdOffset) invalidZip('truncated local header');
      const localSig = zipBuffer.readUInt32LE(localOffset);
      if (localSig !== 0x04034b50 || zipBuffer.readUInt16LE(localOffset + 8) !== compression || zipBuffer.readUInt16LE(localOffset + 6) !== flags) invalidZip('invalid local header');
      const localNameLen = zipBuffer.readUInt16LE(localOffset + 26);
      const localExtraLen = zipBuffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      if (dataStart + compSize > cdOffset || zipBuffer.toString('utf8', localOffset + 30, localOffset + 30 + localNameLen) !== filePath) invalidZip('entry path or size mismatch');
      const compressedData = zipBuffer.subarray(dataStart, dataStart + compSize);

      const decompressedData = compression === 0 ? Buffer.from(compressedData) : inflateRawSync(compressedData);
      if (decompressedData.length !== originalSize || calculateCrc32(decompressedData) !== crc) invalidZip(`entry checksum mismatch: ${filePath}`);

      files.push({
        path: filePath.replace(/\\/g, '/'),
        data: decompressedData,
      });
    }
    if (offset !== eocdOffset) invalidZip('central directory count mismatch');

    return files;
  }

  private buildZipBuffer(files: Array<{ path: string; data: Uint8Array }>): Buffer {
    // Check the complete layout before checksum scans, header writes or archive allocation.
    const layout = validateProjectZipLayout(files.map(file => ({ nameBytes: Buffer.byteLength(file.path.replace(/\\/g, '/'), 'utf8'), dataBytes: file.data.byteLength })));
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

      const header = new Uint8Array(30 + pathBytes.length);
      const view = new DataView(header.buffer);

      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true); // Stored
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, dataBytes.length, true);
      view.setUint32(22, dataBytes.length, true);
      view.setUint16(26, pathBytes.length, true);
      view.setUint16(28, 0, true);

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

      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 0, true);
      view.setUint32(16, record.crc, true);
      view.setUint32(20, record.dataBytes.length, true);
      view.setUint32(24, record.dataBytes.length, true);
      view.setUint16(28, record.pathBytes.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, record.offset, true);

      cdHeader.set(record.pathBytes, 46);

      centralChunks.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    // End of Central Directory Record
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, fileRecords.length, true);
    eocdView.setUint16(10, fileRecords.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, currentOffset, true);
    eocdView.setUint16(20, 0, true);

    const totalLength = layout.totalBytes;
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
