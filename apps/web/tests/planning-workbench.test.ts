import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '../src/components/common/Toast.js';
import type { ChangeSet, DecisionItem, DevelopmentTaskSpec, InputRef, PlanningRun, ProjectSnapshot, QuestionItem } from '@project-architect/contracts';
import { ProjectArchitectApiClient, ApiClientError } from '../src/api/client.js';
import { PlanningQuestions } from '../src/features/planning/PlanningQuestions.js';
import { PlanningChangeSet } from '../src/features/planning/PlanningChangeSet.js';
import { answerIsReady, changeGroupsFingerprint, currentQuestions, elapsedLabel, replacementDecisions } from '../src/features/planning/planningPresentation.js';
import { PlanningTaskDetails } from '../src/features/planning/PlanningTaskDetails.js';
import { MaterialStatusNotice } from '../src/features/files/MaterialStatusNotice.js';
import { uploadInitialMaterials } from '../src/features/files/materialUploads.js';
import { initialProjectSessionState, projectSessionReducer } from '../src/state/projectSessionReducer.js';

function question(id = 'q-one', overrides: Partial<QuestionItem> = {}): QuestionItem {
  return { id, issueRef: 'gap:one', importance: 'normal', question: '第一版面向谁？', reason: '范围会影响产品体验', recommendation: '先服务独立开发者', recommendationReason: '可以集中验证主要流程', recommendedOptionKey: 'individual', options: [
    { key: 'individual', label: '独立开发者', approach: '聚焦个人使用', gain: '范围可控', sacrifice: '暂不支持团队', impact: '单人工作流', reversibility: 'moderate' },
    { key: 'team', label: '小团队', approach: '支持多人使用', gain: '覆盖协作需要', sacrifice: '增加交付工作', impact: '协作流程', reversibility: 'hard' },
  ], allowFreeInput: true, status: 'shown', decisionKey: 'target', createdAt: '2026-10-04T00:00:00Z', ...overrides };
}

function changeset(): ChangeSet {
  return { id: 'cs-1', runId: 'run-1', stage: 'product', basis: { revision: 5, hash: 'basis' }, summary: '聚焦单人流程', groups: [{ id: 'g1', title: '目标用户与范围', impact: '限定第一版体验', dependsOn: [], blocks: [{ id: 'b1', stage: 'product', kind: 'target', title: '目标用户', content: '独立开发者', requirementIds: [], dependsOn: [], evidenceIds: [] }], removeBlockIds: [], decisions: [], status: 'pending' }], evidence: [], status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [] };
}

describe('production planning question and approval rendering', () => {
  it('renders recommended single choices without selecting them and explains all tradeoffs', () => {
    const markup = renderToStaticMarkup(createElement(PlanningQuestions, { projectId: "question-render", questions: [question()], busy: false, onAnswer: vi.fn() }));
    expect((markup.match(/type="radio"/g) || [])).toHaveLength(2);
    expect(markup).not.toContain('checked=""');
    for (const text of ['为什么现在问', '做法：', '收益：', '代价：', '影响：', '可逆性：', '自定义答案', '委托 AI 提议', '暂缓决定']) expect(markup).toContain(text);
    expect(markup).toMatch(/disabled=""[^>]*>提交/);
  });

  it('renders combinable options as checkboxes, also with no selected answer', () => {
    const markup = renderToStaticMarkup(createElement(PlanningQuestions, { projectId: "question-render", questions: [question('q-multiple', { selectionMode: 'multiple' })], busy: false, onAnswer: vi.fn() }));
    expect((markup.match(/type="checkbox"/g) || [])).toHaveLength(2);
    expect(markup).not.toContain('checked=""');
  });

  it('requires explicit content for custom answers and structured option keys for selection', () => {
    expect(answerIsReady(undefined)).toBe(false);
    expect(answerIsReady({ questionId: 'q', kind: 'selection', optionKeys: [] })).toBe(false);
    expect(answerIsReady({ questionId: 'q', kind: 'selection', optionKeys: ['individual'] })).toBe(true);
    expect(answerIsReady({ questionId: 'q', kind: 'custom', text: '  ' })).toBe(false);
    expect(answerIsReady({ questionId: 'q', kind: 'custom' })).toBe(false);
    expect(answerIsReady({ questionId: 'q', kind: 'custom', text: '我的原文' })).toBe(true);
  });

  it('allows explicit delegation or deferral to submit without requiring optional text', () => {
    for (const kind of ['delegate', 'defer'] as const) {
      expect(answerIsReady({ questionId: 'q', kind })).toBe(true);
      expect(answerIsReady({ questionId: 'q', kind, text: '' })).toBe(true);
      expect(answerIsReady({ questionId: 'q', kind, text: '  ' })).toBe(true);
      expect(answerIsReady({ questionId: 'q', kind, text: '我的原文' })).toBe(true);
    }
    const intents = [{ questionId: 'one', kind: 'delegate' as const, text: '' }, { questionId: 'two', kind: 'defer' as const }, { questionId: 'three', kind: 'custom' as const, text: '' }];
    expect(intents.filter(answerIsReady).map(intent => intent.questionId)).toEqual(['one', 'two']);
  });

  it('limits questions to the newest batch, unique topics and at most three unanswered choices', () => {
    const saved = [question('old', { batchId: 'old', basisRevision: 1 }), ...Array.from({ length: 5 }, (_, index) => question(`new-${index}`, { batchId: 'new', basisRevision: 2, decisionKey: `topic-${index}` }))];
    expect(currentQuestions(saved, []).map(q => q.id)).toEqual(['new-0', 'new-1', 'new-2']);
    const run = { status: 'paused', pendingQuestions: [question('handled'), question('duplicate', { decisionKey: 'target' })] } as PlanningRun;
    expect(currentQuestions([question('handled', { status: 'answered' })], [run]).map(q => q.id)).toEqual(['duplicate']);
  });

  it('renders actual before/after content and requires a group selection before approval', () => {
    const changeSet = changeset();
    const markup = renderToStaticMarkup(createElement(ToastProvider, null, createElement(PlanningChangeSet, { projectId: "changeset-render", changeSet, approvedBlocks: [{ ...changeSet.groups[0]!.blocks[0]!, content: '所有开发者', locked: true }], decisions: [], busy: false, onEdit: vi.fn(), onApprove: vi.fn(), onReject: vi.fn() })));
    expect(markup).toContain('当前已批准');
    expect(markup).toContain('所有开发者');
    expect(markup).toContain('建议草案');
    expect(markup).toContain('独立开发者');
    expect(markup).not.toContain('checked=""');
    expect(markup).toMatch(/disabled=""[^>]*>批准选中分组/);
  });

  it.each(['task', 'validation'] as const)('keeps approved, proposed and removed %s specifications in their own review regions', kind => {
    const spec = (label: string): DevelopmentTaskSpec => ({ goal: `${label}目标`, scope: `${label}范围`, exclusions: `${label}排除`, modules: [`${label}模块`], normalBehavior: `${label}正常行为`, failureBehavior: `${label}异常行为`, verification: [`${label}验证`], completionCriteria: [`${label}完成条件`], assumptions: [], environment: `${label}环境`, steps: [`${label}执行步骤`], passCriteria: [`${label}通过标准`], evidenceRequired: [`${label}所需证据`], onFailure: `${label}失败处理` });
    const changeSet = changeset(); changeSet.stage = 'delivery';
    const proposed = { ...changeSet.groups[0]!.blocks[0]!, stage: 'delivery' as const, kind, title: '完整集成验证', content: '新增 Safari 真实环境与明确完成条件', dependsOn: ['task-new-build'], task: spec('建议') };
    const approved = { ...proposed, content: '仅覆盖原 Chrome 环境', dependsOn: ['task-old-storage'], task: spec('原批准') };
    const removed = { ...approved, id: 'obsolete-validation', title: '重复的旧验证', content: '建议移除重复验证', dependsOn: ['task-removed-base'], task: spec('待移除') };
    changeSet.groups[0]!.blocks = [proposed]; changeSet.groups[0]!.removeBlockIds = [removed.id];
    const markup = renderToStaticMarkup(createElement(ToastProvider, null, createElement(PlanningChangeSet, { projectId: "changeset-render", changeSet, approvedBlocks: [approved, removed], decisions: [], busy: false, onEdit: vi.fn(), onApprove: vi.fn(), onReject: vi.fn() })));
    const regions = (className: string) => {
      const output: string[] = []; let cursor = 0;
      for (;;) {
        const start = markup.indexOf(`<div class="${className}">`, cursor); if (start < 0) return output;
        let depth = 0, end = start;
        for (const tag of markup.slice(start).matchAll(/<\/?div\b[^>]*>/g)) {
          depth += tag[0].startsWith('</') ? -1 : 1;
          if (!depth) { end = start + tag.index! + tag[0].length; break; }
        }
        expect(end).toBeGreaterThan(start); output.push(markup.slice(start, end)); cursor = end;
      }
    };
    const [before, removedRegion] = regions('planning-before'), [after] = regions('planning-after');
    expect(before).toContain('仅覆盖原 Chrome 环境'); expect(after).toContain('新增 Safari 真实环境与明确完成条件');
    for (const field of ['环境', '执行步骤', '通过标准', '所需证据', '失败处理', '完成条件']) {
      expect(before).toContain(`原批准${field}`); expect(before).not.toContain(`建议${field}`);
      expect(after).toContain(`建议${field}`); expect(after).not.toContain(`原批准${field}`);
      expect(removedRegion).toContain(`待移除${field}`);
    }
    expect(before).toContain('task-old-storage'); expect(before).not.toContain('task-new-build');
    expect(after).toContain('task-new-build'); expect(after).not.toContain('task-old-storage');
    expect(removedRegion).toContain('建议移除区块'); expect(removedRegion).toContain('task-removed-base');
    expect((markup.match(/任务范围、验证与完成条件/g) || [])).toHaveLength(3);
  });

  it('calculates elapsed time from actual timestamps without a completion percentage', () => {
    expect(elapsedLabel('2026-10-04T00:00:00Z', '2026-10-04T00:01:15Z')).toBe('1 分 15 秒');
    expect(elapsedLabel('2026-10-04T00:00:00Z', undefined, Date.parse('2026-10-04T00:00:12Z'))).toBe('12 秒');
    expect(elapsedLabel('2026-10-04T00:00:00Z', '2026-10-04T08:05:59Z')).toBe('8 小时 5 分 59 秒');
    expect(elapsedLabel('2026-10-04T00:00:00Z', '2026-10-05T02:00:00Z')).toBe('1 天 2 小时 0 分 0 秒');
    expect(elapsedLabel('invalid', '2026-10-04T00:00:00Z')).toBe('未知');
  });

  it('shows all effective decisions that the canonical topic replaces, explicit replacements, and proposed rejections', () => {
    const decision = (id: string, decisionKey: string, status: DecisionItem['status']): DecisionItem => ({ id, decisionKey, status, statement: `旧决定-${id}`, area: 'platform', origin: 'user', evidenceRefs: [], createdAt: '', updatedAt: '' });
    const decisions = [decision('canonical', 'platform', 'confirmed'), decision('alias', 'runtime', 'locked'), decision('explicit', 'unrelated', 'confirmed'), decision('inactive', 'platform', 'rejected'), decision('candidate', 'platform', 'candidate'), decision('cleanup', 'obsolete', 'confirmed')];
    const topics = [{ key: 'platform', aliases: ['runtime'], history: ['canonical', 'alias'] }];
    const proposal = { decisionKey: 'runtime', statement: '新决定', area: 'platform', rationale: '统一平台', evidenceIds: [], replaces: ['explicit'] };
    expect(replacementDecisions(proposal, decisions, topics).map(item => item.id)).toEqual(['canonical', 'alias', 'explicit']);
    const changeSet = changeset();
    changeSet.groups[0]!.decisions = [proposal];
    changeSet.groups[0]!.rejectDecisionIds = ['cleanup'];
    const markup = renderToStaticMarkup(createElement(ToastProvider, null, createElement(PlanningChangeSet, { projectId: "changeset-render", changeSet, approvedBlocks: [], decisions, topics, busy: false, onEdit: vi.fn(), onApprove: vi.fn(), onReject: vi.fn() })));
    for (const text of ['旧决定-canonical', '旧决定-alias', '旧决定-explicit', '旧决定-cleanup', '建议撤销旧决定', '不再作为正式依据', '旧决定保留在历史中']) expect(markup).toContain(text);
    expect(markup).not.toContain('旧决定-inactive');
    expect(markup).not.toContain('旧决定-candidate');
  });

  it('renders a validation task environment, steps, pass criteria, required evidence and failure handling before approval', () => {
    const task: DevelopmentTaskSpec = { goal: '验证平台能力', scope: '浏览器 API', exclusions: '生产集成', modules: ['adapter'], normalBehavior: '能力返回成功', failureBehavior: '返回明确错误', verification: ['执行试验'], completionCriteria: ['证据可复现'], assumptions: ['兼容目标版本'], environment: 'Windows / Chromium', steps: ['建立隔离环境', '执行能力探测'], passCriteria: ['所有预期响应一致'], evidenceRequired: ['环境版本', '实际输出日志'], onFailure: '记录失败并重新评审方案' };
    const markup = renderToStaticMarkup(createElement(PlanningTaskDetails, { task }));
    for (const text of ['验证环境', 'Windows / Chromium', '执行步骤', '建立隔离环境', '执行能力探测', '通过标准', '所有预期响应一致', '所需证据', '实际输出日志', '失败处理', '记录失败并重新评审方案']) expect(markup).toContain(text);
  });

  it('keeps an editing source stable during progress refreshes but detects remote changes and approvals', () => {
    const source = changeset();
    const fingerprint = changeGroupsFingerprint(source.groups);
    const progressRefresh = { ...structuredClone(source), createdAt: '2026-10-04T03:00:00Z' };
    expect(changeGroupsFingerprint(progressRefresh.groups)).toBe(fingerprint);
    progressRefresh.groups[0]!.blocks[0]!.content = '另一个标签页的编辑';
    expect(changeGroupsFingerprint(progressRefresh.groups)).not.toBe(fingerprint);
    const approved = structuredClone(source.groups);
    approved[0]!.status = 'approved';
    expect(changeGroupsFingerprint(approved)).not.toBe(fingerprint);
  });
});

describe('material extraction state honesty', () => {
  const failed: InputRef = { id: 'input:failed', kind: 'file', label: 'broken.pdf', status: 'failed', analysisAvailability: 'unavailable', storageRef: 'inputs/failed/source.pdf', errorMessage: 'PDF 无法解码', createdAt: '2026-10-04T00:00:00Z' };

  it('treats a successful HTTP response with failed extraction as a visible initial material error and advances from the real revision', async () => {
    let revision = 7;
    const transport = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url).endsWith('/inputs')) {
        const body = JSON.parse(options?.body as string);
        expect(body.expectedRevision).toBe(revision);
        revision += 2;
        return new Response(JSON.stringify({ success: true, data: { inputRef: body.filename === 'broken.pdf' ? failed : { ...failed, id: 'input:ready', label: 'notes.md', kind: 'text', status: 'ready', analysisAvailability: 'available', errorMessage: undefined } } }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, data: { snapshot: { metadata: { projectId: 'p', stateRevision: revision, inputRefs: [failed] }, questions: { items: [] }, decisions: { items: [] } } } }));
    });
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    const result = await uploadInitialMaterials(client, 'p', [{ filename: 'broken.pdf', kind: 'file', content: 'bad', contentEncoding: 'base64' }, { filename: 'notes.md', kind: 'text', content: '  原文  ' }], 7, new AbortController().signal);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('提取失败');
    expect(result.errors[0]).toContain('原文件保留');
    expect(result.snapshot.metadata.stateRevision).toBe(11);
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/inputs'))).toHaveLength(2);
  });

  it('renders failed image extraction before image capability information and never claims the image was analyzed', () => {
    const markup = renderToStaticMarkup(createElement(MaterialStatusNotice, { input: { ...failed, kind: 'image' } }));
    expect(markup).toContain('解析提取失败');
    expect(markup).toContain('PDF 无法解码');
    expect(markup).not.toContain('视觉任务可按需读取');
    const image = renderToStaticMarkup(createElement(MaterialStatusNotice, { input: { ...failed, kind: 'image', status: 'ready', errorMessage: undefined } }));
    expect(image).toContain('保存图片不代表已完成视觉分析');
  });
});

describe('planning API contracts', () => {
  it('preserves operation ID and revision and unwraps the 202 run response', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: 'run-real', status: 'queued' } }), { status: 202 }));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    const request = { stage: 'technical' as const, expectedRevision: 17, operationId: 'same-intent' };
    expect((await client.startPlanningRun('project/one', request)).id).toBe('run-real');
    expect(transport.mock.calls[0]![0]).toBe('http://localhost:3001/api/projects/project%2Fone/planning/runs');
    expect(JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string)).toEqual(request);
  });

  it('uses the formal batch answer route and keeps selection, delegation and raw text distinct', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { snapshot: {} } })));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    const answers = [{ questionId: 'one', kind: 'selection' as const, optionKeys: ['a'] }, { questionId: 'two', kind: 'delegate' as const, text: '  只委托存储选型\n' }];
    await client.answerPlanningQuestions('p', { answers, expectedRevision: 9, operationId: 'answer-op' });
    expect(transport.mock.calls[0]![0]).toBe('http://localhost:3001/api/projects/p/questions/answers');
    expect(JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string).answers).toEqual(answers);
  });

  it('submits delegation and deferral without inventing optional answer text', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { snapshot: {} } })));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    const answers = [{ questionId: 'one', kind: 'delegate' as const, text: '' }, { questionId: 'two', kind: 'defer' as const }];
    await client.answerPlanningQuestions('p', { answers, expectedRevision: 9, operationId: 'optional-text-op' });
    expect(JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string).answers).toEqual(answers);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('does not retry a rejected approval and exposes its recoverable error', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: false, error: { code: 'STATE_REVISION_CONFLICT', message: '项目版本已变化', recoverable: true } }), { status: 409 }));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    await expect(client.approvePlanningChangeSet('p', 'cs', { expectedRevision: 3, operationId: 'approve-op', groupIds: ['g'], unlockIds: ['b'] })).rejects.toMatchObject({ name: 'ApiClientError', statusCode: 409, recoverable: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('preserves the original freeform idea, structured fields and planning feedback during transport', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} })));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    const idea = '  原始想法\n保留换行与末尾空格  ';
    const initialIntent = { targetUser: ' 用户原文 ', coreProblem: '  问题原文  ', desiredOutcome: '\n成果原文\n', constraints: ' 约束原文 ' };
    await client.createProject({ name: '项目', idea, initialIntent });
    expect(JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string)).toMatchObject({ idea, initialIntent });
    await client.startPlanningRun('p', { stage: 'feedback', expectedRevision: 10, operationId: 'raw-feedback', feedback: idea });
    expect(JSON.parse((transport.mock.calls[1]![1] as RequestInit).body as string).feedback).toBe(idea);
  });

  it('creates a material-only project without inventing an idea', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} })));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    await client.createProject({ name: '截图规划', materialOnly: true, idea: '' });
    const body = JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.materialOnly).toBe(true);
    expect(body.idea).toBe('');
    expect(body.initialIntent).toBeUndefined();
  });

  it('preserves abort signals and sends runtime settings without formal state fields', async () => {
    const controller = new AbortController();
    const transport = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { concurrency: 4, designModel: 'design', reviewModel: 'review' } })));
    const client = new ProjectArchitectApiClient('http://localhost:3001', transport as typeof fetch);
    const config = { concurrency: 4, designModel: 'design', reviewModel: 'review', officialHosts: ['react.dev'] };
    await client.updatePlanningConfig('p', config, controller.signal);
    expect(JSON.parse((transport.mock.calls[0]![1] as RequestInit).body as string)).toEqual(config);
    expect((transport.mock.calls[0]![1] as RequestInit).signal).toBe(controller.signal);
    expect(ApiClientError).toBeDefined();
  });

  it('builds read-only preview links from the exact manifest filename', () => {
    const client = new ProjectArchitectApiClient('http://localhost:3001');
    expect(client.planningPackageFileUrl('p', 'tasks.json')).toBe('http://localhost:3001/api/projects/p/planning/package/files/tasks.json');
    expect(client.planningPackageFileUrl('p/id', 'UX UI.md')).toBe('http://localhost:3001/api/projects/p%2Fid/planning/package/files/UX%20UI.md');
  });
});

describe('planning projection state safety', () => {
  it('discards responses for another project and older revisions', () => {
    const state = { ...initialProjectSessionState, activeProjectId: 'current', stateRevision: 20 };
    const snapshot = (projectId: string, stateRevision: number) => ({ metadata: { projectId, stateRevision } }) as ProjectSnapshot;
    expect(projectSessionReducer(state, { type: 'UPDATE_SNAPSHOT', payload: { snapshot: snapshot('previous', 30) } })).toBe(state);
    expect(projectSessionReducer(state, { type: 'UPDATE_SNAPSHOT', payload: { snapshot: snapshot('current', 19) } })).toBe(state);
  });
});
