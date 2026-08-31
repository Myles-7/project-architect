import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { FileStorage } from '../src/storage/FileStorage.js';
import { DiscoveryTurnStore } from '../src/discovery/DiscoveryTurnStore.js';
import type { DiscoveryTurnRecord } from '@project-architect/contracts';

describe('DiscoveryTurnStore Unit Tests (Phase 2)', () => {
  let store: DiscoveryTurnStore;
  let storage: FileStorage;
  let testProjectDir: string;

  beforeEach(async () => {
    storage = new FileStorage();
    store = new DiscoveryTurnStore(storage);
    testProjectDir = join(
      tmpdir(),
      `pa-turn-store-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    );
    await storage.ensureDir(testProjectDir);
  });

  afterEach(async () => {
    await rm(testProjectDir, { recursive: true, force: true }).catch(() => {});
  });

  it('1. Appends a new turn and persists to runtime/discovery-turns.json atomically', async () => {
    const record: DiscoveryTurnRecord = {
      id: 'turn-01',
      projectId: 'proj-test',
      inputRef: 'input:inp-01',
      sourceRevision: 1,
      status: 'recorded',
      createdAt: new Date().toISOString(),
      acceptedRefs: [],
      discardedCounts: {},
    };

    await store.appendTurn(testProjectDir, record);

    const turnsFile = join(testProjectDir, 'runtime', 'discovery-turns.json');
    expect(await storage.exists(turnsFile)).toBe(true);

    const loaded = await store.loadTurns(testProjectDir);
    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe('turn-01');
    expect(loaded[0].status).toBe('recorded');
    expect(loaded[0].inputRef).toBe('input:inp-01');
    expect(loaded[0].sourceRevision).toBe(1);
  });

  it('2. Updates an existing turn status and completes execution with results and diagnostics', async () => {
    const record: DiscoveryTurnRecord = {
      id: 'turn-02',
      projectId: 'proj-test',
      inputRef: 'input:inp-02',
      sourceRevision: 2,
      status: 'queued',
      createdAt: new Date().toISOString(),
      acceptedRefs: [],
      discardedCounts: {},
    };

    await store.appendTurn(testProjectDir, record);

    await store.updateTurn(testProjectDir, 'turn-02', {
      status: 'completed',
      completedAt: new Date().toISOString(),
      acceptedRefs: ['decision:cand-01', 'assumption:asm-01'],
      discardedCounts: { duplicateStatements: 1 },
      diagnostics: { durationMs: 1200, totalTokens: 850 },
    });

    const loaded = await store.loadTurns(testProjectDir);
    expect(loaded.length).toBe(1);
    expect(loaded[0].status).toBe('completed');
    expect(loaded[0].acceptedRefs).toEqual(['decision:cand-01', 'assumption:asm-01']);
    expect(loaded[0].discardedCounts).toEqual({ duplicateStatements: 1 });
    expect(loaded[0].diagnostics?.totalTokens).toBe(850);
  });

  it('3. Preserves turn history in chronological order and returns latest turn', async () => {
    await store.appendTurn(testProjectDir, {
      id: 'turn-1',
      projectId: 'proj-test',
      sourceRevision: 1,
      status: 'completed',
      createdAt: new Date(Date.now() - 2000).toISOString(),
      acceptedRefs: [],
      discardedCounts: {},
    });

    await store.appendTurn(testProjectDir, {
      id: 'turn-2',
      projectId: 'proj-test',
      sourceRevision: 2,
      status: 'recorded',
      createdAt: new Date().toISOString(),
      acceptedRefs: [],
      discardedCounts: {},
    });

    const latest = await store.getLatestTurn(testProjectDir);
    expect(latest?.id).toBe('turn-2');
    expect(latest?.sourceRevision).toBe(2);

    const all = await store.loadTurns(testProjectDir);
    expect(all.map((t) => t.id)).toEqual(['turn-1', 'turn-2']);
  });

  it('4. Returns empty array if runtime/discovery-turns.json does not exist yet', async () => {
    const turns = await store.loadTurns(testProjectDir);
    expect(turns).toEqual([]);
    const latest = await store.getLatestTurn(testProjectDir);
    expect(latest).toBeNull();
  });

  it('5. Surfaces corrupted turn history instead of silently replacing it with an empty log', async () => {
    const turnsFile = join(testProjectDir, 'runtime', 'discovery-turns.json');
    await storage.writeText(turnsFile, '{ invalid-json');

    await expect(store.loadTurns(testProjectDir)).rejects.toThrow(/discovery turn history|JSON/i);
  });

  it('6. Serializes concurrent appends without losing either turn', async () => {
    const makeTurn = (id: string): DiscoveryTurnRecord => ({
      id, projectId: 'proj-test', sourceRevision: 1, status: 'recorded',
      createdAt: new Date().toISOString(), acceptedRefs: [], discardedCounts: {},
    });

    await Promise.all([
      store.appendTurn(testProjectDir, makeTurn('turn-concurrent-a')),
      store.appendTurn(testProjectDir, makeTurn('turn-concurrent-b')),
    ]);

    const turns = await store.loadTurns(testProjectDir);
    expect(turns.map((turn) => turn.id).sort()).toEqual(['turn-concurrent-a', 'turn-concurrent-b']);
  });
});
