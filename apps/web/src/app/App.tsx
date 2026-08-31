import React from 'react';
import type { InitialProjectIntent } from '@project-architect/contracts';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { HomeView } from './HomeView.js';
import { AppShell } from './AppShell.js';
import { useToast } from '../components/common/Toast.js';

export const App: React.FC = () => {
  const {
    state,
    apiClient,
    createProject,
    openProject,
    runInitialDiscovery,
    clearSession,
  } = useProjectSession();
  const { success, error, info } = useToast();

  const handleOpenProject = async (projectId: string) => {
    try {
      await openProject(projectId);
      success(`已载入项目 ${projectId}`, '项目就绪');
    } catch (err: any) {
      error(err.message || '请检查本地后端服务', '打开项目失败');
    }
  };

  const handleCreateProject = async (
    name: string,
    idea?: string,
    initialIntent?: InitialProjectIntent,
    attachedFiles?: { filename: string; kind: 'text' | 'image' | 'file'; content: string; contentEncoding?: 'utf8' | 'base64' }[]
  ) => {
    try {
      const res = await createProject(name, idea, undefined, initialIntent);
      info(`已创建 ${name}，正在推演初始蓝图...`, '项目创建成功');

      // Upload any initial attached materials
      if (attachedFiles && attachedFiles.length > 0) {
        let rev = res.snapshot.metadata.stateRevision;
        for (const file of attachedFiles) {
          try {
            await apiClient.addInput(res.projectId, {
              projectId: res.projectId,
              kind: file.kind,
              filename: file.filename,
              content: file.content,
              contentEncoding: file.contentEncoding,
              expectedRevision: rev,
            });
            rev++;
          } catch (err) {
            console.error(`Failed to attach initial material ${file.filename}:`, err);
          }
        }
      }

      // Trigger initial discovery turn (single provider call)
      runInitialDiscovery(res.projectId);
    } catch (err: any) {
      error(err.message || '请检查本地后端服务', '创建项目失败');
    }
  };


  const handleNavigateHome = () => {
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
    />
  );
};
