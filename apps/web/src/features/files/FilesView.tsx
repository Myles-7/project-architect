import React, { useState } from 'react';
import {
  Paperclip,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  Eye,
  EyeOff,
  Link,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { UploadMaterialModal } from './UploadMaterialModal.js';
import { MaterialActions } from './MaterialActions.js';
import { ConflictModal } from '../../components/common/ConflictModal.js';
import { EmptyState } from '../../components/common/EmptyState.js';
import { useToast } from '../../components/common/Toast.js';
import { ApiClientError } from '../../api/client.js';
import type { InputRef, InputMaterialKind, DecisionStatus, InputMaterialStatus } from '@project-architect/contracts';
import { materialFailureMessage } from './materialUploads.js';
import { MaterialStatusNotice } from './MaterialStatusNotice.js';

const decisionStatusLabels: Record<DecisionStatus, string> = { candidate: '候选待确认', confirmed: '已确认', locked: '已锁定', superseded: '已替代', rejected: '已拒绝', deprecated: '已停用' };
const materialStatusLabels: Record<InputMaterialStatus, string> = { saved: '已保存', processing: '处理中', ready: '可读取', used: '已使用', failed: '处理失败', excluded: '已排除' };

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
  const [isTogglingExclusion, setIsTogglingExclusion] = useState(false);

  const referringDecisions = (snapshot?.decisions?.items || []).filter((d) => {
    if (!selectedInput) return false;
    const cleanId = selectedInput.id;
    const shortId = cleanId.replace(/^input:/, '');
    const refs = (d.evidenceRefs || []).map((r) => String(r));
    return (
      refs.includes(cleanId) ||
      refs.includes(shortId) ||
      refs.includes(`input:${shortId}`)
    );
  });

  const handleToggleExclusion = async (inputId: string, currentStatus: string) => {
    if (!activeProjectId) return;
    setIsTogglingExclusion(true);
    try {
      const shouldExclude = currentStatus !== 'excluded';
      await apiClient.toggleInputExclusion(activeProjectId, inputId, shouldExclude);
      await refreshSnapshot();
      success(
        shouldExclude ? '已将该材料移出 AI 推演上下文' : '已将该材料重新纳入 AI 推演上下文',
        '上下文设置已更新'
      );
    } catch (err: any) {
      error(err.message || '切换材料状态失败', '操作受阻');
    } finally {
      setIsTogglingExclusion(false);
    }
  };

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
      const extractionFailure = materialFailureMessage(res.inputRef);
      if (extractionFailure) throw new Error(extractionFailure);
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
  const handleDeleteMaterial = async (inputId: string) => {
    if (!activeProjectId) return;
    try {
      await apiClient.toggleInputExclusion(activeProjectId, inputId, true);
      await refreshSnapshot();
      success('已将该材料移入回收站/排除上下文', '已删除');
    } catch (err: any) {
      error(err.message || '删除材料失败', '操作受阻');
    }
  };

  const handleReplaceMaterial = async (file: File) => {
    if (!activeProjectId || !selectedInput) return;
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    const isDoc = /\.(pdf|docx)$/i.test(file.name);
    const kind = isImage ? 'image' : isDoc ? 'file' : 'text';

    const reader = new FileReader();
    if (isImage || isDoc) {
      reader.onload = async () => {
        const result = (reader.result as string) || '';
        const rawBase64 = result.includes(',') ? result.split(',')[1] : result;
        await handleUploadMaterial(kind, file.name, rawBase64, 'base64');
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = async () => {
        const text = (reader.result as string) || '';
        await handleUploadMaterial('text', file.name, text, 'utf8');
      };
      reader.readAsText(file);
    }
  };

  const handleRetryExtract = async () => {
    if (!activeProjectId) return;
    try {
      const latest = await refreshSnapshot();
      if (!latest) { error('无法读取最新材料状态', '刷新失败'); return; }
      const input = latest.metadata.inputRefs.find(item => item.id === selectedInput?.id);
      const extractionFailure = input ? materialFailureMessage(input) : null;
      if (extractionFailure) error(extractionFailure, '提取仍未成功');
      else success('已读取最新材料状态', '状态已刷新');
    } catch (err: any) {
      error(err.message || '重试提取失败', '操作受阻');
    }
  };

  return (
    <div className="workspace-materials max-w-5xl w-full mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="planning-eyebrow">PROJECT MATERIALS</p><h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-orange-500" />
            <span>输入材料与附件 ({inputRefs.length})</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            添加想法、文档与设计参考，查看可读状态和使用情况。
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
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-card border border-border-subtle rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[500px]">
              {filteredInputs.map((item) => {
                const isSelected = selectedInput?.id === item.id;
                const isImage = item.kind === 'image';
                const isAvailable = item.analysisAvailability === 'available' && item.status !== 'failed';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedInputId(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/20 shadow-2xs'
                        : 'border-border-subtle bg-surface-card hover:border-border-default'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        {isImage ? (
                          <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-text-muted shrink-0">
                        {item.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded ${
                          item.status === 'excluded'
                            ? 'bg-surface-subtle text-text-muted'
                            : isAvailable
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {item.status === 'excluded'
                          ? '已排除上下文'
                          : item.status === 'failed'
                          ? '提取失败 · 原件保留'
                          : isAvailable
                          ? '可参与分析'
                          : '仅归档保存'}
                      </span>
                      <span className="text-text-muted">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Material Detail & Analysis Capability */}
          <div className="md:col-span-7">
            {selectedInput ? (
              <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-elevation-card space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-text-primary">
                      {selectedInput.label}
                    </h3>
                    <div className="text-[11px] font-mono text-zinc-400">
                      存储位置: {selectedInput.storageRef}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MaterialActions
                      input={selectedInput}
                      isExcluded={selectedInput.status === 'excluded'}
                      onToggleExclusion={() => handleToggleExclusion(selectedInput.id, selectedInput.status)}
                      onDelete={() => handleDeleteMaterial(selectedInput.id)}
                      onReplace={handleReplaceMaterial}
                      onRetryExtract={handleRetryExtract}
                    />
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        selectedInput.status === 'ready' || selectedInput.status === 'used'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : selectedInput.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {materialStatusLabels[selectedInput.status]}
                    </span>
                  </div>
                </div>

                {/* Extraction Capability & Stats Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400">摘要字符数</div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">
                      {selectedInput.summary ? `${selectedInput.summary.length} 字符` : '0 字符'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400">材料可用性</div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {selectedInput.status === 'failed' ? '提取失败' : selectedInput.status === 'excluded' ? '已排除' : selectedInput.analysisAvailability === 'available' ? '文本可读取' : selectedInput.kind === 'image' ? '图片按需读取' : '仅归档'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400">关联决定记录</div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {referringDecisions.length} 项
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                    <div className="text-zinc-400">来源轮次</div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {selectedInput.clientTurnId || '未记录'}
                    </div>
                  </div>
                </div>

                {/* Capability Honesty Notice */}
                <MaterialStatusNotice input={selectedInput} />

                {/* Summary / Extracted content */}
                {selectedInput.summary && (
                  <div className="space-y-1.5 pt-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      材料内容摘要
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-mono">
                      {selectedInput.summary}
                    </div>
                  </div>
                )}

                {/* Context Inclusion Toggle Bar */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      {selectedInput.status === 'excluded' ? (
                        <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      <span>用于 AI 规划</span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {selectedInput.status === 'excluded'
                        ? '当前已主动排除，AI 推演时不注入此材料内容'
                        : selectedInput.status === 'failed'
                        ? '提取失败，当前不会将此材料内容用于规划'
                        : '规划任务可按需读取，提炼的建议仍需用户确认'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleExclusion(selectedInput.id, selectedInput.status)}
                    disabled={isTogglingExclusion}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                      selectedInput.status === 'excluded'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {selectedInput.status === 'excluded' ? '重新纳入分析' : '排除出上下文'}
                  </button>
                </div>

                {/* Reverse Decision Evidence Tracing */}
                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-orange-500" />
                    <span>引用此材料的决定记录 ({referringDecisions.length})</span>
                  </div>
                  {referringDecisions.length === 0 ? (
                    <div className="text-xs text-zinc-400 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      暂无决定记录引用此材料。候选与已确认记录会分别标明状态。
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {referringDecisions.map((d) => (
                        <div
                          key={d.id}
                          className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {d.statement}
                            </div>
                            <div className="text-xs font-mono text-zinc-400 mt-0.5">
                              {d.decisionKey} · {decisionStatusLabels[d.status]}
                            </div>
                          </div>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 shrink-0">
                            {d.area}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
