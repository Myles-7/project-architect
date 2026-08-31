import { join, dirname } from 'node:path';
import { rename } from 'node:fs/promises';
import type { DiscoveryTurnRecord } from '@project-architect/contracts';
import type { FileStorage } from '../storage/FileStorage.js';

export class DiscoveryTurnStore {
  private readonly writeLocks = new Map<string, Promise<void>>();

  constructor(private readonly storage: FileStorage) {}

  private getFilePath(projectPath: string): string {
    return join(projectPath, 'runtime', 'discovery-turns.json');
  }

  /**
   * Loads all discovery turn records from runtime/discovery-turns.json.
   * Returns empty array if file does not exist.
   */
  async loadTurns(projectPath: string): Promise<DiscoveryTurnRecord[]> {
    const filePath = this.getFilePath(projectPath);
    if (!(await this.storage.exists(filePath))) {
      return [];
    }

    try {
      const data = await this.storage.readJson<{ schemaVersion?: number; turns: DiscoveryTurnRecord[] } | DiscoveryTurnRecord[]>(filePath);
      if (Array.isArray(data)) return data;
      if (!data || !Array.isArray(data.turns)) throw new Error('turns must be an array');
      return data.turns;
    } catch (error: any) {
      throw new Error(`Failed to load discovery turn history at ${filePath}: ${error?.message || error}`);
    }
  }

  /**
   * Atomically writes turns to runtime/discovery-turns.json using a temp file and rename.
   */
  private async persistTurns(projectPath: string, turns: DiscoveryTurnRecord[]): Promise<void> {
    const targetFile = this.getFilePath(projectPath);
    const targetDir = dirname(targetFile);
    await this.storage.ensureDir(targetDir);

    const tempFile = `${targetFile}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    const content = JSON.stringify({ schemaVersion: 1, turns }, null, 2) + '\n';
    await this.storage.writeText(tempFile, content);
    await rename(tempFile, targetFile);
  }

  /**
   * Appends a new turn record to the store.
   */
  async appendTurn(projectPath: string, record: DiscoveryTurnRecord): Promise<void> {
    await this.withWriteLock(projectPath, async () => {
      const turns = await this.loadTurns(projectPath);
      turns.push(record);
      await this.persistTurns(projectPath, turns);
    });
  }

  /**
   * Updates an existing turn record by ID.
   */
  async updateTurn(
    projectPath: string,
    turnId: string,
    patch: Partial<DiscoveryTurnRecord>
  ): Promise<DiscoveryTurnRecord> {
    return this.withWriteLock(projectPath, async () => {
      const turns = await this.loadTurns(projectPath);
      const index = turns.findIndex((t) => t.id === turnId);
      if (index === -1) throw new Error(`Discovery turn with id "${turnId}" not found in project.`);

      const existing = turns[index]!;
      const updated: DiscoveryTurnRecord = {
        ...existing,
        ...patch,
        id: existing.id,
        projectId: existing.projectId,
      };
      turns[index] = updated;
      await this.persistTurns(projectPath, turns);
      return updated;
    });
  }

  /**
   * Gets the most recent turn record, or null if none exist.
   */
  async getLatestTurn(projectPath: string): Promise<DiscoveryTurnRecord | null> {
    const turns = await this.loadTurns(projectPath);
    if (turns.length === 0) return null;
    return turns[turns.length - 1] ?? null;
  }

  private async withWriteLock<T>(projectPath: string, action: () => Promise<T>): Promise<T> {
    const lockKey = this.getFilePath(projectPath);
    const previous = this.writeLocks.get(lockKey) || Promise.resolve();
    const operation = previous.catch(() => undefined).then(action);
    const settled = operation.then(() => undefined, () => undefined);
    this.writeLocks.set(lockKey, settled);
    try {
      return await operation;
    } finally {
      if (this.writeLocks.get(lockKey) === settled) this.writeLocks.delete(lockKey);
    }
  }
}
