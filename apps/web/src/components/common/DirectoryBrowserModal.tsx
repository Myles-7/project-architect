import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowUp,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Modal } from './Modal.js';
import { defaultApiClient } from '../../api/client.js';
import type { FsDirectoryItem, ValidatePathResponse } from '@project-architect/contracts';

export interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
  initialPath?: string;
  title?: string;
}

export const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = '',
  title = '选择本地项目工作区目录',
}) => {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [inputPath, setInputPath] = useState<string>(initialPath);
  const [parentPath, setParentPath] = useState<string | undefined>();
  const [items, setItems] = useState<FsDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<ValidatePathResponse | null>(null);
  const [validating, setValidating] = useState(false);

  // Load directories whenever currentPath changes
  const loadDirectory = async (targetPath: string) => {
    setIsLoading(true);
    try {
      const res = await defaultApiClient.listDirectories(targetPath || undefined);
      setCurrentPath(res.currentPath);
      setInputPath(res.currentPath);
      setParentPath(res.parentPath);
      setItems(res.items);
      void validate(res.currentPath);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const validate = async (path: string) => {
    if (!path.trim()) {
      setValidation(null);
      return;
    }
    setValidating(true);
    try {
      const res = await defaultApiClient.validatePath({ path: path.trim() });
      setValidation(res);
    } catch {
      setValidation({
        valid: false,
        exists: false,
        isDirectory: false,
        isEmpty: false,
        error: '路径校验失败',
      });
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadDirectory(initialPath);
    }
  }, [isOpen, initialPath]);

  const handleNavigateTo = (targetPath: string) => {
    void loadDirectory(targetPath);
  };

  const handleInputPathChange = (val: string) => {
    setInputPath(val);
    void validate(val);
  };

  const handleConfirm = () => {
    const chosen = inputPath.trim() || currentPath.trim();
    if (chosen) {
      onSelect(chosen);
      onClose();
    }
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 text-xs">
        {validating ? (
          <span className="text-text-muted flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> 校验中...
          </span>
        ) : validation?.valid ? (
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {validation.exists
              ? validation.isEmpty
                ? '目录有效 (空目录)'
                : '目录有效 (包含现有文件)'
              : '目录不存在 (将自动创建)'}
          </span>
        ) : validation?.error ? (
          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> {validation.error}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised border border-border-subtle transition-colors cursor-pointer"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!inputPath.trim() || (validation !== null && !validation.valid)}
          className="px-4 py-1.5 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
        >
          选择此目录
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      maxWidth="lg"
      closeLabel="关闭目录浏览弹窗"
    >
      <div className="space-y-4">
        {/* Absolute Path Input with Instant Live Validation */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-text-secondary">
            目标本地绝对物理路径 (可直接粘贴或在下方浏览选择)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputPath}
              onChange={(e) => handleInputPathChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNavigateTo(inputPath);
                }
              }}
              placeholder="例如: D:\Projects\MyNewApp 或 /Users/user/projects/app"
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-surface-raised border border-border-subtle focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-text-primary placeholder-text-muted font-mono"
            />
            <button
              type="button"
              onClick={() => handleNavigateTo(inputPath)}
              disabled={isLoading || !inputPath.trim()}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-surface-raised hover:bg-surface-subtle border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer shrink-0"
              title="转到输入的目录路径"
            >
              跳转
            </button>
          </div>
        </div>

        {/* Navigation Breadcrumb Bar */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-surface-subtle/60 border border-border-subtle text-xs">
          <div className="flex items-center gap-1.5 text-text-muted overflow-x-auto min-w-0 flex-1">
            <HardDrive className="w-3.5 h-3.5 shrink-0 text-orange-500" />
            <span className="font-mono text-text-primary truncate">
              {currentPath || '本地根驱动器列表'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {parentPath && (
              <button
                type="button"
                onClick={() => handleNavigateTo(parentPath)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-surface-raised hover:bg-surface-subtle border border-border-subtle text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                title="返回上一级目录"
              >
                <ArrowUp className="w-3 h-3" />
                <span>上一级</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNavigateTo(currentPath)}
              disabled={isLoading}
              className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors cursor-pointer"
              title="刷新目录"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Directory Item List */}
        <div className="border border-border-subtle rounded-xl bg-surface-base divide-y divide-border-subtle max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-muted flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
              <span>正在读取目录条目...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              当前目录为空，无子文件夹
            </div>
          ) : (
            items.map((item) => {
              const isDrive = item.path.endsWith(':\\') || item.path === '/';
              return (
                <div
                  key={item.path}
                  onClick={() => handleNavigateTo(item.path)}
                  className="px-3.5 py-2.5 flex items-center justify-between hover:bg-surface-raised transition-colors cursor-pointer text-xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isDrive ? (
                      <HardDrive className="w-4 h-4 text-orange-500 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0 group-hover:hidden" />
                    )}
                    {!isDrive && (
                      <FolderOpen className="w-4 h-4 text-amber-500 shrink-0 hidden group-hover:inline-block" />
                    )}
                    <span className="font-medium text-text-primary truncate">{item.name}</span>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
