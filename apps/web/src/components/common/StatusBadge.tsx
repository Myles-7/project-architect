import React from 'react';
import { Lock, Check, Clock, HelpCircle, AlertTriangle, AlertCircle, XCircle, Archive } from 'lucide-react';
import type { DecisionStatus, SectionMaturity, ReadinessStatus, ProjectStage } from '@project-architect/contracts';

export interface StatusBadgeProps {
  status: DecisionStatus | 'assumption' | 'unresolved' | 'warning' | 'candidate';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-xs px-1.5 py-0.5';

  switch (status) {
    case 'confirmed':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 ${sizeClasses}`}>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>已确认</span>
        </span>
      );
    case 'candidate':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-orange-700 dark:text-orange-300 bg-orange-50/80 dark:bg-orange-950/40 border border-dashed border-orange-300 dark:border-orange-800 ${sizeClasses}`}>
          <Clock className="w-3 h-3 text-orange-500 shrink-0" />
          <span>建议</span>
        </span>
      );
    case 'assumption':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 ${sizeClasses}`}>
          <HelpCircle className="w-3 h-3 text-purple-500 shrink-0" />
          <span>待验证假设</span>
        </span>
      );
    case 'unresolved':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 ${sizeClasses}`}>
          <Clock className="w-3 h-3 text-amber-500 shrink-0" />
          <span>待决</span>
        </span>
      );
    case 'warning':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 ${sizeClasses}`}>
          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>风险</span>
        </span>
      );
    case 'locked':
      return (
        <span className={`inline-flex items-center gap-1 rounded-md font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ${sizeClasses}`}>
          <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
          <span>已锁定</span>
        </span>
      );
    case 'superseded':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 line-through ${sizeClasses}`}>
          <Archive className="w-3 h-3 text-zinc-400 shrink-0" />
          <span>已替代</span>
        </span>
      );
    case 'rejected':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 ${sizeClasses}`}>
          <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>已拒绝</span>
        </span>
      );
    case 'deprecated':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 ${sizeClasses}`}>
          <Archive className="w-3 h-3 text-zinc-400 shrink-0" />
          <span>已废除</span>
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ${sizeClasses}`}>
          <HelpCircle className="w-3 h-3 text-zinc-400 shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
};

export const MaturityBadge: React.FC<{ maturity: SectionMaturity; size?: 'sm' | 'md' }> = ({ maturity, size = 'sm' }) => {
  const sizeClasses = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-xs px-1.5 py-0.5';

  switch (maturity) {
    case 'locked':
      return (
        <span className={`inline-flex items-center gap-1 rounded font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ${sizeClasses}`}>
          <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
          <span>已锁定</span>
        </span>
      );
    case 'clear':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 ${sizeClasses}`}>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>清晰</span>
        </span>
      );
    case 'mostly-clear':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 ${sizeClasses}`}>
          <Check className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>基本清晰</span>
        </span>
      );
    case 'needs-clarification':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 ${sizeClasses}`}>
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          <span>待澄清</span>
        </span>
      );
    case 'unexplored':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/80 ${sizeClasses}`}>
          <HelpCircle className="w-3 h-3 text-zinc-400 shrink-0" />
          <span>未探索</span>
        </span>
      );
  }
};

export const ReadinessBadge: React.FC<{ status: ReadinessStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-xs px-1.5 py-0.5';

  switch (status) {
    case 'ready':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 ${sizeClasses}`}>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>已就绪</span>
        </span>
      );
    case 'ready-with-warnings':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 ${sizeClasses}`}>
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          <span>带警示就绪</span>
        </span>
      );
    case 'not-ready':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 ${sizeClasses}`}>
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>未就绪</span>
        </span>
      );
  }
};

export const StageBadge: React.FC<{ stage: ProjectStage; size?: 'sm' | 'md' }> = ({ stage, size = 'sm' }) => {
  const sizeClasses = size === 'md' ? 'text-xs px-2 py-0.5' : 'text-xs px-1.5 py-0.5';

  const labels: Record<ProjectStage, string> = {
    'created': '初始化',
    'initial-analysis': '首次分析',
    'broad-pass': '广泛澄清',
    'deep-dive': '深度推演',
    'readiness-review': '完备度审阅',
    'approved': '已获准',
    'documents-generated': '已生成文档',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded font-mono font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ${sizeClasses}`}>
      <span>{labels[stage] || stage}</span>
    </span>
  );
};
