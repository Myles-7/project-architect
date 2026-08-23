import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage, DecisionPolicyEngine } from '../src/index.js';

describe('Overview Synchronization & Impact Analysis Unit Tests (Phase 3.5)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let policyEngine: DecisionPolicyEngine;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-overview-sync-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    policyEngine = new DecisionPolicyEngine();
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('1. Synchronizes confirmed decision directly to overview sections projection', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'proj-sync-test'),
      name: 'Markdown Editor',
      idea: 'A minimalist markdown editor',
    });

    const { decisionRef, snapshot } = await stateEngine.editOverviewItem(
      projectPath,
      'target_user',
      undefined,
      '目标用户：独立撰稿人与技术博主',
      1
    );

    expect(snapshot.metadata.stateRevision).toBe(2);
    const targetSection = snapshot.overview.sections.find((s) => s.id === 'target_user');
    expect(targetSection?.maturity).toBe('mostly-clear');
    expect(targetSection?.itemRefs).toContain(decisionRef);

    const savedDecision = snapshot.decisions.items.find((d) => d.id === decisionRef.replace('decision:', ''));
    expect(savedDecision?.status).toBe('confirmed');
    expect(savedDecision?.confirmedBy).toBe('user');
  });

  it('2. Detects ripple effect and downstream impact when target user changes from individual to team', () => {
    const impact = policyEngine.detectDecisionImpact(
      'target_user',
      '面向个人独立开发者单机使用',
      '面向跨地域敏捷团队协同开发'
    );

    expect(impact.affectedSections).toContain('core_features');
    expect(impact.affectedSections).toContain('user_flows');
    expect(impact.affectedSections).toContain('technical_boundary');
    expect(impact.warnings.length).toBeGreaterThan(0);
    expect(impact.warnings[0]).toContain('团队/协同');
    expect(impact.tensions.length).toBe(1);
    expect(impact.tensions[0]?.description).toContain('单人扩展为团队协同');
  });

  it('3. Detects security and scope impact when platform changes from local desktop to web/cloud', () => {
    const impact = policyEngine.detectDecisionImpact(
      'technical_boundary',
      '纯本地桌面运行，禁止任何联网通信',
      'Web 浏览器端运行，数据自动云端同步'
    );

    expect(impact.affectedSections).toContain('mvp_scope');
    expect(impact.affectedSections).toContain('trust_safety');
    expect(impact.warnings[0]).toContain('Web/云端');
    expect(impact.tensions[0]?.reason).toContain('云端同步');
  });
});
