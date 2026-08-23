import React, { useState } from 'react';
import {
  Paperclip,
  FileText,
  Image as ImageIcon,
  Plus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { UploadMaterialModal } from './UploadMaterialModal.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type { InputRef, InputMaterialKind } from '@project-architect/contracts';

export const FilesView: React.FC = () => {
  const { state, apiClient, refreshSnapshot } = useProjectSession();
  const { snapshot, activeProjectId, stateRevision } = state;
  const { success, error } = useToast();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const inputRefs: InputRef[] = snapshot?.metadata?.inputRefs || [];
  const [selectedInputId, setSelectedInputId] = useState<string>(inputRefs[0]?.id || '');

  const filteredInputs = inputRefs.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedInput = inputRefs.find((item) => item.id === selectedInputId) || filteredInputs[0];

  const handleUploadMaterial = async (
    kind: InputMaterialKind,
    filename: string,
    content: string,
    contentEncoding?: 'utf8' | 'base64'
  ) => {
    if (!activeProjectId) return;
    const currentRev = stateRevision || 1;

    setIsUploading(true);
    try {
      const res = await apiClient.addInput(activeProjectId, {
        projectId: activeProjectId,
        kind,
        filename,
        content,
        contentEncoding,
        expectedRevision: currentRev,
      });

      await refreshSnapshot();
      setSelectedInputId(res.inputRef.id);
      success(`已成功挂载输入材料: ${filename}`, '材料挂载成功');
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setIsConflictModalOpen(true);
      } else {
        error(err.message || '上传材料失败', '操作受阻');
        throw err;
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-orange-500" />
            <span>输入材料与附件 ({inputRefs.length})</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            受 Workspace 边界保护的安全文档与原型素材
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>上传材料</span>
        </button>
      </div>

      {inputRefs.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="暂无输入材料"
          description="你可以挂载业务背景文档、架构草稿或原型图片，以辅助 Agent 开展精准推演。"
          actionLabel="上传首个材料"
          onAction={() => setIsUploadModalOpen(true)}
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Materials List */}
          <div className="md:col-span-5 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="搜索材料..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#17181D] border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[500px]">
              {filteredInputs.map((item) => {
                const isSelected = selectedInput?.id === item.id;
                const isImage = item.kind === 'image';
                const isAvailable = item.analysisAvailability === 'available';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedInputId(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/20 shadow-2xs'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#17181D] hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        {isImage ? (
                          <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {item.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`inline-flex items-center gap-1 font-medium px-1.5 py-0.2 rounded ${
                          isAvailable
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isAvailable ? '可参与分析' : '仅归档保存'}
                      </span>
                      <span className="text-zinc-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Material Detail & Analysis Capability */}
          <div className="md:col-span-7">
            {selectedInput ? (
              <div className="p-5 rounded-2xl bg-white dark:bg-[#17181D] border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedInput.label}
                    </h3>
                    <div className="text-[11px] font-mono text-zinc-400">
                      存储位置: {selectedInput.storageRef}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      selectedInput.status === 'ready' || selectedInput.status === 'used'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : selectedInput.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {selectedInput.status}
                  </span>
                </div>

                {/* Capability Honesty Notice */}
                {selectedInput.kind === 'image' ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>图片附件分析声明</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      该素材为原型图片。已安全保存至项目的本地存储目录中，但当前本地模型不支持多模态视觉理解，未执行视觉内容提取。
                    </p>
                  </div>
                ) : selectedInput.status === 'failed' ? (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>解析提取失败</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {selectedInput.errorMessage || '文件编码或格式无法正确读取，已跳过解析。'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>已就绪并注入分析上下文</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      文本内容已包含在 Discovery 推演上下文中，供 Agent 提炼业务边界与决策事实。
                    </p>
                  </div>
                )}

                {/* Summary / Extracted content */}
                {selectedInput.summary && (
                  <div className="space-y-1.5 pt-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      材料摘要与提取事实
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-mono">
                      {selectedInput.summary}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-zinc-400">
                请在左侧选择要查看的输入材料
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadMaterialModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUploadMaterial}
        isUploading={isUploading}
      />

      {/* Concurrency Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onReload={async () => {
          await refreshSnapshot();
        }}
        expectedRevision={stateRevision || undefined}
        serverRevision={snapshot?.metadata?.stateRevision || undefined}
      />
    </div>
  );
};
