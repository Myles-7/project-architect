import { join } from 'node:path';
import { ContextManager } from '../context/ContextManager.js';
import { AgentModeRouter } from '../router/AgentModeRouter.js';
import { PromptLoader } from '../prompts/PromptLoader.js';
import { SchemaResolver } from '../schemas/SchemaResolver.js';
import { AgentRuntimeRegistry } from '../runtime/AgentRuntimeRegistry.js';
import type { AIProvider } from '../provider/AIProvider.js';
import {
  ChecklistSelector,
  ProjectStateEngine,
  FileStorage,
  GapDetectionEngine,
  QuestionEngine,
  QuestionBatchPolicy,
  DecisionPolicyEngine,
  DocumentCompiler,
  type CompileDocumentsResult,
} from '@project-architect/core';
import type {
  DiscoveryResult,
  QuestionRef,
  RunDiscoveryTurnResponse,
  RunDiscoveryTurnRequest,
  ProjectSnapshot,
  AgentMode,
  MergedChecklistHint,
  StructuredResult,
  GapItem,
  QuestionItem,
  AssumptionItem,
  DecisionItem,
  ConflictItem,
  RiskItem,
  AgentRunTrace,
  DiscoveryExecutionPhase,
} from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';

export interface IntegratedDiscoveryTurnPayload {
  discoveryResult: DiscoveryResult;
  prioritizedGaps: GapItem[];
  questions: QuestionItem[];
  autoAssumptions: AssumptionItem[];
  newCandidates: DecisionItem[];
  newAssumptions: AssumptionItem[];
  newConflicts: ConflictItem[];
  newRisks: RiskItem[];
  questionBatch: {
    id: string;
    stage: import('@project-architect/contracts').QuestionBatchStage;
    diagnostics: import('@project-architect/core').QuestionSelectionDiagnostics;
  };
}

export class AIOrchestrator {
  private provider: AIProvider;
  private stateEngine: ProjectStateEngine;
  private contextManager: ContextManager;
  private modeRouter: AgentModeRouter;
  private promptLoader: PromptLoader;
  private schemaResolver: SchemaResolver;
  private runtimeRegistry: AgentRuntimeRegistry;
  private checklistSelector: ChecklistSelector;
  private gapEngine: GapDetectionEngine;
  private questionEngine: QuestionEngine;
  private questionBatchPolicy: QuestionBatchPolicy;
  private policyEngine: DecisionPolicyEngine;
  private storage: FileStorage;
  private rootDir: string;

  constructor(
    provider: AIProvider,
    stateEngine: ProjectStateEngine,
    rootDir: string = process.cwd(),
    storage: FileStorage = new FileStorage()
  ) {
    this.provider = provider;
    this.stateEngine = stateEngine;
    this.rootDir = rootDir;
    this.storage = storage;
    this.contextManager = new ContextManager();
    this.modeRouter = new AgentModeRouter();
    this.promptLoader = new PromptLoader(rootDir, storage);
    this.schemaResolver = new SchemaResolver(rootDir, storage);
    this.runtimeRegistry = new AgentRuntimeRegistry();
    this.checklistSelector = new ChecklistSelector(join(rootDir, 'checklists'), storage);
    this.gapEngine = new GapDetectionEngine();
    this.questionEngine = new QuestionEngine();
    this.questionBatchPolicy = new QuestionBatchPolicy();
    this.policyEngine = new DecisionPolicyEngine();
  }

  getRootDir(): string {
    return this.rootDir;
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  /**
   * Step 1: Mode Selection
   */
  selectMode(
    snapshot: ProjectSnapshot,
    request: Omit<RunDiscoveryTurnRequest, 'projectId'>,
    explicitMode?: AgentMode
  ): AgentMode {
    return this.modeRouter.route({
      snapshot,
      request,
      explicitMode,
    });
  }

  /**
   * Step 2: Context Building
   */
  async buildContext(
    mode: AgentMode,
    snapshot: ProjectSnapshot,
    request: Omit<RunDiscoveryTurnRequest, 'projectId'>,
    projectPath?: string
  ): Promise<{ contextText: string; checklistHints: MergedChecklistHint[] }> {
    // 1. Select Checklist hints
    const checklistHints = await this.checklistSelector.selectHints(
      snapshot.metadata.projectTags,
      snapshot.decisions,
      snapshot.overview
    );

    // 2. Read input materials (only successfully extracted and available text)
    const inputMaterials: Array<{ label: string; text: string }> = [];
    const baseProjectDir = projectPath || process.cwd();

    for (const ref of snapshot.metadata.inputRefs) {
      if (ref.status === 'ready' && ref.analysisAvailability === 'available') {
        const inputId = ref.id.replace('input:', '');
        const extractionPath = join(baseProjectDir, 'inputs', inputId, 'extraction.json');
        if (await this.storage.exists(extractionPath)) {
          try {
            const extraction = await this.storage.readJson<{ extractedText?: string }>(extractionPath);
            if (extraction.extractedText && extraction.extractedText.trim().length > 0) {
              inputMaterials.push({ label: ref.label, text: extraction.extractedText });
            }
          } catch {
            // Ignore corrupted extraction
          }
        }
      }
    }

    // 3. Assemble profile-based context text
    const baseContextText = this.contextManager.buildContextForMode(mode, snapshot, {
      userMessage: request.userMessage,
      questionAnswer: request.questionAnswer
        ? {
            questionRef: String(request.questionAnswer.questionRef),
            selectedOption: request.questionAnswer.selectedOption,
            freeInput: request.questionAnswer.freeInput,
          }
        : undefined,
      checklistHints,
      inputMaterials,
    });

    const batchPolicy = this.questionBatchPolicy.evaluate(snapshot);
    const contextText = `${baseContextText}\n\n## B3 Runtime Question Budget\n- Stage: ${batchPolicy.stage}\n- Target: ${batchPolicy.targetMin}-${batchPolicy.maxQuestions} useful independent questions\n- Hard maximum: ${batchPolicy.maxQuestions}\n- Do not add filler when fewer meaningful independent decisions exist.`;
    return { contextText, checklistHints };
  }

  /**
   * Step 3: Single Primary Provider Execution with Mode-Tailored Prompt & Schema
   */
  async executeAgentMode(
    mode: AgentMode,
    contextText: string,
    abortSignal?: AbortSignal
  ): Promise<StructuredResult<DiscoveryResult>> {
    const runtimeProfile = this.runtimeRegistry.getProfile(mode);
    const prompt = await this.promptLoader.buildPromptText(mode);
    const schemaPath = await this.schemaResolver.resolveSchemaPath(mode);

    return await this.provider.complete<DiscoveryResult>({
      requestId: `req-${Date.now()}`,
      task: runtimeProfile.task,
      mode,
      promptProfile: runtimeProfile.promptProfile,
      schemaProfile: runtimeProfile.schemaProfile,
      prompt,
      schemaPath,
      contextText,
      abortSignal,
    });
  }

  /**
   * Step 4: Output Validation (Strict B3 Schema & Field Integrity Gate)
   */
  validateOutput(result: StructuredResult<DiscoveryResult>): DiscoveryResult {
    if (!result.structuredSuccess || !result.structuredOutput) {
      const err: any = new Error(
        `Discovery inference failed: ${result.stderr || result.status}`
      );
      err.code =
        result.status === 'timed-out'
          ? ErrorCode.PROVIDER_TIMEOUT
          : result.status === 'cancelled'
            ? ErrorCode.DISCOVERY_CANCELLED
            : ErrorCode.PROVIDER_PROCESS_FAILED;
      err.details = { status: result.status, provider: result.provider };
      throw err;
    }

    const output = result.structuredOutput;
    if (typeof output !== 'object' || output === null || Array.isArray(output)) {
      const err: any = new Error('Structured output validation failed: output must be a JSON object.');
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }

    const requiredArrayFields = [
      'confirmed',
      'candidates',
      'assumptions',
      'unknowns',
      'risks',
      'gaps',
      'conflicts',
      'tensions',
      'questions',
    ] as const;

    for (const field of requiredArrayFields) {
      if (!Array.isArray((output as any)[field])) {
        const err: any = new Error(
          `Structured output validation failed: required array field "${field}" is missing or not an array.`
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    // Validate simple string array fields
    const stringArrayFields = [
      'confirmed',
      'unknowns',
      'conflicts',
    ] as const;

    for (const field of stringArrayFields) {
      for (const item of (output as any)[field]) {
        if (typeof item !== 'string') {
          const err: any = new Error(
            `Structured output validation failed: items in "${field}" must be strings.`
          );
          err.code = ErrorCode.STATE_VALIDATION_FAILED;
          throw err;
        }
      }
    }

    const hasNonEmptyString = (value: unknown): value is string =>
      typeof value === 'string' && value.trim().length > 0;
    const hasStringArray = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every(hasNonEmptyString);

    // Validate strict B3 CandidateSuggestion objects.
    for (const item of output.candidates || []) {
      const isObj =
        typeof item === 'object' &&
        item !== null &&
        hasNonEmptyString((item as any).decision_key) &&
        hasNonEmptyString((item as any).area) &&
        hasNonEmptyString((item as any).statement) &&
        hasNonEmptyString((item as any).rationale);

      if (!isObj) {
        const err: any = new Error(
          'B3 structured output validation failed: items in "candidates" require decision_key, area, statement, and rationale.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    // Validate strict B3 AssumptionSuggestion objects.
    for (const item of output.assumptions || []) {
      const isObj =
        typeof item === 'object' &&
        item !== null &&
        hasNonEmptyString((item as any).decision_key) &&
        hasNonEmptyString((item as any).area) &&
        hasNonEmptyString((item as any).statement) &&
        hasNonEmptyString((item as any).reason);

      if (!isObj) {
        const err: any = new Error(
          'B3 structured output validation failed: items in "assumptions" require decision_key, area, statement, and reason.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    // Validate strict B3 RiskSuggestion objects.
    for (const item of output.risks || []) {
      const isObj =
        typeof item === 'object' &&
        item !== null &&
        hasNonEmptyString((item as any).risk_key) &&
        hasNonEmptyString((item as any).area) &&
        hasNonEmptyString((item as any).statement) &&
        hasNonEmptyString((item as any).impact) &&
        ['low', 'medium', 'high', 'critical'].includes((item as any).severity);

      if (!isObj) {
        const err: any = new Error(
          'B3 structured output validation failed: items in "risks" require risk_key, area, statement, impact, and severity.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    for (const gap of output.gaps) {
      if (!hasNonEmptyString(gap.decision_key) || !hasStringArray(gap.depends_on)) {
        const err: any = new Error('B3 gaps require decision_key and depends_on.');
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    for (const question of output.questions) {
      if (
        !hasNonEmptyString(question.decision_key)
        || !hasStringArray(question.depends_on)
        || !Array.isArray(question.options)
        || question.options.length < 2
        || question.options.length > 3
      ) {
        const err: any = new Error('B3 questions require decision_key, depends_on, and 2-3 options.');
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    // Validate tensions
    for (const item of output.tensions) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.description !== 'string' ||
        typeof item.reason !== 'string'
      ) {
        const err: any = new Error(
          'Structured output validation failed: tension items must have description and reason strings.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    // Validate gaps
    const validSeverities = new Set(['low', 'medium', 'high', 'critical']);
    for (const gap of output.gaps) {
      if (
        typeof gap !== 'object' ||
        gap === null ||
        typeof gap.area !== 'string' ||
        !validSeverities.has(gap.severity) ||
        typeof gap.reason !== 'string' ||
        typeof gap.impact !== 'string' ||
        typeof gap.decision_key !== 'string' ||
        !Array.isArray(gap.depends_on) ||
        typeof gap.should_ask_user !== 'boolean'
      ) {
        const err: any = new Error(
          'Structured output validation failed: B3 gaps require decision_key, depends_on, area, severity, reason, impact, and should_ask_user.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    // Validate questions
    const validImportances = new Set(['normal', 'high', 'critical']);
    for (const q of output.questions) {
      if (
        typeof q !== 'object' ||
        q === null ||
        !validImportances.has(q.importance) ||
        typeof q.decision_key !== 'string' ||
        !Array.isArray(q.depends_on) ||
        typeof q.question !== 'string' ||
        typeof q.reason !== 'string' ||
        typeof q.recommendation !== 'string' ||
        typeof q.recommendation_reason !== 'string' ||
        !Array.isArray(q.options)
      ) {
        const err: any = new Error(
          'Structured output validation failed: B3 questions require decision_key, depends_on, importance, question, reason, recommendation, recommendation_reason, and options.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }

      if (q.allow_free_input === undefined) {
        q.allow_free_input = true;
      } else if (typeof q.allow_free_input !== 'boolean') {
        const err: any = new Error(
          'Structured output validation failed: question allow_free_input must be a boolean.'
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }

      const seenKeys = new Set<string>();
      for (const opt of q.options) {
        if (
          typeof opt !== 'object' ||
          opt === null ||
          typeof opt.label !== 'string' ||
          typeof opt.impact !== 'string'
        ) {
          const err: any = new Error(
            'Structured output validation failed: question options must have label and impact strings.'
          );
          err.code = ErrorCode.STATE_VALIDATION_FAILED;
          throw err;
        }

        if (typeof opt.key !== 'string' || !opt.key.trim()) {
          const err: any = new Error(
            'Structured output validation failed: question option key must be a non-empty string.'
          );
          err.code = ErrorCode.STATE_VALIDATION_FAILED;
          throw err;
        }
        if (seenKeys.has(opt.key)) {
          const err: any = new Error(
            `Structured output validation failed: duplicate option key "${opt.key}" within question.`
          );
          err.code = ErrorCode.STATE_VALIDATION_FAILED;
          throw err;
        }
        seenKeys.add(opt.key);
      }

      if (typeof q.recommended_option_key !== 'string' || !seenKeys.has(q.recommended_option_key)) {
        const err: any = new Error(
          `Structured output validation failed: recommended_option_key "${q.recommended_option_key}" does not match any option key.`
        );
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
    }

    return output;
  }

  /**
   * Step 5: Policy & Engine Processing (Gap, Question, Risk Policy)
   */
  applyPolicy(
    snapshot: ProjectSnapshot,
    discoveryOutput: DiscoveryResult,
    checklistHints: MergedChecklistHint[]
  ): IntegratedDiscoveryTurnPayload {
    const prioritizedGaps = this.gapEngine.detectAndPrioritizeGaps(
      snapshot,
      checklistHints,
      discoveryOutput
    );

    const { questions, autoAssumptions, batch } = this.questionEngine.generateQuestions(
      prioritizedGaps,
      snapshot,
      discoveryOutput.questions
    );

    const { newCandidates, newAssumptions, newConflicts, newRisks } =
      this.policyEngine.processDiscoverySuggestions(snapshot, discoveryOutput);

    return {
      discoveryResult: discoveryOutput,
      prioritizedGaps,
      questions,
      autoAssumptions,
      newCandidates,
      newAssumptions,
      newConflicts,
      newRisks,
      questionBatch: batch,
    };
  }

  /**
   * Step 6: Atomic State Commit
   */
  async commitState(
    projectPath: string,
    payload: IntegratedDiscoveryTurnPayload,
    expectedRevision: number,
    allowRebase = false
  ): Promise<ProjectSnapshot> {
    return await this.stateEngine.applyIntegratedDiscoveryTurn(
      projectPath,
      payload,
      expectedRevision,
      allowRebase
    );
  }

  /**
   * Step 7: Workflow Trace Persistence
   */
  async recordTrace(projectPath: string, trace: AgentRunTrace): Promise<void> {
    const runtimeDir = join(projectPath, 'runtime');
    const traceFile = join(runtimeDir, 'agent-runs.json');

    let traces: AgentRunTrace[] = [];
    if (await this.storage.exists(traceFile)) {
      try {
        traces = await this.storage.readJson<AgentRunTrace[]>(traceFile);
      } catch {
        traces = [];
      }
    }

    traces.push(trace);
    await this.storage.writeJson(traceFile, traces);
  }

  /**
   * Executes the full Unified Discovery Turn pipeline (B3 Runtime Profile Workflow).
   */
  async runDiscoveryTurn(
    projectPath: string,
    request: Omit<RunDiscoveryTurnRequest, 'projectId'>,
    explicitMode?: AgentMode,
    abortSignal?: AbortSignal,
    options?: { allowRebase?: boolean; onPhaseChange?: (phase: DiscoveryExecutionPhase) => void }
  ): Promise<RunDiscoveryTurnResponse & { activeMode?: AgentMode; runTrace?: AgentRunTrace }> {
    const startedAt = new Date().toISOString();
    let snapshot = await this.stateEngine.getSnapshot(projectPath);
    const revisionBefore = snapshot.metadata.stateRevision;
    let expectedRevision = request.expectedRevision;

    // 0. Persist user question answer upfront if provided
    if (request.questionAnswer) {
      const answer = request.questionAnswer.freeInput?.trim() || request.questionAnswer.selectedOption?.trim();
      if (!answer) throw new Error('A question answer must include selectedOption or freeInput.');
      const rawRef = String(request.questionAnswer.questionRef);
      const normalizedQRef = (rawRef.startsWith('question:') ? rawRef : `question:${rawRef}`) as QuestionRef;
      snapshot = await this.stateEngine.answerQuestion(
        projectPath,
        normalizedQRef,
        answer,
        expectedRevision,
      );
      expectedRevision = snapshot.metadata.stateRevision;
    }

    // Step 1: Router
    const activeMode = this.selectMode(snapshot, request, explicitMode);
    const runtimeProfile = this.runtimeRegistry.getProfile(activeMode);

    // Step 2: Context Profile
    options?.onPhaseChange?.('context_assembly');
    const { contextText, checklistHints } = await this.buildContext(activeMode, snapshot, request, projectPath);

    // Step 3: Provider Execution (Single Call with specialized prompt & schema)
    options?.onPhaseChange?.('provider_inference');
    const result = await this.executeAgentMode(activeMode, contextText, abortSignal);

    // Step 4: Validation
    const discoveryOutput = this.validateOutput(result);

    // Step 5: Policy Application
    options?.onPhaseChange?.('gap_detection');
    const payload = this.applyPolicy(snapshot, discoveryOutput, checklistHints);

    // Step 6: State Commit
    options?.onPhaseChange?.('state_commit');
    const updatedSnapshot = await this.commitState(
      projectPath,
      payload,
      expectedRevision,
      options?.allowRebase ?? false
    );

    // Step 7: Workflow Trace Save
    const completedAt = new Date().toISOString();
    const runTrace: AgentRunTrace = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: activeMode,
      promptProfile: runtimeProfile.promptProfile,
      contextProfile: runtimeProfile.contextProfile,
      schemaProfile: runtimeProfile.schemaProfile,
      startedAt,
      completedAt,
      provider: this.provider.name,
      tokens: result.usage.totalTokens,
      durationMs: result.durationMs,
      stateRevisionBefore: revisionBefore,
      stateRevisionAfter: updatedSnapshot.metadata.stateRevision,
      diagnostics: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        thinkingTokens: result.usage.thinkingTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheObserved: result.usage.cacheReadTokens !== 'unavailable',
        questionBatch: payload.questionBatch,
      },
    };

    await this.recordTrace(projectPath, runTrace);

    return {
      discoveryResult: discoveryOutput,
      snapshot: updatedSnapshot,
      activeMode,
      runTrace,
      diagnostics: {
        durationMs: result.durationMs,
        totalTokens: result.usage.totalTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        questionBatch: {
          id: payload.questionBatch.id,
          stage: payload.questionBatch.stage,
          generatedQuestionCount: payload.questions.length,
          selection: payload.questionBatch.diagnostics,
        },
      },
    };
  }

  /**
   * Compiles the full verified Markdown development package from current Project State.
   */
  async compileDocuments(
    projectPath: string,
    expectedRevision?: number,
    options?: { customRules?: string[]; customNotes?: string; isDraft?: boolean }
  ): Promise<CompileDocumentsResult> {
    const snapshot = await this.stateEngine.getSnapshot(projectPath);
    if (expectedRevision !== undefined) {
      if (snapshot.metadata.stateRevision !== expectedRevision) {
        const err: any = new Error(
          `Revision conflict: expected ${expectedRevision} but found ${snapshot.metadata.stateRevision}`
        );
        err.code = ErrorCode.STATE_REVISION_CONFLICT;
        throw err;
      }
    }

    const targetExpectedRev = expectedRevision ?? snapshot.metadata.stateRevision;
    const nextRevision = snapshot.metadata.stateRevision + 1;
    const compiler = new DocumentCompiler(this.storage);
    const result = await compiler.compile(projectPath, snapshot, nextRevision, false, options);

    // Atomically commit documents state, write rendered files, and update stage
    await this.stateEngine.completeDocumentCompilation(
      projectPath,
      result.manifest,
      result.renderedFiles,
      targetExpectedRev,
      options
    );

    return result;
  }
}
