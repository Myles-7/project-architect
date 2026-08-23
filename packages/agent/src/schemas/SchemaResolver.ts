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
   * In B2.1, b2-unified.schema.json is the sole authoritative Single Source of Truth.
   * All agent modes strictly conform to this unified contract without schema drift.
   */
  async resolveSchemaPath(_mode?: AgentMode): Promise<string> {
    return join(
      this.rootDir,
      'experiments',
      'agent-benchmark',
      'schemas',
      'b2-unified.schema.json'
    );
  }
}
