/**
 * @file p1-visual-layout.test.ts
 * @description Stage P1: Visual Layout & Interaction Polishing Automated Tests
 * 
 * Verifies:
 * 1. P1-1: HomeView project filter buttons anti-wrapping (whitespace-nowrap, shrink-0, min-w-[68px])
 * 2. P1-2: Unified "模式与灵感预设中心" fusing Curated Seed Presets & Scene Inspiration Templates
 * 3. P1-3: OverviewDrawer inline editing textarea auto-resizing height & relaxed bottom action spacing
 * 4. P1-4: MermaidGenerator smart title truncation & ArchitectureDiagramsView smooth horizontal tab scroll
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatSafeName } from '@project-architect/core';

describe('Stage P1: Visual Layout & Interaction Polishing', () => {
  const homeViewPath = resolve(__dirname, '../src/app/HomeView.tsx');
  const overviewDrawerPath = resolve(__dirname, '../src/features/overview/OverviewDrawer.tsx');
  const diagramsViewPath = resolve(__dirname, '../src/features/diagrams/ArchitectureDiagramsView.tsx');
  const indexCssPath = resolve(__dirname, '../src/styles/index.css');

  it('1. P1-1: HomeView project filter buttons prevent vertical character wrapping', () => {
    expect(existsSync(homeViewPath)).toBe(true);
    const code = readFileSync(homeViewPath, 'utf8');

    // Filter buttons have whitespace-nowrap, shrink-0 and min-w-[68px]
    expect(code).toContain('whitespace-nowrap shrink-0 min-w-[68px] justify-center text-center');
    expect(code).toContain("projectsTab === 'active'");
    expect(code).toContain("projectsTab === 'archived'");

    // All toolbar actions (import, reverse, browse) also have whitespace-nowrap shrink-0
    expect(code).toMatch(/whitespace-nowrap shrink-0[\s\S]*?导入项目包/);
    expect(code).toMatch(/whitespace-nowrap shrink-0[\s\S]*?读取代码库线索/);
    expect(code).toMatch(/whitespace-nowrap shrink-0[\s\S]*?浏览本地目录/);

    // Parent container wraps smoothly
    expect(code).toMatch(/flex items-center gap-2\.5 flex-wrap/);
  });

  it('2. P1-2: Fuses seed presets and inspiration templates into unified center', () => {
    expect(existsSync(homeViewPath)).toBe(true);
    const code = readFileSync(homeViewPath, 'utf8');

    // Unified center title & container
    expect(code).toContain('需要一个起点？');
    expect(code).toContain("centerTab === 'presets'");
    expect(code).toContain("centerTab === 'templates'");

    // Preset mode guarantees
    expect(code).toContain('架构参考');
    expect(code).toContain('可选参考，具体设计交给 AI');
    expect(code).toContain('preset.category');
    expect(code).toContain('selectedPresetId');

    // Inspiration mode guarantees
    expect(code).toContain('想法示例');
    expect(code).toContain('PROJECT_TEMPLATES.map');
    expect(code).toContain('handleApplyTemplate(tmpl)');
    expect(code).toContain('一键填入 →');

    // Avoid cross-tab preset state pollution
    expect(code).toContain('setSelectedPresetId(null)');

    // Eliminates old redundant bottom drawer
    expect(code).not.toContain('典型场景与灵感模板 (可选参考)');
  });

  it('3. P1-3: OverviewDrawer inline editing textarea supports auto-resizing and polished spacing', () => {
    expect(existsSync(overviewDrawerPath)).toBe(true);
    const code = readFileSync(overviewDrawerPath, 'utf8');

    // Dynamic auto-resizing on mount and input
    expect(code).toContain('el.style.height = `${Math.min(240, Math.max(64, el.scrollHeight))}px`');
    expect(code).toContain('min-h-[64px]');
    expect(code).toContain('max-h-[240px]');
    expect(code).toContain('resize-y');

    // IME composition safety (Enter key does not submit while composing Chinese)
    expect(code).toContain('isComposing');

    // Bottom action bar spacing & separator
    expect(code).toContain('pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]');
    expect(code).toContain('Enter 保存 · Esc 取消');
  });

  it('4. P1-4: MermaidGenerator truncates long project names and diagrams tab bar scrolls smoothly', () => {
    // Core Generator smart truncation
    expect(formatSafeName('CloudSync Studio', 16)).toBe('CloudSync Studio');
    expect(formatSafeName('双人实时互动同居室(包含情侣空间/房产虚拟搭建/同步影音/远程桌面等扩展)', 16)).toBe(
      '双人实时互动同居室 包含情侣空间...'
    );

    // Null/undefined & surrogate pair edge cases
    expect(formatSafeName(undefined as any)).toBe('');
    expect(formatSafeName(null as any)).toBe('');
    expect(formatSafeName('123456789012345🚀extra', 16)).toBe('123456789012345🚀...');

    // ArchitectureDiagramsView tab bar
    expect(existsSync(diagramsViewPath)).toBe(true);
    const diagCode = readFileSync(diagramsViewPath, 'utf8');
    expect(diagCode).toContain('overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth');
    expect(diagCode).toContain('whitespace-nowrap shrink-0 transition select-none flex items-center gap-2 cursor-pointer');

    // index.css provides .no-scrollbar
    expect(existsSync(indexCssPath)).toBe(true);
    const cssCode = readFileSync(indexCssPath, 'utf8');
    expect(cssCode).toContain('.no-scrollbar');
    expect(cssCode).toContain('scrollbar-width: none');
  });
});
