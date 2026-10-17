import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Cpu, Layers, X } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import type { DiscoveryExecutionPhase } from '@project-architect/contracts';

export interface PhaseStep {
  phase: DiscoveryExecutionPhase;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  minSeconds: number;
}

export const PROGRESS_PHASES: PhaseStep[] = [
  {
    phase: 'context_assembly',
    icon: Brain,
    title: '组装工程宪法与材料上下文',
    subtitle: '提取核心意图、材料背景与不可触碰边界...',
    minSeconds: 0,
  },
  {
    phase: 'provider_inference',
    icon: Sparkles,
    title: 'AI 架构师执行单次结构化推演',
    subtitle: '基于 B3 宪法规范，深度推演业务逻辑与决策备选方案...',
    minSeconds: 4,
  },
  {
    phase: 'gap_detection',
    icon: Layers,
    title: '比对 Checklist 底线与识别关键缺口',
    subtitle: '比对底线规则，自适应筛查当前阶段未决缺口与权衡...',
    minSeconds: 12,
  },
  {
    phase: 'state_commit',
    icon: Cpu,
    title: '自适应问题集生成与两阶段提交',
    subtitle: '原子提交至磁盘 state/revisions/，准备更新全景蓝图...',
    minSeconds: 20,
  },
];

export interface DiscoveryProgressTickerProps {
  forceActive?: boolean;
}

export const DiscoveryProgressTicker: React.FC<DiscoveryProgressTickerProps> = ({ forceActive = false }) => {
  const { state, cancelDiscoveryJob } = useProjectSession();
  const { discoveryJob, requestState } = state;

  const isJobRunning = discoveryJob?.status === 'queued' || discoveryJob?.status === 'running';
  const isRequestLoading = requestState.status === 'loading';
  const isRunning = forceActive || isJobRunning || isRequestLoading;

  const [shouldRender, setShouldRender] = useState(isRunning);
  const [isExiting, setIsExiting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    if (isRunning) {
      setShouldRender(true);
      setIsExiting(false);
      const timer = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
      return () => window.clearInterval(timer);
    } else if (shouldRender) {
      // Smooth exit transition before unmounting
      setIsExiting(true);
      const exitTimer = window.setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
        setSeconds(0);
      }, 350);
      return () => window.clearTimeout(exitTimer);
    }
  }, [isRunning, shouldRender]);

  if (!shouldRender) return null;

  // Determine active step index: real telemetry phase takes precedence
  let activeIndex = 0;
  if (discoveryJob?.currentPhase) {
    const found = PROGRESS_PHASES.findIndex((p) => p.phase === discoveryJob.currentPhase);
    if (found >= 0) {
      activeIndex = found;
    }
  } else {
    for (let i = PROGRESS_PHASES.length - 1; i >= 0; i--) {
      const p = PROGRESS_PHASES[i];
      if (p && seconds >= p.minSeconds) {
        activeIndex = i;
        break;
      }
    }
  }

  const currentStep = PROGRESS_PHASES[activeIndex] ?? PROGRESS_PHASES[0]!;
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
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-orange-500/30 bg-surface-raised p-5 shadow-sm space-y-4 transition-all duration-300 ease-out ${
        isExiting
          ? 'opacity-0 -translate-y-2 pointer-events-none'
          : 'opacity-100 translate-y-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <Sparkles className="w-4 h-4 animate-spin text-orange-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                AI 构思推演进行中
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
                {seconds}s
              </span>
            </div>
            <p className="text-xs text-text-muted">
              单次深度推演约耗时 30-90 秒（视模型思考链长度而定），可同时在右栏查看或编辑已沉淀的 Overview
            </p>
          </div>
        </div>

        {isJobRunning && (
          <button
            onClick={handleCancel}
            disabled={isCanceling}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
            title="中断并取消本次推演"
          >
            <X className="w-3.5 h-3.5" />
            <span>取消推演</span>
          </button>
        )}
      </div>

      {/* Progress Bar & Current Phase Pill */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          {PROGRESS_PHASES.map((_, idx) => {
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            return (
              <div key={idx} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isDone
                      ? 'bg-orange-500'
                      : isCurrent
                      ? 'bg-orange-500/80 animate-pulse'
                      : 'bg-border-subtle'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Dynamic Micro Status */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-base border border-border-subtle">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 shrink-0 mt-0.5">
            <CurrentIcon className="w-4 h-4 animate-pulse" />
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary flex items-center justify-between">
              <span>{currentStep.title}</span>
              <span className="text-xs text-text-muted font-normal">
                阶段 {activeIndex + 1} / {PROGRESS_PHASES.length}
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed truncate">
              {currentStep.subtitle}
            </p>
          </div>
        </div>

        {seconds >= 25 && (
          <div className="px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[11px] text-orange-700 dark:text-orange-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping shrink-0" />
            <span>AI 模型正在展开多步深度思考 (Thinking) 与多维架构权衡，请稍候...</span>
          </div>
        )}
      </div>
    </div>
  );
};
