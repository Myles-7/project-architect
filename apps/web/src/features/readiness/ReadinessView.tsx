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
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { CardSkeleton } from '../../components/common/LoadingSkeleton.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type {
  ReadinessView as ReadinessViewModel,
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

  // Approval Form State
  const [selectedDisposition, setSelectedDisposition] = useState<UserDisposition>('approved');
  const [acknowledgedIssues, setAcknowledgedIssues] = useState<Record<string, boolean>>({});

  const fetchReadiness = useCallback(async () => {
    if (!activeProjectId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getProjectReadiness(activeProjectId);
      setReadiness(data);
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

  // --------------------------------------------------------------------------
  // Action 1: Run Readiness Review (POST /readiness/review)
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
      success('准备度评估完成，已更新各领域闭环分级', '评估完成');
    } catch (err: any) {
      error(err.message || '执行准备度评估失败', '评估中断');
    } finally {
      setIsReviewing(false);
    }
  };

  // --------------------------------------------------------------------------
  // Action 2: Approve Readiness (POST /readiness/approve)
  // --------------------------------------------------------------------------

  const handleApprove = async () => {
    if (!activeProjectId || isApproving) return;
    const currentRev = stateRevision || 1;

    const ackRefs = Object.entries(acknowledgedIssues)
      .filter(([, isAck]) => isAck)
      .map(([id]) => id as TypedRef);

    setIsApproving(true);
    try {
      await apiClient.approveReadiness(activeProjectId, {
        projectId: activeProjectId,
        disposition: selectedDisposition,
        acknowledgedIssueRefs: ackRefs.length > 0 ? ackRefs : undefined,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      await fetchReadiness();
      success('已完成准备度用户最终批准，准入已就绪', '批准生效');
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
            评估 8 大核心领域决策闭合度，向 Coding Agent 交付前进行用户最终授权
          </p>
        </div>

        <button
          onClick={handleRunReview}
          disabled={isReviewing || isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReviewing ? 'animate-spin' : ''}`} />
          <span>{isReviewing ? '正在评估...' : '执行准备度评估'}</span>
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
          title="尚未执行准备度评估"
          description="点击右上角“执行准备度评估”以分析当前项目蓝图的完备性等级 (Level 1~5)。"
          actionLabel="立即执行评估"
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
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
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
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    可信度得分: {readiness.credibilityScore ?? readiness.score} / 100
                  </span>
                  <span className="text-xs text-zinc-400">
                    · 领域覆盖: {readiness.coverage ? `${readiness.coverage.satisfied}/${readiness.coverage.total}` : '8/8'}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {readiness.status === 'ready'
                    ? '核心领域决策已全部闭环，无阻断性缺口，具备向 Coding Agent 交付条件。'
                    : readiness.status === 'ready-with-warnings'
                    ? '核心决策已就绪，但存在非阻断性警告或假设，可在文档中附带风险说明直接开工。'
                    : '存在 High/Critical 待决缺口或未解决的分歧，建议先在对话中完成澄清。'}
                </p>
              </div>

              {/* Disposition Badge */}
              <div className="text-right shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    isApproved
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>用户授权: {readiness.userDisposition}</span>
                </span>
              </div>
            </div>

            {/* Stale Warning Banner */}
            {readiness.isStale && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>准备度评估已失效 (Stale)</strong>：当前评估基于 rev.{readiness.basisRevision}，而项目状态已变更为 rev.{readiness.currentRevision}。任何新决策或缺口变动均需重新评估后方可授权。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRunReview}
                  disabled={isReviewing}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium shrink-0 cursor-pointer text-xs"
                >
                  {isReviewing ? '正在评估...' : '重新评估'}
                </button>
              </div>
            )}
          </div>

          {/* 8 Core Required Areas Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              核心领域闭环检查 ({readiness.areas.filter((a) => a.isSatisfied).length}/{readiness.areas.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {readiness.areas.map((area) => (
                <div
                  key={area.areaId}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    area.isSatisfied
                      ? 'bg-white dark:bg-[#17181D] border-zinc-200/80 dark:border-zinc-800/80'
                      : 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {area.isSatisfied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {area.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        area.isSatisfied
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {area.isSatisfied ? '已闭环' : '待补充'}
                    </span>
                    {!area.isSatisfied && (
                      <button
                        type="button"
                        onClick={() => jumpToFix({ tab: 'chat', sectionId: area.areaId })}
                        className="inline-flex items-center gap-0.5 text-[11px] text-orange-600 dark:text-orange-400 font-medium hover:underline cursor-pointer"
                        title={`前往完善 ${area.title}`}
                      >
                        <span>去完善</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
                <span>生效中的假设 ({readiness.activeAssumptions.length})</span>
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
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          依据: {asm.reason}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.2 rounded">
                        {asm.ref}
                      </span>
                      <button
                        type="button"
                        onClick={() => jumpToFix({ tab: 'chat', itemRef: asm.ref })}
                        className="inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-[10px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-300 dark:border-purple-800 transition-colors cursor-pointer"
                        title="在 Overview 中查看并转为正式决策"
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


          {/* User Final Approval Section (郑重的最终授权) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-orange-500" />
                  <span>用户最终准入签署与授权 (User Approval Gate)</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  作为项目的唯一事实授权人，签署后系统将允许编译生成完整工程蓝图。
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                选择准入签署结论 (Disposition)
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
                      title={act.blockedReasons.join('; ')}
                    >
                      <div className="font-semibold flex items-center justify-between">
                        <span>{act.label}</span>
                        {!act.enabled && <Lock className="w-3 h-3 text-zinc-400" />}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5 leading-snug">
                        {act.description}
                      </div>
                      {act.blockedReasons.length > 0 && (
                        <div className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 leading-tight">
                          {act.blockedReasons[0]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-400">
                {readiness.isStale
                  ? '当前评估已失效，请先点击顶部“重新评估”后再签署。'
                  : readiness.canGenerateDocs
                  ? '已具备文档生成条件，签署后可直接生成蓝图。'
                  : '请先完成核心领域决策或按需确认阻断缺陷后再签署。'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || readiness.isStale}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-colors shadow-xs ${
                    isApproving || readiness.isStale
                      ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>
                    {isApproving
                      ? '正在签署...'
                      : readiness.isStale
                      ? '评估已过期不可签署'
                      : '签署准入批准'}
                  </span>
                </button>

                {readiness.canGenerateDocs && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <span>前往生成规范文档</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
