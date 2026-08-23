import React, { useState } from 'react';
import { 
  Settings, 
  Cpu, 
  HardDrive, 
  RotateCcw, 
  Keyboard
} from 'lucide-react';
import { useToast } from '../common/Toast';

interface SettingsViewProps {
  onResetDemo: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onResetDemo }) => {
  const { showToast } = useToast();
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'local'>('gemini');
  const [singleInference, setSingleInference] = useState(true);

  const handleSavePreferences = () => {
    showToast('偏好设置已保存', '已更新本地 Agent 推理配置', 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-7 bg-[#FAF9F6] dark:bg-[#111215] space-y-5 max-w-3xl mx-auto w-full">
      <div className="border-b border-[#E3E0D8] dark:border-[#23252B] pb-3 space-y-1">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-orange-500" />
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            本地设置与环境偏好 (Settings)
          </h1>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          管理本地单机 AI Provider、状态持久化路径与工作台交互偏好
        </p>
      </div>

      {/* AI Provider Config */}
      <div className="p-4 rounded-xl border border-[#E3E0D8] dark:border-[#23252B] bg-white dark:bg-[#16171B] shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <Cpu className="w-3.5 h-3.5 text-orange-500" />
          <span>Single Agent Runtime 推理模型设置</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {[
            { id: 'gemini', name: 'Gemini 3.7 Flash', desc: '推荐 · 结构化契约与 Gap 发现' },
            { id: 'claude', name: 'Claude 3.7 Sonnet', desc: '深度架构推理与长材料解析' },
            { id: 'local', name: 'Local Ollama / Qwen', desc: '100% 离线单机运行' }
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => setProvider(item.id as any)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                provider === item.id
                  ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 ring-1 ring-orange-500'
                  : 'border-[#E3E0D8] dark:border-[#23252B] bg-[#FAF9F6] dark:bg-[#141519] hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px]">{item.name}</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[#E3E0D8]/60 dark:border-[#23252B]">
          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={singleInference}
              onChange={(e) => setSingleInference(e.target.checked)}
              className="accent-orange-500 rounded"
            />
            <span className="text-[11px] font-medium">强制单次推理闭环 (Single Agent 严格规范，杜绝隐蔽黑盒调用)</span>
          </label>
        </div>
      </div>

      {/* Local Storage Info */}
      <div className="p-4 rounded-xl border border-[#E3E0D8] dark:border-[#23252B] bg-white dark:bg-[#16171B] shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
          <span>本地数据存储路径 (Single Source of Truth)</span>
        </div>

        <div className="p-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#111215] border border-[#E3E0D8] dark:border-[#23252B] font-mono text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
          <div className="truncate text-[11px]">
            <code>d:\桌面\项目构思\state\</code>
          </div>
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold font-mono px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950">
            Git JSON
          </span>
        </div>

        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono">
          所有已确认决定、候选建议、暂定假设、Readiness 快照均保存为标准 JSON，输出至 docs/ 与 AGENTS.md。
        </p>
      </div>

      {/* Shortcuts Guide */}
      <div className="p-4 rounded-xl border border-[#E3E0D8] dark:border-[#23252B] bg-white dark:bg-[#16171B] shadow-2xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <Keyboard className="w-3.5 h-3.5 text-sky-500" />
          <span>常用快捷键</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-md bg-[#FAF9F6] dark:bg-[#141519] border border-[#E3E0D8] dark:border-[#23252B]">
            <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">发送并推进</span>
            <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
              Ctrl + Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-[#FAF9F6] dark:bg-[#141519] border border-[#E3E0D8] dark:border-[#23252B]">
            <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">关闭弹窗</span>
            <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
              Esc
            </kbd>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center justify-between">
        <button
          onClick={handleSavePreferences}
          className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium shadow-2xs transition-all cursor-pointer"
        >
          保存设置
        </button>

        <button
          onClick={() => {
            onResetDemo();
            showToast('已重置原型演示数据', '已恢复初始 Idea 与分析状态', 'info');
          }}
          className="px-3.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>重置演示数据</span>
        </button>
      </div>
    </div>
  );
};
