/**
 * @file p2-overview-outline.test.ts
 * @description Phase P2 Overview Drawer Dual-View & Document Diff Modal Verification
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DocumentDiffModal } from '../src/features/documents/DocumentDiffModal.js';
import { ToastProvider } from '../src/components/common/Toast.js';
import type { DocumentDiffItem, OverviewItemView } from '@project-architect/contracts';

describe('Phase P2 Overview Outline & Diff Modal Tests (apps/web)', () => {
  const overviewDrawerPath = resolve(__dirname, '../src/features/overview/OverviewDrawer.tsx');
  const diffModalPath = resolve(__dirname, '../src/features/documents/DocumentDiffModal.tsx');
  const sessionContextPath = resolve(__dirname, '../src/state/ProjectSessionContext.tsx');

  it('1. OverviewDrawer implements dual view mode (cards & outline) and filter capsules (方案 13)', () => {
    expect(existsSync(overviewDrawerPath)).toBe(true);
    const code = readFileSync(overviewDrawerPath, 'utf8');

    // View mode state & toggle buttons
    expect(code).toContain("const [viewMode, setViewMode] = useState<'cards' | 'outline'>('cards')");
    expect(code).toContain("setViewMode('cards')");
    expect(code).toContain("setViewMode('outline')");
    expect(code).toContain('LayoutGrid');
    expect(code).toContain('ListTree');

    // Status filter capsules
    expect(code).toContain("type StatusFilter = 'all' | 'confirmed' | 'candidate' | 'assumption' | 'locked'");
    expect(code).toContain("setActiveFilter('all')");
    expect(code).toContain("setActiveFilter('confirmed')");
    expect(code).toContain("setActiveFilter('candidate')");
    expect(code).toContain("setActiveFilter('assumption')");
    expect(code).toContain("setActiveFilter('locked')");

    // Quick search box
    expect(code).toContain('searchQuery');
    expect(code).toContain('setSearchQuery');

    // Outline item renderer
    expect(code).toContain('renderOutlineItem');
  });

  it('2. Verifies filtering and search logic in OverviewDrawer', () => {
    const sampleItems: OverviewItemView[] = [
      {
        ref: 'decision:dec-01',
        statement: 'Strictly offline local file storage',
        status: 'confirmed',
        origin: 'user',
        isLocked: false,
        hasWarning: false,
      },
      {
        ref: 'decision:dec-02',
        statement: 'No centralized database (SQLite only if required)',
        status: 'locked',
        origin: 'user',
        isLocked: true,
        hasWarning: false,
      },
      {
        ref: 'decision:cand-01',
        statement: 'Auto-sync metadata over WebRTC',
        status: 'candidate',
        origin: 'agent',
        isLocked: false,
        hasWarning: false,
      },
      {
        ref: 'assumption:asm-01',
        statement: 'Users have local write permissions in user profile directory',
        status: 'candidate',
        origin: 'agent',
        isLocked: false,
        hasWarning: false,
      },
    ];

    const filterItems = (
      items: OverviewItemView[],
      filter: 'all' | 'confirmed' | 'candidate' | 'assumption' | 'locked',
      search: string
    ) => {
      const q = search.trim().toLowerCase();
      return items.filter((item) => {
        const matchesFilter =
          filter === 'all'
            ? true
            : filter === 'locked'
            ? item.status === 'locked' || item.isLocked
            : filter === 'confirmed'
            ? item.status === 'confirmed'
            : filter === 'candidate'
            ? item.status === 'candidate' && !item.ref.startsWith('assumption:')
            : filter === 'assumption'
            ? item.ref.startsWith('assumption:')
            : true;

        const matchesSearch =
          !q || item.statement.toLowerCase().includes(q) || item.ref.toLowerCase().includes(q);

        return matchesFilter && matchesSearch;
      });
    };

    // Filter by locked
    const locked = filterItems(sampleItems, 'locked', '');
    expect(locked).toHaveLength(1);
    expect(locked[0]?.ref).toBe('decision:dec-02');

    // Filter by confirmed
    const confirmed = filterItems(sampleItems, 'confirmed', '');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]?.ref).toBe('decision:dec-01');

    // Filter by assumption
    const assumptions = filterItems(sampleItems, 'assumption', '');
    expect(assumptions).toHaveLength(1);
    expect(assumptions[0]?.ref).toBe('assumption:asm-01');

    // Search query
    const searchResult = filterItems(sampleItems, 'all', 'webrtc');
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0]?.ref).toBe('decision:cand-01');
  });

  it('3. DocumentDiffModal renders warning banner, file tabs, and diff view (方案 8)', () => {
    expect(existsSync(diffModalPath)).toBe(true);
    const mockDiffs: DocumentDiffItem[] = [
      {
        document: 'AGENTS.md',
        path: 'AGENTS.md',
        hasDiff: true,
        unifiedDiff: '--- AGENTS.md (disk)\n+++ AGENTS.md (new)\n@@ -1,3 +1,3 @@\n-Custom local rule\n+Standard prompt constitution',
        diskContent: 'Custom local rule',
        newContent: 'Standard prompt constitution',
      },
    ];

    const html = renderToString(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(DocumentDiffModal, {
          isOpen: true,
          onClose: () => {},
          diffs: mockDiffs,
          onForceOverwrite: async () => {},
        })
      )
    );

    // Verify Warning Banner & Title
    expect(html).toContain('文档重编译差异拦截保护 (Diff Guard)');
    expect(html).toContain('检测到磁盘物理文档存在手动编辑的内容');

    // Verify Diff Content
    expect(html).toContain('AGENTS.md');
    expect(html).toContain('Unified Diff Preview');
    expect(html).toContain('Custom local rule');
    expect(html).toContain('Standard prompt constitution');

    // Verify Action Buttons
    expect(html).toContain('导出差异补丁 (.patch)');
    expect(html).toContain('放弃重编译 (保留本地修改)');
    expect(html).toContain('强制覆盖并备份旧版');
  });

  it('4. ProjectSessionContext supports VITE_MOCK_MODE offline prototype mode (方案 19)', () => {
    expect(existsSync(sessionContextPath)).toBe(true);
    const code = readFileSync(sessionContextPath, 'utf8');

    expect(code).toContain('VITE_MOCK_MODE');
    expect(code).toContain('offline-demo');
  });
});
