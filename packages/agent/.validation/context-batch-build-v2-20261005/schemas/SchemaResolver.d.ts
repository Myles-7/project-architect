import { FileStorage } from '@project-architect/core';
import type { AgentMode } from '@project-architect/contracts';
export declare const CANONICAL_B3_SCHEMA_REL_PATH = "experiments/agent-benchmark/schemas/b3-discovery.schema.json";
export declare class SchemaResolver {
    private rootDir;
    constructor(rootDir?: string, _storage?: FileStorage);
    /**
     * Resolves the absolute path to the JSON Schema.
     * B3 discovery schema is the sole active runtime contract.
     * All agent modes strictly conform to this unified contract without schema drift.
     */
    resolveSchemaPath(_mode?: AgentMode): Promise<string>;
}
//# sourceMappingURL=SchemaResolver.d.ts.map