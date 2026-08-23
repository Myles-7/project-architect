import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  FileText, 
  Clock, 
  FolderGit2, 
  Cpu, 
  Sun,
  Moon
} from 'lucide-react';
import type { AttachedFile } from '../../types/project';
import { MOCK_RECENT_PROJECTS, type RecentProjectSummary } from '../../data/mockProjects';
import { useToast } from '../common/Toast';

interface HomePageProps {
  onStartProject: (ideaText: string, attachedFiles: AttachedFile[]) => void;
  onOpenRecentProject: (rec: RecentProjectSummary) => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const HomePage: React.FC<HomePageProps> = ({ 
  onStartProject, 
  onOpenRecentProject,
  darkMode,
  setDarkMode
}) => {
  const { showToast } = useToast();
  const [ideaText, setIdeaText] = useState(
    '做一款离线优先的 AI 项目规划工作台，帮助开发者在开始 AI Coding 之前，把模糊想法逐步梳理成明确的工程级规范、结构化 Overview、Readiness 准备度评测，以及给 Cursor / Antigravity 使用的 AGENTS.md 规范文档。'
  );

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([
    { id: 'f-init-1', name: 'rough_ideas_draft.md', size: '12 KB', type: 'markdown', status: 'parsed' },
    { id: 'f-init-2', name: 'linear_design_teardown.png', size: '1.2 MB', type: 'image', status: 'parsed' },
  ]);

  const presets = [
    {
      title: '离线优先项目构思工作台',
      text: '做一款离线优先的 AI 项目规划工作台，帮助开发者在开始 AI Coding 之前，把模糊想法逐步梳理成明确的工程级规范、结构化 Overview、Readiness 准备度评测，以及给 Cursor / Antigravity 使用的 AGENTS.md 规范文档。'
    },
    {
      title: '极速代码片段与 Prompt 调试器',
      text: '做一款针对独立全栈开发者的轻量级 Prompt 与代码片段管理器，支持本地 SQLite 存储、多模型 API 快速切换比对与按项目自动关联上下文。'
    },
    {
      title: '基于 SQLite 的轻量单人记账器',
      text: '开发一个极简、离线可用的个人记账桌面客户端，强调秒开秒记、纯本地存储、自动分类与周期性账单预测，不依赖任何云端数据库。'
    }
  ];

  const handleAddSampleMarkdown = () => {
    const newFile: AttachedFile = {
      id: `f-${Date.now()}`,
      name: 'architecture_notes.md',
      size: '8 KB',
      type: 'markdown',
      status: 'parsed',
    };
    setAttachedFiles(prev => [...prev, newFile]);
    showToast('已挂载参考材料', 'architecture_notes.md (Markdown 规格草稿)', 'info');
  };

  const handleAddSampleImage = () => {
    const newFile: AttachedFile = {
      id: `f-${Date.now()}`,
      name: 'ui_wireframe_sketch.png',
      size: '2.4 MB',
      type: 'image',
      status: 'parsed',
    };
    setAttachedFiles(prev => [...prev, newFile]);
    showToast('已挂载参考材料', 'ui_wireframe_sketch.png (界面线框手绘图)', 'info');
  };

  const handleRemoveFile = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;
    onStartProject(ideaText.trim(), attachedFiles);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#0A0B0D] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors selection:bg-orange-500/20 selection:text-orange-900 dark:selection:text-orange-200">
      {/* Top Brand Nav */}
      <header className="h-14 border-b border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3]/90 dark:bg-[#0A0B0D]/90 backdrop-blur-md sticky top-0 z-20 px-6 sm:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-xs">
            PA
          </div>
          <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            Project Architect
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            v1.0 · Single Agent Engine
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Local First · Single Source of Truth
          </span>
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="p-2 rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] hover:bg-white dark:hover:bg-[#141519] text-zinc-600 dark:text-zinc-300 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title={!darkMode ? '切换为暗色模式' : '切换为浅色模式'}
          >
            {!darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">暖白浅色</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden md:inline">极夜深色</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/70 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-300 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span>Pre-Coding Specification & Agent Blueprint Protocol</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.2]">
            在编码前把项目想清楚，生成工程级开发蓝图
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
            以 <strong className="text-zinc-900 dark:text-zinc-200 font-semibold">Gap-First</strong> 逐层收敛关键架构决策，实时沉淀项目全景 Overview，导出可直接交付给 Cursor / Antigravity 读取的 <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-orange-600 dark:text-orange-400 border border-zinc-300/80 dark:border-zinc-700 font-semibold">AGENTS.md</code> 规范矩阵。
          </p>
        </div>

        {/* Two-Column Grid: Left Composer, Right Recent Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Idea Composer (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-[#121316] rounded-2xl border border-[#E5E2DA] dark:border-[#1E2026] shadow-sm p-5 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E5E2DA]/80 dark:border-[#1E2026] pb-3.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    构思陈述 / 原始需求备忘
                  </h2>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  {ideaText.length} 字
                </span>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <textarea
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  placeholder="用自然语言描述你的新项目构思、核心功能、目标用户或技术约束..."
                  rows={5}
                  className="w-full text-sm leading-relaxed p-4 rounded-xl bg-[#F7F6F3] dark:bg-[#0E0F12] border border-[#E5E2DA] dark:border-[#1E2026] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all resize-y"
                />
              </div>

              {/* Inspiration Presets */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>灵感示例预设 (点击快速填入):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIdeaText(p.text);
                        showToast('已填入灵感预设', p.title, 'info');
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3] dark:bg-[#16171B] hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attached Files Box */}
              <div className="space-y-2.5 pt-2 border-t border-[#E5E2DA]/80 dark:border-[#1E2026]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>输入参考素材</span>
                    <span className="text-zinc-400 font-normal font-mono">({attachedFiles.length})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddSampleMarkdown}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3] dark:bg-[#16171B] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                    >
                      + .md 草稿
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSampleImage}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#E5E2DA] dark:border-[#1E2026] bg-[#F7F6F3] dark:bg-[#16171B] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                    >
                      + .png 截图
                    </button>
                  </div>
                </div>

                {attachedFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F6F3] dark:bg-[#16171B] border border-[#E5E2DA] dark:border-[#1E2026] text-xs font-mono"
                      >
                        <span className="text-xs px-1 rounded bg-zinc-200/80 dark:bg-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                          {file.type === 'image' ? 'PNG' : 'MD'}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200 font-medium">{file.name}</span>
                        <span className="text-zinc-400">({file.size})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-zinc-400 hover:text-rose-500 transition-colors ml-1 cursor-pointer"
                          title="移除"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 italic py-1">
                    暂无挂载素材，支持追加 Markdown 需求草案或界面参考截图
                  </div>
                )}
              </div>

              {/* Action Submit Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E5E2DA]/80 dark:border-[#1E2026]">
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                  按 Ctrl + Enter 极速开始
                </span>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold shadow-sm transition-all flex items-center gap-2.5 group cursor-pointer active:scale-[0.98] ml-auto"
                >
                  <span>开始构思 · 进入工作台</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Recent Workspaces & Architecture Contract (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Recent Workspaces Card */}
            <div className="bg-white dark:bg-[#121316] rounded-2xl border border-[#E5E2DA] dark:border-[#1E2026] shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E2DA]/80 dark:border-[#1E2026] pb-3">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    本地项目档案 (Recent Workspaces)
                  </h2>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  Git JSON 状态源
                </span>
              </div>

              <div className="space-y-3">
                {MOCK_RECENT_PROJECTS.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => onOpenRecentProject(ws)}
                    className="p-3.5 rounded-xl border border-[#E5E2DA] dark:border-[#1E2026] hover:border-orange-500/80 bg-[#F7F6F3]/50 dark:bg-[#16171B]/50 hover:bg-white dark:hover:bg-[#18191E] transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          ws.readinessStatus === 'ready' 
                            ? 'bg-emerald-500' 
                            : ws.readinessStatus === 'ready_with_warnings' 
                            ? 'bg-amber-500' 
                            : 'bg-rose-500'
                        }`} />
                        <h3 className="text-xs sm:text-[13px] font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {ws.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                        {ws.readinessStatus === 'ready' ? 'Ready' : ws.readinessStatus === 'ready_with_warnings' ? 'Warnings' : 'Not Ready'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {ws.tagline}
                    </p>

                    <div className="flex items-center justify-between text-xs text-zinc-400 font-mono pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{ws.updatedAt}</span>
                      </div>
                      <span className="text-orange-600 dark:text-orange-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <span>打开工作台</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Standards Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121316] border border-[#E5E2DA] dark:border-[#1E2026] text-xs space-y-3 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                <Cpu className="w-4 h-4 text-orange-500" />
                <span>Single Agent 架构准则</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                每次交互执行单次明确的澄清任务，输出严格结构化投影，并持久化到本地状态源。不启动脱缰的多智能体黑盒，确保每一步架构决策皆可审计、可回滚。
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span>✓ Gap-First 澄清</span>
                <span>✓ 7 份蓝图矩阵</span>
                <span>✓ 离线持久化</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
