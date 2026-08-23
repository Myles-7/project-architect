import React from 'react';
import {
  Home,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import { StageBadge } from '../common/StatusBadge.js';
import type { WorkspaceTab } from '../../types/session.js';

interface TopNavProps {
  onNavigateHome: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onNavigateHome }) => {
  const { state, toggleOverview, toggleLeftSidebar, setActiveTab } = useProjectSession();
  const { snapshot, uiState, stateRevision } = state;

  const getTabLabel = (tab: WorkspaceTab) => {
    switch (tab) {
      case 'chat':
        return '构思与澄清对话';
      case 'files':
        return '输入材料与附件';
      case 'documents':
        return '开发规范蓝图';
      case 'readiness':
        return '准备度审阅';
      case 'timeline':
        return '演进时间线';
      case 'settings':
        return '工作台设置';
      default:
        return '';
    }
  };

  return (
    <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6]/90 dark:bg-[#0C0D0F]/90 backdrop-blur-md px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left: Breadcrumbs & Left Sidebar Toggle */}
      <div className="flex items-center gap-2 text-xs min-w-0">
        <button
          onClick={toggleLeftSidebar}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={uiState.isLeftSidebarCollapsed ? '展开导航栏' : '折叠导航栏'}
          aria-label="切换侧边栏"
        >
          {uiState.isLeftSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          title="返回项目首页"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">首页</span>
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />

        {snapshot ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-[280px]">
              {snapshot.metadata.name}
            </span>
            <StageBadge stage={snapshot.metadata.stage} size="sm" />
            {stateRevision !== null && (
              <span className="hidden md:inline-flex px-1.5 py-0.2 rounded font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                rev.{stateRevision}
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-600">未选择项目</span>
        )}

        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0 hidden sm:inline" />

        <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline font-medium">
          {getTabLabel(uiState.activeTab)}
        </span>
      </div>

      {/* Right: Actions & Overview Toggle */}
      <div className="flex items-center gap-2">
        {/* Readiness Quick Access Button */}
        <button
          onClick={() => setActiveTab('readiness')}
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            uiState.activeTab === 'readiness'
              ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80'
          }`}
          title="查看准备度与准入评估"
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span>准备度审阅</span>
        </button>

        {/* Documents Quick Access Button */}
        <button
          onClick={() => setActiveTab('documents')}
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            uiState.activeTab === 'documents'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80'
          }`}
          title="查看生成的开发规范文档"
        >
          <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>开发蓝图</span>
        </button>

        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

        <ThemeToggle />

        {/* Right Overview Drawer Toggle */}
        <button
          onClick={toggleOverview}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            !uiState.isOverviewCollapsed
              ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title={uiState.isOverviewCollapsed ? '展开 Overview 看板' : '折叠 Overview 看板'}
          aria-label="切换 Overview 看板"
        >
          {uiState.isOverviewCollapsed ? (
            <PanelRightOpen className="w-4 h-4" />
          ) : (
            <PanelRightClose className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
