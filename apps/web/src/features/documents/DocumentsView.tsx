import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  BookOpen,
  Code,
  Eye,
  ShieldAlert,
  Compass,
  Download,
  Terminal,
  Edit3,
  Save,
  FolderOutput,
  FileEdit,
  Globe,
  X,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { CardSkeleton } from '../../components/common/LoadingSkeleton.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import { downloadZip, type ZipFileEntry } from './exportZip.js';
import { AgentPromptModal } from './AgentPromptModal.js';
import { DocumentDiffModal } from './DocumentDiffModal.js';
import { SpecDriftModal } from '../audit/SpecDriftModal.js';
import type {
  DocumentListView as DocumentListViewModel,
  DocumentItemView,
  DocumentDiffItem,
} from '@project-architect/contracts';

export const DocumentsView: React.FC = () => {
  const { state, apiClient, refreshSnapshot, setActiveTab } = useProjectSession();
  const { snapshot, activeProjectId, stateRevision } = state;
  const { success, error } = useToast();

  const [documentList, setDocumentList] = useState<DocumentListViewModel | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [detectedDiffs, setDetectedDiffs] = useState<DocumentDiffItem[]>([]);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const [isDriftModalOpen, setIsDriftModalOpen] = useState(false);


  // Document Reader State
  const [selectedDocPath, setSelectedDocPath] = useState<string>('AGENTS.md');
  const [docContent, setDocContent] = useState<string>('');
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw' | 'edit'>('rendered');
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [copied, setCopied] = useState(false);

  // Export to directory state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDirectory, setExportDirectory] = useState('');
  const [isExportingFolder, setIsExportingFolder] = useState(false);

  // Custom Rules / Redlines Injection
  const [showCustomRulesInput, setShowCustomRulesInput] = useState(false);
  const [customRulesText, setCustomRulesText] = useState('');
  const [customNotesText, setCustomNotesText] = useState('');

  const fetchDocumentList = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const data = await apiClient.getProjectDocuments(activeProjectId);
      setDocumentList(data);
      if (data.items.length > 0 && !data.items.some((d) => d.path === selectedDocPath)) {
        setSelectedDocPath(data.items[0].path);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch documents view:', err);
    }
  }, [activeProjectId, apiClient, selectedDocPath]);

  const loadDocumentContent = useCallback(
    async (docPath: string) => {
      if (!activeProjectId || !docPath) return;
      setIsLoadingDoc(true);
      setDocError(null);
      try {
        const res = await apiClient.readDocument(activeProjectId, {
          projectId: activeProjectId,
          docPath,
        });
        setDocContent(res.content);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setDocError(err.message || '读取文档内容失败');
        setDocContent('');
      } finally {
        setIsLoadingDoc(false);
      }
    },
    [activeProjectId, apiClient]
  );

  useEffect(() => {
    fetchDocumentList();
  }, [fetchDocumentList, stateRevision]);

  useEffect(() => {
    if (documentList?.hasCompiledDocs && selectedDocPath) {
      loadDocumentContent(selectedDocPath);
    }
  }, [documentList?.hasCompiledDocs, selectedDocPath, loadDocumentContent]);

  // --------------------------------------------------------------------------
  // Action: Generate Documents (POST /documents/generate)
  // --------------------------------------------------------------------------

  const handleGenerateDocuments = async (asDraft = false, forceOverwrite = false) => {
    if (!activeProjectId || isGenerating) return;
    const currentRev = stateRevision || 1;

    setIsGenerating(true);
    try {
      const parsedRules = customRulesText
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      const res = await apiClient.generateDocuments(activeProjectId, {
        projectId: activeProjectId,
        expectedRevision: currentRev,
        customRules: parsedRules.length > 0 ? parsedRules : undefined,
        customNotes: customNotesText.trim() ? customNotesText.trim() : undefined,
        autoReApprove: !asDraft,
        isDraft: asDraft,
        forceOverwrite,
      });

      await refreshSnapshot();
      await fetchDocumentList();
      if (selectedDocPath) {
        await loadDocumentContent(selectedDocPath);
      }
      setIsDiffModalOpen(false);
      setDetectedDiffs([]);

      if (res.backupPath) {
        success(
          `已成功覆盖生成，原文件已自动安全备份至 ${res.backupPath}`,
          '蓝图重编译完成 (已备份)'
        );
      } else {
        success(
          asDraft
            ? '成功编译生成【探索草案】工程蓝图！'
            : '成功编译生成包含 AGENTS.md 在内的权威工程蓝图！',
          asDraft ? '草案生成完成' : '蓝图生成完成'
        );
      }
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        if (err.details?.diffs && Array.isArray(err.details.diffs) && err.details.diffs.length > 0) {
          setDetectedDiffs(err.details.diffs as DocumentDiffItem[]);
          setIsDiffModalOpen(true);
        } else {
          setIsConflictModalOpen(true);
        }
      } else if (err instanceof ApiClientError && err.statusCode === 422) {
        error(err.message || '当前项目准备度尚未获得用户批准，无法生成文档', '准入门禁拦截');
      } else {
        error(err.message || '生成文档失败', '操作中断');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDocContent = async () => {
    if (!activeProjectId || !selectedDocPath || isSavingDoc) return;
    setIsSavingDoc(true);
    try {
      await apiClient.writeDocument(activeProjectId, {
        docPath: selectedDocPath,
        content: docContent,
      });
      success(`已成功保存对 ${selectedDocPath} 的修改！`, '文档已更新');
      await fetchDocumentList();
    } catch (err: any) {
      error(err.message || '保存文档失败', '操作中断');
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleExportToFolder = async () => {
    if (!activeProjectId || !exportDirectory.trim() || isExportingFolder) return;
    setIsExportingFolder(true);
    try {
      const res = await apiClient.exportDocumentsToPath(activeProjectId, {
        targetDirectory: exportDirectory.trim(),
      });
      success(`已成功将 ${res.copiedCount} 份蓝图同步导出至目标目录：${res.targetDirectory}`, '导出成功');
      setShowExportModal(false);
    } catch (err: any) {
      error(err.message || '导出到目录失败', '操作中断');
    } finally {
      setIsExportingFolder(false);
    }
  };

  const handleCopy = () => {
    if (!docContent) return;
    navigator.clipboard.writeText(docContent);
    setCopied(true);
    success('已复制 Markdown 内容到剪贴板', '复制成功');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAllZip = async () => {
    if (!activeProjectId || !documentList || documentList.items.length === 0 || isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      const entries: ZipFileEntry[] = [];
      for (const item of documentList.items) {
        try {
          const res = await apiClient.readDocument(activeProjectId, {
            projectId: activeProjectId,
            docPath: item.path,
          });
          entries.push({ path: item.path, content: res.content });
        } catch (err) {
          console.error(`Failed to read doc ${item.path} for zip:`, err);
        }
      }

      if (entries.length === 0) {
        error('无法读取到有效文档内容进行打包', '打包失败');
        return;
      }

      const cleanProjectName = (snapshot?.metadata?.name || 'project').replace(/[^\w\u4e00-\u9fa5_-]/g, '_');
      downloadZip(`${cleanProjectName}-blueprints.zip`, entries);
      success(`已成功打包并下载 ${entries.length} 份蓝图文档 (ZIP)`, '下载成功');
    } catch (err: any) {
      error(err.message || '打包下载失败', '操作中断');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadHtml = async () => {
    if (!activeProjectId || isDownloadingHtml) return;
    setIsDownloadingHtml(true);
    try {
      const blob = await apiClient.exportDocumentsHtml(activeProjectId);
      const cleanProjectName = (snapshot?.metadata?.name || 'project').replace(/[^\w\u4e00-\u9fa5_-]/g, '_');
      const filename = `${cleanProjectName}-spec.html`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success(`已成功导出单文件离线交互式规范包 (${filename})`, '导出成功');
    } catch (err: any) {
      error(err.message || '导出 HTML 规范包失败', '操作中断');
    } finally {
      setIsDownloadingHtml(false);
    }
  };

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={Compass}
        title="未载入项目"
        description="请在首页新建或打开已有项目以查看或生成文档。"
        className="py-16"
      />
    );
  }

  const isApproved =
    snapshot?.metadata?.stage === 'approved' ||
    snapshot?.metadata?.stage === 'documents-generated' ||
    snapshot?.readiness?.current?.userDisposition === 'approved' ||
    snapshot?.readiness?.current?.userDisposition === 'approved-with-warnings' ||
    snapshot?.readiness?.current?.userDisposition === 'approved-with-known-issues';

  const selectedDocItem = documentList?.items.find((d) => d.path === selectedDocPath);

  return (
    <div className="max-w-5xl w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>开发规范蓝图文档 (Engineering Blueprints)</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            通过准备度准入门禁后，编译生成的权威 Markdown 规范包（包含 AGENTS.md 与 8 份核心蓝图）
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {documentList?.hasCompiledDocs && (
            <>
              <button
                type="button"
                onClick={() => setIsPromptModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="生成并复制面向 Cursor / Claude Code / Antigravity 的启动提示词"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>复制 Agent 启动词</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isDownloadingZip}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="将 AGENTS.md 与 docs/ 目录一键打包为 ZIP 下载"
              >
                <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce text-orange-500' : 'text-emerald-500'}`} />
                <span>{isDownloadingZip ? '正在打包...' : '打包下载 (ZIP)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                disabled={isDownloadingHtml}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="导出包含所有蓝图、交互式侧边栏、拓扑图与暗色/高亮模式的单文件 HTML 交付包"
              >
                <Globe className={`w-3.5 h-3.5 ${isDownloadingHtml ? 'animate-spin text-cyan-500' : 'text-cyan-600 dark:text-cyan-400'}`} />
                <span>{isDownloadingHtml ? '正在生成 HTML...' : '导出单文件 HTML'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="直接将蓝图输出至本机某个目标代码仓库路径"
              >
                <FolderOutput className="w-3.5 h-3.5 text-blue-500" />
                <span>输出至本地目录</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsDriftModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="静态审计代码实现是否偏离已锁定规范或引入违禁依赖 (pa verify)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>规范漂移审计</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCustomRulesInput(!showCustomRulesInput)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            title="在编译前插入专属团队规范或工程红线规则"
          >
            <span>{showCustomRulesInput ? '收起规范红线' : '自定义红线/规范'}</span>
          </button>

          {!isApproved ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('readiness')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>前往准备度审阅签署</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDocuments(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                title="无需等待准备度门禁签署，先行编译探索草案"
              >
                <FileEdit className="w-3.5 h-3.5 text-orange-500" />
                <span>生成草案蓝图 (Draft)</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleGenerateDocuments(false)}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              title="一键编译生成完整规范文档包"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>
                {isGenerating
                  ? '正在编译蓝图...'
                  : documentList?.hasCompiledDocs
                  ? '重新编译文档包'
                  : '一键编译生成完整文档包'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Rules Input Panel */}
      {showCustomRulesInput && (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              插入专属工程红线与自定义开发约束 (直接合并进 AGENTS.md)
            </span>
            <span className="text-[11px] text-zinc-400">每行一条规则</span>
          </div>
          <textarea
            value={customRulesText}
            onChange={(e) => setCustomRulesText(e.target.value)}
            rows={3}
            className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="例如：
- 严禁引入外部未授权第三方 UI 组件库，必须基于 Tailwind 原生搭建
- 所有持久化数据必须严格使用本地纯文件结构存储，禁止引入 SQLite"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">团队规范备注 (可选附录)</span>
          </div>
          <input
            type="text"
            value={customNotesText}
            onChange={(e) => setCustomNotesText(e.target.value)}
            className="w-full p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="如：适用于 2026 Q3 企业私有环境部署规范"
          />
        </div>
      )}


      {/* Manifest Stale Warning if any */}
      {documentList?.isManifestStale && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>项目决策在生成后已有新演进，当前文档版本可能滞后，建议重新编译。</span>
          </div>
          <button
            onClick={() => handleGenerateDocuments(false)}
            disabled={isGenerating}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-medium hover:bg-amber-700 transition-colors cursor-pointer"
          >
            重新编译
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {!documentList?.hasCompiledDocs ? (
        <EmptyState
          icon={BookOpen}
          title="尚未编译生成蓝图文档"
          description={
            isApproved
              ? '项目已通过准备度准入批准，随时可点击上方“一键编译生成完整文档包”。'
              : '生成文档前，必须在准备度审阅 (Readiness) 页面完成显式用户批准。'
          }
          actionLabel={isApproved ? '立即生成蓝图' : '前往准备度审阅'}
          onAction={isApproved ? handleGenerateDocuments : () => setActiveTab('readiness')}
          className="py-20"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Document List */}
          <div className="md:col-span-4 space-y-1.5 overflow-y-auto max-h-[600px]">
            {documentList.items.map((doc: DocumentItemView) => {
              const isSelected = selectedDocPath === doc.path;
              const isAgentsMd = doc.path === 'AGENTS.md';

              return (
                <div
                  key={doc.path}
                  onClick={() => setSelectedDocPath(doc.path)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs'
                      : 'border-border-subtle bg-surface-card hover:border-border-default'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileText
                        className={`w-4 h-4 shrink-0 ${
                          isAgentsMd ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-text-primary truncate">
                        {doc.title}
                      </span>
                    </div>

                    {isAgentsMd && (
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                        GATEWAY
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-muted font-mono">
                    <span className="truncate">{doc.path}</span>
                    {doc.isStale && (
                      <span className="text-amber-600 dark:text-amber-400 font-sans font-medium">
                        已过时
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Document Reader Pane */}
          <div className="md:col-span-8">
            <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-elevation-card space-y-4 min-h-[500px] h-[calc(100vh-200px)] flex flex-col justify-between">
              {/* Reader Header */}
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="space-y-0.5 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                      {selectedDocItem?.title || selectedDocPath}
                    </h3>
                    <span className="text-xs font-mono text-text-muted bg-surface-subtle px-1.5 py-0.5 rounded">
                      {selectedDocPath}
                    </span>
                  </div>
                  {selectedDocItem?.generatedAt && (
                    <div className="text-xs text-text-muted">
                      生成时间: {new Date(selectedDocItem.generatedAt).toLocaleString()} · 关联版本: rev.{selectedDocItem.sourceRevision}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Mode switch */}
                  <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs">
                    <button
                      onClick={() => setViewMode('rendered')}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        viewMode === 'rendered'
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>预览</span>
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        viewMode === 'raw'
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Code className="w-3 h-3" />
                      <span>源码</span>
                    </button>
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        viewMode === 'edit'
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>编辑</span>
                    </button>
                  </div>

                  <button
                    onClick={handleCopy}
                    disabled={!docContent}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="复制 Markdown 内容"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Reader Body */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {isLoadingDoc ? (
                  <div className="space-y-3 py-6">
                    <CardSkeleton />
                    <CardSkeleton />
                  </div>
                ) : docError ? (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{docError}</span>
                  </div>
                ) : viewMode === 'rendered' ? (
                  <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans select-text">
                    <MarkdownRenderer content={docContent} />
                  </div>
                ) : viewMode === 'raw' ? (
                  <pre className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text">
                    {docContent}
                  </pre>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full h-[380px] p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-900 dark:text-zinc-100 leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-emerald-500 resize-y"
                      placeholder="在此直接微调 Markdown 内容..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDocContent}
                        disabled={isSavingDoc}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingDoc ? '正在保存...' : '保存修改'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export to Folder Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <FolderOutput className="w-4 h-4 text-blue-500" />
                <span>输出蓝图至本地目录</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              输入你目标工程的根目录绝对路径（例如 <code>D:\projects\my-app</code>）。系统将把 <code>AGENTS.md</code> 和 <code>docs/</code> 直接写入该目录。
            </p>
            <input
              type="text"
              value={exportDirectory}
              onChange={(e) => setExportDirectory(e.target.value)}
              placeholder="例如：D:\projects\my-app"
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleExportToFolder}
                disabled={isExportingFolder || !exportDirectory.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <FolderOutput className="w-3.5 h-3.5" />
                <span>{isExportingFolder ? '正在导出...' : '确认同步导出'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coding Agent Prompt Modal */}
      <AgentPromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        projectName={snapshot?.metadata?.name || 'MyProject'}
        stateRevision={snapshot?.metadata?.stateRevision}
        warnings={snapshot?.readiness?.current?.warnings}
        assumptions={snapshot?.assumptions?.items?.filter((a) => a.status === 'active').map((a) => a.statement)}
        knownIssues={snapshot?.readiness?.current?.knownIssueAcknowledgements}
        documentsCount={documentList?.items?.length}
      />

      {/* Concurrency Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onReload={async () => {
          await refreshSnapshot();
          fetchDocumentList();
        }}
        expectedRevision={stateRevision || undefined}
        serverRevision={snapshot?.metadata?.stateRevision || undefined}
      />

      {/* Document Diff Guard Modal (P2 Feature) */}
      <DocumentDiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        diffs={detectedDiffs}
        onForceOverwrite={() => handleGenerateDocuments(false, true)}
        isOverwriting={isGenerating}
      />

      {/* Spec-Drift Auditor Modal (方案 8) */}
      <SpecDriftModal
        isOpen={isDriftModalOpen}
        onClose={() => setIsDriftModalOpen(false)}
      />
    </div>
  );
};
