import React from 'react';
import { 
  Home, 
  ChevronRight, 
  Sun, 
  Moon, 
  PanelRightClose, 
  PanelRightOpen,
  Sparkles,
  FileCheck2
} from 'lucide-react';
import type { ProjectState } from '../../types/project';

interface TopNavProps {
  project: ProjectState;
  activeTab: 'chat' | 'files' | 'documents' | 'readiness' | 'settings';
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigateHome: () => void;
  onOpenReadiness: () => void;
  onOpenDocuments: () => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TopNav: React.FC<TopNavProps> = ({
  project,
  activeTab,
  rightSidebarOpen,
  setRightSidebarOpen,
  onNavigateHome,
  onOpenReadiness,
  onOpenDocuments,
  darkMode,
  setDarkMode,
}) => {
  const getTabLabel = () => {
    switch (activeTab) {
      case 'chat':
        return '构思与澄清对话';
      case 'files':
        return '输入材料与附件';
      case 'documents':
        return '开发规范蓝图';
      case 'readiness':
        return '准备度审阅';
      case 'settings':
        return '本地设置';
      default:
        return '';
    }
  };

  return (
    <header className="h-12 border-b border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3]/90 dark:bg-[#0A0B0D]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 select-none">
      {/* Breadcrumb Trail */}
      <div className="flex items-center gap-2 text-xs sm:text-[13px] min-w-0">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 cursor-pointer"
          title="返回项目首页"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">首页</span>
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />

        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px] sm:max-w-[240px]">
          {project.name}
        </span>

        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />

        <span className="text-zinc-600 dark:text-zinc-400 truncate">
          {getTabLabel()}
        </span>

        <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-orange-100/70 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-900 ml-1">
          <Sparkles className="w-3 h-3 text-orange-500" />
          <span>Deep Dive 阶段</span>
        </span>
      </div>

      {/* Action Group */}
      <div className="flex items-center gap-2.5">
        {/* Global Readiness Pill */}
        <button
          onClick={onOpenReadiness}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/80 transition-colors cursor-pointer"
          title="点击查看项目开发准备度"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
          <span>Ready w/ Warnings</span>
        </button>

        {/* Blueprint Docs Shortcut */}
        <button
          onClick={onOpenDocuments}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#141519] hover:border-orange-400 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs"
          title="查看生成的 7 份开发蓝图"
        >
          <FileCheck2 className="w-3.5 h-3.5 text-orange-500" />
          <span className="hidden md:inline">蓝图文档</span>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={() => setDarkMode(prev => !prev)}
          className="p-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#141519] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          title={!darkMode ? '切换为暗色模式' : '切换为浅色模式'}
        >
          {!darkMode ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden lg:inline text-xs">暖白浅色</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden lg:inline text-xs">极夜深色</span>
            </>
          )}
        </button>

        {/* Overview Sidebar Toggle */}
        <button
          onClick={() => setRightSidebarOpen(prev => !prev)}
          className="p-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#141519] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
          title={rightSidebarOpen ? '隐藏全景 Overview' : '展开全景 Overview'}
        >
          {rightSidebarOpen ? (
            <PanelRightClose className="w-4 h-4 text-orange-500" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
