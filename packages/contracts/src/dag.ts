import type { DecisionStatus } from './decisions.js';

export interface DecisionGraphNode {
  id: string;
  statement: string;
  area: string;
  status: DecisionStatus;
  decisionKey?: string;
  depth: number;
  inDegree: number;
  outDegree: number;
  dependsOn: string[];
  isCycleParticipant?: boolean;
}

export interface DecisionGraphEdge {
  id: string;
  source: string; // The prerequisite decision ID
  target: string; // The dependent decision ID
  type: 'explicit' | 'inferred';
}

export interface CascadeImpactResult {
  targetDecisionId: string;
  targetStatement: string;
  directDependents: string[];
  allTransitiveDependents: string[];
  impactedAreas: string[];
  impactedDocuments: string[];
  hasCycleRisk: boolean;
  cycleNodes?: string[];
}

export interface DecisionGraphView {
  nodes: DecisionGraphNode[];
  edges: DecisionGraphEdge[];
  hasCycles: boolean;
  cycles: string[][];
  topologicalOrder: string[];
  isolatedNodes: string[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    confirmedCount: number;
    candidateCount: number;
    lockedCount: number;
  };
}

export interface GetProjectDagResponse {
  projectId: string;
  dag: DecisionGraphView;
}

export interface GetCascadeImpactRequest {
  decisionId: string;
}

export interface GetCascadeImpactResponse {
  projectId: string;
  impact: CascadeImpactResult;
}
