export interface PlanningContextEntry {
    key: string;
    path: string;
    label?: string;
    encoding: 'json' | 'structure';
    characters: number;
    sha256: string;
    content: string;
}
export interface PlanningContextAccess {
    sourcePath: string;
    sourceSha256: string;
    entriesPath: string;
    entriesSha256: string;
    readsPath: string;
    requiredKeys: string[];
}
export interface PlanningContextInput {
    action: 'index' | 'read' | 'scan';
    prefix?: string;
    key?: string;
    offset?: number;
    length?: number;
    characterOffset?: number;
    requiredOnly?: boolean;
}
export interface PlanningContextPart {
    key: string;
    path: string;
    encoding: 'json' | 'structure';
    sha256: string;
    content: string;
    offset: number;
    nextOffset: number | null;
    totalCharacters: number;
}
/** Freeze the complete input once per invocation. Paging is transport, never a usage budget. */
export declare function preparePlanningContextAccess(text: string, directory: string, requestId: string): {
    access: PlanningContextAccess;
    overview: {
        transport: string;
        contextSha256: string;
        sections: {
            prefix: string;
            records: number;
        }[];
        reviewRequiresCompleteRead: boolean;
        instructions: string;
    };
};
export declare function readPlanningContext(access: PlanningContextAccess, input: PlanningContextInput, commitRead?: boolean): {
    contextSha256: string;
    parts: PlanningContextPart[];
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
};
export declare function commitPlanningContextRead(access: PlanningContextAccess, result: {
    contextSha256: string;
    key: string;
    sha256: string;
    offset: number;
    content: string;
}): void;
/** Validate every part first; one ledger frame never credits an unreturned partial batch. */
export declare function commitPlanningContextReads(access: PlanningContextAccess, parts: Array<{
    contextSha256: string;
    key: string;
    sha256: string;
    offset: number;
    content: string;
}>): void;
export declare function planningContextReadIssues(access: PlanningContextAccess): string[];
//# sourceMappingURL=PlanningContextAccess.d.ts.map