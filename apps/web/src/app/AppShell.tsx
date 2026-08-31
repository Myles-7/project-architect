import React, { useState, useEffect, useRef } from 'react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { TopNav } from '../components/layout/TopNav.js';
import { LeftSidebar } from '../components/layout/LeftSidebar.js';
import { OverviewDrawer } from '../features/overview/OverviewDrawer.js';
import { ResponsiveDrawer } from '../components/layout/ResponsiveDrawer.js';
import { WorkspaceView } from './WorkspaceView.js';

interface AppShellProps {
  onNavigateHome: () => void;
  onNewProject: () => void;
}

export const getBreakpointCollapseActions = (previousWidth: number | null, currentWidth: number) => ({
  left: currentWidth < 768 && (previousWidth === null || previousWidth >= 768),
  overview: currentWidth < 1200 && (previousWidth === null || previousWidth >= 1200),
});

export const AppShell: React.FC<AppShellProps> = ({ onNavigateHome, onNewProject }) => {
  const { state, toggleLeftSidebar, toggleOverview } = useProjectSession();
  const { uiState } = state;

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const previousWidthRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth >= 1200;
  const isTablet = windowWidth >= 768 && windowWidth < 1200;
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const previousWidth = previousWidthRef.current;
    const collapse = getBreakpointCollapseActions(previousWidth, windowWidth);
    if (collapse.left && !uiState.isLeftSidebarCollapsed) {
      toggleLeftSidebar();
    }
    if (collapse.overview && !uiState.isOverviewCollapsed) {
      toggleOverview();
    }
    previousWidthRef.current = windowWidth;
  }, [windowWidth]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#FAF9F6] dark:bg-[#0C0D0F] text-[#0F1115] dark:text-[#EDEDED]">
      {/* Top Header */}
      <TopNav onNavigateHome={onNavigateHome} />

      {/* Main Responsive Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column:
            - Desktop (>= 1200px): Standard sidebar unless collapsed
            - Tablet (768-1199px): Icon-only compact navigation
            - Mobile (< 768px): Modal ResponsiveDrawer
        */}
        {isDesktop && !uiState.isLeftSidebarCollapsed && (
          <LeftSidebar onNewProject={onNewProject} />
        )}
        {isTablet && (
          <LeftSidebar onNewProject={onNewProject} isIconOnly={true} />
        )}
        {isMobile && (
          <ResponsiveDrawer
            isOpen={!uiState.isLeftSidebarCollapsed}
            onClose={toggleLeftSidebar}
            side="left"
            width="w-72"
            title="工作台导航"
            aria-label="工作台主导航抽屉"
          >
            <LeftSidebar
              onNewProject={() => {
                toggleLeftSidebar();
                onNewProject();
              }}
              onNavigate={toggleLeftSidebar}
              inDrawer={true}
            />
          </ResponsiveDrawer>
        )}

        {/* Center Column: Active Workspace Content
            Center minimum width: >= 640px on desktop (>=1200px), >= 320px on tablet/mobile.
        */}
        <main
          className={`flex-1 flex flex-col overflow-hidden ${
            isDesktop ? 'min-w-[640px]' : 'min-w-[320px]'
          }`}
        >
          <WorkspaceView />
        </main>

        {/* Right Column: Project Overview
            - Desktop (>= 1200px): In-flow 3rd column
            - Tablet (768-1199px) & Mobile (< 768px): Overlay / Modal ResponsiveDrawer
        */}
        {isDesktop && !uiState.isOverviewCollapsed && (
          <OverviewDrawer />
        )}
        {!isDesktop && (
          <ResponsiveDrawer
            isOpen={!uiState.isOverviewCollapsed}
            onClose={toggleOverview}
            side="right"
            width="w-80 sm:w-96"
            title="项目架构全景概览"
            aria-label="项目架构全景概览侧边抽屉"
          >
            <OverviewDrawer inDrawer={true} />
          </ResponsiveDrawer>
        )}
      </div>
    </div>
  );
};
