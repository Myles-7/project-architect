import { join, resolve, extname } from 'node:path';
import { FileStorage } from '../storage/FileStorage.js';
import { WorkspaceGuard } from '../storage/WorkspaceGuard.js';
import { StateCommitManager } from '../commit/StateCommitManager.js';
import { LightweightConflictDetector } from '../conflicts/LightweightConflictDetector.js';
import { AreaRegistry } from '../areas/AreaRegistry.js';
import { ProjectStateMigration } from '../migrations/ProjectStateMigration.js';
import { DiscoveryTurnStore } from '../discovery/DiscoveryTurnStore.js';
import { QuestionEngine } from '../questions/QuestionEngine.js';
import { QuestionBatchPolicy } from '../questions/QuestionBatchPolicy.js';
import { PresetRegistry } from '../presets/index.js';
import { emptyPlanningState, classifyInput, effectiveDecisionHash } from '../planning/PlanningState.js';
import { randomUUID, createHash } from 'node:crypto';
import {
  parseTypedRef,
  isTypedRef,
  ErrorCode,
  CANONICAL_B3_AREAS,
  type InitialProjectIntent,
  type ProjectAreaId,
  type DiscoveryTurnRecord,
  type QuestionOption,
  type QuestionImportance,
  type BrownfieldCandidateDecision,
} from '@project-architect/contracts';
import type {
  ProjectMetadata,
  ProjectStage,
  ProjectSnapshot,
  DecisionsState,
  DecisionItem,
  AssumptionsState,
  AssumptionItem,
  GapsState,
  GapItem,
  ConflictItem,
  RisksState,
  RiskItem,
  QuestionsState,
  QuestionItem,
  OverviewState,
  OverviewSection,
  ReadinessState,
  UserDisposition,
  DocumentsState,
  DiscoveryResult,
  TypedRef,
  DecisionRef,
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
  private questionEngine: QuestionEngine;
  private batchPolicy: QuestionBatchPolicy;

  constructor(
    storage: FileStorage = new FileStorage(),
    guard?: WorkspaceGuard
  ) {
    this.storage = storage;
    this.guard = guard || new WorkspaceGuard();
    this.commitManager = new StateCommitManager(storage);
    this.conflictDetector = new LightweightConflictDetector();
    this.questionEngine = new QuestionEngine();
    this.batchPolicy = new QuestionBatchPolicy();
  }

  /**
   * Initializes a brand-new project with all mandatory directories and valid JSON state files.
   */
  async createProject(options: {
    name: string;
    idea?: string;
    materialOnly?: boolean;
    initialIntent?: InitialProjectIntent;
    presetId?: string;
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

    if (!hasIdea && !hasIntent && !options.materialOnly) {
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
        `【核心愿景与期望成果】\n${intent.desiredOutcome}`,
        `【目标用户群体】\n${intent.targetUser}`,
        `【解决的核心问题与痛点】\n${intent.coreProblem}`,
        intent.constraints?.trim() ? `【关键约束与技术底线】\n${intent.constraints}` : '',
      ].filter(Boolean).join('\n\n');
    } else {
      initialIdeaContent = options.idea??'';
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
      contentHash:createHash('sha256').update(initialIdeaContent).digest('hex'),
    };

    // 2. Initial Metadata
    const preset = options.presetId ? PresetRegistry.getById(options.presetId) : undefined;
    const effectiveTags = options.projectTags
      ? [...options.projectTags]
      : (preset?.tags ? [...preset.tags] : ['Local-First']);

    const metadata: ProjectMetadata = {
      schemaVersion: 1,
      projectId,
      name: options.name,
      tagline: (options.initialIntent?.desiredOutcome || options.idea || options.name).slice(0, 100),
      stage: 'created',
      stateRevision: 1,
      projectTags: effectiveTags,
      inputRefs: initialIdeaContent.trim()?[inputRef]:[],
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
    } else if(options.idea?.trim()) {
      initialDecisions.push({
        id: 'dec-01',
        area: 'project_overview',
        statement: options.idea!.trim(),
        status: 'candidate',
        origin: 'user',
        evidenceRefs: [`input:${initialInputId}`],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    if (preset) {
      const presetDecisions = PresetRegistry.instantiateDecisions(preset, timestamp);
      for (const pd of presetDecisions) {
        if (!initialDecisions.some((d) => d.id === pd.id)) {
          initialDecisions.push(pd);
        }
      }
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
    const planning = emptyPlanningState();
    planning.blueprint.decisionBasisHash=effectiveDecisionHash({decisions});
    if(initialIdeaContent.trim())planning.inputs.push({id:initialInputId,raw:options.idea??initialIdeaContent,kind:classifyInput(options.idea??initialIdeaContent),createdAt:timestamp});
    const {blueprint,changeSets,...planningLedger}=planning;
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
      planning:planningLedger,blueprint,changesets:changeSets,
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
      planning,
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
    expectedRevision: number,
    options?: { isDraft?: boolean }
  ): Promise<ProjectSnapshot> {
    void documentsState; void renderedFiles; void expectedRevision; void options; void projectPath;
    throw Object.assign(new Error('旧文档发布已停用；请从已批准规划生成开发包。'), { code: ErrorCode.LEGACY_WORKFLOW_RETIRED });
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

    const activeRevision = await this.commitManager.getCurrentRevision(absPath);
    const stateDir = activeRevision > 0 ? this.commitManager.getRevisionDir(absPath,activeRevision) : join(absPath,'state');
    const metadata = await this.storage.readJson<ProjectMetadata>(activeRevision > 0 ? join(stateDir,'metadata.json') : join(absPath,'project.json'));
    for (const input of metadata.inputRefs) {
      if(input.status==='excluded')continue;
      const source = this.guard.assertContained(absPath, join(absPath,input.storageRef),'Input material');
      if (await this.storage.exists(source)) {
        const currentHash=createHash('sha256').update(await this.storage.readBuffer(source)).digest('hex');
        if(input.contentHash&&input.contentHash!==currentHash){input.status='failed';input.analysisAvailability='unavailable';input.summary='材料文件已被外部修改，请重新添加或排除；旧提取内容不可作为证据。';}
        else input.contentHash=currentHash;
      }else{input.status='failed';input.analysisAvailability='unavailable';input.summary='材料原文件缺失，请重新添加或排除。';}
    }

    const decisions = await this.storage.readJson<DecisionsState>(join(stateDir, 'decisions.json'));
    const assumptions = await this.storage.readJson<AssumptionsState>(join(stateDir, 'assumptions.json'));
    const gaps = await this.storage.readJson<GapsState>(join(stateDir, 'gaps.json'));
    const risks = await this.storage.readJson<RisksState>(join(stateDir, 'risks.json'));
    const questions = await this.storage.readJson<QuestionsState>(join(stateDir, 'questions.json'));
    const readiness = await this.storage.readJson<ReadinessState>(join(stateDir, 'readiness.json'));
    const planning = emptyPlanningState();
    let legacyPlanningLedger = true;
    for (const [file, key] of [['planning.json', 'ledger'], ['blueprint.json', 'blueprint'], ['changesets.json', 'changeSets']] as const) {
      if (await this.storage.exists(join(stateDir, file))) {
        const data = await this.storage.readJson<any>(join(stateDir, file));
        if (key === 'ledger') { Object.assign(planning, data); legacyPlanningLedger = false; }
        else if (key === 'blueprint') planning.blueprint = data;
        else planning.changeSets = data;
      }
    }
    // B3 additive normalization is shared with pure inspection projections.
    ProjectStateMigration.normalizeLoadedRecords({ metadata, decisions, gaps, questions, planning }, legacyPlanningLedger);

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
      planning,
    };

    ProjectStateMigration.migrateInMemory(snapshot);
    return snapshot;
  }

  /** Core-only persistence boundary for validated planning intents. */
  async commitPlanningState(projectPath: string, snapshot: ProjectSnapshot, expectedRevision: number): Promise<ProjectSnapshot> {
    this.assertRevision(snapshot.metadata, expectedRevision);
    if (!snapshot.planning) throw new Error('Planning state required');
    const { blueprint, changeSets, ...ledger } = snapshot.planning;
    await this.commitManager.commit(projectPath, expectedRevision + 1, {
      metadata: snapshot.metadata, decisions: snapshot.decisions, questions: snapshot.questions, gaps: snapshot.gaps,
      overview: this.buildOverviewProjection(snapshot.metadata.projectId, snapshot.decisions, snapshot.gaps),
      planning: ledger, blueprint, changesets: changeSets,
    }, expectedRevision);
    return this.loadProject(projectPath);
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
    void projectPath; void expectedRevision;
    throw Object.assign(new Error('旧准备度评审写入已停用；请使用规划变更包。'), { code: ErrorCode.LEGACY_WORKFLOW_RETIRED });
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
    void projectPath; void disposition; void expectedRevision; void acknowledgements;
    throw Object.assign(new Error('旧准备度签署已停用；请明确批准规划变更包。'), { code: ErrorCode.LEGACY_WORKFLOW_RETIRED });
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
   * Ingests candidate decisions discovered via brownfield codebase scanning.
   * Guarantees: All ingested items are strictly candidate status (never auto-confirmed/locked).
   */
  async ingestBrownfieldCandidates(
    projectPath: string,
    candidates: BrownfieldCandidateDecision[],
    expectedRevision?: number
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    if (expectedRevision !== undefined) {
      this.assertRevision(snapshot.metadata, expectedRevision);
    }

    const timestamp = new Date().toISOString();
    const existingKeys = new Set(snapshot.decisions.items.map((d) => d.decisionKey || d.statement));
    const newDecisions: DecisionItem[] = [];
    const newTags = new Set(snapshot.metadata.projectTags || []);

    for (const cand of candidates) {
      if (existingKeys.has(cand.decisionKey)) {
        continue;
      }
      existingKeys.add(cand.decisionKey);

      const decId = `dec-bf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const canonicalArea = AreaRegistry.normalize(cand.areaId);

      newDecisions.push({
        id: decId,
        area: canonicalArea,
        statement: `${cand.title}：${cand.summary}`,
        status: 'candidate', // STRICT USER AUTHORITY FIRST
        origin: 'agent',
        evidenceRefs: [],
        decisionKey: cand.decisionKey,
        rationale: cand.details,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (cand.suggestedTags) {
        for (const tag of cand.suggestedTags) {
          newTags.add(tag);
        }
      }
    }

    if (newDecisions.length === 0) {
      return snapshot;
    }

    const updatedDecisions = {
      ...snapshot.decisions,
      items: [...snapshot.decisions.items, ...newDecisions],
      updatedAt: timestamp,
    };

    const updatedMetadata = {
      ...snapshot.metadata,
      projectTags: Array.from(newTags),
      updatedAt: timestamp,
    };

    const updatedOverview = this.buildOverviewProjection(
      snapshot.metadata.projectId,
      updatedDecisions,
      snapshot.gaps
    );

    const targetRevision = snapshot.metadata.stateRevision + 1;
    await this.commitManager.commit(projectPath, targetRevision, {
      metadata: updatedMetadata,
      decisions: updatedDecisions,
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
  async answerQuestion(projectPath: string, questionRef: QuestionRef, answer: string, expectedRevision: number): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    const id = String(questionRef).replace(/^question:/, '');
    const question = snapshot.questions.items.find(q => q.id === id);
    if (!question) throw new Error('Question not found');
    const selected = question.options.find(option => option.key === answer.trim() || option.label === answer.trim());
    const { PlanningService } = await import('../planning/PlanningService.js');
    return new PlanningService(this).answer(projectPath, [{ questionId: id, kind: selected ? 'selection' : 'custom', ...(selected ? { optionKeys: [selected.key] } : { text: answer }) }], expectedRevision, 'legacy-answer:' + randomUUID());
  }

  /**
   * Retracts an answered question within the undo window or on user request.
   * Performs four-way cascading consistency:
   * 1. Rejects associated decision (status: 'rejected', rejectionReason: 'retracted_by_user').
   * 2. Re-opens linked gap if no other confirmed/candidate decisions cover it.
   * 3. Deprecates associated assumption if answered as an assumption.
   * 4. Resets question to 'shown' with cleared answer and re-evaluates overview projection & readiness.
   */
  async retractQuestion(
    projectPath: string,
    questionRef: QuestionRef,
    expectedRevision: number
  ): Promise<{ snapshot: ProjectSnapshot; retractedQuestionId: string; reopenedGapRef?: TypedRef }> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const cleanRef = String(questionRef).startsWith('question:') ? questionRef : (`question:${questionRef}` as QuestionRef);
    const parsed = parseTypedRef(cleanRef);
    if (parsed.kind !== 'question') throw new Error(`Expected a question reference, received "${questionRef}".`);
    const question = snapshot.questions.items.find((item) => item.id === parsed.id);
    if (!question) throw new Error(`Question "${questionRef}" not found`);
    if (question.status !== 'answered') {
      throw new Error(`Question "${questionRef}" is not answered (current status: "${question.status}").`);
    }

    const timestamp = new Date().toISOString();

    // 1. Mark associated decision(s) as rejected
    const associatedDecisions = snapshot.decisions.items.filter(
      (d) => d.evidenceRefs && d.evidenceRefs.includes(cleanRef) && d.status !== 'superseded' && d.status !== 'rejected'
    );
    for (const dec of associatedDecisions) {
      dec.status = 'rejected';
      dec.rejectionReason = 'retracted_by_user';
      dec.updatedAt = timestamp;
    }

    // Also look up trace if exists
    let associatedDecisionRef: DecisionRef | undefined;
    if (snapshot.decisions.traces) {
      const trace = snapshot.decisions.traces.find((t) => t.questionRef === cleanRef);
      if (trace && trace.decisionRef) {
        associatedDecisionRef = trace.decisionRef;
        const targetDec = snapshot.decisions.items.find((d) => `decision:${d.id}` === trace.decisionRef);
        if (targetDec && targetDec.status !== 'rejected') {
          targetDec.status = 'rejected';
          targetDec.rejectionReason = 'retracted_by_user';
          targetDec.updatedAt = timestamp;
        }
      }
    }

    // 2. Reopen linked gap if no other active decision covers it
    let reopenedGapRef: TypedRef | undefined;
    const issue = parseTypedRef(question.issueRef);
    if (issue.kind === 'gap') {
      const linkedGap = snapshot.gaps.gaps.find((g) => g.id === issue.id);
      if (linkedGap) {
        const otherActiveDecisions = snapshot.decisions.items.some(
          (d) =>
            d.status !== 'rejected' &&
            d.status !== 'superseded' &&
            (d.status as string) !== 'deprecated' &&
            d.area === linkedGap.area &&
            !associatedDecisions.some((ad) => ad.id === d.id)
        );
        if (!otherActiveDecisions && linkedGap.status === 'addressed') {
          linkedGap.status = 'open';
          reopenedGapRef = `gap:${linkedGap.id}` as TypedRef;
        }
      }
    }

    // 3. Clean up assumption if answered as assumption
    if (question.answer?.startsWith('[Assumption]')) {
      const asmText = question.answer.replace(/^\[Assumption\]\s*/, '').trim();
      for (const asm of snapshot.assumptions.items) {
        if (asm.statement.trim() === asmText || (question.decisionKey && asm.decisionKey === question.decisionKey)) {
          asm.status = 'deprecated' as any;
        }
      }
    }

    // 4. Reset question status
    question.status = 'shown';
    delete question.answer;
    delete question.answeredAt;

    // 5. Append trace event
    snapshot.decisions.traces ??= [];
    snapshot.decisions.traces.push({
      id: `trace-retract-${Date.now()}`,
      questionRef: cleanRef,
      userAnswer: '[Retracted]',
      decisionRef: associatedDecisionRef || (`decision:none` as DecisionRef),
      stateChanges: [
        { ref: cleanRef, action: 'question-retracted' as any },
        ...(reopenedGapRef ? [{ ref: reopenedGapRef, action: 'gap-reopened' as any }] : []),
      ],
      createdAt: timestamp,
    });

    snapshot.decisions.updatedAt = timestamp;
    snapshot.questions.updatedAt = timestamp;
    snapshot.gaps.updatedAt = timestamp;
    snapshot.assumptions.updatedAt = timestamp;
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
        assumptions: snapshot.assumptions,
        overview,
      },
      expectedRevision
    );

    const updatedSnapshot = await this.loadProject(projectPath);
    return {
      snapshot: updatedSnapshot,
      retractedQuestionId: parsed.id,
      reopenedGapRef,
    };
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
   * Deprecates or discards a decision.
   * Marks candidate/confirmed decision as deprecated, cleans up dependencies,
   * updates Gaps and rebuilds Overview Projection.
   */
  async deprecateDecision(
    projectPath: string,
    decisionRef: DecisionRef,
    expectedRevision: number
  ): Promise<{ deprecatedRef: DecisionRef; snapshot: ProjectSnapshot }> {
    const snapshot = await this.loadProject(projectPath);
    this.assertRevision(snapshot.metadata, expectedRevision);

    const parsed = parseTypedRef(decisionRef);
    const existing = snapshot.decisions.items.find((d) => d.id === parsed.id);
    if (!existing) {
      const err: any = new Error(`Decision not found: ${decisionRef}`);
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    if (existing.status === 'locked') {
      const err: any = new Error(`Cannot deprecate a locked decision without unlocking it first: ${decisionRef}`);
      err.code = ErrorCode.DECISION_LOCKED;
      throw err;
    }

    const timestamp = new Date().toISOString();
    existing.status = 'deprecated';
    existing.updatedAt = timestamp;

    for (const d of snapshot.decisions.items) {
      if (d.evidenceRefs) {
        d.evidenceRefs = d.evidenceRefs.filter((ref) => ref !== decisionRef);
      }
    }

    const areaId = existing.area;
    const hasRemainingConfirmed = snapshot.decisions.items.some(
      (d) => d.area === areaId && (d.status === 'confirmed' || d.status === 'locked')
    );

    let updatedGaps = snapshot.gaps;
    if (!hasRemainingConfirmed) {
      updatedGaps = {
        ...snapshot.gaps,
        gaps: snapshot.gaps.gaps.map((g) => {
          if (g.area === areaId && g.status === 'addressed') {
            return { ...g, status: 'open' as const };
          }
          return g;
        }),
        updatedAt: timestamp,
      };
    }

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
    return { deprecatedRef: decisionRef, snapshot: newSnapshot };
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
    } else if (result.questions && result.questions.length > 0) {
      // Gate enforcement on incoming AI / raw questions:
      // Local stage budget, deduplication, cycle detection, gap linkage, and batch metadata
      const policy = this.batchPolicy.evaluate(snapshot);
      const batchId = `batch-${snapshot.metadata.stateRevision}-${Date.now().toString(36)}`;

      // 1. Build dependency graph for incoming questions
      const questionDepGraph = new Map<string, string[]>();
      for (const q of result.questions) {
        const area = AreaRegistry.normalize((q as any).area || 'technical_boundary');
        const decisionKey = this.normalizeDecisionKey(
          (q as any).decisionKey || q.decision_key || `${area}:${q.question}`
        );
        const deps = ((q as any).dependsOn || q.depends_on || []).map((d: string) => this.normalizeDecisionKey(d));
        questionDepGraph.set(decisionKey, deps);
      }

      const seenKeys = new Set<string>();
      const candidateQuestions: QuestionItem[] = [];

      for (const q of result.questions) {
        const area = AreaRegistry.normalize((q as any).area || 'technical_boundary');
        const decisionKey = this.normalizeDecisionKey(
          (q as any).decisionKey || q.decision_key || `${area}:${q.question}`
        );

        // Deduplicate within the batch
        if (seenKeys.has(decisionKey)) continue;
        seenKeys.add(decisionKey);

        // Check for dependency cycles
        if (this.hasCycle(decisionKey, questionDepGraph)) continue;

        // Check if already in snapshot questions (active or answered)
        const alreadyExists = snapshot.questions.items.some(
          (item) =>
            (item.decisionKey && this.normalizeDecisionKey(item.decisionKey) === decisionKey) ||
            item.question.trim() === q.question.trim()
        );
        if (alreadyExists) continue;

        // Ensure matching GapItem exists in snapshot.gaps.gaps
        let matchingGap = snapshot.gaps.gaps.find(
          (g) => g.decisionKey === decisionKey && g.status === 'open'
        );
        if (!matchingGap) {
          matchingGap = {
            id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            area,
            decisionKey,
            dependsOn: ((q as any).dependsOn || q.depends_on || []).map((d: string) => this.normalizeDecisionKey(d)),
            severity: q.importance === 'critical' ? 'critical' : 'high',
            reason: q.reason || q.question,
            impact: '未决架构决策',
            shouldAskUser: true,
            status: 'open',
          };
          snapshot.gaps.gaps.push(matchingGap);
        }

        const issueRef = (q as any).issueRef || (`gap:${matchingGap.id}` as TypedRef);
        const mappedOptions: QuestionOption[] = (q.options || []).map((o: any, idx: number) => ({
          key: o.key || `opt_${idx + 1}`,
          label: o.label || '',
          impact: o.impact || '',
          tradeoffs: o.tradeoffs,
          reversibility: o.reversibility || 'moderate',
          gain: o.gain,
          sacrifice: o.sacrifice,
        }));

        const recommendedOptionKey =
          (q as any).recommendedOptionKey || q.recommended_option_key || mappedOptions[0]?.key;
        const importance: QuestionImportance = ['critical', 'high', 'normal'].includes(q.importance)
          ? q.importance
          : 'normal';

        candidateQuestions.push({
          id: (q as any).id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          issueRef,
          gapRef: issueRef,
          area,
          decisionKey,
          dependsOn: ((q as any).dependsOn || q.depends_on || []).map((d: string) => this.normalizeDecisionKey(d)),
          importance,
          priority: importance,
          question: q.question,
          reason: q.reason,
          whyNow: (q as any).whyNow || q.reason,
          impact: (q as any).impact || matchingGap.impact,
          recommendation: q.recommendation,
          recommendationReason: (q as any).recommendationReason || q.recommendation_reason,
          recommendedOptionKey,
          options: mappedOptions,
          allowFreeInput: true,
          status: (q as any).status || 'proposed',
          createdAt: (q as any).createdAt || timestamp,
          batchId,
          batchStage: policy.stage,
          basisRevision: snapshot.metadata.stateRevision,
        });
      }

      // Strictly budget: Never admit more questions than policy.maxQuestions
      const budgetedQuestions = candidateQuestions.slice(0, policy.maxQuestions);
      for (const q of budgetedQuestions) {
        snapshot.questions.items.push(q);
      }
    } else {
      // If neither payload.questions nor result.questions provided, generate via QuestionEngine
      const openGaps = snapshot.gaps.gaps.filter((g) => g.status === 'open');
      if (openGaps.length > 0) {
        const engineResult = this.questionEngine.generateQuestions(
          openGaps,
          snapshot
        );
        for (const q of engineResult.questions) {
          const exists = snapshot.questions.items.some(
            (item) => item.question.trim() === q.question.trim() && item.status !== 'dismissed'
          );
          if (!exists) {
            snapshot.questions.items.push(q);
          }
        }
        for (const asm of engineResult.autoAssumptions) {
          const exists = snapshot.assumptions.items.some(
            (a) => a.statement.trim().toLowerCase() === asm.statement.trim().toLowerCase() && a.status === 'active'
          );
          if (!exists) {
            snapshot.assumptions.items.push(asm);
          }
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
    expectedRevision: number,
    allowRebase = false
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.loadProject(projectPath);
    if (!allowRebase) {
      this.assertRevision(snapshot.metadata, expectedRevision);
    }

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
      allowRebase ? snapshot.metadata.stateRevision : expectedRevision
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
    expectedRevision?: number,
    extractedText?: string
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
      const cleanBase64 = content.replace(/\s/g, '').replace(/^data:.*?;base64,/, '');
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
        extractedText: textContent,
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
        analysisAvailability: 'available',
        reason: 'Image available to registered vision tasks; reading does not confirm requirements.',
        updatedAt: timestamp,
      });

      inputRef = {
        id: `input:${inputId}`,
        kind: 'image',
        label: filename,
        storageRef: storageRelPath,
        status: 'ready',
        analysisAvailability: 'available',
        createdAt: timestamp,
        summary: 'Image material; vision reading is recorded per planning task',
      };
    } else if (isDoc) {
      if (extractedText && extractedText.trim().length > 0) {
        const excerpt = extractedText.slice(0, 4000);
        await this.storage.writeJson(join(inputDir, 'extraction.json'), {
          id: `input:${inputId}`,
          extractedText,
          status: 'ready',
          analysisAvailability: 'available',
          updatedAt: timestamp,
        });

        inputRef = {
          id: `input:${inputId}`,
          kind: 'file',
          label: filename,
          storageRef: storageRelPath,
          status: 'ready',
          analysisAvailability: 'available',
          createdAt: timestamp,
          summary: excerpt.slice(0, 80),
        };
      } else {
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
      }
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
          d.status !== 'rejected' &&
          (d.status as string) !== 'deprecated'
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
    expectedRevision: number,
    clientTurnId?: string
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

    // Idempotency check: if clientTurnId is provided, check if already recorded in inputRefs
    if (clientTurnId) {
      const existing = snapshot.metadata.inputRefs.find((r) => r.clientTurnId === clientTurnId);
      if (existing) {
        const turnStore = new DiscoveryTurnStore(this.storage);
        const turns = await turnStore.loadTurns(projectPath).catch(() => []);
        const matchingTurn = turns.find((t: DiscoveryTurnRecord) => t.inputRef === String(existing.id));
        const turnId = matchingTurn ? matchingTurn.id : String(existing.id).replace(/^input:/, '');
        return {
          inputRef: String(existing.id),
          turnId,
          snapshot,
        };
      }
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
      clientTurnId,
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
  async readInputContent(projectPath: string, inputIdOrRef: string | { id?: string }): Promise<string> {
    const raw = typeof inputIdOrRef === 'string' ? inputIdOrRef : inputIdOrRef?.id || '';
    const id = raw.startsWith('input:') ? raw.slice(6) : raw;
    if (!id) return '';
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
    return ProjectStateMigration.normalizeDecisionKey(value);
  }

  private hasCycle(start: string, graph: Map<string, string[]>): boolean {
    const visit = (current: string, path: Set<string>): boolean => {
      if (path.has(current)) return current === start;
      const nextPath = new Set(path).add(current);
      return (graph.get(current) || []).some((next) => graph.has(next) && visit(next, nextPath));
    };
    return visit(start, new Set());
  }

  /**
   * @deprecated Historical rollback writes are retired. History remains readable.
   * Reject before any project read or crash recovery so callers cannot promote old snapshots.
   */
  async rollbackToRevision(_projectPath: string, _targetRevision: number): Promise<ProjectSnapshot> {
    throw Object.assign(new Error('旧历史回滚写入已停用；历史记录仍可读取。'), {
      code: ErrorCode.LEGACY_WORKFLOW_RETIRED,
    });
  }
}
