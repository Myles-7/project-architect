import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChangeSet } from '@project-architect/contracts';
import { PlanningChangeSet } from '../src/features/planning/PlanningChangeSet.js';
import { ProjectArchitectApiClient } from '../src/api/client.js';

function source(status: ChangeSet['status'] = 'pending'): ChangeSet {
  return { id: 'draft-one', runId: 'run-source', stage: 'product', basis: { revision: 4, hash: 'basis' }, summary: '待修改的完整候选', groups: [{ id: 'group-one', title: '核心范围', impact: '第一版', dependsOn: [], blocks: [], decisions: [], removeBlockIds: [], status: 'pending' }], evidence: [], status, createdAt: '2026-10-04T00:00:00Z', approvals: [] };
}
function render(changeSet: ChangeSet, busy = false) {
  return renderToStaticMarkup(createElement(PlanningChangeSet, { projectId: "changeset-render", changeSet, approvedBlocks: [], decisions: [], busy, onEdit: vi.fn(), onApprove: vi.fn(), onReject: vi.fn(), onRevise: vi.fn() }));
}
it.each(['pending', 'partially-approved'] as const)('offers a feedback field beside a %s draft without needing an approved blueprint', status => {
  const markup = render(source(status));
  expect(markup).toContain('草案修订反馈'); expect(markup).toContain('draft-feedback-draft-one');
  expect(markup).toContain('修订结果仍待批准'); expect(markup).toMatch(/disabled=""[^>]*>让 AI 修订当前草案/);
});
it.each(['stale', 'approved', 'rejected'] as const)('does not offer revision against a %s source', status => {
  expect(render(source(status))).not.toContain('草案修订反馈');
});
it('transports the exact source identity, original stage and complete raw feedback', async () => {
  const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: 'run-new' } })));
  const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch), controller = new AbortController();
  const intent = { stage: 'product' as const, expectedRevision: 4, operationId: 'revise-draft', draftChangeSetId: 'draft-one', feedback: '  修订这份草案\n保留已修好内容。  ' };
  expect((await client.startPlanningRun('project/one', intent, controller.signal)).id).toBe('run-new');
  expect(JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string)).toEqual(intent);
  expect((transport.mock.calls[0]![1] as RequestInit).signal).toBe(controller.signal);
  expect(transport.mock.calls[0]![0]).toBe('http://localhost:3001/api/projects/project%2Fone/planning/runs');
});
