import React from 'react';
import { 
  MessageSquare, 
  Paperclip, 
  FileText, 
  ShieldCheck, 
  Settings, 
  Plus, 
  ChevronDown,
  Activity,
  CheckCircle2,
  Lock,
  Radio
} from 'lucide-react';
import type { ProjectState } from '../../types/project';

interface LeftSidebarProps {
  project: ProjectState;
  activeTab: 'chat' | 'files' | 'documents' | 'readiness' | 'settings';
  setActiveTab: React.Dispatch<React.SetStateAction<'chat' | 'files' | 'documents' | 'readiness' | 'settings'>>;
  isOpen: boolean;
  onNewProject: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  project,
  activeTab,
  setActiveTab,
  isOpen,
  onNewProject,
}) => {
  if (!isOpen) return null;

  const confirmedCount = project.overviewSections.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.status === 'confirmed').length,
    0
  );
  const lockedCount = project.overviewSections.reduce(
    (acc, sec) => acc + sec.items.filter((i) => i.locked).length,
    0
  );
  const totalItems = project.overviewSections.reduce(
    (acc, sec) => acc + sec.items.length,
    0
  );
  const convergencePercent = Math.min(
    100,
    Math.round(((confirmedCount + lockedCount) / Math.max(1, totalItems * 1.3)) * 100)
  );

  const navItems = [
    {
      id: 'chat' as const,
      label: '构思与澄清对话',
      icon: MessageSquare,
      badge: 'Active',
      badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300',
    },
    {
      id: 'files' as const,
      label: '输入材料与附件',
      icon: Paperclip,
      count: project.attachedFiles.length,
    },
    {
      id: 'documents' as const,
      label: '规格蓝图文档',
      icon: FileText,
      count: `${project.documents.length} 份`,
      countColor: 'text-emerald-600 dark:text-emerald-400 font-semibold',
    },
    {
      id: 'readiness' as const,
      label: '开发准备度审阅',
      icon: ShieldCheck,
      badge: 'Warnings (2)',
      badgeColor: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300',
    },
    {
      id: 'settings' as const,
      label: '本地设置与偏好',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-60 lg:w-64 border-r border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3] dark:bg-[#0A0B0D] flex flex-col shrink-0 select-none text-zinc-800 dark:text-zinc-200">
      {/* Workspace Switcher Header */}
      <div className="p-3.5 border-b border-[#E5E2DA] dark:border-[#1E2026]">
        <button className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#121316] hover:border-zinc-400 dark:hover:border-zinc-600 transition-all text-left shadow-2xs group cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              P
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {project.name}
              </div>
              <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{project.stateRevision}</span>
              </div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors" />
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-2.5 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 font-mono tracking-wider">
          工作台导航
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#15161A] text-zinc-900 dark:text-zinc-100 shadow-2xs border border-[#E5E2DA] dark:border-[#1E2026] font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
              {item.count && (
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800/60 ${item.countColor || 'text-zinc-500 dark:text-zinc-400'}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Decision Telemetry Dashboard */}
      <div className="p-3.5 border-t border-[#E5E2DA] dark:border-[#1E2026] bg-white/70 dark:bg-[#121316]/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
            <Activity className="w-3.5 h-3.5 text-orange-500" />
            <span>决策收敛遥测</span>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {convergencePercent}%
          </span>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${convergencePercent}%` }}
          />
        </div>

        {/* Metric Badges Row */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg bg-[#F7F6F3] dark:bg-[#16171B] border border-[#E5E2DA]/80 dark:border-[#1E2026] flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">已确认</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {confirmedCount} 项
            </span>
          </div>
          <div className="p-2 rounded-lg bg-[#F7F6F3] dark:bg-[#16171B] border border-[#E5E2DA]/80 dark:border-[#1E2026] flex items-center justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">已锁定</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {lockedCount} 项
            </span>
          </div>
        </div>

        {/* Runtime Status */}
        <div className="space-y-1 text-xs pt-1 border-t border-[#E5E2DA]/60 dark:border-[#1E2026]">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>推进阶段</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400 font-mono">Deep Dive 澄清</span>
          </div>
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>Agent 状态</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              单次推理就绪
            </span>
          </div>
        </div>
      </div>

      {/* Bottom New Project Action */}
      <div className="p-3 border-t border-[#E5E2DA] dark:border-[#1E2026]">
        <button
          onClick={onNewProject}
          className="w-full py-2 px-3 rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#141519] hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 text-xs sm:text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>新建项目构思</span>
        </button>
      </div>
    </aside>
  );
};
