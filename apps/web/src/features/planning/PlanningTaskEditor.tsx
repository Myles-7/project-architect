import type { DevelopmentTaskSpec } from '@project-architect/contracts';

const textFields = [
  ['goal', '任务目标'], ['scope', '实现范围'], ['exclusions', '明确排除'],
  ['normalBehavior', '正常行为'], ['failureBehavior', '异常与恢复行为'],
] as const;
const listFields = [
  ['modules', '模块、接口或数据'], ['verification', '验证方法'],
  ['completionCriteria', '完成条件'], ['assumptions', '假设或待验证事项'],
] as const;
const validationTextFields = [['environment', '验证环境'], ['onFailure', '验证失败后的处理']] as const;
const validationListFields = [['steps', '执行步骤'], ['passCriteria', '通过标准'], ['evidenceRequired', '所需证据']] as const;

export function PlanningTaskEditor({ task, validation, onChange }: { task: DevelopmentTaskSpec; validation: boolean; onChange: (task: DevelopmentTaskSpec) => void }) {
  return <details className="planning-task-editor"><summary>编辑任务范围、验证与完成条件</summary>
    <p className="planning-muted">这些字段同时用于开发文档和 tasks.json。列表每行一项，保存时检查必需内容。</p>
    {[...textFields, ...(validation ? validationTextFields : [])].map(([field, label]) => <label key={field} className="planning-field">{label}<textarea rows={2} value={task[field] || ''} onChange={event => onChange({ ...task, [field]: event.target.value })} /></label>)}
    {[...listFields, ...(validation ? validationListFields : [])].map(([field, label]) => <label key={field} className="planning-field">{label}（每行一项）<textarea rows={3} value={task[field]?.join('\n') || ''} onChange={event => onChange({ ...task, [field]: event.target.value ? event.target.value.split('\n') : [] })} /></label>)}
  </details>;
}
