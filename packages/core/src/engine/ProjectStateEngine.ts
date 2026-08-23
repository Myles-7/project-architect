import { join, resolve, extname, dirname } from 'node:path';
import { FileStorage } from '../storage/FileStorage.js';
import { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import { StateCommitManager } from '../commit/StateCommitManager.js';
import { LightweightConflictDetector } from '../conflicts/LightweightConflictDetector.js';
import { ReadinessEvaluator } from '../readiness/ReadinessEvaluator.js';
import { ReadinessGate } from '../readiness/ReadinessGate.js';
import {
  parseTypedRef,
  isTypedRef,
  ErrorCode,
} from '@project-architect/contracts';
import type {
  ProjectMetadata,
  ProjectStage,
  ProjectSnapshot,
  DecisionsState,
  DecisionItem,
  DecisionTrace,
  AssumptionsState,
  AssumptionItem,
  GapsState,
  GapItem,
  ConflictItem,
  RisksState,
  QuestionsState,
  QuestionItem,
  OverviewState,
  OverviewSection,
  ReadinessState,
  ReadinessSnapshot,
  UserDisposition,
  DocumentsState,
  DiscoveryResult,
  TypedRef,
  DecisionRef,
  AssumptionRef,
  QuestionRef,
  InputRef,
  InputMaterialKind,
} from '@project-architect/contracts';

const FIXED_SECTIONS: Array<{ id: string; title: string }> = [
  { id: 'project_overview', title: '项目概述与愿景' },
  { id: 'target_user', title: '目标用户与痛点' },
  { id: 'mvp_scope', title: 'MVP 范围与边界' },
  { id: 'core_features', title: '核心功能特性' },
  { id: 'user_flows', title: '主要用户旅程与流程' },
  { id: 'page_structure', title: '页面结构与信息架构' },
  { id: 'ux_ui_direction', title: 'UX 体验与 UI 方向' },
  { id: 'technical_boundary', title: '技术底线与运行约束' },
  { id: 'delivery_plan', title: '交付计划与阶段里程碑' },
];

export class ProjectStateEngine {
  private storage: FileStorage;
  private guard: WorkspaceGuard;
  private commitManager: StateCommitManager;
  private conflictDetector: LightweightConflictDetector;

  constructor(
    storage: FileStorage = new FileStorage(),
    guard?: WorkspaceGuard
  ) {
    this.storage = storage;
    this.guard = guard || new WorkspaceGuard();
    this.commitManager = new StateCommitManager(storage);
    this.conflictDetector = new LightweightConflictDetector();
  }

  /**
   * Initializes a brand-new project with all mandatory directories and valid JSON state files.
   */
  async createProject(options: {
    name: string;
    idea: string;
    projectId?: string;
    projectTags?: string[];
    projectPath?: string;
  }): Promise<{ projectPath: string; snapshot: ProjectSnapshot }> {
    const timestamp = new Date().toISOString();
    const rawId = options.projectId || `proj-${Date.now()}`;
    const projectId = this.guard.validateProjectId(rawId);
    const targetDir = options.projectPath
      ? resolve(options.projectPath)
      : this.guard.resolveProjectPath(projectId);

    await this.storage.ensureDir(targetDir);
    await this.storage.ensureDir(join(targetDir, 'state'));
    await this.storage.ensureDir(join(targetDir, 'inputs'));
    await this.storage.ensureDir(join(targetDir, 'documents'));
    await this.storage.ensureDir(join(targetDir, 'conversations'));

    // 1. Initial Input Material
    const initialInputId = 'inp-01';
    const initialInputRelPath = `inputs/${initialInputId}/source.txt`;
    const initialInputAbsDir = join(targetDir, 'inputs', initialInputId);
    await this.storage.ensureDir(initialInputAbsDir);
    await this.storage.writeText(join(initialInputAbsDir, 'source.txt'), options.idea);
    await this.storage.writeJson(join(initialInputAbsDir, 'extraction.json'), {
      id: `input:${initialInputId}`,
      extractedText: options.idea,
      status: 'ready',
      updatedAt: timestamp,
    });

    const inputRef: InputRef = {
      id: `input:${initialInputId}`,
      kind: 'text',
      label: 'Initial Idea Prompt',
      storageRef: initialInputRelPath,
      status: 'ready',
      analysisAvailability: 'available',
      createdAt: timestamp,
      summary: options.idea.slice(0, 80),
    };

    // 2. Initial Metadata
    const metadata: ProjectMetadata = {
      schemaVersion: 1,
      projectId,
      name: options.name,
      tagline: options.idea.slice(0, 100),
      stage: 'created',
      stateRevision: 1,
      projectTags: options.projectTags || ['Local-First'],
      inputRefs: [inputRef],
      updatedAt: timestamp,
      createdAt: timestamp,
    };

    // 3. Initial Decisions
    const initialDecision: DecisionItem = {
      id: 'dec-01',
      area: 'project_overview',
      statement: options.idea,
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [`input:${initialInputId}`],
      confirmedBy: 'user',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const decisions: DecisionsState = {
      schemaVersion: 1,
      projectId,
      items: [initialDecision],
      traces: [],
      updatedAt: timestamp,
    };

    // 4. Initial Assumptions
    const assumptions: AssumptionsState = {
      schemaVersion: 1,
      projectId,
      items: [],
      updatedAt: timestamp,
    };

    // 5. Initial Gaps
    const gaps: GapsState = {
      schemaVersion: 1,
      projectId,
      gaps: [
        {
          id: 'gap-01',
          area: 'target_user',
          severity: 'high',
          reason: '项目初始创建，核心目标用户细分画像尚待明确。',
          impact: '影响后续 MVP 核心功能优先级。',
          dependency: 'none',
          shouldAskUser: true,
          status: 'open',
        },
      ],
      conflicts: [],
      tensions: [],
      updatedAt: timestamp,
    };

    // 6. Initial Risks
    const risks: RisksState = {
      schemaVersion: 1,
      projectId,
      items: [],
      updatedAt: timestamp,
    };

    // 7. Initial Questions
    const questions: QuestionsState = {
      schemaVersion: 1,
      projectId,
      items: [],
      updatedAt: timestamp,
    };

    // 8. Initial Overview Projection
    const overviewSections: OverviewSection[] = FIXED_SECTIONS.map((sec) => ({
      id: sec.id,
      title: sec.title,
      kind: 'fixed',
      maturity: sec.id === 'project_overview' ? 'mostly-clear' : 'unexplored',
      itemRefs: sec.id === 'project_overview' ? ['decision:dec-01'] : [],
    }));

    const overview: OverviewState = {
      schemaVersion: 1,
      projectId,
      sections: overviewSections,
      updatedAt: timestamp,
    };

    // 9. Initial Readiness
    const readiness: ReadinessState = {
      schemaVersion: 1,
      projectId,
      current: {
        id: `rdn-${Date.now()}`,
        status: 'not-ready',
        reviewedAt: timestamp,
        requiredAreas: ['target_user', 'mvp_scope', 'core_features', 'technical_boundary'],
        warnings: ['项目刚创建，尚在初始发散阶段。'],
        issues: ['目标用户与 MVP 范围尚未收敛。'],
        assumptionRefs: [],
        knownIssueAcknowledgements: [],
        criticalConflictAcknowledgements: [],
        userDisposition: 'pending',
      },
      history: [],
      updatedAt: timestamp,
    };

    // 10. Initial Documents State
    const manifest: DocumentsState = {
      schemaVersion: 1,
      projectId,
      items: [],
      updatedAt: timestamp,
    };

    // Commit all initial state files
    await this.commitManager.commit(targetDir, 1, {
      metadata,
      overview,
      decisions,
      assumptions,
      gaps,
      risks,
      questions,
      readiness,
      documents: manifest,
    });

    const snapshot: ProjectSnapshot = {
      metadata,
      overview,
      decisions,
      assumptions,
      gaps,
      risks,
      questions,
      readiness,
      documents: manifest,
    };

    return { projectPath: targetDir, snapshot };
  }

  /**
   * Completes document compilation by updating stage and documents state atomically in a single two-phase commit,
   * while publishing rendered specification documents and public manifest to the project root.
   */
  async completeDocumentCompilation(
    projectPath: string,
    documentsState: DocumentsState,
    renderedFiles: Array<{ path: string; content: string }> | undefined,
    expectedRevision: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    // Validate using ReadinessGate SSOT
    new ReadinessGate().validateForDocumentGeneration(snapshot);

    // Write rendered markdown specification documents to project directory
    if (renderedFiles && renderedFiles.length > 0) {
      for (const doc of renderedFiles) {
        const targetAbs = join(projectPath, doc.path);
        const targetDir = dirname(targetAbs);
        if (!(await this.storage.exists(targetDir))) {
          await this.storage.ensureDir(targetDir);
        }
        await this.storage.writeText(targetAbs, doc.content);
      }
    }

    // Write public documents.json in project root
    await this.storage.writeJson(join(projectPath, 'documents.json'), documentsState);

    const timestamp = new Date().toISOString();
    snapshot.metadata.stage = 'documents-generated';
    snapshot.metadata.updatedAt = timestamp;

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        documents: documentsState,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * Loads an existing project, executes crash recovery if needed, and returns the full ProjectSnapshot.
   */
  async loadProject(projectPath: string): Promise<ProjectSnapshot> {
    const absPath = resolve(projectPath);
    if (!(await this.storage.exists(absPath))) {
      throw new Error(`Project directory does not exist at ${absPath}`);
    }

    // Run recovery check for any interrupted two-phase commits
    await this.commitManager.recoverIfNeeded(absPath);

    const metadata = await this.storage.readJson<ProjectMetadata>(join(absPath, 'project.json'));
    const stateDir = join(absPath, 'state');

    const decisions = await this.storage.readJson<DecisionsState>(join(stateDir, 'decisions.json'));
    // Phase 2.5 is additive: older local projects do not yet have a trace array.
    decisions.traces ??= [];
    const assumptions = await this.storage.readJson<AssumptionsState>(join(stateDir, 'assumptions.json'));
    const gaps = await this.storage.readJson<GapsState>(join(stateDir, 'gaps.json'));
    const risks = await this.storage.readJson<RisksState>(join(stateDir, 'risks.json'));
    const questions = await this.storage.readJson<QuestionsState>(join(stateDir, 'questions.json'));
    const readiness = await this.storage.readJson<ReadinessState>(join(stateDir, 'readiness.json'));

    let documents: DocumentsState | undefined;
    if (await this.storage.exists(join(stateDir, 'documents.json'))) {
      documents = await this.storage.readJson<DocumentsState>(join(stateDir, 'documents.json'));
    }

    let overview: OverviewState;
    if (await this.storage.exists(join(stateDir, 'overview.json'))) {
      overview = await this.storage.readJson<OverviewState>(join(stateDir, 'overview.json'));
    } else {
      overview = this.buildOverviewProjection(metadata.projectId, decisions, gaps);
    }

    return {
      metadata,
      overview,
      decisions,
      assumptions,
      gaps,
      risks,
      questions,
      readiness,
      documents,
    };
  }

  /**
   * Updates the lifecycle stage of a project.
   */
  async updateStage(
    projectPath: string,
    stage: ProjectStage,
    expectedRevision: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const nextRevision = snapshot.metadata.stateRevision + 1;
    const timestamp = new Date().toISOString();

    const updatedMetadata: ProjectMetadata = {
      ...snapshot.metadata,
      stage,
      stateRevision: nextRevision,
      updatedAt: timestamp,
    };

    const targetDir = resolve(projectPath);
    await this.commitManager.commit(targetDir, nextRevision, {
      metadata: updatedMetadata,
      overview: snapshot.overview,
      decisions: snapshot.decisions,
      assumptions: snapshot.assumptions,
      gaps: snapshot.gaps,
      risks: snapshot.risks,
      questions: snapshot.questions,
      readiness: snapshot.readiness,
    }, expectedRevision);

    return await this.loadProject(projectPath);
  }

  /**
   * Gets the current project snapshot.
   */
  async getSnapshot(projectPath: string): Promise<ProjectSnapshot> {
    return this.loadProject(projectPath);
  }

  /**
   * User explicitly confirms a candidate or an assumption.
   * If target is Candidate -> upgrades to Confirmed.
   * If target is Assumption -> converts Assumption to converted, creates new Confirmed Decision.
   * Only explicitly referenced or trace-linked gaps are marked addressed.
   */
  async confirmDecision(
    projectPath: string,
    targetRef: TypedRef,
    expectedRevision: number,
    options?: { resolvedGapRefs?: TypedRef[] }
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();
    const parsed = parseTypedRef(targetRef);

    let targetDecision: DecisionItem | undefined;
    let targetAssumption: AssumptionItem | undefined;

    if (parsed.kind === 'decision') {
      targetDecision = snapshot.decisions.items.find((d) => d.id === parsed.id);
      if (!targetDecision) {
        throw new Error(`Decision with reference ${targetRef} not found in project state.`);
      }
    } else if (parsed.kind === 'assumption') {
      targetAssumption = snapshot.assumptions.items.find((a) => a.id === parsed.id);
      if (!targetAssumption) {
        throw new Error(`Assumption with reference ${targetRef} not found in project state.`);
      }
    } else {
      throw new Error(`Invalid target reference kind "${parsed.kind}" for decision confirmation.`);
    }

    const updatedDecisions = { ...snapshot.decisions };
    const updatedAssumptions = { ...snapshot.assumptions };
    const updatedGaps = { ...snapshot.gaps };

    const resolvedGapIds = new Set<string>();
    if (options?.resolvedGapRefs) {
      for (const ref of options.resolvedGapRefs) {
        const p = parseTypedRef(ref);
        if (p.kind === 'gap') resolvedGapIds.add(p.id);
      }
    }

    if (targetDecision) {
      if (targetDecision.status === 'locked') {
        throw new Error(`Decision ${targetRef} is locked and cannot be re-confirmed.`);
      }
      targetDecision.status = 'confirmed';
      targetDecision.confirmedBy = 'user';
      targetDecision.updatedAt = timestamp;
      if (targetDecision.evidenceRefs) {
        for (const ref of targetDecision.evidenceRefs) {
          const p = parseTypedRef(ref);
          if (p.kind === 'gap') resolvedGapIds.add(p.id);
        }
      }
    } else if (targetAssumption) {
      targetAssumption.status = 'converted';
      targetAssumption.resolvedAt = timestamp;

      const decId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const decRef: DecisionRef = `decision:${decId}`;
      targetAssumption.linkedDecisionRefs = [...(targetAssumption.linkedDecisionRefs || []), decRef];

      const newConfirmedDecision: DecisionItem = {
        id: decId,
        area: 'general',
        statement: targetAssumption.statement,
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [targetRef],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      updatedDecisions.items = [...updatedDecisions.items, newConfirmedDecision];
    }

    // ONLY mark specifically linked gaps as addressed
    if (resolvedGapIds.size > 0) {
      updatedGaps.gaps = updatedGaps.gaps.map((g) => {
        return resolvedGapIds.has(g.id) && g.status === 'open'
          ? { ...g, status: 'addressed' as const }
          : g;
      });
    }

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      updatedDecisions,
      updatedGaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        decisions: updatedDecisions,
        assumptions: updatedAssumptions,
        gaps: updatedGaps,
        overview: updatedOverview,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * Evaluates project readiness and transitions project to readiness-review stage.
   */
  async evaluateReadiness(
    projectPath: string,
    expectedRevision: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const evalResult = new ReadinessEvaluator().evaluate(snapshot);
    const timestamp = new Date().toISOString();

    const readinessSnapshot: ReadinessSnapshot = {
      id: `rdn-${Date.now()}`,
      status: evalResult.ready
        ? evalResult.warnings.length > 0
          ? 'ready-with-warnings'
          : 'ready'
        : 'not-ready',
      reviewedAt: timestamp,
      requiredAreas: ['project_overview', 'target_user', 'mvp_scope', 'technical_boundary'],
      warnings: evalResult.warnings,
      issues: evalResult.blockingIssues,
      assumptionRefs: snapshot.assumptions.items.map((a) => `assumption:${a.id}` as AssumptionRef),
      knownIssueAcknowledgements:
        snapshot.readiness?.current?.knownIssueAcknowledgements || [],
      criticalConflictAcknowledgements:
        snapshot.readiness?.current?.criticalConflictAcknowledgements || [],
      userDisposition: snapshot.readiness?.current?.userDisposition || 'pending',
    };

    const updatedReadiness: ReadinessState = {
      schemaVersion: 1,
      projectId: snapshot.metadata.projectId,
      current: readinessSnapshot,
      history: [
        ...(snapshot.readiness?.history || []),
        ...(snapshot.readiness?.current ? [snapshot.readiness.current] : []),
      ],
      updatedAt: timestamp,
    };

    snapshot.metadata.stage = 'readiness-review';
    snapshot.metadata.updatedAt = timestamp;

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        readiness: updatedReadiness,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * Sets explicit User Disposition on Readiness and advances/reverts stage accordingly.
   */
  async setUserDisposition(
    projectPath: string,
    disposition: UserDisposition,
    expectedRevision: number,
    acknowledgements?:
      | TypedRef[]
      | {
          knownIssues?: string[];
          criticalConflicts?: string[];
        }
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    let ackRefs: TypedRef[] = [];
    if (Array.isArray(acknowledgements)) {
      ackRefs = acknowledgements;
    } else if (acknowledgements) {
      ackRefs = [
        ...(acknowledgements.knownIssues || []).map((id) =>
          id.startsWith('gap:') ? id : `gap:${id}`
        ),
        ...(acknowledgements.criticalConflicts || []).map((id) =>
          id.startsWith('conflict:') ? id : `conflict:${id}`
        ),
      ] as TypedRef[];
    }

    // SSOT Validation via ReadinessGate
    new ReadinessGate().validateForDisposition(snapshot, disposition, ackRefs);

    const timestamp = new Date().toISOString();
    const currentReadiness = snapshot.readiness?.current || {
      id: `rdn-${Date.now()}`,
      status: 'not-ready',
      reviewedAt: timestamp,
      requiredAreas: [],
      warnings: [],
      issues: [],
      assumptionRefs: [],
      knownIssueAcknowledgements: [],
      criticalConflictAcknowledgements: [],
      userDisposition: 'pending',
    };

    let newKnownIssues: string[] = [];
    let newCriticalConflicts: string[] = [];

    for (const ref of ackRefs) {
      if (ref.startsWith('conflict:') || ref.startsWith('cnf:')) {
        newCriticalConflicts.push(ref);
      } else {
        newKnownIssues.push(ref);
      }
    }

    const allAckConflicts = Array.from(
      new Set([...currentReadiness.criticalConflictAcknowledgements, ...newCriticalConflicts])
    );
    const allAckIssues = Array.from(
      new Set([...currentReadiness.knownIssueAcknowledgements, ...newKnownIssues])
    );

    const updatedSnapshot: ReadinessSnapshot = {
      ...currentReadiness,
      userDisposition: disposition,
      reviewedAt: timestamp,
      knownIssueAcknowledgements: allAckIssues,
      criticalConflictAcknowledgements: allAckConflicts,
    };

    const updatedReadiness: ReadinessState = {
      schemaVersion: 1,
      projectId: snapshot.metadata.projectId,
      current: updatedSnapshot,
      history: [
        ...(snapshot.readiness?.history || []),
        ...(snapshot.readiness?.current ? [snapshot.readiness.current] : []),
      ],
      updatedAt: timestamp,
    };

    if (disposition.startsWith('approved')) {
      snapshot.metadata.stage = 'approved';
    } else if (disposition === 'return-to-discovery') {
      snapshot.metadata.stage = 'broad-pass';
    }

    snapshot.metadata.updatedAt = timestamp;

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        readiness: updatedReadiness,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * User manually adds or records a confirmed/locked decision.
   */
  async addDecision(
    projectPath: string,
    area: string,
    statement: string,
    expectedRevision: number,
    status: 'confirmed' | 'locked' = 'confirmed'
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();
    const decId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newDecision: DecisionItem = {
      id: decId,
      area,
      statement,
      status,
      origin: 'user',
      evidenceRefs: [],
      confirmedBy: 'user',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const updatedDecisions = {
      ...snapshot.decisions,
      items: [...snapshot.decisions.items, newDecision],
      updatedAt: timestamp,
    };

    const updatedGaps = {
      ...snapshot.gaps,
      gaps: snapshot.gaps.gaps.map((g) => {
        if (g.area === area && g.status === 'open') {
          return { ...g, status: 'addressed' as const };
        }
        return g;
      }),
      updatedAt: timestamp,
    };

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      updatedDecisions,
      updatedGaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(projectPath, targetRevision, {
      metadata: snapshot.metadata,
      decisions: updatedDecisions,
      gaps: updatedGaps,
      overview: updatedOverview,
    });

    return await this.loadProject(projectPath);
  }

  /**
   * Records an explicit user answer as a confirmed decision and creates a
   * compact audit trace. This is the only path that promotes a question answer
   * into project fact; Agent output never takes this path by itself.
   */
  async answerQuestion(
    projectPath: string,
    questionRef: QuestionRef,
    answer: string,
    expectedRevision: number,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);
    if (!answer.trim()) throw new Error('A user answer is required to create a decision trace.');

    const cleanRef = String(questionRef).startsWith('question:') ? questionRef : (`question:${questionRef}` as QuestionRef);
    const parsed = parseTypedRef(cleanRef);
    if (parsed.kind !== 'question') throw new Error(`Expected a question reference, received "${questionRef}".`);
    const question = snapshot.questions.items.find((item) => item.id === parsed.id);
    if (!question) throw new Error(`Question "${questionRef}" not found`);
    if (question.status === 'answered' || question.status === 'dismissed' || question.status === 'superseded') {
      throw new Error(`Question "${questionRef}" can no longer be answered. Current status: "${question.status}"`);
    }

    const timestamp = new Date().toISOString();
    question.status = 'answered';
    question.answer = answer.trim();
    question.answeredAt = timestamp;

    const issue = parseTypedRef(question.issueRef);
    const linkedGap = issue.kind === 'gap'
      ? snapshot.gaps.gaps.find((gap) => gap.id === issue.id)
      : undefined;
    const decisionId = `dec-${Date.now()}`;
    const decisionRef = `decision:${decisionId}` as DecisionRef;
    const decision: DecisionItem = {
      id: decisionId,
      area: linkedGap?.area ?? 'general',
      statement: answer.trim(),
      status: 'confirmed',
      origin: 'user',
      evidenceRefs: [questionRef],
      confirmedBy: 'user',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    snapshot.decisions.items.push(decision);

    const stateChanges: DecisionTrace['stateChanges'] = [
      { ref: questionRef, action: 'question-answered' },
      { ref: decisionRef, action: 'decision-created' },
    ];
    if (linkedGap?.status === 'open') {
      linkedGap.status = 'addressed';
      stateChanges.push({ ref: `gap:${linkedGap.id}` as TypedRef, action: 'gap-addressed' });
    }
    const traceId = `trace-${Date.now()}`;
    snapshot.decisions.traces ??= [];
    snapshot.decisions.traces.push({
      id: traceId,
      questionRef,
      userAnswer: answer.trim(),
      decisionRef,
      stateChanges,
      createdAt: timestamp,
    });
    snapshot.decisions.updatedAt = timestamp;
    snapshot.questions.updatedAt = timestamp;
    snapshot.gaps.updatedAt = timestamp;
    snapshot.metadata.updatedAt = timestamp;

    const overview = this.buildOverviewProjection(snapshot.metadata.projectId, snapshot.decisions, snapshot.gaps);
    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        decisions: snapshot.decisions,
        gaps: snapshot.gaps,
        questions: snapshot.questions,
        overview,
      },
      expectedRevision
    );
    const updatedSnapshot = await this.loadProject(projectPath);
    return updatedSnapshot;
  }

  /**
   * User explicitly locks a decision. Must already be Confirmed.
   */
  async lockDecision(
    projectPath: string,
    decisionRef: DecisionRef,
    expectedRevision: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const parsed = parseTypedRef(decisionRef);
    const item = snapshot.decisions.items.find((d) => d.id === parsed.id);
    if (!item) throw new Error(`Decision "${decisionRef}" not found`);
    if (item.status !== 'confirmed') {
      throw new Error(`Only confirmed decisions can be locked. Current status: "${item.status}"`);
    }

    const timestamp = new Date().toISOString();
    item.status = 'locked';
    item.updatedAt = timestamp;

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      snapshot.decisions,
      snapshot.gaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        decisions: snapshot.decisions,
        overview: updatedOverview,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * User explicitly unlocks a decision.
   */
  async unlockDecision(
    projectPath: string,
    decisionRef: DecisionRef,
    expectedRevision: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const parsed = parseTypedRef(decisionRef);
    const item = snapshot.decisions.items.find((d) => d.id === parsed.id);
    if (!item) throw new Error(`Decision "${decisionRef}" not found`);
    if (item.status !== 'locked') {
      throw new Error(`Decision "${decisionRef}" is not locked. Current status: "${item.status}"`);
    }

    const timestamp = new Date().toISOString();
    item.status = 'confirmed';
    item.updatedAt = timestamp;

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      snapshot.decisions,
      snapshot.gaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        decisions: snapshot.decisions,
        overview: updatedOverview,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * User directly edits an Overview item.
   * Records user origin and upgrades/updates to Confirmed. If target was locked, marks superseded.
   */
  async editOverviewItem(
    projectPath: string,
    sectionId: string,
    itemRef: TypedRef | undefined,
    newStatement: string,
    expectedRevision: number
  ): Promise<{ decisionRef: DecisionRef; affectedRefs: TypedRef[]; snapshot: ProjectSnapshot }> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();
    let finalDecRef: DecisionRef;

    if (itemRef && isTypedRef(itemRef)) {
      const parsed = parseTypedRef(itemRef);
      const existing = snapshot.decisions.items.find((d) => d.id === parsed.id);
      if (existing) {
        if (existing.status === 'locked') {
          // Locked item superseded by user's direct edit
          existing.status = 'superseded';
          existing.updatedAt = timestamp;
          const newId = `dec-${Date.now()}`;
          finalDecRef = `decision:${newId}`;
          existing.supersededBy = finalDecRef;
          snapshot.decisions.items.push({
            id: newId,
            area: sectionId,
            statement: newStatement,
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [itemRef],
            confirmedBy: 'user',
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        } else {
          existing.statement = newStatement;
          existing.status = 'confirmed';
          existing.origin = 'user';
          existing.confirmedBy = 'user';
          existing.updatedAt = timestamp;
          finalDecRef = itemRef as DecisionRef;
        }
      } else {
        const newId = `dec-${Date.now()}`;
        finalDecRef = `decision:${newId}`;
        snapshot.decisions.items.push({
          id: newId,
          area: sectionId,
          statement: newStatement,
          status: 'confirmed',
          origin: 'user',
          evidenceRefs: [],
          confirmedBy: 'user',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    } else {
      const newId = `dec-${Date.now()}`;
      finalDecRef = `decision:${newId}`;
      snapshot.decisions.items.push({
        id: newId,
        area: sectionId,
        statement: newStatement,
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const updatedGaps = {
      ...snapshot.gaps,
      gaps: snapshot.gaps.gaps.map((g) => {
        if (g.area === sectionId && g.status === 'open') {
          return { ...g, status: 'addressed' as const };
        }
        return g;
      }),
      updatedAt: timestamp,
    };

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      snapshot.decisions,
      updatedGaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        decisions: snapshot.decisions,
        gaps: updatedGaps,
        overview: updatedOverview,
      },
      expectedRevision
    );

    const newSnapshot = await this.loadProject(projectPath);
    return { decisionRef: finalDecRef, affectedRefs: [finalDecRef], snapshot: newSnapshot };
  }

  /**
   * Applies the structured result of a B2.1 discovery-turn to Project State.
   * Enforces rules:
   * 1. Agent suggestions enter Candidate/Assumption/Gap/Risk/Question.
   * 2. Agent cannot overwrite locked decisions.
   * 3. Detects conflicts against existing locked decisions.
   */
  async applyDiscoveryTurn(
    projectPath: string,
    result: DiscoveryResult,
    expectedRevision: number,
    payload: {
      newCandidates?: DecisionItem[];
      autoAssumptions?: AssumptionItem[];
      prioritizedGaps?: GapItem[];
      questions?: QuestionItem[];
    } = {}
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();
    const lockedDecisions = snapshot.decisions.items.filter((d) => d.status === 'locked');

    // 1. Process Candidates
    const candidatesToAdd = payload.newCandidates && payload.newCandidates.length > 0
      ? payload.newCandidates.map((c) => c.statement)
      : result.candidates || [];
    for (const candText of candidatesToAdd) {
      const exists = snapshot.decisions.items.some(
        (d) => d.statement.trim() === candText.trim() && d.status !== 'superseded' && d.status !== 'rejected'
      );
      if (!exists) {
        snapshot.decisions.items.push({
          id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          area: 'discovery',
          statement: candText,
          status: 'candidate',
          origin: 'agent',
          evidenceRefs: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    // 2. Process Assumptions
    for (const asmText of result.assumptions || []) {
      const exists = snapshot.assumptions.items.some(
        (a) => a.statement.trim() === asmText.trim() && a.status === 'active'
      );
      if (!exists) {
        snapshot.assumptions.items.push({
          id: `asm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          statement: asmText,
          reason: 'B2.1 Discovery low-risk reversible assumption',
          status: 'active',
          createdAt: timestamp,
        });
      }
    }
    for (const autoAsm of payload.autoAssumptions || []) {
      const exists = snapshot.assumptions.items.some(
        (a) => a.statement.trim() === autoAsm.statement.trim() && a.status === 'active'
      );
      if (!exists) {
        snapshot.assumptions.items.push(autoAsm);
      }
    }

    // 3. Process Gaps
    const gapsToAdd = payload.prioritizedGaps && payload.prioritizedGaps.length > 0
      ? payload.prioritizedGaps
      : (result.gaps || []).map((gap) => ({
          id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          area: gap.area,
          severity: gap.severity,
          reason: gap.reason,
          impact: gap.impact,
          dependency: gap.dependency,
          shouldAskUser: gap.should_ask_user,
          status: 'open' as const,
        }));

    for (const gap of gapsToAdd) {
      const exists = snapshot.gaps.gaps.some(
        (g) => g.area === gap.area && g.reason === gap.reason && g.status === 'open'
      );
      if (!exists) {
        snapshot.gaps.gaps.push(gap);
      }
    }

    // 4. Process Tensions
    for (const tension of result.tensions || []) {
      const exists = snapshot.gaps.tensions.some(
        (t) => t.description === tension.description && t.status === 'open'
      );
      if (!exists) {
        snapshot.gaps.tensions.push({
          id: `tns-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          description: tension.description,
          reason: tension.reason,
          status: 'open',
        });
      }
    }

    // 5. Process Questions
    if (payload.questions && payload.questions.length > 0) {
      for (const q of payload.questions) {
        const exists = snapshot.questions.items.some(
          (item) => item.question.trim() === q.question.trim() && item.status !== 'dismissed'
        );
        if (!exists) {
          snapshot.questions.items.push(q);
        }
      }
    } else {
      for (const q of result.questions || []) {
        const exists = snapshot.questions.items.some(
          (item) => item.question.trim() === q.question.trim() && item.status !== 'dismissed'
        );
        if (!exists) {
          snapshot.questions.items.push({
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            issueRef: 'gap:general',
            importance: q.importance,
            question: q.question,
            reason: q.reason,
            recommendation: q.recommendation,
            recommendationReason: q.recommendation_reason,
            options: q.options || [],
            allowFreeInput: true,
            status: 'proposed',
            createdAt: timestamp,
          });
        }
      }
    }

    // 6. Check for Conflicts against locked items
    const conflictChecks = this.conflictDetector.detectConflicts(
      lockedDecisions,
      result.candidates || []
    );
    for (const conf of conflictChecks) {
      snapshot.gaps.conflicts.push({
        id: `cnf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        propositionA: conf.propositionA,
        propositionB: conf.propositionB,
        decisionRefs: conf.decisionRefs,
        severity: conf.severity,
        reason: conf.reason,
        status: 'open',
      });
    }

    // Rebuild overview projection
    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      snapshot.decisions,
      snapshot.gaps
    );

    // Update project stage
    snapshot.metadata.stage = 'broad-pass';

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(projectPath, targetRevision, {
      metadata: snapshot.metadata,
      decisions: snapshot.decisions,
      assumptions: snapshot.assumptions,
      gaps: snapshot.gaps,
      risks: snapshot.risks,
      questions: snapshot.questions,
      overview: updatedOverview,
    });

    return this.loadProject(projectPath);
  }

  /**
   * Applies the integrated Phase 2 discovery turn output (Gaps + Questions + Policy suggestions)
   * to Project State in a single atomic two-phase commit.
   */
  async applyIntegratedDiscoveryTurn(
    projectPath: string,
    payload: {
      discoveryResult: DiscoveryResult;
      prioritizedGaps: GapItem[];
      questions: QuestionItem[];
      autoAssumptions: AssumptionItem[];
      newCandidates: DecisionItem[];
      newAssumptions: AssumptionItem[];
      newConflicts: ConflictItem[];
    },
    expectedRevision: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();

    // 1. Merge Candidates
    for (const cand of payload.newCandidates) {
      const exists = snapshot.decisions.items.some(
        (d) => d.statement.trim() === cand.statement.trim() && d.status !== 'superseded' && d.status !== 'rejected'
      );
      if (!exists) {
        snapshot.decisions.items.push(cand);
      }
    }

    // 2. Merge Assumptions (explicit + auto)
    const allAssumptions = [...payload.newAssumptions, ...payload.autoAssumptions];
    for (const asm of allAssumptions) {
      const exists = snapshot.assumptions.items.some(
        (a) => a.statement.trim() === asm.statement.trim() && a.status === 'active'
      );
      if (!exists) {
        snapshot.assumptions.items.push(asm);
      }
    }

    // 3. Update Gaps & Conflicts
    snapshot.gaps.gaps = payload.prioritizedGaps;
    for (const conf of payload.newConflicts) {
      const exists = snapshot.gaps.conflicts.some(
        (c) => c.propositionA === conf.propositionA && c.propositionB === conf.propositionB && c.status === 'open'
      );
      if (!exists) {
        snapshot.gaps.conflicts.push(conf);
      }
    }
    for (const tension of payload.discoveryResult.tensions || []) {
      const exists = snapshot.gaps.tensions.some(
        (t) => t.description === tension.description && t.status === 'open'
      );
      if (!exists) {
        snapshot.gaps.tensions.push({
          id: `tns-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          description: tension.description,
          reason: tension.reason,
          status: 'open',
        });
      }
    }

    // 4. Update Questions: Prepend new budgeted questions (keeping history)
    for (const q of payload.questions) {
      const exists = snapshot.questions.items.some(
        (item) => item.question.trim().toLowerCase() === q.question.trim().toLowerCase() && item.status !== 'dismissed'
      );
      if (!exists) {
        snapshot.questions.items.unshift(q);
      }
    }

    // 5. Update stage & overview
    snapshot.metadata.stage = 'broad-pass';
    snapshot.metadata.updatedAt = timestamp;
    snapshot.decisions.updatedAt = timestamp;
    snapshot.assumptions.updatedAt = timestamp;
    snapshot.gaps.updatedAt = timestamp;
    snapshot.questions.updatedAt = timestamp;

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      snapshot.decisions,
      snapshot.gaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        decisions: snapshot.decisions,
        assumptions: snapshot.assumptions,
        gaps: snapshot.gaps,
        risks: snapshot.risks,
        questions: snapshot.questions,
        overview: updatedOverview,
      },
      expectedRevision
    );

    return this.loadProject(projectPath);
  }

  /**
   * Adds an input material file to the project.
   * Enforces size, extension, batch count, and format-specific extraction contracts.
   */
  async addInput(
    projectPath: string,
    kind: InputMaterialKind,
    filename: string,
    content: string,
    contentEncoding?: 'utf8' | 'base64',
    expectedRevision?: number
  ): Promise<InputRef> {
    const snapshot = await this.loadProject(projectPath);
    if (expectedRevision !== undefined) {
      this.assertRevision(snapshot.metadata, expectedRevision);
    }

    // Validate InputMaterialKind enum
    const validKinds: InputMaterialKind[] = ['text', 'file', 'image'];
    if (!validKinds.includes(kind)) {
      const err: any = new Error(
        `Invalid input material kind "${kind}". Valid kinds: ${validKinds.join(', ')}`
      );
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    const timestamp = new Date().toISOString();
    const inputId = `inp-${Date.now()}`;
    const cleanFilename = this.guard.validateFilename(filename);

    // 1. Validate Extension
    const ext = extname(cleanFilename).toLowerCase();
    const supportedExtensions = ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'];
    if (!supportedExtensions.includes(ext)) {
      const err: any = new Error(
        `Unsupported file extension "${ext}". Supported extensions: ${supportedExtensions.join(', ')}`
      );
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    // 2. Validate Max File Size & Decode
    const maxFileSizeBytes = 20 * 1024 * 1024;
    const isBase64 = contentEncoding === 'base64';
    let fileBuffer: Buffer;
    if (isBase64) {
      const cleanBase64 = content.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
        const err: any = new Error('Invalid Base64 encoding in content payload.');
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      fileBuffer = Buffer.from(content, 'utf8');
    }

    if (fileBuffer.byteLength > maxFileSizeBytes) {
      const err: any = new Error(
        `Decoded file size (${fileBuffer.byteLength} bytes) exceeds maximum allowed limit of 20MB.`
      );
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    // 3. Validate Batch Count (10 items max limit)
    if (snapshot.metadata.inputRefs.length >= 10) {
      const err: any = new Error(
        `Input materials limit reached: maximum of 10 items allowed per project in V1.`
      );
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    const { inputDir, filePath } = this.guard.resolveInputPath(
      resolve(projectPath),
      inputId,
      cleanFilename
    );
    const storageRelPath = `inputs/${inputId}/${cleanFilename}`;

    await this.storage.ensureDir(inputDir);
    await this.storage.writeBuffer(filePath, fileBuffer);

    const isText = ext === '.txt' || ext === '.md';
    const isImage = ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp';
    const isDoc = ext === '.pdf' || ext === '.docx';

    let inputRef: InputRef;

    if (isText) {
      const textContent = isBase64 ? fileBuffer.toString('utf8') : content;
      const excerpt = textContent.slice(0, 4000);
      await this.storage.writeJson(join(inputDir, 'extraction.json'), {
        id: `input:${inputId}`,
        extractedText: excerpt,
        status: 'ready',
        analysisAvailability: 'available',
        updatedAt: timestamp,
      });

      inputRef = {
        id: `input:${inputId}`,
        kind: 'text',
        label: filename,
        storageRef: storageRelPath,
        status: 'ready',
        analysisAvailability: 'available',
        createdAt: timestamp,
        summary: excerpt.slice(0, 80),
      };
    } else if (isImage) {
      await this.storage.writeJson(join(inputDir, 'extraction.json'), {
        id: `input:${inputId}`,
        extractedText: '',
        status: 'ready',
        analysisAvailability: 'unavailable',
        reason: 'Image saved for reference. V1 visual analysis is unavailable.',
        updatedAt: timestamp,
      });

      inputRef = {
        id: `input:${inputId}`,
        kind: 'image',
        label: filename,
        storageRef: storageRelPath,
        status: 'ready',
        analysisAvailability: 'unavailable',
        createdAt: timestamp,
        summary: 'Image material (visual analysis unavailable in V1)',
      };
    } else if (isDoc) {
      const errorMessage =
        'V1 local extractor does not parse binary PDF/DOCX format without external parser.';
      await this.storage.writeJson(join(inputDir, 'extraction.json'), {
        id: `input:${inputId}`,
        extractedText: '',
        status: 'failed',
        analysisAvailability: 'unavailable',
        errorMessage,
        updatedAt: timestamp,
      });

      inputRef = {
        id: `input:${inputId}`,
        kind: 'file',
        label: filename,
        storageRef: storageRelPath,
        status: 'failed',
        analysisAvailability: 'unavailable',
        errorMessage,
        createdAt: timestamp,
        summary: 'Binary document (unextracted in V1)',
      };
    } else {
      inputRef = {
        id: `input:${inputId}`,
        kind,
        label: filename,
        storageRef: storageRelPath,
        status: 'failed',
        analysisAvailability: 'unavailable',
        createdAt: timestamp,
      };
    }

    snapshot.metadata.inputRefs.push(inputRef);
    const targetRevision = snapshot.metadata.stateRevision + 1;

    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
      },
      expectedRevision !== undefined ? expectedRevision : snapshot.metadata.stateRevision
    );

    return inputRef;
  }

  /**
   * Helper to build dynamic Overview projection from decisions.
   */
  private buildOverviewProjection(
    projectId: string,
    decisions: DecisionsState,
    _gaps: GapsState
  ): OverviewState {
    const timestamp = new Date().toISOString();
    const sections: OverviewSection[] = FIXED_SECTIONS.map((sec) => {
      const activeDecisions = decisions.items.filter(
        (d) => (d.area === sec.id || (sec.id === 'project_overview' && d.area === 'general')) &&
          d.status !== 'superseded' &&
          d.status !== 'rejected'
      );

      const itemRefs: TypedRef[] = activeDecisions.map((d) => `decision:${d.id}` as TypedRef);
      const hasLocked = activeDecisions.some((d) => d.status === 'locked');
      const hasConfirmed = activeDecisions.some((d) => d.status === 'confirmed');

      let maturity: OverviewSection['maturity'] = 'unexplored';
      if (hasLocked) maturity = 'locked';
      else if (hasConfirmed) maturity = 'mostly-clear';
      else if (activeDecisions.length > 0) maturity = 'needs-clarification';

      return {
        id: sec.id,
        title: sec.title,
        kind: 'fixed',
        maturity,
        itemRefs,
      };
    });

    return {
      schemaVersion: 1,
      projectId,
      sections,
      updatedAt: timestamp,
    };
  }

  private assertRevision(metadata: ProjectMetadata, expectedRevision: number): void {
    if (metadata.stateRevision !== expectedRevision) {
      const err: any = new Error(
        `State revision conflict: expected ${expectedRevision}, but server current is ${metadata.stateRevision}`
      );
      err.code = ErrorCode.STATE_REVISION_CONFLICT;
      throw err;
    }
  }
}
