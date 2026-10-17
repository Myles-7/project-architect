import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '../src/components/common/Toast.js';
import type { ChangeSet, PlanningRun, PlanningView, QuestionItem } from '@project-architect/contracts';
import { PlanningWorkspace, type InitialSetupStatus } from '../src/features/planning/PlanningWorkspace.js';
import { PlanningRunTasks } from '../src/features/planning/PlanningRunTasks.js';
import { planningStageGuidance, visibleCoverageIssues } from '../src/features/planning/planningPresentation.js';
import { ProjectSessionContext, type ProjectSessionContextValue } from '../src/state/ProjectSessionContext.js';
import { initialProjectSessionState } from '../src/state/projectSessionReducer.js';
import { ProjectArchitectApiClient } from '../src/api/client.js';

const planning = vi.hoisted(() => ({ view: null as PlanningView | null }));
vi.mock('../src/features/planning/usePlanning.js', () => ({
  usePlanning: () => ({ view: planning.view, error: null, busy: false, refresh: vi.fn(), mutate: vi.fn(), apiClient: {} }),
}));

function view(): PlanningView {
  return {
    sourceStateRevision: 4, status: '待澄清', runs: [], coverageIssues: [],
    state: { schemaVersion: 1, blueprint: { schemaVersion: 1, blocks: [], stages: { product: 'not-designed', technical: 'not-designed', delivery: 'not-designed' } }, changeSets: [], evidence: [], topics: [], inputs: [], operations: [], diagnostics: [] },
  };
}

function draft(): ChangeSet {
  return {
    id: 'cs-product', runId: 'run-product', stage: 'product', basis: { revision: 3, hash: 'basis' }, summary: '单人产品方案',
    groups: [{ id: 'g-product', title: '产品范围', impact: '明确第一版范围', dependsOn: [], blocks: [{ id: 'b-product', stage: 'product', kind: 'scope', title: '第一版范围', content: '提供完整且可审阅的单人产品流程。', requirementIds: [], dependsOn: [], evidenceIds: [] }], removeBlockIds: [], decisions: [], status: 'pending' }],
    evidence: [], status: 'pending', createdAt: '2026-10-04T00:00:00Z', approvals: [],
  };
}

function renderWorkspace(next: PlanningView, initialSetup?: InitialSetupStatus): string {
  planning.view = next;
  const session = {
    state: { ...initialProjectSessionState, activeProjectId: 'project-one' }, apiClient: new ProjectArchitectApiClient(),
    setActiveTab: vi.fn(), toggleOverview: vi.fn(), dispatch: vi.fn(),
  } as unknown as ProjectSessionContextValue;
  return renderToStaticMarkup(createElement(ToastProvider, null, createElement(ProjectSessionContext.Provider, { value: session }, createElement(PlanningWorkspace, { initialSetup }))));
}

function packageButton(markup: string): string {
  return markup.match(/<button[^>]*>生成开发包<\/button>/)![0];
}

describe('planning workspace review priority and honest guidance', () => {
  it('shows quota cause and a fixed service reset estimate outside raw diagnostics', () => {
    const next=view();
    next.runs=[{id:'quota-run',projectId:'project-one',stage:'clarify',basis:{revision:4,hash:'basis'},operationId:'quota-op',status:'paused',tasks:[],pendingQuestions:[],createdAt:'2026-10-05T05:50:00Z',updatedAt:'2026-10-05T05:51:35Z',error:'error: Individual quota reached. Resets in 4h6m36s.'}];
    const markup=renderWorkspace(next),notice=markup.slice(markup.indexOf('AI 服务额度已用尽'),markup.indexOf('<details><summary>查看错误记录'));
    expect(notice).toContain('额度恢复或在 agy 切换账号后');expect(notice).toContain('服务预计恢复');expect(notice).toContain('2026');expect(notice).toContain('不是可用保证');
    expect(markup).toContain('继续运行');
    expect(markup).toContain('当前阶段：澄清构思 · 额度暂停');
    expect(markup).toContain('先恢复 agy 当前账号额度，再点击左侧“继续运行”');
    expect(markup).toContain('运行历时（含等待与暂停）');
    expect(markup).not.toContain('本次运行耗时');
  });
  it('does not invent a reset time for a quota error without a duration', () => {
    const next=view();
    next.runs=[{id:'quota-run',projectId:'project-one',stage:'clarify',basis:{revision:4,hash:'basis'},operationId:'quota-op',status:'paused',tasks:[],pendingQuestions:[],createdAt:'2026-10-05T05:50:00Z',updatedAt:'2026-10-05T05:51:35Z',error:'Individual quota reached. Please upgrade your subscription to increase your limits.'}];
    const markup=renderWorkspace(next);expect(markup).toContain('AI 服务额度已用尽');expect(markup).toContain('服务未提供恢复时间');expect(markup).not.toContain('服务预计恢复');
  });
  it('places current question options after setup notices but before long history and task records', () => {
    const next = view();
    const question: QuestionItem = {
      id: 'q-target', decisionKey: 'target', issueRef: 'gap-target', importance: 'normal', question: '第一版主要面向谁？', reason: '目标用户决定核心流程',
      recommendation: '先服务独立开发者', recommendationReason: '便于集中验证', recommendedOptionKey: 'individual', allowFreeInput: true, status: 'shown', createdAt: '2026-10-04T00:00:00Z',
      options: [
        { key: 'individual', label: '独立开发者', approach: '聚焦单人使用', gain: '范围可控', sacrifice: '暂缓协作', impact: '单人流程', reversibility: 'moderate' },
        { key: 'team', label: '小团队', approach: '支持团队协作', gain: '覆盖团队场景', sacrifice: '增加开发成本', impact: '协作流程', reversibility: 'hard' },
      ],
    };
    next.state.inputs = Array.from({ length: 8 }, (_, index) => ({ id: `input-${index}`, kind: 'statement', raw: `原文记录 ${index}：${'保留用户长篇描述。'.repeat(80)}`, createdAt: '2026-10-04T00:00:00Z' }));
    next.runs = [{
      id: 'run-clarify', projectId: 'project-one', stage: 'clarify', basis: { revision: 4, hash: 'basis' }, operationId: 'clarify-op', status: 'paused',
      tasks: Array.from({ length: 8 }, (_, index) => ({ id: `task-${index}`, kind: 'clarification', goal: `原始任务目标 ${index}：${'保留完整技术要求。'.repeat(80)}`, model: 'clarification-model', status: 'completed', attempts: 1, dependsOn: [], inputRefs: [] })),
      summary: '完整运行摘要', createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:01:00Z', pendingQuestions: [question], nextEventSeq: 1, progressSignatures: [],
    }];
    const markup = renderWorkspace(next, { busy: false, errors: ['材料提取失败，需要重新上传'] });
    const questionsAt = markup.indexOf('aria-label="待回答的问题"');
    const optionAt = markup.indexOf('type="radio"');
    const historyAt = markup.indexOf('class="planning-input-history"');
    const tasksAt = markup.indexOf('aria-label="实际任务进度"');
    expect(questionsAt).toBeGreaterThan(markup.indexOf('初始设置需要检查'));
    expect(questionsAt).toBeLessThan(historyAt);
    expect(optionAt).toBeLessThan(historyAt);
    expect(optionAt).toBeLessThan(tasksAt);
    expect(markup).not.toContain('checked=""');
    expect(markup).toContain('原文记录 7');
    expect(markup).toContain('原始任务目标 7');
    expect(markup).toContain('取消运行');
    expect(markup).toContain('继续运行');
    expect(markup).toMatch(/disabled=""[^>]*>继续运行/);
    expect(markup).toMatch(/disabled=""[^>]*>提交/);

    next.runs[0]!.status = 'running';
    next.runs[0]!.pendingQuestions = [];
    next.runs[0]!.tasks[0]!.status = 'running';
    const runningMarkup = renderWorkspace(next);
    expect(runningMarkup).not.toContain('aria-label="待回答的问题"');
    expect(runningMarkup).toContain('aria-label="实际任务进度"');
    expect(runningMarkup).toContain('执行中');
    expect(runningMarkup).toContain('原文记录 7');
  });

  it('shows a pending draft before coverage checks and makes review the stage action', () => {
    const next = view();
    next.state.changeSets = [draft()];
    next.coverageIssues = ['product 缺少具体的 target', 'technical 缺少具体的 data_model', 'delivery 缺少具体的 task'];
    const markup = renderWorkspace(next);
    expect(markup.indexOf('id="planning-changeset-cs-product"')).toBeLessThan(markup.indexOf('aria-label="覆盖缺口"'));
    expect(markup).toContain('草案待审阅');
    expect(markup).toContain('href="#planning-changeset-cs-product">审阅草案');
    expect(markup).not.toContain('生成产品与体验草案</button>');
    expect(markup).toContain('当前阶段：产品与体验');
    expect(markup).toContain('版本 4');
    expect(markup).not.toContain('正式版本 4');
    expect(markup).toContain('产品与体验：需补充具体的目标用户');
    expect(markup).not.toContain('technical 缺少');
    expect(markup).not.toContain('delivery 缺少');
  });

  it('guides a new project through clarification without future-stage deficiency lists', () => {
    const next = view();
    next.coverageIssues = ['product 缺少具体的 target', 'technical 缺少具体的 technology', 'delivery 缺少具体的 task'];
    const markup = renderWorkspace(next);
    expect(markup).toContain('当前阶段：澄清构思');
    expect(markup).toContain('先描述想法或添加材料');
    expect(markup).not.toContain('aria-label="覆盖缺口"');
    expect(packageButton(markup)).toContain('disabled=""');
  });

  it('opens product generation only after the authoritative clarification projection is ready', () => {
    const next = view();
    const productButton = (markup: string) => markup.match(/<button[^>]*>生成产品与体验草案<\/button>/)![0];
    next.canGenerateProduct = false;
    expect(productButton(renderWorkspace(next))).toContain('disabled=""');
    expect(planningStageGuidance(next, 0).title).toBe('当前阶段：澄清构思');
    next.canGenerateProduct = true;
    expect(productButton(renderWorkspace(next))).not.toContain('disabled');
    expect(planningStageGuidance(next, 0).title).toBe('当前阶段：产品与体验');
  });

  it('suppresses delivery links before delivery starts while retaining actual global gaps', () => {
    const next = view();
    next.state.blueprint.stages.product = 'approved';
    next.coverageIssues = ['功能 feature-one 缺少流程', '功能 feature-one 缺少开发任务', '功能 feature-one 缺少验收场景', '存在未批准的新增输入'];
    expect(visibleCoverageIssues(next)).toEqual(['功能 feature-one 缺少流程', '存在未批准的新增输入']);
    const markup = renderWorkspace(next);
    expect(markup).toContain('当前阶段：技术与接口');
    expect(markup).toContain('存在未批准的新增输入');
  });

  it('keeps actionable late-stage gaps, including validation detail and new inputs', () => {
    const next = view();
    next.state.blueprint.stages = { product: 'approved', technical: 'approved', delivery: 'needs-revision' };
    next.coverageIssues = ['technical 缺少具体的 interface', 'delivery 缺少具体的 acceptance', '功能 feature-one 缺少开发任务', '功能 feature-one 缺少验收场景', '验证任务 validate-one 缺少环境、步骤、证据或失败处理', '存在未批准的新增输入'];
    const markup = renderWorkspace(next);
    for (const text of ['技术与接口：需补充具体的接口契约', '任务与验收：需补充具体的验收场景', '功能 feature-one 缺少开发任务', '功能 feature-one 缺少验收场景', '验证任务 validate-one 缺少环境、步骤、证据或失败处理', '存在未批准的新增输入']) expect(markup).toContain(text);
    expect(packageButton(markup)).toContain('disabled=""');
  });

  it('requires every stage approved and the full authoritative coverage list empty', () => {
    const next = view();
    next.state.blueprint.stages = { product: 'approved', technical: 'approved', delivery: 'approved' };
    expect(packageButton(renderWorkspace(next))).not.toContain('disabled');
    next.coverageIssues = ['存在未批准的新增输入'];
    expect(packageButton(renderWorkspace(next))).toContain('disabled=""');
    next.coverageIssues = ['未来增加的服务端覆盖错误'];
    expect(packageButton(renderWorkspace(next))).toContain('disabled=""');
    next.coverageIssues = [];
    next.state.blueprint.stages.delivery = 'draft';
    expect(packageButton(renderWorkspace(next))).toContain('disabled=""');
  });

  it('does not let a stale historical draft override the next stage after a newer approval', () => {
    const next = view();
    next.state.blueprint.stages.product = 'approved';
    const old = draft(); old.status = 'stale';
    const latest = draft(); latest.id = 'cs-new'; latest.status = 'approved'; latest.groups[0]!.status = 'approved';
    next.state.changeSets = [old, latest];
    expect(planningStageGuidance(next, 0).title).toBe('当前阶段：技术与接口');
  });

  it('keeps stale draft content in collapsed history after the approved plan, with no review actions', () => {
    const next = view();
    const old = draft(); old.status = 'stale';
    next.state.changeSets = [old];
    next.state.blueprint.blocks = [{ ...old.groups[0]!.blocks[0]!, content: '当前批准正文' }];
    const markup = renderWorkspace(next);
    expect(markup).toContain('<details class="planning-stale-history"><summary>');
    expect(markup).toContain('<details class="planning-stale-entry"><summary>');
    expect(markup.indexOf('已批准的正式方案')).toBeLessThan(markup.indexOf('失效草案历史'));
    expect(markup).toContain(old.summary);
    expect(markup).not.toContain('批准选中分组');
    expect(markup).not.toContain('待审草案在批准后');
  });
});

describe('planning task primary labels', () => {
  it('uses real kind and stage for readable actions and puts prompts and models in disclosure', () => {
    const run: PlanningRun = {
      id: 'run-product', projectId: 'project-one', stage: 'product', basis: { revision: 4, hash: 'basis' }, operationId: 'op', status: 'reviewable',
      tasks: (['design', 'research', 'validation', 'integration', 'review', 'revision'] as const).map(kind => ({ id: `task-${kind}`, kind, goal: `内部任务 ${kind}，只有全部满足时 blockers=[]`, model: 'technical-model-name', status: 'completed', attempts: 1, dependsOn: [], inputRefs: [] })),
      createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:01:00Z', pendingQuestions: [], nextEventSeq: 1, progressSignatures: [],
    };
    const markup = renderToStaticMarkup(createElement(PlanningRunTasks, { run, now: Date.parse(run.updatedAt) }));
    expect(markup.match(/<strong>.*?<\/strong>/g)).toEqual([
      '<strong>生成产品与体验草案</strong>', '<strong>查证产品与体验依据</strong>', '<strong>验证产品与体验关键能力</strong>',
      '<strong>整合产品与体验方案</strong>', '<strong>独立评审产品与体验方案</strong>', '<strong>修订产品与体验方案</strong>',
    ]);
    expect(markup.match(/<small>.*?<\/small>/g)?.some(item => /blockers|technical-model-name/.test(item))).toBe(false);
    expect(markup).toMatch(/<details class="planning-task-details"><summary>任务详情<\/summary><p[^>]*>内部任务 design，只有全部满足时 blockers=\[\]<\/p>/);
    expect(markup).toContain('<dt>模型</dt><dd>technical-model-name</dd>');
  });
});
