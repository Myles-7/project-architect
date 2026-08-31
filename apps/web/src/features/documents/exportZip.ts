/**
 * Pure TypeScript ZIP file generator for browser downloads.
 * Uses standard ZIP format (Store / No compression) to guarantee 100% compatibility across all OSes.
 */

// CRC32 table
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
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
  path: string; // e.g. "AGENTS.md" or "docs/PROJECT.md"
  content: string | Uint8Array;
}

export function createZipArchive(files: ZipFileEntry[]): Blob {
  const encoder = new TextEncoder();
  const fileRecords: {
    pathBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const localChunks: Uint8Array[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const pathBytes = encoder.encode(file.path.replace(/\\/g, '/'));
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = calculateCrc32(dataBytes);

    // Local file header (30 bytes + path length + data length)
    const header = new Uint8Array(30 + pathBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract (2.0)
    view.setUint16(6, 0x0800, true); // General purpose bit flag (Bit 11: UTF-8 encoding)
    view.setUint16(8, 0, true); // Compression method (0 = store)

    view.setUint16(10, 0, true); // Last mod file time
    view.setUint16(12, 0, true); // Last mod file date
    view.setUint32(14, crc, true); // CRC-32
    view.setUint32(18, dataBytes.length, true); // Compressed size
    view.setUint32(22, dataBytes.length, true); // Uncompressed size
    view.setUint16(26, pathBytes.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length

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

  // Central Directory Records
  const centralChunks: Uint8Array[] = [];
  let centralDirSize = 0;

  for (const record of fileRecords) {
    const cdHeader = new Uint8Array(46 + record.pathBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // Central file header signature
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed to extract
    view.setUint16(8, 0x0800, true); // General purpose bit flag (Bit 11: UTF-8 encoding)
    view.setUint16(10, 0, true); // Compression method (0 = store)

    view.setUint16(12, 0, true); // Last mod file time
    view.setUint16(14, 0, true); // Last mod file date
    view.setUint32(16, record.crc, true); // CRC-32
    view.setUint32(20, record.dataBytes.length, true); // Compressed size
    view.setUint32(24, record.dataBytes.length, true); // Uncompressed size
    view.setUint16(28, record.pathBytes.length, true); // File name length
    view.setUint16(30, 0, true); // Extra field length
    view.setUint16(32, 0, true); // File comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal file attributes
    view.setUint32(38, 0, true); // External file attributes
    view.setUint32(42, record.offset, true); // Relative offset of local header

    cdHeader.set(record.pathBytes, 46);

    centralChunks.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true); // End of central dir signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, fileRecords.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, fileRecords.length, true); // Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, currentOffset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  const allChunks = [...localChunks, ...centralChunks, eocd];
  const totalLength = allChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of allChunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([combined.buffer], {
    type: 'application/zip',
  });
}

export function downloadZip(filename: string, files: ZipFileEntry[]) {

  const blob = createZipArchive(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
