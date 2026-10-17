import { useEffect, useState } from 'react';
import type { PlanningHistoryView } from '@project-architect/contracts';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { stageLabels, runStatusLabels } from '../planning/planningPresentation.js';
import { HistoricalDocumentsView } from '../documents/HistoricalDocumentsView.js';

const changeStatus = { pending: '待审阅', 'partially-approved': '部分批准', approved: '已批准', rejected: '已拒绝', stale: '依据已变化' } as const;

export function TimelineView() {
  const { state, apiClient } = useProjectSession();
  const [view, setView] = useState<PlanningHistoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [showDocuments, setShowDocuments] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setView(null); setError(null);
    void apiClient.getPlanningHistory(state.activeProjectId!, controller.signal).then(next => { if (!controller.signal.aborted) setView(next); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || '无法读取历史'); });
    return () => controller.abort();
  }, [state.activeProjectId, apiClient, reload]);
  const snapshot = view?.snapshot;
  return <div className="workspace-secondary-page planning-history">
    <header className="planning-section-heading"><div><p className="planning-eyebrow">PROJECT HISTORY</p><h1>每次构思，都有来处</h1><p className="planning-muted">查看规划运行、方案审批和原始输入。</p></div><button className="planning-button" onClick={() => setReload(count => count + 1)}>刷新记录</button></header>
    {error && <p className="planning-error" role="alert">{error}</p>}
    {!view && !error && <p role="status">正在读取项目记录…</p>}
    {view && <>
      <section className="planning-history-section" aria-label="方案审批历史"><h2>方案与审批</h2>
        {!view.state.changeSets.length && <p className="planning-muted">生成第一份草案后，会在这里保存其分组和审批来源。</p>}
        {[...view.state.changeSets].reverse().map(changeSet => <details key={changeSet.id} className="planning-history-entry">
          <summary><span><strong className="planning-history-title">{stageLabels[changeSet.stage]} · {new Date(changeSet.createdAt).toLocaleString()}</strong><span className="planning-history-preview">{changeSet.summary}</span></span><span className="planning-badge">{changeStatus[changeSet.status]}</span></summary>
          <p className="whitespace-pre-wrap">{changeSet.summary}</p>
          <p className="planning-muted">{new Date(changeSet.createdAt).toLocaleString()} · 依据版本 {changeSet.basis.revision}</p>
          <dl className="planning-task-spec"><dt>来源运行</dt><dd>{changeSet.runId}</dd><dt>审批记录</dt><dd>{!changeSet.approvals.length ? '尚无批准记录' : changeSet.approvals.map(approval => <p key={approval.operationId}>版本 {approval.revision} · {new Date(approval.at).toLocaleString()} · {approval.groupIds.map(id => changeSet.groups.find(group => group.id === id)?.title || id).join('、')}<small className="block planning-muted">操作 {approval.operationId}</small></p>)}</dd></dl>
          {changeSet.groups.map(group => <details key={group.id}><summary>{group.title} · {group.status === 'approved' ? '已批准' : group.status === 'rejected' ? '已拒绝' : '待审阅'}</summary><p>{group.impact}</p><p className="planning-muted">{group.blocks.length} 个方案区块 · {group.decisions.length} 条决定建议 · {group.removeBlockIds.length} 个移除项</p></details>)}
        </details>)}
      </section>
      <section className="planning-history-section" aria-label="规划运行历史"><h2>AI 工作记录</h2>
        {view.runtime.reasons.map((reason, index) => <p key={index} className="planning-notice">{reason}</p>)}
        {!view.runs.length && view.runtime.availability === 'available' && <p className="planning-muted">目前还没有规划运行。</p>}
        {view.runs.map(run => <details key={run.runId} className="planning-history-entry"><summary><span>{run.stage ? stageLabels[run.stage] : '未知阶段'}</span><span className="planning-badge">{run.effectiveStatus === 'interrupted' ? '重启后中断' : run.effectiveStatus === 'unknown' ? '记录未知' : runStatusLabels[run.effectiveStatus]}</span></summary>
          <p className="planning-muted">运行 {run.runId} · 依据{run.basisStatus === 'current' ? '有效' : run.basisStatus === 'stale' ? '已变化' : '未知'}</p>
          {run.reasons.map((reason, index) => <p key={index}>{reason}</p>)}
          <p className="planning-muted">任务与调用回执可在诊断中查看。</p>
        </details>)}
      </section>
      {!!view.state.inputs.length && <section className="planning-history-section" aria-label="原始输入历史"><h2>你提供的原文</h2>{[...view.state.inputs].reverse().map(input => <details key={input.id} className="planning-history-entry"><summary>{input.raw.slice(0, 90)}{input.raw.length > 90 ? '…' : ''}</summary><p className="planning-muted">{new Date(input.createdAt).toLocaleString()} · {input.kind === 'delegation' ? '委托' : input.kind === 'uncertainty' ? '暂缓' : input.kind === 'feedback' ? '反馈' : '原始输入'}</p><p className="whitespace-pre-wrap">{input.raw}</p>{input.questionId && <p className="planning-muted">关联问题 {input.questionId}</p>}</details>)}</section>}
      {!!snapshot?.documents?.items.length && <details className="planning-history-section" onToggle={event => setShowDocuments(event.currentTarget.open)}><summary>旧版文档 · {snapshot.documents.items.length} 份</summary>{showDocuments && <HistoricalDocumentsView documents={snapshot.documents.items} />}</details>}
      {!!snapshot?.decisions.items.length && <details className="planning-history-section"><summary>决定原始记录 · {snapshot.decisions.items.length} 条</summary><p className="planning-muted">这些记录包含历史版本和候选；当前正式方案以工作台中的已批准蓝图为准。</p>{snapshot.decisions.items.map(decision => <article key={decision.id} className="planning-history-entry"><p>{decision.statement}</p><small className="planning-muted">{decision.status} · {decision.decisionKey || '历史记录未关联决策键'} · {new Date(decision.updatedAt).toLocaleString()}</small></article>)}</details>}
      {snapshot?.readiness.current && <details className="planning-history-section"><summary>旧版准备度记录</summary><p className="planning-muted">仅保留历史读取。当前方案按三个设计阶段和变更包审批，不使用旧准备度分数作为交付条件。</p><p>{snapshot.readiness.current.status} · 来源版本 {snapshot.readiness.current.basisRevision}</p></details>}
    </>}
  </div>;
}
