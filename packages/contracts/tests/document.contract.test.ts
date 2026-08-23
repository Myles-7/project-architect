import { describe, it, expect } from 'vitest';
import type {
  DocumentReference,
  DocumentsState,
  DocumentPlan,
} from '../src/documents.js';

describe('Document Contract Model Unit Tests (Phase 4.1)', () => {
  it('1. Correctly models DocumentReference and tracks sourceRevision', () => {
    const docRef: DocumentReference = {
      id: 'doc-01',
      type: 'project',
      path: 'docs/PROJECT.md',
      title: 'Project Specification',
      status: 'generated',
      generatedAt: new Date().toISOString(),
      sourceRevision: 5,
      contentHash: 'hash-abc-123',
    };

    expect(docRef.type).toBe('project');
    expect(docRef.sourceRevision).toBe(5);
    expect(docRef.status).toBe('generated');
  });

  it('2. Evaluates document staleness against project state revision', () => {
    const currentStateRevision = 7;
    const docRef: DocumentReference = {
      id: 'doc-02',
      type: 'product',
      path: 'docs/PRODUCT.md',
      title: 'Product Scope',
      status: 'generated',
      generatedAt: new Date().toISOString(),
      sourceRevision: 5,
    };

    const isStale = docRef.sourceRevision < currentStateRevision;
    expect(isStale).toBe(true);
  });

  it('3. Correctly models DocumentsState container', () => {
    const state: DocumentsState = {
      schemaVersion: 1,
      projectId: 'proj-123',
      items: [
        {
          id: 'doc-agents',
          type: 'agents',
          path: 'AGENTS.md',
          title: 'Coding Agent Guidelines',
          status: 'generated',
          generatedAt: new Date().toISOString(),
          sourceRevision: 3,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    expect(state.items.length).toBe(1);
    expect(state.items[0]?.type).toBe('agents');
  });

  it('4. Models DocumentPlan with required document types', () => {
    const plan: DocumentPlan = {
      projectId: 'proj-123',
      sourceRevision: 4,
      documents: [
        {
          type: 'agents',
          title: 'AGENTS.md',
          path: 'AGENTS.md',
          description: 'Coding Agent rules and locked constraints',
          required: true,
        },
        {
          type: 'project',
          title: 'PROJECT.md',
          path: 'docs/PROJECT.md',
          description: 'Vision, target users, core problem',
          required: true,
        },
      ],
    };

    expect(plan.documents.length).toBe(2);
    expect(plan.documents.every((d) => d.required)).toBe(true);
  });
});
