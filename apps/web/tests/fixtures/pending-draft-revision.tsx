// Isolated interaction fixture: current source components, no project or Provider I/O.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChangeSet } from '@project-architect/contracts';
import { PlanningChangeSet } from '../../src/features/planning/PlanningChangeSet.js';
import { ProjectArchitectApiClient } from '../../src/api/client.js';
import { ToastProvider } from '../../src/components/common/Toast.js';

const initial: ChangeSet = {
  id: 'draft-browser-one', runId: 'run-fixture', stage: 'product',
  basis: { revision: 4, hash: 'isolated-fixture-basis' },
  summary: '浏览器隔离夹具：草案仍未批准', status: 'pending',
  groups: [{ id: 'fixture-group', title: '个人笔记', impact: '保留当前候选', status: 'pending', dependsOn: [], removeBlockIds: [], decisions: [], blocks: [
    { id: 'notes', stage: 'product', kind: 'feature', title: '笔记管理', content: '原始正确草案内容', requirementIds: [], dependsOn: [], evidenceIds: [] },
  ] }], evidence: [], approvals: [], createdAt: '2026-10-04T00:00:00Z',
};

function Fixture() {
  const [source, setSource] = useState(initial), [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(true), [calls, setCalls] = useState<unknown[]>([]);
  const [message, setMessage] = useState('尚未提交');
  const transport: typeof fetch = async (url, options) => {
    setCalls(old => [...old, { url: String(url), intent: JSON.parse(String(options?.body)) }]);
    return new Response(JSON.stringify(fail ? { success: false, error: { code: 'PROVIDER_FAILURE', message: '隔离模拟 API 失败' } } : { success: true, data: { id: 'run-isolated-new' } }), { status: fail ? 503 : 202, headers: { 'Content-Type': 'application/json' } });
  };
  const client = new ProjectArchitectApiClient('/isolated', transport);
  return <main>
    <h1>草案修订隔离交互检查</h1>
    <p>仅渲染当前源码组件，传输由本页内存夹具返回。</p>
    <label><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} />模拟 API 失败</label>
    <p role="status">{message}</p>
    <PlanningChangeSet projectId="pending-draft-fixture" changeSet={source} approvedBlocks={[]} decisions={[]} busy={busy}
      onEdit={async groups => { setSource(old => ({ ...old, groups })); setMessage('人工编辑已保存到隔离夹具'); return true; }}
      onApprove={async () => { setMessage('夹具未批准任何内容'); return false; }}
      onReject={async () => false}
      onRevise={async feedback => {
        setBusy(true);
        try {
          await client.startPlanningRun('isolated-project', { stage: source.stage, draftChangeSetId: source.id, feedback, expectedRevision: source.basis.revision, operationId: 'isolated-revision' });
          setMessage('草案修订已启动，仍待批准'); return true;
        } catch { setMessage('API 失败，反馈原文应保留'); return false; }
        finally { setBusy(false); }
      }} />
    <pre aria-label="隔离调用记录">{JSON.stringify(calls, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById('root')!).render(<ToastProvider><Fixture /></ToastProvider>);
