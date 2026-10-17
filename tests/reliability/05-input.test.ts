import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine } from '../../packages/core/src/engine/ProjectStateEngine.js';
import { FileStorage } from '../../packages/core/src/storage/FileStorage.js';
import { AIOrchestrator } from '../../packages/agent/src/orchestrator/AIOrchestrator.js';
import { MockAIProvider } from '../../packages/agent/src/provider/MockAIProvider.js';

describe('Reliability Suite 5: Input Materials & Context Boundary', () => {
  let tempBaseDir: string;
  let projectPath: string;
  let storage: FileStorage;
  let engine: ProjectStateEngine;
  let orchestrator: AIOrchestrator;
  let mockProvider: MockAIProvider;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-rel-inp-'));
    projectPath = join(tempBaseDir, 'input-project');
    storage = new FileStorage();
    engine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, engine, process.cwd(), storage);

    await engine.createProject({
      projectPath,
      name: 'Input Verification Project',
      idea: 'Testing input boundaries',
    });
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Input Safeguards: Enforces 20MB limit, 10 items limit, and extension whitelist', async () => {
    // 1.1 Invalid extension
    await expect(
      engine.addInput(projectPath, 'file', 'binary.bin', 'data')
    ).rejects.toThrow(/Unsupported file extension/);

    // 1.2 Oversized file (>20MB)
    const huge = 'X'.repeat(21 * 1024 * 1024);
    await expect(
      engine.addInput(projectPath, 'text', 'huge.txt', huge)
    ).rejects.toThrow(/exceeds maximum allowed limit of 20MB/);

    // 1.3 Batch limit (10 items total)
    const initialCount = (await engine.getSnapshot(projectPath)).metadata.inputRefs.length;
    for (let i = 1; i <= 10 - initialCount; i++) {
      await engine.addInput(projectPath, 'text', `file_${i}.md`, `Markdown content ${i}`);
    }

    const snap = await engine.getSnapshot(projectPath);
    expect(snap.metadata.inputRefs.length).toBe(10);

    // 11th item must be rejected
    await expect(
      engine.addInput(projectPath, 'text', 'overflow.txt', 'overflow')
    ).rejects.toThrow(/maximum of 10 items allowed/);
  });

  it('2. Image & Document Honesty: Saved with unavailable analysis and excluded from text prompt', async () => {
    // Add image
    const imgRef = await engine.addInput(projectPath, 'image', 'mockup.png', 'base64imagebytes');
    expect(imgRef.analysisAvailability).toBe('available');
    expect(imgRef.status).toBe('ready');

    // Add unextracted PDF
    const pdfRef = await engine.addInput(projectPath, 'file', 'spec.pdf', '%PDF-1.5 data');
    expect(pdfRef.analysisAvailability).toBe('unavailable');
    expect(pdfRef.status).toBe('failed');

    // Build context
    const snap = await engine.getSnapshot(projectPath);
    const { contextText } = await orchestrator.buildContext(
      'idea-analysis',
      snap,
      { userMessage: 'Analyze uploaded items' },
      projectPath
    );

    expect(contextText).not.toContain('mockup.png');
    expect(contextText).not.toContain('base64imagebytes');
    expect(contextText).not.toContain('spec.pdf');
    expect(contextText).not.toContain('%PDF-1.5');
  });

  it('3. Grounded Text Ingestion & Budget Preservation: Reads extracted text and preserves user prompt', async () => {
    const textRef = await engine.addInput(
      projectPath,
      'text',
      'core_reqs.txt',
      'Local-first privacy requirement with zero external network connectivity.'
    );
    expect(textRef.analysisAvailability).toBe('available');
    expect(textRef.status).toBe('ready');

    const snap = await engine.getSnapshot(projectPath);
    const userPrompt = 'USER_INTENT: Prioritize local SQLite over remote databases.';
    const { contextText } = await orchestrator.buildContext(
      'idea-analysis',
      snap,
      { userMessage: userPrompt },
      projectPath
    );

    // Context must include both user intent and attachment text
    expect(contextText).toContain(userPrompt);
    expect(contextText).toContain('core_reqs.txt');
    expect(contextText).toContain('Local-first privacy requirement with zero external network connectivity');
  });
});
