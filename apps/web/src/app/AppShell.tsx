import React, { useState, useEffect, useRef } from 'react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { TopNav } from '../components/layout/TopNav.js';
import { LeftSidebar } from '../components/layout/LeftSidebar.js';
import { ResponsiveDrawer } from '../components/layout/ResponsiveDrawer.js';
import { WorkspaceView } from './WorkspaceView.js';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts.js';
import type { InitialSetupStatus } from '../features/planning/PlanningWorkspace.js';

interface AppShellProps {
  onNavigateHome: () => void;
  onNewProject: () => void;
  initialSetup?: InitialSetupStatus;
}

export const getBreakpointCollapseActions = (previousWidth: number | null, currentWidth: number) => ({
  left: currentWidth < 768 && (previousWidth === null || previousWidth >= 768),
  overview: currentWidth < 1280 && (previousWidth === null || previousWidth >= 1280),
});

export const AppShell: React.FC<AppShellProps> = ({ onNavigateHome, onNewProject, initialSetup }) => {
  const { state, toggleLeftSidebar, setActiveTab } = useProjectSession();
  const { uiState } = state;

  useGlobalShortcuts({
    activeProjectId: state.activeProjectId,
    onSelectTab: (tab) => setActiveTab(tab),
    onToggleLeftSidebar: toggleLeftSidebar,
  });

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const previousWidthRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth >= 1280;
  const isCompactDesktop = windowWidth >= 1024 && windowWidth < 1280;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const previousWidth = previousWidthRef.current;
    const collapse = getBreakpointCollapseActions(previousWidth, windowWidth);
    if (collapse.left && !uiState.isLeftSidebarCollapsed) {
      toggleLeftSidebar();
    }
    previousWidthRef.current = windowWidth;
  }, [windowWidth]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-canvas text-text-primary">
      {/* Screen Reader Live Region */}
      <div id="sr-global-announcer" role="status" aria-live="polite" className="sr-only" />

      {/* Top Header */}
      <TopNav onNavigateHome={onNavigateHome} />

      {/* Main Responsive Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column:
            - Desktop (>= 1280px): Standard sidebar unless collapsed
            - Compact Desktop (1024-1279px) & Tablet (768-1023px): Icon-only compact navigation (64px)
            - Mobile (< 768px): Modal ResponsiveDrawer
        */}
        {isDesktop && !uiState.isLeftSidebarCollapsed && (
          <LeftSidebar onNewProject={onNewProject} />
        )}
        {(isCompactDesktop || isTablet) && (
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
            Center minimum width: >= 640px on desktop / compact desktop (>=1024px), >= 320px on tablet/mobile.
        */}
        <main
          className="flex-1 min-w-0 flex flex-col overflow-hidden"
        >
          <WorkspaceView initialSetup={initialSetup} />
        </main>

      </div>
    </div>
  );
};
