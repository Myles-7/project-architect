# Project Architect V1：全系统共享类型契约 (Shared Contracts)

> 文档状态：Phase 0 Engineering Blueprint  
> 归属分包：`packages/contracts`  
> 范围：Frontend / Backend / Core Engine / Agent Runtime 唯一共用的 TypeScript 类型与数据接口定义。

---

## 1. 统一类型引用 (Typed References)

```typescript
export type DecisionRef = `decision:${string}`;
export type AssumptionRef = `assumption:${string}`;
export type GapRef = `gap:${string}`;
export type ConflictRef = `conflict:${string}`;
export type TensionRef = `tension:${string}`;
export type RiskRef = `risk:${string}`;
export type QuestionRef = `question:${string}`;
export type InputRefId = `input:${string}`;

export type TypedRef =
  | DecisionRef
  | AssumptionRef
  | GapRef
  | ConflictRef
  | TensionRef
  | RiskRef
  | QuestionRef
  | InputRefId;
```

---

## 2. 项目与材料契约 (Project & Inputs)

```typescript
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
  storageRef: string;               // 相对项目根目录的路径: inputs/<id>/source.<ext>
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
}
```

---

## 3. 决策与假设契约 (Decisions & Assumptions)

```typescript
export type DecisionStatus =
  | 'candidate'
  | 'confirmed'
  | 'locked'
  | 'superseded'
  | 'rejected';

export type DecisionOrigin = 'user' | 'agent';

export interface DecisionItem {
  id: string;                       // e.g. "dec-01"
  area: string;                     // e.g. "mvp_scope", "target_user", "platform"
  statement: string;
  status: DecisionStatus;
  origin: DecisionOrigin;
  evidenceRefs: TypedRef[];         // 关联的 input/question 证据
  confirmedBy?: 'user';             // 仅当 status 为 confirmed/locked 时存在且必须为 'user'
  supersededBy?: DecisionRef;       // 替代本决定的新决定
  createdAt: string;
  updatedAt: string;
}

export interface DecisionsState {
  schemaVersion: number;
  projectId: string;
  items: DecisionItem[];
  traces?: DecisionTrace[];         // 新写入必须提供；旧项目加载时迁移为空数组
  updatedAt: string;
}

export interface DecisionTrace {
  id: string;
  questionRef: QuestionRef;
  userAnswer: string;
  decisionRef: DecisionRef;
  stateChanges: Array<{
    ref: TypedRef;
    action: 'question-answered' | 'decision-created' | 'decision-confirmed'
      | 'assumption-converted' | 'gap-addressed';
  }>;
  createdAt: string;
}

export type AssumptionStatus = 'active' | 'replaced' | 'converted' | 'removed';

export interface AssumptionItem {
  id: string;                       // e.g. "asm-01"
  statement: string;
  reason: string;
  status: AssumptionStatus;
  linkedDecisionRefs?: DecisionRef[];
  createdAt: string;
  resolvedAt?: string;
}

export interface AssumptionsState {
  schemaVersion: number;
  projectId: string;
  items: AssumptionItem[];
  updatedAt: string;
}
```

---

## 4. 缺口、冲突与风险契约 (Gaps, Conflicts, Risks, Tensions)

```typescript
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface GapItem {
  id: string;                       // e.g. "gap-01"
  area: string;
  severity: SeverityLevel;
  reason: string;
  impact: string;
  dependency: string;
  shouldAskUser: boolean;
  status: 'open' | 'questioned' | 'addressed' | 'deferred';
  priorityFactors?: GapPriorityFactors;
  priority?: SeverityLevel;
  priorityScore?: number;
}

export interface GapPriorityFactors {
  impact: SeverityLevel;
  uncertainty: SeverityLevel;
  dependency: SeverityLevel;
  irreversibility: SeverityLevel;
  stageRelevance: SeverityLevel;
}

export interface ConflictItem {
  id: string;                       // e.g. "cnf-01"
  propositionA: string;
  propositionB: string;
  decisionRefs: TypedRef[];         // 必须包含至少 2 个已确认决定/硬约束引用
  severity: SeverityLevel;
  reason: string;
  status: 'open' | 'resolved' | 'deferred';
}

export interface TensionItem {
  id: string;                       // e.g. "tns-01"
  description: string;
  reason: string;
  status: 'open' | 'addressed' | 'deferred';
}

export interface GapsState {
  schemaVersion: number;
  projectId: string;
  gaps: GapItem[];
  conflicts: ConflictItem[];
  tensions: TensionItem[];
  updatedAt: string;
}

export interface RiskItem {
  id: string;                       // e.g. "rsk-01"
  description: string;
  severity: SeverityLevel;
  impact: string;
  mitigationDirection: string;
  status: 'identified' | 'accepted' | 'mitigated' | 'deferred';
}

export interface RisksState {
  schemaVersion: number;
  projectId: string;
  items: RiskItem[];
  updatedAt: string;
}
```

---

## 5. 提问契约 (Questions)

```typescript
export type QuestionImportance = 'normal' | 'high' | 'critical';

export interface QuestionOption {
  label: string;
  impact: string;
}

export interface QuestionItem {
  id: string;                       // e.g. "q-01"
  issueRef: TypedRef;               // 关联触发该问题的 gap/conflict/risk
  importance: QuestionImportance;
  question: string;
  reason: string;                   // 为什么现在问
  recommendation: string;           // 产品级推荐方向
  recommendationReason: string;     // 推荐理由与权衡
  options: QuestionOption[];
  allowFreeInput: true;             // 恒为 true
  status: 'proposed' | 'shown' | 'answered' | 'dismissed' | 'superseded';
  answer?: string;
  createdAt: string;
  answeredAt?: string;
}

export interface QuestionsState {
  schemaVersion: number;
  projectId: string;
  items: QuestionItem[];
  updatedAt: string;
}
```

---

## 6. Overview 投影契约 (Overview Projection)

```typescript
export type SectionMaturity =
  | 'unexplored'
  | 'needs-clarification'
  | 'mostly-clear'
  | 'clear'
  | 'locked';

export interface OverviewSection {
  id: string;                       // e.g. "mvp_scope", "target_user", "tech_boundary"
  title: string;
  kind: 'fixed' | 'dynamic';
  maturity: SectionMaturity;
  itemRefs: TypedRef[];             // 关联指向的规范事实引用，不保存副本
}

export interface OverviewState {
  schemaVersion: number;
  projectId: string;
  sections: OverviewSection[];
  updatedAt: string;
}
```

---

## 7. 准备度与文档契约 (Readiness & Documents)

```typescript
export type ReadinessStatus = 'ready' | 'ready-with-warnings' | 'not-ready';

export type UserDisposition =
  | 'pending'
  | 'return-to-discovery'
  | 'approved'
  | 'approved-with-warnings'
  | 'approved-with-known-issues'
  | 'approved-with-critical-conflicts';

export interface ReadinessSnapshot {
  id: string;
  status: ReadinessStatus;
  reviewedAt: string;
  requiredAreas: string[];
  warnings: string[];
  issues: string[];
  assumptionRefs: AssumptionRef[];
  knownIssueAcknowledgements: string[];
  criticalConflictAcknowledgements: string[];
  userDisposition: UserDisposition;
}

export interface ReadinessState {
  schemaVersion: number;
  projectId: string;
  current: ReadinessSnapshot;
  history: ReadinessSnapshot[];
  updatedAt: string;
}

export interface DocumentManifest {
  schemaVersion: number;
  projectId: string;
  sourceStateRevision: number;
  generatedAt: string;
  files: string[];                  // e.g. ["AGENTS.md", "docs/PROJECT.md", ...]
  unresolvedMarkers: string[];
}
```

---

## 8. Provider 契约 (AI Provider Interfaces)

```typescript
export interface AIProviderRequest {
  requestId: string;
  task: 'discovery-turn' | 'readiness-review' | 'document-plan';
  prompt: string;
  schemaPath: string;
  contextText: string;
  timeoutMs: number;
}

export type AgentMode =
  | 'idea-analysis'
  | 'gap-analysis'
  | 'question-generation'
  | 'decision-review'
  | 'readiness-review'
  | 'document-compile';

export interface ProviderUsage {
  inputTokens: number | 'unavailable';
  outputTokens: number | 'unavailable';
  thinkingTokens: number | 'unavailable';
  totalTokens: number | 'unavailable';
  cacheReadTokens: number | 'unavailable';
}

export interface StructuredResult<T = unknown> {
  status: 'success' | 'failed' | 'timed-out' | 'cancelled';
  structuredSuccess: boolean;
  structuredOutput: T | null;
  rawEnvelope: unknown;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number;
  usage: ProviderUsage;
  provider: string;
}
```
