import type { InputRefId } from './refs.js';

export type ProjectStage =
  | 'created'
  | 'initial-analysis'
  | 'broad-pass'
  | 'deep-dive'
  | 'readiness-review'
  | 'approved'
  | 'documents-generated';

export type InputMaterialKind = 'text' | 'file' | 'image';

export type InputMaterialStatus =
  | 'saved'
  | 'processing'
  | 'ready'
  | 'used'
  | 'failed'
  | 'excluded';

export interface InputRef {
  id: InputRefId;
  kind: InputMaterialKind;
  label: string;
  storageRef: string;               // Relative path from project root: inputs/<id>/source.<ext>
  status: InputMaterialStatus;
  analysisAvailability: 'available' | 'unavailable';
  createdAt: string;                // ISO 8601
  summary?: string;
  errorMessage?: string;
}

export interface ProjectMetadata {
  schemaVersion: number;
  projectId: string;
  name: string;
  tagline?: string;
  stage: ProjectStage;
  stateRevision: number;
  projectTags: string[];
  inputRefs: InputRef[];
  updatedAt: string;                // ISO 8601
  createdAt: string;                // ISO 8601
}
