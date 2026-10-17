import React, { useRef, useState } from 'react';
import type { InitialProjectIntent, BrownfieldCandidateDecision } from '@project-architect/contracts';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { HomeView } from './HomeView.js';
import { AppShell } from './AppShell.js';
import { useToast } from '../components/common/Toast.js';
import { uploadInitialMaterials } from '../features/files/materialUploads.js';

export const App: React.FC = () => {
  const {
    state,
    apiClient,
    createProject,
    openProject,
    dispatch,
    clearSession,
  } = useProjectSession();
  const { error, info } = useToast();
  const [initialSetup, setInitialSetup] = useState({ busy: false, errors: [] as string[] });
  const setupRequest = useRef<AbortController | null>(null);

  const handleOpenProject = async (projectId: string) => {
    setupRequest.current?.abort();
    setInitialSetup({ busy: false, errors: [] });
    try {
      await openProject(projectId);
    } catch (err: any) {
      error(err.message || '请检查本地后端服务', '打开项目失败');
    }
  };

  const handleCreateProject = async (
    name: string,
    idea?: string,
    initialIntent?: InitialProjectIntent,
    attachedFiles?: { filename: string; kind: 'text' | 'image' | 'file'; content: string; contentEncoding?: 'utf8' | 'base64' }[],
    presetId?: string,
    brownfieldCandidates?: BrownfieldCandidateDecision[]
  ) => {
    setupRequest.current?.abort();
    const controller = new AbortController();
    setupRequest.current = controller;
    setInitialSetup({ busy: true, errors: [] });
    const setupErrors: string[] = [];
    try {
      const materialOnly = Boolean(attachedFiles?.length && !idea?.trim());
      const res = await createProject(name, idea, undefined, initialIntent, presetId, materialOnly);
      info(`已创建 ${name}，正在保存初始材料。`, '项目创建成功');

      let rev = res.snapshot.metadata.stateRevision;

      // Ingest initial brownfield candidate decisions if provided (User Authority First)
      if (brownfieldCandidates && brownfieldCandidates.length > 0) {
        try {
          const applied = await apiClient.applyBrownfieldCandidates(res.projectId, brownfieldCandidates, rev, controller.signal);
          rev = applied.snapshot.metadata.stateRevision;
        } catch (err) {
          if (controller.signal.aborted) return;
          setupErrors.push(`已有代码库建议未保存：${err instanceof Error ? err.message : '请求失败'}`);
          rev = (await apiClient.getProjectSnapshot(res.projectId, controller.signal)).metadata.stateRevision;
        }
      }

      const prepared = await uploadInitialMaterials(apiClient, res.projectId, attachedFiles || [], rev, controller.signal, uploadErrors => setInitialSetup({ busy: true, errors: [...setupErrors, ...uploadErrors] }));
      setupErrors.push(...prepared.errors);
      const latest = prepared.snapshot;
      dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: latest } });
      if (setupErrors.length) {
        info('初始材料或建议需要处理，未自动开始澄清。已保存的材料和原文保留。', '请先检查材料');
        return;
      }
      await apiClient.startPlanningRun(res.projectId, { stage: 'clarify', expectedRevision: latest.metadata.stateRevision, operationId: crypto.randomUUID() }, controller.signal);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      error(err.message || '请检查本地后端服务', '创建项目失败');
      setupErrors.push(err.message || '初始化失败，请在工作台重试澄清');
    } finally {
      if (setupRequest.current === controller) setInitialSetup({ busy: false, errors: [...setupErrors] });
    }
  };


  const handleNavigateHome = () => {
    setupRequest.current?.abort();
    setupRequest.current = null;
    setInitialSetup({ busy: false, errors: [] });
    clearSession();
  };

  if (!state.activeProjectId) {
    return (
      <HomeView
        onOpenProject={handleOpenProject}
        onCreateProject={handleCreateProject}
      />
    );
  }

  return (
    <AppShell
      onNavigateHome={handleNavigateHome}
      onNewProject={handleNavigateHome}
      initialSetup={initialSetup}
    />
  );
};
