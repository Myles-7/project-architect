import React from 'react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { TopNav } from '../components/layout/TopNav.js';
import { LeftSidebar } from '../components/layout/LeftSidebar.js';
import { OverviewDrawer } from '../features/overview/OverviewDrawer.js';
import { WorkspaceView } from './WorkspaceView.js';

interface AppShellProps {
  onNavigateHome: () => void;
  onNewProject: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ onNavigateHome, onNewProject }) => {
  const { state: _state } = useProjectSession();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#FAF9F6] dark:bg-[#0C0D0F] text-[#0F1115] dark:text-[#EDEDED]">
      {/* Top Header */}
      <TopNav onNavigateHome={onNavigateHome} />

      {/* Main 3-Column Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Navigation Sidebar */}
        <LeftSidebar onNewProject={onNewProject} />

        {/* Center Column: Active Workspace Content */}
        <WorkspaceView />

        {/* Right Column: Project Overview Drawer */}
        <OverviewDrawer />
      </div>
    </div>
  );
};
