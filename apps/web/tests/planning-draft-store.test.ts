import { describe, expect, it, vi } from 'vitest';
import { planningDraftKey, readPlanningDraft, subscribePlanningDraft, writePlanningDraft } from '../src/features/planning/planningDraftStore.js';
import { ProjectArchitectApiClient, ApiClientError } from '../src/api/client.js';

describe('session planning drafts and read response boundaries', () => {
  it('keeps input across subscriber unmounts and isolates projects and question contracts', () => {
    const first = planningDraftKey('project-a', 'answers', 'question-contract-a');
    const second = planningDraftKey('project-a', 'answers', 'question-contract-b');
    const other = planningDraftKey('project-b', 'answers', 'question-contract-a');
    const listener = vi.fn();
    const unsubscribe = subscribePlanningDraft(first, listener);
    writePlanningDraft(first, '', '未提交的中文回答');
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    writePlanningDraft(first, '', old => `${old}，保留`);
    expect(listener).toHaveBeenCalledOnce();
    expect(readPlanningDraft(first, '')).toBe('未提交的中文回答，保留');
    expect(readPlanningDraft(second, '')).toBe('');
    expect(readPlanningDraft(other, '')).toBe('');
  });

  it.each([null, {}, { success: true, data: null }, { success: true, data: {} }])('rejects an invalid diagnostics response as a readable API error (%j)', async body => {
    const api = new ProjectArchitectApiClient('http://localhost', vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch);
    await expect(api.getPlanningDiagnostics('project')).rejects.toBeInstanceOf(ApiClientError);
  });
});
