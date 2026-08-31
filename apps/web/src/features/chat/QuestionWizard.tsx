import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  List,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { QuestionCard } from './QuestionCard.js';

import type { QuestionItem, QuestionRef } from '@project-architect/contracts';

interface QuestionWizardProps {
  questions: QuestionItem[];
  projectId?: string;
  onAnswerRecord: (questionRef: QuestionRef, answer: string) => Promise<void>;
  onAnswerAndDiscover?: (
    questionRef: QuestionRef,
    selectedOption?: string,
    freeInput?: string
  ) => Promise<void>;
  onAnswerAsAssumption?: (
    questionRef: QuestionRef,
    assumptionStatement: string
  ) => Promise<void>;
  onSkipQuestion?: (questionRef: QuestionRef) => void;
  submittingQuestionIds: Set<string>;
  onSwitchToListMode: () => void;
}

export const QuestionWizard: React.FC<QuestionWizardProps> = ({
  questions,
  projectId,
  onAnswerRecord,
  onAnswerAndDiscover,
  onAnswerAsAssumption,
  onSkipQuestion,
  submittingQuestionIds,
  onSwitchToListMode,
}) => {
  const storageKey = projectId ? `pa:wizard_index:${projectId}` : null;
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    }
    return 0;
  });

  // Filter active questions
  const totalCount = questions.length;
  const answeredCount = questions.filter((q) => q.status === 'answered').length;
  const handledCount = questions.filter((q) =>
    q.status === 'answered' || q.status === 'dismissed' || q.status === 'superseded'
  ).length;
  const progressPercent = totalCount > 0 ? Math.round((handledCount / totalCount) * 100) : 0;

  // Persist index
  useEffect(() => {
    if (storageKey && currentIndex >= 0) {
      localStorage.setItem(storageKey, String(currentIndex));
    }
  }, [storageKey, currentIndex]);

  // Auto-focus first unanswered question on initial load if out of bound
  useEffect(() => {
    if (currentIndex >= questions.length && questions.length > 0) {
      setCurrentIndex(0);
    }
  }, [questions.length, currentIndex]);

  if (totalCount === 0) return null;

  const currentQuestion = questions[Math.min(currentIndex, totalCount - 1)] || questions[0];
  const isCurrentSubmitting = submittingQuestionIds.has(
    currentQuestion.id.replace(/^question:/, '')
  );

  const handleNext = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleThinkLater = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const prevUnanswered = questions.findIndex(
        (q) => q.status !== 'answered' && q.status !== 'superseded' && q.status !== 'dismissed'
      );
      if (prevUnanswered !== -1 && prevUnanswered !== currentIndex) {
        setCurrentIndex(prevUnanswered);
      }
    }
  };

  const handleDismissCurrent = () => {
    const cleanRef = (currentQuestion.id.startsWith('question:')
      ? currentQuestion.id
      : `question:${currentQuestion.id}`) as QuestionRef;
    onSkipQuestion?.(cleanRef);

    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const prevUnanswered = questions.findIndex(
        (q, idx) =>
          idx !== currentIndex &&
          q.status !== 'answered' &&
          q.status !== 'superseded' &&
          q.status !== 'dismissed'
      );
      if (prevUnanswered !== -1) {
        setCurrentIndex(prevUnanswered);
      }
    }
  };

  // Wrapped answer handlers that advance automatically
  const handleAnswerRecordWrapped = async (questionRef: QuestionRef, answer: string) => {
    await onAnswerRecord(questionRef, answer);
    const nextUnanswered = questions.findIndex(
      (q, idx) =>
        idx > currentIndex &&
        q.status !== 'answered' &&
        q.status !== 'superseded' &&
        q.status !== 'dismissed'
    );
    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered);
    } else if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleAnswerAsAssumptionWrapped = async (
    questionRef: QuestionRef,
    statement: string
  ) => {
    if (onAnswerAsAssumption) {
      await onAnswerAsAssumption(questionRef, statement);
      const nextUnanswered = questions.findIndex(
        (q, idx) =>
          idx > currentIndex &&
          q.status !== 'answered' &&
          q.status !== 'superseded' &&
          q.status !== 'dismissed'
      );
      if (nextUnanswered !== -1) {
        setCurrentIndex(nextUnanswered);
      } else if (currentIndex < totalCount - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    }
  };

  const handleAnswerAndDiscoverWrapped = async (
    questionRef: QuestionRef,
    selectedOption?: string,
    freeInput?: string
  ) => {
    if (onAnswerAndDiscover) {
      await onAnswerAndDiscover(questionRef, selectedOption, freeInput);
    }
  };

  return (
    <div className="space-y-4">
      {/* Wizard Header Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#15161A] border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>逐题模式</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300">
                  第 {currentIndex + 1} / {totalCount} 题
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                已处理 {handledCount} / {totalCount} 题，其中确认 {answeredCount} 项 ({progressPercent}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchToListMode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="切换为全量问题列表视图"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">列表视图</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Question Stepper Indicator Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {questions.map((q, idx) => {
            const isAnswered = q.status === 'answered';
            const isCurrent = idx === currentIndex;
            const isCritical = q.importance === 'critical';

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  isCurrent
                    ? 'bg-orange-600 text-white font-bold shadow-xs scale-105'
                    : isAnswered
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : isCritical
                    ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title={`跳转到问题: ${q.question}`}
              >
                {isAnswered ? <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                <span>#{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Card */}
      <div className="relative">
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          onAnswerRecord={handleAnswerRecordWrapped}
          onAnswerAndDiscover={handleAnswerAndDiscoverWrapped}
          onAnswerAsAssumption={handleAnswerAsAssumptionWrapped}
          isSubmitting={isCurrentSubmitting}
          defaultExpanded={true}
        />
      </div>

      {/* Footer Navigation Controls */}
      <div className="flex items-center justify-between px-2 pt-1">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>上一题</span>
        </button>

        <div className="flex items-center gap-2">
          {currentQuestion.status !== 'answered' && currentQuestion.status !== 'dismissed' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleThinkLater}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="暂时保留此题，稍后可返回重新思考与回答"
              >
                <span>稍后再想</span>
              </button>

              <button
                type="button"
                onClick={handleDismissCurrent}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-red-600/80 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                title="跳过此题并不再提问（状态持久化为 dismissed）"
              >
                <span>跳过本题</span>
              </button>
            </div>
          )}
          <span className="text-xs text-zinc-400 font-mono">
            {currentIndex + 1} / {totalCount}
          </span>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === totalCount - 1}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer"
        >
          <span>下一题</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Completed Questions Drawer in Current Batch */}
      {answeredCount > 0 && (
        <details className="mt-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden text-xs">
          <summary className="px-4 py-2.5 font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors select-none">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>本批已完成 {answeredCount} 项决策</span>
            </div>
            <span className="text-[11px] text-zinc-400">点击展开 / 收起</span>
          </summary>
          <div className="p-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2 bg-white/60 dark:bg-[#15161A]/60">
            {questions
              .filter((q) => q.status === 'answered')
              .map((q) => (
                <div
                  key={q.id}
                  className="p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{q.question}</div>
                    <div className="text-zinc-600 dark:text-zinc-400">确认答案：{q.answer}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = questions.findIndex((item) => item.id === q.id);
                      if (idx !== -1) setCurrentIndex(idx);
                    }}
                    className="shrink-0 text-orange-600 dark:text-orange-400 hover:underline text-[11px] cursor-pointer"
                  >
                    查看详情
                  </button>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
};
