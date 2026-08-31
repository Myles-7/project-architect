import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { FileText, Image as ImageIcon, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { InputMaterialKind } from '@project-architect/contracts';

interface UploadMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    kind: InputMaterialKind,
    filename: string,
    content: string,
    contentEncoding?: 'utf8' | 'base64'
  ) => Promise<void>;
  isUploading: boolean;
}

export const UploadMaterialModal: React.FC<UploadMaterialModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  isUploading,
}) => {
  const [kind, setKind] = useState<InputMaterialKind>('text');
  const [filename, setFilename] = useState('');
  const [textContent, setTextContent] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [docFormatWarning, setDocFormatWarning] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('文件大小超出限制 (单文件最大 20MB)');
      return;
    }

    setErrorMsg(null);
    setFilename(file.name);

    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    const isDoc = /\.(pdf|docx)$/i.test(file.name);

    if (isDoc) {
      setDocFormatWarning(
        `检测到 ${file.name.endsWith('.pdf') ? 'PDF' : 'DOCX'} 文档。本地环境不携带外部 OCR 解析器，无法直接分析此文档内容。强烈建议直接从文档复制核心要点，切换为纯文本粘贴！`
      );
    } else {
      setDocFormatWarning(null);
    }

    if (isImage) {
      setKind('image');
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string) || '';
        const rawBase64 = result.includes(',') ? result.split(',')[1] : result;
        setFileBase64(rawBase64);
      };
      reader.readAsDataURL(file);
    } else if (isDoc) {
      setKind('file');
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string) || '';
        const rawBase64 = result.includes(',') ? result.split(',')[1] : result;
        setFileBase64(rawBase64);
      };
      reader.readAsDataURL(file);
    } else {
      setKind('text');
      const reader = new FileReader();
      reader.onload = () => {
        setTextContent(reader.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) {
      setErrorMsg('请输入有效的文件名');
      return;
    }

    const isBinary = kind === 'image' || kind === 'file';
    const content = isBinary ? fileBase64 : textContent;
    const contentEncoding = isBinary ? 'base64' : 'utf8';

    if (!content.trim()) {
      setErrorMsg('材料内容不能为空');
      return;
    }

    setErrorMsg(null);
    try {
      await onUpload(kind, filename.trim(), content, contentEncoding);
      onClose();
      // Reset form
      setFilename('');
      setTextContent('');
      setFileBase64('');
    } catch (err: any) {
      setErrorMsg(err.message || '上传材料失败');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="挂载输入材料与附件"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>受本地 Workspace 隔离保护</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition-colors cursor-pointer shadow-xs"
            >
              {isUploading ? '正在保存...' : '确认挂载'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-900 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {docFormatWarning && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{docFormatWarning}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setKind('text');
                setDocFormatWarning(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-200/80 dark:bg-amber-900/80 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 transition-colors cursor-pointer"
            >
              <span>转为手动粘贴纯文本</span>
            </button>
          </div>
        )}

        {/* Kind Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind('text')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
              kind === 'text'
                ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 text-zinc-900 dark:text-zinc-100'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <FileText className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold">文本 / Markdown 文档</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                参与 Discovery 结构化推演分析
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setKind('image')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
              kind === 'image' || kind === 'file'
                ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 text-zinc-900 dark:text-zinc-100'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold">图片 / 原型素材 / PDF</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                安全保存在本地，不可多模态解析
              </div>
            </div>
          </button>
        </div>

        {/* Local File Browser Button */}
        <div className="p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/20 text-center space-y-1.5">
          <input
            type="file"
            id="file-upload"
            onChange={handleFileChange}
            className="hidden"
            accept={kind === 'text' ? '.md,.txt' : '.png,.jpg,.jpeg,.webp,.pdf,.docx'}
          />
          <label
            htmlFor="file-upload"
            className="inline-block px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            浏览本地文件
          </label>
          <div className="text-[10px] text-zinc-400">
            支持 .md / .txt（参与分析）或 .png / .jpg / .webp / .pdf / .docx（存档保存）
          </div>
        </div>

        {/* Filename Field */}
        <div className="space-y-1.5">
          <label htmlFor="material-filename" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            材料标识名称 (Filename)
          </label>
          <input
            id="material-filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={kind === 'image' ? 'app_mockup.png' : 'requirements.md'}
            className="w-full px-3.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
            required
          />
        </div>

        {/* Pre-upload Inspection Preview */}
        {filename && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2 text-xs animate-in fade-in">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
              <span>文件解析与上下文预检</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                .{filename.split('.').pop()?.toLowerCase() || 'unknown'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <span className="text-zinc-400 block mb-0.5">文本提取能力</span>
                <span className={`font-semibold ${kind === 'text' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {kind === 'text' ? '✓ 可完整提取纯文本' : '✗ 二进制仅保存附件'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <span className="text-zinc-400 block mb-0.5">纳入 AI 推演上下文</span>
                <span className={`font-semibold ${kind === 'text' ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'}`}>
                  {kind === 'text' ? '✓ 自动纳入上下文' : '✗ 仅本地归档参考'}
                </span>
              </div>
            </div>
            {kind === 'image' && (
              <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>重要告知：图片素材当前仅作为原型草图保存在项目本地目录，不会送入大模型推演上下文进行分析。</span>
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        {kind === 'text' ? (
          <div className="space-y-1.5">
            <label htmlFor="material-text-content" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              文本内容
            </label>
            <textarea
              id="material-text-content"
              rows={5}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="在此粘贴需求文档、业务背景或架构草稿..."
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 font-mono"
            />
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>V1 诚实性边界提示</span>
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
              图片与二进制素材将安全存储在项目本地 <code>inputs/</code> 目录中作为参考素材，但 V1 Discovery 推演暂不提供多模态文本提取能力。
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
};
