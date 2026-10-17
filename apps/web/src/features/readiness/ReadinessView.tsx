import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  FileCheck2,
  HelpCircle,
  Lock,
  Compass,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  Info,
  Layers,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { CardSkeleton } from '../../components/common/LoadingSkeleton.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type {
  ReadinessView as ReadinessViewModel,
  ReadinessAreaView,
  UserDisposition,
  TypedRef,
} from '@project-architect/contracts';

export const ReadinessView: React.FC = () => {
  const { state, apiClient, refreshSnapshot, setActiveTab, jumpToFix } = useProjectSession();
  const { snapshot, activeProjectId, stateRevision } = state;
  const { success, error } = useToast();

  const [readiness, setReadiness] = useState<ReadinessViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Score breakdown disclosure
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  // Expanded areas for details
  const [expandedAreaIds, setExpandedAreaIds] = useState<Record<string, boolean>>({});

  // Inline custom fix editor state: areaId -> text
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [customFixText, setCustomFixText] = useState('');
  const [isSavingFix, setIsSavingFix] = useState(false);

  // Advanced disposition selector toggle
  const [showAdvancedDispositions, setShowAdvancedDispositions] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<UserDisposition>('approved');
  const [acknowledgedIssues, setAcknowledgedIssues] = useState<Record<string, boolean>>({});

  const fetchReadiness = useCallback(async () => {
    if (!activeProjectId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getProjectReadiness(activeProjectId);
      setReadiness(data);
      if (data.recommendedDisposition) {
        setSelectedDisposition(data.recommendedDisposition);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch readiness view:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, apiClient]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness, stateRevision]);

  const toggleAreaExpand = (areaId: string) => {
    setExpandedAreaIds((prev) => ({
      ...prev,
      [areaId]: !prev[areaId],
    }));
  };

  // --------------------------------------------------------------------------
  // Action: In-line Quick Fix (Adopt Recommendation or Custom Input)
  // --------------------------------------------------------------------------

  const handleAdoptRecommendation = async (area: ReadinessAreaView) => {
    if (!activeProjectId || !area.recommendedFix || isSavingFix) return;
    setIsSavingFix(true);
    try {
      await apiClient.editOverviewItem(activeProjectId, {
        projectId: activeProjectId,
        sectionId: area.areaId,
        newStatement: area.recommendedFix,
        expectedRevision: stateRevision || 1,
      });
      await refreshSnapshot();
      await fetchReadiness();
      success(`已采纳并确立【${area.title}】决策`, '快速补齐成功');
    } catch (err: any) {
      error(err.message || '采纳建议失败', '操作失败');
    } finally {
      setIsSavingFix(false);
    }
  };

  const handleSaveCustomFix = async (areaId: string, title: string) => {
    if (!activeProjectId || !customFixText.trim() || isSavingFix) return;
    setIsSavingFix(true);
    try {
      await apiClient.editOverviewItem(activeProjectId, {
        projectId: activeProjectId,
        sectionId: areaId,
        newStatement: customFixText.trim(),
        expectedRevision: stateRevision || 1,
      });
      await refreshSnapshot();
      await fetchReadiness();
      setEditingAreaId(null);
      setCustomFixText('');
      success(`已保存【${title}】的自定义决策`, '保存成功');
    } catch (err: any) {
      error(err.message || '保存决策失败', '操作失败');
    } finally {
      setIsSavingFix(false);
    }
  };

  // --------------------------------------------------------------------------
  // Action: Smart One-Click Approval & Direct Document Navigation
  // --------------------------------------------------------------------------

  const handleApproveAndGenerate = async () => {
    if (!activeProjectId || isApproving) return;
    const currentRev = stateRevision || 1;
    const dispositionToUse = showAdvancedDispositions
      ? selectedDisposition
      : readiness?.recommendedDisposition || 'approved';

    const ackRefs = Object.entries(acknowledgedIssues)
      .filter(([, isAck]) => isAck)
      .map(([id]) => id as TypedRef);

    setIsApproving(true);
    try {
      await apiClient.approveReadiness(activeProjectId, {
        projectId: activeProjectId,
        disposition: dispositionToUse,
        acknowledgedIssueRefs: ackRefs.length > 0 ? ackRefs : undefined,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      await fetchReadiness();
      success('已完成准备度准入授权，正在前往规范文档中心...', '授权生效');

      // Auto-navigate directly to documents compilation tab
      setTimeout(() => {
        setActiveTab('documents');
      }, 300);
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '签署准入批准失败', '操作受阻');
      }
    } finally {
      setIsApproving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Action: Manual Re-Review (Fallback)
  // --------------------------------------------------------------------------

  const handleRunReview = async () => {
    if (!activeProjectId || isReviewing) return;
    setIsReviewing(true);
    try {
      await apiClient.reviewReadiness(activeProjectId, {
        projectId: activeProjectId,
        expectedRevision: stateRevision || 1,
      });
      await refreshSnapshot();
      await fetchReadiness();
      success('准备度评估已更新', '评估完成');
    } catch (err: any) {
      error(err.message || '执行准备度评估失败', '评估中断');
    } finally {
      setIsReviewing(false);
    }
  };

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={Compass}
        title="未载入项目"
        description="请在首页新建或打开已有项目以进行准备度评估。"
        className="py-16"
      />
    );
  }

  const isApproved = readiness?.userDisposition && readiness.userDisposition !== 'pending';
  const canDirectlyApprove = readiness?.canDirectlyApprove ?? false;
  const isFullyApproved = isApproved && readiness?.canGenerateDocs;

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-500" />
            <span>准备度审阅与准入门禁 (Readiness Gate)</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            实时全景审阅 8 大核心领域决策，向 Coding Agent 交付前进行一键准入签署
          </p>
        </div>

        <button
          onClick={handleRunReview}
          disabled={isReviewing || isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          title="强制重新同步准备度评估快照"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReviewing ? 'animate-spin' : ''}`} />
          <span>{isReviewing ? '正在刷新...' : '重新体检'}</span>
        </button>
      </div>

      {isLoading && !readiness ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : !readiness ? (
        <EmptyState
          icon={ShieldCheck}
          title="准备度看板生成中"
          description="正在计算当前项目的完备性等级 (Level 1~5)..."
          actionLabel="立即体检"
          onAction={handleRunReview}
          className="py-16"
        />
      ) : (
        <div className="space-y-6">
          {/* Status & Level Score Card */}
          <div
            className={`p-5 rounded-2xl border transition-all space-y-4 ${
              readiness.status === 'ready'
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                : readiness.status === 'ready-with-warnings'
                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                : 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                      readiness.status === 'ready'
                        ? 'bg-emerald-600 text-white'
                        : readiness.status === 'ready-with-warnings'
                        ? 'bg-amber-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    Level {readiness.level} · {readiness.status}
                  </span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    综合准备度: {readiness.score} / 100
                    {readiness.credibilityScore !== undefined && readiness.credibilityScore !== readiness.score && (
                      <span className="ml-1 text-zinc-500 font-normal">
                        (可信度: {readiness.credibilityScore}%)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    · 领域闭环: {readiness.coverage ? `${readiness.coverage.satisfied}/${readiness.coverage.total}` : '8/8'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScoreDetails((prev) => !prev)}
                    className="inline-flex items-center gap-0.5 text-[11px] text-orange-600 dark:text-orange-400 hover:underline cursor-pointer ml-1"
                  >
                    <span>{showScoreDetails ? '收起得分明细' : '查看体检明细'}</span>
                    {showScoreDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {readiness.status === 'ready'
                    ? '核心八大领域决策已全部闭环，无阻断性缺口，具备向 Coding Agent 交付高质量架构规范的条件。'
                    : readiness.status === 'ready-with-warnings'
                    ? '核心领域决策已就绪，存在少量非致命性技术假设或细节警示，可安全签署准入并在文档中附带风险提示。'
                    : '存在待闭环的关键核心领域或未决缺口，建议在下方卡片中一键采纳建议或行内快速补齐。'}
                </p>
              </div>

              {/* Disposition Badge */}
              <div className="text-right shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${
                    isApproved
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{isApproved ? `已签署授权: ${readiness.userDisposition}` : '待用户准入签署'}</span>
                </span>
              </div>
            </div>

            {/* Score Breakdown Disclosure */}
            {showScoreDetails && readiness.scoreBreakdown && (
              <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2 text-xs">
                <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-orange-500" />
                  <span>准备度评分构成明细 (Score Breakdown)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {readiness.scoreBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <span
                        className={`font-mono font-bold text-xs shrink-0 ${
                          item.score >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.score >= 0 ? `+${item.score}` : `${item.score}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 8 Core Required Areas Grid (Rich Perspective Cards) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                <span>八大核心领域全景审阅 ({readiness.areas.filter((a) => a.isSatisfied).length}/{readiness.areas.length})</span>
              </h3>
              <span className="text-[11px] text-zinc-400">
                点击卡片可展开详细决策证据与假设关联
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {readiness.areas.map((area) => {
                const isExpanded = !!expandedAreaIds[area.areaId];
                const isEditing = editingAreaId === area.areaId;

                return (
                  <div
                    key={area.areaId}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      area.isSatisfied
                        ? 'bg-surface-card border-border-subtle shadow-elevation-card'
                        : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/50 shadow-2xs'
                    }`}
                  >
                    {/* Card Header Bar */}
                    <div className="p-3.5 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="pt-0.5 shrink-0">
                          {area.isSatisfied ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <AlertOctagon className="w-4 h-4 text-amber-500" />
                          )}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                              {area.title}
                            </span>
                            <span
                              className={`font-mono text-xs px-1.5 py-0.5 rounded font-medium ${
                                area.isSatisfied
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {area.isSatisfied ? '已闭环' : '待补充'}
                            </span>
                          </div>

                          {/* Primary Statement Preview */}
                          {area.isSatisfied && area.statement ? (
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-2">
                              {area.statement}
                            </p>
                          ) : !area.isSatisfied ? (
                            <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                              尚未确立该领域的核心决策。下方可一键采纳推荐方向或行内快速补齐。
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Right Action / Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        {area.isSatisfied && (area.evidenceStatements?.length || area.activeAssumptions?.length) && (
                          <button
                            type="button"
                            onClick={() => toggleAreaExpand(area.areaId)}
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            <span>{isExpanded ? '收起' : '展开证据'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        {!area.isSatisfied && (
                          <button
                            type="button"
                            onClick={() => jumpToFix({ tab: 'chat', sectionId: area.areaId })}
                            className="inline-flex items-center gap-0.5 text-[11px] text-orange-600 dark:text-orange-400 font-medium hover:underline cursor-pointer"
                            title={`前往对话完善 ${area.title}`}
                          >
                            <span>去对话补充</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Unsatisfied In-Line Quick Fix Box */}
                    {!area.isSatisfied && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-amber-200/50 dark:border-amber-900/30 space-y-2.5">
                        {/* Recommendation Callout */}
                        {area.recommendedFix && !isEditing && (
                          <div className="p-3 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800/60 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>AI 推荐决策方向</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAdoptRecommendation(area)}
                                  disabled={isSavingFix}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{isSavingFix ? '正在采纳...' : '一键采纳推荐'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAreaId(area.areaId);
                                    setCustomFixText(area.recommendedFix || '');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 font-medium text-[11px] transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>自定义修改</span>
                                </button>
                              </div>
                            </div>
                            <p className="text-amber-900 dark:text-amber-200/90 leading-relaxed font-medium">
                              {area.recommendedFix}
                            </p>
                            {area.recommendedFixReason && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                                理由: {area.recommendedFixReason}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Inline Custom Input Form */}
                        {isEditing && (
                          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 space-y-2">
                            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                              为【{area.title}】确立正式决策:
                            </label>
                            <textarea
                              value={customFixText}
                              onChange={(e) => setCustomFixText(e.target.value)}
                              placeholder={`例如：确立关于 ${area.title} 的首发轻量闭环规格...`}
                              rows={2}
                              className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingAreaId(null)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveCustomFix(area.areaId, area.title)}
                                disabled={!customFixText.trim() || isSavingFix}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                              >
                                <Check className="w-3 h-3" />
                                <span>{isSavingFix ? '正在保存...' : '保存决策并闭环'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expanded Evidence & Assumptions Drawer */}
                    {isExpanded && area.isSatisfied && (
                      <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2 text-xs">
                        {area.evidenceStatements && area.evidenceStatements.length > 0 && (
                          <div className="space-y-1">
                            <div className="font-semibold text-[11px] text-zinc-500 dark:text-zinc-400">
                              确立的决策证据 ({area.evidenceStatements.length}):
                            </div>
                            <ul className="space-y-1 pl-3 list-disc text-zinc-800 dark:text-zinc-200 text-xs">
                              {area.evidenceStatements.map((stmt, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {stmt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {area.activeAssumptions && area.activeAssumptions.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-zinc-200/40 dark:border-zinc-800/40">
                            <div className="font-semibold text-[11px] text-purple-600 dark:text-purple-400">
                              关联的活跃假设 ({area.activeAssumptions.length}):
                            </div>
                            <ul className="space-y-1 pl-3 list-disc text-purple-900 dark:text-purple-300 text-xs">
                              {area.activeAssumptions.map((asm, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {asm}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocking Issues & Warnings */}
          {readiness.blockingIssues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                <span>阻断性问题与硬性冲突 ({readiness.blockingIssues.length})</span>
              </h3>
              <div className="space-y-2">
                {readiness.blockingIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-900 dark:text-red-200">
                        {issue.id} · {issue.severity.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => jumpToFix({ tab: 'chat', questionId: issue.id, itemRef: (issue as any).targetRef })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-2xs"
                          title="前往对话解决或澄清该阻断性问题"
                        >
                          <span>前往澄清</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <label className="flex items-center gap-1.5 text-[11px] text-red-800 dark:text-red-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!acknowledgedIssues[issue.id]}
                            onChange={(e) =>
                              setAcknowledgedIssues((prev) => ({
                                ...prev,
                                [issue.id]: e.target.checked,
                              }))
                            }
                            className="rounded border-red-300 text-red-600 focus:ring-red-500"
                          />
                          <span>已知悉并承担此风险</span>
                        </label>
                      </div>
                    </div>
                    <p className="text-red-800 dark:text-red-300 text-[11px] leading-relaxed">
                      {issue.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Assumptions */}
          {readiness.activeAssumptions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                <span>生效中的技术假设 ({readiness.activeAssumptions.length})</span>
              </h3>
              <div className="space-y-2">
                {readiness.activeAssumptions.map((asm) => (
                  <div
                    key={asm.ref}
                    className="p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="text-zinc-900 dark:text-zinc-100 font-medium">
                        {asm.statement}
                      </div>
                      {asm.reason && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          依据: {asm.reason}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.5 rounded">
                        {asm.ref}
                      </span>
                      <button
                        type="button"
                        onClick={() => jumpToFix({ tab: 'chat', itemRef: asm.ref })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-300 dark:border-purple-800 transition-colors cursor-pointer"
                        title="在对话与全景中转为正式决策"
                      >
                        <span>转为决策</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Final Approval & Direct Document Navigation Bar */}
          <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-elevation-card space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-orange-500" />
                  <span>用户准入签署与规范文档交付 (Approval Gate)</span>
                </h3>
                <p className="text-xs text-text-muted">
                  一键授权后，系统将自动允许编译生成包括 AGENTS.md 在内的全部 8 份工程规范文档。
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedDispositions((prev) => !prev)}
                className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline cursor-pointer"
              >
                {showAdvancedDispositions ? '收起高级审批选项' : '展开高级审批模式'}
              </button>
            </div>

            {/* Optional Advanced Disposition Selector (Collapsed by default) */}
            {showAdvancedDispositions && (
              <div className="space-y-2 pt-1 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  高级：手动指定准入签署模式
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {(readiness.actions || []).filter((a) => a.disposition !== 'return-to-discovery').map((act) => {
                    const isSelected = selectedDisposition === act.disposition;
                    return (
                      <button
                        key={act.disposition}
                        type="button"
                        disabled={!act.enabled}
                        onClick={() => setSelectedDisposition(act.disposition)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          !act.enabled
                            ? 'opacity-40 bg-zinc-100/50 dark:bg-zinc-900/20 border-zinc-200/50 dark:border-zinc-800/50 cursor-not-allowed'
                            : isSelected
                            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 cursor-pointer shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 cursor-pointer'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span>{act.label}</span>
                          {!act.enabled && <Lock className="w-3 h-3 text-zinc-400" />}
                        </div>
                        <div className="text-xs opacity-80 mt-0.5 leading-snug">
                          {act.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Primary Action Button Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {canDirectlyApprove ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>准备度已达标，已智能匹配最佳准入模式 ({readiness.recommendedDisposition})</span>
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {readiness.approvalBlockers?.[0] || '尚有未闭环的核心领域，请在上方一键采纳建议或补充决策'}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {isFullyApproved ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents')}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    <span>前往规范文档中心</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApproveAndGenerate}
                    disabled={isApproving || !canDirectlyApprove}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all shadow-md ${
                      !canDirectlyApprove || isApproving
                        ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-98'
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>
                      {isApproving
                        ? '正在签署准入...'
                        : '🚀 签署准入并立即生成蓝图文档'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onReload={async () => {
          await refreshSnapshot();
          fetchReadiness();
        }}
        expectedRevision={stateRevision || undefined}
        serverRevision={snapshot?.metadata?.stateRevision || undefined}
      />
    </div>
  );
};
