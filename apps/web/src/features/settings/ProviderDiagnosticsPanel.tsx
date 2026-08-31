import React, { useEffect, useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Shield,
  Database,
} from 'lucide-react';
import type { ProviderHealthResponse } from '@project-architect/contracts';
import { defaultApiClient } from '../../api/client.js';

interface ProviderDiagnosticsPanelProps {
  projectId?: string;
  projectPath?: string;
}

export const describeInferenceLocation = (value?: ProviderHealthResponse['inferenceLocation']): string => {
  if (value === 'local') return '本地模型';
  if (value === 'remote') return '远程 Provider';
  return '无法确认';
};

export const describeContextDestination = (value?: ProviderHealthResponse['sendsProjectContextOffDevice']): string => {
  if (value === true) return '发送精简上下文至 Provider';
  if (value === false) return '不离开当前设备';
  return '无法确认';
};

export const describeStructuredOutput = (value?: ProviderHealthResponse['structuredOutput']): string => {
  if (value === 'supported') return '支持，运行时执行 B3 强校验';
  if (value === 'unsupported') return 'Provider 不支持';
  return '尚未确认';
};

export const describePromptCache = (value?: ProviderHealthResponse['promptCache']): string => {
  if (value === 'observed') return '已观测到缓存命中';
  if (value === 'supported') return 'Provider 声明支持';
  if (value === 'unsupported') return 'Provider 不支持';
  return '尚未确认';
};

export const ProviderDiagnosticsPanel: React.FC<ProviderDiagnosticsPanelProps> = ({
  projectId,
  projectPath,
}) => {
  const [health, setHealth] = useState<ProviderHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await defaultApiClient.getProviderHealth();
      setHealth(data);
    } catch (err: any) {
      setErrorMsg(err.message || '无法获取 Provider 诊断信息');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-orange-500" />
          <span>AI 引擎与数据安全诊断中心</span>
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          实时监控本地存储路径、AI 推理通道、结构化契约与数据传输去向
        </p>
      </div>

      {/* Health Status Banner */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">引擎可用性状态:</span>
            {loading ? (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                <RefreshCw className="w-3 h-3 animate-spin text-orange-500" />
                <span>正在探测...</span>
              </span>
            ) : health?.status === 'ready' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>运行正常 (Ready)</span>
              </span>
            ) : health?.status === 'degraded' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>降级运行 (Degraded)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>不可用 (Unavailable)</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>重新检测</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {health?.guidance && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {health.guidance}
          </div>
        )}
      </div>

      {/* Grid Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core Infrastructure */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-zinc-400" />
            <span>推理通道与执行凭据</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-400">活跃 Provider</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{health?.providerName || '-'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-400">底层模型</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{health?.modelName || '-'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-400">CLI 可执行文件</span>
              <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]" title={health?.executable}>
                {health?.executable || '系统默认 PATH (agy.exe)'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">最近探活时间</span>
              <span className="text-[11px] text-zinc-500 font-mono">
                {health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Data Safety & Privacy Metrics */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>数据存储与网络边界</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-400">计算与推理位置</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {describeInferenceLocation(health?.inferenceLocation)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-400">上下文数据去向</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {describeContextDestination(health?.sendsProjectContextOffDevice)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/60">
              <span className="text-zinc-400">结构化契约 (B3)</span>
              <span className="text-zinc-700 dark:text-zinc-300">{describeStructuredOutput(health?.structuredOutput)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">提示词缓存 (Cache)</span>
              <span className="text-zinc-700 dark:text-zinc-300">{describePromptCache(health?.promptCache)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Local Storage */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#17181D] border border-zinc-200 dark:border-zinc-800 space-y-3">
        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-zinc-400" />
          <span>当前项目本地存储规范</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex flex-col gap-1 py-1 border-b border-zinc-100 dark:border-zinc-800/60">
            <span className="text-zinc-400">项目标识 (Project ID)</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{projectId || '未载入'}</span>
          </div>
          <div className="flex flex-col gap-1 py-1">
            <span className="text-zinc-400">本地磁盘实际路径</span>
            <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all">
              {projectPath || '由工作区统一接管'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
