import React from 'react';
import { Home, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { ThemeToggle } from '../common/ThemeToggle.js';

export const TopNav: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { state, toggleLeftSidebar } = useProjectSession();
  const { snapshot, uiState, stateRevision } = state;
  const label = uiState.activeTab === 'chat' ? '规划工作台' : uiState.activeTab === 'files' ? '材料' : uiState.activeTab === 'settings' ? '诊断' : '历史';
  return <header className="workspace-topbar h-12 border-b border-border-subtle bg-canvas px-4 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-2 text-xs min-w-0">
      <button onClick={toggleLeftSidebar} className="planning-icon-button" title={uiState.isLeftSidebarCollapsed ? '展开导航栏' : '折叠导航栏'} aria-label={uiState.isLeftSidebarCollapsed ? '展开主导航栏' : '折叠主导航栏'}>
        {uiState.isLeftSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>
      <button onClick={onNavigateHome} className="planning-icon-button" title="返回项目首页" aria-label="返回项目首页"><Home className="w-4 h-4" /></button>
      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
      <span className="font-semibold truncate text-text-primary">{snapshot?.metadata.name || '未选择项目'}</span>
      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0 hidden sm:inline" />
      <span className="text-text-muted hidden sm:inline shrink-0">{label}</span>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      {stateRevision !== null && <span className="hidden md:inline text-xs text-text-muted">版本 {stateRevision}</span>}
      <ThemeToggle />
    </div>
  </header>;
};
