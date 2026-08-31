import React, { useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Trash2, ArrowUpCircle } from 'lucide-react';
import type { InputRef } from '@project-architect/contracts';

export interface MaterialActionsProps {
  input: InputRef;
  isExcluded: boolean;
  onToggleExclusion: () => Promise<void>;
  onDelete: () => Promise<void>;
  onReplace: (file: File) => Promise<void>;
  onRetryExtract?: () => Promise<void>;
  isProcessing?: boolean;
}

export const MaterialActions: React.FC<MaterialActionsProps> = ({
  input,
  isExcluded,
  onToggleExclusion,
  onDelete,
  onReplace,
  onRetryExtract,
  isProcessing = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onReplace(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteClick = async () => {
    if (window.confirm(`确定要将材料 "${input.label}" 移入回收站吗？`)) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Hidden file input for replacement */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        aria-label={`替换材料 ${input.label}`}
      />

      {/* 1. Toggle AI Context Inclusion */}
      <button
        type="button"
        onClick={onToggleExclusion}
        disabled={isProcessing}
        className={`p-2 rounded-lg transition-colors cursor-pointer min-touch-target flex items-center justify-center ${
          isExcluded
            ? 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40'
        }`}
        aria-label={isExcluded ? '将材料重新纳入 AI 推演上下文' : '将材料移出 AI 推演上下文'}
        title={isExcluded ? '纳入 AI 上下文' : '移出 AI 上下文'}
      >
        {isExcluded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>

      {/* 2. Re-extract / Retry */}
      {onRetryExtract && (
        <button
          type="button"
          onClick={onRetryExtract}
          disabled={isProcessing}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-touch-target flex items-center justify-center"
          aria-label={`重新提取材料 ${input.label}`}
          title="重新提取文本"
        >
          <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* 3. Replace Material */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-touch-target flex items-center justify-center"
        aria-label={`替换材料文件 ${input.label}`}
        title="替换文件内容"
      >
        <ArrowUpCircle className="w-4 h-4" />
      </button>

      {/* 4. Delete to Trash */}
      <button
        type="button"
        onClick={handleDeleteClick}
        disabled={isProcessing || isDeleting}
        className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer min-touch-target flex items-center justify-center"
        aria-label={`删除材料 ${input.label} 到回收站`}
        title="删除到回收站"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};
