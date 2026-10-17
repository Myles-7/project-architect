import { useEffect, useCallback } from 'react';
import type { WorkspaceTab } from '../types/session.js';

interface UseGlobalShortcutsOptions {
  activeProjectId: string | null;
  onSelectTab: (tab: WorkspaceTab) => void;
  onToggleLeftSidebar: () => void;
  onFocusSearchOrChat?: () => void;
}

const TAB_INDEX_MAP: WorkspaceTab[] = [
  'chat',
  'files',
  'timeline',
  'settings',
];

/**
 * Global Screen Reader Live Region Announcer
 */
export function announceToScreenReader(message: string): void {
  const el = document.getElementById('sr-global-announcer');
  if (el) {
    el.textContent = '';
    // Small timeout ensures screen readers detect text content change
    setTimeout(() => {
      el.textContent = message;
    }, 50);
  }
}

export function useGlobalShortcuts({
  activeProjectId,
  onSelectTab,
  onToggleLeftSidebar,
  onFocusSearchOrChat,
}: UseGlobalShortcutsOptions): {
  announce: (message: string) => void;
} {
  const announce = useCallback((message: string) => {
    announceToScreenReader(message);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Navigation shortcuts leave text editing and native IME sessions alone.
      if (isModifier && !e.shiftKey && !e.altKey && !isInputFocused && !e.isComposing && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const tabIdx = parseInt(e.key, 10) - 1;
        const targetTab = TAB_INDEX_MAP[tabIdx];
        if (targetTab) {
          onSelectTab(targetTab);
          const tabNames: Record<WorkspaceTab, string> = {
            chat: '规划工作台',
            dag: '决策有向图',
            diagrams: '架构拓扑',
            files: '材料附件',
            documents: '规格文档',
            readiness: '准备度审阅',
            timeline: '历史',
            settings: '诊断',
          };
          announce(`已切换至 ${tabNames[targetTab]} 工作区`);
        }
        return;
      }

      // 2. Ctrl + K: Quick Focus Search or Chat Input
      if (isModifier && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onFocusSearchOrChat) {
          onFocusSearchOrChat();
          announce('已聚焦推演输入框');
        } else {
          const chatInput = document.querySelector('textarea, input[type="text"]') as HTMLElement | null;
          chatInput?.focus();
        }
        return;
      }

      // 3. Ctrl + B: Toggle Left Navigation Sidebar
      if (isModifier && e.key.toLowerCase() === 'b' && !isInputFocused) {
        e.preventDefault();
        onToggleLeftSidebar();
        announce('切换侧边栏导航显示');
        return;
      }

      // 5. '/' Key: Focus Chat Input when not editing
      if (e.key === '/' && !isModifier && !isInputFocused) {
        e.preventDefault();
        if (onFocusSearchOrChat) {
          onFocusSearchOrChat();
        } else {
          const chatInput = document.querySelector('textarea, input[type="text"]') as HTMLElement | null;
          chatInput?.focus();
        }
        announce('已聚焦输入框');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeProjectId,
    onSelectTab,
    onToggleLeftSidebar,
    onFocusSearchOrChat,
    announce,
  ]);

  return { announce };
}
