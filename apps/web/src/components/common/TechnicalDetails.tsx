import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Cpu, Hash, Clock, FileCode2, HelpCircle } from 'lucide-react';
import type { TypedRef } from '@project-architect/contracts';

export interface TechnicalDetailsProps {
  title?: string;
  decisionKey?: string;
  revision?: number;
  rawRefs?: (string | TypedRef)[];
  tokens?: number | 'unavailable';
  durationMs?: number;
  modelName?: string;
  turnId?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

export const TechnicalDetails: React.FC<TechnicalDetailsProps> = ({
  title = '查看技术详情 (B3 & 诊断)',
  decisionKey,
  revision,
  rawRefs = [],
  tokens,
  durationMs,
  modelName,
  turnId,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mt-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2 flex items-center justify-between text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          <span className="font-medium text-[11px]">{title}</span>
          {revision !== undefined && (
            <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {`rev.${revision}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3.5 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-3 bg-white/40 dark:bg-zinc-950/40">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            {decisionKey && (
              <div className="p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40">
                <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                  <Hash className="w-3 h-3" />
                  <span>决策键 (Decision Key)</span>
                </div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate font-semibold">
                  {decisionKey}
                </div>
              </div>
            )}

            {revision !== undefined && (
              <div className="p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40">
                <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                  <FileCode2 className="w-3 h-3" />
                  <span>状态版本 (Revision)</span>
                </div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200 font-semibold">
                  {`rev.${revision}`}
                </div>
              </div>
            )}

            {turnId && (
              <div className="p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40">
                <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                  <Cpu className="w-3 h-3" />
                  <span>推演轮次 (Turn ID)</span>
                </div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                  {turnId}
                </div>
              </div>
            )}

            {tokens !== undefined && (
              <div className="p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40">
                <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                  <Cpu className="w-3 h-3" />
                  <span>Token 消耗</span>
                </div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200">
                  {typeof tokens === 'number' ? `${tokens.toLocaleString()} tok` : '未统计'}
                </div>
              </div>
            )}

            {durationMs !== undefined && (
              <div className="p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40">
                <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                  <Clock className="w-3 h-3" />
                  <span>推理耗时</span>
                </div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200">
                  {durationMs} ms
                </div>
              </div>
            )}

            {modelName && (
              <div className="p-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/40">
                <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                  <Cpu className="w-3 h-3" />
                  <span>运行时模型</span>
                </div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                  {modelName}
                </div>
              </div>
            )}
          </div>

          {/* Raw References */}
          {rawRefs.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-semibold text-zinc-400">底层实体引用 (Refs)</div>
              <div className="flex flex-wrap gap-1">
                {rawRefs.map((r, i) => (
                  <span
                    key={i}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    {String(r)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Educational Note / Terminology */}
          <div className="p-2 rounded-lg bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/40 dark:border-orange-900/30 flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
            <HelpCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">B3 架构推演模型：</span>
              <span>
                基于本地阶段预算驱动的单轮高信息密度探索，确保状态提交原子性与全离线事实保护，不向外发送未经授权的私有代码。
              </span>
            </div>
          </div>

          {/* Optional Children */}
          {children}
        </div>
      )}
    </div>
  );
};
