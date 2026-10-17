import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { ProjectStateEngine } from '../src/engine/ProjectStateEngine.js';
import { AreaRegistry } from '../src/areas/AreaRegistry.js';
import { QuestionComposer } from '../src/questions/QuestionComposer.js';
import { CANONICAL_B3_SCHEMA_REL_PATH } from '@project-architect/agent';
import type { DiscoveryResult, GapItem, QuestionImportance } from '@project-architect/contracts';

describe('Phase 0 Remediation & Integrity Verification Suite', () => {
  let tempDir: string;
  let engine: ProjectStateEngine;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pa-p0-test-'));
    engine = new ProjectStateEngine();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  // 1. Idempotency via clientTurnId
  it('[UX-Fix / Solution 4] Idempotent input recording via clientTurnId prevents duplicate writes and revision bumps', async () => {
    const { snapshot: s0 } = await engine.createProject({
      name: 'Idempotency Test Project',
      idea: 'Testing clientTurnId deduplication',
      projectPath: tempDir,
    });

    const clientTurnId = 'client-turn-uuid-12345';
    const text = 'User stated that they need offline local search.';

    // First recording
    const rec1 = await engine.recordDiscoveryInput(tempDir, text, s0.metadata.stateRevision, clientTurnId);
    expect(rec1.snapshot.metadata.stateRevision).toBe(s0.metadata.stateRevision + 1);
    expect(rec1.snapshot.metadata.inputRefs).toHaveLength(2); // inp-01 (initial) + inp-02
    const ref1 = rec1.snapshot.metadata.inputRefs.find((r) => r.clientTurnId === clientTurnId);
    expect(ref1).toBeDefined();

    // Second recording with identical clientTurnId (simulating network retry after dropped connection)
    const rec2 = await engine.recordDiscoveryInput(
      tempDir,
      text,
      rec1.snapshot.metadata.stateRevision,
      clientTurnId
    );

    // State revision must NOT increment again, and inputRefs must NOT contain a duplicate
    expect(rec2.snapshot.metadata.stateRevision).toBe(rec1.snapshot.metadata.stateRevision);
    expect(rec2.snapshot.metadata.inputRefs).toHaveLength(2);
    expect(rec2.inputRef).toBe(rec1.inputRef);
    expect(rec2.turnId).toBe(rec1.turnId);
  });

  // 2. AreaRegistry Aliases
  it('[Core-Fix / Solution 12] AreaRegistry resolves technical and delivery aliases accurately', () => {
    expect(AreaRegistry.normalize('tech_stack')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('architecture')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('database')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('storage')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('runtime')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('infrastructure')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('backend')).toBe('technical_boundary');
    expect(AreaRegistry.normalize('api_design')).toBe('technical_boundary');

    expect(AreaRegistry.normalize('timeline')).toBe('delivery_plan');
    expect(AreaRegistry.normalize('roadmap')).toBe('delivery_plan');
    expect(AreaRegistry.normalize('phases')).toBe('delivery_plan');
  });

  // 3. QuestionComposer Neutral Copy
  it('[Core-Copy / Solution 16] QuestionComposer produces domain-neutral architecture copy without dating/couple room bias', () => {
    const composer = new QuestionComposer();

    const techGap: GapItem = {
      id: 'gap-tech-test',
      area: 'technical_boundary',
      decisionKey: 'technical_boundary:storage_engine',
      severity: 'medium',
      reason: '本地存储引擎未选型',
      impact: '影响数据持久化方案',
      status: 'open',
    };
    const techQuestion = composer.compose(techGap);
    expect(techQuestion.recommendation).not.toContain('情侣');
    expect(techQuestion.recommendation).not.toContain('恋爱');
    expect(techQuestion.recommendation).toContain('存储');

    const targetUserGap: GapItem = {
      id: 'gap-user-test',
      area: 'target_user',
      decisionKey: 'target_user:persona',
      severity: 'high',
      reason: '目标用户群体未细化',
      impact: '影响功能范围边界',
      status: 'open',
    };
    const userQuestion = composer.compose(targetUserGap);
    expect(userQuestion.recommendation).not.toContain('情侣');
    expect(userQuestion.recommendation).toContain('目标用户');
  });

  // 4. Schema Isolation
  it('[Arch-Fix / Solution 14] Legacy B2 schemas isolated from agent schemas; only canonical B3 schema used', async () => {
    const agentSchemasDir = join(process.cwd(), 'packages', 'agent', 'src', 'schemas');
    const files = await readdir(agentSchemasDir);
    const jsonSchemas = files.filter((f) => f.endsWith('.schema.json'));

    // Zero legacy schemas in packages/agent/src/schemas
    expect(jsonSchemas).toEqual([]);

    // The single canonical runtime schema exists and is exported
    expect(CANONICAL_B3_SCHEMA_REL_PATH).toContain('b3-discovery.schema.json');
    expect(existsSync(join(process.cwd(), CANONICAL_B3_SCHEMA_REL_PATH))).toBe(true);

    // Legacy schemas must exist in benchmark archive
    const legacySchemasDir = join(process.cwd(), 'experiments', 'agent-benchmark', 'schemas', 'legacy-b2');
    expect(existsSync(legacySchemasDir)).toBe(true);
    const legacyFiles = await readdir(legacySchemasDir);
    expect(legacyFiles.length).toBe(6);
    expect(legacyFiles).toContain('decision-review.schema.json');
    expect(legacyFiles).toContain('question-generation.schema.json');
    expect(legacyFiles).toContain('gap-analysis.schema.json');
  });

  // 5. Raw Question Gating & Budget Enforcement
  it('[Core-Fix / Solution 15] Gated applyDiscoveryTurn enforces stage budget and drops circular dependencies', async () => {
    const { snapshot: s0 } = await engine.createProject({
      name: 'Budget Enforcement Project',
      idea: 'Testing stage budget limits and cycle detection',
      projectPath: tempDir,
    });

    // Create 15 questions with circular dependency between q-1 and q-2
    const rawQuestions = Array.from({ length: 15 }, (_, i) => {
      const id = `q-batch-test-${i + 1}`;
      const decisionKey = `technical_boundary:subsystem_${i + 1}`;
      const deps = i === 0 ? ['technical_boundary:subsystem_2'] : i === 1 ? ['technical_boundary:subsystem_1'] : [];
      return {
        id,
        decision_key: decisionKey,
        depends_on: deps,
        importance: 'high' as QuestionImportance,
        question: `约束第 ${i + 1} 个子系统方案？`,
        reason: `确定第 ${i + 1} 个子系统规范`,
        recommendation: `采用方案 ${i + 1}`,
        recommendation_reason: `方案 ${i + 1} 稳定性最佳`,
        recommended_option_key: `opt_${i + 1}_a`,
        options: [
          { key: `opt_${i + 1}_a`, label: `方案 ${i + 1} A`, impact: '高性能本地实现' },
          { key: `opt_${i + 1}_b`, label: `方案 ${i + 1} B`, impact: '简化运维' },
        ],
        area: 'technical_boundary',
      };
    });

    const result: DiscoveryResult = {
      confirmed: [],
      candidates: [],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: rawQuestions as any,
    };

    const updated = await engine.applyDiscoveryTurn(tempDir, result, s0.metadata.stateRevision);

    // 1. Initial stage maxQuestions is 12. Even though 15 were sent, admitted questions must not exceed 12.
    expect(updated.questions.items.length).toBeLessThanOrEqual(12);

    // 2. Circular dependency between subsystem_1 and subsystem_2 must be caught and excluded
    const keys = updated.questions.items.map((q) => q.decisionKey);
    expect(keys).not.toContain('technical_boundary:subsystem_1');
    expect(keys).not.toContain('technical_boundary:subsystem_2');

    // 3. Every admitted question must have batchId, batchStage, and valid issueRef pointing to a GapItem (not 'gap:general')
    for (const q of updated.questions.items) {
      expect(q.batchId).toBeDefined();
      expect(q.batchStage).toBe('initial');
      expect(q.issueRef).not.toBe('gap:general');
      expect(q.issueRef.startsWith('gap:')).toBe(true);
    }
  });

  // 6. Ghost Tailwind Classes Verification
  it('[UI-Fix / Solution 1] No ghost Tailwind classes (py-0.2, py-0.8, zinc-850, backdrop-blur-xs) exist in apps/web', () => {
    const webSrcDir = join(process.cwd(), 'apps', 'web', 'src');

    function scanFiles(dir: string, matches: string[] = []): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanFiles(fullPath, matches);
        } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
          const content = readFileSync(fullPath, 'utf-8');
          if (/(py-0\.2|py-0\.8|zinc-850|backdrop-blur-xs)/.test(content)) {
            matches.push(fullPath);
          }
        }
      }
      return matches;
    }

    const { readdirSync } = require('node:fs');
    const taintedFiles = scanFiles(webSrcDir);
    expect(taintedFiles).toEqual([]);
  });
});
