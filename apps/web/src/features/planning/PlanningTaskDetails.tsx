import type { DevelopmentTaskSpec } from '@project-architect/contracts';

export function PlanningTaskDetails({ task }: { task: DevelopmentTaskSpec }) {
  return <details><summary>任务范围、验证与完成条件</summary><dl className="planning-task-spec">
    <dt>目标</dt><dd>{task.goal}</dd><dt>范围</dt><dd>{task.scope}</dd><dt>排除</dt><dd>{task.exclusions}</dd><dt>模块</dt><dd>{task.modules.join('、')}</dd><dt>正常行为</dt><dd>{task.normalBehavior}</dd><dt>异常行为</dt><dd>{task.failureBehavior}</dd><dt>验证</dt><dd>{task.verification.join('；')}</dd><dt>完成条件</dt><dd>{task.completionCriteria.join('；')}</dd><dt>假设</dt><dd>{task.assumptions.join('；') || '无'}</dd>
    {(task.environment !== undefined || task.steps !== undefined || task.passCriteria !== undefined || task.evidenceRequired !== undefined || task.onFailure !== undefined) && <><dt>验证环境</dt><dd>{task.environment || '未说明'}</dd><dt>执行步骤</dt><dd>{task.steps?.length ? <ol>{task.steps.map((step, index) => <li key={index}>{step}</li>)}</ol> : '未说明'}</dd><dt>通过标准</dt><dd>{task.passCriteria?.join('；') || '未说明'}</dd><dt>所需证据</dt><dd>{task.evidenceRequired?.join('；') || '未说明'}</dd><dt>失败处理</dt><dd>{task.onFailure || '未说明'}</dd></>}
  </dl></details>;
}
