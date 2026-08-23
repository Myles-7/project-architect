export type DocumentType =
  | 'project'
  | 'product'
  | 'user-flow'
  | 'ux-ui'
  | 'development-plan'
  | 'acceptance'
  | 'agents'
  | 'ai-spec'
  | 'security'
  | 'custom';

export type DocumentStatus = 'draft' | 'generated' | 'approved' | 'exported';

export type SourceAttribution =
  | 'confirmed'
  | 'locked'
  | 'assumption'
  | 'generated-structure';

export interface DocumentSourceMarker {
  type: SourceAttribution;
  sourceId?: string;
  description?: string;
}

export interface DocumentReference {
  id: string;
  type: DocumentType;
  path: string;
  title: string;
  status: DocumentStatus;
  generatedAt: string;
  sourceRevision: number;
  contentHash?: string;
}

export interface DocumentRevision {
  documentRevision: number;
  sourceRevision: number;
  generatedAt: string;
  outdated: boolean;
}

export interface DocumentDiffResult {
  document: string;
  path: string;
  status: 'up-to-date' | 'outdated';
  reason?: string;
  affectedAreas?: string[];
}

export type KnowledgeArea =
  | 'vision'
  | 'user'
  | 'problem'
  | 'scope'
  | 'flow'
  | 'ux'
  | 'constraints'
  | 'acceptance';

export type ProjectMaturityLevel =
  | 'Level 1: Idea'
  | 'Level 2: Defined'
  | 'Level 3: Ready'
  | 'Level 4: Development Ready'
  | 'Level 5: Stable';

export interface DocumentsState {
  schemaVersion: number;
  projectId: string;
  items: DocumentReference[];
  updatedAt: string;
}

export type DocumentManifest = DocumentsState;

export interface DocumentPlanItem {
  type: DocumentType;
  title: string;
  path: string;
  description: string;
  required: boolean;
}

export interface DocumentPlan {
  projectId: string;
  sourceRevision: number;
  documents: DocumentPlanItem[];
}
