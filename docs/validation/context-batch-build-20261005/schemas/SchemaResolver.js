import { join } from 'node:path';
import { FileStorage } from '@project-architect/core';
export const CANONICAL_B3_SCHEMA_REL_PATH = 'experiments/agent-benchmark/schemas/b3-discovery.schema.json';
export class SchemaResolver {
    rootDir;
    constructor(rootDir = process.cwd(), _storage = new FileStorage()) {
        this.rootDir = rootDir;
    }
    /**
     * Resolves the absolute path to the JSON Schema.
     * B3 discovery schema is the sole active runtime contract.
     * All agent modes strictly conform to this unified contract without schema drift.
     */
    async resolveSchemaPath(_mode) {
        return join(this.rootDir, 'experiments', 'agent-benchmark', 'schemas', 'b3-discovery.schema.json');
    }
}
//# sourceMappingURL=SchemaResolver.js.map