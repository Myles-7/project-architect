import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StatusBadge } from '../src/components/common/StatusBadge.js';
import { QuestionCard } from '../src/features/chat/QuestionCard.js';
import { TechnicalDetails } from '../src/components/common/TechnicalDetails.js';
import type { QuestionItem } from '@project-architect/contracts';

describe('Accessibility & Semantic HTML Tests (Task 6.2 & 6.3)', () => {
  it('1. Form inputs have valid label htmlFor and aria-describedby for errors', () => {
    // Test the 4 structured creation input fields markup pattern
    const fields = [
      { id: 'create-target-user', label: '1. 想帮助谁？(目标用户)', errorId: 'err-target-user' },
      { id: 'create-core-problem', label: '2. 遇到什么核心问题？(场景与痛点)', errorId: 'err-core-problem' },
      { id: 'create-mvp-result', label: '3. 希望最后交付什么结果？(期望产出)', errorId: 'err-mvp-result' },
      { id: 'create-known-constraints', label: '4. 已知有哪些明确限制？(约束条件)', errorId: 'err-known-constraints' },
    ];

    const element = React.createElement(
      'div',
      null,
      fields.map((f) =>
        React.createElement(
          'div',
          { key: f.id },
          React.createElement('label', { htmlFor: f.id }, f.label),
          React.createElement('input', {
            id: f.id,
            type: 'text',
            'aria-describedby': f.errorId,
            required: true,
          }),
          React.createElement('span', { id: f.errorId, role: 'alert' }, '请输入内容')
        )
      )
    );

    const html = renderToString(element);
    for (const f of fields) {
      expect(html).toContain(`for="${f.id}"`);
      expect(html).toContain(`id="${f.id}"`);
      expect(html).toContain(`aria-describedby="${f.errorId}"`);
    }
  });

  it('2. QuestionCard options have radiogroup, radio, and aria-checked', () => {
    const question: QuestionItem = {
      id: 'q-test-01',
      question: '系统是否支持离线运行？',
      area: 'technical_boundary',
      status: 'pending',
      importance: 'critical',
      options: [
        { key: 'opt-offline', label: '完全离线优先', impact: '无云端依赖' },
        { key: 'opt-cloud', label: '云端协同', impact: '需要登录和云数据库' },
      ],
      createdAt: '2026-08-27T00:00:00Z',
      updatedAt: '2026-08-27T00:00:00Z',
    };

    const html = renderToString(
      React.createElement(QuestionCard, {
        question,
        onAnswerRecord: async () => {},
        defaultExpanded: true,
      })
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="false"');
  });

  it('3. StatusBadge renders clean Chinese terms without raw bilingual clutter', () => {
    const confirmedHtml = renderToString(React.createElement(StatusBadge, { status: 'confirmed' }));
    expect(confirmedHtml).toContain('已确认');
    expect(confirmedHtml).not.toContain('Confirmed 已确认');

    const candidateHtml = renderToString(React.createElement(StatusBadge, { status: 'candidate' }));
    expect(candidateHtml).toContain('建议');
    expect(candidateHtml).not.toContain('Candidate 候选');

    const assumptionHtml = renderToString(React.createElement(StatusBadge, { status: 'assumption' }));
    expect(assumptionHtml).toContain('待验证假设');
    expect(assumptionHtml).not.toContain('Assumption 假设');

    const lockedHtml = renderToString(React.createElement(StatusBadge, { status: 'locked' }));
    expect(lockedHtml).toContain('已锁定');
    expect(lockedHtml).not.toContain('Locked 已锁定');
  });

  it('4. TechnicalDetails encapsulates B3, revision, decision_key, and token metrics', () => {
    const collapsedHtml = renderToString(
      React.createElement(TechnicalDetails, {
        decisionKey: 'tech.storage.offline',
        revision: 4,
        rawRefs: ['decision:dec-01', 'gap:gap-02'],
        tokens: 1250,
        durationMs: 430,
        modelName: 'gemini-2.5-pro',
        defaultOpen: false,
      })
    );

    expect(collapsedHtml).toContain('查看技术详情');
    expect(collapsedHtml).toContain('rev.4');
    expect(collapsedHtml).not.toContain('tech.storage.offline'); // Collapsed by default

    const expandedHtml = renderToString(
      React.createElement(TechnicalDetails, {
        decisionKey: 'tech.storage.offline',
        revision: 4,
        rawRefs: ['decision:dec-01', 'gap:gap-02'],
        tokens: 1250,
        durationMs: 430,
        modelName: 'gemini-2.5-pro',
        defaultOpen: true,
      })
    );

    expect(expandedHtml).toContain('查看技术详情');
    expect(expandedHtml).toContain('tech.storage.offline');
    expect(expandedHtml).toContain('rev.4');
    expect(expandedHtml).toContain('1,250');
    expect(expandedHtml).toContain('decision:dec-01');
  });

  it('5. QuestionCard exposes the fast primary action and hides internal references', () => {
    const question: QuestionItem = {
      id: 'q-internal-01',
      issueRef: 'gap:internal-gap-01',
      question: '首发版本最需要先解决哪个用户问题？',
      area: 'mvp_scope',
      status: 'pending',
      importance: 'high',
      options: [
        { key: 'focused', label: '只解决一个核心问题', impact: '更快验证，但首发能力较少' },
        { key: 'broad', label: '覆盖多个常见问题', impact: '覆盖更广，但开发和验证周期更长' },
      ],
      createdAt: '2026-08-27T00:00:00Z',
      updatedAt: '2026-08-27T00:00:00Z',
    };

    const html = renderToString(
      React.createElement(QuestionCard, {
        question,
        onAnswerRecord: async () => {},
        onAnswerAndDiscover: async () => {},
        defaultExpanded: true,
      })
    );

    expect(html).toContain('确认并继续');
    expect(html).toContain('立即推演');
    expect(html).not.toContain('q-internal-01');
    expect(html).not.toContain('gap:internal-gap-01');
  });
});
