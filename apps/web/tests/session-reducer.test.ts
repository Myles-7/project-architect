import { describe, it, expect } from 'vitest';
import {
  projectSessionReducer,
  initialProjectSessionState,
} from '../src/state/projectSessionReducer.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Phase 5.1: ProjectSession Reducer Unit Tests', () => {
  const dummySnapshot: ProjectSnapshot = {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-123',
      name: 'Sample App',
      stage: 'created',
      stateRevision: 1,
      projectTags: ['cli'],
      inputRefs: [],
      createdAt: '2026-08-23T00:00:00Z',
      updatedAt: '2026-08-23T00:00:00Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-123',
      sections: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-123',
      items: [],
      traces: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'proj-123',
      items: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    gaps: {
      schemaVersion: 1,
      projectId: 'proj-123',
      gaps: [],
      conflicts: [],
      tensions: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    risks: {
      schemaVersion: 1,
      projectId: 'proj-123',
      items: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    questions: {
      schemaVersion: 1,
      projectId: 'proj-123',
      items: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-123',
      current: {
        id: 'readiness-01',
        status: 'not-ready',
        reviewedAt: '2026-08-23T00:00:00Z',
        requiredAreas: [],
        warnings: [],
        issues: [],
        assumptionRefs: [],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'pending',
      },
      history: [],
      updatedAt: '2026-08-23T00:00:00Z',
    },
  };

  it('1. SET_ACTIVE_PROJECT initializes activeProjectId, snapshot, and stateRevision', () => {
    const next = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_ACTIVE_PROJECT',
      payload: { projectId: 'proj-123', snapshot: dummySnapshot },
    });

    expect(next.activeProjectId).toBe('proj-123');
    expect(next.snapshot).toEqual(dummySnapshot);
    expect(next.stateRevision).toBe(1);
    expect(next.requestState.status).toBe('idle');
  });

  it('2. UPDATE_SNAPSHOT advances stateRevision and keeps UI layout intact', () => {
    const state1 = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_ACTIVE_PROJECT',
      payload: { projectId: 'proj-123', snapshot: dummySnapshot },
    });

    const updatedSnap: ProjectSnapshot = {
      ...dummySnapshot,
      metadata: {
        ...dummySnapshot.metadata,
        stateRevision: 2,
        stage: 'broad-pass',
      },
    };

    const next = projectSessionReducer(state1, {
      type: 'UPDATE_SNAPSHOT',
      payload: { snapshot: updatedSnap },
    });

    expect(next.stateRevision).toBe(2);
    expect(next.snapshot?.metadata.stage).toBe('broad-pass');
    expect(next.uiState.activeTab).toBe('chat');
  });

  it('3. RESET_SESSION clears project session back to Home while preserving theme preference', () => {
    const darkThemeState = {
      ...initialProjectSessionState,
      uiState: { ...initialProjectSessionState.uiState, theme: 'dark' as const },
    };

    const activeState = projectSessionReducer(darkThemeState, {
      type: 'SET_ACTIVE_PROJECT',
      payload: { projectId: 'proj-123', snapshot: dummySnapshot },
    });

    const resetState = projectSessionReducer(activeState, {
      type: 'RESET_SESSION',
    });

    expect(resetState.activeProjectId).toBeNull();
    expect(resetState.snapshot).toBeNull();
    expect(resetState.stateRevision).toBeNull();
    expect(resetState.uiState.theme).toBe('dark');
  });

  it('4. Toggles overview and left sidebar', () => {
    let state = initialProjectSessionState;
    expect(state.uiState.isOverviewCollapsed).toBe(false);

    state = projectSessionReducer(state, { type: 'TOGGLE_OVERVIEW' });
    expect(state.uiState.isOverviewCollapsed).toBe(true);

    state = projectSessionReducer(state, { type: 'TOGGLE_LEFT_SIDEBAR' });
    expect(state.uiState.isLeftSidebarCollapsed).toBe(true);
  });
});
