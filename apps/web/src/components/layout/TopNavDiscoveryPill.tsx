import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';

export const TopNavDiscoveryPill: React.FC = () => {
  const { state, setActiveTab, cancelDiscoveryJob } = useProjectSession();
  const { discoveryJob, uiState } = state;
  const [seconds, setSeconds] = useState(0);
  const [isCanceling, setIsCanceling] = useState(false);

  const isRunning = discoveryJob?.status === 'queued' || discoveryJob?.status === 'running';
  const isCompleted = discoveryJob?.status === 'completed';

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

  if (!isRunning && !isCompleted) {
    return null;
  }

  const handlePillClick = () => {
    if (uiState.activeTab !== 'chat') {
      setActiveTab('chat');
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCanceling) return;
    setIsCanceling(true);
    try {
      await cancelDiscoveryJob();
    } finally {
      setIsCanceling(false);
    }
  };

  if (isCompleted) {
    return (
      <button
        onClick={handlePillClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
        title="推演已完成，点击查看最新决策与建议问题"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>建议已更新</span>
        <ArrowRight className="w-3 h-3 text-emerald-500" />
      </button>
    );
  }

  return (
    <div
      onClick={handlePillClick}
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-950/70 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 shadow-xs cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-all group"
      title="AI 正在后台进行构思推演，点击返回对话"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-spin" />
        <span className="font-medium">
          {discoveryJob?.status === 'queued' ? '排队中...' : `推演中 ${seconds}s`}
        </span>
      </div>

      <button
        onClick={handleCancel}
        disabled={isCanceling}
        className="p-0.5 rounded-full hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-600 dark:text-orange-400 hover:text-orange-800 transition-colors cursor-pointer"
        title="取消本次推演"
        aria-label="取消本次推演"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
