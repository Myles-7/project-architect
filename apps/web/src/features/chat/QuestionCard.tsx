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
import { useOptionalProjectSession } from '../../state/ProjectSessionContext.js';

export interface QuestionCardProps {
  question: QuestionItem;
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
  isSubmitting?: boolean;
  defaultExpanded?: boolean;
  isSelectedForDismiss?: boolean;
  onToggleDismiss?: (questionId: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  projectId,
  onAnswerRecord,
  onAnswerAndDiscover,
  onAnswerAsAssumption,
  isSubmitting = false,
  defaultExpanded = false,
  isSelectedForDismiss = false,
  onToggleDismiss,
}) => {
  const session = useOptionalProjectSession();
  const activeProjectId = projectId || session?.state.activeProjectId || 'global';
  const isAnswered = question.status === 'answered';
  const isDismissed = question.status === 'dismissed';
  const isSuperseded = question.status === 'superseded' || isDismissed;
  const inputId = React.useId();
  const importanceLabel = question.importance === 'critical'
    ? '必须明确'
    : question.importance === 'high'
      ? '优先明确'
      : '建议明确';

  const draftKey = `pa_${activeProjectId}_draft_${question.id}`;
  const currentKeyRef = React.useRef(draftKey);

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

  // Synchronize state and auto-persist draft without cross-contaminating when draftKey changes
  React.useEffect(() => {
    if (currentKeyRef.current !== draftKey) {
      currentKeyRef.current = draftKey;
      try {
        const savedOpt = question.status === 'answered' ? null : localStorage.getItem(`${draftKey}:opt`) || null;
        const savedInput = localStorage.getItem(`${draftKey}:input`) || question.answer || '';
        setSelectedOption(savedOpt);
        setFreeInput(savedInput);
      } catch {}
      return;
    }

    if (!isAnswered && !isSuperseded) {
      try {
        if (selectedOption) localStorage.setItem(`${draftKey}:opt`, selectedOption);
        else localStorage.removeItem(`${draftKey}:opt`);
      } catch {}
    }
  }, [draftKey, selectedOption, isAnswered, isSuperseded, question.status, question.answer]);

  React.useEffect(() => {
    if (currentKeyRef.current !== draftKey) {
      return;
    }

    if (!isAnswered && !isSuperseded) {
      try {
        if (freeInput) localStorage.setItem(`${draftKey}:input`, freeInput);
        else localStorage.removeItem(`${draftKey}:input`);
      } catch {}
    }
  }, [draftKey, freeInput, isAnswered, isSuperseded]);

  React.useEffect(() => {
    if (isAnswered || isDismissed) {
      try {
        localStorage.removeItem(`${draftKey}:opt`);
        localStorage.removeItem(`${draftKey}:input`);
      } catch {}
    }
  }, [isAnswered, isDismissed, draftKey]);

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
          ? 'border-emerald-500/30 bg-surface-base'
          : isSuperseded
          ? 'border-border-subtle bg-surface-subtle/40 opacity-75'
          : 'border-border-default bg-surface-base shadow-sm'
      }`}
    >
      {/* Header: Level 1 Subtle Surface */}
      <div className="p-4 sm:p-5 bg-surface-subtle/50 border-b border-border-subtle space-y-2.5">
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
              className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                question.importance === 'critical'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  : question.importance === 'high'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                  : 'bg-surface-raised text-text-secondary border border-border-subtle'
              }`}
            >
              {importanceLabel}
            </span>
            <span className="text-[11px] text-text-muted">当前批次问题</span>
          </div>

          <div className="flex items-center gap-2">
            {!isAnswered && !isSuperseded && recommendedOption && (
              <button
                type="button"
                onClick={handleAdoptRecommendation}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 transition-all cursor-pointer shadow-xs"
                title={`选中推荐选项: ${recommendedOption.label}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>采纳推荐: {recommendedOption.label}</span>
              </button>
            )}

            {isAnswered && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                <span>已确立决策</span>
              </span>
            )}
            {isSuperseded && (
              <span className="text-xs font-medium text-text-muted bg-surface-raised px-2 py-0.5 rounded">
                {isDismissed ? '已跳过' : '已由新推演替换'}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-sm sm:text-base font-semibold text-text-primary leading-snug">
          {question.question}
        </h3>
        {!isAnswered && !isSuperseded && (
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400 cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {isExpanded ? '收起回答区' : '展开回答与详情'}
          </button>
        )}
      </div>

      {/* Answered Decision Banner */}
      {isAnswered && (
        <div className="p-4 sm:p-5 bg-emerald-500/5 border-b border-emerald-500/20 flex items-start gap-2.5 text-xs">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">已确认决策：</span>
            <div className="text-text-primary leading-relaxed font-medium">
              {question.answer || selectedOption || '已确认并沉淀为项目决策'}
            </div>
          </div>
        </div>
      )}

      {/* Decision Rationale & Recommendation */}
      {isExpanded && !isAnswered && !isSuperseded && (
        <div className="p-4 sm:p-5 bg-surface-subtle/30 border-b border-border-subtle space-y-2.5 text-xs">
          {question.reason && (
            <div className="flex items-start gap-2 text-text-secondary">
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-primary font-semibold">为什么现在必须明确：</strong>
                <span className="ml-1 text-text-secondary leading-relaxed">{question.reason}</span>
              </div>
            </div>
          )}

          {question.recommendation && (
            <div className="flex items-start gap-2 text-text-secondary pt-1.5 border-t border-border-subtle">
              <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-primary font-semibold">推荐方向：</strong>
                <span className="font-mono text-orange-600 dark:text-orange-400 font-semibold mx-1">
                  {question.recommendation}
                </span>
                {question.recommendationReason && (
                  <span className="text-text-muted">({question.recommendationReason})</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answer Body */}
      {isAnswered ? (
        <div className="p-4 sm:p-5 bg-emerald-500/5 space-y-1.5">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
            用户确立的回答
          </div>
          <div className="text-xs text-text-primary leading-relaxed font-medium bg-surface-raised p-3 rounded-xl border border-emerald-500/20">
            {question.answer}
          </div>
        </div>
      ) : isSuperseded ? (
        <div className="p-4 text-center text-xs text-text-muted">
          {isDismissed ? '你已明确跳过此问题，不会生成决策。' : '该问题已被后续对话确立的决策替代。'}
        </div>
      ) : !isExpanded ? null : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Options Grid: Clean Surface Raised Cards */}
          {question.options && question.options.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-secondary">
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
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/10 text-text-primary shadow-xs'
                          : 'border-border-subtle bg-surface-raised hover:border-border-default text-text-secondary'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-border-strong'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={isSelected ? 'text-text-primary' : 'text-text-secondary'}>
                            {opt.label}
                          </span>
                          {isSelected && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                              已选中
                            </span>
                          )}
                          {opt.reversibility && (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-normal ${
                                opt.reversibility === 'easy'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : opt.reversibility === 'hard'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
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
                              <div className="text-emerald-600 dark:text-emerald-400">
                                <span className="font-semibold">收益：</span>
                                <span>{opt.gain}</span>
                              </div>
                            )}
                            {opt.sacrifice && (
                              <div className="text-amber-600 dark:text-amber-400">
                                <span className="font-semibold">代价：</span>
                                <span>{opt.sacrifice}</span>
                              </div>
                            )}
                            {opt.tradeoffs && (
                              <div className="text-text-secondary col-span-full">
                                <span className="font-semibold">权衡：</span>
                                <span>{opt.tradeoffs}</span>
                              </div>
                            )}
                            {opt.impact && (
                              <div className="text-text-muted col-span-full">
                                <span className="font-semibold text-text-secondary">影响：</span>
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
              <label htmlFor={inputId} className="block text-xs font-semibold text-text-secondary">
                {question.options && question.options.length > 0 ? '自定义补充或改写回答 (可选)' : '输入你的具体决策陈述'}
              </label>
              {question.recommendation && !freeInput && (
                <button
                  type="button"
                  onClick={() => setFreeInput(question.recommendation || '')}
                  className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline cursor-pointer flex items-center gap-1 font-medium"
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
                  ? '例如：首发面向个人开发者与敏捷团队，暂不引入复杂的企业组织多租户权限...'
                  : question.area === 'mvp_scope'
                  ? '例如：首发聚焦核心推演引擎与规范生成，将云端协作与实时同步延期至二期...'
                  : question.area === 'core_features'
                  ? '例如：优先实现两阶段快照提交与自适应问答流，模板编辑暂做只读渲染...'
                  : question.area === 'user_flows'
                  ? '例如：创建项目后直接进入发现流问答，并在右侧概览实时投影决策蓝图...'
                  : question.area === 'page_structure'
                  ? '例如：三栏弹性工作台，左侧导航、中间对话推演、右侧项目架构概览...'
                  : question.area === 'ux_ui_direction'
                  ? '例如：宁静专业的暗色工程工作台，高对比度排版与纯净表面标高...'
                  : question.area === 'technical_boundary'
                  ? '例如：本地文件两阶段提交保证原子性，拒绝中心化数据库，保持 Core 纯净零依赖...'
                  : question.area === 'delivery_plan'
                  ? '例如：完成全部核心 8 篇 Markdown 架构文档导出与代码审查基线即算首期交付...'
                  : '如有特殊考量，可在此直接输入你的具体决策陈述...'
              }
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-surface-raised border border-border-subtle focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-text-primary placeholder-text-muted"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border-subtle">
            <div className="text-[11px] text-text-muted">
              当前批次 · 回答即时生效
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Secondary Path: Save as Assumption */}
              <button
                type="button"
                onClick={handleSaveAsAssumption}
                disabled={isSubmitting || !getFinalAnswerText()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 disabled:opacity-40 transition-colors cursor-pointer"
                title="存为活跃假设 (Assumption)，后续随时可推翻，不作为不可修改的决策"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>存为待验证假设</span>
              </button>

              {onAnswerAndDiscover && (
                <button
                  type="button"
                  onClick={handleAnswerAndDiscover}
                  disabled={isSubmitting || !getFinalAnswerText()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 disabled:opacity-40 transition-colors cursor-pointer"
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
