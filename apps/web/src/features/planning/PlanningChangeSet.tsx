import { useEffect, useMemo } from 'react';
import type { BlueprintBlock, ChangeGroup, ChangeSet, DecisionItem, DecisionTopic } from '@project-architect/contracts';
import { changeGroupsFingerprint, replacementDecisions, stageLabels } from './planningPresentation.js';
import { PlanningTaskDetails } from './PlanningTaskDetails.js';
import { PlanningTaskEditor } from './PlanningTaskEditor.js';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.js';
import { usePlanningDraft } from './usePlanningDraft.js';
import { planningDraftKey } from './planningDraftStore.js';

interface Props {
  projectId: string;
  changeSet: ChangeSet;
  approvedBlocks: BlueprintBlock[];
  decisions: DecisionItem[];
  topics?: DecisionTopic[];
  busy: boolean;
  onEdit: (groups: ChangeGroup[]) => Promise<boolean>;
  onApprove: (groupIds: string[], unlockIds: string[]) => Promise<boolean>;
  onReject: (groupIds: string[]) => Promise<boolean>;
  onRevise?: (feedback: string) => Promise<boolean>;
}

export function PlanningChangeSet({ projectId, changeSet, approvedBlocks, decisions, topics = [], busy, onEdit, onApprove, onReject, onRevise }: Props) {
  const key = (kind: string) => planningDraftKey(projectId, `changeset:${kind}`, changeSet.id);
  const [selected, setSelected] = usePlanningDraft<string[]>(key('selection'), []);
  const [unlocks, setUnlocks] = usePlanningDraft<string[]>(key('unlocks'), []);
  const [editing, setEditing] = usePlanningDraft(key('editing'), false);
  const [editSource, setEditSource] = usePlanningDraft(key('source'), '');
  const [draft, setDraft] = usePlanningDraft<ChangeGroup[]>(key('groups'), changeSet.groups);
  const [revisionFeedback, setRevisionFeedback] = usePlanningDraft(key('feedback'), '');
  const [feedbackOpen, setFeedbackOpen] = usePlanningDraft(key('feedback-open'), false);
  useEffect(() => { if (!editing) setDraft(changeSet.groups); setSelected(old => old.filter(id => changeSet.groups.some(group => group.id === id && group.status === 'pending'))); }, [changeSet.groups, editing]);
  const pending = changeSet.groups.filter(group => group.status === 'pending');
  const editConflict = editing && (changeSet.status === 'stale' || editSource !== changeGroupsFingerprint(changeSet.groups));
  const locked = useMemo(() => {
    const groups = changeSet.groups.filter(group => selected.includes(group.id));
    const blockIds = new Set(groups.flatMap(group => [...group.removeBlockIds, ...group.blocks.map(block => block.id)]));
    const decisionIds = new Set(groups.flatMap(group => [...group.decisions.flatMap(proposal => replacementDecisions(proposal, decisions, topics).map(decision => decision.id)), ...(group.rejectDecisionIds || [])]));
    return [...approvedBlocks.filter(block => block.locked && blockIds.has(block.id)).map(block => ({ id: block.id, title: block.title })), ...decisions.filter(decision => decision.status === 'locked' && decisionIds.has(decision.id)).map(decision => ({ id: decision.id, title: decision.statement }))];
  }, [approvedBlocks, changeSet.groups, decisions, selected, topics]);
  const toggleGroup = (id: string, checked: boolean) => setSelected(old => checked ? [...old, id] : old.filter(key => key !== id));
  const updateBlock = (groupId: string, blockId: string, field: 'title' | 'content' | 'locked', value: string | boolean) => setDraft(old => old.map(group => group.id === groupId ? { ...group, blocks: group.blocks.map(block => block.id === blockId ? { ...block, [field]: value } : block) } : group));
  const taskDetails = (block: BlueprintBlock) => block.task ? <><p className="planning-muted">依赖区块：{block.dependsOn.join('、') || '无'}</p><PlanningTaskDetails task={block.task} /></> : null;
  const actions = (editing || (pending.length > 0 && changeSet.status !== 'stale')) && <div className="planning-review-toolbar">
    {locked.length > 0 && <fieldset className="planning-unlock"><legend>此变更涉及已锁定内容</legend><p>明确解锁后，才可批准替换。</p>{locked.map(item => <label className="planning-checkbox" key={item.id}><input type="checkbox" checked={unlocks.includes(item.id)} disabled={busy || editing} onChange={event => setUnlocks(old => event.target.checked ? [...old, item.id] : old.filter(id => id !== item.id))} />解锁：{item.title}</label>)}</fieldset>}
    <div className="planning-actions">
      {editing ? <><button className="planning-button primary" disabled={busy || editConflict} onClick={async () => { if (!editConflict && await onEdit(draft)) setEditing(false); }}>保存草案编辑</button><button className="planning-button" disabled={busy} onClick={() => { setEditing(false); setDraft(changeSet.groups); }}>放弃编辑</button></> : <>
        <button className="planning-button primary" disabled={busy || !selected.length || locked.some(item => !unlocks.includes(item.id))} onClick={async () => { if (await onApprove(selected, unlocks.filter(id => locked.some(item => item.id === id)))) { setSelected([]); setUnlocks([]); } }}>批准选中分组{selected.length ? ` (${selected.length})` : ''}</button>
        <button className="planning-button" disabled={busy || !selected.length} onClick={async () => { if (await onReject(selected)) setSelected([]); }}>拒绝选中分组</button>
        <button className="planning-button subtle" disabled={busy} onClick={() => { setEditSource(changeGroupsFingerprint(changeSet.groups)); setDraft(changeSet.groups); setEditing(true); }}>编辑草案</button>
      </>}
    </div><p className="planning-muted">{editing ? '当前编辑保留在本次页面会话中，保存后仍为待批准草案。' : `选中 ${selected.length} / ${pending.length} 个待审分组；批准只应用选中内容。`}</p>
  </div>;

  return <article id={`planning-changeset-${changeSet.id}`} tabIndex={-1} className="planning-changeset" aria-label={`变更包：${changeSet.summary}`}>
    <div className="planning-section-heading"><h3>{stageLabels[changeSet.stage]}变更包</h3><span className={`planning-badge ${changeSet.status === 'stale' ? 'warning' : 'draft'}`}>{changeSet.status === 'stale' ? '依据已变更' : changeSet.status === 'approved' ? '已批准' : changeSet.status === 'rejected' ? '已拒绝' : '待审批草案'}</span></div>
    <p>{changeSet.summary}</p>
    <p className="planning-muted">依据版本 {changeSet.basis.revision} · {new Date(changeSet.createdAt).toLocaleString()}</p>
    {actions}
    {changeSet.groups.length > 1 && <nav className="planning-change-index" aria-label="变更包分组目录">{changeSet.groups.map(group => <a key={group.id} href={`#planning-group-${changeSet.id}-${group.id}`}>{group.title}</a>)}</nav>}
    {onRevise && ['pending', 'partially-approved'].includes(changeSet.status) && pending.length > 0 && changeSet.stage !== 'clarify' && <details className="planning-draft-feedback" open={feedbackOpen} onToggle={event => setFeedbackOpen(event.currentTarget.open)}>
      <summary>让 AI 调整这份草案<span className="planning-muted">{revisionFeedback ? '反馈已保留' : '有修改意见时展开'}</span></summary>
      <form onSubmit={async event => {
      event.preventDefault();
      if (!busy && !editing && revisionFeedback.trim() && await onRevise(revisionFeedback)) setRevisionFeedback('');
    }}>
      <label className="planning-field" htmlFor={`draft-feedback-${changeSet.id}`}>草案修订反馈<textarea id={`draft-feedback-${changeSet.id}`} rows={3} placeholder="说明要调整的内容，AI 会继续修订这份待批准草案…" value={revisionFeedback} disabled={busy} onChange={event => setRevisionFeedback(event.target.value)} /></label>
      <p className="planning-muted">保留当前草案中已完成的内容，修订结果仍待批准。{editing && '请先保存或放弃当前编辑，再交给 AI 修订。'}</p>
      <button type="submit" className="planning-button" disabled={busy || editing || !revisionFeedback.trim()}>让 AI 修订当前草案</button>
      </form>
    </details>}
    {editConflict && <div className="planning-error" role="alert"><strong>草案编辑发生冲突</strong><p>变更包已被其他操作更新，或规划依据已变化。当前输入保留；放弃编辑并读取最新内容后再修改。</p><button type="button" className="planning-button" onClick={() => { setEditing(false); setDraft(changeSet.groups); }}>放弃编辑并载入最新草案</button></div>}
    {(editing ? draft : changeSet.groups).map(group => <section key={group.id} id={`planning-group-${changeSet.id}-${group.id}`} className="planning-change-group">
      <label className="planning-group-select"><input type="checkbox" checked={selected.includes(group.id)} disabled={busy || editing || group.status !== 'pending' || changeSet.status === 'stale'} onChange={event => toggleGroup(group.id, event.target.checked)} /><strong>{group.title}</strong><span className={`planning-badge ${group.status === 'approved' ? 'approved' : 'draft'}`}>{group.status === 'pending' ? '草案' : group.status === 'approved' ? '已批准' : '已拒绝'}</span></label>
      <p className="planning-muted">影响：{group.impact}</p>
      {!!group.dependsOn.length && <p className="planning-muted">依赖分组：{group.dependsOn.join('、')}</p>}
      {group.blocks.map(block => {
        const before = approvedBlocks.find(item => item.id === block.id);
        return <div key={block.id} className="planning-block-diff">
          {editing && group.status === 'pending' ? <div className="planning-edit-fields">
            <label className="planning-field">区块标题<input value={block.title} onChange={event => updateBlock(group.id, block.id, 'title', event.target.value)} /></label>
            <label className="planning-field">草案内容<textarea rows={5} value={block.content} onChange={event => updateBlock(group.id, block.id, 'content', event.target.value)} /></label>
            {block.task && <PlanningTaskEditor task={block.task} validation={block.kind === 'validation'} onChange={task => setDraft(old => old.map(item => item.id === group.id ? { ...item, blocks: item.blocks.map(current => current.id === block.id ? { ...current, task } : current) } : item))} />}
            <label className="planning-checkbox"><input type="checkbox" checked={Boolean(block.locked)} onChange={event => updateBlock(group.id, block.id, 'locked', event.target.checked)} />批准后锁定此区块</label>
          </div> : <>
            <h4>{block.title}<span className="planning-muted">{before ? '修改' : '新增'}</span></h4>
            {before && <div className="planning-before"><small>当前已批准</small><MarkdownRenderer content={before.content} />{taskDetails(before)}{before.locked && <span className="planning-badge">已锁定</span>}</div>}
            <div className="planning-after"><small>建议草案</small><MarkdownRenderer content={block.content} />{taskDetails(block)}</div>
          </>}
        </div>;
      })}
      {group.removeBlockIds.map(id => {
        const before = approvedBlocks.find(block => block.id === id);
        return <div key={id} className="planning-before"><small>建议移除区块</small><h4>{before?.title || id}</h4>{before && <><MarkdownRenderer content={before.content} />{taskDetails(before)}</>}</div>;
      })}
      {group.decisions.map((decision, index) => <div key={`${decision.decisionKey}-${index}`} className="planning-proposed-decision">
        <small>主题决定 · {decision.decisionKey}</small>
        {replacementDecisions(decision, decisions, topics).map(previous => <div className="planning-before" key={previous.id}><small>将被替换的当前决定 · {previous.decisionKey || previous.id}</small><p>{previous.statement}</p>{previous.status === 'locked' && <span className="planning-badge">已锁定</span>}<p className="planning-muted">批准后由这份草案替代，旧决定保留在历史中。</p></div>)}
        {editing && group.status === 'pending' ? <label className="planning-field">决定陈述<textarea rows={3} value={decision.statement} onChange={event => setDraft(old => old.map(item => item.id === group.id ? { ...item, decisions: item.decisions.map((proposal, i) => i === index ? { ...proposal, statement: event.target.value } : proposal) } : item))} /></label> : <p>{decision.statement}</p>}
        <p className="planning-muted">依据：{decision.rationale}</p>
      </div>)}
      {(group.rejectDecisionIds || []).map(id => <div className="planning-before" key={`reject-${id}`}><small>建议撤销旧决定 · {decisions.find(decision => decision.id === id)?.decisionKey || id}</small><p>{decisions.find(decision => decision.id === id)?.statement || id}</p>{decisions.find(decision => decision.id === id)?.status === 'locked' && <span className="planning-badge">已锁定</span>}<p className="planning-muted">批准后该决定不再作为正式依据，历史仍保留；相关方案需要重新检查。</p></div>)}
    </section>)}
  </article>;
}
