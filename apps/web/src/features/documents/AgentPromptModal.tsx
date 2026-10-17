import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { Copy, Check, Terminal, Sparkles, Bot, Code } from 'lucide-react';
import { useToast } from '../../components/common/Toast.js';

interface AgentPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  stateRevision?: number;
  warnings?: string[];
  assumptions?: string[];
  knownIssues?: string[];
  documentsCount?: number;
}

type AgentType = 'cursor' | 'claude' | 'antigravity' | 'aider';

export const AgentPromptModal: React.FC<AgentPromptModalProps> = ({
  isOpen,
  onClose,
  projectName,
  stateRevision,
  warnings,
  assumptions,
  documentsCount,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('cursor');
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  const revTag = stateRevision ? `rev.${stateRevision}` : '最新版本';
  const docsCountText = documentsCount ? `${documentsCount} 份` : '8 份核心';
  const assumptionsText =
    assumptions && assumptions.length > 0
      ? `\n\n【关键未验证假设 (${assumptions.length} 项)】：\n` + assumptions.map((a) => `- ${a}`).join('\n')
      : '';
  const warningsText =
    warnings && warnings.length > 0
      ? `\n\n【已知风险与警告 (${warnings.length} 项)】：\n` + warnings.map((w) => `- ${w}`).join('\n')
      : '';

  const getPromptContent = () => {
    switch (selectedAgent) {
      case 'cursor':
        return `# Project Architect Blueprint Directive for Cursor (${revTag})

项目【${projectName}】阶段性架构蓝图已编译（基于状态版本 ${revTag}，共计 ${docsCountText}规范文档）。
根目录下已放置开发规范蓝图：
- AGENTS.md（总开发指引与核心边界约束）
- docs/PROJECT.md（项目全景与边界）
- docs/PRODUCT.md（目标用户与 MVP 范围）
- docs/USER_FLOWS.md（核心用户旅程与状态变迁）
- docs/UX_UI_SPEC.md（界面体验基调与约束）
- docs/TECHNICAL_GUIDE.md（轻量技术约束与平台选型）
- docs/DEVELOPMENT_PLAN.md（开发里程碑与分阶段计划）
- docs/ACCEPTANCE.md（验收标准）${assumptionsText}${warningsText}

【执行指令】：
请优先仔细阅读 AGENTS.md 和 docs/PROJECT.md，严格遵循 docs/DEVELOPMENT_PLAN.md 中的 Milestone 1 开始进行代码实现，严禁脱离蓝图私自扩展范围！`;

      case 'claude':
        return `# CLAUDE.md / Coding Agent Directive for Claude Code

项目名称：${projectName}（状态版本: ${revTag}）
开发原则：严格基于已确认的 Project Architect 蓝图规范开展开发。

【核心文档阅读顺序】：
1. AGENTS.md —— 查看核心架构红线与不可触碰边界
2. docs/PROJECT.md & docs/PRODUCT.md —— 明确 MVP 范围与非目标
3. docs/TECHNICAL_GUIDE.md —— 遵循已确认的技术选型与安全底线
4. docs/DEVELOPMENT_PLAN.md —— 遵循 Milestone 1 开发规划${assumptionsText}${warningsText}

请以此作为唯一事实来源开始进行任务规划与代码编写。`;

      case 'antigravity':
        return `# Antigravity Pair Programming Directive (${revTag})

目标项目：${projectName}
上下文说明：
本项目基于 Project Architect 状态版本 ${revTag} 编译生成 ${docsCountText}规范文档。
所有已确认事实与技术边界已编译至 AGENTS.md 及 docs/ 目录下。${assumptionsText}${warningsText}

请阅读根目录下的 AGENTS.md 并列出 Milestone 1 所需创建的文件与验证计划。`;

      case 'aider':
        return `aider --read AGENTS.md --read docs/PROJECT.md --read docs/PRODUCT.md --read docs/TECHNICAL_GUIDE.md --message "基于项目 ${projectName} (${revTag}) 的架构规范，按 Milestone 1 开始第一阶段开发。"`;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getPromptContent());
    setCopied(true);
    success('已成功复制 Agent 启动提示词到剪贴板', '复制成功');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="复制 Coding Agent 唤醒提示词"
      maxWidth="lg"
      closeLabel="关闭提示词弹窗"
    >
      <div className="space-y-4">

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          将以下提示词直接发送给你的 AI Coding Agent（如 Cursor、Claude Code、Antigravity 等），引导其严格遵循已确认的工程蓝图开工，防止 AI 随意发挥或偏离架构底线。
        </p>

        {/* Agent Preset Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
          <button
            type="button"
            onClick={() => setSelectedAgent('cursor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedAgent === 'cursor'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-blue-500" />
            <span>Cursor / IDE</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAgent('claude')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedAgent === 'claude'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Claude Code</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAgent('antigravity')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedAgent === 'antigravity'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Antigravity</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAgent('aider')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedAgent === 'aider'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-emerald-500" />
            <span>Aider CLI</span>
          </button>
        </div>

        {/* Prompt Content Preview */}
        <div className="relative">
          <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-xs leading-relaxed overflow-x-auto max-h-60 border border-zinc-800 whitespace-pre-wrap select-text">
            {getPromptContent()}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制！' : '一键复制提示词'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
