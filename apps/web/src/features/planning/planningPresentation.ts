import type { BlueprintBlockKind, ChangeGroup, DecisionItem, DecisionTopic, DesignStage, PlanningRun, PlanningStage, PlanningTaskKind, PlanningView, ProposedDecision, QuestionAnswerIntent, QuestionItem } from '@project-architect/contracts';
import { planningProviderFailure } from '@project-architect/contracts';

export function planningRunFailureMessage(run: PlanningRun): string {
  if (run.status === 'stale') return '本轮依据已变化，旧结果保留。请基于当前方案重新规划。';
  const failure = planningProviderFailure(run.error ?? '');
  if (failure.kind === 'quota') {
    const recorded = Date.parse(run.updatedAt), reset = recorded + (failure.resetAfterMs ?? Number.NaN);
    const estimate = Number.isFinite(reset) && !Number.isNaN(new Date(reset).getTime())
      ? `服务预计恢复：${new Date(reset).toLocaleString('zh-CN')}（依据本次失败记录；不是可用保证）。`
      : '服务未提供恢复时间，可在 agy 的 /usage 查看当前账号额度。';
    return `AI 服务额度已用尽，输入与已完成任务保留。${estimate}额度恢复或在 agy 切换账号后，点击“继续运行”复用成功结果。`;
  }
  return run.status === 'failed' ? '本轮工作未完成，输入与已完成结果保留，可重新运行。' : '本轮工作暂停，输入与已完成结果保留。查看原因后，可继续运行。';
}

export const stageLabels = { clarify: '澄清构思', product: '产品与体验', technical: '技术与接口', delivery: '任务与验收', feedback: '开发反馈' } as const;
export const runStatusLabels = { queued: '等待调度', running: '正在执行', paused: '已暂停', reviewable: '方案可审阅', cancelled: '已取消', stale: '依据已变更', failed: '执行失败' } as const;
export const taskStatusLabels = { queued: '等待', running: '执行中', completed: '已完成', paused: '已暂停', cancelled: '已取消' } as const;
export const stageStatusLabels = { 'not-designed': '待设计', draft: '草案', approved: '已批准', 'needs-revision': '待修订' } as const;
export const blockKindLabels: Record<BlueprintBlockKind, string> = {
  target: '目标用户', problem: '核心问题', outcomes: '预期成果', scope: '产品范围', non_goals: '不做的事项',
  feature: '功能', flow: '用户流程', page: '页面与交互', technology: '技术选型', module: '模块职责',
  data_model: '数据模型', interface: '接口契约', error: '异常处理', deployment: '部署方案', task: '开发任务',
  acceptance: '验收场景', validation: '验证任务',
};

export function planningTaskTitle(kind: PlanningTaskKind, stage: PlanningStage): string {
  const subject = stage === 'clarify' ? '构思' : stage === 'feedback' ? '需求变更' : stageLabels[stage];
  const actions: Record<PlanningTaskKind, string> = {
    clarification: `澄清${subject}的关键选择`, design: `生成${subject}草案`, research: `查证${subject}依据`,
    validation: `验证${subject}关键能力`, integration: `整合${subject}方案`, review: `独立评审${subject}方案`, revision: `修订${subject}方案`, decomposition: `拆分${subject}工作范围`,
  };
  return actions[kind];
}

export function reviewableStageChangeSet(view: PlanningView, stage: PlanningStage) {
  return [...view.state.changeSets].reverse().find(changeSet => changeSet.stage === stage && changeSet.status !== 'stale' && changeSet.groups.some(group => group.status === 'pending'));
}

function stageHasStarted(view: PlanningView, stage: DesignStage): boolean {
  return view.state.blueprint.stages[stage] !== 'not-designed' || view.state.blueprint.blocks.some(block => block.stage === stage)
    || view.runs.some(run => run.stage === stage) || view.state.changeSets.some(changeSet => changeSet.stage === stage);
}

/** Display only: the full authoritative issue list still controls package generation. */
export function visibleCoverageIssues(view: PlanningView): string[] {
  return view.coverageIssues.flatMap(issue => {
    const missing = /^(product|technical|delivery) 缺少具体的 (\w+)$/.exec(issue);
    if (missing) {
      const stage = missing[1] as DesignStage;
      if (!stageHasStarted(view, stage)) return [];
      return [`${stageLabels[stage]}：需补充具体的${blockKindLabels[missing[2] as BlueprintBlockKind] || missing[2]}`];
    }
    if (/^功能 .+ 缺少(开发任务|验收场景)$/.test(issue) && !stageHasStarted(view, 'delivery')) return [];
    return [issue];
  });
}

export function planningPackageReady(view?: PlanningView | null): boolean {
  return Boolean(view && (['product', 'technical', 'delivery'] as DesignStage[]).every(stage => view.state.blueprint.stages[stage] === 'approved') && view.coverageIssues.length === 0);
}

export function planningStageGuidance(view: PlanningView, questionCount: number): { title: string; nextAction: string } {
  const activeRun = view.runs.find(run => ['queued', 'running'].includes(run.status));
  if (activeRun) return { title: `当前阶段：${stageLabels[activeRun.stage]}`, nextAction: `${runStatusLabels[activeRun.status]}，左侧显示实际任务状态。完成后审阅生成的草案。` };
  const pending = [...view.state.changeSets].reverse().find(changeSet => changeSet.status !== 'stale' && changeSet.groups.some(group => group.status === 'pending'));
  if (pending) return { title: `当前阶段：${stageLabels[pending.stage]} · 草案待审阅`, nextAction: '逐组审阅下方变更包。批准选中的内容后，正式方案和阶段状态才会更新。' };
  if (questionCount) return { title: '当前阶段：澄清构思', nextAction: '先回答左侧的关键选择；自定义、委托或暂缓也可以明确提交。' };
  const latestRun = [...view.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (latestRun?.status === 'paused' && planningProviderFailure(latestRun.error ?? '').kind === 'quota') {
    return { title: `当前阶段：${stageLabels[latestRun.stage]} · 额度暂停`, nextAction: '成功任务已保留。先恢复 agy 当前账号额度，再点击左侧“继续运行”；切换账号后也可继续，系统会检查本轮依据。' };
  }
  if (view.state.changeSets.at(-1)?.status === 'stale') return { title: '草案依据已变化', nextAction: '旧草案保留在下方。基于当前项目状态重新生成后，再审阅新的变更包。' };
  const nextStage = (['product', 'technical', 'delivery'] as DesignStage[]).find(stage => view.state.blueprint.stages[stage] !== 'approved');
  if (nextStage === 'product' && !view.canGenerateProduct) return { title: '当前阶段：澄清构思', nextAction: '先描述想法或添加材料，完成关键选择的澄清或委托，再设计产品与体验。' };
  if (nextStage) return { title: `当前阶段：${stageLabels[nextStage]}`, nextAction: `生成${stageLabels[nextStage]}草案，检查具体方案后逐组批准。后续阶段会在前一阶段批准后开放。` };
  return planningPackageReady(view)
    ? { title: '三个阶段已批准', nextAction: '覆盖检查通过，可以生成开发包并预览文档与任务清单。' }
    : { title: '已批准方案仍需检查', nextAction: '处理下方覆盖缺口或未批准输入，审阅并批准相应变更后再生成开发包。' };
}

export function elapsedLabel(start: string, end?: string, now = Date.now()): string {
  const duration = (end ? Date.parse(end) : now) - Date.parse(start);
  if (!Number.isFinite(duration)) return '未知';
  const seconds = Math.max(0, Math.floor(duration / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  const days = Math.floor(seconds / 86400);
  return `${days ? `${days} 天 ` : ''}${Math.floor(seconds / 3600) % 24} 小时 ${Math.floor(seconds / 60) % 60} 分 ${seconds % 60} 秒`;
}

export function currentQuestions(saved: QuestionItem[], runs: PlanningRun[]): QuestionItem[] {
  const resolved = new Set(saved.filter(q => !['shown', 'proposed'].includes(q.status)).map(q => q.id));
  const runQuestions = runs.filter(r => r.status === 'paused').flatMap(r => r.pendingQuestions);
  const candidates = [...runQuestions, ...saved].filter(q => ['shown', 'proposed'].includes(q.status) && !resolved.has(q.id) && q.options.length >= 2 && q.options.length <= 4).sort((a, b) => (b.basisRevision || 0) - (a.basisRevision || 0) || b.createdAt.localeCompare(a.createdAt));
  const newestBatch = candidates.find(q => q.batchId)?.batchId;
  const keys = new Set<string>();
  return candidates.filter(q => {
    if (newestBatch && q.batchId && q.batchId !== newestBatch) return false;
    const key = q.decisionKey || q.id;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  }).slice(0, 3);
}

export function answerIsReady(intent?: QuestionAnswerIntent): boolean {
  if (!intent) return false;
  if (intent.kind === 'selection') return Boolean(intent.optionKeys?.length);
  if (intent.kind === 'custom') return Boolean(intent.text?.trim());
  return intent.kind === 'delegate' || intent.kind === 'defer';
}

export function replacementDecisions(proposal: ProposedDecision, decisions: DecisionItem[], topics: DecisionTopic[]): DecisionItem[] {
  const topic = topics.find(item => item.key === proposal.decisionKey || item.aliases.includes(proposal.decisionKey));
  const keys = new Set(topic ? [topic.key, ...topic.aliases] : [proposal.decisionKey]);
  const explicit = new Set(proposal.replaces || []);
  return decisions.filter(decision => explicit.has(decision.id) || (['confirmed', 'locked'].includes(decision.status) && Boolean(decision.decisionKey && keys.has(decision.decisionKey))));
}

export function changeGroupsFingerprint(groups: ChangeGroup[]): string { return JSON.stringify(groups); }
