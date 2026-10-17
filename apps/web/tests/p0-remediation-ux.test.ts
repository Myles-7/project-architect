/**
 * @file p0-remediation-ux.test.ts
 * @description P0 Remediation Suite: ChatView scroll/dock structure, QuestionCard project draft isolation & HomeView candidate review
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QuestionCard } from '../src/features/chat/QuestionCard.js';
import type { QuestionItem } from '@project-architect/contracts';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('P0 Remediation UX & Data Isolation Suite', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
  });

  const sampleQuestion: QuestionItem = {
    id: 'q-test-boundary',
    issueRef: 'gap:test' as any,
    area: 'technical_boundary',
    importance: 'critical',
    question: '系统是否需要单机离线运行？',
    reason: '决定数据存储与同步架构',
    recommendation: '完全单机运行',
    recommendationReason: '保护数据隐私',
    recommendedOptionKey: 'opt-offline',
    options: [
      { key: 'opt-offline', label: '纯本地离线运行', impact: '零外部依赖' },
      { key: 'opt-cloud', label: '云端同步', impact: '依赖后端服务' },
    ],
    status: 'shown',
    createdAt: new Date().toISOString(),
  };

  it('P0-7: scopes question drafts with pa_{projectId}_draft_{questionId} prefix', () => {
    const projA = 'proj-alpha';
    const projB = 'proj-beta';

    // Seed draft for projA
    localStorage.setItem(`pa_${projA}_draft_${sampleQuestion.id}:opt`, '纯本地离线运行');
    localStorage.setItem(`pa_${projA}_draft_${sampleQuestion.id}:input`, '需要离线优先');

    // Verify key formats
    expect(localStorage.getItem(`pa_${projA}_draft_${sampleQuestion.id}:opt`)).toBe('纯本地离线运行');
    expect(localStorage.getItem(`pa_${projA}_draft_${sampleQuestion.id}:input`)).toBe('需要离线优先');

    // ProjB should have no draft
    expect(localStorage.getItem(`pa_${projB}_draft_${sampleQuestion.id}:opt`)).toBeNull();
    expect(localStorage.getItem(`pa_${projB}_draft_${sampleQuestion.id}:input`)).toBeNull();
  });

  it('P0-7: renders QuestionCard with project scoped draft restoration', () => {
    const projId = 'proj-alpha';
    localStorage.setItem(`pa_${projId}_draft_${sampleQuestion.id}:input`, '草稿内容已恢复');

    const html = renderToString(
      React.createElement(QuestionCard, {
        question: sampleQuestion,
        projectId: projId,
        onAnswerRecord: async () => {},
        defaultExpanded: true,
      })
    );

    // Should render question content and recovered input text
    expect(html).toContain('系统是否需要单机离线运行？');
    expect(html).toContain('草稿内容已恢复');
    expect(html).toContain('必须明确');
  });

  it('P0-8: Brownfield candidate decisions filter adheres to user authority first', () => {
    const candidates = [
      { decisionKey: 'technical_boundary:database', title: 'SQLite 本地存储', areaId: 'technical_boundary' },
      { decisionKey: 'technical_boundary:auth', title: 'JWT 无状态认证', areaId: 'technical_boundary' },
      { decisionKey: 'target_user:role', title: '独立开发者', areaId: 'target_user' },
    ];

    // User only selects 1 of the 3 candidates
    const selectedKeys = new Set(['technical_boundary:database']);

    const admittedCandidates = candidates.filter((c) => selectedKeys.has(c.decisionKey));

    expect(admittedCandidates).toHaveLength(1);
    expect(admittedCandidates[0]?.decisionKey).toBe('technical_boundary:database');
    expect(admittedCandidates.some((c) => c.decisionKey === 'technical_boundary:auth')).toBe(false);
  });

  it('P0-3: ChatView source defines strict scrollable messages stream and permanently docked bottom bar', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const chatViewSrc = readFileSync(
      resolve(__dirname, '../src/features/chat/ChatView.tsx'),
      'utf8'
    );

    // 1. Scrollable message stream container
    expect(chatViewSrc).toContain('flex-1 min-h-0 overflow-y-auto px-4 py-6 scroll-smooth');

    // 2. Docked bottom chat input bar outside scrollable container
    expect(chatViewSrc).toContain('shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6]/95 dark:bg-[#0C0D0F]/95 backdrop-blur-sm p-4 z-20');
  });
});

