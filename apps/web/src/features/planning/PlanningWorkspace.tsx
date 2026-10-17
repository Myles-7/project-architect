import { useEffect, useState } from 'react';
import type { DesignStage, PlanningEvent, PlanningRuntimeConfig, PlanningStage } from '@project-architect/contracts';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { PlanningQuestions } from './PlanningQuestions.js';
import { PlanningChangeSet } from './PlanningChangeSet.js';
import { PlanningTaskDetails } from './PlanningTaskDetails.js';
import { PlanningRunTasks } from './PlanningRunTasks.js';
import { usePlanning } from './usePlanning.js';
import { usePlanningDraft } from './usePlanningDraft.js';
import { planningDraftKey } from './planningDraftStore.js';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.js';
import { currentQuestions, elapsedLabel, planningPackageReady, planningRunFailureMessage, planningStageGuidance, reviewableStageChangeSet, runStatusLabels, stageLabels, stageStatusLabels, visibleCoverageIssues } from './planningPresentation.js';

export interface InitialSetupStatus { busy: boolean; errors: string[] }

export function PlanningSettings({ projectId, revision, disabled, onSaved, initialConfig }: { projectId: string; revision: number; disabled: boolean; onSaved: () => void; initialConfig?: PlanningRuntimeConfig }) {
  const { apiClient } = useProjectSession();
  const [config, setConfig] = useState<PlanningRuntimeConfig | null>(initialConfig ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (initialConfig) { setConfig(initialConfig); return; }
    const controller = new AbortController();
    void apiClient.getPlanningConfig(projectId, controller.signal).then(setConfig).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [apiClient, projectId, initialConfig]);
  return <details className="planning-advanced"><summary>高级运行设置 · 整个工作区共用</summary>
    <p className="planning-muted">模型和资料来源用于后续运行；并发控制当前调度。更改会影响这个工作区内的所有项目。</p>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {config && <form onSubmit={async event => {
      event.preventDefault(); setSaving(true); setError(null);
      try { await apiClient.updatePlanningConfig(projectId, config); onSaved(); } catch (failure) { setError(failure instanceof Error ? failure.message : '设置保存失败'); } finally { setSaving(false); }
    }}>
      <fieldset disabled={disabled || saving}><legend className="sr-only">运行设置</legend>
        <label className="planning-field">设计与整合模型<input required value={config.designModel} onChange={event => setConfig({ ...config, designModel: event.target.value })} /></label>
        <label className="planning-field">研究、视觉与独立评审模型<input required value={config.reviewModel} onChange={event => setConfig({ ...config, reviewModel: event.target.value })} /></label>
        <label className="planning-field">并发任务数<input required type="number" min={1} max={16} value={config.concurrency} onChange={event => setConfig({ ...config, concurrency: Number(event.target.value) })} /></label>
        <label className="planning-field">官方资料域名（每行一个）<textarea rows={3} value={(config.officialHosts || []).join('\n')} onChange={event => setConfig({ ...config, officialHosts: event.target.value.split('\n').map(host => host.trim()).filter(Boolean) })} /><span className="planning-muted">限定资料读取的来源域名；不开放任意网络访问。</span></label>
        <button className="planning-button" disabled={!revision || saving}>保存高级设置</button>
      </fieldset>
    </form>}
  </details>;
}

export function PlanningWorkspace({ initialSetup }: { initialSetup?: InitialSetupStatus }) {
  const { state, setActiveTab } = useProjectSession();
  const projectId = state.activeProjectId!;
  const { view, error, busy, refresh, mutate, apiClient } = usePlanning(projectId);
  const [input, setInput] = usePlanningDraft(planningDraftKey(projectId, 'composer'), '');
  const [inputKind, setInputKind] = usePlanningDraft<'clarify' | 'feedback'>(planningDraftKey(projectId, 'input-kind'), 'clarify');
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [focusedPlan, setFocusedPlan] = useState(false);
  const [planFilter, setPlanFilter] = useState<'all' | DesignStage>('all');
  const [planSearch, setPlanSearch] = useState('');
  const runs = [...(view?.runs || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const run = runs.find(item => ['queued', 'running'].includes(item.status)) || runs[0];
  const executing = runs.some(item => ['queued', 'running'].includes(item.status));
  const blocked = busy || Boolean(initialSetup?.busy) || executing;
  const questions = currentQuestions(state.snapshot?.questions.items || [], runs);
  const blueprint = view?.state.blueprint;
  const unverifiedBlocks = (blueprint?.blocks || []).filter(block => block.kind === 'validation' && !block.evidenceIds.some(id => view?.state.evidence.some(evidence => evidence.id === id && evidence.kind === 'experiment' && evidence.outcome === 'passed')));
  const pendingChangeSets = (view?.state.changeSets || []).filter(item => ['pending', 'partially-approved'].includes(item.status) && item.groups.some(group => group.status === 'pending')).slice().reverse();
  const staleChangeSets = (view?.state.changeSets || []).filter(item => item.status === 'stale').slice().reverse();

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setEvents([]); setCancelling(false); }, [projectId]);
  useEffect(() => {
    setEvents([]);
    if (!run || !['queued', 'running'].includes(run.status) || typeof EventSource === 'undefined') return;
    return apiClient.subscribePlanningEvents(projectId, run.id, event => {
      setEvents(old => old.some(item => item.seq === event.seq) ? old : [...old, event].slice(-5));
      void refresh(true);
    });
  }, [apiClient, projectId, run?.id, run?.status, refresh]);

  const start = (stage: PlanningStage, feedback?: string, draftChangeSetId?: string) => mutate(`start:${stage}:${draftChangeSetId || ''}:${feedback || ''}`, (request, signal) => apiClient.startPlanningRun(projectId, { ...request, stage, feedback, draftChangeSetId }, signal));
  const packageReady = planningPackageReady(view);
  const coverageIssues = view ? visibleCoverageIssues(view) : [];
  const guidance = view ? planningStageGuidance(view, questions.length) : null;
  const packageManifest = view?.state.package;
  const packageCurrent = view?.packageStatus?.status === 'current';

  const visibleBlocks = (blueprint?.blocks || []).filter(block => (planFilter === 'all' || block.stage === planFilter) && (!planSearch.trim() || `${block.title}\n${block.content}`.toLocaleLowerCase().includes(planSearch.trim().toLocaleLowerCase())));
  return <div className={`planning-workspace ${focusedPlan ? 'is-plan-focused' : ''}`}>
    <section className="planning-conversation" aria-label="构思对话与任务进度">
      <div className="planning-pane-heading"><div><p className="planning-eyebrow">DISCUSS & REFINE</p><h1>构思与讨论</h1></div><span className="planning-badge">{view?.status || (error ? '读取失败' : '正在读取')}</span></div>
      <div className="planning-conversation-scroll">
        {initialSetup?.busy && <p className="planning-notice" role="status">正在保存初始材料，完成后开始澄清。</p>}
        {!!initialSetup?.errors.length && <div className="planning-error" role="alert"><strong>初始设置需要检查</strong>{initialSetup.errors.map((message, index) => <p key={index}>{message}</p>)}<button className="planning-button" onClick={() => setActiveTab('files')}>检查并重新上传材料</button></div>}
        {error && <div className="planning-error" role="alert"><p>当前操作未完成，输入已保留。请重新读取状态；问题持续时可查看诊断。</p><details><summary>查看错误记录</summary><p>{error}</p></details><button className="planning-button" onClick={() => void refresh()}>重新读取状态</button></div>}
        {!view && !error && <p className="planning-muted" role="status">读取本地规划状态…</p>}
        <PlanningQuestions projectId={projectId} questions={questions} busy={blocked} onAnswer={async answers => {
          const submitted = await mutate(`answers:${JSON.stringify(answers)}`, (request, signal) => apiClient.answerPlanningQuestions(projectId, { ...request, answers }, signal));
          if (!submitted) return false;
          if (run?.status === 'paused' && answers.length === questions.length) await mutate(`resume:${run.id}`, (request, signal) => apiClient.controlPlanningRun(projectId, run.id, 'resume', request, signal));
          return true;
        }} />
        {!!view?.state.inputs.length && <div className="planning-input-history">{view.state.inputs.slice(-8).map(item => <article key={item.id} className="planning-user-message"><small>你的原文 · {new Date(item.createdAt).toLocaleString()}</small>{item.raw.length > 260 ? <details className="planning-original-preview"><summary>{item.raw.slice(0, 90)}… · 展开原文</summary><p>{item.raw}</p></details> : <p>{item.raw}</p>}{['delegation', 'uncertainty'].includes(item.kind) && <span className="planning-muted">{item.kind === 'delegation' ? '已委托，提议待审批' : '已暂缓'}</span>}</article>)}</div>}
        {run && <section className="planning-run" aria-label="实际任务进度">
          <div className="planning-section-heading"><h3>{stageLabels[run.stage]}</h3><span className="planning-badge">{runStatusLabels[run.status]}</span></div>
          <p className="planning-muted">运行历时（含等待与暂停） {elapsedLabel(run.createdAt, ['queued', 'running'].includes(run.status) ? undefined : run.updatedAt, now)}</p>
          {run.summary && <p>{run.summary}</p>}
          {run.clarification && <details className="planning-clarification"><summary>澄清摘要 · 工作草案</summary><dl className="planning-task-spec"><dt>目标用户</dt><dd>{run.clarification.target}</dd><dt>问题</dt><dd>{run.clarification.problem}</dd><dt>结果</dt><dd>{run.clarification.outcomes}</dd><dt>范围</dt><dd>{run.clarification.scope}</dd><dt>约束</dt><dd>{run.clarification.constraints}</dd><dt>已委托</dt><dd>{run.clarification.delegated.join('、') || '无'}</dd></dl><p className="planning-muted">这份摘要用于继续设计，正式方案仍需逐组批准。</p></details>}
          {run.error && (run.status === 'cancelled' ? <p className="planning-muted">已取消，输入与已完成任务保留。</p> : <div className="planning-error" role="alert"><p>{planningRunFailureMessage(run)}</p><details><summary>查看错误记录</summary><p>{run.error}</p></details></div>)}
          <div className="planning-actions">
            {run.status === 'paused' && <button className="planning-button primary" disabled={busy || Boolean(initialSetup?.busy) || questions.length > 0} title={questions.length ? '提交本轮全部回答后继续；可选择委托或暂缓。' : undefined} onClick={() => void mutate(`resume:${run.id}`, (request, signal) => apiClient.controlPlanningRun(projectId, run.id, 'resume', request, signal))}>继续运行</button>}
            <button className="planning-button danger" disabled={cancelling || ['cancelled', 'reviewable', 'failed', 'stale'].includes(run.status)} onClick={async () => { setCancelling(true); await mutate(`cancel:${run.id}`, (request, signal) => apiClient.controlPlanningRun(projectId, run.id, 'cancel', request, signal), true); setCancelling(false); }}>取消运行</button>
            {['failed', 'cancelled'].includes(run.status) && run.draftSource && <button className="planning-button" disabled={blocked} onClick={() => void mutate(`resume:${run.id}`, (request, signal) => apiClient.controlPlanningRun(projectId, run.id, 'resume', request, signal))}>继续草案修订</button>}
            {run.status === 'stale' && run.draftSource && <p className="planning-muted">草案修订依据已变化，请查看当前有效草案再修订；此前内容保留在历史中。</p>}
            {['failed', 'cancelled', 'stale'].includes(run.status) && !run.draftSource && <button className="planning-button" disabled={blocked} onClick={() => void start(run.stage, run.request?.feedback)}>基于当前状态重新运行</button>}
          </div>
          <PlanningRunTasks run={run} now={now} />
          {!!events.length && <details className="planning-event-log"><summary>最近运行事件</summary>{events.map(event => <p key={event.seq}><small>{new Date(event.at).toLocaleTimeString()}</small> {event.message}</p>)}</details>}
        </section>}
        {view && !run && !questions.length && !pendingChangeSets.length && !blueprint?.blocks.length && <div className="planning-welcome"><h3>先说明你想解决的问题</h3><p>描述想法或添加材料，澄清关键选择后，分别生成并审阅三个阶段的方案。</p><button className="planning-button" disabled={blocked} onClick={() => void start('clarify')}>开始澄清</button></div>}
      </div>
      <form className="planning-composer" onSubmit={async event => { event.preventDefault(); if (input.trim() && await start(inputKind, input)) setInput(''); }}>
        <div className="planning-answer-modes"><button type="button" aria-pressed={inputKind === 'clarify'} onClick={() => setInputKind('clarify')}>补充想法</button><button type="button" aria-pressed={inputKind === 'feedback'} onClick={() => setInputKind('feedback')}>开发反馈 / 需求变更</button></div>
        <label htmlFor="planning-input" className="sr-only">{inputKind === 'feedback' ? '开发反馈原文' : '补充想法原文'}</label>
        <textarea id="planning-input" rows={3} placeholder={inputKind === 'feedback' ? '描述实践中遇到的问题，或需要修改的需求…' : '描述目标用户、问题、你期待的结果，或补充约束…'} value={input} onChange={event => setInput(event.target.value)} />
        <div className="planning-composer-footer"><button type="button" className="planning-button subtle" onClick={() => setActiveTab('files')}>添加材料</button><span className="planning-muted">原文保留，归纳待审批</span><button className="planning-button primary" disabled={blocked || !view || !input.trim()}>{busy ? '正在提交…' : inputKind === 'feedback' ? '分析变更影响' : '发送并澄清'}</button></div>
      </form>
    </section>
    <section className="planning-plan" aria-label="当前方案与变更包">
      <div className="planning-pane-heading"><div><p className="planning-eyebrow">CURRENT BLUEPRINT</p><h2>当前方案</h2></div><div className="planning-pane-tools"><span className="planning-muted">版本 {view?.sourceStateRevision ?? '—'}</span>{(packageReady || packageManifest) && <a className="planning-button subtle" href="#planning-package">开发包</a>}<button type="button" className="planning-button subtle" aria-pressed={focusedPlan} onClick={() => setFocusedPlan(value => !value)}>{focusedPlan ? '返回双栏' : '专注阅读方案'}</button></div></div>
      <div className="planning-plan-scroll">
        <div className="planning-stages">{(['product', 'technical', 'delivery'] as DesignStage[]).map((stage, index) => {
          const draft = view && reviewableStageChangeSet(view, stage);
          return <article key={stage}><small>0{index + 1}</small><h3>{stageLabels[stage]}</h3><span className={`planning-badge ${!draft && blueprint?.stages[stage] === 'approved' ? 'approved' : 'draft'}`}>{draft ? '草案待审阅' : blueprint ? stageStatusLabels[blueprint.stages[stage]] : error ? '暂不可读取' : '正在读取'}</span>
            {draft ? <a className="planning-button" href={`#planning-changeset-${draft.id}`}>审阅草案</a>
              : <button className="planning-button" disabled={blocked || !view || (stage === 'product' && !view.canGenerateProduct) || (stage === 'technical' && blueprint?.stages.product !== 'approved') || (stage === 'delivery' && blueprint?.stages.technical !== 'approved')} onClick={() => void start(stage)}>{blueprint?.stages[stage] === 'approved' ? '重新生成草案' : `生成${stageLabels[stage]}草案`}</button>}
          </article>;
        })}</div>
        {guidance && <section className="planning-guidance" aria-label="当前阶段与下一步"><h3>{guidance.title}</h3><p className="planning-muted">{guidance.nextAction}</p></section>}
        {pendingChangeSets.map(changeSet => <PlanningChangeSet key={changeSet.id} projectId={projectId} changeSet={changeSet} approvedBlocks={blueprint?.blocks || []} decisions={state.snapshot?.decisions.items || []} topics={view?.state.topics || []} busy={blocked} onRevise={feedback => start(changeSet.stage, feedback, changeSet.id)} onEdit={groups => mutate(`edit:${changeSet.id}:${JSON.stringify(groups)}`, (request, signal) => apiClient.editPlanningChangeSet(projectId, changeSet.id, { ...request, groups }, signal))} onApprove={(groupIds, unlockIds) => mutate(`approve:${changeSet.id}:${JSON.stringify([groupIds, unlockIds])}`, (request, signal) => apiClient.approvePlanningChangeSet(projectId, changeSet.id, { ...request, groupIds, unlockIds }, signal))} onReject={groupIds => mutate(`reject:${changeSet.id}:${JSON.stringify(groupIds)}`, (request, signal) => apiClient.rejectPlanningChangeSet(projectId, changeSet.id, { ...request, groupIds }, signal))} />)}
        {!!coverageIssues.length && <section className="planning-coverage" aria-label="覆盖缺口"><h3>已批准方案待补齐</h3>{pendingChangeSets.length > 0 && <p className="planning-muted">待审草案在批准后才计入正式方案覆盖。</p>}<ul>{coverageIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></section>}
        {unverifiedBlocks.length > 0 && <section className="planning-notice"><h3>包含尚未通过的验证任务</h3><p>这些能力需要实际执行验证；方案批准不代表验证通过。</p>{unverifiedBlocks.map(block => <p key={block.id}>{block.title}</p>)}</section>}
        <section className="planning-approved"><div className="planning-section-heading"><h3>已批准的正式方案</h3><span className="planning-badge approved">{blueprint?.blocks.length || 0} 个区块</span></div>
          {!blueprint?.blocks.length && <p className="planning-muted">批准变更包后，正式方案会在这里显示。</p>}
          {!!blueprint?.blocks.length && <div className="planning-document-controls"><label className="planning-field">查找方案内容<input type="search" placeholder="按标题或内容查找…" value={planSearch} onChange={event => setPlanSearch(event.target.value)} /></label><nav aria-label="方案阶段筛选" className="planning-filter-tabs">{(['all', 'product', 'technical', 'delivery'] as const).map(stage => <button type="button" key={stage} aria-pressed={planFilter === stage} onClick={() => setPlanFilter(stage)}>{stage === 'all' ? '全部' : stageLabels[stage]}</button>)}</nav><p className="planning-muted">显示 {visibleBlocks.length} 个区块 · 点击标题展开正文</p></div>}
          {!!blueprint?.blocks.length && !visibleBlocks.length && <p className="planning-notice">没有匹配的区块，试试其他关键词或阶段。</p>}
          {visibleBlocks.map(block => <details key={block.id}><summary><span>{block.title}<small className="planning-block-stage">{stageLabels[block.stage]}</small></span><span className="planning-badge approved">已批准{block.locked ? ' · 锁定' : ''}</span></summary><MarkdownRenderer content={block.content} />{block.task && <PlanningTaskDetails task={block.task} />}<small className="planning-muted">{stageLabels[block.stage]} · 关联需求 {block.requirementIds.join('、') || '无'}{block.dependsOn.length ? ` · 依赖 ${block.dependsOn.join('、')}` : ''}</small></details>)}
        </section>
        {staleChangeSets.length > 0 && <details className="planning-stale-history">
          <summary><span>失效草案历史</span><span className="planning-muted">{staleChangeSets.length} 份 · 展开查看</span></summary>
          <p className="planning-muted">这些草案的依据已变化，不能直接批准。完整内容保留供核对；当前正式方案以上方已批准内容为准。</p>
          {staleChangeSets.map(changeSet => <details key={changeSet.id} className="planning-stale-entry">
            <summary><span>{stageLabels[changeSet.stage]} · 依据版本 {changeSet.basis.revision}</span><span className="planning-badge warning">依据已变更</span></summary>
            <PlanningChangeSet projectId={projectId} changeSet={changeSet} approvedBlocks={blueprint?.blocks || []} decisions={state.snapshot?.decisions.items || []} topics={view?.state.topics || []} busy={true} onEdit={async () => false} onApprove={async () => false} onReject={async () => false} />
          </details>)}
        </details>}
        {!!view?.state.topics.length && <details className="planning-topics"><summary>主题决定与历史</summary>{view.state.topics.map(topic => {
          const decision = state.snapshot?.decisions.items.find(item => item.id === topic.effectiveDecisionId);
          return <article key={topic.key}><small>{topic.key}</small><p>{decision?.statement || '暂无正式决定'}</p>{topic.reopenReason && <p className="planning-muted">重开原因：{topic.reopenReason}</p>}<details><summary>{topic.history.length} 条历史记录</summary>{topic.history.map(id => <p key={id}>{state.snapshot?.decisions.items.find(item => item.id === id)?.statement || id}</p>)}</details></article>;
        })}</details>}
        <section id="planning-package" tabIndex={-1} className="planning-package">
          <h3>开发包</h3><p className="planning-muted">从已批准蓝图生成入口文档、规范、任务清单与 ZIP。{!packageReady && '三个阶段批准且覆盖检查通过后可生成。'}</p>
          {packageManifest && !packageCurrent && <p className="planning-notice" role="status">{view?.packageStatus?.reason || '当前开发包的依据尚未确认，请重新生成后再预览或下载。'}</p>}
          <div className="planning-actions"><button className="planning-button primary" disabled={blocked || !packageReady} onClick={() => void mutate('compile-package', (request, signal) => apiClient.compilePlanningPackage(projectId, request, signal))}>生成开发包</button>{packageManifest && packageCurrent && <a className="planning-button" href={apiClient.planningPackageExportUrl(projectId)} download>下载开发包 ZIP</a>}</div>
          {packageManifest && <p className="planning-muted">来源版本 {packageManifest.sourceRevision} · {packageManifest.files.length} 个文件 · {packageCurrent ? '与当前方案一致' : '需要重新生成'}</p>}
          {packageManifest && packageCurrent && <details><summary>预览开发包文件 ({packageManifest.files.length})</summary><ul className="planning-package-files">{packageManifest.files.map(file => <li key={file.name}><a className="planning-button subtle" href={apiClient.planningPackageFileUrl(projectId, file.name)} target="_blank" rel="noopener noreferrer">预览 {file.name}</a><small className="planning-muted" title={file.sha256}>SHA-256 {file.sha256.slice(0, 12)}…</small></li>)}</ul></details>}
        </section>
        <details className="planning-advanced"><summary>方案证据与迁移说明</summary>
          {view?.state.evidence.map(evidence => <details key={evidence.id}><summary>{evidence.kind} · {evidence.source} · {evidence.outcome === 'passed' ? '执行通过' : evidence.outcome === 'failed' ? '执行失败' : evidence.outcome === 'unexecuted' ? '未执行' : evidence.outcome === 'not-applicable' ? '环境不适用' : '来源证据'}</summary><p>{evidence.content}</p><small>{evidence.obtainedAt} · {evidence.applicability}</small></details>)}
          {view?.state.diagnostics.map((diagnostic, index) => <p className="planning-notice" key={index}>{diagnostic}</p>)}
        </details>
      </div>
    </section>
  </div>;
}


