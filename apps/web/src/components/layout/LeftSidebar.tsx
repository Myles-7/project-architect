import React from 'react';
import { MessageSquare, Paperclip, History, Settings, Plus, Compass } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import type { WorkspaceTab } from '../../types/session.js';

interface LeftSidebarProps { onNewProject: () => void; onNavigate?: () => void; isIconOnly?: boolean; inDrawer?: boolean }

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ onNewProject, onNavigate, isIconOnly = false, inDrawer = false }) => {
  const { state, setActiveTab } = useProjectSession();
  if (!inDrawer && state.uiState.isLeftSidebarCollapsed && !isIconOnly) return null;
  const main = [
    { id: 'chat', label: '规划工作台', icon: MessageSquare },
    { id: 'files', label: '材料', icon: Paperclip },
    { id: 'timeline', label: '历史', icon: History },
    { id: 'settings', label: '诊断', icon: Settings },
  ] as const;
  const button = (item: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }, compact: boolean) => <button key={item.id} type="button" title={item.label} aria-label={item.label} aria-current={state.uiState.activeTab === item.id ? 'page' : undefined} className={`planning-nav-item ${compact ? 'compact' : ''} ${state.uiState.activeTab === item.id ? 'is-active' : ''}`} onClick={() => { setActiveTab(item.id); onNavigate?.(); }}><item.icon className="w-4 h-4 shrink-0" />{!compact && <span>{item.label}</span>}</button>;
  return <aside className={`planning-sidebar ${isIconOnly ? 'compact' : ''} ${inDrawer ? 'in-drawer' : ''}`}>
    <div>
      <div className="planning-sidebar-project"><Compass className="w-5 h-5 text-orange-600 shrink-0" />{!isIconOnly && <div><small>当前项目</small><strong>{state.snapshot?.metadata.name || '未加载项目'}</strong></div>}</div>
      <nav aria-label="工作台主导航">{main.map(item => button(item, isIconOnly))}</nav>
    </div>
    <button className="planning-button primary" type="button" onClick={onNewProject} aria-label="新建项目"><Plus className="w-4 h-4" />{!isIconOnly && '新建项目'}</button>
  </aside>;
};
