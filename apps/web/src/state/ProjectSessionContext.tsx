import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  ProjectSessionState,
  ProjectSessionAction,
  ThemeMode,
  WorkspaceTab,
} from '../types/session.js';
import {
  initialProjectSessionState,
  projectSessionReducer,
} from './projectSessionReducer.js';
import type { ProjectSnapshot } from '@project-architect/contracts';
import {
  ProjectArchitectApiClient,
  defaultApiClient,
  ApiClientError,
} from '../api/client.js';

interface ProjectSessionContextValue {
  state: ProjectSessionState;
  dispatch: React.Dispatch<ProjectSessionAction>;
  apiClient: ProjectArchitectApiClient;
  // High-level session actions
  loadProject: (projectId: string) => Promise<ProjectSnapshot>;
  createProject: (name: string, idea: string, projectTags?: string[]) => Promise<{ projectId: string; snapshot: ProjectSnapshot }>;
  openProject: (projectId: string) => Promise<ProjectSnapshot>;
  refreshSnapshot: () => Promise<ProjectSnapshot | null>;
  runInitialDiscovery: (projectId?: string) => Promise<void>;
  clearSession: () => void;
  // UI preferences
  setTheme: (theme: ThemeMode) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  toggleOverview: () => void;
  toggleLeftSidebar: () => void;
  resetSession: () => void;
}

const ProjectSessionContext = createContext<ProjectSessionContextValue | undefined>(undefined);

export function ProjectSessionProvider({
  children,
  apiClient = defaultApiClient,
}: {
  children: ReactNode;
  apiClient?: ProjectArchitectApiClient;
}) {
  const [state, dispatch] = useReducer(projectSessionReducer, initialProjectSessionState);
  const activeRequestAbortController = useRef<AbortController | null>(null);

  // Sync theme with HTML document root class
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      state.uiState.theme === 'dark' ||
      (state.uiState.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.uiState.theme]);

  // Cancel any in-flight request when active project changes or resets
  const cancelActiveRequest = useCallback(() => {
    if (activeRequestAbortController.current) {
      activeRequestAbortController.current.abort();
      activeRequestAbortController.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    cancelActiveRequest();
    dispatch({ type: 'RESET_SESSION' });
  }, [cancelActiveRequest]);

  const loadProject = useCallback(
    async (projectId: string): Promise<ProjectSnapshot> => {
      cancelActiveRequest();
      const controller = new AbortController();
      activeRequestAbortController.current = controller;

      dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'loading', error: null, lastAction: 'load_project' } });
      try {
        const snapshot = await apiClient.getProjectSnapshot(projectId, controller.signal);
        dispatch({ type: 'SET_ACTIVE_PROJECT', payload: { projectId, snapshot } });
        return snapshot;
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        const msg = err instanceof ApiClientError ? err.message : '加载项目状态失败';
        dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'error', error: msg } });
        throw err;
      } finally {
        if (activeRequestAbortController.current === controller) {
          activeRequestAbortController.current = null;
        }
      }
    },
    [apiClient, cancelActiveRequest]
  );

  const openProject = useCallback(
    async (projectId: string): Promise<ProjectSnapshot> => {
      cancelActiveRequest();
      const controller = new AbortController();
      activeRequestAbortController.current = controller;

      dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'loading', error: null, lastAction: 'open_project' } });
      try {
        const res = await apiClient.openProject({ projectId }, controller.signal);
        dispatch({ type: 'SET_ACTIVE_PROJECT', payload: { projectId, snapshot: res.snapshot } });
        return res.snapshot;
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        const msg = err instanceof ApiClientError ? err.message : '打开项目失败';
        dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'error', error: msg } });
        throw err;
      } finally {
        if (activeRequestAbortController.current === controller) {
          activeRequestAbortController.current = null;
        }
      }
    },
    [apiClient, cancelActiveRequest]
  );

  const createProject = useCallback(
    async (
      name: string,
      idea: string,
      projectTags?: string[]
    ): Promise<{ projectId: string; snapshot: ProjectSnapshot }> => {
      cancelActiveRequest();
      const controller = new AbortController();
      activeRequestAbortController.current = controller;

      dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'loading', error: null, lastAction: 'create_project' } });
      try {
        const res = await apiClient.createProject({ name, idea, projectTags }, controller.signal);
        dispatch({
          type: 'SET_ACTIVE_PROJECT',
          payload: { projectId: res.projectId, snapshot: res.snapshot },
        });
        return res;
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        const msg = err instanceof ApiClientError ? err.message : '创建新项目失败';
        dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'error', error: msg } });
        throw err;
      } finally {
        if (activeRequestAbortController.current === controller) {
          activeRequestAbortController.current = null;
        }
      }
    },
    [apiClient, cancelActiveRequest]
  );

  const refreshSnapshot = useCallback(async (): Promise<ProjectSnapshot | null> => {
    if (!state.activeProjectId) return null;
    const controller = new AbortController();
    try {
      const snapshot = await apiClient.getProjectSnapshot(state.activeProjectId, controller.signal);
      dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot } });
      return snapshot;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      const msg = err instanceof ApiClientError ? err.message : '刷新项目状态失败';
      dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'error', error: msg } });
      return null;
    }
  }, [apiClient, state.activeProjectId]);

  const runInitialDiscovery = useCallback(
    async (projectIdOverride?: string): Promise<void> => {
      const targetId = projectIdOverride || state.activeProjectId;
      if (!targetId) return;

      const currentRev = state.stateRevision || 1;
      dispatch({
        type: 'SET_REQUEST_STATE',
        payload: { status: 'loading', error: null, lastAction: 'initial_discovery' },
      });

      try {
        // Single provider call for initial broad-pass discovery
        const res = await apiClient.runDiscoveryTurn(targetId, {
          projectId: targetId,
          expectedRevision: currentRev,
        });

        // Update with updated canonical snapshot
        dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: res.snapshot } });
      } catch (err: any) {
        // Project remains preserved on failure, inform user cleanly
        const msg =
          err instanceof ApiClientError
            ? `项目已创建，首次分析失败 (${err.message})，可点击重试。`
            : '项目已创建，首次分析失败，可点击重试。';
        dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'error', error: msg } });
      }
    },
    [apiClient, state.activeProjectId, state.stateRevision]
  );

  const setTheme = (theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const setActiveTab = (tab: WorkspaceTab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  };

  const toggleOverview = () => {
    dispatch({ type: 'TOGGLE_OVERVIEW' });
  };

  const toggleLeftSidebar = () => {
    dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' });
  };

  const resetSession = () => {
    clearSession();
  };

  return (
    <ProjectSessionContext.Provider
      value={{
        state,
        dispatch,
        apiClient,
        loadProject,
        createProject,
        openProject,
        refreshSnapshot,
        runInitialDiscovery,
        clearSession,
        setTheme,
        setActiveTab,
        toggleOverview,
        toggleLeftSidebar,
        resetSession,
      }}
    >
      {children}
    </ProjectSessionContext.Provider>
  );
}

export function useProjectSession(): ProjectSessionContextValue {
  const context = useContext(ProjectSessionContext);
  if (!context) {
    throw new Error('useProjectSession must be used within a ProjectSessionProvider');
  }
  return context;
}
