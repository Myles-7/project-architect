import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import { PlanningWorkspace, type InitialSetupStatus } from '../features/planning/PlanningWorkspace.js';
import { FilesView } from '../features/files/FilesView.js';
import { TimelineView } from '../features/timeline/TimelineView.js';
import { ProjectDiagnosticsView } from '../features/settings/ProjectDiagnosticsView.js';

export const WorkspaceView: React.FC<{ initialSetup?: InitialSetupStatus }> = ({ initialSetup }) => {
  const { state } = useProjectSession();
  const { snapshot, uiState, requestState } = state;

  if (requestState.status === 'loading' && !snapshot) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <LoadingSkeleton className="h-8 w-1/4" />
        <LoadingSkeleton className="h-32 w-full" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  const renderActiveTabContent = () => {
    switch (uiState.activeTab) {
      case 'chat':
        return <PlanningWorkspace initialSetup={initialSetup} />;

      case 'files':
        return <FilesView />;

      case 'documents':
      case 'readiness':
      case 'dag':
      case 'diagrams':
      case 'timeline':
        return <TimelineView />;

      case 'settings':
        return (
          <ProjectDiagnosticsView />
        );

      default:
        return null;
    }
  };

  const isChatTab = uiState.activeTab === 'chat';

  return (
    <div className="flex-1 h-full flex flex-col min-h-0 overflow-hidden bg-[#FAF9F6] dark:bg-[#0C0D0F]">
      {requestState.status === 'error' && (
        <div className="max-w-3xl mx-auto m-4 mb-0 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{requestState.error || '请求发生异常'}</span>
        </div>
      )}
      {isChatTab ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {renderActiveTabContent()}
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {renderActiveTabContent()}
        </main>
      )}
    </div>
  );
};
