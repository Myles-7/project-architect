import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Modal } from './Modal.js';

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  serverRevision?: number;
  expectedRevision?: number;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  onReload,
  serverRevision,
  expectedRevision,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="状态版本冲突 (409 Conflict)"
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            关闭
          </button>
          <button
            onClick={() => {
              onReload();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>载入最新状态</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">项目在后台已被修改</div>
            <div>
              你提交操作时的版本为{' '}
              <span className="font-mono font-medium">rev.{expectedRevision ?? '?'}</span>，
              但服务端当前版本为{' '}
              <span className="font-mono font-medium">rev.{serverRevision ?? '最新'}</span>。
            </div>
          </div>
        </div>
        <p>
          系统已阻止非法的并发覆盖。请点击下方“载入最新状态”同步最新项目蓝图后再继续操作。
        </p>
      </div>
    </Modal>
  );
};
