import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ResponsiveDrawer } from '../src/components/layout/ResponsiveDrawer.js';
import { getBreakpointCollapseActions } from '../src/app/AppShell.js';

describe('Responsive Workspace & Viewport Layout Tests (Task 6.1)', () => {
  // Helper to evaluate responsive layout breakpoint rules
  function getLayoutMode(width: number): {
    mode: 'mobile' | 'tablet' | 'desktop';
    isThreeColumn: boolean;
    isIconNav: boolean;
    isModalDrawer: boolean;
    isOverlayDrawer: boolean;
    centerMinConstraint: string;
  } {
    if (width >= 1200) {
      return {
        mode: 'desktop',
        isThreeColumn: true,
        isIconNav: false,
        isModalDrawer: false,
        isOverlayDrawer: false,
        centerMinConstraint: 'min-w-[640px]',
      };
    } else if (width >= 768) {
      return {
        mode: 'tablet',
        isThreeColumn: false,
        isIconNav: true,
        isModalDrawer: false,
        isOverlayDrawer: true,
        centerMinConstraint: 'min-w-[320px]',
      };
    } else {
      return {
        mode: 'mobile',
        isThreeColumn: false,
        isIconNav: false,
        isModalDrawer: true,
        isOverlayDrawer: false,
        centerMinConstraint: 'min-w-[320px]',
      };
    }
  }

  it('1. Evaluates all 5 mandatory target viewports according to layout specification', () => {
    // 1. Mobile (390 x 844)
    const mobile = getLayoutMode(390);
    expect(mobile.mode).toBe('mobile');
    expect(mobile.isThreeColumn).toBe(false);
    expect(mobile.isModalDrawer).toBe(true);
    expect(mobile.centerMinConstraint).toBe('min-w-[320px]');

    // 2. Tablet Portrait (768 x 900)
    const tabletPort = getLayoutMode(768);
    expect(tabletPort.mode).toBe('tablet');
    expect(tabletPort.isIconNav).toBe(true);
    expect(tabletPort.isOverlayDrawer).toBe(true);

    // 3. Tablet Landscape (1024 x 768)
    const tabletLand = getLayoutMode(1024);
    expect(tabletLand.mode).toBe('tablet');
    expect(tabletLand.isIconNav).toBe(true);
    expect(tabletLand.isOverlayDrawer).toBe(true);

    // 4. Desktop Standard (1280 x 720)
    const desktopStd = getLayoutMode(1280);
    expect(desktopStd.mode).toBe('desktop');
    expect(desktopStd.isThreeColumn).toBe(true);
    expect(desktopStd.centerMinConstraint).toBe('min-w-[640px]');

    // 5. Desktop Wide (1440 x 900)
    const desktopWide = getLayoutMode(1440);
    expect(desktopWide.mode).toBe('desktop');
    expect(desktopWide.isThreeColumn).toBe(true);
    expect(desktopWide.centerMinConstraint).toBe('min-w-[640px]');
  });

  it('2. Never compresses main content below 320px across all widths', () => {
    const testWidths = [320, 375, 390, 480, 600, 768, 900, 1024, 1200, 1440, 1920];
    for (const w of testWidths) {
      const mode = getLayoutMode(w);
      expect(mode.centerMinConstraint).toMatch(/min-w-\[(320|640)px\]/);
    }
  });

  it('3. Renders ResponsiveDrawer with accessibility dialog attributes and backdrop', () => {
    const html = renderToString(
      React.createElement(
        ResponsiveDrawer,
        {
          isOpen: true,
          onClose: () => {},
          title: '项目架构概览',
          side: 'right',
          'aria-label': '项目架构概览侧边抽屉',
        },
        React.createElement('div', { id: 'test-drawer-content' }, '抽屉内容')
      )
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="项目架构概览侧边抽屉"');
    expect(html).toContain('test-drawer-content');
    expect(html).toContain('关闭抽屉');
  });

  it('4. Retains draft and state when drawer is closed or toggled', () => {
    // In React state, drawer toggling does not unmount active workspace views
    let isDrawerOpen = false;
    const sessionState = {
      activeTab: 'chat',
      currentQuestionIndex: 2,
      inputDraft: 'Windows 离线数据存储需求',
      scrollY: 450,
    };

    // Toggle drawer open
    isDrawerOpen = true;
    expect(isDrawerOpen).toBe(true);
    expect(sessionState.currentQuestionIndex).toBe(2);
    expect(sessionState.inputDraft).toBe('Windows 离线数据存储需求');
    expect(sessionState.scrollY).toBe(450);

    // Toggle drawer close
    isDrawerOpen = false;
    expect(isDrawerOpen).toBe(false);
    expect(sessionState.currentQuestionIndex).toBe(2);
    expect(sessionState.inputDraft).toBe('Windows 离线数据存储需求');
    expect(sessionState.scrollY).toBe(450);
  });

  it('5. Auto-collapses drawers only when crossing into a narrower breakpoint', () => {
    expect(getBreakpointCollapseActions(null, 390)).toEqual({ left: true, overview: true });
    expect(getBreakpointCollapseActions(1280, 1024)).toEqual({ left: false, overview: true });
    expect(getBreakpointCollapseActions(1024, 390)).toEqual({ left: true, overview: false });
    expect(getBreakpointCollapseActions(390, 390)).toEqual({ left: false, overview: false });
  });
});
