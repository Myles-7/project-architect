import { join } from 'node:path';
import { FileStorage } from '@project-architect/core';
import type { AgentMode } from '@project-architect/contracts';

export class SchemaResolver {
  private rootDir: string;

  constructor(rootDir: string = process.cwd(), _storage: FileStorage = new FileStorage()) {
    this.rootDir = rootDir;
  }

  /**
   * Resolves the absolute path to the JSON Schema.
   * B3 discovery schema is the sole active runtime contract.
   * All agent modes strictly conform to this unified contract without schema drift.
   */
  async resolveSchemaPath(_mode?: AgentMode): Promise<string> {
    return join(
      this.rootDir,
      'experiments',
      'agent-benchmark',
      'schemas',
      'b3-discovery.schema.json'
    );
  }
}
