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
  HighlightTarget,
} from '../types/session.js';
import {
  initialProjectSessionState,
  projectSessionReducer,
} from './projectSessionReducer.js';
import type { ProjectSnapshot, DiscoveryJobView, InitialProjectIntent } from '@project-architect/contracts';
import {
  ProjectArchitectApiClient,
  defaultApiClient,
  ApiClientError,
} from '../api/client.js';
import type { DiscoveryResult } from '@project-architect/contracts';

export interface ProjectSessionContextValue {
  state: ProjectSessionState;
  dispatch: React.Dispatch<ProjectSessionAction>;
  apiClient: ProjectArchitectApiClient;
  // High-level session actions
  loadProject: (projectId: string) => Promise<ProjectSnapshot>;
  createProject: (
    name: string,
    idea?: string,
    projectTags?: string[],
    initialIntent?: InitialProjectIntent,
    presetId?: string,
    materialOnly?: boolean
  ) => Promise<{ projectId: string; snapshot: ProjectSnapshot }>;
  openProject: (projectId: string) => Promise<ProjectSnapshot>;
  refreshSnapshot: () => Promise<ProjectSnapshot | null>;
  runInitialDiscovery: (projectId?: string, expectedRevision?: number) => Promise<void>;
  setLatestDiscovery: (
    discoveryResult: DiscoveryResult,
    diagnostics?: { durationMs?: number; totalTokens?: number | 'unavailable' },
    timestamp?: string
  ) => void;
  scheduleDiscoveryJob: (
    expectedRevision?: number,
    userMessage?: string,
    turnId?: string,
    intensity?: import('@project-architect/contracts').DiscoveryIntensity
  ) => Promise<DiscoveryJobView>;
  cancelDiscoveryJob: () => Promise<DiscoveryJobView | null>;
  fetchDiscoveryJob: () => Promise<DiscoveryJobView | null>;
  answerQuestionAsAssumption: (
    questionRef: import('@project-architect/contracts').QuestionRef,
    assumptionStatement: string,
    rationale?: string
  ) => Promise<number>;
  deprecateDecision: (
    decisionRef: import('@project-architect/contracts').DecisionRef
  ) => Promise<ProjectSnapshot>;
  retractQuestion: (
    questionRef: import('@project-architect/contracts').QuestionRef
  ) => Promise<ProjectSnapshot>;
  clearSession: () => void;
  // Navigation & Linking
  setHighlightTarget: (target: HighlightTarget | null) => void;
  jumpToFix: (target: { tab: WorkspaceTab; sectionId?: string; itemRef?: string; questionId?: string }) => void;
  // UI preferences
  setTheme: (theme: ThemeMode) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  toggleOverview: () => void;
  toggleLeftSidebar: () => void;
  resetSession: () => void;
}

export const ProjectSessionContext = createContext<ProjectSessionContextValue | undefined>(undefined);

export function useOptionalProjectSession(): ProjectSessionContextValue | undefined {
  return useContext(ProjectSessionContext);
}

const isMockMode =
  typeof import.meta !== 'undefined' &&
  (import.meta.env?.VITE_MOCK_MODE === 'true' || import.meta.env?.VITE_MOCK_MODE === true);

const createOfflineDemoSnapshot = (): ProjectSnapshot => {
  const now = new Date().toISOString();
  return {
    metadata: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      name: 'Offline Architecture Demo',
      stage: 'deep-dive',
      stateRevision: 1,
      createdAt: now,
      updatedAt: now,
      inputRefs: [],
      projectTags: ['Desktop', 'Local-First'],
    },
    overview: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      sections: [
        {
          id: 'project_overview',
          title: 'Project Overview',
          kind: 'fixed',
          maturity: 'mostly-clear',
          itemRefs: ['decision:dec-01'],
        },
        {
          id: 'technical_boundary',
          title: 'Technical Boundary',
          kind: 'fixed',
          maturity: 'mostly-clear',
          itemRefs: ['decision:dec-02'],
        },
      ],
      updatedAt: now,
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      items: [
        {
          id: 'dec-01',
          area: 'project_overview',
          statement: 'Local-first architecture design platform for AI coding agents',
          status: 'confirmed',
          origin: 'user',
          evidenceRefs: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'dec-02',
          area: 'technical_boundary',
          statement: 'Strictly zero centralized database, local directory two-stage commit',
          status: 'locked',
          origin: 'user',
          evidenceRefs: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
      traces: [],
      updatedAt: now,
    },
    assumptions: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      items: [],
      updatedAt: now,
    },
    gaps: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      gaps: [],
      conflicts: [],
      tensions: [],
      updatedAt: now,
    },
    risks: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      items: [],
      updatedAt: now,
    },
    questions: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      items: [],
      updatedAt: now,
    },
    readiness: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      current: {
        id: 'rdn-demo',
        status: 'ready',
        reviewedAt: now,
        basisRevision: 1,
        requiredAreas: ['project_overview', 'target_user', 'technical_boundary'],
        warnings: [],
        issues: [],
        assumptionRefs: [],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'approved',
      },
      history: [],
      updatedAt: now,
    },
    documents: {
      schemaVersion: 1,
      projectId: 'offline-demo',
      items: [],
      updatedAt: now,
    },
  };
};

export function ProjectSessionProvider({
  children,
  apiClient = defaultApiClient,
}: {
  children: ReactNode;
  apiClient?: ProjectArchitectApiClient;
}) {
  const [state, dispatch] = useReducer(projectSessionReducer, initialProjectSessionState);
  const activeRequestAbortController = useRef<AbortController | null>(null);

  // Auto-initialize offline demo snapshot when VITE_MOCK_MODE is enabled
  useEffect(() => {
    if (isMockMode && !state.activeProjectId) {
      const mockSnapshot = createOfflineDemoSnapshot();
      dispatch({
        type: 'SET_ACTIVE_PROJECT',
        payload: { projectId: 'offline-demo', snapshot: mockSnapshot },
      });
    }
  }, [state.activeProjectId]);

  // Sync theme with HTML document root class
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const isDark =
        state.uiState.theme === 'dark' ||
        (state.uiState.theme === 'system' &&
          typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (state.uiState.theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener?.('change', listener);
      return () => mediaQuery.removeEventListener?.('change', listener);
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
      idea?: string,
      projectTags?: string[],
      initialIntent?: InitialProjectIntent,
      presetId?: string,
      materialOnly?: boolean
    ): Promise<{ projectId: string; snapshot: ProjectSnapshot }> => {
      cancelActiveRequest();
      const controller = new AbortController();
      activeRequestAbortController.current = controller;

      dispatch({ type: 'SET_REQUEST_STATE', payload: { status: 'loading', error: null, lastAction: 'create_project' } });
      try {
        const res = await apiClient.createProject({ name, idea, initialIntent, projectTags, presetId, materialOnly }, controller.signal);
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

  const fetchDiscoveryJob = useCallback(async (): Promise<DiscoveryJobView | null> => {
    if (!state.activeProjectId) {
      dispatch({ type: 'SET_DISCOVERY_JOB', payload: null });
      return null;
    }
    try {
      const job = await apiClient.getCurrentDiscoveryJob(state.activeProjectId);
      dispatch({ type: 'SET_DISCOVERY_JOB', payload: job });
      return job;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to poll discovery job status:', err);
      }
      return null;
    }
  }, [apiClient, state.activeProjectId]);

  // BroadcastChannel for cross-tab realtime state synchronization
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('pa_project_sync');
        bc.onmessage = (event) => {
          const { type, projectId, snapshot } = event.data || {};
          if (type === 'SYNC_SNAPSHOT' && projectId === state.activeProjectId && snapshot) {
            dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot } });
          }
        };
      }
    } catch {}
    return () => {
      bc?.close();
    };
  }, [state.activeProjectId]);

  const broadcastSnapshot = useCallback((snapshot: ProjectSnapshot) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('pa_project_sync');
        bc.postMessage({
          type: 'SYNC_SNAPSHOT',
          projectId: snapshot.metadata.projectId,
          snapshot,
        });
        bc.close();
      }
    } catch {}
  }, []);

  const scheduleDiscoveryJob = useCallback(
    async (
      expectedRevision?: number,
      userMessage?: string,
      turnId?: string,
      intensity?: import('@project-architect/contracts').DiscoveryIntensity
    ): Promise<DiscoveryJobView> => {
      if (!state.activeProjectId) throw new Error('No active project');
      const rev = expectedRevision ?? state.stateRevision ?? 1;
      const res = await apiClient.scheduleDiscoveryJob(state.activeProjectId, {
        projectId: state.activeProjectId,
        expectedRevision: rev,
        userMessage,
        turnId,
        intensity,
        allowRebase: true,
      });
      dispatch({ type: 'SET_DISCOVERY_JOB', payload: res.job });
      return res.job;
    },
    [apiClient, state.activeProjectId, state.stateRevision]
  );

  const answerQuestionAsAssumption = useCallback(
    async (
      questionRef: import('@project-architect/contracts').QuestionRef,
      assumptionStatement: string,
      rationale?: string
    ): Promise<number> => {
      if (!state.activeProjectId) throw new Error('No active project');
      const rev = state.stateRevision ?? 1;
      const res = await apiClient.answerQuestionAsAssumption(state.activeProjectId, {
        projectId: state.activeProjectId,
        questionRef,
        assumptionStatement,
        rationale,
        expectedRevision: rev,
      });
      dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: res.snapshot } });
      broadcastSnapshot(res.snapshot);
      return res.snapshot.metadata.stateRevision;
    },
    [apiClient, state.activeProjectId, state.stateRevision, broadcastSnapshot]
  );

  const deprecateDecision = useCallback(
    async (
      decisionRef: import('@project-architect/contracts').DecisionRef
    ): Promise<ProjectSnapshot> => {
      if (!state.activeProjectId) throw new Error('No active project');
      const rev = state.stateRevision ?? 1;
      const res = await apiClient.deprecateDecision(state.activeProjectId, {
        projectId: state.activeProjectId,
        decisionRef,
        expectedRevision: rev,
      });
      dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: res.snapshot } });
      broadcastSnapshot(res.snapshot);
      return res.snapshot;
    },
    [apiClient, state.activeProjectId, state.stateRevision, broadcastSnapshot]
  );

  const retractQuestion = useCallback(
    async (
      questionRef: import('@project-architect/contracts').QuestionRef
    ): Promise<ProjectSnapshot> => {
      if (!state.activeProjectId) throw new Error('No active project');
      const rev = state.stateRevision ?? 1;
      const res = await apiClient.retractQuestion(state.activeProjectId, {
        projectId: state.activeProjectId,
        questionRef,
        expectedRevision: rev,
      });
      dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: res.snapshot } });
      broadcastSnapshot(res.snapshot);
      return res.snapshot;
    },
    [apiClient, state.activeProjectId, state.stateRevision, broadcastSnapshot]
  );

  const cancelDiscoveryJob = useCallback(async (): Promise<DiscoveryJobView | null> => {
    if (!state.activeProjectId) return null;
    try {
      const res = await apiClient.cancelDiscoveryJob(state.activeProjectId, {
        projectId: state.activeProjectId,
      });
      dispatch({ type: 'SET_DISCOVERY_JOB', payload: res.job });
      return res.job;
    } catch (err) {
      console.error('Failed to cancel discovery job:', err);
      return null;
    }
  }, [apiClient, state.activeProjectId]);


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

  // Global polling for active background discovery jobs
  useEffect(() => {
    if (!state.activeProjectId) return;
    void fetchDiscoveryJob();
  }, [state.activeProjectId, fetchDiscoveryJob]);

  useEffect(() => {
    const status = state.discoveryJob?.status;
    if (!status || !['queued', 'running'].includes(status)) return;

    const timer = window.setInterval(async () => {
      const job = await fetchDiscoveryJob();
      if (job && !['queued', 'running'].includes(job.status)) {
        await refreshSnapshot();
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [state.discoveryJob?.status, fetchDiscoveryJob, refreshSnapshot]);

  const setHighlightTarget = useCallback((target: HighlightTarget | null) => {
    dispatch({ type: 'SET_HIGHLIGHT_TARGET', payload: target });
  }, []);

  const jumpToFix = useCallback(
    (target: { tab: WorkspaceTab; sectionId?: string; itemRef?: string; questionId?: string }) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: target.tab });
      if (target.sectionId || target.itemRef || target.questionId) {
        // Ensure overview drawer is open if jumping to overview
        if (target.tab === 'chat' && (target.sectionId || target.itemRef)) {
          if (state.uiState.isOverviewCollapsed) {
            dispatch({ type: 'TOGGLE_OVERVIEW' });
          }
        }
        dispatch({
          type: 'SET_HIGHLIGHT_TARGET',
          payload: {
            sectionId: target.sectionId,
            itemRef: target.itemRef,
            questionId: target.questionId,
            timestamp: Date.now(),
          },
        });
      }
    },
    [state.uiState.isOverviewCollapsed]
  );

  const setLatestDiscovery = useCallback(
    (
      discoveryResult: DiscoveryResult,
      diagnostics?: { durationMs?: number; totalTokens?: number | 'unavailable' },
      timestamp?: string
    ) => {
      dispatch({
        type: 'SET_LATEST_DISCOVERY',
        payload: {
          discoveryResult,
          diagnostics,
          timestamp: timestamp || new Date().toLocaleTimeString(),
        },
      });
    },
    []
  );

  const runInitialDiscovery = useCallback(
    async (projectIdOverride?: string, expectedRevisionOverride?: number): Promise<void> => {
      const targetId = projectIdOverride || state.activeProjectId;
      if (!targetId) return;

      let currentRev = expectedRevisionOverride ?? state.stateRevision ?? 1;
      if (expectedRevisionOverride === undefined) {
        try {
          const snapshot = await apiClient.getProjectSnapshot(targetId);
          if (snapshot && typeof snapshot.metadata?.stateRevision === 'number') {
            currentRev = snapshot.metadata.stateRevision;
          }
        } catch {}
      }

      dispatch({
        type: 'SET_REQUEST_STATE',
        payload: { status: 'loading', error: null, lastAction: 'initial_discovery' },
      });

      try {
        const res = await apiClient.runDiscoveryTurn(targetId, {
          projectId: targetId,
          expectedRevision: currentRev,
        });
        dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: res.snapshot } });
        dispatch({
          type: 'SET_LATEST_DISCOVERY',
          payload: {
            discoveryResult: res.discoveryResult,
            diagnostics: res.diagnostics,
            timestamp: new Date().toLocaleTimeString(),
          },
        });
      } catch (err: any) {
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
        setLatestDiscovery,
        scheduleDiscoveryJob,
        cancelDiscoveryJob,
        fetchDiscoveryJob,
        answerQuestionAsAssumption,
        deprecateDecision,
        retractQuestion,
        setHighlightTarget,
        jumpToFix,
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
