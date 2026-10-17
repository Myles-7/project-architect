/**
 * @file SpecDriftModal.tsx
 * @description Static Specification-Drift Auditor Modal (方案 8 — pa verify).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  X,
  FileCode,
  Layers,
  FileText,
  PackageX,
  Lightbulb,
  CheckCircle,
  FolderOpen,
  Info,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { useToast } from '../../components/common/Toast.js';
import { DirectoryBrowserModal } from '../../components/common/DirectoryBrowserModal.js';
import type { SpecDriftReport, DriftViolation } from '@project-architect/contracts';

interface SpecDriftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecDriftModal: React.FC<SpecDriftModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, apiClient } = useProjectSession();
  const { activeProjectId } = state;
  const { error } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<SpecDriftReport | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'error' | 'warning' | 'dependency' | 'boundary' | 'document'>('all');
  const [customPath, setCustomPath] = useState('');
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);

  const runAudit = useCallback(async () => {
    if (!activeProjectId || isLoading) return;
    setIsLoading(true);
    try {
      const res = await apiClient.verifySpecDrift(
        activeProjectId,
        customPath.trim() || undefined
      );
      setReport(res);
    } catch (err: any) {
      error(err.message || '运行规范漂移审计失败', '审计中断');
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, customPath, apiClient, error, isLoading]);

  useEffect(() => {
    if (isOpen && activeProjectId && !report) {
      runAudit();
    }
  }, [isOpen, activeProjectId, report, runAudit]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredViolations = (report?.violations || []).filter((v: DriftViolation) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'error') return v.severity === 'error';
    if (activeFilter === 'warning') return v.severity === 'warning';
    return v.category === activeFilter;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'dependency':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
            <PackageX className="w-3 h-3" />
            <span>违禁依赖</span>
          </span>
        );
      case 'boundary':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 text-xs font-medium border border-purple-200 dark:border-purple-900">
            <Layers className="w-3 h-3" />
            <span>边界穿透</span>
          </span>
        );
      case 'document':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-200 dark:border-amber-900">
            <FileText className="w-3 h-3" />
            <span>文档滞后</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-700">
            <FileCode className="w-3 h-3" />
            <span>目录规约</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-3xl w-full max-h-[90vh] rounded-2xl bg-surface-overlay border border-border-default shadow-elevation-modal flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              report?.isCompliant
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
            }`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>规范漂移静态审计器 (Spec-Drift Auditor)</span>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  pa verify
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                静态比对代码库实际依赖、分层引用与锁定架构决策，杜绝实现偏离规范
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="默认当前工程路径 (可选自定义路径)"
              className="w-56 px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            />
            <button
              type="button"
              onClick={() => setIsFolderBrowserOpen(true)}
              className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              title="选择本地代码库目录"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>浏览...</span>
            </button>
            <button
              type="button"
              onClick={runAudit}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-orange-500' : ''}`} />
              <span>{isLoading ? '审计中...' : '重新审计'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              aria-label="关闭规范漂移审计弹窗"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* P2-3: Dual-Boundary Notice Banner */}
          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold flex items-center gap-1.5">
                <span>双重视野边界声明：</span>
                <span className="font-normal text-[11px] text-indigo-700 dark:text-indigo-300">
                  工作台系统工程红线 (Zero-DB 等) 与当前项目自主选型空间隔离
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                此处静态审计只对当前项目已明确锁定的决策规约负责。用户项目自主选型 SQLite、PostgreSQL 或外部服务属于完全合规的领域技术方案，不受工作台宿主铁律限制。
              </p>
            </div>
          </div>

          {report && (
            <>
              {/* Compliance Scorecard */}
              <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
                report.isCompliant
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
              }`}>
                <div className="flex items-center gap-3">
                  {report.isCompliant ? (
                    <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {report.isCompliant ? '架构规范 100% 合规通过' : `发现 ${report.errorCount} 项严重漂移，${report.warningCount} 项潜在警告`}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      累计执行 {report.totalChecks} 项静态审计规则 · 耗时 {report.durationMs}ms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold border border-red-200 dark:border-red-900">
                    {report.errorCount} Errors
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-900">
                    {report.warningCount} Warnings
                  </span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  全部 ({report.violations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('error')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  严重错误 ({report.errorCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('warning')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeFilter === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  潜在警告 ({report.warningCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('dependency')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeFilter === 'dependency'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  依赖漂移
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('boundary')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeFilter === 'boundary'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  边界穿透
                </button>
              </div>

              {/* Violations List */}
              <div className="space-y-3">
                {filteredViolations.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      该分类下未发现任何架构漂移问题
                    </p>
                  </div>
                ) : (
                  filteredViolations.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${
                              v.severity === 'error'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            }`}
                          >
                            {v.severity}
                          </span>
                          {getCategoryBadge(v.category)}
                          <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {v.title}
                          </h5>
                        </div>

                        {v.filePath && (
                          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                            {v.filePath}{v.lineNumber ? `:${v.lineNumber}` : ''}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {v.description}
                      </p>

                      {/* Diff Comparison if provided */}
                      {(v.actual || v.expected) && (
                        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] space-y-1">
                          {v.actual && (
                            <div className="text-rose-600 dark:text-rose-400">
                              <span className="font-bold">- 实际现状: </span>
                              <span>{v.actual}</span>
                            </div>
                          )}
                          {v.expected && (
                            <div className="text-emerald-600 dark:text-emerald-400">
                              <span className="font-bold">+ 规范期望: </span>
                              <span>{v.expected}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actionable Remediation Box */}
                      <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">修复建议：</span>
                          <span>{v.remediation}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-border-subtle bg-surface-subtle/50 flex items-center justify-between">
          <div className="text-xs text-text-muted font-mono">
            {report?.targetPath && <span>审计目录: {report.targetPath}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭规范漂移审计弹窗"
            className="px-4 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>

      <DirectoryBrowserModal
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelect={(selectedPath) => {
          setCustomPath(selectedPath);
        }}
        initialPath={customPath || undefined}
        title="选择要静态审计架构规范的目标代码库目录"
      />
    </div>
  );
};
