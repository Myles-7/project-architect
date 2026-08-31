import { describe, it, expect } from 'vitest';
import { QuestionBatchPolicy } from '@project-architect/core';
import { evaluateB3Quality } from '../../experiments/agent-benchmark/src/b3-quality-evaluator.mjs';
import { getStageFixture } from '../../experiments/agent-benchmark/src/b3-stage-fixtures.mjs';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('B3 Multi-Stage Contract & Quality Gate Tests (Phase 7)', () => {
  const batchPolicy = new QuestionBatchPolicy();

  it('1. Enforces stage question budgets: initial (12), explore (8), converge (4), readiness (2)', () => {
    expect(batchPolicy.getBudgetForStage('initial')).toEqual({ targetMin: 8, maxQuestions: 12 });
    expect(batchPolicy.getBudgetForStage('explore')).toEqual({ targetMin: 5, maxQuestions: 8 });
    expect(batchPolicy.getBudgetForStage('converge')).toEqual({ targetMin: 2, maxQuestions: 4 });
    expect(batchPolicy.getBudgetForStage('readiness')).toEqual({ targetMin: 0, maxQuestions: 2 });
  });

  it('2. Evaluator catches budget overages for each stage', () => {
    // Construct 3 questions for readiness stage (max allowed is 2)
    const mockReadinessOverBudget: DiscoveryResult = {
      confirmed: [],
      candidates: [],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [
        {
          decision_key: 'chk-01',
          depends_on: [],
          importance: 'critical',
          question: '是否确认离线存储规范？',
          reason: '决定本地部署方案与交付边界',
          recommendation: '采用纯本地 JSON 存储',
          recommendation_reason: '保证零外部数据库依赖',
          recommended_option_key: 'opt-a',
          options: [{ key: 'opt-a', label: '确认纯本地存储', impact: '保证隐私与零外部依赖' }],
          allow_free_input: false,
        },
        {
          decision_key: 'chk-02',
          depends_on: [],
          importance: 'important',
          question: '是否设置最大文件体积门槛？',
          reason: '防止大文件导致内存溢出',
          recommendation: '设置 20MB 上限',
          recommendation_reason: '平衡易用性与内存安全',
          recommended_option_key: 'opt-a',
          options: [{ key: 'opt-a', label: '限制 20MB', impact: '保护本地内存与稳定性' }],
          allow_free_input: false,
        },
        {
          decision_key: 'chk-03',
          depends_on: [],
          importance: 'nice-to-have',
          question: '是否支持深色模式主题？',
          reason: '改善夜间桌面端阅读体验',
          recommendation: '支持系统自动跟随',
          recommendation_reason: '降低开发复杂度',
          recommended_option_key: 'opt-a',
          options: [{ key: 'opt-a', label: '跟随系统', impact: '减少额外开发与维护成本' }],
          allow_free_input: false,
        },
      ],
    };

    const evaluation = evaluateB3Quality(mockReadinessOverBudget, { stage: 'readiness' });
    expect(evaluation.is_valid_contract).toBe(false);
    expect(evaluation.violations.some((v: string) => v.includes('question budget exceeded'))).toBe(true);
  });

  it('3. Evaluator validates recommended_option_key existence in options', () => {
    const mockMismatchedOptionKey: DiscoveryResult = {
      confirmed: [],
      candidates: [],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [
        {
          decision_key: 'tech.storage',
          depends_on: [],
          importance: 'critical',
          question: '本地文件持久化采用何种格式？',
          reason: '决定数据读写效率与状态重放机制',
          recommendation: '推荐采用纯 JSON 存储',
          recommendation_reason: '结构透明且易于版本审计',
          recommended_option_key: 'non-existent-key', // Does not match options below
          options: [
            { key: 'json-atomic', label: '纯 JSON 原子写入', impact: '保证离线透明度与原子性' },
            { key: 'sqlite-embedded', label: '嵌入式 SQLite', impact: '提高查询性能但增加依赖' },
          ],
          allow_free_input: false,
        },
      ],
    };

    const evaluation = evaluateB3Quality(mockMismatchedOptionKey, { stage: 'initial' });
    expect(evaluation.is_valid_contract).toBe(false);
    expect(evaluation.invalid_recommended_option_keys).toBe(1);
    expect(evaluation.violations.some((v: string) => v.includes('recommended_option_key not found'))).toBe(true);
  });

  it('4. Evaluator detects duplicate decision_key and intra-batch dependency conflicts', () => {
    const mockDependencyConflict: DiscoveryResult = {
      confirmed: [],
      candidates: [],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [
        {
          decision_key: 'arch.platform',
          depends_on: [],
          importance: 'critical',
          question: '选择何种桌面端容器？',
          reason: '决定核心分发方式',
          recommendation: '采用 Tauri 架构',
          recommendation_reason: '包体积小且安全性高',
          recommended_option_key: 'tauri',
          options: [{ key: 'tauri', label: 'Tauri + Rust', impact: '大幅降低内存与包体积' }],
          allow_free_input: false,
        },
        {
          decision_key: 'arch.frontend-framework',
          depends_on: ['arch.platform'], // Depends on question in same batch!
          importance: 'important',
          question: '前端选择何种 UI 框架？',
          reason: '基于平台选择对应组件库',
          recommendation: '采用 React + Vite',
          recommendation_reason: '生态完备且渲染敏捷',
          recommended_option_key: 'react',
          options: [{ key: 'react', label: 'React 19', impact: '开发效率高' }],
          allow_free_input: false,
        },
      ],
    };

    const evaluation = evaluateB3Quality(mockDependencyConflict, { stage: 'initial' });
    expect(evaluation.is_valid_contract).toBe(false);
    expect(evaluation.intra_batch_dependency_conflicts).toBe(1);
    expect(evaluation.violations.some((v: string) => v.includes('Intra-batch dependency conflicts'))).toBe(true);
  });

  it('5. Evaluator validates high quality valid B3 response across 4 stages', () => {
    const validConvergeResult: DiscoveryResult = {
      confirmed: ['第一版仅支持扫描并清理指定本地驱动器的大文件与缓存文件'],
      candidates: [{ statement: '采用分块并发扫描', confidence: 'high' }],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [
        {
          decision_key: 'scan.concurrency',
          depends_on: [],
          importance: 'critical',
          question: '扫描核心线程数与资源上限如何设定？',
          reason: '避免占用全部 CPU 影响用户正常前台操作',
          recommendation: '默认限制使用不超过 50% 逻辑核心数',
          recommendation_reason: '平衡扫描速度与系统前台响应流畅度',
          recommended_option_key: 'opt-half-cores',
          options: [
            { key: 'opt-half-cores', label: '限制 50% 核心数', impact: '保证扫描速度同时不卡顿前台系统操作' },
            { key: 'opt-full-speed', label: '全速并行扫描', impact: '极速完成扫描但短时间内占用高 CPU 资源' },
          ],
          allow_free_input: true,
        },
        {
          decision_key: 'scan.long-path',
          depends_on: [],
          importance: 'important',
          question: '遇到 Windows 超长路径（>260字符）如何处理？',
          reason: 'Windows 经典 API 默认对长路径截断引发异常',
          recommendation: '启用 UNC 扩展长路径前缀',
          recommendation_reason: '完整覆盖全部深层文件且不报错',
          recommended_option_key: 'opt-unc-prefix',
          options: [
            { key: 'opt-unc-prefix', label: '启用 UNC 路径处理', impact: '彻底解决长路径崩溃风险' },
            { key: 'opt-skip-warning', label: '记录警告并跳过', impact: '避免引入复杂前缀但可能遗漏深层大文件' },
          ],
          allow_free_input: false,
        },
      ],
    };

    const fixture = getStageFixture('case-01', 'converge');
    const evaluation = evaluateB3Quality(validConvergeResult, {
      stage: 'converge',
      lockedStatements: fixture?.lockedDecisions.map((d) => d.statement) || [],
      manualReviews: [
        { reviewer: 'reviewer-a', evidence: 'review://a', relevance: 4, decisionValue: 4, independentAnswerability: 4, clarity: 4, impactUsefulness: 4 },
        { reviewer: 'reviewer-b', evidence: 'review://b', relevance: 4, decisionValue: 4, independentAnswerability: 4, clarity: 4, impactUsefulness: 4 },
      ],
    });

    expect(evaluation.is_valid_contract).toBe(true);
    expect(evaluation.violations).toEqual([]);
    expect(evaluation.question_count).toBe(2);
    expect(evaluation.invalid_recommended_option_keys).toBe(0);
    expect(evaluation.manual_reviews[0].relevance).toBeGreaterThanOrEqual(4);
    expect(evaluation.manual_reviews[1].decisionValue).toBeGreaterThanOrEqual(4);
  });
});
