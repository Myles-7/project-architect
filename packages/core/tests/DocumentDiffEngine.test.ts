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

  it('4. Correctly flags specialty specs when technical_boundary or security is modified', () => {
    const snapshot = createDiffSnapshot(10);
    const manifest: DocumentsState = {
      schemaVersion: 1,
      projectId: 'proj-diff-test',
      items: [
        { id: 'doc-sec', type: 'security', title: 'SECURITY_SPEC.md', path: 'docs/specs/SECURITY_SPEC.md', status: 'generated', generatedAt: '', sourceRevision: 8 },
        { id: 'doc-sync', type: 'sync-spec', title: 'SYNC_SPEC.md', path: 'docs/specs/SYNC_SPEC.md', status: 'generated', generatedAt: '', sourceRevision: 8 },
        { id: 'doc-user', type: 'user-flow', title: 'USER_FLOWS.md', path: 'docs/USER_FLOWS.md', status: 'generated', generatedAt: '', sourceRevision: 8 },
      ],
      updatedAt: '',
    };

    const diffResults = diffEngine.diff(snapshot, manifest, ['security']);
    const secDoc = diffResults.find((d) => d.document === 'SECURITY_SPEC.md');
    const syncDoc = diffResults.find((d) => d.document === 'SYNC_SPEC.md');
    const userDoc = diffResults.find((d) => d.document === 'USER_FLOWS.md');

    expect(secDoc?.status).toBe('outdated');
    expect(syncDoc?.status).toBe('up-to-date');
    expect(userDoc?.status).toBe('up-to-date');
  });

  describe('P0-2: Myers LCS computeFileDiff Robustness', () => {
    it('eliminates false positive diffs when 1 line is inserted at top of a 200-line document', () => {
      // 200 lines of architectural content
      const originalLines = Array.from({ length: 200 }, (_, i) => `## Section ${i + 1}: Invariant definition and verification rules.`);
      const diskContent = originalLines.join('\n');

      // Insert 1 empty line at the top
      const newContent = '\n' + diskContent;

      const diffResult = diffEngine.computeFileDiff(diskContent, newContent, 'TEST_DOC.md');

      expect(diffResult.hasDiff).toBe(true);
      expect(diffResult.additionsCount).toBe(1);
      expect(diffResult.deletionsCount).toBe(0);
      expect(diffResult.unchangedCount).toBe(200);

      // Verify unified diff contains exactly one '+' line (the inserted line) and zero '-' lines
      const diffLines = diffResult.unifiedDiff.split('\n');
      const addedLines = diffLines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));
      const removedLines = diffLines.filter((l) => l.startsWith('-') && !l.startsWith('---'));

      expect(addedLines.length).toBe(1);
      expect(removedLines.length).toBe(0);
    });

    it('returns hasDiff: false and accurate unchangedCount when disk and new content are identical', () => {
      const content = '# Title\n\nSome invariant paragraph.\n';
      const result = diffEngine.computeFileDiff(content, content, 'DOC.md');
      expect(result.hasDiff).toBe(false);
      expect(result.unifiedDiff).toBe('');
      expect(result.additionsCount).toBe(0);
      expect(result.deletionsCount).toBe(0);
      expect(result.unchangedCount).toBe(4);
    });

    it('accurately identifies localized replacement in 100-line document', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      const diskContent = lines.join('\n');

      // Modify only line 50
      const modifiedLines = [...lines];
      modifiedLines[49] = 'Line 50 (Custom Manual Modification)';
      const newContent = modifiedLines.join('\n');

      const result = diffEngine.computeFileDiff(diskContent, newContent, 'DOC.md');
      expect(result.hasDiff).toBe(true);
      expect(result.additionsCount).toBe(1);
      expect(result.deletionsCount).toBe(1);
      expect(result.unchangedCount).toBe(99);
      expect(result.unifiedDiff).toContain('-Line 50');
      expect(result.unifiedDiff).toContain('+Line 50 (Custom Manual Modification)');
    });

    it('correctly diffs against an empty document without crashing', () => {
      const result1 = diffEngine.computeFileDiff('', 'Line 1\nLine 2', 'DOC.md');
      expect(result1.hasDiff).toBe(true);
      expect(result1.additionsCount).toBe(2);
      expect(result1.deletionsCount).toBe(0);

      const result2 = diffEngine.computeFileDiff('Line 1\nLine 2', '', 'DOC.md');
      expect(result2.hasDiff).toBe(true);
      expect(result2.additionsCount).toBe(0);
      expect(result2.deletionsCount).toBe(2);
    });
  });
});
