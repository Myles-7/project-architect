import React from 'react';
import {
  MessageSquare,
  Paperclip,
  FileText,
  ShieldCheck,
  History,
  Settings,
  Plus,
  Compass,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import type { WorkspaceTab } from '../../types/session.js';

interface LeftSidebarProps {
  onNewProject: () => void;
  onNavigate?: () => void;
  isIconOnly?: boolean;
  inDrawer?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onNewProject,
  onNavigate,
  isIconOnly = false,
  inDrawer = false,
}) => {
  const { state, setActiveTab } = useProjectSession();
  const { snapshot, uiState } = state;

  if (!inDrawer && uiState.isLeftSidebarCollapsed && !isIconOnly) {
    return null;
  }

  // Derive real statistics from canonical snapshot (no mock numbers)
  const confirmedDecisionsCount = (snapshot?.decisions?.items || []).filter(
    (d) => d.status === 'confirmed'
  ).length;

  const lockedDecisionsCount = (snapshot?.decisions?.items || []).filter(
    (d) => d.status === 'locked'
  ).length;

  const inputMaterialsCount = (snapshot?.metadata?.inputRefs || []).length;
  const documentsCount = snapshot?.documents?.items?.length || 0;

  const navItems: {
    id: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number | string;
    countColor?: string;
  }[] = [
    {
      id: 'chat',
      label: '构思与澄清对话',
      icon: MessageSquare,
    },
    {
      id: 'files',
      label: '输入材料与附件',
      icon: Paperclip,
      count: inputMaterialsCount,
    },
    {
      id: 'documents',
      label: '规格蓝图文档',
      icon: FileText,
      count: documentsCount > 0 ? `${documentsCount} 份` : undefined,
      countColor: 'text-emerald-600 dark:text-emerald-400 font-semibold',
    },
    {
      id: 'readiness',
      label: '准备度审阅',
      icon: ShieldCheck,
    },
    {
      id: 'timeline',
      label: '演进时间线',
      icon: History,
    },
    {
      id: 'settings',
      label: '工作台设置',
      icon: Settings,
    },
  ];

  const handleNavigate = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    onNavigate?.();
  };

  if (isIconOnly) {
    return (
      <aside className="w-16 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6] dark:bg-[#0C0D0F] flex flex-col justify-between items-center py-3 select-none z-10">
        <div className="space-y-4 w-full flex flex-col items-center">
          {/* Compact Project Icon */}
          <div
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-center shadow-2xs cursor-default"
            title={`${snapshot?.metadata?.name || '未加载项目'} (rev.${snapshot?.metadata?.stateRevision || 1})`}
          >
            <Compass className="w-4 h-4 text-orange-500" />
          </div>

          {/* Compact Nav Icons */}
          <nav className="space-y-2 w-full flex flex-col items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = uiState.activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all cursor-pointer min-touch-target ${
                    isActive
                      ? 'bg-white dark:bg-[#17181D] text-orange-500 shadow-2xs border border-zinc-200/80 dark:border-zinc-800'
                      : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.count !== undefined && item.count !== 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Compact New Project Button */}
        <div className="w-full flex justify-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onNewProject}
            title="新建项目"
            aria-label="新建项目"
            className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 flex items-center justify-center transition-colors shadow-2xs cursor-pointer min-touch-target"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  const containerClasses = inDrawer
    ? 'w-full h-full bg-transparent flex flex-col justify-between select-none'
    : 'w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6] dark:bg-[#0C0D0F] flex flex-col justify-between select-none z-10 transition-all';

  return (
    <aside className={containerClasses}>
      {/* Top: Project Info & Nav Tabs */}
      <div className="p-3 space-y-4">
        {/* Project Header Widget */}
        <div className="p-3 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                当前项目
              </span>
            </div>
            {snapshot && (
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                {snapshot.metadata.projectId}
              </span>
            )}
          </div>
          <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
            {snapshot?.metadata?.name || '未加载项目'}
          </div>

          {/* Quick Metrics Bar */}
          {snapshot && (
            <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[10px]">
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{confirmedDecisionsCount} 已确认</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                <Lock className="w-3 h-3" />
                <span>{lockedDecisionsCount} 锁定</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = uiState.activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-touch-target ${
                  isActive
                    ? 'bg-white dark:bg-[#17181D] text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200/80 dark:border-zinc-800'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
                }`}
                aria-label={item.label}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.count !== undefined && item.count !== 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      item.countColor || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: New Project Button & Status */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-xl text-xs font-medium transition-colors shadow-2xs cursor-pointer min-touch-target"
          aria-label="新建项目"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建项目</span>
        </button>
      </div>
    </aside>
  );
};
