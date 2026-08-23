import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Compass,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  Edit3,
  Paperclip,
  ShieldCheck,
  FileText,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  User,
  Bot,
  Cpu,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { CardSkeleton } from '../../components/common/LoadingSkeleton.js';
import type { TimelineView as TimelineViewModel, TimelineEvent } from '@project-architect/contracts';

export const TimelineView: React.FC = () => {
  const { state, apiClient } = useProjectSession();
  const { activeProjectId, stateRevision } = state;

  const [timeline, setTimeline] = useState<TimelineViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (!activeProjectId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.getProjectTimeline(activeProjectId);
      setTimeline(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch timeline:', err);
      setErrorMsg(err.message || '加载项目演进时间线失败');
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, apiClient]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline, stateRevision]);

  const getEventIcon = (kind: TimelineEvent['kind']) => {
    switch (kind) {
      case 'project_created':
        return <Compass className="w-4 h-4 text-orange-500" />;
      case 'discovery_turn':
        return <Sparkles className="w-4 h-4 text-orange-500" />;
      case 'decision_confirmed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'decision_locked':
        return <Lock className="w-4 h-4 text-zinc-500" />;
      case 'decision_unlocked':
        return <Unlock className="w-4 h-4 text-amber-500" />;
      case 'overview_edited':
        return <Edit3 className="w-4 h-4 text-blue-500" />;
      case 'question_answered':
        return <HelpCircle className="w-4 h-4 text-purple-500" />;
      case 'input_added':
        return <Paperclip className="w-4 h-4 text-indigo-500" />;
      case 'readiness_reviewed':
      case 'readiness_dispositioned':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'documents_compiled':
        return <FileText className="w-4 h-4 text-emerald-600" />;
      case 'provider_failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <History className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getActorBadge = (actor: TimelineEvent['actor']) => {
    switch (actor) {
      case 'user':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
            <User className="w-2.5 h-2.5" />
            <span>用户操作</span>
          </span>
        );
      case 'agent':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/80 px-1.5 py-0.2 rounded border border-orange-200 dark:border-orange-800">
            <Bot className="w-2.5 h-2.5" />
            <span>AI 推演</span>
          </span>
        );
      case 'system':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700">
            <Cpu className="w-2.5 h-2.5" />
            <span>系统内核</span>
          </span>
        );
    }
  };

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={Compass}
        title="未载入项目"
        description="请在首页新建或打开已有项目以查看时间线。"
        className="py-16"
      />
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <History className="w-4 h-4 text-orange-500" />
            <span>项目演进时间线</span>
            {timeline && (
              <span className="text-xs font-normal text-zinc-400">
                ({timeline.totalEvents} 个事实事件)
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            由决策轨迹、输入材料与版本快照实时派生的活动时间流
          </p>
        </div>

        <button
          onClick={fetchTimeline}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="刷新时间线"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && !timeline && (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-200 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={fetchTimeline}
            className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[11px] font-medium hover:bg-red-700 transition-colors cursor-pointer"
          >
            重试
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && timeline && timeline.events.length === 0 && (
        <EmptyState
          icon={History}
          title="暂无活动事件"
          description="当你在对话中确立决策或上传材料后，系统将按时间顺序实时记录事件流。"
          className="py-16"
        />
      )}

      {/* Timeline Stream */}
      {timeline && timeline.events.length > 0 && (
        <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6">
          {timeline.events.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Timeline Bullet Node */}
              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-[#0C0D0F] border-2 border-orange-500 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              </div>

              {/* Event Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-2 transition-all">
                {/* Event Card Top Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
                      {getEventIcon(evt.kind)}
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {evt.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {getActorBadge(evt.actor)}
                    <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                      rev.{evt.sourceStateRevision}
                    </span>
                  </div>
                </div>

                {/* Event Summary */}
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {evt.summary}
                </p>

                {/* Related Refs & Timestamp Footer */}
                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[10px]">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {evt.relatedRefs &&
                      evt.relatedRefs.map((ref) => (
                        <span
                          key={ref}
                          className="font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        >
                          {ref}
                        </span>
                      ))}
                  </div>
                  <span className="font-mono text-zinc-400 shrink-0 ml-2">
                    {new Date(evt.occurredAt || evt.timestamp || '').toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
