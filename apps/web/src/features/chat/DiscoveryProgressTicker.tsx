import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Cpu, Layers, X } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';


const PROGRESS_STEPS = [
  {
    icon: Brain,
    title: '分析产品意图与核心边界',
    subtitle: '提取核心用户、解决痛点与不可触碰边界...',
    minSeconds: 0,
  },
  {
    icon: Layers,
    title: '比对状态与识别关键缺口 (Gaps)',
    subtitle: '扫描 MVP 范围、核心工作流与待明确决策...',
    minSeconds: 4,
  },
  {
    icon: Cpu,
    title: '评估技术约束与低风险假设 (Assumptions)',
    subtitle: '分离必须由您决定的核心选项与系统默认值...',
    minSeconds: 10,
  },
  {
    icon: Sparkles,
    title: '精炼高价值决策问题与选项影响',
    subtitle: '生成独立问题集并清晰标明方案取舍 (Trade-offs)...',
    minSeconds: 18,
  },
];

export const DiscoveryProgressTicker: React.FC = () => {
  const { state, cancelDiscoveryJob } = useProjectSession();
  const { discoveryJob } = state;
  const [seconds, setSeconds] = useState(0);
  const [isCanceling, setIsCanceling] = useState(false);

  const isRunning = discoveryJob?.status === 'queued' || discoveryJob?.status === 'running';

  useEffect(() => {
    if (!isRunning) {
      setSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  if (!isRunning) return null;

  // Determine active step index
  let activeIndex = 0;
  for (let i = PROGRESS_STEPS.length - 1; i >= 0; i--) {
    if (seconds >= PROGRESS_STEPS[i].minSeconds) {
      activeIndex = i;
      break;
    }
  }

  const currentStep = PROGRESS_STEPS[activeIndex];
  const CurrentIcon = currentStep.icon;

  const handleCancel = async () => {
    if (isCanceling) return;
    setIsCanceling(true);
    try {
      await cancelDiscoveryJob();
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange-300/80 dark:border-orange-800/80 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/50 dark:from-orange-950/30 dark:via-[#131418] dark:to-amber-950/20 p-5 shadow-sm space-y-4 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-600/10 dark:bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <Sparkles className="w-4 h-4 animate-spin text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                AI 构思推演进行中
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300 font-medium">
                {seconds}s
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              单次深度推演约耗时 10-25 秒，可同时在右栏查看或编辑已沉淀的 Overview
            </p>
          </div>
        </div>

        <button
          onClick={handleCancel}
          disabled={isCanceling}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="中断并取消本次推演"
        >
          <X className="w-3.5 h-3.5" />
          <span>取消推演</span>
        </button>
      </div>

      {/* Progress Bar & Current Phase Pill */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          {PROGRESS_STEPS.map((_, idx) => {
            const isDone = idx < activeIndex;

            const isCurrent = idx === activeIndex;
            return (
              <div key={idx} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isDone
                      ? 'bg-orange-500 dark:bg-orange-400'
                      : isCurrent
                      ? 'bg-orange-500/80 dark:bg-orange-400/80 animate-pulse'
                      : 'bg-zinc-200 dark:bg-zinc-800'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Dynamic Micro Status */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/80 dark:bg-[#18191E]/80 border border-orange-200/60 dark:border-orange-900/40">
          <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5">
            <CurrentIcon className="w-4 h-4 animate-pulse" />
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>{currentStep.title}</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                阶段 {activeIndex + 1} / {PROGRESS_STEPS.length}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed truncate">
              {currentStep.subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
