import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { UserCheck, Lock } from 'lucide-react';
import type { OverviewItemView } from '@project-architect/contracts';

interface EditOverviewItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  sectionTitle: string;
  item?: OverviewItemView | null;
  onSave: (sectionId: string, itemRef: string | undefined, newStatement: string) => Promise<void>;
  isSaving: boolean;
}

export const EditOverviewItemModal: React.FC<EditOverviewItemModalProps> = ({
  isOpen,
  onClose,
  sectionId,
  sectionTitle,
  item,
  onSave,
  isSaving,
}) => {
  const [statement, setStatement] = useState('');

  useEffect(() => {
    if (item) {
      setStatement(item.statement);
    } else {
      setStatement('');
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim() || isSaving) return;
    await onSave(sectionId, item?.ref, statement.trim());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? `编辑 ${sectionTitle} 决策` : `添加 ${sectionTitle} 决策`}
      maxWidth="md"
      closeLabel="关闭决策编辑弹窗"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>保存后将作为 Confirmed 用户决策写入</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !statement.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition-colors cursor-pointer shadow-xs"
            >
              <span>{isSaving ? '正在保存...' : '保存决策'}</span>
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {item?.isLocked && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>该决策当前处于锁定状态。若要修改，请先执行解锁。</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="decision-statement" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            决策陈述 (Statement)
          </label>
          <textarea
            id="decision-statement"
            rows={4}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="清晰表述该领域的具体决策，例如：仅支持本地 Windows 10/11，不依赖任何云端服务..."
            disabled={item?.isLocked || isSaving}
            className="w-full p-3 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 leading-relaxed resize-none disabled:opacity-60"
            required
          />
        </div>
      </form>
    </Modal>
  );
};
