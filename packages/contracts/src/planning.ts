import type { QuestionItem } from './questions.js';

export type PlanningStage = 'clarify' | 'product' | 'technical' | 'delivery' | 'feedback';
export type DesignStage = 'product' | 'technical' | 'delivery';
export type PlanningStatus = 'queued' | 'running' | 'paused' | 'reviewable' | 'cancelled' | 'stale' | 'failed';
export type PlanningTaskKind = 'clarification' | 'design' | 'research' | 'validation' | 'integration' | 'review' | 'revision' | 'decomposition';
export type BlueprintBlockKind = 'target' | 'problem' | 'outcomes' | 'scope' | 'non_goals' | 'feature' | 'flow' | 'page' | 'technology' | 'module' | 'data_model' | 'interface' | 'error' | 'deployment' | 'task' | 'acceptance' | 'validation';

export interface DevelopmentTaskSpec {
  goal: string;
  scope: string;
  exclusions: string;
  modules: string[];
  normalBehavior: string;
  failureBehavior: string;
  verification: string[];
  completionCriteria: string[];
  assumptions: string[];
  environment?: string;
  steps?: string[];
  passCriteria?: string[];
  evidenceRequired?: string[];
  onFailure?: string;
}
export interface BlueprintBlock {
  id: string;
  stage: DesignStage;
  kind: BlueprintBlockKind;
  title: string;
  content: string;
  requirementIds: string[];
  dependsOn: string[];
  evidenceIds: string[];
  task?: DevelopmentTaskSpec;
  locked?: boolean;
  approvedBy?: string;
  approvedAt?: string;
}
export interface BlueprintState {
  schemaVersion: 1;
  blocks: BlueprintBlock[];
  stages: Record<DesignStage, 'not-designed' | 'draft' | 'approved' | 'needs-revision'>;
  decisionBasisHash?: string;
  approvedInputHash?: string;
}
export interface EvidenceRecord {
  id: string;
  kind: 'user' | 'material' | 'official-source' | 'experiment';
  content: string;
  source: string;
  obtainedAt: string;
  hash?: string;
  location?: string;
  environment?: string;
  outcome?: 'unexecuted' | 'passed' | 'failed' | 'not-applicable';
  applicability: string;
}
export interface DecisionTopic {
  key: string;
  aliases: string[];
  effectiveDecisionId?: string;
  history: string[];
  reopenReason?: string;
  lastAnswerKind?: 'selection' | 'custom' | 'delegate' | 'defer';
  lastAnsweredQuestionId?: string;
}
export interface ProposedDecision {
  decisionKey: string;
  area: string;
  statement: string;
  rationale: string;
  evidenceIds: string[];
  replaces?: string[];
  aliases?: string[];
}
export interface ChangeGroup {
  id: string;
  title: string;
  impact: string;
  dependsOn: string[];
  blocks: BlueprintBlock[];
  removeBlockIds: string[];
  decisions: ProposedDecision[];
  rejectDecisionIds?: string[];
  status: 'pending' | 'approved' | 'rejected';
}
export interface PlanningBasis { revision: number; hash: string }
export interface ChangeSet {
  id: string;
  runId: string;
  stage: PlanningStage;
  basis: PlanningBasis;
  summary: string;
  groups: ChangeGroup[];
  evidence: EvidenceRecord[];
  status: 'pending' | 'partially-approved' | 'approved' | 'rejected' | 'stale';
  createdAt: string;
  approvals: Array<{ operationId: string; groupIds: string[]; at: string; revision: number }>;
  /** Core-owned review lineage; never accepted from Provider task output. */
  feedbackReview?: {
    sourceBasisHash: string;
    inputHash: string;
    currentBasisHash: string;
    baselineStages: BlueprintState['stages'];
    affectedStages: DesignStage[];
    decisionChanges: boolean;
  };
}
export interface InputInterpretation {
  id: string;
  raw: string;
  questionId?: string;
  kind: 'statement' | 'question' | 'modification' | 'delegation' | 'uncertainty' | 'feedback';
  createdAt: string;
}
export interface PlanningLedger {
  schemaVersion: 1;
  evidence: EvidenceRecord[];
  topics: DecisionTopic[];
  inputs: InputInterpretation[];
  operations: Array<{ id: string; fingerprint: string; revision: number }>;
  diagnostics: string[];
  package?: PlanningPackageManifest;
}
export interface PlanningPackageManifest {
  revision: number;
  sourceRevision: number;
  basisHash: string;
  operationId: string;
  files: Array<{name:string;sha256:string}>;
  directory: string;
}
/** New tasks.json files use v2. Historical package files remain manifest-verified bytes. */
export interface PlanningPackageTask extends DevelopmentTaskSpec {
  id: string;
  title: string;
  kind: 'task' | 'validation';
  requirementIds: string[];
  /** Task/validation endpoints reached through approved dependsOn edges only. */
  dependsOn: string[];
  /** Original immediate dependencies in the approved blueprint. */
  blueprintDependsOn: string[];
}
export interface PlanningPackageBlueprintReference {
  id: string;
  title: string;
  kind: Exclude<BlueprintBlockKind, 'task' | 'validation'>;
  stage: DesignStage;
  dependsOn: string[];
  requirementIds: string[];
}
export interface PlanningPackageTaskFile {
  schemaVersion: 2;
  revision: number;
  blueprintHash: string;
  /** Stable topological order, with ID order among currently available tasks. */
  tasks: PlanningPackageTask[];
  blueprintReferences: PlanningPackageBlueprintReference[];
}
export interface PlanningState extends PlanningLedger { blueprint: BlueprintState; changeSets: ChangeSet[] }

export interface AgentTaskResult {
  summary: string;
  groups: ChangeGroup[];
  questions: QuestionItem[];
  evidence: EvidenceRecord[];
  blockers: string[];
  followUp: Array<{ kind: 'research' | 'validation'; goal: string }>;
  clarification: { target: string; problem: string; outcomes: string; scope: string; constraints: string; delegated: string[] } | null;
  /** Registered authoring scopes, used only to recover a concrete output-limit failure. */
  workItems?: PlanningWorkPartition[];
}
export interface PlanningWorkPartition {
  id: string;
  goal: string;
  /** Stable block IDs owned by this scope; new block IDs are planned here too. */
  blockIds: string[];
  dependsOn: string[];
}
export interface PlanningTask {
  id: string;
  kind: PlanningTaskKind;
  goal: string;
  dependsOn: string[];
  status: 'queued' | 'running' | 'completed' | 'paused' | 'cancelled';
  model: string;
  attempts: number;
  inputRefs: string[];
  outputRef?: string;
  outputHash?: string;
  /** Versioned application-only evidence isolation; Provider receipts remain immutable. */
  assemblyEvidenceScopeVersion?: 1;
  /** Version 2 scopes deletion ownership and identities against frozen Core evidence. */
  assemblyVersion?: 2;
  assemblyKnownEvidenceHash?: string;
  /** Current repair observations live once on the registered whole task. */
  repairIssues?: string[];
  repairSourceTaskId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  /** Frozen semantic basis for reusing a registered follow-up. */
  basisHash?: string;
  partition?: PlanningWorkPartition;
  partitionPlanTaskId?: string;
  partitionTaskIds?: string[];
  assemblyBaseTaskId?: string;
  requiredBlockIds?: string[];
  deferredQuestions?: QuestionItem[];
  outputOrigin?: 'provider' | 'assembly';
}
export interface PlanningEvent { seq: number; at: string; type: string; message: string; taskId?: string }
/** Immutable pending source saved as draft-source.json; never an approval. */
export interface PlanningDraftSource {
  changeSetId: string;
  sourceRunId: string;
  stage: PlanningStage;
  basis: PlanningBasis;
  hash: string;
  groupIds: string[];
}
export interface PlanningRun {
  id: string;
  projectId: string;
  stage: PlanningStage;
  basis: PlanningBasis;
  operationId: string;
  status: PlanningStatus;
  tasks: PlanningTask[];
  createdAt: string;
  updatedAt: string;
  summary?: string;
  error?: string;
  changeSetId?: string;
  pendingQuestions: QuestionItem[];
  clarification?: AgentTaskResult['clarification'];
  nextEventSeq: number;
  progressSignatures: string[];
  request?: StartPlanningRequest;
  draftSource?: PlanningDraftSource;
  /** A prepared draft start can be retried after its input commit was interrupted. */
  pendingStart?: boolean;
  deliveryGeneration?: number;
  /** Models and research sources frozen at run creation; absent on historical runs. */
  effectiveConfig?: PlanningRuntimeConfig;
  deferredWork?: AgentTaskResult['followUp'];
  clarificationInputHash?: string;
  clarificationDecisionHash?: string;
  /** Valid model questions awaiting a later Core-controlled batch, never discarded. */
  deferredQuestions?: QuestionItem[];
  unfinishedBlockIds?: string[];
}
export interface PlanningView {
  sourceStateRevision: number;
  /** Current basis eligibility; historical packages remain stored when stale. */
  packageStatus?: import('./planning-diagnostics.js').PlanningPackageStatus;
  canGenerateProduct?: boolean;
  state: PlanningState;
  runs: PlanningRun[];
  status: '待澄清' | '待设计' | '方案可审阅' | '包含验证任务' | '已批准';
  coverageIssues: string[];
}
export interface QuestionAnswerIntent {
  questionId: string;
  kind: 'selection' | 'custom' | 'delegate' | 'defer';
  optionKeys?: string[];
  text?: string;
}
export interface StartPlanningRequest {
  stage: PlanningStage;
  expectedRevision: number;
  operationId: string;
  inputRefs?: string[];
  feedback?: string;
  /** Revise this valid pending draft in its original stage; requires feedback. */
  draftChangeSetId?: string;
}
export interface ApproveChangeSetRequest {
  expectedRevision: number;
  operationId: string;
  groupIds: string[];
  unlockIds?: string[];
}
export interface PlanningRuntimeConfig { concurrency: number; designModel: string; reviewModel: string; officialHosts?: string[] }
export const DEFAULT_PLANNING_CONFIG: PlanningRuntimeConfig = {
  concurrency: 4, designModel: 'claude-opus-4-6-thinking', reviewModel: 'gemini-3.1-pro-high',
  officialHosts: ['antigravity.google','www.antigravity.google','modelcontextprotocol.io','ts.sdk.modelcontextprotocol.io','nodejs.org','docs.docker.com','docs.python.org','playwright.dev','react.dev','www.typescriptlang.org','vite.dev','expressjs.com','developer.mozilla.org','www.w3.org','www.rfc-editor.org','docs.github.com','docs.anthropic.com','ai.google.dev'],
};
