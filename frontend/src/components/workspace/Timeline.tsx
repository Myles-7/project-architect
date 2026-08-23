import React from 'react';
import { 
  User, 
  Bot, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  Activity, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import type { TimelineMessage } from '../../types/project';
import { AnalysisCard } from './AnalysisCard';
import { QuestionCard } from './QuestionCard';

interface TimelineProps {
  messages: TimelineMessage[];
  onAnswerQuestion: (questionId: string, selectedOptionId?: string, customText?: string) => void;
  onOpenReadiness: () => void;
  onOpenDocuments: () => void;
  onNavigateToOverviewSection?: (sectionId: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  messages,
  onAnswerQuestion,
  onOpenReadiness,
  onOpenDocuments,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Stream Session Status Banner */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white dark:bg-[#121316] border border-[#E5E2DA] dark:border-[#1E2026] text-xs text-zinc-600 dark:text-zinc-400 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-[13px]">
              Project Ideation Stream
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-mono">按决策优先级逐层收敛</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-zinc-400">
            <span>Single Agent Runtime · B2.1 Contract</span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="space-y-6">
          {messages.map((msg) => {
            if (msg.type === 'idea_prompt') {
              return (
                <div key={msg.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">原始构思陈述 (Initial Idea)</span>
                    <span className="text-xs text-zinc-400">{msg.timestamp}</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-white dark:bg-[#121316] border border-[#E5E2DA] dark:border-[#1E2026] text-sm sm:text-[15px] text-zinc-900 dark:text-zinc-100 leading-relaxed space-y-3 shadow-2xs">
                    <p>{msg.content}</p>

                    {/* Attached files preview chips */}
                    {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                      <div className="pt-3 border-t border-[#E5E2DA]/60 dark:border-[#1E2026] flex flex-wrap gap-2">
                        {msg.attachedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F6F3] dark:bg-[#18191E] border border-[#E5E2DA] dark:border-[#1E2026] text-xs font-mono"
                          >
                            {file.type === 'image' ? (
                              <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                              {file.name}
                            </span>
                            <span className="text-zinc-400">({file.size})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (msg.type === 'initial_analysis' && msg.analysis) {
              return (
                <div key={msg.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    <Bot className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">结构化解析</span>
                    <span className="text-xs text-zinc-400">{msg.timestamp}</span>
                  </div>
                  <AnalysisCard analysis={msg.analysis} timestamp={msg.timestamp} />
                </div>
              );
            }

            if (msg.type === 'question_card' && msg.question) {
              return (
                <div key={msg.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Gap 澄清提问</span>
                    <span className="text-xs text-zinc-400">{msg.timestamp}</span>
                  </div>
                  <QuestionCard
                    questionData={msg.question}
                    onAnswerSubmit={onAnswerQuestion}
                    isAnswered={msg.question.isAnswered}
                  />
                </div>
              );
            }

            if (msg.type === 'user_decision') {
              return (
                <div key={msg.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold">回答意向记录</span>
                    <span className="text-xs text-zinc-400">{msg.timestamp}</span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-900/60 text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed shadow-2xs space-y-1">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">已采纳意图:</p>
                    <p>{msg.content}</p>
                  </div>
                </div>
              );
            }

            if (msg.type === 'readiness_card') {
              return (
                <div key={msg.id} className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121316] border border-[#E5E2DA] dark:border-[#1E2026] shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                        项目准备度更新：Ready with Warnings
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold font-mono">
                      核心范围已闭合
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    当前核心事实（愿景、目标用户、MVP边界、流程与设计准则）均已明确。你可以随时发起完整的【准备度审阅】或直接生成【开发规范蓝图】。
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={onOpenReadiness}
                      className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <span>进行准备度审阅</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={onOpenDocuments}
                      className="px-4 py-2.5 rounded-xl bg-[#F7F6F3] dark:bg-[#18191E] border border-[#E5E2DA] dark:border-[#1E2026] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                    >
                      直接预览 AGENTS.md
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};
