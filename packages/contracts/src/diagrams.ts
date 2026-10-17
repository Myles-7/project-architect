export type DiagramType =
  | 'system-context'
  | 'component-flow'
  | 'sequence-interaction'
  | 'boundary-governance';

export interface ArchitectureDiagram {
  id: string;
  type: DiagramType;
  title: string;
  description: string;
  mermaidCode: string;
  generatedAt: string;
}

export interface DiagramsResult {
  projectId: string;
  diagrams: ArchitectureDiagram[];
  generatedAt: string;
}

export interface GetDiagramsResponse {
  projectId: string;
  diagrams: ArchitectureDiagram[];
}
