import { useEffect, useState } from 'react';
import type { ProjectSnapshot } from '@project-architect/contracts';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.js';

export function HistoricalDocumentsView({ documents }: { documents: NonNullable<ProjectSnapshot['documents']>['items'] }) {
  const { state, apiClient, setActiveTab } = useProjectSession();
  const projectId = state.activeProjectId!;
  const [selectedId, setSelectedId] = useState(documents[0]?.id || '');
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setContent(null); setError(null);
    void apiClient.readHistoricalDocument(projectId, selectedId, controller.signal).then(result => { if (!controller.signal.aborted) setContent(result.content); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [apiClient, selectedId, projectId]);
  return <div className="max-w-5xl mx-auto space-y-5">
    <div><h2 className="text-lg font-semibold">旧版文档（只读历史）</h2><p className="planning-muted">这里保留旧文档供查阅。当前开发包从已批准蓝图生成，并在规划工作台中预览和下载。</p><button className="planning-button" onClick={() => setActiveTab('chat')}>返回当前规划与开发包</button></div>
    {error && <div className="planning-error" role="alert">{error}</div>}
    {!documents.length && <p className="planning-muted">此项目没有旧版文档。</p>}
    {!!documents.length && <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5"><nav aria-label="旧版文档列表">{documents.map(item => <button className={`planning-nav-item ${item.id === selectedId ? 'is-active' : ''}`} key={item.id} aria-current={item.id === selectedId ? 'page' : undefined} onClick={() => setSelectedId(item.id)}><span>{item.path}<small className="block planning-muted">来源版本 {item.sourceRevision}</small></span></button>)}</nav><article className="bg-surface-card border border-border-default rounded-xl p-5 min-w-0">{content === null && !error ? <p role="status">读取文档内容…</p> : content !== null ? <MarkdownRenderer content={content} /> : null}<p className="planning-muted">历史原文，尚未重新校验完整性。</p></article></div>}
  </div>;
}
