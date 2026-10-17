import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { ProviderHealthResponse } from '@project-architect/contracts';
import { Modal } from '../../components/common/Modal.js';
import { defaultApiClient } from '../../api/client.js';
import {
  describeContextDestination,
  describeInferenceLocation,
  describeStructuredOutput,
} from '../settings/ProviderDiagnosticsPanel.js';

interface ProviderHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProviderHealthModal: React.FC<ProviderHealthModalProps> = ({
  isOpen,
  onClose,
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
      setErrorMsg(err.message || '无法获取引擎状态');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchHealth();
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="本地 AI 引擎与隐私安全状态"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>重新探活</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭探活弹窗"
            className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header subtitle / indicator banner */}
        <div className="flex items-center gap-2.5 pb-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              单次推演契约与本地优先架构
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              客观展示当前本地推理管道、模型健康度与数据保护边界
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
            <span>正在探测本地 Provider 运行状态...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Status Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70">
                <span className="text-xs font-mono text-zinc-400">运行状态</span>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 flex items-center gap-1.5">
                  {health?.status === 'ready' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">就绪 (Ready)</span>
                    </>
                  ) : health?.status === 'degraded' ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">降级 (Degraded)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">不可用 (Unavailable)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70">
                <span className="text-xs font-mono text-zinc-400">推理位置与通道</span>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate">
                  {describeInferenceLocation(health?.inferenceLocation)}
                </div>
              </div>
            </div>

            {/* CLI Executable & Model details */}
            {health?.executable && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70">
                <span className="text-xs font-mono text-zinc-400">本地 CLI 路径与模型</span>
                <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 mt-0.5 truncate" title={health.executable}>
                  {health.executable}
                </div>
                {health.modelName && (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    模型与引擎：{health.modelName}
                  </div>
                )}
              </div>
            )}

            {/* Data & Privacy Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70">
                <span className="text-xs font-mono text-zinc-400">上下文数据去向</span>
                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">
                  {describeContextDestination(health?.sendsProjectContextOffDevice)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70">
                <span className="text-xs font-mono text-zinc-400">结构化契约支持</span>
                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">
                  {describeStructuredOutput(health?.structuredOutput)}
                </div>
              </div>
            </div>

            {/* Local-First Architecture Guarantee */}
            <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-200">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <span>客观透明的本地与数据安全声明</span>
              </div>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-none">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>本地存储保障</strong>：项目状态、决策与规范文档 100% 保存在本机文件系统，无中心化数据库。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>透明推演请求</strong>：单轮推演仅将当前任务所需的精简上下文提交给 Provider，严格单次调用。</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>用户授权原则</strong>：AI 输出仅作为待办或建议候选，未经用户确认绝不擅自写入正式决策。</span>
                </li>
              </ul>
            </div>

            {/* Guidance / Error description */}
            {health?.guidance && (
              <div className="p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {health.guidance}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
