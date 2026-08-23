import React, { useState } from 'react';
import { 
  Send, 
  Paperclip, 
  Sparkles
} from 'lucide-react';
import { useToast } from '../common/Toast';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onTriggerReadiness: () => void;
  onAddAttachment: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onTriggerReadiness,
  onAddAttachment,
}) => {
  const [inputText, setInputText] = useState('');
  const { showToast } = useToast();

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    { label: '发起准备度审阅', action: onTriggerReadiness, isHighlight: true },
    { label: '补充开发阶段约束', text: '阶段规划方面：V1 预计 1 周内完成原型，请帮我收敛 MVP 功能清单。' },
    { label: '纠偏目标用户画像', text: '补充目标用户：重点服务于熟悉 TypeScript 与 CLI 的高阶全栈独立开发者。' },
    { label: '深挖异常流程分支', text: '请深挖多材料解析失败或大图超限时的降级策略。' }
  ];

  return (
    <div className="p-4 sm:p-5 bg-[#F7F6F3] dark:bg-[#0A0B0D] border-t border-[#E5E2DA] dark:border-[#1E2026] shrink-0">
      <div className="max-w-4xl mx-auto w-full space-y-2.5">
        {/* Quick Intent Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono shrink-0 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>意图指令:</span>
          </span>
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (item.action) {
                  item.action();
                } else if (item.text) {
                  setInputText(item.text);
                  showToast('已填入意图', '按 Ctrl+Enter 发送', 'info');
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                item.isHighlight
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 font-semibold hover:bg-amber-200'
                  : 'bg-white dark:bg-[#15161A] text-zinc-700 dark:text-zinc-300 border-[#E5E2DA] dark:border-[#1E2026] hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="relative bg-white dark:bg-[#121316] border border-[#E5E2DA] dark:border-[#1E2026] rounded-2xl p-4 shadow-2xs focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all space-y-2.5">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="向工作台补充细节、纠偏 AI 理解、提供新约束，或回答下一个架构问题... (Ctrl + Enter 发送)"
            rows={2}
            className="w-full text-sm bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed font-sans"
          />

          <div className="flex items-center justify-between pt-2.5 border-t border-[#E5E2DA]/60 dark:border-[#1E2026]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAddAttachment}
                className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                title="模拟上传参考材料"
              >
                <Paperclip className="w-4 h-4 text-zinc-500" />
                <span>附加材料</span>
              </button>
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                Single Agent · 自由纠偏
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-zinc-400 font-mono">
                Ctrl + ↵
              </span>
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
              >
                <span>推进思考</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
