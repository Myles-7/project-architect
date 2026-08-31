import { join, resolve, extname } from 'node:path';
import { FileStorage } from '../storage/FileStorage.js';
import { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import { StateCommitManager } from '../commit/StateCommitManager.js';
import { LightweightConflictDetector } from '../conflicts/LightweightConflictDetector.js';
import { ReadinessEvaluator } from '../readiness/ReadinessEvaluator.js';
import { ReadinessGate } from '../readiness/ReadinessGate.js';
import { AreaRegistry } from '../areas/AreaRegistry.js';
import { ProjectStateMigration } from '../migrations/ProjectStateMigration.js';
import { DiscoveryTurnStore } from '../discovery/DiscoveryTurnStore.js';
import {
  parseTypedRef,
  isTypedRef,
  ErrorCode,
  CANONICAL_B3_AREAS,
  type InitialProjectIntent,
  type ProjectAreaId,
  type DiscoveryTurnRecord,
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
  RiskItem,
  QuestionsState,
  QuestionItem,
  QuestionOption,
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

export function inferCandidateArea(statement: string): ProjectAreaId {
  const s = statement.toLowerCase();
  if (/ui|ux|theme|dark mode|layout|page|component|modal|view|style|navigation|color/i.test(s)) {
    return 'ux_ui_direction';
  }
  if (/flow|step|journey|checkout|pipeline|lifecycle|transition/i.test(s)) {
    return 'user_flows';
  }
  if (/user|team|developer|persona|customer|audience|role|engineer|researcher|admin|problem|pain point|bottleneck|challenge/i.test(s)) {
    return 'target_user';
  }
  if (/test|acceptance|benchmark|latency|throughput|dod|criterion|milestone|delivery/i.test(s)) {
    return 'delivery_plan';
  }
  if (/database|postgres|mysql|sqlite|redis|mongodb|docker|fastapi|backend|api|cloud|aws|server|protocol|runtime|python|rust|golang|node|electron|tauri|privacy|trust|security/i.test(s)) {
    return 'technical_boundary';
  }
  return 'mvp_scope';
}

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
    idea?: string;
    initialIntent?: InitialProjectIntent;
    projectId?: string;
    projectTags?: string[];
    projectPath?: string;
  }): Promise<{ projectPath: string; snapshot: ProjectSnapshot }> {
    const hasIdea = Boolean(options.idea && options.idea.trim());
    const hasIntent = Boolean(
      options.initialIntent &&
      options.initialIntent.targetUser?.trim() &&
      options.initialIntent.coreProblem?.trim() &&
      options.initialIntent.desiredOutcome?.trim()
    );

    if (!hasIdea && !hasIntent) {
      throw new Error('Either idea or initialIntent (targetUser, coreProblem, desiredOutcome) must be provided.');
    }

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

    let initialIdeaContent: string;
    if (options.initialIntent) {
      const intent = options.initialIntent;
      initialIdeaContent = [
        `【核心愿景与期望成果】\n${intent.desiredOutcome.trim()}`,
        `【目标用户群体】\n${intent.targetUser.trim()}`,
        `【解决的核心问题与痛点】\n${intent.coreProblem.trim()}`,
        intent.constraints?.trim() ? `【关键约束与技术底线】\n${intent.constraints.trim()}` : '',
      ].filter(Boolean).join('\n\n');
    } else {
      initialIdeaContent = options.idea!.trim();
    }

    await this.storage.writeText(join(initialInputAbsDir, 'source.txt'), initialIdeaContent);
    await this.storage.writeJson(join(initialInputAbsDir, 'extraction.json'), {
      id: `input:${initialInputId}`,
      extractedText: initialIdeaContent,
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
      summary: initialIdeaContent.slice(0, 80),
    };

    // 2. Initial Metadata
    const metadata: ProjectMetadata = {
      schemaVersion: 1,
      projectId,
      name: options.name,
      tagline: (options.initialIntent?.desiredOutcome || options.idea || options.name).slice(0, 100),
      stage: 'created',
      stateRevision: 1,
      projectTags: options.projectTags || ['Local-First'],
      inputRefs: [inputRef],
      updatedAt: timestamp,
      createdAt: timestamp,
    };

    // 3. Initial Decisions (Atomic multi-area creation)
    const initialDecisions: DecisionItem[] = [];

    if (options.initialIntent) {
      const intent = options.initialIntent;
      // 3.1 desiredOutcome -> project_overview
      initialDecisions.push({
        id: 'dec-01',
        area: 'project_overview',
        statement: intent.desiredOutcome.trim(),
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [`input:${initialInputId}`],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 3.2 targetUser -> target_user
      initialDecisions.push({
        id: 'dec-02',
        area: 'target_user',
        statement: intent.targetUser.trim(),
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [`input:${initialInputId}`],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 3.3 coreProblem -> target_user
      initialDecisions.push({
        id: 'dec-03',
        area: 'target_user',
        statement: intent.coreProblem.trim(),
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [`input:${initialInputId}`],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 3.4 constraints -> technical_boundary
      if (intent.constraints && intent.constraints.trim()) {
        initialDecisions.push({
          id: 'dec-04',
          area: 'technical_boundary',
          statement: intent.constraints.trim(),
          status: 'confirmed',
          origin: 'user',
          evidenceRefs: [`input:${initialInputId}`],
          confirmedBy: 'user',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    } else {
      initialDecisions.push({
        id: 'dec-01',
        area: 'project_overview',
        statement: options.idea!.trim(),
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [`input:${initialInputId}`],
        confirmedBy: 'user',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const decisions: DecisionsState = {
      schemaVersion: 1,
      projectId,
      items: initialDecisions,
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
    const initialGaps: GapItem[] = options.initialIntent
      ? [
          {
            id: 'gap-01',
            area: 'mvp_scope',
            decisionKey: 'mvp_scope:core_boundary',
            dependsOn: [],
            severity: 'high',
            reason: '已明确目标用户与核心痛点，首发版本 MVP 的功能边界尚待划定。',
            impact: '影响核心流程设计与交付范围。',
            shouldAskUser: true,
            status: 'open',
          },
        ]
      : [
          {
            id: 'gap-01',
            area: 'target_user',
            decisionKey: 'target_user:primary_audience',
            dependsOn: [],
            severity: 'high',
            reason: '项目初始创建，核心目标用户细分画像尚待明确。',
            impact: '影响后续 MVP 核心功能优先级。',
            shouldAskUser: true,
            status: 'open',
          },
        ];

    const gaps: GapsState = {
      schemaVersion: 2,
      projectId,
      gaps: initialGaps,
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
      schemaVersion: 2,
      projectId,
      items: [],
      updatedAt: timestamp,
    };

    // 8. Initial Overview Projection (from AreaRegistry)
    const overviewSections: OverviewSection[] = AreaRegistry.getOverviewDefinitions().map((def) => {
      const matchingDecisions = initialDecisions.filter(
        (d) => AreaRegistry.normalize(d.area) === def.id
      );
      const hasLocked = matchingDecisions.some((d) => d.status === 'locked');
      const hasConfirmed = matchingDecisions.some((d) => d.status === 'confirmed');

      let maturity: OverviewSection['maturity'] = 'unexplored';
      if (hasLocked) maturity = 'locked';
      else if (hasConfirmed) maturity = 'mostly-clear';
      else if (matchingDecisions.length > 0) maturity = 'needs-clarification';

      return {
        id: def.id,
        title: def.title,
        kind: 'fixed',
        maturity,
        itemRefs: matchingDecisions.map((d) => `decision:${d.id}` as TypedRef),
      };
    });

    const overview: OverviewState = {
      schemaVersion: 1,
      projectId,
      sections: overviewSections,
      updatedAt: timestamp,
    };

    // 9. Initial Readiness
    const readinessIssues = options.initialIntent
      ? ['MVP 功能边界尚未收敛。']
      : ['目标用户与 MVP 范围尚未收敛。'];

    const readiness: ReadinessState = {
      schemaVersion: 1,
      projectId,
      current: {
        id: `rdn-${Date.now()}`,
        status: 'not-ready',
        reviewedAt: timestamp,
        basisRevision: 1,
        requiredAreas: [...CANONICAL_B3_AREAS],
        warnings: ['项目刚创建，尚在初始发散阶段。'],
        issues: readinessIssues,
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

    const documentGuard = new WorkspaceGuard(projectPath);
    const publicFiles = [
      ...(renderedFiles || []).map((doc) => ({
        path: documentGuard.assertContained(projectPath, join(projectPath, doc.path), 'Compiled document path'),
        content: doc.content,
      })),
      { path: join(projectPath, 'documents.json'), content: `${JSON.stringify(documentsState, null, 2)}\n` },
      { path: join(projectPath, 'documents', 'manifest.json'), content: `${JSON.stringify(documentsState, null, 2)}\n` },
    ];
    const backups = await Promise.all(publicFiles.map(async (file) => ({
      path: file.path,
      existed: await this.storage.exists(file.path),
      content: await this.storage.exists(file.path) ? await this.storage.readText(file.path) : undefined,
    })));

    const timestamp = new Date().toISOString();
    snapshot.metadata.stage = 'documents-generated';
    snapshot.metadata.updatedAt = timestamp;

    const targetRevision = snapshot.metadata.stateRevision + 1;
    try {
      for (const file of publicFiles) await this.storage.writeText(file.path, file.content);
      await this.commitManager.commit(
        projectPath,
        targetRevision,
        {
          metadata: snapshot.metadata,
          documents: documentsState,
        },
        expectedRevision
      );
    } catch (error) {
      for (const backup of backups) {
        if (backup.existed) await this.storage.writeText(backup.path, backup.content || '');
        else await this.storage.remove(backup.path);
      }
      throw error;
    }

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
    // B3 additive migration: normalize legacy records in memory. The next
    // ordinary state commit persists schemaVersion 2 without a separate rewrite.
    gaps.schemaVersion = 2;
    for (const gap of gaps.gaps) {
      gap.decisionKey ??= this.normalizeDecisionKey(`${gap.area}:${gap.id}`);
      const legacyDependency = gap.dependency && gap.dependency.toLowerCase() !== 'none'
        ? [gap.dependency]
        : [];
      gap.dependsOn ??= legacyDependency.map((value) => this.normalizeDecisionKey(value));
    }
    questions.schemaVersion = 2;
    for (const question of questions.items) {
      const linkedGapId = question.issueRef.startsWith('gap:') ? question.issueRef.slice(4) : undefined;
      const linkedGap = linkedGapId ? gaps.gaps.find((gap) => gap.id === linkedGapId) : undefined;
      question.decisionKey ??= linkedGap?.decisionKey || this.normalizeDecisionKey(`legacy:${question.id}`);
      question.dependsOn ??= linkedGap?.dependsOn || [];
      question.batchId ??= 'legacy';
      question.batchStage ??= 'legacy';
      question.basisRevision ??= metadata.stateRevision;
    }
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

    const snapshot: ProjectSnapshot = {
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

    ProjectStateMigration.migrateInMemory(snapshot);
    return snapshot;
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
      if (targetDecision.status === 'confirmed' || targetDecision.status === 'locked') {
        // Idempotent: already confirmed or locked
        return snapshot;
      }
      if (targetDecision.status === 'rejected' || targetDecision.status === 'superseded') {
        const err: any = new Error(`Cannot confirm decision "${targetRef}" in "${targetDecision.status}" state.`);
        err.code = ErrorCode.DECISION_STATE_INVALID;
        throw err;
      }
      targetDecision.status = 'confirmed';
      targetDecision.confirmedBy = 'user';
      targetDecision.origin = 'user';
      targetDecision.area = AreaRegistry.normalize(targetDecision.area);
      targetDecision.updatedAt = timestamp;
      if (targetDecision.evidenceRefs) {
        for (const ref of targetDecision.evidenceRefs) {
          const p = parseTypedRef(ref);
          if (p.kind === 'gap') resolvedGapIds.add(p.id);
        }
      }
    } else if (targetAssumption) {
      if (
        targetAssumption.status === 'resolved' ||
        targetAssumption.status === 'converted' ||
        targetAssumption.status === 'replaced' ||
        targetAssumption.status === 'removed'
      ) {
        const err: any = new Error(`Cannot convert assumption "${targetRef}" in "${targetAssumption.status}" state.`);
        err.code = ErrorCode.DECISION_STATE_INVALID;
        throw err;
      }

      targetAssumption.status = 'resolved';
      targetAssumption.resolvedAt = timestamp;

      const decId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const decRef: DecisionRef = `decision:${decId}`;
      targetAssumption.resolvedDecisionRef = decRef;
      targetAssumption.linkedDecisionRefs = [...(targetAssumption.linkedDecisionRefs || []), decRef];

      const area = targetAssumption.area ? AreaRegistry.normalize(targetAssumption.area) : 'technical_boundary';

      const newConfirmedDecision: DecisionItem = {
        id: decId,
        area,
        statement: targetAssumption.statement,
        status: 'confirmed',
        origin: 'user',
        evidenceRefs: [targetRef],
        confirmedBy: 'user',
        decisionKey: targetAssumption.decisionKey,
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

    const currentRevision = snapshot.metadata.stateRevision;
    const lastReadiness = snapshot.readiness?.current;
    const isSameRevision = Boolean(lastReadiness && lastReadiness.basisRevision === currentRevision);
    const userDisposition = isSameRevision && lastReadiness ? lastReadiness.userDisposition : 'pending';

    const satisfiedCount = CANONICAL_B3_AREAS.filter((area) =>
      snapshot.decisions.items.some(
        (d) => (d.area === area || d.id === area) && (d.status === 'confirmed' || d.status === 'locked')
      )
    ).length;

    const targetRevision = snapshot.metadata.stateRevision + 1;

    const readinessSnapshot: ReadinessSnapshot = {
      id: `rdn-${Date.now()}`,
      status: evalResult.ready
        ? evalResult.warnings.length > 0
          ? 'ready-with-warnings'
          : 'ready'
        : 'not-ready',
      reviewedAt: timestamp,
      basisRevision: currentRevision,
      requiredAreas: [...CANONICAL_B3_AREAS],
      warnings: evalResult.warnings,
      issues: evalResult.blockingIssues,
      assumptionRefs: snapshot.assumptions.items.map((a) => `assumption:${a.id}` as AssumptionRef),
      knownIssueAcknowledgements: isSameRevision
        ? snapshot.readiness?.current?.knownIssueAcknowledgements || []
        : [],
      criticalConflictAcknowledgements: isSameRevision
        ? snapshot.readiness?.current?.criticalConflictAcknowledgements || []
        : [],
      userDisposition,
      coverage: {
        total: CANONICAL_B3_AREAS.length,
        satisfied: satisfiedCount,
        ratio: satisfiedCount / CANONICAL_B3_AREAS.length,
      },
      credibilityScore: evalResult.score,
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
      basisRevision: snapshot.metadata.stateRevision,
      requiredAreas: [...CANONICAL_B3_AREAS],
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

    const targetRevision = snapshot.metadata.stateRevision + 1;

    const updatedSnapshot: ReadinessSnapshot = {
      ...currentReadiness,
      basisRevision: snapshot.metadata.stateRevision,
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
   * Directly records an active assumption into project state.
   */
  async addAssumption(
    projectPath: string,
    statement: string,
    expectedRevision: number,
    reason?: string
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();
    const asmId = `asm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAssumption: AssumptionItem = {
      id: asmId,
      statement: statement.trim(),
      reason: reason || 'Explicit assumption',
      status: 'active',
      createdAt: timestamp,
    };

    const updatedAssumptions: AssumptionsState = {
      ...snapshot.assumptions,
      items: [...snapshot.assumptions.items, newAssumption],
      updatedAt: timestamp,
    };

    snapshot.metadata.updatedAt = timestamp;
    const targetRevision = snapshot.metadata.stateRevision + 1;

    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        assumptions: updatedAssumptions,
      },
      expectedRevision
    );

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
   * Records an unconfirmed answer to a question as an active Assumption instead of a Confirmed Decision.
   * Enforces the rule: AI recommendations / uncertain inputs can safely degrade to assumptions.
   */
  async answerQuestionAsAssumption(
    projectPath: string,
    questionRef: QuestionRef,
    assumptionStatement: string,
    expectedRevision: number,
    rationale?: string
  ): Promise<{ assumptionRef: TypedRef; snapshot: ProjectSnapshot }> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);
    if (!assumptionStatement.trim()) {
      throw new Error('An assumption statement is required.');
    }

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
    question.answer = `[Assumption] ${assumptionStatement.trim()}`;
    question.answeredAt = timestamp;

    const asmId = `asm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const asmRef = `assumption:${asmId}` as TypedRef;
    snapshot.assumptions.items.push({
      id: asmId,
      area: question.area,
      decisionKey: question.decisionKey,
      statement: assumptionStatement.trim(),
      reason: rationale || question.recommendationReason || question.question,
      status: 'active',
      createdAt: timestamp,
    });

    snapshot.questions.updatedAt = timestamp;
    snapshot.assumptions.updatedAt = timestamp;
    snapshot.metadata.updatedAt = timestamp;

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
        questions: snapshot.questions,
        assumptions: snapshot.assumptions,
      },
      expectedRevision
    );

    const updatedSnapshot = await this.loadProject(projectPath);
    return {
      assumptionRef: asmRef,
      snapshot: updatedSnapshot,
    };
  }

  /** Dismisses unanswered advisory questions without creating decisions or traces. */
  async dismissQuestions(
    projectPath: string,
    questionRefs: QuestionRef[],
    expectedRevision: number,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);
    if (questionRefs.length === 0) throw new Error('At least one question reference is required.');

    const ids = new Set(questionRefs.map((ref) => {
      const cleanRef = String(ref).startsWith('question:') ? ref : (`question:${ref}` as QuestionRef);
      const parsed = parseTypedRef(cleanRef);
      if (parsed.kind !== 'question') throw new Error(`Expected a question reference, received "${ref}".`);
      return parsed.id;
    }));
    const matched = snapshot.questions.items.filter((question) => ids.has(question.id));
    if (matched.length !== ids.size) throw new Error('One or more questions were not found.');
    for (const question of matched) {
      if (question.status !== 'proposed' && question.status !== 'shown') {
        throw new Error(`Question "question:${question.id}" cannot be dismissed from status "${question.status}".`);
      }
      question.status = 'dismissed';
    }

    const timestamp = new Date().toISOString();
    snapshot.questions.schemaVersion = 2;
    snapshot.questions.updatedAt = timestamp;
    snapshot.metadata.updatedAt = timestamp;
    await this.commitManager.commit(
      projectPath,
      snapshot.metadata.stateRevision + 1,
      { metadata: snapshot.metadata, questions: snapshot.questions },
      expectedRevision,
    );
    return this.loadProject(projectPath);
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
            area: AreaRegistry.normalize(sectionId),
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
          area: AreaRegistry.normalize(sectionId),
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
   * Applies the structured result of a B3 discovery-turn to Project State.
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
      turnId?: string;
    } = {}
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const timestamp = new Date().toISOString();
    const lockedDecisions = snapshot.decisions.items.filter((d) => d.status === 'locked');
    const lockedStatements = new Set(
      lockedDecisions.map((d) => d.statement.trim().toLowerCase())
    );

    // 1. Process Candidates
    if (payload.newCandidates && payload.newCandidates.length > 0) {
      for (const candItem of payload.newCandidates) {
        const stmt = candItem.statement.trim();
        if (lockedStatements.has(stmt.toLowerCase())) continue;
        const exists = snapshot.decisions.items.some(
          (d) => d.statement.trim().toLowerCase() === stmt.toLowerCase() && d.status !== 'superseded' && d.status !== 'rejected'
        );
        if (!exists) {
          const rawArea = candItem.area && candItem.area !== 'discovery' ? candItem.area : inferCandidateArea(candItem.statement);
          const area = AreaRegistry.normalize(rawArea);
          snapshot.decisions.items.push({
            id: candItem.id || `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            area,
            statement: candItem.statement,
            status: 'candidate',
            origin: 'agent',
            evidenceRefs: candItem.evidenceRefs || [],
            decisionKey: candItem.decisionKey,
            rationale: candItem.rationale,
            affectedAreas: candItem.affectedAreas,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      }
    } else {
      for (const rawCand of result.candidates || []) {
        const isObj = typeof rawCand === 'object' && rawCand !== null;
        const stmt = (isObj ? (rawCand as any).statement : String(rawCand)).trim();
        if (!stmt) continue;
        if (lockedStatements.has(stmt.toLowerCase())) continue;

        const exists = snapshot.decisions.items.some(
          (d) => d.statement.trim().toLowerCase() === stmt.toLowerCase() && d.status !== 'superseded' && d.status !== 'rejected'
        );
        if (!exists) {
          const declaredArea = isObj ? (rawCand as any).area : undefined;
          const rawArea = declaredArea && declaredArea !== 'discovery' ? declaredArea : inferCandidateArea(stmt);
          const area = AreaRegistry.normalize(rawArea);
          snapshot.decisions.items.push({
            id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            area,
            statement: stmt,
            status: 'candidate',
            origin: 'agent',
            evidenceRefs: [],
            decisionKey: isObj ? (rawCand as any).decision_key : undefined,
            rationale: isObj ? (rawCand as any).rationale : undefined,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      }
    }

    // 2. Process Assumptions
    for (const rawAsm of result.assumptions || []) {
      const isObj = typeof rawAsm === 'object' && rawAsm !== null;
      const stmt = (isObj ? (rawAsm as any).statement : String(rawAsm)).trim();
      if (!stmt) continue;
      if (lockedStatements.has(stmt.toLowerCase())) continue;

      const exists = snapshot.assumptions.items.some(
        (a) => a.statement.trim().toLowerCase() === stmt.toLowerCase() && a.status === 'active'
      );
      if (!exists) {
        const declaredArea = isObj ? (rawAsm as any).area : undefined;
        const area = declaredArea ? AreaRegistry.normalize(declaredArea) : 'technical_boundary';
        snapshot.assumptions.items.push({
          id: `asm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          area,
          decisionKey: isObj ? (rawAsm as any).decision_key : undefined,
          statement: stmt,
          reason: isObj ? (rawAsm as any).reason : 'B3 Discovery low-risk reversible assumption',
          status: 'active',
          createdAt: timestamp,
        });
      }
    }
    for (const autoAsm of payload.autoAssumptions || []) {
      const exists = snapshot.assumptions.items.some(
        (a) => a.statement.trim().toLowerCase() === autoAsm.statement.trim().toLowerCase() && a.status === 'active'
      );
      if (!exists) {
        snapshot.assumptions.items.push(autoAsm);
      }
    }

    // 2.5 Process Risks (Task 2.5)
    snapshot.risks ??= { schemaVersion: 1, projectId: snapshot.metadata.projectId, items: [], updatedAt: timestamp };
    for (const rawRisk of result.risks || []) {
      const isObj = typeof rawRisk === 'object' && rawRisk !== null;
      const stmt = (isObj ? (rawRisk as any).statement : String(rawRisk)).trim();
      if (!stmt) continue;

      const riskKey = isObj ? (rawRisk as any).risk_key : undefined;
      const declaredArea = isObj ? (rawRisk as any).area : undefined;
      const area = declaredArea ? AreaRegistry.normalize(declaredArea) : 'technical_boundary';
      const severity = isObj ? (rawRisk as any).severity : 'medium';
      const impact = isObj ? (rawRisk as any).impact : '';

      const existingIndex = riskKey
        ? snapshot.risks.items.findIndex((r) => r.riskKey === riskKey)
        : snapshot.risks.items.findIndex((r) => r.statement === stmt || r.description === stmt);

      if (existingIndex !== -1) {
        const existing = snapshot.risks.items[existingIndex]!;
        snapshot.risks.items[existingIndex] = {
          ...existing,
          id: existing.id,
          statement: stmt,
          description: stmt,
          area,
          severity,
          impact,
          turnId: payload.turnId || existing.turnId,
          updatedAt: timestamp,
        };
      } else {
        snapshot.risks.items.push({
          id: `rsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          riskKey,
          area,
          statement: stmt,
          description: stmt,
          severity,
          impact,
          status: 'identified',
          turnId: payload.turnId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    // 3. Process Gaps
    const gapsToAdd = payload.prioritizedGaps && payload.prioritizedGaps.length > 0
      ? payload.prioritizedGaps
      : (result.gaps || []).map((gap) => ({
          id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          area: gap.area,
          decisionKey: this.normalizeDecisionKey(gap.decision_key || `${gap.area}:${gap.reason}`),
          dependsOn: (gap.depends_on || []).map((value) => this.normalizeDecisionKey(value)),
          severity: gap.severity,
          reason: gap.reason,
          impact: gap.impact,
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
          const mappedOptions: QuestionOption[] = (q.options || []).map((o, idx) => ({
            key: o.key || `opt_${idx + 1}`,
            label: o.label,
            impact: o.impact,
            tradeoffs: o.tradeoffs,
            reversibility: o.reversibility || 'moderate',
          }));
          snapshot.questions.items.push({
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            issueRef: 'gap:general',
            area: (q as any).area,
            decisionKey: this.normalizeDecisionKey(
              (q as any).decisionKey || q.decision_key || `legacy:${q.question}`
            ),
            dependsOn: ((q as any).dependsOn || q.depends_on || []).map((value: string) =>
              this.normalizeDecisionKey(value)
            ),
            importance: q.importance,
            question: q.question,
            reason: q.reason,
            recommendation: q.recommendation,
            recommendationReason: q.recommendation_reason,
            recommendedOptionKey: q.recommended_option_key || mappedOptions[0]?.key,
            options: mappedOptions,
            allowFreeInput: true,
            status: 'proposed',
            createdAt: timestamp,
          });
        }
      }
    }

    // 6. Check for Conflicts against locked items
    const candidateStatements = (result.candidates || []).map((cand) =>
      typeof cand === 'object' && cand !== null ? cand.statement : String(cand)
    );
    const conflictChecks = this.conflictDetector.detectConflicts(
      lockedDecisions,
      candidateStatements
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
      newRisks: RiskItem[];
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

    // 3. Merge provider risks as active suggestions without overwriting user state.
    for (const risk of payload.newRisks) {
      const riskStatement = (risk.statement || risk.description).trim();
      const exists = snapshot.risks.items.some((item) =>
        (risk.riskKey && item.riskKey === risk.riskKey)
        || ((item.statement || item.description).trim() === riskStatement)
      );
      if (!exists) snapshot.risks.items.push(risk);
    }

    // 4. Update Gaps & Conflicts
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

    // 5. Update Questions: supersede older active wording for the same B3 decision key.
    const acceptedQuestions: QuestionItem[] = [];
    for (const q of payload.questions) {
      const identicalActiveQuestion = snapshot.questions.items.find(
        (item) => item.decisionKey === q.decisionKey
          && item.question.trim().toLowerCase() === q.question.trim().toLowerCase()
          && (item.status === 'proposed' || item.status === 'shown')
      );
      if (identicalActiveQuestion) continue;

      for (const old of snapshot.questions.items) {
        if (
          old.decisionKey === q.decisionKey
          && (old.status === 'proposed' || old.status === 'shown')
          && old.id !== q.id
        ) {
          old.status = 'superseded';
        }
      }
      acceptedQuestions.push(q);
    }
    snapshot.questions.items = [...acceptedQuestions, ...snapshot.questions.items];

    // 6. Update stage & overview
    snapshot.metadata.stage = 'broad-pass';
    snapshot.metadata.updatedAt = timestamp;
    snapshot.decisions.updatedAt = timestamp;
    snapshot.assumptions.updatedAt = timestamp;
    snapshot.gaps.updatedAt = timestamp;
    snapshot.risks.updatedAt = timestamp;
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
    const sections: OverviewSection[] = AreaRegistry.getOverviewDefinitions().map((sec) => {
      const activeDecisions = decisions.items.filter(
        (d) => AreaRegistry.normalize(d.area) === sec.id &&
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

  /**
   * Atomically renames a project in its metadata.
   */
  async renameProject(
    projectPath: string,
    newName: string,
    expectedRevision?: number
  ): Promise<ProjectSnapshot> {
    const cleanName = newName.trim();
    if (!cleanName) {
      const err: any = new Error('Project name cannot be empty');
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }
    const snapshot = await this.loadProject(projectPath);
    if (expectedRevision !== undefined) {
      this.assertRevision(snapshot.metadata, expectedRevision);
    }
    snapshot.metadata.name = cleanName;
    snapshot.metadata.updatedAt = new Date().toISOString();
    const targetRevision = snapshot.metadata.stateRevision + 1;

    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
      },
      expectedRevision !== undefined ? expectedRevision : snapshot.metadata.stateRevision
    );

    return snapshot;
  }

  /**
   * Toggles an input material's exclusion status.
   * If excluded, the material will NOT be bundled into AI agent's context profile.
   */
  async toggleInputExclusion(
    projectPath: string,
    rawInputId: string,
    exclude?: boolean,
    expectedRevision?: number
  ): Promise<InputRef> {
    const snapshot = await this.loadProject(projectPath);
    if (expectedRevision !== undefined) {
      this.assertRevision(snapshot.metadata, expectedRevision);
    }
    const cleanId = rawInputId.startsWith('input:') ? rawInputId : `input:${rawInputId}`;
    const targetInput = snapshot.metadata.inputRefs.find((r) => r.id === cleanId);
    if (!targetInput) {
      const err: any = new Error(`Input material "${cleanId}" not found in project metadata.`);
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    const shouldExclude = exclude !== undefined ? exclude : targetInput.status !== 'excluded';
    const newStatus = shouldExclude ? 'excluded' : 'ready';
    targetInput.status = newStatus;
    targetInput.analysisAvailability = shouldExclude ? 'unavailable' : 'available';
    snapshot.metadata.updatedAt = new Date().toISOString();
    const targetRevision = snapshot.metadata.stateRevision + 1;

    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
      },
      expectedRevision !== undefined ? expectedRevision : snapshot.metadata.stateRevision
    );

    return targetInput;
  }

  /**
   * Records user free text as an input material and creates an initial DiscoveryTurnRecord with status 'recorded'
   * in runtime/discovery-turns.json atomically before any AI job is scheduled.
   */
  async recordDiscoveryInput(
    projectPath: string,
    text: string,
    expectedRevision: number
  ): Promise<{ inputRef: string; turnId: string; snapshot: ProjectSnapshot }> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const cleanText = text ? text.trim() : '';
    if (!cleanText) {
      throw new Error('Discovery input text cannot be empty.');
    }
    const maxChars = 50000;
    if (cleanText.length > maxChars) {
      const err: any = new Error(`Discovery input exceeds maximum allowed size of ${maxChars} characters.`);
      err.code = ErrorCode.INPUT_TOO_LARGE;
      throw err;
    }

    const timestamp = new Date().toISOString();
    const inputId = `inp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inputRefStr = `input:${inputId}`;
    const filename = `user-input-${Date.now()}.txt`;

    const { inputDir, filePath } = this.guard.resolveInputPath(
      resolve(projectPath),
      inputId,
      filename
    );
    const storageRelPath = `inputs/${inputId}/${filename}`;

    await this.storage.ensureDir(inputDir);
    await this.storage.writeText(filePath, cleanText);
    await this.storage.writeJson(join(inputDir, 'extraction.json'), {
      id: inputRefStr,
      extractedText: cleanText,
      status: 'ready',
      analysisAvailability: 'available',
      updatedAt: timestamp,
    });

    const inputRef: InputRef = {
      id: inputRefStr as any,
      kind: 'text',
      label: filename,
      storageRef: storageRelPath,
      status: 'ready',
      analysisAvailability: 'available',
      createdAt: timestamp,
      summary: cleanText.slice(0, 100),
    };

    snapshot.metadata.inputRefs.push(inputRef);
    const targetRevision = snapshot.metadata.stateRevision + 1;
    snapshot.metadata.stateRevision = targetRevision;
    snapshot.metadata.updatedAt = timestamp;

    await this.commitManager.commit(
      projectPath,
      targetRevision,
      {
        metadata: snapshot.metadata,
      },
      expectedRevision
    );

    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const turnStore = new DiscoveryTurnStore(this.storage);
    const turnRecord: DiscoveryTurnRecord = {
      id: turnId,
      projectId: snapshot.metadata.projectId,
      inputRef: inputRefStr,
      sourceRevision: targetRevision,
      status: 'recorded',
      createdAt: timestamp,
      acceptedRefs: [],
      discardedCounts: {},
    };
    await turnStore.appendTurn(projectPath, turnRecord);

    const reloadedSnapshot = await this.loadProject(projectPath);
    return {
      inputRef: inputRefStr,
      turnId,
      snapshot: reloadedSnapshot,
    };
  }

  /**
   * Retrieves discovery turn records from runtime/discovery-turns.json.
   */
  async getDiscoveryTurns(projectPath: string): Promise<DiscoveryTurnRecord[]> {
    const turnStore = new DiscoveryTurnStore(this.storage);
    return turnStore.loadTurns(projectPath);
  }

  /**
   * Retrieves the latest discovery turn record.
   */
  async getLatestDiscoveryTurn(projectPath: string): Promise<DiscoveryTurnRecord | null> {
    const turnStore = new DiscoveryTurnStore(this.storage);
    return turnStore.getLatestTurn(projectPath);
  }

  /**
   * Reads raw content or extracted text of an input material.
   */
  async readInputContent(projectPath: string, inputIdOrRef: string): Promise<string> {
    const id = inputIdOrRef.startsWith('input:') ? inputIdOrRef.slice(6) : inputIdOrRef;
    const inputDir = join(projectPath, 'inputs', id);
    const extractionPath = join(inputDir, 'extraction.json');
    if (await this.storage.exists(extractionPath)) {
      const ext = await this.storage.readJson<{ extractedText?: string }>(extractionPath);
      if (ext.extractedText) return ext.extractedText;
    }
    const files = await this.storage.listFiles(inputDir);
    const sourceFile = files.find((f) => f !== 'extraction.json');
    if (sourceFile) {
      return await this.storage.readText(join(inputDir, sourceFile));
    }
    return '';
  }

  private normalizeDecisionKey(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9_:-]+/g, '_');
  }
}
