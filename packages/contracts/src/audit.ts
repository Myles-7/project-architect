/**
 * @file audit.ts
 * @description Type definitions for Spec-Drift Auditor (方案 8 — pa verify).
 */

export type DriftSeverity = 'error' | 'warning' | 'info';

export type DriftCategory =
  | 'dependency'
  | 'boundary'
  | 'directory'
  | 'document'
  | 'constraint';

export interface DriftViolation {
  id: string;
  category: DriftCategory;
  severity: DriftSeverity;
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  actual?: string;
  expected?: string;
  remediation: string;
  relatedDecisionKey?: string;
  relatedAreaId?: string;
}

export interface SpecDriftReport {
  projectId: string;
  targetPath: string;
  auditedAt: string;
  totalChecks: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  isCompliant: boolean;
  violations: DriftViolation[];
  durationMs: number;
}

export interface VerifyDriftRequest {
  targetPath?: string;
  includeWarnings?: boolean;
}
