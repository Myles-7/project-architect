import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorage } from '../src/storage/FileStorage.js';
import { DocumentPlanner } from '../src/documents/DocumentPlanner.js';
import { DocumentRenderer } from '../src/documents/DocumentRenderer.js';
import { DocumentValidator } from '../src/documents/DocumentValidator.js';
import { DocumentCompiler } from '../src/documents/DocumentCompiler.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Document Compiler & Template Engine Unit Tests (Phase 4.3 & 4.4)', () => {
  let tempBaseDir: string;
  let storage: FileStorage;
  let planner: DocumentPlanner;
  let renderer: DocumentRenderer;
  let validator: DocumentValidator;
  let compiler: DocumentCompiler;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-doc-test-'));
    storage = new FileStorage();
    planner = new DocumentPlanner();
    renderer = new DocumentRenderer(storage);
    validator = new DocumentValidator();
    compiler = new DocumentCompiler(storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  function createValidSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-comp-test',
        name: 'Local Markdown Editor',
        stage: 'broad-pass',
        stateRevision: 4,
        projectTags: ['Desktop App', 'AI Product', 'Developer Tool'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-comp-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-02'] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-03'] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-comp-test',
        items: [
          { id: 'dec-01', area: 'project_overview', statement: 'Local Markdown Editor with AI Assist', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-02', area: 'target_user', statement: 'Technical writers and developers', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-03', area: 'mvp_scope', statement: 'Desktop editor with local file autosave', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-04', area: 'technical_boundary', statement: '100% offline file access, no remote database', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-05', area: 'user_flows', statement: '1. Open directory; 2. Edit markdown; 3. Auto save', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-comp-test',
        items: [
          { id: 'asm-01', statement: 'Default font is monospace', reason: 'Developer standard', status: 'active', createdAt: '' },
        ],
        updatedAt: '',
      },
      gaps: { schemaVersion: 1, projectId: 'proj-comp-test', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-comp-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-comp-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-comp-test',
        current: {
          id: 'rdn-01',
          status: 'ready-with-warnings',
          reviewedAt: '',
          requiredAreas: [],
          warnings: [],
          issues: [],
          assumptionRefs: [],
          knownIssueAcknowledgements: [],
          criticalConflictAcknowledgements: [],
          userDisposition: 'pending',
        },
        history: [],
        updatedAt: '',
      },
    };
  }

  it('1. DocumentPlanner dynamically includes AI_SPEC.md for AI products', () => {
    const snapshot = createValidSnapshot();
    const plan = planner.plan(snapshot);

    expect(plan.documents.some((d) => d.type === 'agents')).toBe(true);
    expect(plan.documents.some((d) => d.type === 'project')).toBe(true);
    expect(plan.documents.some((d) => d.type === 'product')).toBe(true);
    expect(plan.documents.some((d) => d.type === 'user-flow')).toBe(true);
    expect(plan.documents.some((d) => d.type === 'development-plan')).toBe(true);
    expect(plan.documents.some((d) => d.type === 'acceptance')).toBe(true);
    expect(plan.documents.some((d) => d.type === 'ai-spec')).toBe(true);
  });

  it('2. DocumentRenderer renders AGENTS.md with locked constraints and provenance badges', async () => {
    const snapshot = createValidSnapshot();
    const item = {
      type: 'agents' as const,
      title: 'AGENTS.md',
      path: 'AGENTS.md',
      description: 'Rules',
      required: true,
    };

    const rendered = await renderer.renderDocument(item, snapshot);
    expect(rendered).toContain('Local Markdown Editor — Coding Agent Guidelines');
    expect(rendered).toContain('[Locked: User]');
    expect(rendered).toContain('100% offline file access, no remote database');
    expect(rendered).toContain('[Active Assumption]');
    expect(rendered).toContain('Default font is monospace');
    expect(rendered).not.toContain('{{');
  });

  it('3. DocumentValidator catches unrendered placeholders or invalid candidate leakages', () => {
    const snapshot = createValidSnapshot();
    snapshot.decisions.items.push({
      id: 'dec-cand',
      area: 'features',
      statement: 'Unconfirmed cloud backup candidate',
      status: 'candidate',
      origin: 'ai',
      evidenceRefs: [],
      createdAt: '',
      updatedAt: '',
    });

    const validDocs = [
      {
        path: 'AGENTS.md',
        content:
          '# Local Markdown Editor\n- **[Locked: User]** `mvp_scope`: Desktop editor with local file autosave\n- **[Locked: User]** `technical_boundary`: 100% offline file access, no remote database',
      },
    ];
    const valResult1 = validator.validate(validDocs, snapshot);
    expect(valResult1.valid).toBe(true);

    const invalidDocs = [
      { path: 'AGENTS.md', content: 'Unrendered {{MISSING_TOKEN}}' },
    ];
    const valResult2 = validator.validate(invalidDocs, snapshot);
    expect(valResult2.valid).toBe(false);
    expect(valResult2.errors[0]).toContain('未解析的模板占位符');
  });

  it('4. DocumentCompiler runs full compilation, generates markdown files, and persists documents.json', async () => {
    const snapshot = createValidSnapshot();
    const projectDir = join(tempBaseDir, 'proj-compiled');
    await storage.ensureDir(projectDir);

    const result = await compiler.compile(projectDir, snapshot);

    expect(result.readiness.ready).toBe(true);
    expect(result.manifest.items.length).toBeGreaterThanOrEqual(7);

    // Verify files on disk
    expect(await storage.exists(join(projectDir, 'AGENTS.md'))).toBe(true);
    expect(await storage.exists(join(projectDir, 'docs', 'PROJECT.md'))).toBe(true);
    expect(await storage.exists(join(projectDir, 'docs', 'PRODUCT.md'))).toBe(true);
    expect(await storage.exists(join(projectDir, 'docs', 'USER_FLOWS.md'))).toBe(true);
    expect(await storage.exists(join(projectDir, 'docs', 'DEVELOPMENT_PLAN.md'))).toBe(true);
    expect(await storage.exists(join(projectDir, 'docs', 'ACCEPTANCE.md'))).toBe(true);
    expect(await storage.exists(join(projectDir, 'documents.json'))).toBe(true);

    const agentsContent = await storage.readText(join(projectDir, 'AGENTS.md'));
    expect(agentsContent).toContain('Local Markdown Editor');
  });
});
