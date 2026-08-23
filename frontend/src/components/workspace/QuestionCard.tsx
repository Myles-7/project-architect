import React, { useState } from 'react';
import { 
  Check, 
  ArrowRight, 
  MessageSquare,
  HelpCircle,
  Sparkles,
  GitCommit
} from 'lucide-react';
import type { QuestionItem } from '../../types/project';
import { ImportanceBadge } from '../common/StatusBadge';

interface QuestionCardProps {
  questionData: QuestionItem;
  onAnswerSubmit: (questionId: string, selectedOptionId?: string, customText?: string) => void;
  isAnswered?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  questionData,
  onAnswerSubmit,
  isAnswered = false,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string>(
    questionData.options.find((o) => o.isRecommended)?.id || questionData.options[0]?.id || ''
  );
  const [customText, setCustomText] = useState<string>('');
  const [subAnswer, setSubAnswer] = useState<string>(
    questionData.subQuestions?.[0]?.selectedOption || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnswered) return;
    onAnswerSubmit(questionData.id, selectedOptionId, customText.trim() || undefined);
  };

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      isAnswered 
        ? 'border-emerald-300 dark:border-emerald-900/60 bg-white dark:bg-[#121316]' 
        : 'border-orange-400/90 dark:border-orange-700/80 bg-white dark:bg-[#121316] shadow-sm'
    }`}>
      {/* Question Header */}
      <div className="p-4 sm:p-5 bg-[#F7F6F3]/80 dark:bg-[#15161A]/80 border-b border-[#E5E2DA] dark:border-[#1E2026] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImportanceBadge level={questionData.importance} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              GAP-01 · 单题深度澄清
            </span>
          </div>
          {isAnswered && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
              <Check className="w-3.5 h-3.5" />
              <span>决策已确认</span>
            </span>
          )}
        </div>

        <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
          {questionData.question}
        </h3>
      </div>

      {/* Decision Rationale & Recommendation Grid */}
      <div className="p-4 sm:p-5 bg-[#F7F6F3]/40 dark:bg-[#141519]/40 border-b border-[#E5E2DA] dark:border-[#1E2026] space-y-2.5 text-xs">
        <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">为什么现在必须决策：</strong>
            <span className="ml-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">{questionData.whyAskNow}</span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300 pt-1 border-t border-[#E5E2DA]/60 dark:border-[#1E2026]">
          <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">建议方向：</strong>
            <span className="font-mono text-orange-700 dark:text-orange-300 font-semibold mx-1">
              [{questionData.recommendation.label}]
            </span>
            <span className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {questionData.recommendation.rationale}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Options & Freeform Input */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Option Cards */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
            方案比选 (点击选择):
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {questionData.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => !isAnswered && setSelectedOptionId(opt.id)}
                  className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 ring-1 ring-orange-500 shadow-2xs'
                      : 'border-[#E5E2DA] dark:border-[#1E2026] hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#15161A]'
                  } ${isAnswered ? 'cursor-default opacity-85' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-zinc-400 dark:border-zinc-600'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm">
                          {opt.label}
                        </span>
                        {opt.isRecommended && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-medium">
                            推荐
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium">架构影响：</span>
                        {opt.impact}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-question if exists */}
        {questionData.subQuestions && questionData.subQuestions.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#F7F6F3] dark:bg-[#15161A] border border-[#E5E2DA] dark:border-[#1E2026] space-y-2 text-xs">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
              关联次要约束：{questionData.subQuestions[0].question}
            </div>
            <div className="space-y-1.5 pl-1">
              {questionData.subQuestions[0].options.map((subOpt, i) => (
                <label key={i} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="sub-q"
                    checked={subAnswer === subOpt}
                    onChange={() => !isAnswered && setSubAnswer(subOpt)}
                    className="accent-orange-500"
                    disabled={isAnswered}
                  />
                  <span>{subOpt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Freeform input area */}
        {!isAnswered && (
          <div className="space-y-1.5 pt-2 border-t border-[#E5E2DA]/60 dark:border-[#1E2026]">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              <span>或自由补充特殊想法 / 约束纠偏 (可选)</span>
            </label>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="例如：'倾向单机文件持久化' 或 '需要兼容 WebDAV'..."
              className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl bg-[#F7F6F3] dark:bg-[#111215] border border-[#E5E2DA] dark:border-[#1E2026] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        )}

        {/* Action Button */}
        {!isAnswered ? (
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center gap-2 group cursor-pointer active:scale-[0.98]"
            >
              <span>确认回答意向</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        ) : (
          <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 dark:border-[#1E2026]">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <GitCommit className="w-3.5 h-3.5" />
              <span>用户意图已提交，Project State 已完成单次更新投影</span>
            </span>
            <span className="text-zinc-400">已同步至 Overview</span>
          </div>
        )}
      </div>
    </div>
  );
};
