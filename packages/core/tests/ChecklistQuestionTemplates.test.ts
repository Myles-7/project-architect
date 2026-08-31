import { describe, it, expect } from 'vitest';
import {
  getChecklistTemplate,
} from '../src/questions/ChecklistQuestionTemplates.js';
import { QuestionComposer } from '../src/questions/QuestionComposer.js';
import type { GapItem } from '@project-architect/contracts';

describe('ChecklistQuestionTemplates', () => {
  const sampleGap: GapItem = {
    id: 'gap-01',
    area: 'technical_boundary',
    severity: 'critical',
    reason: '运行平台选型未明确',
    impact: '影响架构与依赖',
    status: 'open',
    shouldAskUser: true,
  };

  const requiredKeys = [
    'chk-localfirst-ownership',
    'univ-mvp-boundary',
    'univ-primary-flow',
    'univ-platform-choice',
    'univ-success-signal',
  ];

  it('provides concrete templates for all 5 core required checklist keys', () => {
    for (const key of requiredKeys) {
      const template = getChecklistTemplate(key);
      expect(template, `Template for ${key} must exist`).toBeDefined();
      expect(template!.options.length).toBeGreaterThanOrEqual(2);
      expect(template!.options.length).toBeLessThanOrEqual(4);

      const qText = template!.question(sampleGap);
      const rText = template!.reason(sampleGap);
      expect(qText.length).toBeGreaterThan(5);
      expect(rText.length).toBeGreaterThan(5);
      expect(qText).not.toEqual(rText);

      // Verify recommendedOptionKey points to an existing option
      expect(template!.recommendedOptionKey).toBeDefined();
      const optionKeys = template!.options.map((o) => o.key);
      expect(optionKeys).toContain(template!.recommendedOptionKey);

      // Verify uniqueness of option keys
      const uniqueKeys = new Set(optionKeys);
      expect(uniqueKeys.size).toBe(optionKeys.length);

      // Verify impact and reversibility for each option
      for (const opt of template!.options) {
        expect(opt.key.length).toBeGreaterThan(0);
        expect(opt.label.length).toBeGreaterThan(0);
        expect(opt.impact.length).toBeGreaterThan(10);
        expect(['easy', 'moderate', 'hard']).toContain(opt.reversibility);
      }
    }
  });

  it('normalizes checklist keys with or without prefix', () => {
    const t1 = getChecklistTemplate('univ-platform-choice');
    const t2 = getChecklistTemplate('chk-univ-platform-choice');
    const t3 = getChecklistTemplate('checklist:chk-univ-platform-choice');
    const t4 = getChecklistTemplate('checklist:univ-platform-choice');

    expect(t1).toBeDefined();
    expect(t2).toBe(t1);
    expect(t3).toBe(t1);
    expect(t4).toBe(t1);
  });

  it('returns undefined for unknown checklist key and QuestionComposer generates free-input fallback', () => {
    const unknownKey = 'unknown-custom-checklist-key-xyz';
    expect(getChecklistTemplate(unknownKey)).toBeUndefined();

    const composer = new QuestionComposer();
    const unknownGap: GapItem = {
      id: 'gap-unknown',
      area: 'technical_boundary',
      severity: 'high',
      decisionKey: unknownKey,
      reason: '未知的领域特性未定义',
      impact: '需要用户说明',
      status: 'open',
      shouldAskUser: true,
    };

    const question = composer.compose(unknownGap);
    expect(question.allowFreeInput).toBe(true);
    // Must NOT contain the old generic options: '首发版本先采用边界清晰的方案'
    expect(question.options.length).toBe(0);
    expect(question.decisionKey).toBe(unknownKey);
  });

  it('platform choice question provides Windows, Web, Cross-platform choices rather than generic boundary labels', () => {
    const template = getChecklistTemplate('univ-platform-choice')!;
    const optLabels = template.options.map((o) => o.label);
    expect(optLabels.some((l) => l.includes('Windows'))).toBe(true);
    expect(optLabels.some((l) => l.includes('Web'))).toBe(true);
    expect(optLabels.some((l) => l.includes('边界清晰'))).toBe(false);
  });

  it('data ownership question provides plain files vs app format choices', () => {
    const template = getChecklistTemplate('chk-localfirst-ownership')!;
    const optLabels = template.options.map((o) => o.label);
    expect(optLabels.some((l) => l.includes('文件') || l.includes('Markdown'))).toBe(true);
    expect(optLabels.some((l) => l.includes('应用管理') || l.includes('数据库'))).toBe(true);
  });
});
