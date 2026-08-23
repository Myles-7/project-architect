import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Paperclip, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import type { AttachedFile } from '../../types/project';
import { useToast } from '../common/Toast';

interface FilesViewProps {
  files: AttachedFile[];
  onAddFile: (file: AttachedFile) => void;
  onRemoveFile: (fileId: string) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({
  files,
  onAddFile,
  onRemoveFile,
}) => {
  const { showToast } = useToast();
  const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleMockUpload = (type: 'markdown' | 'image' | 'pdf') => {
    const newFile: AttachedFile = {
      id: 'file-' + Date.now(),
      name: type === 'image' ? 'app_mockup_v2.png' : type === 'pdf' ? 'market_research.pdf' : 'backend_architecture.md',
      size: type === 'image' ? '1.4 MB' : type === 'pdf' ? '3.2 MB' : '15 KB',
      type,
      status: 'parsed',
      summary: '已提取其中的架构约束与数据模型，已合并入上下文分析'
    };
    onAddFile(newFile);
    setSelectedFileId(newFile.id);
    showToast('已挂载新材料', newFile.name, 'success');
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedFile = files.find((f) => f.id === selectedFileId) || filteredFiles[0];

  return (
    <div className="flex-1 flex flex-col sm:flex-row h-full overflow-hidden bg-white dark:bg-[#16171B]">
      {/* Left File List */}
      <div className="w-full sm:w-72 border-b sm:border-b-0 sm:border-r border-[#E3E0D8] dark:border-[#23252B] bg-[#EFECE6] dark:bg-[#0B0C0E] flex flex-col shrink-0">
        <div className="p-3 border-b border-[#E3E0D8] dark:border-[#23252B] space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-orange-500" />
              <span>输入材料与附件 ({files.length})</span>
            </h3>
          </div>

          <div className="relative">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索材料..."
              className="w-full pl-7 pr-3 py-1 text-xs bg-white dark:bg-[#111215] border border-[#E3E0D8] dark:border-[#23252B] rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Upload Presets */}
          <div className="flex gap-1 pt-0.5">
            <button
              onClick={() => handleMockUpload('markdown')}
              className="flex-1 py-1 rounded bg-white dark:bg-[#1A1B20] border border-[#E3E0D8] dark:border-[#23252B] hover:border-zinc-400 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>.md 文档</span>
            </button>
            <button
              onClick={() => handleMockUpload('image')}
              className="flex-1 py-1 rounded bg-white dark:bg-[#1A1B20] border border-[#E3E0D8] dark:border-[#23252B] hover:border-zinc-400 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>.png 图片</span>
            </button>
          </div>
        </div>

        {/* Files Scroll List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 px-3 text-zinc-400 text-xs space-y-1">
              <p className="text-[11px]">未找到匹配的素材</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[10px] text-orange-600 hover:underline cursor-pointer"
                >
                  清除搜索
                </button>
              )}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isSelected = selectedFile?.id === file.id;
              return (
                <div
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-white dark:bg-[#1C1D22] border-orange-500/80 shadow-2xs'
                      : 'bg-transparent border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-start gap-2 overflow-hidden">
                    {file.type === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                    ) : file.type === 'pdf' ? (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <div className="truncate">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate text-[11px]">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5 font-mono">
                        <span>{file.size}</span>
                        <span>·</span>
                        <span className="text-emerald-600 dark:text-emerald-400">已提取事实</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(file.id);
                      showToast('已移除材料', file.name, 'info');
                    }}
                    aria-label="删除素材"
                    className="text-zinc-400 hover:text-rose-500 p-0.5 transition-colors shrink-0 opacity-60 hover:opacity-100"
                    title="删除材料"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right File Detail & Summary Preview */}
      <div className="flex-1 flex flex-col overflow-y-auto p-5 sm:p-7 space-y-4">
        {selectedFile ? (
          <>
            <div className="border-b border-[#E3E0D8] dark:border-[#23252B] pb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase font-semibold">
                  {selectedFile.type}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>已完成首次语义提取 (Parsed)</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {selectedFile.name}
              </h2>
              <div className="text-[11px] text-zinc-500 font-mono">
                文件大小: {selectedFile.size} · 契约状态: Single Agent Material Input
              </div>
            </div>

            {/* AI Extracted Facts Box */}
            <div className="p-3.5 rounded-xl border border-[#E3E0D8] dark:border-[#23252B] bg-[#FAF9F6] dark:bg-[#131417] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>提取的结构化事实摘要</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {selectedFile.summary || '已将材料中的用户陈述与潜在约束分离。用户未明确确认的部分保持为 Candidate，未覆盖的架构关键点已列入 Gap 提问清单。'}
              </p>
              <div className="pt-2 border-t border-[#E3E0D8]/60 dark:border-[#23252B] flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                <span>来源: 用户素材</span>
                <span>·</span>
                <span>锁定状态: 待审阅</span>
              </div>
            </div>

            {/* Raw Content Preview */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                原始素材预览 (只读)
              </div>
              <div className="p-3.5 rounded-xl border border-[#E3E0D8] dark:border-[#23252B] bg-[#FAF9F6] dark:bg-[#111215] font-mono text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed overflow-x-auto">
                <pre className="whitespace-pre-wrap">
                  {selectedFile.type === 'markdown' ? (
`# ${selectedFile.name}

## 1. 核心需求备忘
- 目标是做一个人自用、不依赖任何云服务账号的极简工作台。
- 必须要生成 AGENTS.md 供 Cursor、Antigravity 识别系统边界与阅读顺序。
- 风格上希望参考 Linear UI Refresh，冷暖灰调、安静、低自我表现欲。

## 2. 待定约束
- 本地存储优先采用 JSON 目录，支持 Git 版本控制。
- 每次 AI 提问只问 1 个高优先级问题，绝不一次抛出一长串表单。`
                  ) : (
`[Image Preview Mock: ${selectedFile.name}]
Resolution: 1920x1080
Color Tokens: Soft line #E3E0D8, Warm Dark #15161A, Muted Gray #78736B, Surface #FAF9F6
AI Layout Recognition: 检测到三栏工作台布局、高辨识橙色标签、紧凑顶部栏设计。`
                  )}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-xs text-zinc-400">
            暂无选中的素材
          </div>
        )}
      </div>
    </div>
  );
};
