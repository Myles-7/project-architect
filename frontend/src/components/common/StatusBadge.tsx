import React from 'react';
import { Lock } from 'lucide-react';
import type { ItemStatus, ImportanceLevel, SectionMaturity, ReadinessData } from '../../types/project';

interface StatusBadgeProps {
  status: ItemStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5';

  switch (status) {
    case 'confirmed':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Confirmed 已确认</span>
        </span>
      );
    case 'candidate':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
          <span>Candidate 候选</span>
        </span>
      );
    case 'assumption':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-mono font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          <span>Assumption 假设</span>
        </span>
      );
    case 'unresolved':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-mono font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>Unresolved 待决</span>
        </span>
      );
    case 'warning':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-mono font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Warning 风险</span>
        </span>
      );
    case 'locked':
      return (
        <span className={`inline-flex items-center gap-1 rounded font-mono font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ${sizeClasses}`}>
          <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
          <span>Locked 已锁定</span>
        </span>
      );
    default:
      return null;
  }
};

interface ImportanceBadgeProps {
  level: ImportanceLevel;
}

export const ImportanceBadge: React.FC<ImportanceBadgeProps> = ({ level }) => {
  switch (level) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Critical 阻断级决策</span>
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>High Priority 阻塞级关键决策</span>
        </span>
      );
    case 'normal':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          <span>Normal 细节补充</span>
        </span>
      );
  }
};

interface MaturityPillProps {
  maturity: SectionMaturity;
}

export const MaturityPill: React.FC<MaturityPillProps> = ({ maturity }) => {
  switch (maturity) {
    case 'confirmed':
      return (
        <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>已明确</span>
        </span>
      );
    case 'mostly_clear':
      return (
        <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>基本明确</span>
        </span>
      );
    case 'needs_clarity':
      return (
        <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>需澄清</span>
        </span>
      );
    case 'locked':
      return (
        <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5 text-zinc-500" />
          <span>已锁定</span>
        </span>
      );
    case 'unexplored':
    default:
      return (
        <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
          未探索
        </span>
      );
  }
};

interface ReadinessBadgeProps {
  status: ReadinessData['overallStatus'];
}

export const ReadinessBadge: React.FC<ReadinessBadgeProps> = ({ status }) => {
  switch (status) {
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Ready (核心范围已闭合)</span>
        </span>
      );
    case 'ready_with_warnings':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span>Ready w/ Warnings (可生成蓝图)</span>
        </span>
      );
    case 'not_ready':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          <span>Not Ready (仍有阻塞决策)</span>
        </span>
      );
  }
};
