import { type PlanningContextAccess, type PlanningContextInput } from './PlanningContextAccess.js';
export interface ToolMaterial {
    id: string;
    path: string;
    extractedTextPath?: string;
    mimeType?: string;
    source?: string;
}
export interface PlanningToolsConfig {
    materialRoots: string[];
    materials: ToolMaterial[];
    experimentRoot: string;
    evidenceRoot: string;
    officialHosts?: string[];
    dockerExecutable?: string;
    images?: Partial<Record<ExperimentRuntime, string>>;
    contextAccess?: PlanningContextAccess;
}
export type ExperimentRuntime = 'node' | 'python' | 'chromium';
export interface ExperimentInput {
    runtime: ExperimentRuntime;
    source: string;
    timeoutMs?: number;
    abortSignal?: AbortSignal;
}
export interface ExperimentResult {
    id: string;
    status: 'pass' | 'fail' | 'unavailable' | 'cancelled';
    exitCode: number | null;
    directory: string;
    logPath: string;
    environment: {
        runtime: ExperimentRuntime;
        image: string;
        imageId?: string;
        network: 'none';
    };
    reason?: string;
    startedAt: string;
    completedAt: string;
}
export interface EvidenceInput {
    source: string;
    content: string;
    scope: string;
    conclusion?: string;
}
export interface PreparedDependency {
    name: string;
    version: string;
}
export declare function readableResearchContent(html: string): string;
/** One service per registered task, with explicit source roots and an isolated experiment area. */
export declare class PlanningToolsService {
    readonly config: PlanningToolsConfig;
    private events;
    private researchCache;
    constructor(config: PlanningToolsConfig);
    private record;
    private material;
    readContext(input: PlanningContextInput): Promise<{
        contextSha256: string;
        parts: import("./PlanningContextAccess.js").PlanningContextPart[];
        nextOffset: number | null;
        nextCharacterOffset: number;
        totalEntries: number;
    } | {
        contextSha256: string;
        entries: {
            requiredForReview: boolean;
            key: string;
            path: string;
            label?: string;
            encoding: "json" | "structure";
            characters: number;
            sha256: string;
        }[];
        offset: number;
        nextOffset: number | null;
        totalEntries: number;
    } | {
        contextSha256: string;
        key: string;
        path: string;
        encoding: "json" | "structure";
        sha256: string;
        content: string;
        offset: number;
        nextOffset: number | null;
        totalCharacters: number;
    }>;
    private confined;
    materialIndex(): Promise<Array<{
        id: string;
        path: string;
        mimeType: string;
        source: string;
        sha256: string;
        bytes: number;
        readTool: string;
    }>>;
    readMaterial(id: string, offset?: number, length?: number): Promise<{
        id: string;
        content: string;
        offset: number;
        nextOffset: number | null;
        totalCharacters: number;
        sha256: string;
        sourceSha256: string;
        source: string;
        readAt: string;
    }>;
    readImage(id: string): Promise<{
        id: string;
        path: string;
        mimeType: string;
        data: string;
        sha256: string;
        source: string;
        readAt: string;
    }>;
    private officialUrl;
    readResearch(value: string, offset?: number, length?: number): Promise<{
        source: string;
        fetchedAt: string;
        sha256: string;
        content: string;
        links: string[];
        evidencePath: string;
        offset: number;
        nextOffset: number | null;
        totalCharacters: number;
    }>;
    recordEvidence(input: EvidenceInput): Promise<{
        id: string;
        source: string;
        capturedAt: string;
        sha256: string;
        scope: string;
        path: string;
        approval: 'candidate';
    }>;
    private image;
    private docker;
    /** Explicit online preparation builds only fixed package-manager commands. Submitted
     * experiment source never enters this build context and executes only offline. */
    prepareEnvironment(runtime: ExperimentRuntime, abortSignal?: AbortSignal, dependencies?: PreparedDependency[]): Promise<{
        status: 'available' | 'unavailable' | 'cancelled';
        image: string;
        logPath: string;
        reason?: string;
    }>;
    runExperiment(input: ExperimentInput): Promise<ExperimentResult>;
}
//# sourceMappingURL=PlanningToolsService.d.ts.map