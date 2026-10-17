/**
 * @file p2-remediation-ux.test.ts
 * @description Stage P2: Visual Elevation, Typography Normalization, Ultrawide Layout & Micro-interactions
 * 
 * Verifies:
 * 1. P2-1: 5-tier elevation tokens restoration, elevation shadows, 0 hardcoded #17181D in apps/web/src
 * 2. P2-2: Chinese typography floor 12px (text-xs), 0 occurrences of text-[10px] & text-[9px] in apps/web/src
 * 3. P2-3: StatusBadge multi-dimensional indicator (geometric icons + semantic tint + label)
 * 4. P2-4: Ultrawide layout adaptation in ChatView & dynamic viewport height reader in DocumentsView
 * 5. P2-5: Theme preference persistence across localStorage, projectSessionReducer, ThemeToggle & index.html
 * 6. P2-6: Fullscreen Escape listener in ArchitectureDiagramsView and unique accessible modal close labels
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StatusBadge } from '../src/components/common/StatusBadge.js';
import {
  projectSessionReducer,
  THEME_STORAGE_KEY,
  getInitialTheme,
  initialProjectSessionState,
} from '../src/state/projectSessionReducer.js';

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

function getAllFiles(dir: string, ext = '.tsx'): string[] {
  let results: string[] = [];
  if (!existsSync(dir)) return results;
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, ext));
    } else if (filePath.endsWith(ext) || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

describe('Stage P2: Visual Elevation, Typography, Layout & Micro-interactions', () => {
  const srcDir = resolve(__dirname, '../src');
  const cssPath = resolve(__dirname, '../src/styles/index.css');
  const indexHtmlPath = resolve(__dirname, '../index.html');
  const chatViewPath = resolve(__dirname, '../src/features/chat/ChatView.tsx');
  const documentsViewPath = resolve(__dirname, '../src/features/documents/DocumentsView.tsx');
  const diagramsViewPath = resolve(__dirname, '../src/features/diagrams/ArchitectureDiagramsView.tsx');
  const modalPath = resolve(__dirname, '../src/components/common/Modal.tsx');

  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    (globalThis as any).localStorage = memoryStorage;
    (globalThis as any).window = {
      localStorage: memoryStorage,
      matchMedia: () => ({ matches: false }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // P2-1
  it('1. P2-1: Elevation tokens restoration and 0 occurrences of hardcoded bg-[#17181D]', () => {
    expect(existsSync(cssPath)).toBe(true);
    const css = readFileSync(cssPath, 'utf8');

    // Surface elevation tokens in index.css
    expect(css).toContain('--color-surface-card: #16171B');
    expect(css).toContain('--color-surface-elevated: #181922');
    expect(css).toContain('--color-surface-overlay: #23252C');
    expect(css).toContain('--shadow-elevation-card');
    expect(css).toContain('--shadow-elevation-drawer');
    expect(css).toContain('--shadow-elevation-modal');

    // Check all ts/tsx files under apps/web/src for hardcoded 17181D
    const allSrcFiles = getAllFiles(srcDir);
    const violatingFiles: string[] = [];

    for (const file of allSrcFiles) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('17181D') || content.includes('#17181D')) {
        violatingFiles.push(file);
      }
    }

    expect(violatingFiles).toEqual([]);
  });

  // P2-2
  it('2. P2-2: Typography floor normalization: 0 occurrences of text-[10px] and text-[9px] in apps/web/src', () => {
    const allSrcFiles = getAllFiles(srcDir);
    const violatingMicroFontFiles: { file: string; matches: string[] }[] = [];

    for (const file of allSrcFiles) {
      const content = readFileSync(file, 'utf8');
      const matches: string[] = [];
      if (content.includes('text-[10px]')) matches.push('text-[10px]');
      if (content.includes('text-[9px]')) matches.push('text-[9px]');

      if (matches.length > 0) {
        violatingMicroFontFiles.push({ file, matches });
      }
    }

    expect(violatingMicroFontFiles).toEqual([]);
  });

  // P2-3
  it('3. P2-3: StatusBadge multi-dimensional indicator with geometric icons and semantic tint', () => {
    // 1. Confirmed / Locked
    const confirmedHtml = renderToString(React.createElement(StatusBadge, { status: 'confirmed' }));
    expect(confirmedHtml).toContain('已确认');
    expect(confirmedHtml).toContain('lucide-check');
    expect(confirmedHtml).toMatch(/bg-emerald-50|bg-emerald-950/);

    const lockedHtml = renderToString(React.createElement(StatusBadge, { status: 'locked' }));
    expect(lockedHtml).toContain('已锁定');
    expect(lockedHtml).toContain('lucide-lock');
    expect(lockedHtml).toMatch(/bg-zinc-100|bg-zinc-800/);

    // 2. Candidate / Draft / Active
    const candidateHtml = renderToString(React.createElement(StatusBadge, { status: 'candidate' }));
    expect(candidateHtml).toContain('建议');
    expect(candidateHtml).toContain('lucide-clock');
    expect(candidateHtml).toMatch(/border-dashed/);

    // 3. Warning / Conflict
    const warningHtml = renderToString(React.createElement(StatusBadge, { status: 'warning' }));
    expect(warningHtml).toContain('风险');
    expect(warningHtml).toContain('lucide-triangle-alert');
    expect(warningHtml).toMatch(/bg-rose-50|bg-rose-950/);

    // Verify it doesn't render lone bare color dots without icons
    expect(confirmedHtml).not.toMatch(/<span[^>]*class="[^"]*w-1\.5 h-1\.5 rounded-full[^"]*"[^>]*><\/span>$/);
  });

  // P2-4
  it('4. P2-4: Ultrawide layout adaptation in ChatView and dynamic viewport reader in DocumentsView', () => {
    // ChatView ultrawide stream
    const chatView = readFileSync(chatViewPath, 'utf8');
    expect(chatView).toContain('max-w-3xl xl:max-w-4xl 2xl:max-w-5xl');

    // DocumentsView dynamic viewport height
    const documentsView = readFileSync(documentsViewPath, 'utf8');
    expect(documentsView).toContain('h-[calc(100vh-200px)]');
    expect(documentsView).toContain('flex-1 min-h-0 overflow-y-auto');
  });

  // P2-5
  it('5. P2-5: Theme preference persistence across localStorage, reducer, ThemeToggle and index.html', () => {
    // Storage key exported
    expect(THEME_STORAGE_KEY).toBe('pa_theme_preference');

    // Default theme without localStorage is 'dark'
    expect(getInitialTheme()).toBe('dark');

    // Reads from localStorage if available
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getInitialTheme()).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    expect(getInitialTheme()).toBe('system');

    // Reducer SET_THEME updates state and writes to localStorage
    const state = { ...initialProjectSessionState, uiState: { ...initialProjectSessionState.uiState, theme: 'dark' as const } };
    const nextState = projectSessionReducer(state, { type: 'SET_THEME', payload: 'light' });
    expect(nextState.uiState.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    // index.html contains inline script to prevent FOUC
    const indexHtml = readFileSync(indexHtmlPath, 'utf8');
    expect(indexHtml).toContain("localStorage.getItem('pa_theme_preference')");
    expect(indexHtml).toContain("document.documentElement.classList.add('dark')");
    expect(indexHtml).toContain("document.documentElement.classList.remove('dark')");
  });

  // P2-6
  it('6. P2-6: Escape key listener for fullscreen diagrams and unique accessible names on modal close buttons', () => {
    // ArchitectureDiagramsView Escape listener and accessible label
    const diagramsView = readFileSync(diagramsViewPath, 'utf8');
    expect(diagramsView).toContain("e.key === 'Escape'");
    expect(diagramsView).toContain('setIsFullscreen(false)');
    expect(diagramsView).toContain("aria-label={isFullscreen ? '退出大图全屏' : '全屏透视架构图'}");

    // Modal component has closeLabel prop and Escape listener
    const modalCode = readFileSync(modalPath, 'utf8');
    expect(modalCode).toContain("e.key === 'Escape'");
    expect(modalCode).toContain("closeLabel = '关闭窗口'");
    expect(modalCode).toContain('aria-label={closeLabel}');

    // Inspect all modals for unique closeLabel attributes
    const providerHealthPath = resolve(__dirname, '../src/features/home/ProviderHealthModal.tsx');
    const dirBrowserPath = resolve(__dirname, '../src/components/common/DirectoryBrowserModal.tsx');
    const uploadMaterialPath = resolve(__dirname, '../src/features/files/UploadMaterialModal.tsx');
    const docDiffPath = resolve(__dirname, '../src/features/documents/DocumentDiffModal.tsx');
    const homeViewPath = resolve(__dirname, '../src/app/HomeView.tsx');
    const conflictModalPath = resolve(__dirname, '../src/components/common/ConflictModal.tsx');
    const agentPromptPath = resolve(__dirname, '../src/features/documents/AgentPromptModal.tsx');
    const editItemPath = resolve(__dirname, '../src/features/overview/EditOverviewItemModal.tsx');

    expect(readFileSync(providerHealthPath, 'utf8')).toContain('aria-label="关闭探活弹窗"');
    expect(readFileSync(dirBrowserPath, 'utf8')).toContain('closeLabel="关闭目录浏览弹窗"');
    expect(readFileSync(uploadMaterialPath, 'utf8')).toContain('closeLabel="关闭材料上传弹窗"');
    expect(readFileSync(docDiffPath, 'utf8')).toContain('closeLabel="关闭文档差异比对弹窗"');
    expect(readFileSync(homeViewPath, 'utf8')).toContain('closeLabel="关闭代码扫描审查弹窗"');
    expect(readFileSync(conflictModalPath, 'utf8')).toContain('closeLabel="关闭冲突弹窗"');
    expect(readFileSync(agentPromptPath, 'utf8')).toContain('closeLabel="关闭提示词弹窗"');
    expect(readFileSync(editItemPath, 'utf8')).toContain('closeLabel="关闭决策编辑弹窗"');
  });
});
