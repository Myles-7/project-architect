import { ContextManager } from '../context/ContextManager.js';
import type { AIProvider } from '../provider/AIProvider.js';
import { ProjectStateEngine, FileStorage, type CompileDocumentsResult } from '@project-architect/core';
import type { DiscoveryResult, RunDiscoveryTurnResponse, RunDiscoveryTurnRequest, ProjectSnapshot, AgentMode, MergedChecklistHint, StructuredResult, GapItem, QuestionItem, AssumptionItem, DecisionItem, ConflictItem, RiskItem, AgentRunTrace, DiscoveryExecutionPhase } from '@project-architect/contracts';
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
export declare class AIOrchestrator {
    private provider;
    private stateEngine;
    private contextManager;
    private modeRouter;
    private promptLoader;
    private schemaResolver;
    private runtimeRegistry;
    private checklistSelector;
    private gapEngine;
    private questionEngine;
    private questionBatchPolicy;
    private policyEngine;
    private storage;
    private rootDir;
    constructor(provider: AIProvider, stateEngine: ProjectStateEngine, rootDir?: string, storage?: FileStorage);
    getRootDir(): string;
    getProvider(): AIProvider;
    getContextManager(): ContextManager;
    /**
     * Step 1: Mode Selection
     */
    selectMode(snapshot: ProjectSnapshot, request: Omit<RunDiscoveryTurnRequest, 'projectId'>, explicitMode?: AgentMode): AgentMode;
    /**
     * Step 2: Context Building
     */
    buildContext(mode: AgentMode, snapshot: ProjectSnapshot, request: Omit<RunDiscoveryTurnRequest, 'projectId'>, projectPath?: string): Promise<{
        contextText: string;
        checklistHints: MergedChecklistHint[];
    }>;
    /**
     * Step 3: Single Primary Provider Execution with Mode-Tailored Prompt & Schema
     */
    executeAgentMode(mode: AgentMode, contextText: string, abortSignal?: AbortSignal): Promise<StructuredResult<DiscoveryResult>>;
    /**
     * Step 4: Output Validation (Strict B3 Schema & Field Integrity Gate)
     */
    validateOutput(result: StructuredResult<DiscoveryResult>): DiscoveryResult;
    /**
     * Step 5: Policy & Engine Processing (Gap, Question, Risk Policy)
     */
    applyPolicy(snapshot: ProjectSnapshot, discoveryOutput: DiscoveryResult, checklistHints: MergedChecklistHint[]): IntegratedDiscoveryTurnPayload;
    /**
     * Step 6: Atomic State Commit
     */
    commitState(projectPath: string, payload: IntegratedDiscoveryTurnPayload, expectedRevision: number, allowRebase?: boolean): Promise<ProjectSnapshot>;
    /**
     * Step 7: Workflow Trace Persistence
     */
    recordTrace(projectPath: string, trace: AgentRunTrace): Promise<void>;
    /**
     * Executes the full Unified Discovery Turn pipeline (B3 Runtime Profile Workflow).
     */
    runDiscoveryTurn(projectPath: string, request: Omit<RunDiscoveryTurnRequest, 'projectId'>, explicitMode?: AgentMode, abortSignal?: AbortSignal, options?: {
        allowRebase?: boolean;
        onPhaseChange?: (phase: DiscoveryExecutionPhase) => void;
    }): Promise<RunDiscoveryTurnResponse & {
        activeMode?: AgentMode;
        runTrace?: AgentRunTrace;
    }>;
    /**
     * Compiles the full verified Markdown development package from current Project State.
     */
    compileDocuments(projectPath: string, expectedRevision?: number, options?: {
        customRules?: string[];
        customNotes?: string;
        isDraft?: boolean;
    }): Promise<CompileDocumentsResult>;
}
//# sourceMappingURL=AIOrchestrator.d.ts.map