import type { PlanningRun } from '@project-architect/contracts';
import { elapsedLabel, planningTaskTitle, taskStatusLabels } from './planningPresentation.js';

export function PlanningRunTasks({ run, now }: { run: PlanningRun; now: number }) {
  return <ul className="planning-task-list">{run.tasks.map(task => <li key={task.id}>
    <span className={`planning-task-dot ${task.status}`} />
    <div>
      <strong>{planningTaskTitle(task.kind, run.stage)}</strong>
      <small>{taskStatusLabels[task.status]}{task.startedAt && ` · ${elapsedLabel(task.startedAt, task.completedAt || (task.status !== 'running' ? run.updatedAt : undefined), now)}`}{task.attempts > 1 && ` · 第 ${task.attempts} 次尝试`}</small>
      {task.error && <small className="planning-muted">{task.status === 'cancelled' ? '任务已取消' : '任务需要恢复，展开详情查看原因。'}</small>}
      <details className="planning-task-details"><summary>任务详情</summary>
        {task.error && <p className="planning-error">{task.error}</p>}
        <p className="planning-preserve">{task.goal}</p>
        <dl className="planning-task-spec"><dt>模型</dt><dd>{task.model}</dd><dt>任务编号</dt><dd>{task.id}</dd>
          {!!task.dependsOn.length && <><dt>依赖任务</dt><dd>{task.dependsOn.join('、')}</dd></>}
          {!!task.inputRefs.length && <><dt>输入引用</dt><dd>{task.inputRefs.join('、')}</dd></>}
          {task.outputRef && <><dt>产物引用</dt><dd>{task.outputRef}</dd></>}
        </dl>
      </details>
    </div>
  </li>)}</ul>;
}
