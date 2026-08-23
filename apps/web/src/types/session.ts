import type { ProjectSnapshot } from '@project-architect/contracts';

export type WorkspaceTab = 'chat' | 'files' | 'readiness' | 'documents' | 'timeline' | 'settings';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface RequestState {
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  lastAction?: string;
}

export interface UIState {
  theme: ThemeMode;
  activeTab: WorkspaceTab;
  isOverviewCollapsed: boolean;
  isLeftSidebarCollapsed: boolean;
  isSettingsOpen: boolean;
}

export interface ProjectSessionState {
  activeProjectId: string | null;
  snapshot: ProjectSnapshot | null;
  stateRevision: number | null;
  requestState: RequestState;
  uiState: UIState;
}

export type ProjectSessionAction =
  | { type: 'SET_ACTIVE_PROJECT'; payload: { projectId: string | null; snapshot: ProjectSnapshot | null } }
  | { type: 'UPDATE_SNAPSHOT'; payload: { snapshot: ProjectSnapshot } }
  | { type: 'SET_REQUEST_STATE'; payload: RequestState }
  | { type: 'SET_THEME'; payload: ThemeMode }
  | { type: 'SET_ACTIVE_TAB'; payload: WorkspaceTab }
  | { type: 'TOGGLE_OVERVIEW' }
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'SET_SETTINGS_OPEN'; payload: boolean }
  | { type: 'RESET_SESSION' };
