import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentDiffEngine } from '../src/documents/DocumentDiffEngine.js';
import type { ProjectSnapshot, DocumentsState } from '@project-architect/contracts';

describe('Document Revision & Diff Engine Unit Tests (Phase 4.5.3)', () => {
  let diffEngine: DocumentDiffEngine;

  beforeEach(() => {
    diffEngine = new DocumentDiffEngine();
  });

  function createDiffSnapshot(stateRevision: number): ProjectSnapshot {
    return {
      metadata: {
        schemaVersion: 1,
        projectId: 'proj-diff-test',
        name: 'Diff Test Project',
        stage: 'documents-generated',
        stateRevision,
        projectTags: ['Desktop App'],
        inputRefs: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      overview: { schemaVersion: 1, projectId: 'proj-diff-test', sections: [], updatedAt: '' },
      decisions: { schemaVersion: 1, projectId: 'proj-diff-test', items: [], updatedAt: '' },
      assumptions: { schemaVersion: 1, projectId: 'proj-diff-test', items: [], updatedAt: '' },
      gaps: { schemaVersion: 1, projectId: 'proj-diff-test', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'proj-diff-test', items: [], updatedAt: '' },
      questions: { schemaVersion: 1, projectId: 'proj-diff-test', items: [], updatedAt: '' },
      readiness: {
        schemaVersion: 1,
        projectId: 'proj-diff-test',
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

  function createSampleManifest(sourceRevision: number): DocumentsState {
    return {
      schemaVersion: 1,
      projectId: 'proj-diff-test',
      items: [
        { id: 'doc-agents', type: 'agents', title: 'AGENTS.md', path: 'AGENTS.md', status: 'generated', generatedAt: '', sourceRevision },
        { id: 'doc-proj', type: 'project', title: 'PROJECT.md', path: 'docs/PROJECT.md', status: 'generated', generatedAt: '', sourceRevision },
        { id: 'doc-prod', type: 'product', title: 'PRODUCT.md', path: 'docs/PRODUCT.md', status: 'generated', generatedAt: '', sourceRevision },
        { id: 'doc-flow', type: 'user-flow', title: 'USER_FLOWS.md', path: 'docs/USER_FLOWS.md', status: 'generated', generatedAt: '', sourceRevision },
        { id: 'doc-ux', type: 'ux-ui', title: 'UX_UI_SPEC.md', path: 'docs/UX_UI_SPEC.md', status: 'generated', generatedAt: '', sourceRevision },
      ],
      updatedAt: '',
    };
  }

  it('1. Reports up-to-date status when state revision matches document source revision', () => {
    const snapshot = createDiffSnapshot(5);
    const manifest = createSampleManifest(5);

    const diffResults = diffEngine.diff(snapshot, manifest);

    expect(diffResults.length).toBe(5);
    expect(diffResults.every((d) => d.status === 'up-to-date')).toBe(true);
  });

  it('2. Detects outdated documents when project state revision advances', () => {
    const snapshot = createDiffSnapshot(8); // Revision 8 > Source Revision 5
    const manifest = createSampleManifest(5);

    const diffResults = diffEngine.diff(snapshot, manifest);

    expect(diffResults.length).toBe(5);
    expect(diffResults.every((d) => d.status === 'outdated')).toBe(true);
    expect(diffResults[0]?.reason).toContain('evolved from 5 to 8');
  });

  it('3. Selectively flags documents affected by modified decision areas', () => {
    const snapshot = createDiffSnapshot(5); // Revisions match, but user modifies target_user
    const manifest = createSampleManifest(5);

    const diffResults = diffEngine.diff(snapshot, manifest, ['target_user']);

    const projectDoc = diffResults.find((d) => d.document === 'PROJECT.md');
    const productDoc = diffResults.find((d) => d.document === 'PRODUCT.md');
    const flowDoc = diffResults.find((d) => d.document === 'USER_FLOWS.md');
    const agentsDoc = diffResults.find((d) => d.document === 'AGENTS.md');

    expect(projectDoc?.status).toBe('outdated');
    expect(productDoc?.status).toBe('outdated');
    expect(flowDoc?.status).toBe('outdated');
    expect(agentsDoc?.status).toBe('up-to-date');
  });
});
