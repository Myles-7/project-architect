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
  Download,
  FolderSearch,
  ShieldCheck,
  MoreHorizontal,
} from 'lucide-react';
import { useProjectSession } from '../state/ProjectSessionContext.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { CardSkeleton } from '../components/common/LoadingSkeleton.js';
import { Modal } from '../components/common/Modal.js';
import { ProviderHealthModal } from '../features/home/ProviderHealthModal.js';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '../features/home/ProjectTemplates.js';
import type {
  RecentProjectItem,
  InitialProjectIntent,
  ProjectPreset,
  BrownfieldCandidateDecision,
  CodebaseAnalysisResult,
} from '@project-architect/contracts';
import { ApiClientError } from '../api/client.js';
import { useToast } from '../components/common/Toast.js';
import { ConfirmDialog } from '../components/common/ConfirmDialog.js';
import { DirectoryBrowserModal } from '../components/common/DirectoryBrowserModal.js';

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
    attachedFiles?: { filename: string; kind: 'text' | 'image' | 'file'; content: string; contentEncoding?: 'utf8' | 'base64' }[],
    presetId?: string,
    brownfieldCandidates?: BrownfieldCandidateDecision[]
  ) => void | Promise<void>;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenProject, onCreateProject }) => {
  const { apiClient } = useProjectSession();
  const { success: toastSuccess, error: toastError } = useToast();
  const [entryMode, setEntryMode] = useState<'structured' | 'freeform'>('freeform');
  const [targetUser, setTargetUser] = useState('');
  const [coreProblem, setCoreProblem] = useState('');
  const [mvpResult, setMvpResult] = useState('');
  const [knownConstraints, setKnownConstraints] = useState('');
  // Unified Presets & Inspiration Center state
  const [centerTab, setCenterTab] = useState<'presets' | 'templates'>('presets');
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isPresetsExpanded, setIsPresetsExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient.getPresets()
      .then((data) => {
        if (active) setPresets(data);
      })
      .catch((err) => console.warn('Failed to load presets:', err));
    return () => { active = false; };
  }, [apiClient]);

  const [ideaInput, setIdeaInput] = useState('');
  const [projectName, setProjectName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readingFiles, setReadingFiles] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<AttachedMaterial[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Brownfield Ingestion State
  const [brownfieldAnalysis, setBrownfieldAnalysis] = useState<CodebaseAnalysisResult | null>(null);
  const [isScanningBrownfield, setIsScanningBrownfield] = useState(false);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<Set<string>>(new Set());
  const [isCandidateReviewOpen, setIsCandidateReviewOpen] = useState(false);

  // Directory Browser & Project Deletion Modals
  const [isDirectoryBrowserOpen, setIsDirectoryBrowserOpen] = useState(false);
  const [browserMode, setBrowserMode] = useState<'brownfield'>('brownfield');
  const [projectToDelete, setProjectToDelete] = useState<RecentProjectItem | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const handleSelectBrownfieldFolder = async (folderPath: string) => {
    setIsScanningBrownfield(true);
    try {
      const result = await apiClient.scanBrownfieldStateless(folderPath);
      setBrownfieldAnalysis(result);
      const allKeys = new Set(result.candidateDecisions.map((d) => d.decisionKey));
      setSelectedCandidateKeys(allKeys);
      setIsCandidateReviewOpen(true);
      setEntryMode('freeform');
      if (result.detectedProjectName) {
        setProjectName(result.detectedProjectName);
      }
      setIdeaInput(
        `已有代码库基础扫描：${result.detectedProjectName || '目标工程'}。\n主力开发语言：${result.primaryLanguage}。\n技术依赖：${result.technologies.map((t) => t.name).join('、')}。\n已提取 ${result.candidateDecisions.length} 条架构候选建议，待建立规范蓝图。`
      );
      toastSuccess(
        `已读取代码库基础信息。检测到 ${result.technologies.length} 项技术依赖与 ${result.candidateDecisions.length} 条候选决策。`,
        '基础扫描完成'
      );
    } catch (err: any) {
      toastError(err.message || '扫描代码库失败，请检查路径权限与目录结构', '扫描失败');
    } finally {
      setIsScanningBrownfield(false);
    }
  };

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
  const [projectsTab, setProjectsTab] = useState<'active' | 'archived' | 'trash'>('active');
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [providerHealth, setProviderHealth] = useState<import('@project-architect/contracts').ProviderHealthResponse | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  useEffect(() => {
    apiClient.getProviderHealth()
      .then((data) => setProviderHealth(data))
      .catch(() => {});
  }, [apiClient]);

  const fetchRecentProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const list = await apiClient.listRecentProjects(undefined, true);
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
      toastSuccess('已在本地资源管理器中打开项目目录');
    } catch {
      try {
        await navigator.clipboard.writeText(proj.projectPath);
        toastSuccess('已复制项目真实物理路径至剪贴板', proj.projectPath);
      } catch {
        toastError('无法打开或复制路径');
      }
    }
  };

  const handleDelete = (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    setProjectToDelete(proj);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeletingProject(true);
    try {
      await apiClient.deleteProject(projectToDelete.projectId);
      toastSuccess(`项目 "${projectToDelete.name}" 已移入回收站`);
      setProjectToDelete(null);
      await fetchRecentProjects();
    } catch (err: any) {
      toastError(err.message || '删除项目失败');
    } finally {
      setIsDeletingProject(false);
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

  const handleExportProject = async (e: React.MouseEvent, proj: RecentProjectItem) => {
    e.stopPropagation();
    try {
      const blob = await apiClient.exportProject(proj.projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proj.name || proj.projectId}-${proj.projectId}.pa.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastSuccess(`项目 "${proj.name}" 导出成功！`);
    } catch (err: any) {
      toastError(err.message || '导出项目失败');
    }
  };

  const handleImportProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(',')[1] || result;
      try {
        const res = await apiClient.importProject(base64);
        if (res.renamed) {
          toastSuccess(`检测到已有同名工程，已作为副本导入为「${res.project.name}」`, '导入成功 (副本)');
        } else {
          toastSuccess(`项目 "${res.project.name}" 导入成功！`);
        }
        await fetchRecentProjects();
      } catch (err: any) {
        toastError(err.message || '导入项目失败');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredProjects = recentProjects.filter((proj) => {
    if (projectsTab === 'trash' ? !proj.trashedAt : Boolean(proj.trashedAt)) return false;
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
    toastSuccess(`已应用灵感模版「${tmpl.name}」，相关构思与约束已填入`, '灵感已填入');
  };

  const handleFileProcess = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setReadingFiles(count => count + 1);

    const TEXT_EXTS = new Set([
      '.txt', '.md', '.json', '.yaml', '.yml',
      '.ts', '.tsx', '.js', '.jsx', '.html', '.css',
      '.py', '.rs', '.go', '.sql', '.toml', '.sh',
      '.bash', '.env', '.xml', '.csv', '.proto', '.graphql',
    ]);

    try { for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      // 1. Max size check (20MB)
      if (file.size > 20 * 1024 * 1024) {
        toastError(`文件 "${file.name}" 大小超过 20MB 上限，已自动拦截`, '文件过大');
        continue;
      }

      const extMatch = file.name.match(/\.[a-zA-Z0-9]+$/);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      const isText = !isImage && (file.type.startsWith('text/') || TEXT_EXTS.has(ext));

      const reader = new FileReader();
      try {
        const result = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`读取 ${file.name} 失败，请重新选择文件`));
          if (isText) reader.readAsText(file);
          else reader.readAsDataURL(file);
        });
        const content = isText ? result : result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
        setAttachedFiles(previous => [...previous, { id: crypto.randomUUID(), filename: file.name, kind: isImage ? 'image' : isText ? 'text' : 'file', content, contentEncoding: isText ? 'utf8' : 'base64', size: file.size }]);
      } catch (failure) { toastError(failure instanceof Error ? failure.message : `读取 ${file.name} 失败`, '材料未添加'); }
    } } finally { setReadingFiles(count => count - 1); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileProcess(e.dataTransfer.files);
  };

  const handleRemoveFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || readingFiles > 0) return;

    const selectedBrownfieldCandidates = brownfieldAnalysis
      ? brownfieldAnalysis.candidateDecisions.filter((d) => selectedCandidateKeys.has(d.decisionKey))
      : undefined;

    if (entryMode === 'structured') {
      if (!targetUser.trim() || !coreProblem.trim() || !mvpResult.trim()) return;
      setIsSubmitting(true);

      const intent: InitialProjectIntent = {
        targetUser,
        coreProblem,
        desiredOutcome: mvpResult,
        constraints: knownConstraints.trim() ? knownConstraints : undefined,
      };

      const finalName =
        projectName.trim() ||
        (mvpResult.trim() ? mvpResult.trim().slice(0, 20) : null) ||
        (targetUser.trim() ? `${targetUser.trim().slice(0, 12)}工具` : null) ||
        '新架构项目';

      try {
        localStorage.removeItem(HOME_DRAFT_KEY);
      } catch {}

      await onCreateProject(
        finalName,
        undefined,
        intent,
        attachedFiles.map((f) => ({
          filename: f.filename,
          kind: f.kind,
          content: f.content,
          contentEncoding: f.contentEncoding,
        })),
        selectedPresetId || undefined,
        selectedBrownfieldCandidates
      );
    } else {
      const finalIdea = ideaInput;
      if (!finalIdea.trim() && !attachedFiles.length) return;
      setIsSubmitting(true);

      const finalName = projectName.trim() || finalIdea.trim().slice(0, 24) || attachedFiles[0]?.filename || '新项目';

      try {
        localStorage.removeItem(HOME_DRAFT_KEY);
      } catch {}

      await onCreateProject(
        finalName,
        finalIdea,
        undefined,
        attachedFiles.map((f) => ({
          filename: f.filename,
          kind: f.kind,
          content: f.content,
          contentEncoding: f.contentEncoding,
        })),
        selectedPresetId || undefined,
        selectedBrownfieldCandidates
      );
    }
    setIsSubmitting(false);
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              providerHealth?.status === 'ready'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                : providerHealth?.status === 'degraded'
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
            title="查看本地 AI 引擎状态与隐私说明"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                providerHealth?.status === 'ready'
                  ? 'bg-emerald-500 animate-pulse'
                  : providerHealth?.status === 'degraded'
                  ? 'bg-amber-500'
                  : 'bg-zinc-400'
              }`}
            />
            <span>
              {providerHealth?.status === 'ready'
                ? providerHealth.providerName.includes('Antigravity')
                  ? 'Google Antigravity (agy) · 就绪'
                  : '本地引擎就绪'
                : providerHealth?.status === 'degraded'
                ? '引擎降级'
                : '探测本地引擎...'}
            </span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="project-home-content flex-1 max-w-4xl w-full mx-auto px-6 py-10 flex flex-col gap-6">
        {/* Hero Section */}
        <div className="project-home-hero text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>一个人的构思，也值得完整的方案</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            把想法，变成可开发的方案
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            你决定关键取舍，AI 完成设计、查证和整理。逐阶段审阅，交付给 Coding Agent 开发。
          </p>
        </div>

        {/* Idea Input Card */}
        <form
          onSubmit={handleSubmit}
          className="project-idea-form p-5 sm:p-6 rounded-2xl bg-surface-card border border-border-subtle shadow-elevation-card space-y-5"
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
                <span>分项描述</span>
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
                <span>自由描述</span>
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

          {/* Brownfield Ingestion Scanning Indicator & Status Banner */}
          {isScanningBrownfield && (
            <div className="p-3 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 flex items-center gap-2.5 text-xs text-orange-800 dark:text-orange-200 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
              <span>正在读取代码库技术栈、包依赖清单与目录结构...</span>
            </div>
          )}

          {brownfieldAnalysis && !isScanningBrownfield && (
            <div className="p-3.5 rounded-xl border border-orange-300 dark:border-orange-800/80 bg-orange-50/70 dark:bg-orange-950/30 flex items-start justify-between gap-3 text-xs shadow-2xs">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <FolderSearch className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <span className="font-bold text-orange-950 dark:text-orange-100">
                    代码库线索已读取 ({brownfieldAnalysis.detectedProjectName || '未命名'})
                  </span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-orange-200/60 dark:bg-orange-900/80 text-orange-800 dark:text-orange-200 font-bold">
                    {brownfieldAnalysis.primaryLanguage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCandidateReviewOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs ml-auto sm:ml-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>审查决策候选 ({selectedCandidateKeys.size}/{brownfieldAnalysis.candidateDecisions.length})</span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {brownfieldAnalysis.technologies.map((tech) => (
                    <span
                      key={tech.name}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-orange-200/80 dark:border-orange-800/60"
                    >
                      {tech.name} {tech.version ? `v${tech.version}` : ''}
                    </span>
                  ))}
                  <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                    · 仅勾选的 {selectedCandidateKeys.size} 项候选决策将录入新工程 (恪守用户授权第一铁律)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBrownfieldAnalysis(null);
                  setSelectedCandidateKeys(new Set());
                  setIsCandidateReviewOpen(false);
                }}
                className="p-1 rounded-md text-orange-400 hover:text-orange-700 dark:hover:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/60 cursor-pointer"
                title="清除代码库扫描线索"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Unified Presets & Inspiration Center */}
          <div className={`project-optional-start ${isPresetsExpanded ? 'is-expanded' : ''} rounded-xl border border-border-subtle bg-surface-subtle p-3 space-y-3`}>
            {/* Header with Title, Segment Switch & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsPresetsExpanded((prev) => !prev)}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>需要一个起点？</span>
                  {isPresetsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Segment Switch */}
                <div className={`project-start-tabs ${isPresetsExpanded ? 'flex' : 'hidden'} items-center gap-1 p-0.5 bg-zinc-200/70 dark:bg-zinc-800/80 rounded-lg text-[11px] shrink-0`}>
                  <button
                    type="button"
                    onClick={() => {
                      setCenterTab('presets');
                      setIsPresetsExpanded(true);
                    }}
                    className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      centerTab === 'presets'
                        ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    架构参考 ({presets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCenterTab('templates');
                      setIsPresetsExpanded(true);
                    }}
                    className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      centerTab === 'templates'
                        ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 font-bold shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    想法示例 ({PROJECT_TEMPLATES.length})
                  </button>
                </div>
              </div>

              {/* Action / Contextual hint in Header */}
              <div className="flex items-center gap-2 text-[11px]">
                {selectedPresetId && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800">
                    <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                      已选用预设{centerTab === 'templates' ? `: ${presets.find((p) => p.id === selectedPresetId)?.name.split(' (')[0] || selectedPresetId}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPresetId(null)}
                      className="text-zinc-500 hover:text-red-500 dark:hover:text-red-400 underline cursor-pointer"
                    >
                      取消选用
                    </button>
                  </div>
                )}
                {centerTab === 'presets' && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                    可选参考，具体设计交给 AI
                  </span>
                )}
                {centerTab === 'templates' && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                    点击卡片一键填入构思与关键约束
                  </span>
                )}
              </div>
            </div>

            {/* Cards Grid */}
            {isPresetsExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {centerTab === 'presets' ? (
                  presets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPresetId(null);
                          } else {
                            setSelectedPresetId(preset.id);
                            if (!projectName) {
                              setProjectName(preset.name.split(' (')[0]);
                            }
                          }
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer select-none text-left space-y-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-indigo-700 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {preset.category}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <h4
                          className={`text-xs font-bold leading-snug ${
                            isSelected ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {preset.name}
                        </h4>
                        <p
                          className={`text-[11px] line-clamp-2 leading-relaxed ${
                            isSelected ? 'text-indigo-100' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {preset.description}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {preset.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                                isSelected
                                  ? 'bg-indigo-700/60 text-white'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  PROJECT_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="p-3 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-2xs transition cursor-pointer select-none text-left space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-900/40">
                          {tmpl.badge}
                        </span>
                        <span className="text-xs text-orange-600 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                          一键填入 →
                        </span>
                      </div>
                      <h4 className="text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {tmpl.name}
                      </h4>
                      <p className="text-[11px] line-clamp-2 leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {tmpl.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                        <span className="font-mono">{tmpl.defaultProjectName}</span>
                        <span className="text-orange-500 font-semibold group-hover:underline">点击应用模板</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
                  描述这个项目最终需要交付的软件形态与结果
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
                  placeholder="例如：需要兼容哪些设备、外部接口、现有数据格式或交付日期…"
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <p id="desc-known-constraints" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  只填写这个项目已有的限制，其余可以在澄清时决定
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
                <span className="text-xs text-zinc-400">(支持 .md, .txt, .json, 代码文件，图片拖拽)</span>
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
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[11px]"
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
              分阶段规划与审批 · 项目文件保存在本地；AI 推理可能向配置的 Provider 发送选定上下文
              {entryMode === 'structured' && (!targetUser.trim() || !coreProblem.trim() || !mvpResult.trim()) && (
                <span className="text-amber-600 dark:text-amber-400 ml-2 font-medium">
                  (请填写目标用户、核心问题与期望交付成果)
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={
                isSubmitting || readingFiles > 0 ||
                (entryMode === 'structured'
                  ? !targetUser.trim() || !coreProblem.trim() || !mvpResult.trim()
                  : !ideaInput.trim() && attachedFiles.length === 0)
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow transition-colors cursor-pointer"
            >
              <span>{readingFiles > 0 ? '正在读取材料...' : isSubmitting ? '正在初始化...' : '开始澄清构思'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>


        {/* Recent Projects Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>项目管理</span>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setProjectsTab('active')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-w-[68px] justify-center text-center ${
                    projectsTab === 'active'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  活跃 ({recentProjects.filter((p) => !p.trashedAt && !p.isArchived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectsTab('archived')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-w-[68px] justify-center text-center ${
                    projectsTab === 'archived'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  归档 ({recentProjects.filter((p) => !p.trashedAt && p.isArchived).length})
                </button>
                <button type="button" onClick={() => setProjectsTab('trash')} aria-pressed={projectsTab === 'trash'} className={`px-2.5 py-0.5 rounded-md font-medium ${projectsTab === 'trash' ? 'bg-surface-card text-text-primary' : 'text-text-muted'}`}>回收站 ({recentProjects.filter(p => p.trashedAt).length})</button>
              </div>

              <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0">
                <UploadCloud className="w-3 h-3 text-orange-500" />
                <span>导入项目包 (.pa.zip)</span>
                <input
                  type="file"
                  accept=".zip,.pa.zip"
                  className="hidden"
                  onChange={handleImportProjectFile}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setBrowserMode('brownfield');
                  setIsDirectoryBrowserOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-800 transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                title="读取代码库基础信息，生成待审阅线索；不代表完整理解业务或实现"
              >
                <FolderSearch className="w-3 h-3 text-orange-500" />
                <span>读取代码库线索</span>
              </button>

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
              {searchQuery ? `没有找到匹配「${searchQuery}」的项目` : projectsTab === 'trash' ? '回收站为空' : projectsTab === 'archived' ? '还没有归档项目' : '还没有活跃项目'}
            </div>
          ) : (
            /* Enhanced Recent Projects List */
            <div className="space-y-2">
              {filteredProjects.map((proj) => {
                const isRenaming = renamingProjectId === proj.projectId;
                if (proj.trashedAt) return <article key={proj.projectId} className="project-trash-row p-4 rounded-xl border border-border-subtle bg-surface-card flex items-center justify-between gap-4"><div className="min-w-0"><h3 className="font-medium truncate">{proj.name}</h3><p className="text-xs text-text-muted">移入回收站 {new Date(proj.trashedAt).toLocaleString()}</p></div><button type="button" className="planning-button" disabled={restoringProjectId !== null} onClick={async () => { setRestoringProjectId(proj.projectId); try { await apiClient.restoreProject(proj.projectId); toastSuccess(`已还原「${proj.name}」`); await fetchRecentProjects(); } catch (failure) { toastError(failure instanceof Error ? failure.message : '还原失败'); } finally { setRestoringProjectId(null); } }}>{restoringProjectId === proj.projectId ? '正在还原…' : '还原项目'}</button></article>;

                return (
                  <div
                    key={proj.projectId}
                    onClick={() => onOpenProject(proj.projectId)}
                    className="group p-3 sm:p-3.5 rounded-xl bg-surface-card border border-border-subtle hover:border-orange-500/50 dark:hover:border-orange-500/50 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
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
                            {proj.isArchived && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                已归档
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                          {proj.projectId} · 更新于 {new Date(proj.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={event => event.stopPropagation()}>
                      <details className="project-actions-popover" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
                        <summary aria-label={`项目操作：${proj.name}`} title="项目操作"><MoreHorizontal className="w-4 h-4" /></summary>
                        <div className="project-actions-panel" role="group" aria-label="项目管理操作">
                          <button type="button" onClick={event => handleTogglePin(event, proj)}><Pin className="w-3.5 h-3.5" />{proj.isPinned ? '取消置顶' : '置顶项目'}</button>
                          <button type="button" onClick={event => handleStartRename(event, proj)}><Edit2 className="w-3.5 h-3.5" />重命名项目</button>
                          <button type="button" onClick={event => handleDuplicate(event, proj)}><Copy className="w-3.5 h-3.5" />复制项目副本</button>
                          <button type="button" onClick={event => handleOpenFolder(event, proj)}><ExternalLink className="w-3.5 h-3.5" />打开项目目录</button>
                          <button type="button" onClick={event => void handleExportProject(event, proj)}><Download className="w-3.5 h-3.5" />导出项目包 (.pa.zip)</button>
                          <button type="button" onClick={event => handleToggleArchive(event, proj)}><Archive className="w-3.5 h-3.5" />{proj.isArchived ? '取消归档' : '归档项目'}</button>
                          <button type="button" className="is-danger" aria-label="删除项目" onClick={event => handleDelete(event, proj)}><Trash2 className="w-3.5 h-3.5" />移入回收站</button>
                        </div>
                      </details>
                      <button type="button" className="project-open-button" onClick={() => onOpenProject(proj.projectId)}>打开<ChevronRight className="w-3.5 h-3.5" /></button>
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

      {/* Brownfield Candidate Decisions Review Modal (P0-8: User Authority First) */}
      {brownfieldAnalysis && (
        <Modal
          isOpen={isCandidateReviewOpen}
          onClose={() => setIsCandidateReviewOpen(false)}
          title="审查与勾选存量代码候选决策 (用户授权第一)"
          maxWidth="xl"
          closeLabel="关闭代码扫描审查弹窗"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                已勾选 {selectedCandidateKeys.size} / {brownfieldAnalysis.candidateDecisions.length} 项候选决策录入新工程
              </span>
              <button
                type="button"
                onClick={() => setIsCandidateReviewOpen(false)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>完成审查并保存选择 ({selectedCandidateKeys.size})</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4 select-text">
            <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 text-xs text-orange-900 dark:text-orange-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                <span>宪法准则：用户授权第一与状态保护</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                基础扫描生成的技术线索仅作为架构建议。未勾选的候选将被安全丢弃，绝不越权灌入新工程决策库。
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                候选架构决策列表 ({brownfieldAnalysis.candidateDecisions.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedCandidateKeys.size === brownfieldAnalysis.candidateDecisions.length) {
                    setSelectedCandidateKeys(new Set());
                  } else {
                    setSelectedCandidateKeys(new Set(brownfieldAnalysis.candidateDecisions.map((d) => d.decisionKey)));
                  }
                }}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline cursor-pointer font-medium"
              >
                {selectedCandidateKeys.size === brownfieldAnalysis.candidateDecisions.length ? '全部取消' : '全选所有候选'}
              </button>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {brownfieldAnalysis.candidateDecisions.map((cand) => {
                const isChecked = selectedCandidateKeys.has(cand.decisionKey);
                return (
                  <div
                    key={cand.decisionKey}
                    onClick={() => {
                      setSelectedCandidateKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(cand.decisionKey)) next.delete(cand.decisionKey);
                        else next.add(cand.decisionKey);
                        return next;
                      });
                    }}
                    className={`p-3 rounded-xl border text-xs transition-all cursor-pointer select-none space-y-1.5 ${
                      isChecked
                        ? 'border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-orange-600 border-orange-600 text-white'
                              : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{cand.title}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          {cand.areaId}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          cand.confidence === 'high'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : cand.confidence === 'medium'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {cand.confidence === 'high' ? '高置信度' : cand.confidence === 'medium' ? '中置信度' : '低置信度'}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pl-6">
                      {cand.summary || cand.details}
                    </p>

                    {cand.evidence && cand.evidence.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pl-6 pt-0.5">
                        {cand.evidence.map((ev, evIdx) => (
                          <span
                            key={evIdx}
                            className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* Directory Browser Modal */}
      <DirectoryBrowserModal
        isOpen={isDirectoryBrowserOpen}
        onClose={() => setIsDirectoryBrowserOpen(false)}
        initialPath=""
        title={
          browserMode === 'brownfield'
            ? '选择要读取基础信息的代码库根目录'
            : '浏览本地目录'
        }
        onSelect={(selectedPath) => {
          setIsDirectoryBrowserOpen(false);
          if (browserMode === 'brownfield') {
            void handleSelectBrownfieldFolder(selectedPath);
          } else {
            toastSuccess('已选择本地目录', selectedPath);
          }
        }}
      />

      {/* Delete Project Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(projectToDelete)}
        title="移入回收站"
        message={`将项目 "${projectToDelete?.name || ''}" 移入回收站？项目目录与历史将保留，可从回收站还原。`}
        confirmText="移入回收站"
        cancelText="取消"
        isDestructive={true}
        isLoading={isDeletingProject}
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />

      {/* Footer */}
      <footer className="h-12 border-t border-zinc-200/80 dark:border-zinc-800/80 px-6 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-400">
        <div>Project Architect V1 · Local-First AI Workbench</div>
        <div className="flex items-center gap-4">
          <span>澄清 · 设计 · 审阅 · 批准</span>
          <span>本地存储 · 选定上下文推理</span>
        </div>
      </footer>
    </div>
  );
};
