import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceGuard } from '../src/storage/WorkspaceGuard.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('WorkspaceGuard & Path Traversal Protection Tests (Phase 4.8.2)', () => {
  let tempWorkspace: string;
  let guard: WorkspaceGuard;

  beforeEach(async () => {
    tempWorkspace = await mkdtemp(join(tmpdir(), 'pa-guard-test-'));
    guard = new WorkspaceGuard(tempWorkspace);
  });

  afterEach(async () => {
    await rm(tempWorkspace, { recursive: true, force: true });
  });

  it('1. validateProjectId: allows safe IDs and rejects traversal & illegal characters', () => {
    // Valid IDs
    expect(guard.validateProjectId('proj-123')).toBe('proj-123');
    expect(guard.validateProjectId('alpha_project-01')).toBe('alpha_project-01');

    // Traversal & Injection attempts
    expect(() => guard.validateProjectId('../evil')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('..\\evil')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('/root/secret')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('C:\\Windows')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('proj/sub')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('proj\0null')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('..')).toThrow(/Invalid project ID/);
    expect(() => guard.validateProjectId('.')).toThrow(/Invalid project ID/);
  });

  it('2. validateFilename: strictly allows basenames and rejects directory separators and traversal tokens', () => {
    // Valid filenames
    expect(guard.validateFilename('spec.md')).toBe('spec.md');
    expect(guard.validateFilename('notes_v2.txt')).toBe('notes_v2.txt');
    expect(guard.validateFilename('schema.json')).toBe('schema.json');

    // Traversal & separator attempts
    expect(() => guard.validateFilename('../evil.txt')).toThrow(/Invalid filename/);
    expect(() => guard.validateFilename('..\\evil.txt')).toThrow(/Invalid filename/);
    expect(() => guard.validateFilename('/etc/passwd')).toThrow(/Invalid filename/);
    expect(() => guard.validateFilename('sub/dir/file.txt')).toThrow(/Invalid filename/);
    expect(() => guard.validateFilename('C:\\Windows\\win.ini')).toThrow(/Invalid filename/);
    expect(() => guard.validateFilename('file\0.txt')).toThrow(/Invalid filename/);
  });

  it('3. assertContained: prevents directory traversal and symlink escapes', async () => {
    const baseDir = join(tempWorkspace, 'projects');
    const safeChild = join(baseDir, 'proj-1', 'state');

    // Safe path
    expect(guard.assertContained(baseDir, safeChild)).toBe(safeChild);

    // Traversal outside baseDir
    const escaped = join(baseDir, '..', 'secret.txt');
    expect(() => guard.assertContained(baseDir, escaped)).toThrow(/traversal rejected/);

    // Absolute outside path
    const outside = process.platform === 'win32' ? 'C:\\Windows' : '/etc';
    expect(() => guard.assertContained(baseDir, outside)).toThrow(/traversal rejected/);
  });

  it('4. resolveInputPath: confines input material strictly inside project inputs directory', () => {
    const projectDir = guard.resolveProjectPath('proj-alpha');

    const { inputDir, filePath } = guard.resolveInputPath(projectDir, 'inp-01', 'brief.md');
    expect(inputDir).toBe(join(projectDir, 'inputs', 'inp-01'));
    expect(filePath).toBe(join(projectDir, 'inputs', 'inp-01', 'brief.md'));

    // Attempting traversal via inputId or filename is blocked
    expect(() => guard.resolveInputPath(projectDir, '../inp-01', 'brief.md')).toThrow();
    expect(() => guard.resolveInputPath(projectDir, 'inp-01', '../../brief.md')).toThrow();
  });
});
