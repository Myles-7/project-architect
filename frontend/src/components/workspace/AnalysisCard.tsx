import React, { useState } from 'react';
import { 
  CheckCircle2, 
  HelpCircle, 
  AlertTriangle, 
  Lightbulb, 
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { AnalysisBreakdown } from '../../types/project';

interface AnalysisCardProps {
  analysis: AnalysisBreakdown;
  timestamp: string;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, timestamp }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'confirmed' | 'candidates' | 'assumptions' | 'gaps'>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  const totalPoints = 
    analysis.confirmed.length + 
    analysis.candidates.length + 
    analysis.assumptions.length + 
    analysis.unresolvedGaps.length;

  return (
    <div className="rounded-2xl border border-[#E5E2DA] dark:border-[#1E2026] bg-white dark:bg-[#121316] overflow-hidden shadow-2xs space-y-0">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-[#F7F6F3]/70 dark:bg-[#15161A]/70 border-b border-[#E5E2DA] dark:border-[#1E2026] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                首次结构化理解 (Initial Understanding Breakdown)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Single Agent
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">{timestamp}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Category Filter Pills */}
          <div className="px-4 sm:px-5 py-2.5 border-b border-[#E5E2DA]/80 dark:border-[#1E2026] flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white dark:bg-[#121316]">
            <button
              onClick={() => setActiveTab('all')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              全览 ({totalPoints})
            </button>
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'confirmed'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>已确认 ({analysis.confirmed.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('candidates')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'candidates'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>候选建议 ({analysis.candidates.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('assumptions')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'assumptions'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>默认假设 ({analysis.assumptions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('gaps')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'gaps'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>关键缺口 ({analysis.unresolvedGaps.length})</span>
            </button>
          </div>

          {/* Breakdown Content List */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* 1. Confirmed Facts */}
            {(activeTab === 'all' || activeTab === 'confirmed') && analysis.confirmed.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Confirmed 已确认事实与边界 ({analysis.confirmed.length})</span>
                </div>
                <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500/80">
                  {analysis.confirmed.map((item, idx) => (
                    <div key={idx} className="text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Candidates */}
            {(activeTab === 'all' || activeTab === 'candidates') && analysis.candidates.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-500" />
                  <span>Candidate 候选建议方案 ({analysis.candidates.length})</span>
                </div>
                <div className="space-y-1.5 pl-3 border-l-2 border-purple-500/80">
                  {analysis.candidates.map((item, idx) => (
                    <div key={idx} className="text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Assumptions */}
            {(activeTab === 'all' || activeTab === 'assumptions') && analysis.assumptions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-500" />
                  <span>Assumption 暂定默认假设 ({analysis.assumptions.length})</span>
                </div>
                <div className="space-y-1.5 pl-3 border-l-2 border-sky-500/80">
                  {analysis.assumptions.map((item, idx) => (
                    <div key={idx} className="text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Unresolved Gaps */}
            {(activeTab === 'all' || activeTab === 'gaps') && analysis.unresolvedGaps.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Unresolved 关键待澄清缺口 ({analysis.unresolvedGaps.length})</span>
                </div>
                <div className="space-y-1.5 pl-3 border-l-2 border-amber-500/80">
                  {analysis.unresolvedGaps.map((item, idx) => (
                    <div key={idx} className="text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Warnings */}
            {analysis.warnings && analysis.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Warning 风险注意事项</span>
                </div>
                <div className="space-y-1.5 pl-3 border-l-2 border-rose-500/80">
                  {analysis.warnings.map((item, idx) => (
                    <div key={idx} className="text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
