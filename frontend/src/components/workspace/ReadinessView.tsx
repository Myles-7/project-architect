import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  ArrowRight, 
  FileCheck2, 
  Sparkles,
  HelpCircle,
  Filter
} from 'lucide-react';
import type { ReadinessData } from '../../types/project';
import { useToast } from '../common/Toast';

interface ReadinessViewProps {
  readiness: ReadinessData;
  onApproveDocuments: () => void;
  onReturnToDiscovery: () => void;
}

export const ReadinessView: React.FC<ReadinessViewProps> = ({
  readiness,
  onApproveDocuments,
  onReturnToDiscovery,
}) => {
  const { showToast } = useToast();
  const [selectedBucketFilter, setSelectedBucketFilter] = useState<'all' | 'ready' | 'warnings' | 'highIssues' | 'criticalConflicts'>('all');

  const { overallStatus, buckets, stateRevision } = readiness;

  const handleApprove = () => {
    showToast(
      '已批准当前规范状态模型',
      '已触发 AGENTS.md 与 7 份开发蓝图生成并同步更新',
      'success'
    );
    onApproveDocuments();
  };

  const getStatusBanner = () => {
    switch (overallStatus) {
      case 'ready':
        return {
          title: 'Ready (准备度完全就绪)',
          desc: '所有核心范围与关键架构决策均已闭环，无阻断项，具备生成工程蓝图条件。',
          color: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          badgeBg: 'bg-emerald-600 text-white',
          icon: CheckCircle2,
        };
      case 'ready_with_warnings':
        return {
          title: 'Ready with Warnings (带已知风险就绪)',
          desc: '核心决策已闭环，存在次要 Warning 或暂定假设，但在文档生成中会明确标注已知风险，不阻碍开工。',
          color: 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
          badgeBg: 'bg-amber-600 text-white',
          icon: AlertTriangle,
        };
      case 'not_ready':
      default:
        return {
          title: 'Not Ready (尚有关键待决项)',
          desc: '存在 High Priority Gaps 或未解决的冲突，建议在 Discovery 对话中完成关键澄清后再生成。',
          color: 'bg-rose-500/10 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
          badgeBg: 'bg-rose-600 text-white',
          icon: AlertOctagon,
        };
    }
  };

  const banner = getStatusBanner();
  const StatusIcon = banner.icon;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 bg-[#F7F6F3] dark:bg-[#0A0B0D] space-y-7 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-[#E5E2DA] dark:border-[#1E2026] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              开发准备度审阅 (Readiness Review)
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {stateRevision}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            依据 Blueprint 规范评估项目完整度，区分 Ready、Warnings、High Issues 与 Critical Conflicts。
          </p>
        </div>

        {/* Global Status Pill */}
        <div className={`px-3.5 py-2 rounded-xl border flex items-center gap-2.5 ${banner.color} shrink-0 shadow-2xs`}>
          <StatusIcon className="w-4 h-4" />
          <span className="text-xs sm:text-sm font-semibold">{banner.title}</span>
        </div>
      </div>

      {/* 4 Health Buckets Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Ready Bucket */}
        <div
          onClick={() => setSelectedBucketFilter(selectedBucketFilter === 'ready' ? 'all' : 'ready')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            selectedBucketFilter === 'ready'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-[#121316] border-[#E5E2DA] dark:border-[#1E2026] hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-semibold">
            <span>Ready 已就绪</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-mono">
            {buckets.ready.length} <span className="text-xs font-normal text-zinc-500">项</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            核心定义已闭合
          </div>
        </div>

        {/* 2. Warnings Bucket */}
        <div
          onClick={() => setSelectedBucketFilter(selectedBucketFilter === 'warnings' ? 'all' : 'warnings')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            selectedBucketFilter === 'warnings'
              ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-[#121316] border-[#E5E2DA] dark:border-[#1E2026] hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-semibold">
            <span>Warnings 需知晓</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-mono">
            {buckets.warnings.length} <span className="text-xs font-normal text-zinc-500">项</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            不阻碍继续，文档中保留
          </div>
        </div>

        {/* 3. High Issues Bucket */}
        <div
          onClick={() => setSelectedBucketFilter(selectedBucketFilter === 'highIssues' ? 'all' : 'highIssues')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            selectedBucketFilter === 'highIssues'
              ? 'bg-orange-50/80 dark:bg-orange-950/50 border-orange-500 ring-2 ring-orange-500/20'
              : 'bg-white dark:bg-[#121316] border-[#E5E2DA] dark:border-[#1E2026] hover:border-orange-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm text-orange-700 dark:text-orange-400 font-semibold">
            <span>High Issues 待决</span>
            <HelpCircle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-mono">
            {buckets.highIssues.length} <span className="text-xs font-normal text-zinc-500">项</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            建议明确或采用假设
          </div>
        </div>

        {/* 4. Critical Conflicts Bucket */}
        <div
          onClick={() => setSelectedBucketFilter(selectedBucketFilter === 'criticalConflicts' ? 'all' : 'criticalConflicts')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            selectedBucketFilter === 'criticalConflicts'
              ? 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-[#121316] border-[#E5E2DA] dark:border-[#1E2026] hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm text-rose-700 dark:text-rose-400 font-semibold">
            <span>Critical 冲突</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-mono">
            {buckets.criticalConflicts.length} <span className="text-xs font-normal text-zinc-500">项</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            0 致命阻塞
          </div>
        </div>
      </div>

      {/* Action Recommendation Alert Box */}
      <div className="p-4 sm:p-5 rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-2xs">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-orange-950 dark:text-orange-200 text-xs sm:text-sm">
              系统推荐下一步动作:
            </div>
            <p className="text-orange-900 dark:text-orange-300 mt-1 leading-relaxed text-xs">
              核心范围已闭合，有 {buckets.warnings.length} 项次要 Warning 与 1 项材料截断 Issue，可选择【批准并生成文档】或【继续在 Discovery 中完善】。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onReturnToDiscovery}
            className="px-4 py-2 rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#141519] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium transition-colors cursor-pointer"
          >
            继续澄清
          </button>
          <button
            onClick={handleApprove}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>批准并生成蓝图文档</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detailed Checklist Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span>细分核验清单明细</span>
            {selectedBucketFilter !== 'all' && (
              <span className="text-xs px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-mono">
                已过滤: {selectedBucketFilter}
              </span>
            )}
          </h2>

          {selectedBucketFilter !== 'all' && (
            <button
              onClick={() => setSelectedBucketFilter('all')}
              className="text-xs text-orange-600 hover:underline cursor-pointer"
            >
              显示全部项目
            </button>
          )}
        </div>

        {/* 1. Ready Elements */}
        {(selectedBucketFilter === 'all' || selectedBucketFilter === 'ready') && (
          <div className="space-y-2.5">
            <div className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>已就绪的核心要素 (Ready - {buckets.ready.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buckets.ready.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#121316] shadow-2xs space-y-1.5"
                >
                  <div className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Warnings Elements */}
        {(selectedBucketFilter === 'all' || selectedBucketFilter === 'warnings') && (
          <div className="space-y-2.5 pt-2">
            <div className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>潜在风险与已知注意事项 (Warnings - {buckets.warnings.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buckets.warnings.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-2xs space-y-1.5"
                >
                  <div className="text-xs sm:text-[13px] font-bold text-amber-900 dark:text-amber-300">
                    {item.title}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. High Issues Elements */}
        {(selectedBucketFilter === 'all' || selectedBucketFilter === 'highIssues') && buckets.highIssues.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span>待决高优缺口 (High Issues - {buckets.highIssues.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buckets.highIssues.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/30 dark:bg-orange-950/10 shadow-2xs space-y-1.5"
                >
                  <div className="text-xs sm:text-[13px] font-bold text-orange-950 dark:text-orange-200">
                    {item.title}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
