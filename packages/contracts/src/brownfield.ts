/**
 * @file brownfield.ts
 * @description Type definitions for Brownfield Codebase Ingestion (方案 4).
 */

export interface ScanCodebaseRequest {
  path: string;
  projectId?: string;
  maxFiles?: number;
}

export type TechCategory =
  | 'runtime'
  | 'framework'
  | 'library'
  | 'database'
  | 'build-tool'
  | 'test'
  | 'styling'
  | 'other';

export interface DetectedTechnology {
  name: string;
  category: TechCategory;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  sourceFile: string;
}

export interface BrownfieldCandidateDecision {
  areaId: string;
  decisionKey: string;
  title: string;
  summary: string;
  details: string;
  evidence: string[];
  suggestedTags?: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface CodebaseAnalysisResult {
  scannedPath: string;
  detectedProjectName?: string;
  isMonorepo: boolean;
  primaryLanguage: string;
  technologies: DetectedTechnology[];
  structureSummary: {
    totalFilesScanned: number;
    topLevelDirectories: string[];
    manifestFilesFound: string[];
  };
  candidateDecisions: BrownfieldCandidateDecision[];
  scanDurationMs: number;
}

export interface ApplyBrownfieldCandidatesRequest {
  candidateKeys: string[];
  customPrefix?: string;
}

export interface ApplyBrownfieldCandidatesResponse {
  appliedCount: number;
  appliedKeys: string[];
}
