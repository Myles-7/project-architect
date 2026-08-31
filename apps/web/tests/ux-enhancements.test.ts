import { describe, it, expect } from 'vitest';
import {
  projectSessionReducer,
  initialProjectSessionState,
} from '../src/state/projectSessionReducer.js';
import type { DiscoveryJobView } from '../src/types/session.js';

describe('Phase 5.8: UX Enhancements & Session Reducer Tests', () => {
  it('1. SET_DISCOVERY_JOB sets running job view and updates background polling target', () => {
    const job: DiscoveryJobView = {
      jobId: 'job-12345',
      status: 'running',
      createdAt: '2026-08-26T20:00:00Z',
      updatedAt: '2026-08-26T20:00:05Z',
      expectedRevision: 2,
    };

    const next = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_DISCOVERY_JOB',
      payload: job,
    });

    expect(next.discoveryJob).toEqual(job);
    expect(next.discoveryJob?.status).toBe('running');
  });

  it('2. SET_HIGHLIGHT_TARGET registers target section, item, or question for pulse animation', () => {
    const timestamp = Date.now();
    const next = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_HIGHLIGHT_TARGET',
      payload: {
        sectionId: 'area-product-scope',
        itemRef: 'decision:user-scope',
        questionId: 'q-1',
        timestamp,
      },
    });

    expect(next.highlightTarget).toEqual({
      sectionId: 'area-product-scope',
      itemRef: 'decision:user-scope',
      questionId: 'q-1',
      timestamp,
    });
  });

  it('3. SET_ACTIVE_TAB switches active navigation tab correctly', () => {
    const next = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_ACTIVE_TAB',
      payload: 'documents',
    });

    expect(next.uiState.activeTab).toBe('documents');
  });

  it('4. SET_DISCOVERY_JOB with null clears the background job state', () => {
    const stateWithJob = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_DISCOVERY_JOB',
      payload: {
        jobId: 'job-12345',
        status: 'finished',
        createdAt: '2026-08-26T20:00:00Z',
        updatedAt: '2026-08-26T20:00:15Z',
        expectedRevision: 2,
      },
    });

    expect(stateWithJob.discoveryJob).not.toBeNull();

    const cleared = projectSessionReducer(stateWithJob, {
      type: 'SET_DISCOVERY_JOB',
      payload: null,
    });

    expect(cleared.discoveryJob).toBeNull();
  });
});
