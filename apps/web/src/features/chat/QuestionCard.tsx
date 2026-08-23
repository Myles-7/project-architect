import React, { useState } from 'react';
import {
  Check,
  ArrowRight,
  HelpCircle,
  Sparkles,
  BookmarkCheck,
} from 'lucide-react';
import type { QuestionItem, QuestionRef } from '@project-architect/contracts';

interface QuestionCardProps {
  question: QuestionItem;
  onAnswerRecord: (questionRef: QuestionRef, answer: string) => Promise<void>;
  onAnswerAndDiscover: (
    questionRef: QuestionRef,
    selectedOption?: string,
    freeInput?: string
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswerRecord,
  onAnswerAndDiscover,
  isSubmitting = false,
}) => {
  const isAnswered = question.status === 'answered';
  const isSuperseded = question.status === 'superseded' || question.status === 'dismissed';

  const defaultOption = question.options?.[0]?.label || '';
  const [selectedOption, setSelectedOption] = useState<string>(
    question.recommendation || defaultOption
  );
  const [freeInput, setFreeInput] = useState<string>(question.answer || '');

  const handleSelectOption = (optLabel: string) => {
    if (isAnswered || isSuperseded) return;
    setSelectedOption(optLabel);
  };

  const getFinalAnswerText = () => {
    if (freeInput.trim()) {
      return freeInput.trim();
    }
    return selectedOption;
  };

  const handleRecordOnly = async () => {
    const finalAnswer = getFinalAnswerText();
    if (!finalAnswer || isSubmitting || isAnswered || isSuperseded) return;
    const cleanRef = (question.id.startsWith('question:') ? question.id : `question:${question.id}`) as QuestionRef;
    await onAnswerRecord(cleanRef, finalAnswer);
  };

  const handleAnswerAndDiscover = async () => {
    const finalAnswer = getFinalAnswerText();
    if (!finalAnswer || isSubmitting || isAnswered || isSuperseded) return;
    const cleanRef = (question.id.startsWith('question:') ? question.id : `question:${question.id}`) as QuestionRef;
    await onAnswerAndDiscover(cleanRef, selectedOption, freeInput.trim() || undefined);
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        isAnswered
          ? 'border-emerald-300 dark:border-emerald-900/60 bg-white dark:bg-[#121316]'
          : isSuperseded
          ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 opacity-75'
          : 'border-orange-400/90 dark:border-orange-700/80 bg-white dark:bg-[#121316] shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 bg-zinc-50/80 dark:bg-[#15161A]/80 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                question.importance === 'critical'
                  ? 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : question.importance === 'high'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {question.importance} 关键决策
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              {question.id} {question.issueRef && `· ${question.issueRef}`}
            </span>
          </div>

          {isAnswered && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
              <Check className="w-3.5 h-3.5" />
              <span>已回答并确立决策</span>
            </span>
          )}
          {isSuperseded && (
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              已由新推演替换
            </span>
          )}
        </div>

        <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
          {question.question}
        </h3>
      </div>

      {/* Decision Rationale & Recommendation */}
      <div className="p-4 sm:p-5 bg-zinc-50/40 dark:bg-[#141519]/40 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2.5 text-xs">
        {question.reason && (
          <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
            <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">为什么现在必须明确：</strong>
              <span className="ml-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">{question.reason}</span>
            </div>
          </div>
        )}

        {question.recommendation && (
          <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">推荐方向：</strong>
              <span className="font-mono text-orange-700 dark:text-orange-300 font-semibold mx-1">
                {question.recommendation}
              </span>
              {question.recommendationReason && (
                <span className="text-zinc-500 dark:text-zinc-400">({question.recommendationReason})</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Answer Body */}
      {isAnswered ? (
        <div className="p-4 sm:p-5 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-1.5">
          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            用户确立的回答
          </div>
          <div className="text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed font-medium bg-white dark:bg-[#17181D] p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
            {question.answer}
          </div>
        </div>
      ) : isSuperseded ? (
        <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
          该问题已被后续对话确立的决策替代。
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Options Grid */}
          {question.options && question.options.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                预设决策选项
              </label>
              <div className="grid grid-cols-1 gap-2">
                {question.options.map((opt) => {
                  const isSelected = selectedOption === opt.label;
                  return (
                    <div
                      key={opt.label}
                      onClick={() => handleSelectOption(opt.label)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-600'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span>{opt.label}</span>
                        </div>
                        {opt.impact && (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-5.5 leading-relaxed">
                            {opt.impact}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Free Input Option */}
          <div className="space-y-1.5">
            <label htmlFor={`free-input-${question.id}`} className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              自定义补充或改写回答 (可选)
            </label>
            <input
              id={`free-input-${question.id}`}
              type="text"
              value={freeInput}
              onChange={(e) => setFreeInput(e.target.value)}
              placeholder="如有特殊考量，可在此直接输入你的决策陈述..."
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              单题深度决策 · 严格记录确认轨迹
            </div>
            <div className="flex items-center gap-2">
              {/* Button 1: Record only */}
              <button
                type="button"
                onClick={handleRecordOnly}
                disabled={isSubmitting || !getFinalAnswerText()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
                title="只记录为 Confirmed 决策，不触发新的 AI 分析"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-zinc-500" />
                <span>仅记录为决策</span>
              </button>

              {/* Button 2: Answer and discover */}
              <button
                type="button"
                onClick={handleAnswerAndDiscover}
                disabled={isSubmitting || !getFinalAnswerText()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                title="记录决策并立即触发单次 Discovery Turn"
              >
                <span>{isSubmitting ? '正在推演...' : '回答并推演下一轮'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
