import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronUp,
  ArrowDownCircle,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import type { DiscoveryResult, TypedRef } from '@project-architect/contracts';
import { TechnicalDetails } from '../../components/common/TechnicalDetails.js';

interface DiscoveryResultCardProps {
  discoveryResult: DiscoveryResult;
  timestamp?: string;
  projectName?: string;
  diagnostics?: {
    durationMs?: number;
    totalTokens?: number | 'unavailable';
  };
  onConfirmCandidate?: (candidateRef: TypedRef, statement: string) => void;
  onConfirmAssumption?: (assumptionRef: TypedRef, statement: string) => void;
  findCandidateRef?: (statement: string, decisionKey?: string) => TypedRef | undefined;
  findAssumptionRef?: (statement: string, decisionKey?: string) => TypedRef | undefined;
  onScrollToQuestions?: () => void;
}

export const DiscoveryResultCard: React.FC<DiscoveryResultCardProps> = ({
  discoveryResult,
  timestamp,
  projectName,
  diagnostics,
  onConfirmCandidate,
  onConfirmAssumption,
  findCandidateRef,
  findAssumptionRef,
  onScrollToQuestions,
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
  const questionsCount = discoveryResult.questions?.length || 0;

  // Derive smart architecture tags from result statements
  const allStatements = [
    ...(discoveryResult.confirmed || []),
    ...(discoveryResult.candidates || []),
    ...(discoveryResult.assumptions || []),
  ].join(' ');

  const tags: string[] = [];
  if (/windows|win32|pc/i.test(allStatements)) tags.push('Windows 本地');
  if (/离线|offline|local-first/i.test(allStatements)) tags.push('离线优先');
  if (/单次|单轮|结构化|b3/i.test(allStatements)) tags.push('结构化推演');
  if (/零数据库|无数据库|本地文件|json/i.test(allStatements)) tags.push('无数据库/文件状态');
  if (/audio|tagger|flac|mp3/i.test(allStatements)) tags.push('音频元数据');
  if (/cli|command/i.test(allStatements)) tags.push('CLI 工具');
  if (/api|rest|express/i.test(allStatements)) tags.push('REST API');
  if (tags.length === 0) tags.push('本地架构', '规范推演');

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden shadow-elevation-card space-y-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-50/50 via-surface-card to-surface-card border-b border-border-subtle flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                AI 构思透视与架构推演
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium">
                智能推演总结
              </span>
              {projectName && (
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">
                  · {projectName}
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AI 已为您提炼出 <span className="font-semibold text-zinc-800 dark:text-zinc-200">{candidatesCount}</span> 项候选建议、
              <span className="font-medium text-zinc-700 dark:text-zinc-300"> {assumptionsCount}</span> 项技术假设，并识别出
              <span className="font-medium text-zinc-700 dark:text-zinc-300"> {gapsCount}</span> 项待决缺口。
            </p>

            {/* Architecture Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <Tag className="w-3 h-3 text-zinc-400" />
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/60"
                >
                  #{tag}
                </span>
              ))}
            </div>

          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {timestamp && (
            <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">{timestamp}</span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isExpanded ? '收起分析看板' : '展开分析看板'}
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
              type="button"
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
                type="button"
                onClick={() => setActiveTab('candidates')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'candidates'
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>建议</span>
                <span className="text-xs font-mono">({candidatesCount})</span>
              </button>
            )}
            {assumptionsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('assumptions')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'assumptions'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>假设</span>
                <span className="text-xs font-mono">({assumptionsCount})</span>
              </button>
            )}
            {gapsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('gaps')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'gaps'
                    ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>待决缺口</span>
                <span className="text-xs font-mono">({gapsCount})</span>
              </button>
            )}
            {conflictsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('conflicts')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'conflicts'
                    ? 'bg-red-600 text-white font-semibold'
                    : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                }`}
              >
                <span>张力与冲突</span>
                <span className="text-xs font-mono">({conflictsCount})</span>
              </button>
            )}
            {risksCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('risks')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'risks'
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <span>风险</span>
                <span className="text-xs font-mono">({risksCount})</span>
              </button>
            )}
            {confirmedCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('confirmed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'confirmed'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <span>已确立</span>
                <span className="text-xs font-mono">({confirmedCount})</span>
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
                  {discoveryResult.candidates.map((cand, idx) => {
                    const isObj = typeof cand === 'object' && cand !== null;
                    const stmt = isObj ? cand.statement : String(cand);
                    const decisionKey = isObj ? cand.decision_key : undefined;
                    const area = isObj ? cand.area : undefined;
                    const rationale = isObj ? cand.rationale : undefined;
                    const ref = findCandidateRef ? findCandidateRef(stmt, decisionKey) : undefined;

                    return (
                      <div
                        key={`cand-${idx}`}
                        className="p-3 rounded-xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="text-zinc-900 dark:text-zinc-100 leading-relaxed font-medium">
                            {stmt}
                          </div>
                          {rationale && (
                            <div className="text-[11px] text-orange-900/70 dark:text-orange-300/70">
                              依据: {rationale}
                            </div>
                          )}
                          {area && (
                            <span className="inline-block text-xs font-mono px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                              {area}
                            </span>
                          )}
                        </div>
                        {onConfirmCandidate && ref && (
                          <button
                            type="button"
                            onClick={() => onConfirmCandidate(ref, stmt)}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>采纳</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Inferred Assumptions */}
            {(activeTab === 'all' || activeTab === 'assumptions') && assumptionsCount > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                  <span>推断假设 (Inferred Assumptions)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.assumptions.map((asm, idx) => {
                    const isObj = typeof asm === 'object' && asm !== null;
                    const stmt = isObj ? asm.statement : String(asm);
                    const decisionKey = isObj ? asm.decision_key : undefined;
                    const area = isObj ? asm.area : undefined;
                    const reason = isObj ? asm.reason : undefined;
                    const ref = findAssumptionRef ? findAssumptionRef(stmt, decisionKey) : undefined;

                    return (
                      <div
                        key={`asm-${idx}`}
                        className="p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="text-zinc-900 dark:text-zinc-100 leading-relaxed font-medium">
                            {stmt}
                          </div>
                          {reason && (
                            <div className="text-[11px] text-purple-900/70 dark:text-purple-300/70">
                              原因: {reason}
                            </div>
                          )}
                          {area && (
                            <span className="inline-block text-xs font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                              {area}
                            </span>
                          )}
                        </div>
                        {onConfirmAssumption && ref && (
                          <button
                            type="button"
                            onClick={() => onConfirmAssumption(ref, stmt)}
                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>转为决策</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
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
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded uppercase font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {gap.severity}
                        </span>
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                        {gap.reason}
                      </div>
                      {gap.impact && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
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
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>已知架构与交付风险 (Identified Risks)</span>
                </div>
                <div className="space-y-2">
                  {discoveryResult.risks.map((risk, idx) => {
                    const isObj = typeof risk === 'object' && risk !== null;
                    const stmt = isObj ? risk.statement : String(risk);
                    const severity = isObj ? risk.severity : 'medium';
                    const impact = isObj ? risk.impact : undefined;
                    const area = isObj ? risk.area : undefined;

                    return (
                      <div
                        key={`risk-${idx}`}
                        className="p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 leading-relaxed space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{stmt}</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded uppercase font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {severity}
                          </span>
                        </div>
                        {impact && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-300">
                            影响: {impact}
                          </div>
                        )}
                        {area && (
                          <span className="inline-block text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {area}
                          </span>
                        )}
                      </div>
                    );
                  })}
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

            {/* Progressive Technical Details Disclosure */}
            <TechnicalDetails
              durationMs={diagnostics?.durationMs}
              tokens={diagnostics?.totalTokens}
              title="查看本轮推演技术细节 (B3 & 诊断)"
            />
          </div>

          {/* Bottom Guidance Action to Question Wizard */}
          {questionsCount > 0 && onScrollToQuestions && (
            <div className="p-3 bg-zinc-50/60 dark:bg-zinc-900/40 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                已提炼核心架构，现有 {questionsCount} 项待决分歧需要您拍板
              </span>
              <button
                type="button"
                onClick={onScrollToQuestions}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer shadow-xs"
              >
                <span>前往回答关键问题</span>
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
