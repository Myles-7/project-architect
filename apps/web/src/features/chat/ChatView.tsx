import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Compass,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { QuestionCard } from './QuestionCard.js';
import { DiscoveryResultCard } from './DiscoveryResultCard.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type {
  QuestionRef,
  DiscoveryResult,
  QuestionItem,
} from '@project-architect/contracts';

export const ChatView: React.FC = () => {
  const { state, apiClient, refreshSnapshot } = useProjectSession();
  const { snapshot, activeProjectId, stateRevision } = state;
  const { success, error } = useToast();

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Latest Discovery Turn Structured Output
  const [latestDiscoveryResult, setLatestDiscoveryResult] = useState<{
    result: DiscoveryResult;
    timestamp: string;
    diagnostics?: { durationMs?: number; totalTokens?: number | 'unavailable' };
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [latestDiscoveryResult, snapshot?.questions?.items]);

  // --------------------------------------------------------------------------
  // Send Discovery Message (Single Provider Call)
  // --------------------------------------------------------------------------

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending || !activeProjectId) return;

    const messageText = inputMessage.trim();
    const currentRev = stateRevision || 1;

    setIsSending(true);
    setLastError(null);

    try {
      const res = await apiClient.runDiscoveryTurn(activeProjectId, {
        projectId: activeProjectId,
        userMessage: messageText,
        expectedRevision: currentRev,
      });

      // Clear draft ONLY on success
      setInputMessage('');

      // Store structured discovery output
      setLatestDiscoveryResult({
        result: res.discoveryResult,
        timestamp: new Date().toLocaleTimeString(),
        diagnostics: res.diagnostics,
      });

      // Update state
      await refreshSnapshot();
      success('AI 结构化推演完成，已提炼核心决策与待决问题', '推演完成');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        const msg = err instanceof ApiClientError ? err.message : '推演分析请求失败，请检查服务日志。';
        setLastError(msg);
        error(msg, '推演中断');
      }
    } finally {
      setIsSending(false);
    }
  };

  // --------------------------------------------------------------------------
  // Question Action 1: Record Answer Only (POST /questions/answer)
  // --------------------------------------------------------------------------

  const handleQuestionRecordAnswer = async (questionRef: QuestionRef, answer: string) => {
    if (!activeProjectId || isSending) return;
    const currentRev = stateRevision || 1;

    setIsSending(true);
    setLastError(null);

    try {
      await apiClient.answerQuestion(activeProjectId, {
        projectId: activeProjectId,
        questionRef,
        answer,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      success(`已确立决策并记录 trace (${questionRef})`, '决策记录成功');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        const msg = err instanceof ApiClientError ? err.message : '记录回答失败';
        setLastError(msg);
        error(msg, '操作受阻');
      }
    } finally {
      setIsSending(false);
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
    if (!activeProjectId || isSending) return;
    const currentRev = stateRevision || 1;

    setIsSending(true);
    setLastError(null);

    try {
      const res = await apiClient.runDiscoveryTurn(activeProjectId, {
        projectId: activeProjectId,
        questionAnswer: {
          questionRef,
          selectedOption,
          freeInput,
        },
        expectedRevision: currentRev,
      });

      setLatestDiscoveryResult({
        result: res.discoveryResult,
        timestamp: new Date().toLocaleTimeString(),
        diagnostics: res.diagnostics,
      });

      await refreshSnapshot();
      success('已融合回答并完成下一轮蓝图推演', '推演推进');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        const msg = err instanceof ApiClientError ? err.message : '回答并推演失败';
        setLastError(msg);
        error(msg, '推演中断');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmCandidateFromChat = async (candidateText: string) => {
    if (!activeProjectId || isSending) return;
    const currentRev = stateRevision || 1;
    setIsSending(true);
    try {
      // Add explicit user decision for candidate
      await apiClient.editOverviewItem(activeProjectId, {
        projectId: activeProjectId,
        sectionId: 'mvp_scope',
        newStatement: candidateText,
        expectedRevision: currentRev,
      });
      await refreshSnapshot();
      success('已采纳建议并写入项目决策', '决策确立');
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

  // Questions to display
  const allQuestions: QuestionItem[] = snapshot?.questions?.items || [];
  const activeQuestions = allQuestions.filter((q) => q.status === 'shown' || q.status === 'proposed');
  const answeredQuestions = allQuestions.filter((q) => q.status === 'answered');

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
        {/* Project Initial Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>项目初始构思：{snapshot?.metadata?.name}</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {snapshot?.metadata?.inputRefs?.[0]?.summary ||
              '项目已建立。你可随时在下方输入新的业务诉求或回答右侧/下方的关键澄清问题。'}
          </p>
        </div>

        {/* Latest Discovery Structured Breakdown */}
        {latestDiscoveryResult && (
          <DiscoveryResultCard
            discoveryResult={latestDiscoveryResult.result}
            timestamp={latestDiscoveryResult.timestamp}
            diagnostics={latestDiscoveryResult.diagnostics}
            onConfirmCandidate={handleConfirmCandidateFromChat}
          />
        )}

        {/* Active Questions Stream (Interactive Question Cards) */}
        {activeQuestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <HelpCircle className="w-4 h-4 text-orange-500" />
              <span>待决关键澄清问题 ({activeQuestions.length})</span>
            </div>
            {activeQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                onAnswerRecord={handleQuestionRecordAnswer}
                onAnswerAndDiscover={handleQuestionAnswerAndDiscover}
                isSubmitting={isSending}
              />
            ))}
          </div>
        )}

        {/* In-flight Loading Indicator */}
        {isSending && (
          <div className="p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 flex items-center gap-3 text-xs text-orange-900 dark:text-orange-200 animate-pulse">
            <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-400 animate-spin shrink-0" />
            <div>
              <div className="font-semibold">正在分析项目定义并推演蓝图...</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                执行单次深度推演，抽取决策候选、假设、缺口与核心风险
              </div>
            </div>
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

        {/* Answered Questions History */}
        {answeredQuestions.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>已确立的历史决策问答 ({answeredQuestions.length})</span>
            </div>
            {answeredQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                onAnswerRecord={handleQuestionRecordAnswer}
                onAnswerAndDiscover={handleQuestionAnswerAndDiscover}
                isSubmitting={false}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Chat Input Box */}
      <div className="sticky bottom-0 pt-3 bg-[#FAF9F6] dark:bg-[#0C0D0F]">
        <form
          onSubmit={handleSendMessage}
          className="p-3 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-md space-y-2"
        >
          <textarea
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
