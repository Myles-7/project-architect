import type {
  DecisionItem,
  DecisionGraphNode,
  DecisionGraphEdge,
  DecisionGraphView,
  CascadeImpactResult,
  ProjectAreaDefinition,
} from '@project-architect/contracts';

/**
 * Standard mapping from area to spec documents.
 */
const DEFAULT_AREA_DOCUMENT_MAP: Record<string, string[]> = {
  project_overview: ['01_PRODUCT_BOUNDARY.md', 'README.md'],
  target_user: ['01_PRODUCT_BOUNDARY.md', 'USER_RESEARCH.md'],
  mvp_scope: ['01_PRODUCT_BOUNDARY.md', '08_DEVELOPMENT_PLAN.md'],
  core_features: ['02_SYSTEM_ARCHITECTURE.md', 'REQUIREMENTS_SPEC.md'],
  user_flows: ['03_USER_FLOWS.md'],
  page_structure: ['03_USER_FLOWS.md', 'UI_SPEC.md'],
  ux_ui_direction: ['UI_SPEC.md'],
  technical_boundary: ['02_SYSTEM_ARCHITECTURE.md', '04_PROJECT_STATE_MODEL.md', 'SECURITY_SPEC.md'],
  delivery_plan: ['08_DEVELOPMENT_PLAN.md'],
};

export class DecisionGraphProjection {
  /**
   * Projects a set of decisions into an indexed, topological Directed Acyclic Graph (DAG)
   * with automatic cycle detection, in/out degree calculation, and depth layers.
   */
  public static project(
    decisions: DecisionItem[],
    _areas?: readonly ProjectAreaDefinition[],
  ): DecisionGraphView {
    const idMap = new Map<string, DecisionItem>();
    const keyMap = new Map<string, DecisionItem>();

    for (const d of decisions) {
      idMap.set(d.id, d);
      if (d.decisionKey) {
        keyMap.set(d.decisionKey, d);
      }
    }

    const edges: DecisionGraphEdge[] = [];
    const outgoing = new Map<string, Set<string>>(); // source -> set of targets
    const incoming = new Map<string, Set<string>>(); // target -> set of sources

    for (const d of decisions) {
      outgoing.set(d.id, new Set());
      incoming.set(d.id, new Set());
    }

    // Build directed edges: prerequisite (source) -> dependent (target)
    for (const target of decisions) {
      if (!target.dependsOn || target.dependsOn.length === 0) continue;

      for (const prereqRef of target.dependsOn) {
        // Resolve either by direct id or by decisionKey
        const source = idMap.get(prereqRef) || keyMap.get(prereqRef);
        if (source && source.id !== target.id) {
          const edgeId = `edge-${source.id}->${target.id}`;
          if (!outgoing.get(source.id)!.has(target.id)) {
            outgoing.get(source.id)!.add(target.id);
            incoming.get(target.id)!.add(source.id);
            edges.push({
              id: edgeId,
              source: source.id,
              target: target.id,
              type: 'explicit',
            });
          }
        }
      }
    }

    // Cycle detection via Tarjan's algorithm / DFS coloring
    const { hasCycles, cycles, cycleNodeSet } = this.detectCycles(decisions, outgoing);

    // Topological sorting (Kahn's algorithm)
    const inDegreeMap = new Map<string, number>();
    for (const d of decisions) {
      inDegreeMap.set(d.id, incoming.get(d.id)!.size);
    }

    const queue: string[] = [];
    for (const d of decisions) {
      if (inDegreeMap.get(d.id) === 0) {
        queue.push(d.id);
      }
    }

    const topologicalOrder: string[] = [];
    const depthMap = new Map<string, number>();
    for (const d of decisions) {
      depthMap.set(d.id, 0);
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      topologicalOrder.push(curr);
      const currDepth = depthMap.get(curr) || 0;

      for (const next of outgoing.get(curr) || []) {
        const nextDepth = Math.max(depthMap.get(next) || 0, currDepth + 1);
        depthMap.set(next, nextDepth);

        const newInDegree = inDegreeMap.get(next)! - 1;
        inDegreeMap.set(next, newInDegree);
        if (newInDegree === 0) {
          queue.push(next);
        }
      }
    }

    // If there were cycles, some nodes were not queued; append them to the end
    for (const d of decisions) {
      if (!topologicalOrder.includes(d.id)) {
        topologicalOrder.push(d.id);
      }
    }

    // Build final node list
    let maxDepth = 0;
    const isolatedNodes: string[] = [];
    let confirmedCount = 0;
    let candidateCount = 0;
    let lockedCount = 0;

    const nodes: DecisionGraphNode[] = decisions.map((d) => {
      const inDeg = incoming.get(d.id)?.size || 0;
      const outDeg = outgoing.get(d.id)?.size || 0;
      const depth = depthMap.get(d.id) || 0;
      if (depth > maxDepth) maxDepth = depth;

      if (inDeg === 0 && outDeg === 0) {
        isolatedNodes.push(d.id);
      }

      if (d.status === 'confirmed') confirmedCount++;
      else if (d.status === 'candidate') candidateCount++;
      else if (d.status === 'locked') lockedCount++;

      return {
        id: d.id,
        statement: d.statement,
        area: d.area,
        status: d.status,
        decisionKey: d.decisionKey,
        depth,
        inDegree: inDeg,
        outDegree: outDeg,
        dependsOn: d.dependsOn || [],
        isCycleParticipant: cycleNodeSet.has(d.id),
      };
    });

    return {
      nodes,
      edges,
      hasCycles,
      cycles,
      topologicalOrder,
      isolatedNodes,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        maxDepth,
        confirmedCount,
        candidateCount,
        lockedCount,
      },
    };
  }

  /**
   * Computes the downstream cascading impact of a decision (if modified, disputed, or retracted).
   */
  public static computeCascadeImpact(
    decisions: DecisionItem[],
    targetDecisionId: string,
    areaDefinitions?: readonly ProjectAreaDefinition[],
  ): CascadeImpactResult {
    const idMap = new Map<string, DecisionItem>();
    const keyMap = new Map<string, DecisionItem>();

    for (const d of decisions) {
      idMap.set(d.id, d);
      if (d.decisionKey) {
        keyMap.set(d.decisionKey, d);
      }
    }

    const target = idMap.get(targetDecisionId) || keyMap.get(targetDecisionId);
    if (!target) {
      return {
        targetDecisionId,
        targetStatement: 'Unknown decision',
        directDependents: [],
        allTransitiveDependents: [],
        impactedAreas: [],
        impactedDocuments: [],
        hasCycleRisk: false,
      };
    }

    // Build outgoing graph (prereq -> dependents)
    const outgoing = new Map<string, string[]>();
    for (const d of decisions) {
      outgoing.set(d.id, []);
    }

    for (const d of decisions) {
      if (!d.dependsOn) continue;
      for (const ref of d.dependsOn) {
        const source = idMap.get(ref) || keyMap.get(ref);
        if (source && source.id !== d.id) {
          const arr = outgoing.get(source.id);
          if (arr && !arr.includes(d.id)) {
            arr.push(d.id);
          }
        }
      }
    }

    const directDependents = outgoing.get(target.id) || [];
    const allTransitiveDependents: string[] = [];
    const visited = new Set<string>();
    const queue = [...directDependents];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      allTransitiveDependents.push(curr);

      for (const next of outgoing.get(curr) || []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    // Identify impacted areas
    const areaSet = new Set<string>();
    areaSet.add(target.area);
    if (target.affectedAreas) {
      for (const a of target.affectedAreas) areaSet.add(a);
    }

    for (const depId of allTransitiveDependents) {
      const dep = idMap.get(depId);
      if (dep) {
        areaSet.add(dep.area);
        if (dep.affectedAreas) {
          for (const a of dep.affectedAreas) areaSet.add(a);
        }
      }
    }

    const impactedAreas = Array.from(areaSet);

    // Map areas to document specs
    const docSet = new Set<string>();
    for (const areaId of impactedAreas) {
      const docsFromDef = areaDefinitions?.find((def) => def.id === areaId)?.documentPaths;
      if (docsFromDef && docsFromDef.length > 0) {
        for (const doc of docsFromDef) docSet.add(doc);
      } else {
        const fallbackDocs = DEFAULT_AREA_DOCUMENT_MAP[areaId] || ['01_PRODUCT_BOUNDARY.md'];
        for (const doc of fallbackDocs) docSet.add(doc);
      }
    }

    // Check if target is part of any cycles
    const { cycleNodeSet } = this.detectCycles(decisions, new Map(
      Array.from(outgoing.entries()).map(([k, v]) => [k, new Set(v)]),
    ));

    return {
      targetDecisionId: target.id,
      targetStatement: target.statement,
      directDependents,
      allTransitiveDependents,
      impactedAreas,
      impactedDocuments: Array.from(docSet),
      hasCycleRisk: cycleNodeSet.has(target.id),
      cycleNodes: cycleNodeSet.has(target.id) ? Array.from(cycleNodeSet) : undefined,
    };
  }

  private static detectCycles(
    decisions: DecisionItem[],
    outgoing: Map<string, Set<string>>,
  ): { hasCycles: boolean; cycles: string[][]; cycleNodeSet: Set<string> } {
    const WHITE = 0; // unvisited
    const GRAY = 1;  // active in recursion stack
    const BLACK = 2; // completely visited

    const state = new Map<string, number>();
    for (const d of decisions) {
      state.set(d.id, WHITE);
    }

    const cycles: string[][] = [];
    const cycleNodeSet = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string) => {
      state.set(node, GRAY);
      stack.push(node);

      for (const next of outgoing.get(node) || []) {
        const nextState = state.get(next) ?? WHITE;
        if (nextState === GRAY) {
          // Cycle found!
          const cycleStartIndex = stack.indexOf(next);
          if (cycleStartIndex !== -1) {
            const cyclePath = stack.slice(cycleStartIndex).concat(next);
            cycles.push(cyclePath);
            for (const n of cyclePath) {
              cycleNodeSet.add(n);
            }
          }
        } else if (nextState === WHITE) {
          dfs(next);
        }
      }

      stack.pop();
      state.set(node, BLACK);
    };

    for (const d of decisions) {
      if (state.get(d.id) === WHITE) {
        dfs(d.id);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
      cycleNodeSet,
    };
  }
}
