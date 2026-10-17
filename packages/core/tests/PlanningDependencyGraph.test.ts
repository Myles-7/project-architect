import { describe, expect, it } from 'vitest';
import type { BlueprintBlock, ChangeGroup, ProjectSnapshot } from '@project-architect/contracts';
import { blueprintCoverage, emptyPlanningState, PlanningService, ProjectStateEngine } from '../src/index.js';
import { blocks, group, result } from '../../../tests/fixtures/planning.mjs';

// Each pair shares the entire previous layer: few registered edges, many paths.
function layered<T extends { id: string; dependsOn: string[] }>(initial: T[], make: (id: string, dependencies: string[]) => T): T[] {
  const nodes = [...initial];
  let previous = [nodes.at(-1)!.id];
  for (let layer = 0; layer < 24; layer++) {
    const current = [`shared-${layer}-left`, `shared-${layer}-right`];
    nodes.push(...current.map(id => make(id, [...previous])));
    previous = current;
  }
  return nodes;
}

/** Deterministic work guard, independent of wall-clock speed or traversal API. */
function guardDependencyReads<T extends { dependsOn: string[] }>(nodes: T[]) {
  const budget = 10 * (nodes.length + nodes.reduce((sum, node) => sum + node.dependsOn.length, 0));
  let reads = 0;
  for (const node of nodes) {
    const dependencies = node.dependsOn;
    Object.defineProperty(node, 'dependsOn', {
      enumerable: true, get() {
        if (++reads > budget) throw new Error('Repeated dependency paths exceeded the registered graph work budget');
        return dependencies;
      },
    });
  }
  return { count: () => reads, budget };
}

describe('Planning dependency validation over shared prerequisites', () => {
  const complete = () => [...blocks('product'), ...blocks('technical'), ...blocks('delivery')] as BlueprintBlock[];
  const node = (id: string, dependsOn: string[]): BlueprintBlock => ({
    id, dependsOn, kind: 'module', stage: 'technical', title: id,
    content: '复用已经登记的前置模块，实施独立模块并保留异常恢复行为。', requirementIds: [], evidenceIds: [],
  });
  const change = (id: string, dependsOn: string[]): ChangeGroup => ({ ...group('technical'), id, dependsOn, blocks: [] });
  const service = new PlanningService({} as ProjectStateEngine);
  const snapshot = { planning: emptyPlanningState() } as ProjectSnapshot;

  it('accepts a complete shared-prerequisite blueprint without expanding every path', () => {
    const graph = layered(complete(), node), work = guardDependencyReads(graph);
    expect(blueprintCoverage(graph)).toEqual([]);
    expect(work.count()).toBeLessThanOrEqual(work.budget);
  });

  it('accepts shared change-group prerequisites with bounded deterministic validation work', () => {
    const groups = layered([change('foundation', [])], change), work = guardDependencyReads(groups);
    expect(service.draftIssues(snapshot, result({ groups }))).toEqual([]);
    expect(work.count()).toBeLessThanOrEqual(work.budget);
  });

  it('still detects cycles and absent references in non-task components of the complete graph', () => {
    const graph = [...complete(), node('cycle-left', ['cycle-right']), node('cycle-right', ['cycle-left']), node('unrelated', ['absent'])];
    const issues = blueprintCoverage(graph);
    expect(issues.some(issue => issue.includes('循环依赖'))).toBe(true);
    expect(issues).toContain('unrelated 依赖不存在：absent');
    expect(blueprintCoverage([...complete(), node('self', ['self'])]).some(issue => issue.includes('循环依赖'))).toBe(true);
  });

  it('still rejects independent group cycles, self-cycles and missing groups', () => {
    for (const groups of [[change('a', ['b']), change('b', ['a'])], [change('self', ['self'])]]) {
      expect(service.draftIssues(snapshot, result({ groups })).join(' ')).toContain('DEPENDENCY_CONFLICT');
    }
    expect(service.draftIssues(snapshot, result({ groups: [change('orphan', ['absent'])] })).join(' ')).toContain('变更组依赖不存在');
  });
});
