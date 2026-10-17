import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Check,
  Clock,
  Lock,
  Unlock,
  Edit3,
  Plus,
  RefreshCw,
  Sparkles,
  HelpCircle,
  AlertCircle,
  Trash2,
  LayoutGrid,
  ListTree,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  FolderSearch,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { MaturityBadge } from '../../components/common/StatusBadge.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { CardSkeleton } from '../../components/common/LoadingSkeleton.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.js';
import { EditOverviewItemModal } from './EditOverviewItemModal.js';
import { BrownfieldScanModal } from '../brownfield/BrownfieldScanModal.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type {
  ProjectOverviewView,
  OverviewItemView,
  OverviewSectionView,
  TypedRef,
  DecisionRef,
  SectionMaturity,
} from '@project-architect/contracts';

interface OverviewDrawerProps {
  inDrawer?: boolean;
  className?: string;
}

export const OverviewDrawer: React.FC<OverviewDrawerProps> = ({ inDrawer = false, className = '' }) => {
  const { state, apiClient, refreshSnapshot, deprecateDecision } = useProjectSession();
  const { snapshot, uiState, activeProjectId, stateRevision, highlightTarget } = state;
  const { success, error, warning: showWarning } = useToast();

  const [overview, setOverview] = useState<ProjectOverviewView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  // P1-5: In-memory derived projection from local snapshot for zero-latency, zero-flash instant display
  const derivedOverview = useMemo<ProjectOverviewView | null>(() => {
    if (!snapshot) return null;
    const decisions = snapshot.decisions?.items || [];
    const assumptions = (snapshot.assumptions?.items || []).filter((a) => a.status === 'active');
    const openGaps = (snapshot.gaps?.gaps || []).filter((g) => g.status === 'open');
    const openConflicts = (snapshot.gaps?.conflicts || []).filter((c) => c.status === 'open');

    let totalConfirmed = 0;
    let totalLocked = 0;
    let totalCandidates = 0;

    for (const d of decisions) {
      if (d.status === 'locked') totalLocked++;
      else if (d.status === 'confirmed') totalConfirmed++;
      else if (d.status === 'candidate') totalCandidates++;
    }

    const sections: OverviewSectionView[] = (snapshot.overview?.sections || []).map((section) => {
      const sectionDecisions = decisions.filter(
        (d) =>
          (section.itemRefs?.includes(`decision:${d.id}`) || d.area === section.id) &&
          (d.status === 'candidate' || d.status === 'confirmed' || d.status === 'locked')
      );

      const items: OverviewItemView[] = sectionDecisions.map((d) => {
        const hasConflict = openConflicts.some((c) => c.decisionRefs?.includes(`decision:${d.id}`));
        const isCandidate = d.status === 'candidate';

        let hasWarning = false;
        let warningReason: string | undefined;

        if (hasConflict) {
          hasWarning = true;
          warningReason = 'Decision has an active unresolved conflict';
        } else if (isCandidate) {
          hasWarning = true;
          warningReason = 'Candidate direction awaiting explicit user confirmation';
        }

        return {
          ref: `decision:${d.id}` as TypedRef,
          statement: d.statement,
          status: d.status as 'candidate' | 'confirmed' | 'locked',
          origin: d.origin,
          isLocked: d.status === 'locked',
          hasWarning,
          warningReason,
          evidenceRefs: d.evidenceRefs ? [...d.evidenceRefs] : undefined,
        };
      });

      const sectionAssumptions = assumptions.filter(
        (a) =>
          section.itemRefs?.includes(`assumption:${a.id}`) ||
          a.area === section.id ||
          (!a.area && (section.id === 'technical_boundary' || section.id === 'tech_boundary'))
      );

      const assumptionItems: OverviewItemView[] = sectionAssumptions.map((a) => ({
        ref: `assumption:${a.id}` as TypedRef,
        statement: a.statement,
        status: 'candidate' as const,
        origin: 'agent' as const,
        isLocked: false,
        hasWarning: true,
        warningReason: a.reason ? `架构假设待验证: ${a.reason}` : '架构假设待验证',
      }));

      const openGapsForSection = openGaps.filter((g) => g.area === section.id);

      return {
        id: section.id,
        title: section.title,
        kind: section.kind,
        maturity: section.maturity,
        items: [...items, ...assumptionItems],
        hasUnresolvedGaps: openGapsForSection.length > 0,
        unresolvedGapCount: openGapsForSection.length,
      };
    });

    let overallMaturity: SectionMaturity = 'unexplored';
    if (sections.length > 0) {
      const maturities = sections.map((s) => s.maturity);
      if (maturities.every((m) => m === 'locked')) {
        overallMaturity = 'locked';
      } else if (maturities.every((m) => m === 'clear' || m === 'locked')) {
        overallMaturity = 'clear';
      } else if (maturities.some((m) => m === 'mostly-clear' || m === 'clear' || m === 'locked')) {
        overallMaturity = 'mostly-clear';
      } else if (maturities.some((m) => m === 'needs-clarification')) {
        overallMaturity = 'needs-clarification';
      }
    }

    return {
      sourceStateRevision: snapshot.metadata.stateRevision,
      projectId: snapshot.metadata.projectId,
      projectName: snapshot.metadata.name,
      projectStage: snapshot.metadata.stage,
      updatedAt: snapshot.metadata.updatedAt,
      overallMaturity,
      sections,
      totalConfirmedDecisions: totalConfirmed,
      totalLockedDecisions: totalLocked,
      totalCandidates,
    };
  }, [snapshot]);

  // SSOT Overview view: prefer optimistic/fetched overview if revision is matching, otherwise fallback to derived overview
  const activeOverview = useMemo(() => {
    if (overview && snapshot && overview.sourceStateRevision >= snapshot.metadata.stateRevision) {
      return overview;
    }
    return derivedOverview || overview;
  }, [overview, derivedOverview, snapshot]);

  // Inline Edit State
  const [inlineEditingRef, setInlineEditingRef] = useState<string | null>(null);
  const [inlineEditingText, setInlineEditingText] = useState<string>('');

  // View & Filter States (P2 Enhancement)
  type StatusFilter = 'all' | 'confirmed' | 'candidate' | 'assumption' | 'locked';
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'outline'>('cards');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  // Modal States
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<{ id: string; title: string } | null>(null);
  const [editingItem, setEditingItem] = useState<OverviewItemView | null>(null);
  const [deprecateTargetRef, setDeprecateTargetRef] = useState<DecisionRef | null>(null);
  const [isBrownfieldModalOpen, setIsBrownfieldModalOpen] = useState(false);

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

    if (!overview && !derivedOverview) {
      setIsLoading(true);
    }
    try {
      const data = await apiClient.getProjectOverview(activeProjectId);
      setOverview(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch overview projection:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, apiClient, overview, derivedOverview]);

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

    // Optimistic UI update: transition candidate to confirmed immediately
    setOverview((prev) => {
      const base = prev || activeOverview;
      if (!base) return prev;
      return {
        ...base,
        totalConfirmedDecisions: base.totalConfirmedDecisions + 1,
        totalCandidates: Math.max(0, base.totalCandidates - 1),
        sections: base.sections.map((sec) => ({
          ...sec,
          items: sec.items.map((it) =>
            it.ref === itemRef
              ? { ...it, status: 'confirmed' as const, hasWarning: false, warningReason: undefined }
              : it
          ),
        })),
      };
    });

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
      void fetchOverview();
    } finally {
      setIsMutating(false);
    }
  };

  const handleLockDecision = async (decRef: DecisionRef) => {
    if (!activeProjectId || isMutating) return;
    const currentRev = stateRevision || 1;

    // Optimistic UI update: lock decision immediately
    setOverview((prev) => {
      const base = prev || activeOverview;
      if (!base) return prev;
      return {
        ...base,
        totalLockedDecisions: base.totalLockedDecisions + 1,
        sections: base.sections.map((sec) => ({
          ...sec,
          items: sec.items.map((it) =>
            it.ref === decRef
              ? { ...it, status: 'locked' as const, isLocked: true }
              : it
          ),
        })),
      };
    });

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
      void fetchOverview();
    } finally {
      setIsMutating(false);
    }
  };

  const handleUnlockDecision = async (decRef: DecisionRef) => {
    if (!activeProjectId || isMutating) return;
    const currentRev = stateRevision || 1;

    // Optimistic UI update: unlock decision immediately
    setOverview((prev) => {
      const base = prev || activeOverview;
      if (!base) return prev;
      return {
        ...base,
        totalLockedDecisions: Math.max(0, base.totalLockedDecisions - 1),
        sections: base.sections.map((sec) => ({
          ...sec,
          items: sec.items.map((it) =>
            it.ref === decRef
              ? { ...it, status: 'confirmed' as const, isLocked: false }
              : it
          ),
        })),
      };
    });

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
      void fetchOverview();
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

  const handleDeprecateDecision = (itemRef: string) => {
    if (!itemRef.startsWith('decision:')) return;
    setDeprecateTargetRef(itemRef as DecisionRef);
  };

  const handleConfirmDeprecate = async () => {
    if (!deprecateTargetRef) return;
    try {
      setIsMutating(true);
      await deprecateDecision(deprecateTargetRef);
      success('决策已成功废除，相关依赖已自动清理');
    } catch (err: any) {
      error(err.message || '废除决策失败');
    } finally {
      setIsMutating(false);
      setDeprecateTargetRef(null);
    }
  };

  const filterItem = (item: OverviewItemView) => {
    const matchesFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'locked'
        ? item.status === 'locked' || item.isLocked
        : activeFilter === 'confirmed'
        ? item.status === 'confirmed'
        : activeFilter === 'candidate'
        ? item.status === 'candidate'
        : activeFilter === 'assumption'
        ? item.ref.startsWith('assumption:')
        : true;

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.statement.toLowerCase().includes(q) ||
      item.ref.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  };

  const renderOutlineItem = (section: OverviewSectionView, item: OverviewItemView) => {
    const isLocked = item.status === 'locked' || item.isLocked;
    const isConfirmed = item.status === 'confirmed';
    const isAssumption = item.ref.startsWith('assumption:');

    return (
      <div
        key={item.ref}
        id={`overview-item-${item.ref}`}
        className="group flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-surface-raised transition-colors text-xs border border-transparent hover:border-border-subtle"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isLocked ? (
            <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          ) : isConfirmed ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          ) : isAssumption ? (
            <HelpCircle className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 shrink-0" />
          )}
          <span
            className="truncate text-text-primary select-text cursor-pointer hover:underline"
            title={item.statement}
            onClick={() => openEditModal(section, item)}
          >
            {item.statement}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {item.status === 'candidate' && (
            <button
              onClick={() => handleConfirmItem(item.ref)}
              disabled={isMutating}
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
              title="确认决定"
            >
              <CheckCircle2 className="w-3 h-3" />
            </button>
          )}
          {item.ref.startsWith('decision:') && (
            isLocked ? (
              <button
                onClick={() => handleUnlockDecision(item.ref as DecisionRef)}
                disabled={isMutating}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                title="解锁决策"
              >
                <Lock className="w-3 h-3 text-amber-500" />
              </button>
            ) : (
              <button
                onClick={() => handleLockDecision(item.ref as DecisionRef)}
                disabled={isMutating}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                title="锁定决策"
              >
                <Unlock className="w-3 h-3" />
              </button>
            )
          )}
          <button
            onClick={() => openEditModal(section, item)}
            disabled={isMutating}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            title="修改决策"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          {item.ref.startsWith('decision:') && (
            <button
              onClick={() => handleDeprecateDecision(item.ref)}
              disabled={isMutating}
              className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
              title="废除决策"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
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
            ? 'bg-surface-card border-border-subtle shadow-2xs'
            : isAssumption
            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60 border-dashed'
            : 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/60 border-dashed'
        }`}
      >
        {/* Item Top Bar */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                <Lock className="w-2.5 h-2.5" />
                <span>已锁定</span>
              </span>
            ) : isConfirmed ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>已确认</span>
              </span>
            ) : isAssumption ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                <HelpCircle className="w-2.5 h-2.5" />
                <span>待验证假设</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800">
                <Sparkles className="w-2.5 h-2.5" />
                <span>AI 建议</span>
              </span>
            )}
          </div>

          <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
            {item.origin === 'user' ? '用户决定' : 'AI 建议'}
          </span>
        </div>

        {/* Statement Content or Inline Edit */}
        {isInlineEditing ? (
          <div className="space-y-2 pt-1">
            <textarea
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(240, Math.max(64, el.scrollHeight))}px`;
                  if (!el.dataset.initialized) {
                    el.dataset.initialized = 'true';
                    try {
                      el.setSelectionRange(el.value.length, el.value.length);
                    } catch {}
                  }
                }
              }}
              value={inlineEditingText}
              onChange={(e) => {
                setInlineEditingText(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = `${Math.min(240, Math.max(64, el.scrollHeight))}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  e.preventDefault();
                  void handleSaveInlineEdit(section.id, item.ref);
                } else if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              className="w-full min-h-[64px] max-h-[240px] p-2.5 text-xs rounded-lg border border-orange-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 leading-relaxed transition-colors resize-y"
              placeholder="输入修改陈述..."
            />
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
              <span className="text-zinc-400 dark:text-zinc-500">Enter 保存 · Esc 取消</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCancelInlineEdit}
                  className="px-2.5 py-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveInlineEdit(section.id, item.ref)}
                  disabled={isMutating || !inlineEditingText.trim()}
                  className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer text-xs"
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
          <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-900/60">
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                title="解除锁定"
              >
                <Unlock className="w-3 h-3" />
                <span>解锁</span>
              </button>
            )}

            <button
              onClick={() => handleStartInlineEdit(section.id, item)}
              disabled={isMutating || isLocked}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
              title={isLocked ? '已锁定决策不可直接编辑，请先解锁' : '行内快速编辑 (或双击卡片)'}
            >
              <Edit3 className="w-3 h-3" />
              <span>快速编辑</span>
            </button>

            <button
              onClick={() => openEditModal(section, item)}
              disabled={isMutating || isLocked}
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
              title={isLocked ? '已锁定决策不可直接编辑，请先解锁' : '打开完整弹窗编辑'}
            >
              <span>弹窗</span>
            </button>

            {item.ref.startsWith('decision:') && !isLocked && (
              <button
                onClick={() => void handleDeprecateDecision(item.ref)}
                disabled={isMutating}
                className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 transition-colors cursor-pointer"
                title="废除此项决策并级联清理依赖"
              >
                <Trash2 className="w-3 h-3" />
                <span>废除</span>
              </button>
            )}
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
    : `shrink-0 border-l border-border-default bg-canvas flex flex-col justify-between select-none z-10 overflow-hidden ${className || 'w-80 lg:w-96'}`;

  return (
    <aside className={containerClasses}>
      {/* Drawer Top Header - Rendered only when in main layout flow to avoid dual 48px stacked headers in ResponsiveDrawer */}
      {!inDrawer && (
        <div className="h-12 px-4 border-b border-border-default flex items-center justify-between shrink-0 bg-surface-subtle/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs font-semibold text-text-primary">
              项目全景概览与架构蓝图
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeOverview && (
              <>
                <button
                  type="button"
                  onClick={() => setIsBrownfieldModalOpen(true)}
                  className="p-1 rounded-md text-text-muted hover:text-orange-600 hover:bg-surface-raised transition-colors cursor-pointer"
                  title="逆向透视存量已有代码库并生成候选决策 (Brownfield Ingestion)"
                >
                  <FolderSearch className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={fetchOverview}
                  disabled={isLoading}
                  className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors cursor-pointer"
                  title="刷新蓝图"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Metrics Bar */}
      {activeOverview && (
        <div className="px-4 py-2 border-b border-border-subtle bg-surface-subtle/50 flex items-center justify-between text-xs text-text-muted font-medium">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>{activeOverview.totalConfirmedDecisions} 已确认</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
            <Lock className="w-3 h-3" />
            <span>{activeOverview.totalLockedDecisions} 锁定</span>
          </div>
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <Sparkles className="w-3 h-3" />
            <span>{activeOverview.totalCandidates} 建议</span>
          </div>
          {inDrawer && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsBrownfieldModalOpen(true)}
                className="p-1 rounded-md text-text-muted hover:text-orange-600 hover:bg-surface-raised transition-colors cursor-pointer"
                title="逆向透视存量已有代码库并生成候选决策 (Brownfield Ingestion)"
              >
                <FolderSearch className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={fetchOverview}
                disabled={isLoading}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors cursor-pointer"
                title="刷新蓝图"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* View Mode & Search & Filter Controls (P2 Feature) */}
      {activeOverview && (
        <div className="px-3 py-2 border-b border-border-subtle bg-surface-subtle/30 space-y-2 shrink-0">
          {/* Top row: View Mode Toggle & Search Input */}
          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border-default bg-surface p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === 'cards'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold shadow-2xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="卡片列表视图"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('outline')}
                className={`p-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === 'outline'
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold shadow-2xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="紧凑大纲树视图"
              >
                <ListTree className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Search Box */}
            <div className="relative flex-1">
              <Search className="w-3 h-3 text-text-muted absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索决策 / 区域..."
                className="w-full pl-6 pr-6 py-1 text-xs rounded-md border border-border-default bg-surface text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-orange-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-primary cursor-pointer"
                  title="清除"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Bottom row: Status Filter Capsules */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                  : 'bg-surface hover:bg-surface-raised text-text-muted border border-border-default'
              }`}
            >
              全部 ({activeOverview.sections.reduce((acc, s) => acc + s.items.length, 0)})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('confirmed')}
              className={`px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'confirmed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-raised text-emerald-700 dark:text-emerald-400 border border-border-default'
              }`}
            >
              已确认 ({activeOverview.totalConfirmedDecisions})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('candidate')}
              className={`px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'candidate'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-raised text-amber-700 dark:text-amber-400 border border-border-default'
              }`}
            >
              建议 ({activeOverview.totalCandidates})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('assumption')}
              className={`px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'assumption'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-raised text-purple-700 dark:text-purple-400 border border-border-default'
              }`}
            >
              假设 ({activeOverview.sections.reduce((acc, s) => acc + s.items.filter((i) => i.ref.startsWith('assumption:')).length, 0)})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('locked')}
              className={`px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'locked'
                  ? 'bg-zinc-600 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-raised text-text-muted border border-border-default'
              }`}
            >
              锁定 ({activeOverview.totalLockedDecisions})
            </button>
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
        ) : isLoading && !activeOverview ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !activeOverview || activeOverview.sections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="暂无蓝图结构"
            description="在对话中推进项目后，系统将自动提炼并呈现结构化决策。"
            className="py-12"
          />
        ) : (
          (() => {
            const displayedSections = activeOverview.sections
              .map((sec) => ({
                ...sec,
                matchingItems: sec.items.filter(filterItem),
              }))
              .filter(
                (sec) =>
                  sec.matchingItems.length > 0 ||
                  (!searchQuery.trim() && activeFilter === 'all')
              );

            if (displayedSections.length === 0) {
              return (
                <div className="text-center py-16 space-y-2">
                  <AlertCircle className="w-6 h-6 text-text-muted mx-auto" />
                  <p className="text-xs text-text-muted">
                    未找到匹配筛选条件的决策条目
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFilter('all');
                    }}
                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline cursor-pointer font-medium"
                  >
                    重置筛选与搜索
                  </button>
                </div>
              );
            }

            if (viewMode === 'outline') {
              return displayedSections.map((section) => {
                const isExpanded = expandedSections[section.id] ?? true;
                const isSectionHighlighted =
                  highlightTarget?.sectionId === section.id && !highlightTarget?.itemRef;
                return (
                  <div
                    key={section.id}
                    id={`overview-section-${section.id}`}
                    className={`rounded-xl bg-surface border overflow-hidden shadow-2xs transition-all ${
                      isSectionHighlighted
                        ? 'ring-2 ring-emerald-500 border-emerald-400'
                        : 'border-border-default'
                    }`}
                  >
                    <div
                      onClick={() => toggleSection(section.id)}
                      className="px-3 py-2 bg-surface-subtle/60 flex items-center justify-between cursor-pointer hover:bg-surface-raised transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        )}
                        <span className="font-semibold text-xs text-text-primary truncate">
                          {section.title}
                        </span>
                        <span className="text-xs text-text-muted font-mono">
                          ({section.matchingItems.length})
                        </span>
                        {section.hasUnresolvedGaps && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            title={`${section.unresolvedGapCount} 个待决问题`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{section.unresolvedGapCount}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <MaturityBadge maturity={section.maturity} size="sm" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddModal(section);
                          }}
                          disabled={isMutating}
                          className="p-1 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title={`在 ${section.title} 增加决策`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-2 space-y-0.5 border-t border-border-subtle bg-surface">
                        {section.matchingItems.length === 0 ? (
                          <div className="py-2 text-[11px] text-text-muted text-center">
                            尚未确立该领域决策
                          </div>
                        ) : (
                          section.matchingItems.map((item) =>
                            renderOutlineItem(section, item)
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            }

            // Cards view mode
            return displayedSections.map((section) => {
              const isSectionHighlighted =
                highlightTarget?.sectionId === section.id && !highlightTarget?.itemRef;
              return (
                <div
                  key={section.id}
                  id={`overview-section-${section.id}`}
                  className={`p-3 rounded-xl bg-surface border shadow-2xs space-y-2.5 transition-all duration-300 ${
                    isSectionHighlighted
                      ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-md'
                      : 'border-border-default'
                  }`}
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className="font-semibold text-xs text-text-primary truncate">
                        {section.title}
                      </span>
                      {section.hasUnresolvedGaps && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
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
                        type="button"
                        onClick={() => openAddModal(section)}
                        disabled={isMutating}
                        className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors cursor-pointer"
                        title={`在 ${section.title} 增加决策`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Items in Section */}
                  {section.matchingItems.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-surface-subtle/60 border border-dashed border-border-default text-[11px] text-text-muted text-center flex flex-col items-center gap-1">
                      <span>尚未确立该领域决策</span>
                      <button
                        type="button"
                        onClick={() => openAddModal(section)}
                        className="text-xs text-orange-600 dark:text-orange-400 font-medium hover:underline cursor-pointer"
                      >
                        + 手动添加显式决定
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {section.matchingItems.map((item) => renderItem(section, item))}
                    </div>
                  )}
                </div>
              );
            });
          })()
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

      {/* Deprecate Decision Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deprecateTargetRef)}
        title="废除架构决策"
        message="确定要废除此项决策吗？废除后将级联解除依赖并重新开放对应的领域缺口。"
        confirmText="确认废除"
        isDestructive={true}
        isLoading={isMutating}
        onConfirm={() => void handleConfirmDeprecate()}
        onCancel={() => setDeprecateTargetRef(null)}
      />

      {/* Brownfield Codebase Ingestion Modal (方案 4) */}
      <BrownfieldScanModal
        isOpen={isBrownfieldModalOpen}
        onClose={() => setIsBrownfieldModalOpen(false)}
      />
    </aside>
  );
};
