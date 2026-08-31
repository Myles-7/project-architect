import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Compass,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { QuestionCard } from './QuestionCard.js';
import { QuestionWizard } from './QuestionWizard.js';
import { DiscoveryProgressTicker } from './DiscoveryProgressTicker.js';
import { DiscoveryResultCard } from './DiscoveryResultCard.js';
import { NextBestActionBanner } from './NextBestActionBanner.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type {
  QuestionRef,
  QuestionItem,
  TypedRef,
  DiscoveryProgressView,
} from '@project-architect/contracts';


export const ChatView: React.FC = () => {
  const {
    state,
    dispatch,
    apiClient,
    refreshSnapshot,
    scheduleDiscoveryJob,
    answerQuestionAsAssumption,
    setActiveTab,
  } = useProjectSession();
  const {
    snapshot,
    activeProjectId,
    stateRevision,
    discoveryJob,
    latestDiscoveryResult,
    latestDiscoveryDiagnostics,
    latestDiscoveryTimestamp,
  } = state;
  const { success, error } = useToast();

  const chatDraftKey = activeProjectId ? `pa:chat_draft:${activeProjectId}` : null;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(() => {
    if (chatDraftKey) {
      try {
        return !!localStorage.getItem(chatDraftKey);
      } catch {
        return false;
      }
    }
    return false;
  });
  const [inputMessage, setInputMessage] = useState(() => {
    if (chatDraftKey) {
      try {
        return localStorage.getItem(chatDraftKey) || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  // Auto persist chat draft
  useEffect(() => {
    if (chatDraftKey) {
      try {
        if (inputMessage) localStorage.setItem(chatDraftKey, inputMessage);
        else localStorage.removeItem(chatDraftKey);
      } catch {}
    }
  }, [chatDraftKey, inputMessage]);

  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isSchedulingDiscovery, setIsSchedulingDiscovery] = useState(false);
  const [submittingQuestionIds, setSubmittingQuestionIds] = useState<Set<string>>(new Set());
  const [dismissSelection, setDismissSelection] = useState<Set<string>>(new Set());
  const [isDismissing, setIsDismissing] = useState(false);
  const [viewMode, setViewMode] = useState<'wizard' | 'list'>('list');
  const [isAnsweredListExpanded, setIsAnsweredListExpanded] = useState(false);
  const [showOlderQuestions, setShowOlderQuestions] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState<DiscoveryProgressView | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setDiscoveryProgress(null);
      return;
    }
    let cancelled = false;
    apiClient.getDiscoveryProgress(activeProjectId)
      .then((res) => {
        if (!cancelled) setDiscoveryProgress(res.progress);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, stateRevision]);

  const answerQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestRevisionRef = useRef(stateRevision || 1);
  const questionsSectionRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToQuestions = () => {
    questionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    latestRevisionRef.current = stateRevision || 1;
  }, [stateRevision]);

  useEffect(() => {
    if (isSending) {
      scrollToBottom();
    }
  }, [isSending]);

  // --------------------------------------------------------------------------
  // Send Discovery Message (Pre-persist input then schedule job)
  // --------------------------------------------------------------------------

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeProjectId || ['queued', 'running'].includes(discoveryJob?.status || '')) return;

    const messageText = inputMessage.trim();
    const currentRev = stateRevision || 1;
    setLastError(null);

    try {
      // 1. Pre-persist user input to disk and get turnId
      const inputRes = await apiClient.recordDiscoveryInput(activeProjectId, {
        projectId: activeProjectId,
        text: messageText,
        expectedRevision: currentRev,
      });

      // Clear input and draft only AFTER successful persistence
      setInputMessage('');
      setHasRestoredDraft(false);
      if (chatDraftKey) {
        try {
          localStorage.removeItem(chatDraftKey);
        } catch {}
      }

      // Update state snapshot to latest revision
      if (inputRes.snapshot) {
        dispatch({ type: 'UPDATE_SNAPSHOT', payload: { snapshot: inputRes.snapshot } });
      }

      // 2. Schedule discovery job using turnId
      await scheduleDiscoveryJob(inputRes.snapshot.metadata.stateRevision, undefined, inputRes.turnId);
      success('构思输入已持久化并提交，AI 正在后台进行深度架构推演。', '后台推演已启动');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        const msg = err instanceof ApiClientError ? err.message : '启动后台推演失败，请检查服务日志。';
        setLastError(msg);
        error(msg, '推演中断');
      }
    }
  };

  // --------------------------------------------------------------------------
  // Question Action 1: Record Answer Only (POST /questions/answer)
  // --------------------------------------------------------------------------

  const persistQuestionAnswer = async (questionRef: QuestionRef, answer: string) => {
    if (!activeProjectId) throw new Error('No active project');
    const questionId = String(questionRef).replace(/^question:/, '');
    setSubmittingQuestionIds((current) => new Set(current).add(questionId));
    const operation = answerQueueRef.current.catch(() => undefined).then(async () => {
      const response = await apiClient.answerQuestion(activeProjectId, {
        projectId: activeProjectId,
        questionRef,
        answer,
        expectedRevision: latestRevisionRef.current,
      });
      latestRevisionRef.current = response.snapshot.metadata.stateRevision;
      setDismissSelection((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
      await refreshSnapshot();
      return response.snapshot.metadata.stateRevision;
    });
    answerQueueRef.current = operation.then(() => undefined, () => undefined);
    try {
      return await operation;
    } finally {
      setSubmittingQuestionIds((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
    }
  };

  const handleQuestionRecordAnswer = async (questionRef: QuestionRef, answer: string) => {
    setLastError(null);
    try {
      await persistQuestionAnswer(questionRef, answer);
      success(`已确立决策并记录 trace (${questionRef})`, '决策记录成功');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) setIsConflictModalOpen(true);
      else {
        const msg = err instanceof ApiClientError ? err.message : '记录回答失败';
        setLastError(msg);
        error(msg, '操作受阻');
      }
    }
  };

  const persistQuestionAssumption = async (
    questionRef: QuestionRef,
    assumptionStatement: string
  ) => {
    if (!activeProjectId) throw new Error('No active project');
    const questionId = String(questionRef).replace(/^question:/, '');
    setSubmittingQuestionIds((current) => new Set(current).add(questionId));
    const operation = answerQueueRef.current.catch(() => undefined).then(async () => {
      const nextRev = await answerQuestionAsAssumption(questionRef, assumptionStatement);
      latestRevisionRef.current = nextRev;
      setDismissSelection((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
      await refreshSnapshot();
      return nextRev;
    });
    answerQueueRef.current = operation.then(() => undefined, () => undefined);
    try {
      return await operation;
    } finally {
      setSubmittingQuestionIds((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
    }
  };

  const handleQuestionAnswerAsAssumption = async (
    questionRef: QuestionRef,
    assumptionStatement: string
  ) => {
    if (!activeProjectId) return;
    setLastError(null);
    try {
      await persistQuestionAssumption(questionRef, assumptionStatement);
      success(`已记录为活跃假设 (Assumption)，待后续验证`, '假设记录成功');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) setIsConflictModalOpen(true);
      else {
        const msg = err instanceof ApiClientError ? err.message : '记录假设失败';
        setLastError(msg);
        error(msg, '操作受阻');
      }
    }
  };

  // --------------------------------------------------------------------------
  // Question Action 2: Answer & Continue Discovery (POST /discovery)
  // --------------------------------------------------------------------------

  const handleQuestionAnswerAndDiscover = async (
    questionRef: QuestionRef,
    selectedOption?: string,
    freeInput?: string
  ) => {
    if (!activeProjectId) return;
    setLastError(null);

    try {
      const answer = freeInput?.trim() || selectedOption?.trim();
      if (!answer) return;
      const revision = await persistQuestionAnswer(questionRef, answer);
      await scheduleDiscoveryJob(revision);
      success('回答已保存，AI 正在后台生成下一组问题。', '后台推演已开始');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        const msg = err instanceof ApiClientError ? err.message : '保存回答或启动后台推演失败';
        setLastError(msg);
        error(msg, '推演中断');
      }
    }
  };

  const handleScheduleDiscovery = async () => {
    if (!activeProjectId || activeQuestions.length > 0 || isSchedulingDiscovery || ['queued', 'running'].includes(discoveryJob?.status || '')) return;
    setIsSchedulingDiscovery(true);
    try {
      const currentRev = snapshot?.metadata?.stateRevision ?? latestRevisionRef.current ?? stateRevision ?? 1;
      latestRevisionRef.current = currentRev;
      await scheduleDiscoveryJob(currentRev);
      success('AI 正在后台整理下一组建议；你可继续处理现有决策。', '后台整理已开始');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '无法启动后台整理', '操作受阻');
      }
    } finally {
      setIsSchedulingDiscovery(false);
    }
  };

  const handleDismissSelected = async () => {
    if (!activeProjectId || dismissSelection.size === 0 || isDismissing) return;
    setIsDismissing(true);
    try {
      await answerQueueRef.current;
      const response = await apiClient.dismissQuestions(activeProjectId, {
        projectId: activeProjectId,
        questionRefs: [...dismissSelection].map((id) => `question:${id}` as QuestionRef),
        expectedRevision: latestRevisionRef.current,
      });
      latestRevisionRef.current = response.snapshot.metadata.stateRevision;
      setDismissSelection(new Set());
      await refreshSnapshot();
      success('已跳过所选问题；未创建任何项目决策。', '问题已跳过');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) setIsConflictModalOpen(true);
      else error(err.message || '跳过问题失败', '操作受阻');
    } finally {
      setIsDismissing(false);
    }
  };

  const handleDismissSingleQuestion = async (questionRef: QuestionRef) => {
    if (!activeProjectId || isDismissing) return;
    setIsDismissing(true);
    try {
      await answerQueueRef.current;
      const response = await apiClient.dismissQuestions(activeProjectId, {
        projectId: activeProjectId,
        questionRefs: [questionRef],
        expectedRevision: latestRevisionRef.current,
      });
      latestRevisionRef.current = response.snapshot.metadata.stateRevision;
      await refreshSnapshot();
      success('已跳过本题；未创建任何项目决策。', '问题已跳过');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) setIsConflictModalOpen(true);
      else error(err.message || '跳过问题失败', '操作受阻');
    } finally {
      setIsDismissing(false);
    }
  };

  const findCandidateRef = (statement: string, decisionKey?: string): TypedRef | undefined => {
    const item = snapshot?.decisions?.items?.find(
      (d) =>
        d.status === 'candidate' &&
        ((decisionKey && d.decisionKey === decisionKey) || d.statement.trim().toLowerCase() === statement.trim().toLowerCase())
    );
    return item ? (`decision:${item.id}` as TypedRef) : undefined;
  };

  const findAssumptionRef = (statement: string, decisionKey?: string): TypedRef | undefined => {
    const item = snapshot?.assumptions?.items?.find(
      (a) =>
        a.status === 'active' &&
        ((decisionKey && a.decisionKey === decisionKey) || a.statement.trim().toLowerCase() === statement.trim().toLowerCase())
    );
    return item ? (`assumption:${item.id}` as TypedRef) : undefined;
  };

  const handleConfirmCandidateFromChat = async (candidateRef: TypedRef, _statement: string) => {
    if (!activeProjectId || isSending) return;
    const currentRev = stateRevision || 1;
    setIsSending(true);

    try {
      await apiClient.confirmDecision(activeProjectId, {
        projectId: activeProjectId,
        targetRef: candidateRef,
        expectedRevision: currentRev,
      });
      await refreshSnapshot();
      success('已采纳建议并确立为决策', '决策确立');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '采纳失败', '操作受阻');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmAssumptionFromChat = async (assumptionRef: TypedRef, _statement: string) => {
    if (!activeProjectId || isSending) return;
    const currentRev = stateRevision || 1;
    setIsSending(true);
    try {
      await apiClient.confirmDecision(activeProjectId, {
        projectId: activeProjectId,
        targetRef: assumptionRef,
        expectedRevision: currentRev,
      });
      await refreshSnapshot();
      success('已将技术假设转为正式决策', '决策确立');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '转为决策失败', '操作受阻');
      }
    } finally {
      setIsSending(false);
    }
  };

  // Questions to display
  const allQuestions: QuestionItem[] = snapshot?.questions?.items || [];
  let latestBatchId: string | null = null;
  const firstActiveQuestion = allQuestions.find((q) => (q.status === 'proposed' || q.status === 'shown') && q.batchId);
  if (firstActiveQuestion) {
    latestBatchId = firstActiveQuestion.batchId!;
  } else {
    const newestQuestion = allQuestions.find((q) => q.batchId);
    latestBatchId = newestQuestion?.batchId || null;
  }
  const currentBatchQuestions = latestBatchId
    ? allQuestions.filter((question) => question.batchId === latestBatchId && question.status !== 'superseded')
    : allQuestions.filter((question) => question.status !== 'superseded');
  const olderActiveQuestions = allQuestions.filter(
    (q) => (latestBatchId ? q.batchId !== latestBatchId : false) &&
           (q.status === 'proposed' || q.status === 'shown')
  );
  const activeQuestions = currentBatchQuestions.filter((q) => q.status === 'shown' || q.status === 'proposed');
  const answeredQuestions = currentBatchQuestions.filter((q) => q.status === 'answered');
  const visibleBatchQuestions = showOlderQuestions
    ? [...currentBatchQuestions.filter((q) => q.status !== 'dismissed'), ...olderActiveQuestions]
    : currentBatchQuestions.filter((q) => q.status !== 'dismissed');
  const currentBatchStage = currentBatchQuestions[0]?.batchStage || discoveryJob?.batchStage || 'initial';
  const currentBatchStageLabel = {
    initial: '初步探索',
    explore: '深入探索',
    converge: '方案收敛',
    readiness: '准备度审查',
    legacy: '历史问题',
  }[currentBatchStage] || '需求澄清';
  const isBackgroundDiscoveryActive = discoveryJob && ['queued', 'running'].includes(discoveryJob.status);

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={Compass}
        title="未载入项目"
        description="请在首页新建或打开已有项目以进入构思对话。"
        className="py-20"
      />
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col justify-between min-h-full pb-6 space-y-6">
      {/* Top Stream: Project Greeting / Idea Summary */}
      <div className="space-y-6">
        {/* Next Best Action Banner (Always visible anchor) */}
        <NextBestActionBanner
          snapshot={snapshot}
          progress={discoveryProgress}
          onFocusInput={() => chatInputRef.current?.focus()}
          onJumpToTab={(tab) => setActiveTab(tab)}
          onJumpToFirstUnanswered={scrollToQuestions}
        />

        {/* Latest Discovery Structured Breakdown & Comprehension Anchor */}
        {latestDiscoveryResult && (
          <DiscoveryResultCard
            discoveryResult={latestDiscoveryResult}
            timestamp={latestDiscoveryTimestamp || undefined}
            projectName={snapshot?.metadata?.name}
            diagnostics={latestDiscoveryDiagnostics || undefined}
            onConfirmCandidate={handleConfirmCandidateFromChat}
            onConfirmAssumption={handleConfirmAssumptionFromChat}
            findCandidateRef={findCandidateRef}
            findAssumptionRef={findAssumptionRef}
            onScrollToQuestions={visibleBatchQuestions.length > 0 ? scrollToQuestions : undefined}
          />
        )}

        {/* In-flight Discovery Dynamic Progress Ticker */}
        {(isBackgroundDiscoveryActive || isSending) && (
          <DiscoveryProgressTicker />
        )}

        {/* Discovery Job Status / Manual Trigger Banner when not running */}
        {!isBackgroundDiscoveryActive && !isSending && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start justify-between gap-4 ${
              discoveryJob?.status === 'stale'
                ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                : discoveryJob?.status === 'completed'
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <div className="space-y-1">
              <div className="font-semibold">
                {discoveryJob?.status === 'stale'
                  ? '上一轮后台整理已过期'
                  : discoveryJob?.status === 'completed'
                  ? '下一组建议与问题已就绪'
                  : '先确认回答，再按需要整理下一组问题'}
              </div>
              <div className="text-[11px] leading-relaxed opacity-80">
                {discoveryJob?.message || '确认回答会立即保存为项目决策，不必等待 AI。'}
                {(discoveryJob?.pendingAnswerCount || 0) > 0 && (
                  <span className="ml-1.5 font-medium">当前有 {discoveryJob?.pendingAnswerCount} 项待整理回答。</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleScheduleDiscovery}
              disabled={isSchedulingDiscovery || (discoveryProgress ? !discoveryProgress.canGenerateNextBatch : activeQuestions.length > 0)}
              title={
                discoveryProgress && !discoveryProgress.canGenerateNextBatch
                  ? '请先回答或明确跳过当前批次的所有问题，方可生成下一组'
                  : activeQuestions.length > 0
                  ? '请先回答或明确跳过当前批次的剩余问题'
                  : undefined
              }
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              {isSchedulingDiscovery
                ? '正在启动...'
                : discoveryJob?.status === 'stale'
                ? '重新整理'
                : (discoveryJob?.pendingAnswerCount || 0) > 0
                ? `整理 ${discoveryJob?.pendingAnswerCount} 项回答`
                : '生成下一组问题'}
            </button>
          </div>
        )}

        {/* Older Batches Recovery Entry */}
        {olderActiveQuestions.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs">
            <span>尚有 {olderActiveQuestions.length} 道更早批次的待处理问题。</span>
            <button
              type="button"
              onClick={() => setShowOlderQuestions((prev) => !prev)}
              className="font-semibold underline hover:no-underline cursor-pointer"
            >
              {showOlderQuestions ? '只看当前批次' : '展开旧批次问题'}
            </button>
          </div>
        )}

        {/* Questions Section Anchor: Wizard View vs List View */}
        {visibleBatchQuestions.length > 0 && (
          <div ref={questionsSectionRef} className="space-y-4 pt-2">
            {viewMode === 'wizard' ? (
              <QuestionWizard
                questions={visibleBatchQuestions}
                projectId={activeProjectId}
                onAnswerRecord={handleQuestionRecordAnswer}
                onAnswerAndDiscover={handleQuestionAnswerAndDiscover}
                onAnswerAsAssumption={handleQuestionAnswerAsAssumption}
                onSkipQuestion={handleDismissSingleQuestion}
                submittingQuestionIds={submittingQuestionIds}
                onSwitchToListMode={() => setViewMode('list')}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <HelpCircle className="w-4 h-4 text-orange-500" />
                    <span>{currentBatchStageLabel}问题集 (列表视图)</span>
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      {answeredQuestions.length}/{visibleBatchQuestions.length} 已回答 · {activeQuestions.length} 待处理
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {dismissSelection.size > 0 && (
                      <button
                        type="button"
                        onClick={handleDismissSelected}
                        disabled={isDismissing}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                      >
                        {isDismissing ? '正在跳过...' : `跳过所选 (${dismissSelection.size})`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewMode('wizard')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>切换为向导模式</span>
                    </button>
                  </div>
                </div>

                {activeQuestions.map((q, index) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    onAnswerRecord={handleQuestionRecordAnswer}
                    onAnswerAndDiscover={handleQuestionAnswerAndDiscover}
                    onAnswerAsAssumption={handleQuestionAnswerAsAssumption}
                    isSubmitting={submittingQuestionIds.has(q.id)}
                    defaultExpanded={index === 0}
                    isSelectedForDismiss={dismissSelection.has(q.id)}
                    onToggleDismiss={(questionId) =>
                      setDismissSelection((current) => {
                        const next = new Set(current);
                        if (next.has(questionId)) next.delete(questionId);
                        else next.add(questionId);
                        return next;
                      })
                    }
                  />
                ))}

                {/* Collapsible Answered Decisions Drawer */}
                {answeredQuestions.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAnsweredListExpanded(!isAnsweredListExpanded)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>已确立决策足迹 ({answeredQuestions.length} 项)</span>
                      </div>
                      {isAnsweredListExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                    {isAnsweredListExpanded && (
                      <div className="space-y-3 mt-3">
                        {answeredQuestions.map((q) => (
                          <QuestionCard
                            key={q.id}
                            question={q}
                            onAnswerRecord={handleQuestionRecordAnswer}
                            onAnswerAndDiscover={handleQuestionAnswerAndDiscover}
                            onAnswerAsAssumption={handleQuestionAnswerAsAssumption}
                            isSubmitting={submittingQuestionIds.has(q.id)}
                            defaultExpanded={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error / Retry Banner */}
        {lastError && (
          <div className="p-4 rounded-2xl bg-red-50/80 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <div className="font-semibold">推演分析受阻</div>
                <div className="text-red-700 dark:text-red-300 opacity-90">{lastError}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>重试推演</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Chat Input Box */}
      <div className="sticky bottom-0 pt-3 bg-[#FAF9F6] dark:bg-[#0C0D0F]">
        {hasRestoredDraft && inputMessage && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-900/60 text-xs text-orange-900 dark:text-orange-200 mb-2 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>已为您恢复上次未发送的构思输入草稿</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputMessage('');
                setHasRestoredDraft(false);
                if (chatDraftKey) {
                  try {
                    localStorage.removeItem(chatDraftKey);
                  } catch {}
                }
              }}
              className="text-[11px] underline hover:text-orange-800 dark:hover:text-orange-100 cursor-pointer"
            >
              清空草稿
            </button>
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="p-3 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-md space-y-2"
        >
          <textarea
            ref={chatInputRef}
            rows={3}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="描述新增的功能需求、架构约束或业务边界 (Ctrl+Enter 发送)..."
            disabled={isSending}
            className="w-full p-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 leading-relaxed resize-none"
          />

          <div className="flex items-center justify-between">
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              单轮结构化推演 · 严禁无授权自动写入
            </div>
            <button
              type="submit"
              disabled={isSending || !inputMessage.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl shadow transition-colors cursor-pointer"
            >
              <span>{isSending ? '推演中...' : '发送并推演'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onReload={async () => {
          await refreshSnapshot();
        }}
        expectedRevision={stateRevision || undefined}
        serverRevision={snapshot?.metadata?.stateRevision || undefined}
      />
    </div>
  );
};
