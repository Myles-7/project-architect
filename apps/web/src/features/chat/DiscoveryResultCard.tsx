import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Flame,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { DiscoveryResult } from '@project-architect/contracts';

interface DiscoveryResultCardProps {
  discoveryResult: DiscoveryResult;
  timestamp?: string;
  diagnostics?: {
    durationMs?: number;
    totalTokens?: number | 'unavailable';
  };
  onConfirmCandidate?: (candidate: string) => void;
  onConfirmAssumption?: (assumption: string) => void;
}

export const DiscoveryResultCard: React.FC<DiscoveryResultCardProps> = ({
  discoveryResult,
  timestamp,
  diagnostics,
  onConfirmCandidate,
  onConfirmAssumption,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'all' | 'candidates' | 'assumptions' | 'gaps' | 'risks' | 'conflicts' | 'confirmed'
  >('all');

  const confirmedCount = discoveryResult.confirmed?.length || 0;
  const candidatesCount = discoveryResult.candidates?.length || 0;
  const assumptionsCount = discoveryResult.assumptions?.length || 0;
  const gapsCount = discoveryResult.gaps?.length || 0;
  const risksCount = discoveryResult.risks?.length || 0;
  const conflictsCount = (discoveryResult.conflicts?.length || 0) + (discoveryResult.tensions?.length || 0);

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#17181D] overflow-hidden shadow-2xs space-y-0">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-zinc-50/70 dark:bg-[#15161A]/70 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                Agent 结构化推演分析
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                B2.1 Single Agent
              </span>
            </div>
            {diagnostics && diagnostics.durationMs !== undefined && (
              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                耗时 {diagnostics.durationMs}ms · 消耗 Token: {diagnostics.totalTokens ?? 'N/A'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-xs text-zinc-400 font-mono hidden sm:inline">{timestamp}</span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Category Tabs */}
          <div className="px-4 py-2 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-zinc-50/30 dark:bg-zinc-900/20 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              全部提炼
            </button>
            {candidatesCount > 0 && (
              <button
                onClick={() => setActiveTab('candidates')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'candidates'
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                }`}
              >
                <span>建议</span>
                <span className="text-[10px] font-mono">({candidatesCount})</span>
              </button>
            )}
            {assumptionsCount > 0 && (
              <button
                onClick={() => setActiveTab('assumptions')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'assumptions'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                }`}
              >
                <span>假设</span>
                <span className="text-[10px] font-mono">({assumptionsCount})</span>
              </button>
            )}
            {gapsCount > 0 && (
              <button
                onClick={() => setActiveTab('gaps')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'gaps'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                <span>待决缺口</span>
                <span className="text-[10px] font-mono">({gapsCount})</span>
              </button>
            )}
            {conflictsCount > 0 && (
              <button
                onClick={() => setActiveTab('conflicts')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'conflicts'
                    ? 'bg-red-600 text-white font-semibold'
                    : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                }`}
              >
                <span>张力与冲突</span>
                <span className="text-[10px] font-mono">({conflictsCount})</span>
              </button>
            )}
            {risksCount > 0 && (
              <button
                onClick={() => setActiveTab('risks')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'risks'
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <span>风险</span>
                <span className="text-[10px] font-mono">({risksCount})</span>
              </button>
            )}
            {confirmedCount > 0 && (
              <button
                onClick={() => setActiveTab('confirmed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'confirmed'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <span>已确立</span>
                <span className="text-[10px] font-mono">({confirmedCount})</span>
              </button>
            )}
          </div>

          {/* Cards Content */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* 1. Conflicts & Tensions */}
            {(activeTab === 'all' || activeTab === 'conflicts') && conflictsCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-500" />
                  <span>硬性冲突与设计张力 (Conflicts & Tensions)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.conflicts?.map((conf, idx) => (
                    <div
                      key={`conf-${idx}`}
                      className="p-3 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 leading-relaxed"
                    >
                      {conf}
                    </div>
                  ))}
                  {discoveryResult.tensions?.map((ten, idx) => (
                    <div
                      key={`ten-${idx}`}
                      className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1"
                    >
                      <div className="font-semibold">{ten.description}</div>
                      <div className="text-amber-700 dark:text-amber-300 text-[11px]">{ten.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Candidate Proposals */}
            {(activeTab === 'all' || activeTab === 'candidates') && candidatesCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>建议方案 (Candidate Proposals - 需用户确认)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.candidates.map((cand, idx) => (
                    <div
                      key={`cand-${idx}`}
                      className="p-3 rounded-xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="text-zinc-900 dark:text-zinc-100 leading-relaxed flex-1">
                        {cand}
                      </div>
                      {onConfirmCandidate && (
                        <button
                          onClick={() => onConfirmCandidate(cand)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>采纳</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Inferred Assumptions */}
            {(activeTab === 'all' || activeTab === 'assumptions') && assumptionsCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                  <span>推断假设 (Assumptions)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.assumptions.map((asm, idx) => (
                    <div
                      key={`asm-${idx}`}
                      className="p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="text-zinc-900 dark:text-zinc-100 leading-relaxed flex-1">
                        {asm}
                      </div>
                      {onConfirmAssumption && (
                        <button
                          onClick={() => onConfirmAssumption(asm)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>转为决策</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Identified Gaps */}
            {(activeTab === 'all' || activeTab === 'gaps') && gapsCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>待决缺口 (Identified Gaps)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.gaps.map((gap, idx) => (
                    <div
                      key={`gap-${idx}`}
                      className="p-3 rounded-xl bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {gap.area}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {gap.severity}
                        </span>
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                        {gap.reason}
                      </div>
                      {gap.impact && (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          影响: {gap.impact}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Identified Risks */}
            {(activeTab === 'all' || activeTab === 'risks') && risksCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>已知架构与交付风险 (Identified Risks)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.risks.map((risk, idx) => (
                    <div
                      key={`risk-${idx}`}
                      className="p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 leading-relaxed"
                    >
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Confirmed Facts */}
            {(activeTab === 'all' || activeTab === 'confirmed') && confirmedCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>已确立事实 (Confirmed Facts)</span>
                </div>
                <div className="space-y-1.5">
                  {discoveryResult.confirmed.map((conf, idx) => (
                    <div
                      key={`conf-fact-${idx}`}
                      className="p-2.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{conf}</span>
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
