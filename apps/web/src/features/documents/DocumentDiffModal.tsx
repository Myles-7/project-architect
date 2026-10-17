import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { Download, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/common/Toast.js';
import type { DocumentDiffItem } from '@project-architect/contracts';

interface DocumentDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffs: DocumentDiffItem[];
  onForceOverwrite: () => Promise<void>;
  isOverwriting?: boolean;
}

export const DocumentDiffModal: React.FC<DocumentDiffModalProps> = ({
  isOpen,
  onClose,
  diffs,
  onForceOverwrite,
  isOverwriting = false,
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const { success } = useToast();

  if (!diffs || diffs.length === 0) {
    return null;
  }

  const currentDiff = diffs[selectedFileIndex] || diffs[0];

  const handleExportPatch = () => {
    const fullPatch = diffs.map((d) => d.unifiedDiff).join('\n\n');
    const blob = new Blob([fullPatch], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-manual-changes-${new Date().toISOString().slice(0, 10)}.patch`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('差异补丁文件已成功导出 (.patch)');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="文档重编译差异拦截保护 (Diff Guard)"
      maxWidth="xl"
      closeLabel="关闭文档差异比对弹窗"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>检测到磁盘物理文档存在手动编辑的内容</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 pl-5">
            重新编译将用当前状态机重新生成的蓝图覆盖磁盘文件。为保护您的代码与业务设计，系统已暂停直接写入。您可以查看差异并选择自动备份后覆盖，或导出补丁保留现有版本。
          </p>
        </div>

        {/* File Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border-default pb-1 overflow-x-auto scrollbar-none">
          {diffs.map((item, idx) => (
            <button
              key={item.path}
              type="button"
              onClick={() => setSelectedFileIndex(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                selectedFileIndex === idx
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 shadow-2xs'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-raised border border-transparent'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{item.path}</span>
            </button>
          ))}
        </div>

        {/* Unified Diff View */}
        <div className="rounded-xl border border-border-default bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-hidden">
          <div className="px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-zinc-400 text-xs">
            <span>Unified Diff Preview: {currentDiff?.path}</span>
            <span>红色: 磁盘手动修改 · 绿色: 新编译生成</span>
          </div>
          <div className="p-3 max-h-80 overflow-y-auto overflow-x-auto space-y-0.5 leading-relaxed select-text">
            {currentDiff?.unifiedDiff ? (
              currentDiff.unifiedDiff.split('\n').map((line, lineIdx) => {
                let colorClass = 'text-zinc-300';
                let bgClass = '';
                if (line.startsWith('+')) {
                  colorClass = 'text-emerald-400 font-semibold';
                  bgClass = 'bg-emerald-950/40';
                } else if (line.startsWith('-')) {
                  colorClass = 'text-rose-400 font-semibold';
                  bgClass = 'bg-rose-950/40';
                } else if (line.startsWith('@@')) {
                  colorClass = 'text-sky-400 font-semibold';
                  bgClass = 'bg-sky-950/30';
                } else if (line.startsWith('---') || line.startsWith('+++')) {
                  colorClass = 'text-zinc-500 italic';
                }

                return (
                  <div key={lineIdx} className={`px-1 py-0.5 rounded-xs whitespace-pre ${colorClass} ${bgClass}`}>
                    {line}
                  </div>
                );
              })
            ) : (
              <div className="text-zinc-500 py-6 text-center">无差异内容</div>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-border-default">
          <button
            type="button"
            onClick={handleExportPatch}
            className="px-3 py-1.5 rounded-lg border border-border-default bg-surface hover:bg-surface-raised text-xs font-medium text-text-primary transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            title="导出 Unified Patch 差异补丁"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出差异补丁 (.patch)</span>
          </button>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isOverwriting}
              className="px-3 py-1.5 rounded-lg border border-border-default hover:bg-surface-raised text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              放弃重编译 (保留本地修改)
            </button>
            <button
              type="button"
              onClick={() => void onForceOverwrite()}
              disabled={isOverwriting}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isOverwriting ? 'animate-spin' : ''}`} />
              <span>{isOverwriting ? '正在覆盖并归档备份...' : '强制覆盖并备份旧版'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
