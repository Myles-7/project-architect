interface DependencyNode { id: string; dependsOn: string[] }

/** Inspect every component once; shared prerequisites do not multiply traversal work. */
export function planningDependencyCycles(nodes: readonly DependencyNode[]): string[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const state = new Map<string, 'active' | 'done'>();
  const cycles = new Set<string>();
  for (const node of nodes) {
    if (state.has(node.id)) continue;
    state.set(node.id, 'active');
    const stack = [{ id: node.id, dependencies: node.dependsOn, next: 0 }];
    while (stack.length) {
      const frame = stack.at(-1)!;
      if (frame.next === frame.dependencies.length) {
        state.set(frame.id, 'done');
        stack.pop();
        continue;
      }
      const dependency = frame.dependencies[frame.next++]!;
      const target = byId.get(dependency);
      // Callers separately reject absent references with their domain error.
      if (!target || state.get(dependency) === 'done') continue;
      if (state.get(dependency) === 'active') { cycles.add(dependency); continue; }
      state.set(dependency, 'active');
      stack.push({ id: dependency, dependencies: target.dependsOn, next: 0 });
    }
  }
  return [...cycles];
}
