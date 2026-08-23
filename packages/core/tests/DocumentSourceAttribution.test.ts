import { describe, it, expect, beforeEach } from 'vitest';
import { FileStorage } from '../src/storage/FileStorage.js';
import { DocumentRenderer } from '../src/documents/DocumentRenderer.js';
import { DocumentValidator } from '../src/documents/DocumentValidator.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Document Source Attribution Unit Tests (Phase 4.5.1)', () => {
  let storage: FileStorage;
  let renderer: DocumentRenderer;
  let validator: DocumentValidator;

  beforeEach(() => {
    storage = new FileStorage();
    renderer = new DocumentRenderer(storage);
    validator = new DocumentValidator();
  });

  function createAttributionSnapshot(): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-attr-test',
        name: 'Attribution Test App',
        stage: 'broad-pass',
        stateRevision: 3,
        projectTags: ['Desktop App'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: {
        schemaVersion: 1,
        projectId: 'proj-attr-test',
        sections: [
          { id: 'project_overview', title: '概述', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-01'] },
          { id: 'target_user', title: '用户', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-02'] },
          { id: 'mvp_scope', title: 'MVP', kind: 'fixed', maturity: 'clear', itemRefs: ['decision:dec-03'] },
        ],
        updatedAt: new Date().toISOString(),
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-attr-test',
        items: [
          { id: 'dec-01', area: 'project_overview', statement: 'Desktop Utility for clean files', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-02', area: 'target_user', statement: 'Windows desktop power users', status: 'confirmed', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
          { id: 'dec-03', area: 'mvp_scope', statement: 'Scan local directories and delete cache', status: 'locked', origin: 'user', evidenceRefs: [], confirmedBy: 'user', createdAt: '', updatedAt: '' },
        ],
        updatedAt: new Date().toISOString(),
      },
      assumptions: {
        schemaVersion: 1,
        projectId: 'proj-attr-test',
        items: [
          { id: 'asm-01', statement: 'Safe deletion via OS Recycle Bin', reason: 'Prevent accidental data loss', status: 'active', createdAt: '' },
        ],
        updatedAt: '',
      },
      gaps: { schemaVersion: 1, projectId: 'proj-attr-test', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-attr-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-attr-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-attr-test',
        current: {
          id: 'rdn-01',
          status: 'ready',
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

  it('1. DocumentRenderer outputs explicit Source Attribution markers for Confirmed, Locked, and Assumptions', async () => {
    const snapshot = createAttributionSnapshot();
    const item = {
      type: 'agents' as const,
      title: 'AGENTS.md',
      path: 'AGENTS.md',
      description: 'Rules',
      required: true,
    };

    const rendered = await renderer.renderDocument(item, snapshot);

    expect(rendered).toContain('[Locked: User]');
    expect(rendered).toContain('Source: Decision dec-03');
    expect(rendered).toContain('[Active Assumption]');
    expect(rendered).toContain('Source: Assumption asm-01');
  });

  it('2. DocumentValidator verifies that all referenced Source IDs exist in State', () => {
    const snapshot = createAttributionSnapshot();
    const validDocs = [
      {
        path: 'AGENTS.md',
        content:
          '# App\n- **[Locked: User]** `mvp_scope`: Scan local directories and delete cache *(Source: Decision dec-03)*\n- **[Active Assumption]** Safe deletion *(Source: Assumption asm-01)*',
      },
    ];

    const result = validator.validate(validDocs, snapshot);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('3. DocumentValidator catches phantom or fabricated Decision/Assumption IDs', () => {
    const snapshot = createAttributionSnapshot();
    const phantomDocs = [
      {
        path: 'AGENTS.md',
        content:
          '# App\n- **[Locked: User]** `mvp_scope`: Scan local directories and delete cache *(Source: Decision dec-03)*\n- **[Confirmed: User]** Unverified Cloud Feature *(Source: Decision dec-phantom-999)*',
      },
    ];

    const result = validator.validate(phantomDocs, snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('dec-phantom-999'))).toBe(true);
  });
});
