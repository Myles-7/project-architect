import type { BlueprintBlock, PlanningPackageTask, PlanningPackageTaskFile } from '@project-architect/contracts';
import { PlanningError } from '@project-architect/core';

type TaskBlock = BlueprintBlock & { kind: PlanningPackageTask['kind'] };
function isTask(block: BlueprintBlock): block is TaskBlock {
  return block.kind === 'task' || block.kind === 'validation';
}
const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Project registered blueprint edges; requirement associations never create task prerequisites. */
export function projectPlanningTaskGraph(blocks: BlueprintBlock[]): Pick<PlanningPackageTaskFile, 'tasks' | 'blueprintReferences'> {
  const byId = new Map(blocks.map(block => [block.id, block]));
  if (byId.size !== blocks.length) throw new PlanningError('PACKAGE_INCOMPLETE', '蓝图块 ID 重复');
  const endpointCache = new Map<string, string[]>();
  const visiting = new Set<string>();
  const endpoints = (id: string): string[] => {
    const block = byId.get(id);
    if (!block) throw new PlanningError('PACKAGE_INCOMPLETE', `蓝图依赖不存在：${id}`);
    if (isTask(block)) return [block.id];
    const cached = endpointCache.get(id);
    if (cached) return cached;
    if (visiting.has(id)) throw new PlanningError('PACKAGE_INCOMPLETE', `蓝图存在循环依赖：${id}`);
    visiting.add(id);
    const result = [...new Set(block.dependsOn.flatMap(endpoints))].sort(compareIds);
    visiting.delete(id);
    endpointCache.set(id, result);
    return result;
  };

  const taskById = new Map<string, PlanningPackageTask>();
  for (const block of blocks.filter(isTask)) {
    if (!block.task) throw new PlanningError('PACKAGE_INCOMPLETE', `任务 ${block.id} 缺少任务规格`);
    taskById.set(block.id, {
      ...structuredClone(block.task), id: block.id, title: block.title, kind: block.kind,
      requirementIds: [...block.requirementIds], blueprintDependsOn: [...block.dependsOn],
      dependsOn: [...new Set(block.dependsOn.flatMap(endpoints))].sort(compareIds),
    });
  }

  const incoming = new Map([...taskById].map(([id, task]) => [id, task.dependsOn.length]));
  const outgoing = new Map<string, string[]>();
  for (const task of taskById.values()) for (const dependency of task.dependsOn) {
    const dependants = outgoing.get(dependency) ?? [];
    dependants.push(task.id);
    outgoing.set(dependency, dependants);
  }
  const ready = [...taskById.keys()].filter(id => incoming.get(id) === 0).sort(compareIds);
  const tasks: PlanningPackageTask[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    tasks.push(taskById.get(id)!);
    for (const dependant of outgoing.get(id) ?? []) {
      const remaining = incoming.get(dependant)! - 1;
      incoming.set(dependant, remaining);
      if (remaining === 0) ready.push(dependant);
    }
    ready.sort(compareIds);
  }
  if (tasks.length !== taskById.size) throw new PlanningError('PACKAGE_INCOMPLETE', '投影任务存在循环依赖');
  if (!tasks.length) throw new PlanningError('PACKAGE_INCOMPLETE', '开发包缺少任务');

  const blueprintReferences = blocks.filter(block => !isTask(block)).map(block => ({
    id: block.id, title: block.title, kind: block.kind as Exclude<BlueprintBlock['kind'], PlanningPackageTask['kind']>,
    stage: block.stage, dependsOn: [...block.dependsOn], requirementIds: [...block.requirementIds],
  })).sort((left, right) => compareIds(left.id, right.id));
  return { tasks, blueprintReferences };
}
