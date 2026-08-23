import type { ProjectSessionState, ProjectSessionAction } from '../types/session.js';

export const initialProjectSessionState: ProjectSessionState = {
  activeProjectId: null,
  snapshot: null,
  stateRevision: null,
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
    case 'SET_ACTIVE_PROJECT':
      return {
        ...state,
        activeProjectId: action.payload.projectId,
        snapshot: action.payload.snapshot,
        stateRevision: action.payload.snapshot?.metadata.stateRevision ?? null,
        requestState: { status: 'idle', error: null },
      };

    case 'UPDATE_SNAPSHOT':
      return {
        ...state,
        snapshot: action.payload.snapshot,
        stateRevision: action.payload.snapshot.metadata.stateRevision,
        requestState: { status: 'idle', error: null },
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
