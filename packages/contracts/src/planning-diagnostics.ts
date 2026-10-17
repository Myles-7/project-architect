import type { InputRef } from './project.js';
import type { PlanningBasis, PlanningRun, PlanningRuntimeConfig, PlanningStage, PlanningTask } from './planning.js';
import type { ProviderUsage } from './provider.js';
import type { ProjectSnapshot } from './overview.js';
import type { PlanningState } from './planning.js';

export type DiagnosticAvailability = 'available' | 'partial' | 'unavailable';
export interface DiagnosticSection { availability: DiagnosticAvailability; reasons: string[] }
/** Shared formal PlanningService pure projection; snapshot/state and material inputRefs remain committed history. Material bytes are not rehashed. */
export interface PlanningDiagnosticBasis extends PlanningBasis {
  source: 'effective-planning-projection';
  materialBasis: { source: 'committed-input-refs'; integrity: 'unchecked' };
}
/** Historical projections use an exact committed snapshot; observing does not recover it. */
export interface PlanningHistoryView {
  sourceStateRevision: number;
  snapshot: ProjectSnapshot;
  state: PlanningState;
  basisProjection: PlanningDiagnosticBasis;
  runs: PlanningRunDiagnostic[];
  runtime: DiagnosticSection;
}
export interface PlanningHistoricalDocument {
  content: string;
  documentId: string;
  docPath: string;
  sourceStateRevision: number;
  sourceRevision: number | null;
  storedContentHash: string | null;
  historical: true;
  source: 'committed-legacy-document';
  integrity: 'unchecked';
}
export interface PlanningPackageStatus {
  status: 'current' | 'stale' | 'missing';
  reason: string | null;
  basisHash: string | null;
  packageBasisHash: string | null;
}
export type DiagnosticUsage = { [K in keyof ProviderUsage]: number | null };
export interface PlanningRunDiagnostic {
  runId: string;
  stage: PlanningStage | null;
  storedStatus: PlanningRun['status'] | null;
  effectiveStatus: PlanningRun['status'] | 'interrupted' | 'unknown';
  active: boolean;
  /** Comparison against basisProjection's committed material scope, not a material-content integrity check. */
  basisStatus: 'current' | 'stale' | 'unknown';
  effectiveConfig: PlanningRuntimeConfig | null;
  integrity: 'unchecked' | 'partial';
  reasons: string[];
}
export interface PlanningTaskDiagnostic {
  runId: string;
  taskId: string;
  kind: PlanningTask['kind'];
  status: PlanningTask['status'];
  dependsOn: string[];
  requestedModel: string | null;
  attempts: number | null;
  outputOrigin: PlanningTask['outputOrigin'] | null;
  outputHash: string | null;
  integrity: 'unchecked';
}
export interface PlanningCallDiagnostic extends DiagnosticSection {
  runId: string;
  taskId: string;
  attempt: number;
  status: string | null;
  durationMs: number | null;
  requestedModel: string | null;
  reasoningEffort: string | null;
  usage: DiagnosticUsage;
}
/** Dedicated local diagnostics: absolute paths appear only in the two named path fields. */
export interface ProjectPlanningDiagnostics {
  schemaVersion: 1;
  observedAt: string;
  sourceStateRevision: number | null;
  basisProjection: PlanningDiagnosticBasis;
  project: DiagnosticSection & { projectId: string; revision: number | null; projectPath: string };
  configuration: DiagnosticSection & { scope: 'workspace'; configPath: string; current: PlanningRuntimeConfig; schedulingConcurrency: number };
  runtime: DiagnosticSection & { runs: PlanningRunDiagnostic[] };
  tasks: DiagnosticSection & { items: PlanningTaskDiagnostic[] };
  calls: DiagnosticSection & { recordedCalls: number | null; incomplete: boolean; usage: DiagnosticUsage; items: PlanningCallDiagnostic[] };
  materials: DiagnosticSection & { items: Array<{ id: string; filename: string; status: InputRef['status']; analysisAvailability: InputRef['analysisAvailability'] | null; readable: boolean | null; reason: string | null }> };
  provider: DiagnosticSection & { identity: string | null; probe: { status: 'unchecked'; checkedAt: null; scope: null } };
}
