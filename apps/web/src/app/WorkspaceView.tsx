import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import { ChatView } from '../features/chat/ChatView.js';
import { FilesView } from '../features/files/FilesView.js';
import { ReadinessView } from '../features/readiness/ReadinessView.js';
import { DocumentsView } from '../features/documents/DocumentsView.js';
import { TimelineView } from '../features/timeline/TimelineView.js';
import { ProviderDiagnosticsPanel } from '../features/settings/ProviderDiagnosticsPanel.js';
import { ProjectDiagnosticsView } from '../features/settings/ProjectDiagnosticsView.js';

export const WorkspaceView: React.FC = () => {
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
        return <ChatView />;

      case 'files':
        return <FilesView />;

      case 'documents':
        return <DocumentsView />;

      case 'readiness':
        return <ReadinessView />;

      case 'timeline':
        return <TimelineView />;

      case 'settings':
        return (
          <div className="max-w-3xl w-full mx-auto space-y-6 pb-8">
            <ProviderDiagnosticsPanel
              projectId={snapshot?.metadata?.projectId}
              projectPath={snapshot?.metadata ? `projects/${snapshot.metadata.projectId}` : undefined}
            />

            {snapshot && <ProjectDiagnosticsView snapshot={snapshot} />}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6] dark:bg-[#0C0D0F]">
      {requestState.status === 'error' && (
        <div className="max-w-3xl mx-auto mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{requestState.error || '请求发生异常'}</span>
        </div>
      )}
      {renderActiveTabContent()}
    </main>
  );
};
