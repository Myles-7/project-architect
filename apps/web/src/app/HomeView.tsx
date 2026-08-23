import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  ArrowRight,
  Clock,
  Sparkles,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Folder,
} from 'lucide-react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { CardSkeleton } from '../components/common/LoadingSkeleton.js';
import { StageBadge } from '../components/common/StatusBadge.js';
import type { RecentProjectItem, ProjectStage } from '@project-architect/contracts';
import { ApiClientError } from '../api/client.js';

interface HomeViewProps {
  onOpenProject: (projectId: string) => void;
  onCreateProject: (name: string, idea: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenProject, onCreateProject }) => {
  const { apiClient } = useProjectSession();
  const [ideaInput, setIdeaInput] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recent Projects State
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const fetchRecentProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const list = await apiClient.listRecentProjects();
      setRecentProjects(list);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const msg = err instanceof ApiClientError ? err.message : '无法连接到本地服务，请确认服务端已启动。';
      setProjectsError(msg);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchRecentProjects();
  }, [fetchRecentProjects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const finalName = projectName.trim() || ideaInput.trim().slice(0, 24);
    onCreateProject(finalName, ideaInput.trim());
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0C0D0F] text-[#0F1115] dark:text-[#EDEDED] flex flex-col justify-between">
      {/* Top Header */}
      <header className="h-14 px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
            <Compass className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            Project Architect
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 flex flex-col justify-center space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>在编码前把项目想清楚</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            AI 项目构思与开发规范工作台
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            把模糊的想法逐步推演为结构化决策、明确的 MVP 范围以及可直接交给 Coding Agent 的工程级开发蓝图。
          </p>
        </div>

        {/* Idea Input Card */}
        <form
          onSubmit={handleSubmit}
          className="p-5 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-md space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              项目名称 (可选)
            </label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="例如：Local Audio Tagger"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="idea-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              项目构思与核心想法
            </label>
            <textarea
              id="idea-input"
              rows={4}
              value={ideaInput}
              onChange={(e) => setIdeaInput(e.target.value)}
              placeholder="描述你想做的产品，例如：一款运行在 Windows 本地的离线音频标签管理工具，支持 FLAC 批量清洗元数据..."
              className="w-full p-3.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 leading-relaxed resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              支持单轮单次结构化推演 · 严格保护本地隐私
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !ideaInput.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow transition-colors cursor-pointer"
            >
              <span>{isSubmitting ? '正在初始化...' : '开始推演构思'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Recent Projects Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>最近项目</span>
            </div>
            {!isLoadingProjects && !projectsError && recentProjects.length > 0 && (
              <button
                onClick={fetchRecentProjects}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                title="刷新列表"
              >
                <RefreshCw className="w-3 h-3" />
                <span>刷新</span>
              </button>
            )}
          </div>

          {/* Loading State */}
          {isLoadingProjects ? (
            <div className="space-y-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : projectsError ? (
            /* Error State */
            <div className="p-4 rounded-xl bg-red-50/80 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <div className="font-semibold mb-0.5">本地服务端未就绪</div>
                  <div className="text-red-700 dark:text-red-300 opacity-90">{projectsError}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={fetchRecentProjects}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>重试连接</span>
                </button>
              </div>
            </div>
          ) : recentProjects.length === 0 ? (
            /* Empty State */
            <EmptyState
              icon={FolderOpen}
              title="暂无最近项目"
              description="在上方输入想法并提交，系统将为您在工作区中创建新项目。"
              className="py-8"
            />
          ) : (
            /* Real Recent Projects List */
            <div className="space-y-2">
              {recentProjects.map((proj) => (
                <div
                  key={proj.projectId}
                  onClick={() => onOpenProject(proj.projectId)}
                  className="group p-3.5 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 hover:border-orange-500/50 dark:hover:border-orange-500/50 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onOpenProject(proj.projectId);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/60 transition-colors shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {proj.name}
                        </span>
                        <StageBadge stage={proj.stage as ProjectStage} size="sm" />
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {proj.projectId} · 更新于 {new Date(proj.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-zinc-200/80 dark:border-zinc-800/80 px-6 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-600">
        <div>Project Architect V1 · Local-First AI Workbench</div>
        <div className="flex items-center gap-4">
          <span>单次推理闭环</span>
          <span>零数据泄露</span>
        </div>
      </footer>
    </div>
  );
};
