import { expect, it } from 'vitest';
import * as archive from '../src/projects/ProjectExportImportService.js';

const service = new archive.ProjectExportImportService() as unknown as {
  buildZipBuffer(files: Array<{ path: string; data: Uint8Array }>): Buffer;
  extractZip(buffer: Buffer): Array<{ path: string; data: Buffer }>;
};

it('rejects a classic ZIP entry count overflow before returning a malformed successful archive', () => {
  const files = Array.from({ length: 65536 }, (_, index) => ({ path: `runtime/file-${index}`, data: new Uint8Array() }));
  expect(() => service.buildZipBuffer(files)).toThrow(/ZIP.*entry count.*65535/i);
});

it('checks UTF-8 bytes rather than characters before writing a 16-bit ZIP file name length', () => {
  expect(() => service.buildZipBuffer([{ path: '界'.repeat(21846), data: new Uint8Array() }])).toThrow(/ZIP.*file name.*65535/i);
});

it.each([
  ['file size', [{ nameBytes: 1, dataBytes: 0x100000000 }]],
  ['local records', [{ nameBytes: 1, dataBytes: 0xffffffff - 30 }]],
  ['central directory', Array.from({ length: 65506 }, () => ({ nameBytes: 65535, dataBytes: 0 }))],
])('preflights the 32-bit %s without allocating or scanning multi-gigabyte payloads', (_name, entries) => {
  const validate = (archive as any).validateProjectZipLayout;
  expect(() => validate(entries)).toThrow(/ZIP.*32-bit/i);
});

it('preflights actual builder payload sizes before reading bytes for a checksum', () => {
  const oversized = {
    byteLength: 0x100000000,
    get length(): number { throw new Error('Payload bytes were read before format validation'); },
  } as unknown as Uint8Array;
  expect(() => service.buildZipBuffer([{ path: 'payload.bin', data: oversized }])).toThrow(/ZIP.*32-bit/i);
});

it('accepts the maximum representable entry count without truncating it', () => {
  const files = Array.from({ length: 65535 }, (_, index) => ({ path: `runtime/file-${index}`, data: new Uint8Array() }));
  expect(service.extractZip(service.buildZipBuffer(files))).toHaveLength(65535);
});

it('accepts exactly 65535 UTF-8 bytes in a ZIP name', () => {
  const files = [{ path: '界'.repeat(21845), data: Buffer.from('preserved') }];
  expect(service.extractZip(service.buildZipBuffer(files))).toEqual(files);
});

it('retains valid UTF-8 archive paths and data after layout validation', () => {
  const files = [{ path: 'runtime/记录.txt', data: Buffer.from('原始回执\r\n') }];
  expect(service.extractZip(service.buildZipBuffer(files))).toEqual(files);
});
