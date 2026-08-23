import React, { useState } from 'react';
import { 
  FileCheck2, 
  Copy, 
  Download, 
  Check, 
  Sparkles, 
  Terminal,
  Eye,
  Code,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type { DocumentBlueprint } from '../../types/project';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { useToast } from '../common/Toast';

interface DocumentsViewProps {
  documents: DocumentBlueprint[];
  onToggleOverview?: () => void;
  isOverviewOpen?: boolean;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ 
  documents,
  onToggleOverview,
  isOverviewOpen = true
}) => {
  const { showToast } = useToast();
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  const handleCopyMarkdown = () => {
    if (!selectedDoc) return;
    navigator.clipboard.writeText(selectedDoc.contentMarkdown);
    setCopied(true);
    showToast('已复制 Markdown 到剪贴板', `可直接粘贴到工程目录的 ${selectedDoc.filename}`, 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportAll = () => {
    showToast(
      '已打包导出全部 7 份开发蓝图',
      '包含 AGENTS.md 与 docs/ 完整目录结构，可直接喂给 Cursor / Antigravity',
      'success'
    );
  };

  const getBadgeStyle = (badge: DocumentBlueprint['badge']) => {
    switch (badge) {
      case 'Gateway':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-300 dark:border-orange-800';
      case 'Core':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'Plan':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800';
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#121316]">
      {/* Left Documents Navigator */}
      <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3] dark:bg-[#0A0B0D] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E5E2DA] dark:border-[#1E2026] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-orange-500" />
              <span>开发蓝图文档 ({documents.length})</span>
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            派生自已批准的规范状态模型，单一事实源
          </p>

          <button
            onClick={handleExportAll}
            className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#141519] border border-[#E5E2DA] dark:border-[#1E2026] hover:border-orange-400 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-orange-500" />
            <span>打包导出全部 Markdown</span>
          </button>
        </div>

        {/* List of files */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {documents.map((doc) => {
            const isSelected = selectedDoc?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-white dark:bg-[#15161A] border-orange-500/80 shadow-2xs'
                    : 'bg-transparent border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    {doc.filename}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded font-semibold border ${getBadgeStyle(doc.badge)}`}>
                    {doc.badge}
                  </span>
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {doc.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Document Reader */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-[#121316]">
        {selectedDoc ? (
          <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-4xl mx-auto w-full">
            {/* Document Meta Header */}
            <div className="border-b border-[#E5E2DA] dark:border-[#1E2026] pb-4 space-y-3">
              {/* Top toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-mono font-bold text-orange-600 dark:text-orange-400">
                    {selectedDoc.filename}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    {selectedDoc.stateRevision}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono whitespace-nowrap">
                    更新于: {selectedDoc.updatedAt}
                  </span>
                </div>

                {/* View Controls & Copy */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Mode switcher */}
                  <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs font-medium">
                    <button
                      onClick={() => setViewMode('rendered')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        viewMode === 'rendered'
                          ? 'bg-white dark:bg-[#15161A] text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                      title="富文本渲染视图"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>排版预览</span>
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        viewMode === 'raw'
                          ? 'bg-white dark:bg-[#15161A] text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                      title="原始 Markdown 源码"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>源码</span>
                    </button>
                  </div>

                  {onToggleOverview && (
                    <button
                      onClick={onToggleOverview}
                      className="h-8 px-2.5 rounded-lg border border-[#E5E2DA] dark:border-[#1E2026] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      title={isOverviewOpen ? '折叠侧栏，进入宽屏沉浸阅读' : '展开 Overview 全景'}
                    >
                      {isOverviewOpen ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isOverviewOpen ? '宽屏模式' : '还原栏宽'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleCopyMarkdown}
                    className="h-8 px-3 rounded-lg border border-[#E5E2DA] dark:border-[#1E2026] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '已复制' : '复制全文'}</span>
                  </button>
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {selectedDoc.title}
              </h1>

              {/* Target Audience Bar */}
              <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>适用场景: <strong className="text-zinc-700 dark:text-zinc-300 font-medium">{selectedDoc.targetAudience}</strong></span>
              </div>
            </div>

            {/* Special Highlight for AGENTS.md */}
            {selectedDoc.filename === 'AGENTS.md' && (
              <div className="p-4 rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20 text-xs space-y-2">
                <div className="font-bold text-orange-900 dark:text-orange-300 flex items-center gap-2 text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <span>Coding Agent 唯一入口协议与边界防线</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs sm:text-[13px]">
                  把本项目放入仓库根目录后，Coding Agent (Antigravity / Cursor / Claude Code) 会首先读取 <code className="font-mono font-semibold">AGENTS.md</code>。它锁定了不可突破的架构底线与推荐阅读路径，避免 Agent 在未理解项目时乱写代码。
                </p>
              </div>
            )}

            {/* Content Display: Rendered Rich Markdown vs Raw Code */}
            {viewMode === 'rendered' ? (
              <div className="rounded-2xl border border-[#E5E2DA] dark:border-[#1E2026] p-6 sm:p-8 bg-[#F7F6F3]/50 dark:bg-[#111215] shadow-2xs">
                <MarkdownRenderer content={selectedDoc.contentMarkdown} />
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E5E2DA] dark:border-[#1E2026] p-5 bg-[#F7F6F3]/50 dark:bg-[#111215] font-mono text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 overflow-x-auto leading-relaxed shadow-2xs">
                <pre className="whitespace-pre-wrap">{selectedDoc.contentMarkdown}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 text-sm text-zinc-400">
            暂无选中的文档
          </div>
        )}
      </div>
    </div>
  );
};
