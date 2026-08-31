import type { ProjectSessionState, ProjectSessionAction } from '../types/session.js';
import type { ProjectSnapshot, DiscoveryResult } from '@project-architect/contracts';

/**
 * Pure derived projection function that reconstructs an equivalent DiscoveryResult
 * directly from authoritative ProjectSnapshot data when reopening an existing project.
 */
export function deriveDiscoveryResultFromSnapshot(snapshot: ProjectSnapshot): DiscoveryResult {
  const confirmed = snapshot.decisions.items
    .filter((d) => (d.status === 'confirmed' || d.status === 'locked') && d.statement)
    .map((d) => d.statement);

  const candidates = snapshot.decisions.items
    .filter((d) => d.status === 'candidate' && d.statement)
    .map((d) => ({
      decision_key: d.decisionKey || `legacy:decision:${d.id}`,
      area: d.area as DiscoveryResult['candidates'][number]['area'],
      statement: d.statement,
      rationale: d.rationale || '来自已持久化的 AI 建议。',
    }));

  const assumptions = snapshot.assumptions.items
    .filter((a) => a.status === 'active' && a.statement)
    .map((a) => ({
      decision_key: a.decisionKey || `legacy:assumption:${a.id}`,
      area: (a.area || 'project_overview') as DiscoveryResult['assumptions'][number]['area'],
      statement: a.statement,
      reason: a.reason,
    }));

  const unknowns: string[] = [];

  const risks = snapshot.risks.items
    .filter((r) => r.statement || r.description)
    .map((r) => ({
      risk_key: r.riskKey || `legacy:risk:${r.id}`,
      area: (r.area || 'technical_boundary') as DiscoveryResult['risks'][number]['area'],
      statement: r.statement || r.description,
      impact: r.impact || r.mitigationDirection || r.statement || r.description,
      severity: r.severity,
    }));

  const conflicts = snapshot.gaps.conflicts
    .filter((c) => c.status === 'open')
    .map((c) => `${c.propositionA} 与 ${c.propositionB} 存在设计冲突`);

  const tensions = (snapshot.gaps.tensions || [])
    .filter((t) => t.status === 'open')
    .map((t) => ({
      description: t.description,
      reason: t.reason,
    }));

  const gaps = snapshot.gaps.gaps
    .filter((g) => g.status === 'open')
    .map((g) => ({
      decision_key: g.decisionKey || `legacy:gap:${g.id}`,
      depends_on: g.dependsOn || [],
      area: g.area,
      severity: g.severity,
      reason: g.reason,
      impact: g.impact,
      should_ask_user: g.shouldAskUser,
    }));

  const questions = snapshot.questions.items
    .filter((q) =>
      q.status !== 'superseded' && q.status !== 'dismissed' &&
      q.options.length >= 2
    )
    .map((q) => {
      const options = q.options.map((option, index) => ({ ...option, key: option.key || `legacy_opt_${index + 1}` }));
      const recommendedOptionKey = q.recommendedOptionKey && options.some((option) => option.key === q.recommendedOptionKey)
        ? q.recommendedOptionKey
        : options[0]!.key;
      return ({
      decision_key: q.decisionKey || `legacy:question:${q.id}`,
      depends_on: q.dependsOn || [],
      importance: q.importance,
      question: q.question,
      reason: q.reason,
      recommendation: q.recommendation || '',
      recommendation_reason: q.recommendationReason || '',
      recommended_option_key: recommendedOptionKey,
      options,
      allow_free_input: Boolean(q.allowFreeInput),
    });
    });

  return {
    confirmed,
    candidates,
    assumptions,
    unknowns,
    risks,
    conflicts,
    tensions,
    gaps,
    questions,
  };
}

export const initialProjectSessionState: ProjectSessionState = {
  activeProjectId: null,
  snapshot: null,
  stateRevision: null,
  discoveryJob: null,
  latestDiscoveryResult: null,
  latestDiscoveryDiagnostics: null,
  latestDiscoveryTimestamp: null,
  highlightTarget: null,
  requestState: {
    status: 'idle',
    error: null,
  },
  uiState: {
    theme: 'dark',
    activeTab: 'chat',
    isOverviewCollapsed: false,
    isLeftSidebarCollapsed: false,
    isSettingsOpen: false,
  },
};

export function projectSessionReducer(
  state: ProjectSessionState,
  action: ProjectSessionAction
): ProjectSessionState {
  switch (action.type) {
    case 'SET_ACTIVE_PROJECT': {
      const snapshot = action.payload.snapshot;
      const explicitDiscovery = action.payload.discoveryResult;
      const derivedDiscovery = snapshot ? deriveDiscoveryResultFromSnapshot(snapshot) : null;
      const finalDiscovery = explicitDiscovery || derivedDiscovery;

      return {
        ...state,
        activeProjectId: action.payload.projectId,
        snapshot,
        stateRevision: snapshot?.metadata.stateRevision ?? null,
        discoveryJob: null,
        latestDiscoveryResult: finalDiscovery,
        latestDiscoveryDiagnostics: action.payload.diagnostics || null,
        latestDiscoveryTimestamp: finalDiscovery ? new Date().toLocaleTimeString() : null,
        highlightTarget: null,
        requestState: { status: 'idle', error: null },
      };
    }

    case 'UPDATE_SNAPSHOT': {
      const snapshot = action.payload.snapshot;
      const currentDiscovery = state.latestDiscoveryResult;
      // If no discovery result existed yet, derive one from the authoritative snapshot
      const discovery = currentDiscovery || deriveDiscoveryResultFromSnapshot(snapshot);

      return {
        ...state,
        snapshot,
        stateRevision: snapshot.metadata.stateRevision,
        latestDiscoveryResult: discovery,
        requestState: { status: 'idle', error: null },
      };
    }

    case 'SET_LATEST_DISCOVERY':
      return {
        ...state,
        latestDiscoveryResult: action.payload.discoveryResult,
        latestDiscoveryDiagnostics: action.payload.diagnostics || null,
        latestDiscoveryTimestamp: action.payload.timestamp || new Date().toLocaleTimeString(),
      };

    case 'SET_DISCOVERY_JOB':
      return {
        ...state,
        discoveryJob: action.payload,
      };

    case 'SET_HIGHLIGHT_TARGET':
      return {
        ...state,
        highlightTarget: action.payload,
      };

    case 'SET_REQUEST_STATE':
      return {
        ...state,
        requestState: action.payload,
      };

    case 'SET_THEME':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          theme: action.payload,
        },
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          activeTab: action.payload,
        },
      };

    case 'TOGGLE_OVERVIEW':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isOverviewCollapsed: !state.uiState.isOverviewCollapsed,
        },
      };

    case 'TOGGLE_LEFT_SIDEBAR':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isLeftSidebarCollapsed: !state.uiState.isLeftSidebarCollapsed,
        },
      };

    case 'SET_SETTINGS_OPEN':
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isSettingsOpen: action.payload,
        },
      };

    case 'RESET_SESSION':
      return {
        ...initialProjectSessionState,
        uiState: state.uiState, // Preserve theme and layout preferences
      };

    default:
      return state;
  }
}
