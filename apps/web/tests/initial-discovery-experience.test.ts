import { describe, it, expect } from 'vitest';
import {
  deriveDiscoveryResultFromSnapshot,
  projectSessionReducer,
  initialProjectSessionState,
} from '../src/state/projectSessionReducer.js';
import type {
  ProjectSnapshot,
  DiscoveryResult,
} from '@project-architect/contracts';

describe('Phase 5.8: Comprehensive Initial AI Comprehension & Recovery Tests', () => {
  const baseSnapshot: ProjectSnapshot = {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-comprehensive-01',
      name: 'Local Audio Metadata Editor',
      stage: 'broad-pass',
      stateRevision: 3,
      projectTags: ['cli', 'audio'],
      inputRefs: [
        {
          id: 'input:inp-01',
          label: 'raw-requirements.md',
          kind: 'text',
          status: 'ready',
          analysisAvailability: 'available',
          summary: 'A Windows offline batch audio tagger supporting FLAC and MP3 without cloud dependencies.',
        },
      ],
      createdAt: '2026-08-26T00:00:00Z',
      updatedAt: '2026-08-26T00:00:00Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-comprehensive-01',
      sections: [
        {
          id: 'project_overview',
          title: '项目定位',
          kind: 'fixed',
          maturity: 'mostly-clear',
          itemRefs: ['decision:dec-01'],
        },
      ],
      updatedAt: '2026-08-26T00:00:00Z',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-comprehensive-01',
      items: [
        {
          id: 'dec-01',
          area: 'project_overview',
          statement: 'Windows-first offline metadata management tool',
          status: 'confirmed',
          origin: 'user',
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:00:00Z',
        },
        {
          id: 'dec-02',
          area: 'architecture',
          statement: 'Zero external database requirement with file state commit',
          status: 'locked',
          origin: 'user',
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:00:00Z',
        },
        {
          id: 'dec-03',
          area: 'mvp_scope',
          statement: 'Batch rename audio files using tag pattern templates',
          status: 'candidate',
          origin: 'ai',
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:00:00Z',
        },
        {
          id: 'dec-04',
          area: 'mvp_scope',
          statement: 'Outdated cloud sync proposal',
          status: 'superseded',
          origin: 'ai',
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:00:00Z',
        },
      ],
      traces: [],
      updatedAt: '2026-08-26T00:00:00Z',
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'proj-comprehensive-01',
      items: [
        {
          id: 'asm-01',
          statement: 'Target audio formats include FLAC, MP3, and OGG Vorbis',
          status: 'active',
          source: 'ai',
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:00:00Z',
        },
        {
          id: 'asm-02',
          statement: 'Requires cloud music brainz lookup',
          status: 'superseded',
          source: 'ai',
          createdAt: '2026-08-26T00:00:00Z',
          updatedAt: '2026-08-26T00:00:00Z',
        },
      ],
      updatedAt: '2026-08-26T00:00:00Z',
    },
    gaps: {
      schemaVersion: 2,
      projectId: 'proj-comprehensive-01',
      gaps: [
        {
          id: 'gap-01',
          area: 'target_user',
          decisionKey: 'target_user:primary_persona',
          severity: 'high',
          reason: 'Differentiate between audiophile power users vs casual music listeners',
          impact: 'Affects tag editing depth and UI density',
          shouldAskUser: true,
          status: 'open',
        },
        {
          id: 'gap-02',
          area: 'technical_boundary',
          decisionKey: 'technical_boundary:audio_codec',
          severity: 'critical',
          reason: 'Codec support matrix',
          impact: 'Affects native binding dependencies',
          shouldAskUser: true,
          status: 'addressed',
        },
      ],
      conflicts: [
        {
          id: 'conf-01',
          propositionA: 'Strict offline isolation',
          propositionB: 'Automated online album art fetching',
          severity: 'critical',
          reason: 'Offline guarantee conflicts with automatic web scraping',
          status: 'open',
        },
      ],
      tensions: [
        {
          id: 'ten-01',
          description: 'Tag editing throughput vs atomic disk write reliability',
          reason: 'Fast in-place write risks corruption on sudden power loss',
          status: 'open',
        },
      ],
      updatedAt: '2026-08-26T00:00:00Z',
    },
    risks: {
      schemaVersion: 1,
      projectId: 'proj-comprehensive-01',
      items: [
        {
          id: 'rsk-01',
          area: 'data_integrity',
          statement: 'ID3 tag writing corruption on partially damaged MP3 files',
          severity: 'high',
          mitigation: 'Use backup temporary copy and atomic move',
        },
      ],
      updatedAt: '2026-08-26T00:00:00Z',
    },
    questions: {
      schemaVersion: 2,
      projectId: 'proj-comprehensive-01',
      items: [
        {
          id: 'q-01',
          decisionKey: 'target_user:primary_persona',
          importance: 'high',
          question: 'Who is the primary user persona for the tagger?',
          reason: 'Determines GUI workflow complexity',
          recommendation: 'Music collectors and archiving audiophiles',
          recommendationReason: 'Demands precise ID3/Vorbis tag inspection',
          options: [
            { label: 'Music collectors and archiving audiophiles', impact: 'Requires advanced tree view and tag matrix' },
            { label: 'Casual listeners needing quick batch fixes', impact: 'Simplified wizard and auto-tagging' },
          ],
          allowFreeInput: true,
          status: 'shown',
          createdAt: '2026-08-26T00:00:00Z',
        },
        {
          id: 'q-02',
          decisionKey: 'legacy:dismissed',
          importance: 'normal',
          question: 'Dismissed question',
          reason: 'None',
          status: 'dismissed',
          createdAt: '2026-08-26T00:00:00Z',
        },
        {
          id: 'q-03',
          decisionKey: 'legacy:superseded',
          importance: 'normal',
          question: 'Superseded question',
          reason: 'None',
          status: 'superseded',
          createdAt: '2026-08-26T00:00:00Z',
        },
      ],
      updatedAt: '2026-08-26T00:00:00Z',
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-comprehensive-01',
      current: {
        id: 'rdn-01',
        status: 'not-ready',
        reviewedAt: '2026-08-26T00:00:00Z',
        requiredAreas: ['target_user', 'mvp_scope'],
        warnings: [],
        issues: [],
        assumptionRefs: [],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'pending',
      },
      history: [],
      updatedAt: '2026-08-26T00:00:00Z',
    },
  };

  it('1. deriveDiscoveryResultFromSnapshot correctly filters active/open items and excludes superseded/dismissed', () => {
    const derived = deriveDiscoveryResultFromSnapshot(baseSnapshot);

    // Confirmed should contain confirmed and locked decisions, but not candidate or superseded
    expect(derived.confirmed).toContain('Windows-first offline metadata management tool');
    expect(derived.confirmed).toContain('Zero external database requirement with file state commit');
    expect(derived.confirmed).not.toContain('Batch rename audio files using tag pattern templates');
    expect(derived.confirmed).not.toContain('Outdated cloud sync proposal');

    // Candidates should only contain candidate items
    expect(derived.candidates.map((item) => item.statement)).toEqual(['Batch rename audio files using tag pattern templates']);

    // Assumptions should only contain active assumptions
    expect(derived.assumptions.map((item) => item.statement)).toEqual(['Target audio formats include FLAC, MP3, and OGG Vorbis']);

    // Gaps should only contain open gaps
    expect(derived.gaps).toHaveLength(1);
    expect(derived.gaps[0].decision_key).toBe('target_user:primary_persona');

    // Conflicts & Tensions
    expect(derived.conflicts).toHaveLength(1);
    expect(derived.conflicts[0]).toContain('Strict offline isolation 与 Automated online album art fetching 存在设计冲突');
    expect(derived.tensions).toHaveLength(1);
    expect(derived.tensions[0].description).toBe('Tag editing throughput vs atomic disk write reliability');

    // Risks
    expect(derived.risks.map((item) => item.statement)).toEqual(['ID3 tag writing corruption on partially damaged MP3 files']);

    // Questions: excludes dismissed and superseded
    expect(derived.questions).toHaveLength(1);
    expect(derived.questions[0].decision_key).toBe('target_user:primary_persona');
    expect(derived.questions[0].recommendation).toBe('Music collectors and archiving audiophiles');
  });

  it('2. Empty snapshot edge case produces safe valid DiscoveryResult without errors', () => {
    const emptySnapshot: ProjectSnapshot = {
      ...baseSnapshot,
      decisions: { schemaVersion: 1, projectId: 'p', items: [], traces: [], updatedAt: '' },
      assumptions: { schemaVersion: 1, projectId: 'p', items: [], updatedAt: '' },
      gaps: { schemaVersion: 2, projectId: 'p', gaps: [], conflicts: [], tensions: [], updatedAt: '' },
      risks: { schemaVersion: 1, projectId: 'p', items: [], updatedAt: '' },
      questions: { schemaVersion: 2, projectId: 'p', items: [], updatedAt: '' },
    };

    const derived = deriveDiscoveryResultFromSnapshot(emptySnapshot);
    expect(derived.confirmed).toEqual([]);
    expect(derived.candidates).toEqual([]);
    expect(derived.assumptions).toEqual([]);
    expect(derived.gaps).toEqual([]);
    expect(derived.conflicts).toEqual([]);
    expect(derived.tensions).toEqual([]);
    expect(derived.risks).toEqual([]);
    expect(derived.questions).toEqual([]);
  });

  it('3. SET_ACTIVE_PROJECT recovers discovery view automatically from snapshot when explicit payload is absent', () => {
    const state = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_ACTIVE_PROJECT',
      payload: { projectId: 'proj-comprehensive-01', snapshot: baseSnapshot },
    });

    expect(state.latestDiscoveryResult).not.toBeNull();
    expect(state.latestDiscoveryResult?.candidates).toHaveLength(1);
    expect(state.latestDiscoveryResult?.assumptions).toHaveLength(1);
    expect(state.latestDiscoveryResult?.gaps).toHaveLength(1);
    expect(state.latestDiscoveryTimestamp).toBeDefined();
  });

  it('4. UPDATE_SNAPSHOT preserves existing discovery result while updating revision and metadata', () => {
    // Initial state with explicit discovery
    const explicitDiscovery: DiscoveryResult = {
      confirmed: ['Explicitly discovered fact'],
      candidates: ['Explicit candidate'],
      assumptions: ['Explicit assumption'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    const state1 = projectSessionReducer(initialProjectSessionState, {
      type: 'SET_ACTIVE_PROJECT',
      payload: {
        projectId: 'proj-comprehensive-01',
        snapshot: baseSnapshot,
        discoveryResult: explicitDiscovery,
      },
    });

    expect(state1.latestDiscoveryResult?.confirmed).toEqual(['Explicitly discovered fact']);

    // Snapshot update (e.g. revision bumped after answering question)
    const updatedSnap: ProjectSnapshot = {
      ...baseSnapshot,
      metadata: { ...baseSnapshot.metadata, stateRevision: 4 },
    };

    const state2 = projectSessionReducer(state1, {
      type: 'UPDATE_SNAPSHOT',
      payload: { snapshot: updatedSnap },
    });

    expect(state2.stateRevision).toBe(4);
    // Preserves existing explicit discovery if present
    expect(state2.latestDiscoveryResult?.confirmed).toEqual(['Explicitly discovered fact']);
  });
});
