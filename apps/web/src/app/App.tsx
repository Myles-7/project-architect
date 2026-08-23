import React from 'react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { HomeView } from './HomeView.js';
import { AppShell } from './AppShell.js';
import { useToast } from '../components/common/Toast.js';

export const App: React.FC = () => {
  const {
    state,
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

  const handleCreateProject = async (name: string, idea: string) => {
    try {
      const res = await createProject(name, idea);
      info(`已创建 ${name}，正在推演初始蓝图...`, '项目创建成功');

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
