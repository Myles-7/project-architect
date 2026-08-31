import React, { useState } from 'react';
import {
  Check,
  HelpCircle,
  Sparkles,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { QuestionItem, QuestionRef } from '@project-architect/contracts';

interface QuestionCardProps {
  question: QuestionItem;
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
  isSubmitting?: boolean;
  defaultExpanded?: boolean;
  isSelectedForDismiss?: boolean;
  onToggleDismiss?: (questionId: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswerRecord,
  onAnswerAndDiscover,
  onAnswerAsAssumption,
  isSubmitting = false,
  defaultExpanded = false,
  isSelectedForDismiss = false,
  onToggleDismiss,
}) => {
  const isAnswered = question.status === 'answered';
  const isDismissed = question.status === 'dismissed';
  const isSuperseded = question.status === 'superseded' || isDismissed;
  const inputId = React.useId();
  const importanceLabel = question.importance === 'critical'
    ? '必须明确'
    : question.importance === 'high'
      ? '优先明确'
      : '建议明确';

  const draftKey = `pa:q_draft:${question.id}`;
  const [selectedOption, setSelectedOption] = useState<string | null>(() => {
    if (question.status === 'answered') return null;
    try {
      return localStorage.getItem(`${draftKey}:opt`) || null;
    } catch {
      return null;
    }
  });
  const [freeInput, setFreeInput] = useState<string>(() => {
    if (question.answer) return question.answer;
    try {
      return localStorage.getItem(`${draftKey}:input`) || '';
    } catch {
      return '';
    }
  });
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-persist draft
  React.useEffect(() => {
    if (!isAnswered && !isSuperseded) {
      try {
        if (selectedOption) localStorage.setItem(`${draftKey}:opt`, selectedOption);
        else localStorage.removeItem(`${draftKey}:opt`);
      } catch {}
    }
  }, [draftKey, selectedOption, isAnswered, isSuperseded]);

  React.useEffect(() => {
    if (!isAnswered && !isSuperseded) {
      try {
        if (freeInput) localStorage.setItem(`${draftKey}:input`, freeInput);
        else localStorage.removeItem(`${draftKey}:input`);
      } catch {}
    }
  }, [draftKey, freeInput, isAnswered, isSuperseded]);

  React.useEffect(() => {
    if (isAnswered) {
      try {
        localStorage.removeItem(`${draftKey}:opt`);
        localStorage.removeItem(`${draftKey}:input`);
      } catch {}
    }
  }, [isAnswered, draftKey]);

  const handleSelectOption = (optLabel: string) => {
    if (isAnswered || isSuperseded) return;
    setSelectedOption(optLabel);
  };

  const getFinalAnswerText = (): string => {
    if (freeInput.trim()) {
      return freeInput.trim();
    }
    return selectedOption || '';
  };

  const handleRecordOnly = async () => {
    const finalAnswer = getFinalAnswerText();
    if (!finalAnswer || isSubmitting || isAnswered || isSuperseded) return;
    const cleanRef = (question.id.startsWith('question:') ? question.id : `question:${question.id}`) as QuestionRef;
    await onAnswerRecord(cleanRef, finalAnswer);
  };

  const handleAnswerAndDiscover = async () => {
    const finalAnswer = getFinalAnswerText();
    if (!finalAnswer || !onAnswerAndDiscover || isSubmitting || isAnswered || isSuperseded) return;
    const cleanRef = (question.id.startsWith('question:') ? question.id : `question:${question.id}`) as QuestionRef;
    await onAnswerAndDiscover(
      cleanRef,
      selectedOption || undefined,
      freeInput.trim() || undefined
    );
  };

  const handleSaveAsAssumption = async () => {
    const finalAnswer = getFinalAnswerText();
    if (!finalAnswer || isSubmitting || isAnswered || isSuperseded) return;
    const cleanRef = (question.id.startsWith('question:') ? question.id : `question:${question.id}`) as QuestionRef;
    if (onAnswerAsAssumption) {
      await onAnswerAsAssumption(cleanRef, finalAnswer);
    }
  };

  const recommendedOption = question.options?.find(
    (opt) => opt.key === question.recommendedOptionKey || opt.label === question.recommendation
  ) || question.options?.[0];

  const handleAdoptRecommendation = () => {
    if (!recommendedOption || isSubmitting || isAnswered || isSuperseded) return;
    setSelectedOption(recommendedOption.label);
    setIsExpanded(true);
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {!isAnswered && !isSuperseded && onToggleDismiss && (
              <input
                type="checkbox"
                checked={isSelectedForDismiss}
                onChange={() => onToggleDismiss(question.id)}
                aria-label={`选择跳过问题 ${question.question}`}
                className="w-3.5 h-3.5 accent-orange-600 cursor-pointer"
              />
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                question.importance === 'critical'
                  ? 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : question.importance === 'high'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {importanceLabel}
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">当前批次问题</span>
          </div>

          <div className="flex items-center gap-2">
            {!isAnswered && !isSuperseded && recommendedOption && (
              <button
                type="button"
                onClick={handleAdoptRecommendation}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/80 dark:hover:bg-orange-900 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800 transition-all cursor-pointer shadow-xs"
                title={`选中推荐选项: ${recommendedOption.label}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span>采纳推荐: {recommendedOption.label}</span>
              </button>
            )}

            {isAnswered && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                <Check className="w-3.5 h-3.5" />
                <span>已确立决策</span>
              </span>
            )}
            {isSuperseded && (
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {isDismissed ? '已跳过' : '已由新推演替换'}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
          {question.question}
        </h3>
        {!isAnswered && !isSuperseded && (
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 dark:text-orange-300 cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {isExpanded ? '收起回答区' : '展开回答与详情'}
          </button>
        )}
      </div>

      {/* Answered Decision Banner */}
      {isAnswered && (
        <div className="p-4 sm:p-5 bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 flex items-start gap-2.5 text-xs">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200">已确认决策：</span>
            <div className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              {question.answer || selectedOption || '已确认并沉淀为项目决策'}
            </div>
          </div>
        </div>
      )}

      {/* Decision Rationale & Recommendation */}
      {isExpanded && !isAnswered && !isSuperseded && <div className="p-4 sm:p-5 bg-zinc-50/40 dark:bg-[#141519]/40 border-b border-zinc-200 dark:border-zinc-800/80 space-y-2.5 text-xs">

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
      </div>}

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
          {isDismissed ? '你已明确跳过此问题，不会生成决策。' : '该问题已被后续对话确立的决策替代。'}
        </div>
      ) : !isExpanded ? null : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Options Grid */}
          {question.options && question.options.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                可选方向
              </label>
              <div role="radiogroup" aria-label="可选方向" className="grid grid-cols-1 gap-2">
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOption === opt.label;
                  return (
                    <div
                      key={opt.key || opt.label}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected || (!selectedOption && idx === 0) ? 0 : -1}
                      onClick={() => handleSelectOption(opt.label)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectOption(opt.label);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const nextIdx = (idx + 1) % question.options.length;
                          handleSelectOption(question.options[nextIdx]!.label);
                          e.currentTarget.parentElement
                            ?.querySelectorAll<HTMLElement>('[role="radio"]')[nextIdx]
                            ?.focus();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prevIdx = (idx - 1 + question.options.length) % question.options.length;
                          handleSelectOption(question.options[prevIdx]!.label);
                          e.currentTarget.parentElement
                            ?.querySelectorAll<HTMLElement>('[role="radio"]')[prevIdx]
                            ?.focus();
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-orange-600 bg-orange-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-600'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span>{opt.label}</span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                              已选中
                            </span>
                          )}
                          {opt.reversibility && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                                opt.reversibility === 'easy'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : opt.reversibility === 'hard'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {opt.reversibility === 'easy'
                                ? '易修改'
                                : opt.reversibility === 'hard'
                                ? '高锁定风险'
                                : '中等修改成本'}
                            </span>
                          )}
                        </div>

                        {/* Four-dimensional impacts: Gain, Sacrifice, Impact, Tradeoffs */}
                        {(opt.gain || opt.sacrifice || opt.impact || opt.tradeoffs) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] pt-1 pl-5.5 leading-relaxed">
                            {opt.gain && (
                              <div className="text-emerald-700 dark:text-emerald-400">
                                <span className="font-semibold">收益：</span>
                                <span>{opt.gain}</span>
                              </div>
                            )}
                            {opt.sacrifice && (
                              <div className="text-amber-700 dark:text-amber-400">
                                <span className="font-semibold">代价：</span>
                                <span>{opt.sacrifice}</span>
                              </div>
                            )}
                            {opt.tradeoffs && (
                              <div className="text-zinc-600 dark:text-zinc-300 col-span-full">
                                <span className="font-semibold">权衡：</span>
                                <span>{opt.tradeoffs}</span>
                              </div>
                            )}
                            {opt.impact && (
                              <div className="text-zinc-500 dark:text-zinc-400 col-span-full">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">影响：</span>
                                <span>{opt.impact}</span>
                              </div>
                            )}
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
            <div className="flex items-center justify-between">
              <label htmlFor={inputId} className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {question.options && question.options.length > 0 ? '自定义补充或改写回答 (可选)' : '输入你的具体决策陈述'}
              </label>
              {question.recommendation && !freeInput && (
                <button
                  type="button"
                  onClick={() => setFreeInput(question.recommendation || '')}
                  className="text-[11px] text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                  title="将上方推荐方向一键填入输入框"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>填入推荐建议</span>
                </button>
              )}
            </div>
            <input
              id={inputId}
              type="text"
              value={freeInput}
              onChange={(e) => setFreeInput(e.target.value)}
              placeholder={
                question.area === 'target_user'
                  ? '例如：首发版本仅供我们两个人私密使用，无需多用户注册或外部社交体系...'
                  : question.area === 'mvp_scope'
                  ? '例如：首发仅做虚拟同居室与动作实时同步，把日记和同步观影等延后到二期...'
                  : question.area === 'core_features'
                  ? '例如：优先实现点击吃饭/睡觉动作同步，自定义装扮先提供基础预设...'
                  : question.area === 'user_flows'
                  ? '例如：打开网页即直接进入双人房间，通过轻量状态栏一键切换当前状态...'
                  : question.area === 'page_structure'
                  ? '例如：单屏沉浸展示主房间，装扮和设置收纳在右侧抽屉弹层中...'
                  : question.area === 'ux_ui_direction'
                  ? '例如：采用像素风/温馨可爱的治愈系色调，配合轻量微动效...'
                  : question.area === 'technical_boundary'
                  ? '例如：采用轻量 WebSocket 实现实时状态同步，数据存储在本地或简单单机后端...'
                  : question.area === 'delivery_plan'
                  ? '例如：双人能在不同电脑上正常登录房间并看到对方实时动作即算首期交付...'
                  : '如有特殊考量，可在此直接输入你的具体决策陈述...'
              }
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              当前批次 · 回答即时生效
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Secondary Path: Save as Assumption (uncertain / provisional) */}
              <button
                type="button"
                onClick={handleSaveAsAssumption}
                disabled={isSubmitting || !getFinalAnswerText()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300/80 dark:border-amber-800 disabled:opacity-40 transition-colors cursor-pointer"
                title="存为活跃假设 (Assumption)，后续随时可推翻，不作为不可修改的决策"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>存为待验证假设</span>
              </button>

              {onAnswerAndDiscover && (
                <button
                  type="button"
                  onClick={handleAnswerAndDiscover}
                  disabled={isSubmitting || !getFinalAnswerText()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-orange-700 dark:text-orange-300 bg-white dark:bg-zinc-900 hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-orange-300 dark:border-orange-800 disabled:opacity-40 transition-colors cursor-pointer"
                  title="先立即保存当前回答，再在后台整理并生成下一批问题"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>立即推演</span>
                </button>
              )}

              {/* Primary Path: Confirm as user-authorized decision */}
              <button
                type="button"
                onClick={handleRecordOnly}
                disabled={isSubmitting || !getFinalAnswerText()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                title="确认并保存为正式决策"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>确认并继续</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
