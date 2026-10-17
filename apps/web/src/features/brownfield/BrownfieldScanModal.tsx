/**
 * @file BrownfieldScanModal.tsx
 * @description Reverse-Engineering Brownfield Codebase Ingestion Modal (方案 4).
 *
 * Guarantees:
 * 1. Safe path validation before scanning.
 * 2. User authority first: candidate decisions are presented with checkboxes; user chooses which to import.
 * 3. Never writes directly to confirmed/locked states.
 */

import React, { useState, useEffect } from 'react';
import {
  FolderSearch,
  Sparkles,
  CheckCircle2,
  FileCode,
  Cpu,
  Database,
  Palette,
  TestTube,
  X,
  ShieldCheck,
  Check,
  FolderOpen,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { useToast } from '../../components/common/Toast.js';
import { DirectoryBrowserModal } from '../../components/common/DirectoryBrowserModal.js';
import type {
  CodebaseAnalysisResult,
} from '@project-architect/contracts';

interface BrownfieldScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrownfieldScanModal: React.FC<BrownfieldScanModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, apiClient, refreshSnapshot } = useProjectSession();
  const { activeProjectId, stateRevision } = state;
  const { success, error } = useToast();

  const [scanPath, setScanPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CodebaseAnalysisResult | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

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

  const handleStartScan = async () => {
    if (!activeProjectId || !scanPath.trim() || isScanning) return;
    setIsScanning(true);
    try {
      const result = await apiClient.scanBrownfield(activeProjectId, scanPath.trim());
      setAnalysisResult(result);
      // Select all candidate keys by default
      const allKeys = new Set(result.candidateDecisions.map((d) => d.decisionKey));
      setSelectedKeys(allKeys);
      success(
        `扫描完成！耗时 ${result.scanDurationMs}ms，检测到 ${result.technologies.length} 项技术依赖与 ${result.candidateDecisions.length} 条候选决策。`,
        '代码库透视完成'
      );
    } catch (err: any) {
      error(err.message || '扫描代码库失败，请检查路径是否正确且存在读取权限', '扫描失败');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectKey = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const handleApplyCandidates = async () => {
    if (!activeProjectId || !analysisResult || isApplying) return;
    const toApply = analysisResult.candidateDecisions.filter((d) => selectedKeys.has(d.decisionKey));
    if (toApply.length === 0) {
      error('请至少勾选一项候选决策进行导入', '未选择任何项');
      return;
    }

    setIsApplying(true);
    try {
      const res = await apiClient.applyBrownfieldCandidates(
        activeProjectId,
        toApply,
        stateRevision || undefined
      );
      await refreshSnapshot();
      success(
        `成功将 ${res.appliedCount} 条架构决策以【候选建议 (Candidate)】状态录入当前项目！可在全景概览中核准确认。`,
        '候选决策已导入'
      );
      onClose();
    } catch (err: any) {
      error(err.message || '导入候选决策失败', '操作中断');
    } finally {
      setIsApplying(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'framework':
      case 'runtime':
        return <Cpu className="w-3.5 h-3.5 text-blue-500" />;
      case 'database':
        return <Database className="w-3.5 h-3.5 text-amber-500" />;
      case 'styling':
        return <Palette className="w-3.5 h-3.5 text-purple-500" />;
      case 'test':
        return <TestTube className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-3xl w-full max-h-[90vh] rounded-2xl bg-surface-overlay border border-border-default shadow-elevation-modal flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 flex items-center justify-center">
              <FolderSearch className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                已有代码库逆向扫描与架构透视 (Brownfield Ingestion)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                只读分析本地代码库依赖清单与目录结构，自动生成候选决策（遵循用户授权第一原则）
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label="关闭代码逆向扫描弹窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Path Input Box */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              目标工程根目录绝对路径 (Target Codebase Path)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                placeholder="例如：D:\workspace\my-legacy-app 或 /home/user/projects/web-service"
                className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setIsFolderBrowserOpen(true)}
                className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                title="选择本地代码库目录"
              >
                <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
                <span>浏览目录...</span>
              </button>
              <button
                type="button"
                onClick={handleStartScan}
                disabled={isScanning || !scanPath.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? '透视中...' : '开始透视扫描'}</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              系统将扫描 package.json / Cargo.toml / go.mod / pyproject.toml 等清单，自动过滤 node_modules 与构建产物。
            </p>
          </div>

          {/* Scan Results View */}
          {analysisResult && (
            <div className="space-y-4 pt-2">
              {/* Architecture Summary Bar */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-750 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-xs text-zinc-400 uppercase tracking-wider block">项目名称</span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                      {analysisResult.detectedProjectName || '未命名工程'}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
                  <div>
                    <span className="text-xs text-zinc-400 uppercase tracking-wider block">主力开发语言</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {analysisResult.primaryLanguage}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
                  <div>
                    <span className="text-xs text-zinc-400 uppercase tracking-wider block">架构形态</span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {analysisResult.isMonorepo ? 'Monorepo 多包拆分' : '单体架构 (Standalone)'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 font-mono">
                  已采样 {analysisResult.structureSummary.totalFilesScanned} 个文件 · 发现 {analysisResult.structureSummary.manifestFilesFound.length} 份包清单
                </div>
              </div>

              {/* Detected Technologies Pills */}
              {analysisResult.technologies.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    探测到的核心技术栈与依赖组件 ({analysisResult.technologies.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.technologies.map((t, idx) => (
                      <div
                        key={`${t.name}-${idx}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-2xs"
                      >
                        {getCategoryIcon(t.category)}
                        <span>{t.name}</span>
                        {t.version && (
                          <span className="text-xs font-mono text-zinc-400">
                            {t.version}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate Decisions Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-orange-500" />
                    <span>提取推演出的架构候选决策 (已选 {selectedKeys.size}/{analysisResult.candidateDecisions.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedKeys.size === analysisResult.candidateDecisions.length) {
                        setSelectedKeys(new Set());
                      } else {
                        setSelectedKeys(new Set(analysisResult.candidateDecisions.map((d) => d.decisionKey)));
                      }
                    }}
                    className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    {selectedKeys.size === analysisResult.candidateDecisions.length ? '全部取消' : '全选'}
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {analysisResult.candidateDecisions.map((cand) => {
                    const isChecked = selectedKeys.has(cand.decisionKey);
                    return (
                      <div
                        key={cand.decisionKey}
                        onClick={() => toggleSelectKey(cand.decisionKey)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                          isChecked
                            ? 'border-orange-500/80 bg-orange-50/30 dark:bg-orange-950/20 shadow-2xs'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-colors ${
                            isChecked
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              {cand.title}
                            </span>
                            <span className="text-xs font-mono text-zinc-400">
                              {cand.decisionKey}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {cand.summary}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {cand.evidence.map((ev, eIdx) => (
                              <span
                                key={eIdx}
                                className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-border-subtle bg-surface-subtle/50 flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {analysisResult ? (
              <span>将导入为 <strong className="text-orange-600 dark:text-orange-400">候选建议 (Candidate)</strong>，不会破坏已有锁定规则</span>
            ) : (
              <span>请输入并开始透视代码库</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭代码逆向扫描弹窗"
              className="px-3.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApplyCandidates}
              disabled={!analysisResult || selectedKeys.size === 0 || isApplying}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isApplying ? '正在导入...' : `确认导入 ${selectedKeys.size} 条候选建议`}</span>
            </button>
          </div>
        </div>
      </div>

      <DirectoryBrowserModal
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelect={(selectedPath) => setScanPath(selectedPath)}
        initialPath={scanPath || undefined}
        title="选择要逆向透视的目标代码库根目录"
      />
    </div>
  );
};
