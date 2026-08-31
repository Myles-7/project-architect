import React, { useState, useEffect } from 'react';
import {
  Activity,
  Folder,
  Copy,
  Check,
  FileCode,
  HardDrive,
  Cpu,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { StageBadge } from '../../components/common/StatusBadge.js';
import { useToast } from '../../components/common/Toast.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

export interface ProjectDiagnosticsViewProps {
  snapshot?: ProjectSnapshot;
}

export const ProjectDiagnosticsView: React.FC<ProjectDiagnosticsViewProps> = ({
  snapshot: propsSnapshot,
}) => {
  const { state, apiClient } = useProjectSession();
  const snapshot = propsSnapshot || state.snapshot;
  const { activeProjectId, stateRevision } = state;
  const { success, error } = useToast();
  const [copied, setCopied] = useState(false);
  const [discoveryTurnCount, setDiscoveryTurnCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    setIsLoading(true);
    apiClient
      .getDiscoveryTurns(activeProjectId)
      .then((res) => {
        setDiscoveryTurnCount(res.turns.length);
      })
      .catch(() => {
        setDiscoveryTurnCount(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeProjectId, apiClient, stateRevision]);

  const handleCopyPath = async () => {
    if (!snapshot?.metadata?.projectId) return;
    try {
      // In local-first desktop workbench, project folder is under workspace
      const path = `.workspace/projects/${snapshot.metadata.projectId}`;
      await navigator.clipboard.writeText(path);
      setCopied(true);
      success('已复制项目物理路径至剪贴板', '复制成功');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      error('复制路径失败', '剪贴板受限');
    }
  };

  const handleOpenFolder = async () => {
    if (!activeProjectId) return;
    try {
      await apiClient.openProjectFolder(activeProjectId);
      success('已在文件管理器中打开项目目录', '已打开');
    } catch {
      error('无法打开本地文件夹，请手动检查系统环境', '打开失败');
    }
  };

  if (!snapshot) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500">
        未加载项目，请先选择或创建一个项目。
      </div>
    );
  }

  const confirmedCount = (snapshot.decisions?.items || []).filter(
    (d) => d.status === 'confirmed' || d.status === 'locked'
  ).length;
  const candidateCount = (snapshot.decisions?.items || []).filter(
    (d) => d.status === 'candidate'
  ).length;
  const openGapsCount = (snapshot.gaps?.gaps || []).filter((g) => g.status === 'open').length;
  const openConflictsCount = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open').length;
  const materialsCount = (snapshot.metadata.inputRefs || []).length;
  const documentsCount = (snapshot.documents?.items || []).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            <span>项目健康与运行诊断中心</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            检查本地文件状态存储、两阶段提交完整性、版本演进以及 Discovery 推演轮次。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={snapshot.metadata.stage} />
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            rev.{stateRevision ?? snapshot.metadata.stateRevision}
          </span>
        </div>
      </div>

      {/* Project Identity & Storage */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-3">
        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-zinc-500" />
          <span>本地存储与物理路径</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
            <div className="text-zinc-400 text-[11px] mb-1">项目标识符 (Project ID)</div>
            <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {snapshot.metadata.projectId}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
            <div className="text-zinc-400 text-[11px] mb-1">项目全称</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {snapshot.metadata.name}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 text-xs">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Folder className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="font-mono text-zinc-600 dark:text-zinc-400 truncate">
              .workspace/projects/{snapshot.metadata.projectId}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyPath}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
              aria-label="复制项目本地路径"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '已复制' : '复制路径'}</span>
            </button>
            <button
              onClick={handleOpenFolder}
              className="px-2 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-medium flex items-center gap-1 cursor-pointer"
              aria-label="在本地文件管理器中打开"
            >
              <Folder className="w-3 h-3" />
              <span>打开目录</span>
            </button>
          </div>
        </div>
      </div>

      {/* State Files Health Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
          <div className="text-zinc-400 text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>已确认决策</span>
          </div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {confirmedCount} 项
          </div>
          <div className="text-[10px] text-zinc-500">另有 {candidateCount} 项候选建议</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
          <div className="text-zinc-400 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>待决缺口/冲突</span>
          </div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {openGapsCount + openConflictsCount} 项
          </div>
          <div className="text-[10px] text-zinc-500">{openConflictsCount} 项红线互斥</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
          <div className="text-zinc-400 text-[11px] flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-blue-500" />
            <span>输入附件与材料</span>
          </div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {materialsCount} 份材料
          </div>
          <div className="text-[10px] text-zinc-500">含 {documentsCount} 份生成文档</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-1">
          <div className="text-zinc-400 text-[11px] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span>推演轮次记录</span>
          </div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isLoading ? '加载中...' : `${discoveryTurnCount ?? 0} 轮`}
          </div>
          <div className="text-[10px] text-zinc-500">完整轮次与审计日志保存</div>
        </div>
      </div>
    </div>
  );
};
