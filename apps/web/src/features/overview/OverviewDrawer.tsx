import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Lock,
  Unlock,
  Edit3,
  Plus,
  RefreshCw,
  Sparkles,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { MaturityBadge } from '../../components/common/StatusBadge.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { CardSkeleton } from '../../components/common/LoadingSkeleton.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EditOverviewItemModal } from './EditOverviewItemModal.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type {
  ProjectOverviewView,
  OverviewItemView,
  OverviewSectionView,
  TypedRef,
  DecisionRef,
} from '@project-architect/contracts';

interface OverviewDrawerProps {
  inDrawer?: boolean;
}

export const OverviewDrawer: React.FC<OverviewDrawerProps> = ({ inDrawer = false }) => {
  const { state, apiClient, refreshSnapshot } = useProjectSession();
  const { snapshot, uiState, activeProjectId, stateRevision, highlightTarget } = state;
  const { success, error, warning: showWarning } = useToast();

  const [overview, setOverview] = useState<ProjectOverviewView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  // Inline Edit State
  const [inlineEditingRef, setInlineEditingRef] = useState<string | null>(null);
  const [inlineEditingText, setInlineEditingText] = useState<string>('');


  // Modal States
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<{ id: string; title: string } | null>(null);
  const [editingItem, setEditingItem] = useState<OverviewItemView | null>(null);

  // Auto-scroll to highlighted target
  useEffect(() => {
    if (!highlightTarget) return;
    const targetId = highlightTarget.itemRef
      ? `overview-item-${highlightTarget.itemRef}`
      : highlightTarget.sectionId
      ? `overview-section-${highlightTarget.sectionId}`
      : null;

    if (targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightTarget]);

  // Fetch projection from real GET /api/projects/:id/overview
  const fetchOverview = useCallback(async () => {
    if (!activeProjectId) {
      setOverview(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiClient.getProjectOverview(activeProjectId);
      setOverview(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch overview projection:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, apiClient]);

  // Sync overview when active project or revision changes
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview, stateRevision]);

  // Guard against operations when drawer is closed in normal layout
  if (!inDrawer && uiState.isOverviewCollapsed) {
    return null;
  }


  // --------------------------------------------------------------------------
  // Mutation Handlers
  // --------------------------------------------------------------------------

  const handleConfirmItem = async (itemRef: TypedRef) => {
    if (!activeProjectId || isMutating) return;
    const currentRev = stateRevision || 1;

    setIsMutating(true);
    try {
      await apiClient.confirmDecision(activeProjectId, {
        projectId: activeProjectId,
        targetRef: itemRef,
        expectedRevision: currentRev,
      });

      // Update session with returned authoritative snapshot
      await refreshSnapshot();
      success(`已成功确认决策 (${itemRef})`, '决策确立');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '确认决策失败', '操作受阻');
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleLockDecision = async (decRef: DecisionRef) => {
    if (!activeProjectId || isMutating) return;
    const currentRev = stateRevision || 1;

    setIsMutating(true);
    try {
      await apiClient.lockDecision(activeProjectId, {
        projectId: activeProjectId,
        decisionRef: decRef,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      success(`已锁定决策 (${decRef})，AI 后续将不可覆盖`, '决策已锁定');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '锁定决策失败', '操作受阻');
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleUnlockDecision = async (decRef: DecisionRef) => {
    if (!activeProjectId || isMutating) return;
    const currentRev = stateRevision || 1;

    setIsMutating(true);
    try {
      await apiClient.unlockDecision(activeProjectId, {
        projectId: activeProjectId,
        decisionRef: decRef,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      showWarning(`已解除决策锁定 (${decRef})`, '决策已解锁');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '解锁决策失败', '操作受阻');
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveEdit = async (
    sectionId: string,
    itemRef: string | undefined,
    newStatement: string
  ) => {
    if (!activeProjectId) return;
    const currentRev = stateRevision || 1;

    setIsMutating(true);
    try {
      await apiClient.editOverviewItem(activeProjectId, {
        projectId: activeProjectId,
        sectionId,
        itemRef: itemRef as TypedRef,
        newStatement,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      success('已保存用户决策并推进入项目蓝图', '决策更新');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else if (err instanceof ApiClientError && err.statusCode === 422) {
        error(err.message || '该决策已被锁定，无法直接修改', '决策锁定保护');
      } else {
        error(err.message || '保存决策失败', '操作受阻');
      }
    } finally {
      setIsMutating(false);
    }
  };

  const openAddModal = (section: OverviewSectionView) => {
    setEditingSection({ id: section.id, title: section.title });
    setEditingItem(null);
    setIsEditModalOpen(true);
  };

  const openEditModal = (section: OverviewSectionView, item: OverviewItemView) => {
    setEditingSection({ id: section.id, title: section.title });
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // Render Item Component
  // --------------------------------------------------------------------------

  const handleStartInlineEdit = (_sectionId: string, item: OverviewItemView) => {
    if (isMutating || item.status === 'locked' || item.isLocked) return;
    setInlineEditingRef(item.ref);
    setInlineEditingText(item.statement);
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingRef(null);
    setInlineEditingText('');
  };


  const handleSaveInlineEdit = async (sectionId: string, itemRef: string) => {
    if (!inlineEditingText.trim() || isMutating) return;
    try {
      await handleSaveEdit(sectionId, itemRef, inlineEditingText.trim());
      handleCancelInlineEdit();
    } catch {
      // Handled in handleSaveEdit
    }
  };

  const renderItem = (section: OverviewSectionView, item: OverviewItemView) => {
    const isCandidate = item.status === 'candidate';
    const isAssumption = item.ref.startsWith('assumption:');
    const isConfirmed = item.status === 'confirmed';
    const isLocked = item.status === 'locked' || item.isLocked;
    const isInlineEditing = inlineEditingRef === item.ref;

    const isHighlighted =
      highlightTarget?.itemRef === item.ref ||
      (highlightTarget?.sectionId === section.id && !highlightTarget?.itemRef);

    return (
      <div
        key={item.ref}
        id={`overview-item-${item.ref}`}
        onDoubleClick={() => !isLocked && handleStartInlineEdit(section.id, item)}
        className={`p-2.5 rounded-xl border text-xs space-y-2 transition-all duration-300 ${
          isHighlighted
            ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/60 shadow-sm'
            : isLocked
            ? 'bg-zinc-100/70 dark:bg-zinc-900/80 border-zinc-300 dark:border-zinc-700/80'
            : isConfirmed
            ? 'bg-white dark:bg-[#17181D] border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs'
            : isAssumption
            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60 border-dashed'
            : 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/60 border-dashed'
        }`}
      >
        {/* Item Top Bar */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                <Lock className="w-2.5 h-2.5" />
                <span>已锁定</span>
              </span>
            ) : isConfirmed ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>已确认</span>
              </span>
            ) : isAssumption ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                <HelpCircle className="w-2.5 h-2.5" />
                <span>待验证假设</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800">
                <Sparkles className="w-2.5 h-2.5" />
                <span>AI 建议</span>
              </span>
            )}
          </div>

          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 capitalize">
            {item.origin === 'user' ? '用户决定' : 'AI 建议'}
          </span>
        </div>

        {/* Statement Content or Inline Edit */}
        {isInlineEditing ? (
          <div className="space-y-1.5 pt-1">
            <textarea
              value={inlineEditingText}
              onChange={(e) => setInlineEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSaveInlineEdit(section.id, item.ref);
                } else if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              rows={2}
              autoFocus
              className="w-full p-2 text-xs rounded-lg border border-orange-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="输入修改陈述..."
            />
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">Enter保存 · Esc取消</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCancelInlineEdit}
                  className="px-2 py-0.5 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveInlineEdit(section.id, item.ref)}
                  disabled={isMutating || !inlineEditingText.trim()}
                  className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-medium disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p
            className="text-zinc-900 dark:text-zinc-100 text-[11px] leading-relaxed select-text cursor-text"
            title="双击可直接快速编辑"
          >
            {item.statement}
          </p>
        )}

        {/* Warning Indicator if any */}
        {item.hasWarning && item.warningReason && (
          <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-[10px] text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-900/60">
            <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
            <span>{item.warningReason}</span>
          </div>
        )}

        {/* Item Action Buttons */}
        {!isInlineEditing && (
          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
            {isCandidate && (
              <button
                onClick={() => handleConfirmItem(item.ref)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-medium bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                title="采纳此建议并转为正式决策"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>确认采纳</span>
              </button>
            )}

            {isAssumption && (
              <button
                onClick={() => handleConfirmItem(item.ref)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                title="将此假设转为正式用户决策"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>转为决策</span>
              </button>
            )}

            {isConfirmed && !isLocked && (
              <button
                onClick={() => handleLockDecision(item.ref as DecisionRef)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                title="锁定决策，防止后续推演被覆盖"
              >
                <Lock className="w-3 h-3" />
                <span>锁定</span>
              </button>
            )}

            {isLocked && (
              <button
                onClick={() => handleUnlockDecision(item.ref as DecisionRef)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                title="解除锁定"
              >
                <Unlock className="w-3 h-3" />
                <span>解锁</span>
              </button>
            )}

            <button
              onClick={() => handleStartInlineEdit(section.id, item)}
              disabled={isMutating || isLocked}
              className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
              title={isLocked ? '已锁定决策不可直接编辑，请先解锁' : '行内快速编辑 (或双击卡片)'}
            >
              <Edit3 className="w-3 h-3" />
              <span>快速编辑</span>
            </button>

            <button
              onClick={() => openEditModal(section, item)}
              disabled={isMutating || isLocked}
              className="inline-flex items-center gap-1 px-1.5 py-0.8 rounded-lg text-[10px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
              title={isLocked ? '已锁定决策不可直接编辑，请先解锁' : '打开完整弹窗编辑'}
            >
              <span>弹窗</span>
            </button>
          </div>
        )}
      </div>
    );
  };


  // --------------------------------------------------------------------------

  // Main Render
  // --------------------------------------------------------------------------

  const containerClasses = inDrawer
    ? 'w-full h-full bg-transparent flex flex-col justify-between select-none overflow-hidden'
    : 'w-80 lg:w-96 shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6] dark:bg-[#0C0D0F] flex flex-col justify-between select-none z-10 overflow-hidden';

  return (
    <aside className={containerClasses}>
      {/* Drawer Top Header */}
      <div className="h-12 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-500" />
          <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            项目全景概览与架构蓝图
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {overview && (
            <button
              onClick={fetchOverview}
              disabled={isLoading}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="刷新蓝图"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      {overview && (
        <div className="px-4 py-2 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#121316] flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>{overview.totalConfirmedDecisions} 已确认</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
            <Lock className="w-3 h-3" />
            <span>{overview.totalLockedDecisions} 锁定</span>
          </div>
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <Sparkles className="w-3 h-3" />
            <span>{overview.totalCandidates} 建议</span>
          </div>
        </div>
      )}

      {/* Drawer Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!activeProjectId ? (
          <EmptyState
            icon={Compass}
            title="未载入项目"
            description="请在首页新建或打开已有项目以查看 Overview 蓝图。"
            className="py-12"
          />
        ) : isLoading && !overview ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !overview || overview.sections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="暂无蓝图结构"
            description="在对话中推进项目后，系统将自动提炼并呈现结构化决策。"
            className="py-12"
          />
        ) : (
          overview.sections.map((section) => {
            const isSectionHighlighted = highlightTarget?.sectionId === section.id && !highlightTarget?.itemRef;
            return (

              <div
                key={section.id}
                id={`overview-section-${section.id}`}
                className={`p-3 rounded-xl bg-white dark:bg-[#17181D] border shadow-2xs space-y-2.5 transition-all duration-300 ${
                  isSectionHighlighted
                    ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-md'
                    : 'border-zinc-200/80 dark:border-zinc-800/80'
                }`}
              >

              {/* Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                    {section.title}
                  </span>
                  {section.hasUnresolvedGaps && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      title={`${section.unresolvedGapCount} 个待决问题/分歧`}
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span>{section.unresolvedGapCount} 待决</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <MaturityBadge maturity={section.maturity} size="sm" />
                  <button
                    onClick={() => openAddModal(section)}
                    disabled={isMutating}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title={`在 ${section.title} 增加决策`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Items in Section */}
              {section.items.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-zinc-50/60 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 dark:text-zinc-500 text-center flex flex-col items-center gap-1">
                  <span>尚未确立该领域决策</span>
                  <button
                    onClick={() => openAddModal(section)}
                    className="text-[10px] text-orange-600 dark:text-orange-400 font-medium hover:underline cursor-pointer"
                  >
                    + 手动添加显式决定
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {section.items.map((item) => renderItem(section, item))}
                </div>
              )}
            </div>
          );
        })
      )}

      </div>

      {/* Edit & Add Item Modal */}
      {editingSection && (
        <EditOverviewItemModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          sectionId={editingSection.id}
          sectionTitle={editingSection.title}
          item={editingItem}
          onSave={handleSaveEdit}
          isSaving={isMutating}
        />
      )}

      {/* Concurrency Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onReload={async () => {
          await refreshSnapshot();
          fetchOverview();
        }}
        expectedRevision={stateRevision || undefined}
        serverRevision={snapshot?.metadata?.stateRevision || undefined}
      />
    </aside>
  );
};
