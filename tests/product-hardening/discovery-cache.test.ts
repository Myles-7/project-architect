import { describe, it, expect } from 'vitest';
import { QuestionContext } from '../../packages/agent/src/context/profiles/QuestionContext.js';
import { AntigravityCliProvider } from '../../packages/agent/src/provider/AntigravityCliProvider.js';
import type { ProjectSnapshot } from '@project-architect/contracts';

describe('Discovery Context & Prompt Cache Hardening (Phase 7)', () => {
  const createMockSnapshot = (revision: number = 1): ProjectSnapshot => ({
    metadata: {
      projectId: 'proj-cache-test',
      name: 'Cache Test Project',
      stage: 'initial',
      projectTags: ['local-first', 'windows'],
      stateRevision: revision,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inputRefs: [],
    },
    decisions: {
      schemaVersion: '1.0.0',
      items: [
        {
          id: 'dec-01',
          decisionKey: 'storage.format',
          area: 'data-storage',
          statement: '采用纯本地 JSON 文件存储所有项目架构数据，零外部数据库依赖。',
          status: 'locked',
          source: 'user_direct',
          confidence: 'high',
          evidenceRefs: [],
          revision: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'dec-02',
          decisionKey: 'platform.gui',
          area: 'platform-os',
          statement: '使用 React + Vite 构建本地客户端 Web 界面。',
          status: 'confirmed',
          source: 'user_direct',
          confidence: 'high',
          evidenceRefs: [],
          revision: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    assumptions: { schemaVersion: '1.0.0', items: [] },
    gaps: {
      schemaVersion: '1.0.0',
      gaps: [
        {
          id: 'gap-01',
          decisionKey: 'security.isolation',
          area: 'data-privacy',
          severity: 'critical',
          reason: '需明确完全离线与网络阻断机制',
          impact: '决定本地运行安全性',
          status: 'open',
          detectedAtRevision: 1,
          shouldAskUser: true,
        },
      ],
      conflicts: [],
    },
    questions: {
      schemaVersion: '1.0.0',
      items: [
        {
          id: 'q-01',
          decisionKey: 'storage.format',
          batchId: 'batch-01',
          batchStage: 'initial',
          importance: 'critical',
          question: '本地文件持久化采用何种格式？',
          reason: '决定数据读写效率',
          recommendation: '采用纯本地 JSON 文件存储',
          recommendationReason: '结构透明',
          recommendedOptionKey: 'opt-json',
          options: [{ key: 'opt-json', label: '纯 JSON', impact: '高可审计' }],
          allowFreeInput: false,
          status: 'answered',
          answer: '采用纯本地 JSON 文件存储',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    documents: { schemaVersion: '1.0.0', items: [] },
  });

  it('1. QuestionContext produces stable structured context within 12,000 characters budget', () => {
    const profile = new QuestionContext();
    const snapshot = createMockSnapshot(2);

    const context = profile.build(snapshot, {
      userMessage: '希望增加批量导出文档为 ZIP 功能',
    });

    expect(context.length).toBeLessThanOrEqual(12_000);
    expect(context).toContain('Project Context (Mode: Question Generation)');
    expect(context).toContain('Relevant Confirmed & Locked Decisions');
    expect(context).toContain('Already Resolved Decision Keys');
    expect(context).toContain('storage.format');
    expect(context).toContain('Prioritized Gaps Requiring Questioning');
    expect(context).toContain('B3 Question Constraints');
  });

  it('2. AntigravityCliProvider truthfully reports prompt cache as unknown initially, not fake supported', async () => {
    const provider = new AntigravityCliProvider('non-existent-executable.exe');
    const health = await provider.healthCheck();

    expect(health.promptCache).toBe('unknown');
    expect(health.status).toBe('unavailable');
  });

  it('3. QuestionContext includes already resolved keys to prevent duplicate questions', () => {
    const profile = new QuestionContext();
    const snapshot = createMockSnapshot(2);

    const context = profile.build(snapshot, {
      userMessage: '继续推进开发规划',
    });

    expect(context).toContain('Already Resolved Decision Keys (Do Not Re-ask)');
    expect(context).toContain('- storage.format');
  });
});
