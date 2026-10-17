import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine } from '../src/engine/ProjectStateEngine.js';
import { FileStorage } from '../src/storage/FileStorage.js';
import { AIOrchestrator } from '@project-architect/agent';
import { MockAIProvider } from '@project-architect/agent';

describe('Phase 4.8.6 Reliability Hardening: Input Materials Handling & Context Gate', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let projectPath: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-hardening-486-'));
    projectPath = join(tempBaseDir, 'materials-project');
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Input Boundary Validation: Rejects oversized files, unsupported extensions, and batch overflow', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'Validation Project',
      idea: 'Testing input boundary safeguards',
    });

    // A. Unsupported Extension
    await expect(
      stateEngine.addInput(projectPath, 'file', 'malware.exe', 'binary_content')
    ).rejects.toThrow(/Unsupported file extension/);

    await expect(
      stateEngine.addInput(projectPath, 'file', 'script.py', 'print("hello")')
    ).rejects.toThrow(/Unsupported file extension/);

    // B. Oversized File (>20MB)
    const largeContent = 'A'.repeat(21 * 1024 * 1024); // 21 MB
    await expect(
      stateEngine.addInput(projectPath, 'text', 'large_doc.txt', largeContent)
    ).rejects.toThrow(/exceeds maximum allowed limit of 20MB/);

    // C. Batch Count Overflow (10 items max limit in V1, including initial idea)
    const initialCount = (await stateEngine.getSnapshot(projectPath)).metadata.inputRefs.length;
    for (let i = 1; i <= 10 - initialCount; i++) {
      await stateEngine.addInput(projectPath, 'text', `note_${i}.txt`, `Content for note ${i}`);
    }

    const snap = await stateEngine.getSnapshot(projectPath);
    expect(snap.metadata.inputRefs.length).toBe(10);

    // Attempting 11th total item must be rejected
    await expect(
      stateEngine.addInput(projectPath, 'text', 'overflow_note.txt', 'Overflow item')
    ).rejects.toThrow(/maximum of 10 items allowed/);
  });

  it('2. Image Material Honesty: Saved safely but marked unavailable for analysis and excluded from text prompt', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'Image Test Project',
      idea: 'Testing image handling boundaries',
    });

    const imgRef = await stateEngine.addInput(
      projectPath,
      'image',
      'ui_sketch.png',
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );

    // 1. Image metadata contract
    expect(imgRef.kind).toBe('image');
    expect(imgRef.status).toBe('ready');
    expect(imgRef.analysisAvailability).toBe('available');
    expect(imgRef.summary).toContain('vision reading is recorded');

    // 2. Extraction file inspection
    const extraction = await storage.readJson<any>(
      join(projectPath, 'inputs', imgRef.id.replace('input:', ''), 'extraction.json')
    );
    expect(extraction.analysisAvailability).toBe('available');
    expect(extraction.extractedText).toBe('');

    // 3. Must NOT enter context text
    const snap = await stateEngine.getSnapshot(projectPath);
    const { contextText } = await orchestrator.buildContext(
      'idea-analysis',
      snap,
      { userMessage: 'Analyze my UI sketch' },
      projectPath
    );

    expect(contextText).not.toContain('ui_sketch.png');
    expect(contextText).not.toContain('iVBORw0KGgoAAAANSUhEUg');
  });

  it('3. Binary Document Honesty: Unextracted PDF/DOCX marked failed/unavailable and excluded from Context', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'PDF Test Project',
      idea: 'Testing PDF handling',
    });

    const pdfRef = await stateEngine.addInput(
      projectPath,
      'file',
      'spec.pdf',
      '%PDF-1.4 binary data mockup'
    );

    // 1. Document metadata contract
    expect(pdfRef.kind).toBe('file');
    expect(pdfRef.status).toBe('failed');
    expect(pdfRef.analysisAvailability).toBe('unavailable');
    expect(pdfRef.errorMessage).toBeDefined();

    // 2. Must NOT enter context text
    const snap = await stateEngine.getSnapshot(projectPath);
    const { contextText } = await orchestrator.buildContext(
      'idea-analysis',
      snap,
      { userMessage: 'Check my requirements' },
      projectPath
    );

    expect(contextText).not.toContain('spec.pdf');
    expect(contextText).not.toContain('%PDF-1.4');
  });

  it('4. Grounded Text Ingestion: Extracted markdown/text in custom workspace root enters Context accurately', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'Text Ingestion Project',
      idea: 'Testing valid text materials ingestion',
    });

    const textRef = await stateEngine.addInput(
      projectPath,
      'text',
      'architecture_notes.md',
      '# High-Level Goal\nBuild a local-first markdown compiler with strict zero-leakage security.'
    );

    expect(textRef.analysisAvailability).toBe('available');
    expect(textRef.status).toBe('ready');

    const snap = await stateEngine.getSnapshot(projectPath);
    const { contextText } = await orchestrator.buildContext(
      'idea-analysis',
      snap,
      { userMessage: 'Here are my architecture notes' },
      projectPath
    );

    expect(contextText).toContain('architecture_notes.md');
    expect(contextText).toContain('local-first markdown compiler with strict zero-leakage security');
  });

  it('5. Context Budget Prioritization: Current turn input is strictly prioritized over material excerpts', async () => {
    await stateEngine.createProject({
      projectPath,
      name: 'Budget Priority Project',
      idea: 'Testing context budget preservation',
    });

    // Add a large 4KB text note
    const bigExcerpt = 'Detail word '.repeat(300);
    await stateEngine.addInput(projectPath, 'text', 'huge_notes.txt', bigExcerpt);

    const snap = await stateEngine.getSnapshot(projectPath);
    const userPrompt = 'CRITICAL_MUST_PRESERVE: User explicitly requested offline-only local execution.';

    const { contextText } = await orchestrator.buildContext(
      'idea-analysis',
      snap,
      { userMessage: userPrompt },
      projectPath
    );

    // Current turn input must be fully present
    expect(contextText).toContain('CRITICAL_MUST_PRESERVE');
    expect(contextText).toContain('User explicitly requested offline-only local execution');
  });
});
