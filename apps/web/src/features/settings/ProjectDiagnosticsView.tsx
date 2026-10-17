import { useEffect, useState } from 'react';
import type { DiagnosticSection, ProjectPlanningDiagnostics } from '@project-architect/contracts';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { useToast } from '../../components/common/Toast.js';
import { PlanningSettings } from '../planning/PlanningWorkspace.js';
import { runStatusLabels, stageLabels, taskStatusLabels } from '../planning/planningPresentation.js';

function Availability({ section }: { section: DiagnosticSection }) {
  return <div className="planning-availability planning-muted"><span className={`planning-badge ${section.availability === 'available' ? '' : 'warning'}`}>{section.availability === 'available' ? '记录可读' : section.availability === 'partial' ? '记录不完整' : '暂不可读取'}</span>{section.reasons.slice(0, 2).map((reason, index) => <p key={index}>{reason}</p>)}{section.reasons.length > 2 && <details><summary>其余 {section.reasons.length - 2} 条读取说明</summary>{section.reasons.slice(2).map((reason, index) => <p key={index}>{reason}</p>)}</details>}</div>;
}
const value = (number: number | null | undefined) => number == null ? '未知' : number.toLocaleString();

export function ProjectDiagnosticsView() {
  const { state, apiClient } = useProjectSession();
  const projectId = state.activeProjectId!;
  const toast = useToast();
  const [data, setData] = useState<ProjectPlanningDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null); setLoading(true);
    void apiClient.getPlanningDiagnostics(projectId, controller.signal).then(next => { if (!controller.signal.aborted) setData(next); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || '无法读取运行诊断'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, apiClient, reload]);
  return <div className="workspace-secondary-page planning-diagnostics">
    <header className="planning-section-heading"><div><p className="planning-eyebrow">WORKSPACE DIAGNOSTICS</p><h1>运行信息，有据可查</h1><p className="planning-muted">读取本地记录，检查材料与运行状态。</p></div><button className="planning-button" disabled={loading} onClick={() => setReload(count => count + 1)}>刷新诊断</button></header>
    {loading && <p role="status">正在读取本地记录…</p>}
    {error && <div className="planning-error" role="alert"><p>{error}</p><button className="planning-button" onClick={() => setReload(count => count + 1)}>重新读取</button></div>}
    {data && <>
      <p className="planning-muted">读取时间 {new Date(data.observedAt).toLocaleString()} · 项目版本 {value(data.sourceStateRevision)}</p>
      <section className="planning-diagnostic-card"><h2>项目目录</h2><Availability section={data.project} /><p className="planning-path">{data.project.projectPath}</p><div className="planning-actions"><button className="planning-button" onClick={async () => { try { await navigator.clipboard.writeText(data.project.projectPath); toast.success('已复制真实项目路径'); } catch { toast.error('无法访问剪贴板，请手动复制路径'); } }}>复制项目路径</button><button className="planning-button" onClick={async () => { try { await apiClient.openProjectFolder(projectId); } catch (failure) { toast.error(failure instanceof Error ? failure.message : '无法打开目录'); } }}>打开目录</button></div></section>
      <section className="planning-diagnostic-card"><h2>工作区配置</h2><Availability section={data.configuration} /><p className="planning-muted">整个工作区共用；运行创建时会冻结其模型和资料来源。</p><dl className="planning-task-spec"><dt>设计与整合</dt><dd>{data.configuration.current.designModel}</dd><dt>研究与评审</dt><dd>{data.configuration.current.reviewModel}</dd><dt>当前调度并发</dt><dd>{data.configuration.schedulingConcurrency}</dd><dt>配置位置</dt><dd className="planning-path">{data.configuration.configPath}</dd></dl><PlanningSettings initialConfig={data.configuration.current} projectId={projectId} revision={data.sourceStateRevision ?? 0} disabled={loading} onSaved={() => setReload(count => count + 1)} /></section>
      <section className="planning-diagnostic-card"><h2>规划运行</h2><Availability section={data.runtime} />{data.runtime.availability === 'available' && !data.runtime.runs.length && <p className="planning-muted">没有登记的规划运行。</p>}{data.runtime.runs.map(run => <details key={run.runId}><summary>{run.stage ? stageLabels[run.stage] : '未知阶段'} · {run.effectiveStatus === 'interrupted' ? '重启后中断，尚未恢复' : run.effectiveStatus === 'unknown' ? '状态未知' : runStatusLabels[run.effectiveStatus]}</summary><p className="planning-muted">运行 {run.runId} · 依据{run.basisStatus === 'current' ? '有效' : run.basisStatus === 'stale' ? '已变化' : '未知'} · 原始磁盘状态 {run.storedStatus || '未知'}</p>{run.reasons.map((reason, index) => <p key={index}>{reason}</p>)}{run.effectiveConfig ? <dl className="planning-task-spec"><dt>本轮冻结设计模型</dt><dd>{run.effectiveConfig.designModel}</dd><dt>本轮冻结评审模型</dt><dd>{run.effectiveConfig.reviewModel}</dd><dt>创建时并发配置</dt><dd>{run.effectiveConfig.concurrency}（当前调度以上方设置为准）</dd></dl> : <p className="planning-muted">旧记录没有冻结配置，无法确认当时的设置。</p>}{data.tasks.items.filter(task => task.runId === run.runId).map(task => <details key={task.taskId}><summary>{task.kind} · {taskStatusLabels[task.status]}</summary><p>请求模型 {task.requestedModel || '未知'} · 登记尝试 {value(task.attempts)}</p><p className="planning-muted">{task.outputOrigin === 'assembly' ? '本地汇集产物' : '工作任务'} · 依赖 {task.dependsOn.join('、') || '无'} · 产物完整性尚未重新校验</p></details>)}</details>)}</section>
      <section className="planning-diagnostic-card"><h2>调用回执</h2><Availability section={data.calls} /><p>{value(data.calls.recordedCalls)} 份可读回执{data.calls.incomplete ? ' · 存在缺失或未知信息' : ''}</p><p className="planning-muted">登记尝试数和可读回执数可能不同；这里的模型是请求模型。用量来自服务返回值，缺失项保留未知。</p><dl className="planning-task-spec">{Object.entries(data.calls.usage).map(([key, count]) => <div key={key}><dt>{key}</dt><dd>{value(count)}</dd></div>)}</dl><details><summary>查看每次调用</summary>{data.calls.items.map((call, index) => <article className="planning-history-entry" key={`${call.runId}:${call.taskId}:${call.attempt}:${index}`}><p>{call.requestedModel || '请求模型未知'} · {call.status || '终态未知'} · {call.durationMs == null ? '耗时未知' : `${(call.durationMs / 1000).toFixed(1)} 秒`}</p><p className="planning-muted">{call.taskId} · 尝试 {call.attempt} · 思考设置 {call.reasoningEffort || '未记录'}</p><Availability section={call} /></article>)}</details></section>
      <section className="planning-diagnostic-card"><h2>材料可读性</h2><Availability section={data.materials} />{data.materials.availability === 'available' && !data.materials.items.length && <p className="planning-muted">尚未添加材料。</p>}{data.materials.items.map(material => <p key={material.id}>{material.filename} · {material.status} · {material.readable === true ? '本地文件可读' : material.readable === false ? '本地文件不可读' : '可读性未知'}{material.reason ? ` · ${material.reason}` : ''}</p>)}<p className="planning-muted">可读性检查不代表 AI 已完整理解材料。</p></section>
      <details className="planning-diagnostic-card"><summary>Provider 记录</summary><Availability section={data.provider} /><p>Provider {data.provider.identity || '未记录'}</p><p className="planning-muted">本次读取未触发模型探测；模型目录可用也不能证明图像、工具或试验能力已通过。</p></details>
    </>}
  </div>;
}
