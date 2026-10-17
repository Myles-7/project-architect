import { describe, it, expect } from 'vitest';
import type { DecisionItem } from '@project-architect/contracts';
import { DecisionGraphProjection } from '../src/dag/DecisionGraphProjection.js';

describe('DecisionGraphProjection', () => {
  const sampleDecisions: DecisionItem[] = [
    {
      id: 'dec-01',
      area: 'technical_boundary',
      statement: 'Use local SQLite/filesystem as primary storage.',
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [],
      decisionKey: 'storage_choice',
      createdAt: '2026-09-24T10:00:00Z',
      updatedAt: '2026-09-24T10:00:00Z',
    },
    {
      id: 'dec-02',
      area: 'technical_boundary',
      statement: 'Apply two-stage atomic commits for file writes.',
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [],
      decisionKey: 'atomic_persistence',
      dependsOn: ['dec-01'],
      createdAt: '2026-09-24T10:05:00Z',
      updatedAt: '2026-09-24T10:05:00Z',
    },
    {
      id: 'dec-03',
      area: 'core_features',
      statement: 'Provide undo/redo stack based on state revision history.',
      status: 'candidate',
      origin: 'user',
      evidenceRefs: [],
      decisionKey: 'undo_redo',
      dependsOn: ['dec-02'],
      createdAt: '2026-09-24T10:10:00Z',
      updatedAt: '2026-09-24T10:10:00Z',
    },
    {
      id: 'dec-04',
      area: 'target_user',
      statement: 'Independent user target: Solo system architects.',
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [],
      decisionKey: 'target_persona',
      createdAt: '2026-09-24T10:15:00Z',
      updatedAt: '2026-09-24T10:15:00Z',
    },
  ];

  it('correctly constructs DAG nodes, edges, degrees, and depths', () => {
    const dag = DecisionGraphProjection.project(sampleDecisions);

    expect(dag.nodes.length).toBe(4);
    expect(dag.edges.length).toBe(2);
    expect(dag.hasCycles).toBe(false);
    expect(dag.cycles).toHaveLength(0);

    const node1 = dag.nodes.find((n) => n.id === 'dec-01')!;
    const node2 = dag.nodes.find((n) => n.id === 'dec-02')!;
    const node3 = dag.nodes.find((n) => n.id === 'dec-03')!;
    const node4 = dag.nodes.find((n) => n.id === 'dec-04')!;

    expect(node1.depth).toBe(0);
    expect(node1.inDegree).toBe(0);
    expect(node1.outDegree).toBe(1);

    expect(node2.depth).toBe(1);
    expect(node2.inDegree).toBe(1);
    expect(node2.outDegree).toBe(1);

    expect(node3.depth).toBe(2);
    expect(node3.inDegree).toBe(1);
    expect(node3.outDegree).toBe(0);

    expect(node4.depth).toBe(0);
    expect(dag.isolatedNodes).toContain('dec-04');
    expect(dag.summary.confirmedCount).toBe(3);
    expect(dag.summary.candidateCount).toBe(1);
  });

  it('detects circular dependencies and flags cycle participants', () => {
    const cyclicDecisions: DecisionItem[] = [
      {
        id: 'dec-A',
        area: 'technical_boundary',
        statement: 'A depends on B',
        status: 'candidate',
        origin: 'user',
        evidenceRefs: [],
        dependsOn: ['dec-B'],
        createdAt: '2026-09-24T10:00:00Z',
        updatedAt: '2026-09-24T10:00:00Z',
      },
      {
        id: 'dec-B',
        area: 'technical_boundary',
        statement: 'B depends on A',
        status: 'candidate',
        origin: 'user',
        evidenceRefs: [],
        dependsOn: ['dec-A'],
        createdAt: '2026-09-24T10:05:00Z',
        updatedAt: '2026-09-24T10:05:00Z',
      },
    ];

    const dag = DecisionGraphProjection.project(cyclicDecisions);
    expect(dag.hasCycles).toBe(true);
    expect(dag.cycles.length).toBeGreaterThan(0);

    const nodeA = dag.nodes.find((n) => n.id === 'dec-A')!;
    const nodeB = dag.nodes.find((n) => n.id === 'dec-B')!;
    expect(nodeA.isCycleParticipant).toBe(true);
    expect(nodeB.isCycleParticipant).toBe(true);
  });

  it('computes downstream cascade impact for root and intermediate decisions', () => {
    // When dec-01 changes, both dec-02 and dec-03 are downstream dependents
    const impactRoot = DecisionGraphProjection.computeCascadeImpact(sampleDecisions, 'dec-01');
    expect(impactRoot.targetDecisionId).toBe('dec-01');
    expect(impactRoot.directDependents).toEqual(['dec-02']);
    expect(impactRoot.allTransitiveDependents).toContain('dec-02');
    expect(impactRoot.allTransitiveDependents).toContain('dec-03');
    expect(impactRoot.impactedAreas).toContain('technical_boundary');
    expect(impactRoot.impactedAreas).toContain('core_features');
    expect(impactRoot.impactedDocuments.length).toBeGreaterThan(0);

    // When leaf dec-03 changes, it has no downstream dependents
    const impactLeaf = DecisionGraphProjection.computeCascadeImpact(sampleDecisions, 'dec-03');
    expect(impactLeaf.directDependents).toHaveLength(0);
    expect(impactLeaf.allTransitiveDependents).toHaveLength(0);
    expect(impactLeaf.impactedAreas).toEqual(['core_features']);
  });
});
