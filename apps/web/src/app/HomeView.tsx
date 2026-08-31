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
  ChevronDown,
  ChevronUp,
  Folder,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  UploadCloud,
  Users,
  Target,
  CheckSquare,
  Sliders,
  Search,
  Pin,
  Copy,
  Edit2,
  Archive,
  Trash2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { CardSkeleton } from '../components/common/LoadingSkeleton.js';
import { StageBadge } from '../components/common/StatusBadge.js';
import { ProviderHealthModal } from '../features/home/ProviderHealthModal.js';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '../features/home/ProjectTemplates.js';
import type { RecentProjectItem, ProjectStage, InitialProjectIntent } from '@project-architect/contracts';
import { ApiClientError } from '../api/client.js';

interface AttachedMaterial {
  id: string;
  filename: string;
  kind: 'text' | 'image' | 'file';
  content: string;
  contentEncoding?: 'utf8' | 'base64';
  size: number;
}

interface HomeViewProps {
  onOpenProject: (projectId: string) => void;
  onCreateProject: (
    name: string,
    idea?: string,
    initialIntent?: InitialProjectIntent,
    attachedFiles?: { filename: string; kind: 'text' | 'image' | 'file'; content: string; contentEncoding?: 'utf8' | 'base64' }[]
  ) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenProject, onCreateProject }) => {
  const { apiClient } = useProjectSession();
  const [entryMode, setEntryMode] = useState<'structured' | 'freeform'>('structured');
  const [targetUser, setTargetUser] = useState('');
  const [coreProblem, setCoreProblem] = useState('');
  const [mvpResult, setMvpResult] = useState('');
  const [knownConstraints, setKnownConstraints] = useState('');
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(false);

  const [ideaInput, setIdeaInput] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedMaterial[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Draft recovery state
  const HOME_DRAFT_KEY = 'pa:home_creation_draft';
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);

  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HOME_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetUser || parsed.coreProblem || parsed.mvpResult || parsed.ideaInput) {
          if (parsed.targetUser) setTargetUser(parsed.targetUser);
          if (parsed.coreProblem) setCoreProblem(parsed.coreProblem);
          if (parsed.mvpResult) setMvpResult(parsed.mvpResult);
          if (parsed.knownConstraints) setKnownConstraints(parsed.knownConstraints);
          if (parsed.ideaInput) setIdeaInput(parsed.ideaInput);
          if (parsed.projectName) setProjectName(parsed.projectName);
          if (parsed.entryMode) setEntryMode(parsed.entryMode);
          setDraftRestoredAt(parsed.savedAt || '刚刚');
        }
      }
    } catch {}
  }, []);

  // Save draft on change
  useEffect(() => {
    if (isSubmitting) return;
    const hasContent = Boolean(targetUser || coreProblem || mvpResult || knownConstraints || ideaInput || projectName);
    try {
      if (hasContent) {
        localStorage.setItem(
          HOME_DRAFT_KEY,
          JSON.stringify({
            targetUser,
            coreProblem,
            mvpResult,
            knownConstraints,
            ideaInput,
            projectName,
            entryMode,
            savedAt: new Date().toLocaleTimeString(),
          })
        );
      } else {
        localStorage.removeItem(HOME_DRAFT_KEY);
      }
    } catch {}
  }, [targetUser, coreProblem, mvpResult, knownConstraints, ideaInput, projectName, entryMode, isSubmitting]);

  const clearHomeDraft = () => {
    setTargetUser('');
    setCoreProblem('');
    setMvpResult('');
    setKnownConstraints('');
    setIdeaInput('');
    setProjectName('');
    setDraftRestoredAt(null);
    try {
      localStorage.removeItem(HOME_DRAFT_KEY);
    } catch {}
  };

  // Recent Projects State
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Search, Filter & Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [projectsTab, setProjectsTab] = useState<'active' | 'archived'>('active');
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

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

  const handleTogglePin = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    try {
      await apiClient.pinProject(proj.projectId);
      await fetchRecentProjects();
    } catch {}
  };

  const handleToggleArchive = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    try {
      await apiClient.archiveProject(proj.projectId);
      await fetchRecentProjects();
    } catch {}
  };

  const handleDuplicate = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    try {
      await apiClient.duplicateProject(proj.projectId);
      await fetchRecentProjects();
    } catch {}
  };

  const handleOpenFolder = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    try {
      await apiClient.openProjectFolder(proj.projectId);
    } catch {
      try {
        await navigator.clipboard.writeText(proj.projectPath);
        alert(`已复制项目真实物理路径至剪贴板：\n${proj.projectPath}`);
      } catch {}
    }
  };

  const handleDelete = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    if (window.confirm(`确定要安全删除项目 "${proj.name}" 吗？该操作将彻底清理本地目录。`)) {
      try {
        await apiClient.deleteProject(proj.projectId);
        await fetchRecentProjects();
      } catch {}
    }
  };

  const handleStartRename = (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    setRenamingProjectId(proj.projectId);
    setRenamingName(proj.name);
  };

  const handleConfirmRename = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    if (!renamingName.trim() || renamingName.trim() === proj.name) {
      setRenamingProjectId(null);
      return;
    }
    try {
      await apiClient.renameProject(proj.projectId, renamingName.trim());
      setRenamingProjectId(null);
      await fetchRecentProjects();
    } catch {}
  };

  const filteredProjects = recentProjects.filter((proj) => {
    if (projectsTab === 'active' && proj.isArchived) return false;
    if (projectsTab === 'archived' && !proj.isArchived) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        proj.name.toLowerCase().includes(q) ||
        proj.projectId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleApplyTemplate = (tmpl: ProjectTemplate) => {
    setProjectName(tmpl.defaultProjectName);
    setIdeaInput(tmpl.ideaPrompt);
    if (tmpl.targetUser) setTargetUser(tmpl.targetUser);
    if (tmpl.coreProblem) setCoreProblem(tmpl.coreProblem);
    if (tmpl.mvpResult) setMvpResult(tmpl.mvpResult);
    if (tmpl.knownConstraints) setKnownConstraints(tmpl.knownConstraints);
  };

  const handleFileProcess = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isImage = file.type.startsWith('image/');
      const isText =
        file.type.startsWith('text/') ||
        /\.(md|txt|json|yaml|yml|ts|tsx|js|jsx|html|css|py|rs|go)$/i.test(file.name);

      const reader = new FileReader();
      if (isImage) {
        reader.onload = (e) => {
          const base64 = (e.target?.result as string) || '';
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              filename: file.name,
              kind: 'image',
              content: base64,
              contentEncoding: 'base64',
              size: file.size,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (e) => {
          const text = (e.target?.result as string) || '';
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              filename: file.name,
              kind: isText ? 'text' : 'file',
              content: text,
              contentEncoding: 'utf8',
              size: file.size,
            },
          ]);
        };
        reader.readAsText(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileProcess(e.dataTransfer.files);
  };

  const handleRemoveFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (entryMode === 'structured') {
      if (!targetUser.trim() || !coreProblem.trim() || !mvpResult.trim()) return;
      setIsSubmitting(true);

      const intent: InitialProjectIntent = {
        targetUser: targetUser.trim(),
        coreProblem: coreProblem.trim(),
        desiredOutcome: mvpResult.trim(),
        constraints: knownConstraints.trim() || undefined,
      };

      const finalName =
        projectName.trim() ||
        (mvpResult.trim() ? mvpResult.trim().slice(0, 20) : null) ||
        (targetUser.trim() ? `${targetUser.trim().slice(0, 12)}工具` : null) ||
        '新架构项目';

      try {
        localStorage.removeItem(HOME_DRAFT_KEY);
      } catch {}

      onCreateProject(
        finalName,
        undefined,
        intent,
        attachedFiles.map((f) => ({
          filename: f.filename,
          kind: f.kind,
          content: f.content,
          contentEncoding: f.contentEncoding,
        }))
      );
    } else {
      const finalIdea = ideaInput.trim();
      if (!finalIdea) return;
      setIsSubmitting(true);

      const finalName = projectName.trim() || finalIdea.slice(0, 24);

      try {
        localStorage.removeItem(HOME_DRAFT_KEY);
      } catch {}

      onCreateProject(
        finalName,
        finalIdea,
        undefined,
        attachedFiles.map((f) => ({
          filename: f.filename,
          kind: f.kind,
          content: f.content,
          contentEncoding: f.contentEncoding,
        }))
      );
    }
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsHealthModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
            title="查看本地 AI 引擎状态与隐私说明"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>本地引擎就绪</span>
          </button>
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
          className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-md space-y-5"
        >
          {/* Mode Switcher Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEntryMode('structured')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  entryMode === 'structured'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>四项意图引导 (推荐)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('freeform')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  entryMode === 'freeform'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>自由长文本输入</span>
              </button>
            </div>

            {/* Optional Project Name */}
            <div className="w-48 sm:w-60">
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="项目名称 (可选)"
                className="w-full px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
              />
            </div>
          </div>

          {/* Draft Recovery Notification Banner */}
          {draftRestoredAt && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-900/60 flex items-center justify-between text-xs text-orange-800 dark:text-orange-300 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span>已自动恢复上次编辑的构思草稿（恢复自本地存储 · {draftRestoredAt}）</span>
              </div>
              <button
                type="button"
                onClick={clearHomeDraft}
                className="text-[11px] font-semibold underline hover:text-orange-950 dark:hover:text-orange-100 cursor-pointer min-touch-target flex items-center"
              >
                清空草稿
              </button>
            </div>
          )}

          {/* Form Body based on Entry Mode */}
          {entryMode === 'structured' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Field 1: Target User */}
              <div className="space-y-1.5 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60">
                <label
                  htmlFor="create-target-user"
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                  <span>1. 想帮助谁？(目标用户)</span>
                </label>
                <input
                  id="create-target-user"
                  type="text"
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  aria-describedby="desc-target-user"
                  placeholder="例如：独立开发者、需要整理大量录音的播客主..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p id="desc-target-user" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  明确产品的直接使用者或核心受益角色
                </p>
              </div>

              {/* Field 2: Core Problem */}
              <div className="space-y-1.5 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60">
                <label
                  htmlFor="create-core-problem"
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-red-500" />
                  <span>2. 遇到什么核心问题？(场景与痛点)</span>
                </label>
                <input
                  id="create-core-problem"
                  type="text"
                  value={coreProblem}
                  onChange={(e) => setCoreProblem(e.target.value)}
                  aria-describedby="desc-core-problem"
                  placeholder="例如：现有工具必须联网且极易搞丢 ID3 封面与标签..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p id="desc-core-problem" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  用户目前面临的最大阻碍或低效环节
                </p>
              </div>

              {/* Field 3: MVP Expected Result */}
              <div className="space-y-1.5 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60">
                <label
                  htmlFor="create-mvp-result"
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>3. 希望最后交付什么结果？(期望产出)</span>
                </label>
                <input
                  id="create-mvp-result"
                  type="text"
                  value={mvpResult}
                  onChange={(e) => setMvpResult(e.target.value)}
                  aria-describedby="desc-mvp-result"
                  placeholder="例如：一个 Windows 本地运行的秒级批量音频标签编辑器..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p id="desc-mvp-result" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  MVP 第一阶段交付的可工作软件形态
                </p>
              </div>

              {/* Field 4: Known Constraints */}
              <div className="space-y-1.5 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60">
                <label
                  htmlFor="create-known-constraints"
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  <span>4. 已知有哪些明确限制？(约束条件)</span>
                </label>
                <input
                  id="create-known-constraints"
                  type="text"
                  value={knownConstraints}
                  onChange={(e) => setKnownConstraints(e.target.value)}
                  aria-describedby="desc-known-constraints"
                  placeholder="例如：完全离线、不引入数据库、单机文件保存..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p id="desc-known-constraints" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  技术架构红线（如零数据库、无账号系统等）
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="idea-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                项目构思与核心想法
              </label>
              <textarea
                id="idea-input"
                rows={5}
                value={ideaInput}
                onChange={(e) => setIdeaInput(e.target.value)}
                placeholder="描述你想做的产品，例如：一款运行在 Windows 本地的离线音频标签管理工具，支持 FLAC 批量清洗元数据..."
                className="w-full p-3.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 leading-relaxed resize-none"
              />
            </div>
          )}

          {/* Collapsible Inspiration Templates Drawer */}
          <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>典型场景与灵感模板 (可选参考)</span>
              </div>
              {isTemplatesExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {isTemplatesExpanded && (
              <div className="p-3 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-2 flex-wrap">
                {PROJECT_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/60 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-orange-500" />
                    <span>{tmpl.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Attached Materials Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`p-3 rounded-xl border border-dashed transition-all ${
              isDragging
                ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 ring-2 ring-orange-500/20'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium">挂载参考材料或架构图 (可选)</span>
                <span className="text-[10px] text-zinc-400">(支持 .md, .txt, .json, 代码文件，图片拖拽)</span>
              </div>
              <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer">
                <UploadCloud className="w-3 h-3" />
                <span>选择文件</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFileProcess(e.target.files)}
                />
              </label>
            </div>

            {attachedFiles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-2 mt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.8 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[11px]"
                  >
                    {file.kind === 'image' ? (
                      <ImageIcon className="w-3 h-3 text-blue-500" />
                    ) : (
                      <FileText className="w-3 h-3 text-emerald-500" />
                    )}
                    <span className="max-w-[140px] truncate">{file.filename}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(file.id)}
                      className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              单次结构化推演 · 本地两阶段状态保护 · 项目文件保存在本地；AI 推理可能向配置的 Provider 发送选定上下文
            </div>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (entryMode === 'structured'
                  ? !targetUser.trim() && !coreProblem.trim() && !mvpResult.trim()
                  : !ideaInput.trim())
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow transition-colors cursor-pointer"
            >
              <span>{isSubmitting ? '正在初始化...' : '开始推演构思'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>


        {/* Recent Projects Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>项目管理</span>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setProjectsTab('active')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                    projectsTab === 'active'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  活跃 ({recentProjects.filter((p) => !p.isArchived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectsTab('archived')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                    projectsTab === 'archived'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  归档 ({recentProjects.filter((p) => p.isArchived).length})
                </button>
              </div>
            </div>

            {/* Search Input & Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索项目名称或 ID..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>

              {!isLoadingProjects && !projectsError && (
                <button
                  onClick={fetchRecentProjects}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="刷新项目列表"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
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
              title="暂无项目"
              description="在上方输入构思想法并提交，系统将为您在本地工作区创建独立项目。"
              className="py-8"
            />
          ) : filteredProjects.length === 0 ? (
            /* Filter Empty State */
            <div className="p-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              没有找到匹配 &quot;{searchQuery}&quot; 的项目
            </div>
          ) : (
            /* Enhanced Recent Projects List */
            <div className="space-y-2">
              {filteredProjects.map((proj) => {
                const isRenaming = renamingProjectId === proj.projectId;

                return (
                  <div
                    key={proj.projectId}
                    onClick={() => onOpenProject(proj.projectId)}
                    className="group p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 hover:border-orange-500/50 dark:hover:border-orange-500/50 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                        {proj.isPinned ? (
                          <Pin className="w-4 h-4 text-orange-500 fill-orange-500" />
                        ) : (
                          <Folder className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renamingName}
                              onChange={(e) => setRenamingName(e.target.value)}
                              autoFocus
                              className="px-2 py-0.5 rounded text-xs bg-zinc-50 dark:bg-zinc-900 border border-orange-500 focus:outline-none text-zinc-900 dark:text-zinc-100"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleConfirmRename(e, proj)}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 cursor-pointer"
                              title="确认修改"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingProjectId(null);
                              }}
                              className="p-1 rounded text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                              title="取消"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {proj.name}
                            </span>
                            <StageBadge stage={proj.stage as ProjectStage} size="sm" />
                            {proj.isArchived && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                已归档
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                          {proj.projectId} · 更新于 {new Date(proj.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div
                      className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(e, proj)}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          proj.isPinned
                            ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        title={proj.isPinned ? '取消置顶' : '置顶项目'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${proj.isPinned ? 'fill-orange-500' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleStartRename(e, proj)}
                        className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="重命名项目"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(e, proj)}
                        className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="复制项目副本 (Fork)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenFolder(e, proj)}
                        className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="在本地资源管理器中打开项目目录"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggleArchive(e, proj)}
                        className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={proj.isArchived ? '取消归档' : '归档项目'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, proj)}
                        className="p-1.5 rounded-lg text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="删除项目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

                      <button
                        type="button"
                        onClick={() => onOpenProject(proj.projectId)}
                        className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-orange-600 transition-colors cursor-pointer"
                        title="进入构思工作台"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Provider Health Modal */}
      <ProviderHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Footer */}
      <footer className="h-12 border-t border-zinc-200/80 dark:border-zinc-800/80 px-6 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-600">
        <div>Project Architect V1 · Local-First AI Workbench</div>
        <div className="flex items-center gap-4">
          <span>单次推理闭环</span>
          <span>本地存储 · 选定上下文推理</span>
        </div>
      </footer>
    </div>
  );
};
