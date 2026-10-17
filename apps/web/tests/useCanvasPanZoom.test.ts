import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  useCanvasPanZoom,
  applySvgDynamicDimensions,
  type UseCanvasPanZoomReturn,
} from '../src/components/common/useCanvasPanZoom.js';

describe('useCanvasPanZoom Hook & Dynamic SVG Sizing', () => {
  it('1. Initializes and renders with default scale and pan offset', () => {
    let hookState: UseCanvasPanZoomReturn | null = null;
    function TestComponent() {
      hookState = useCanvasPanZoom({ minScale: 0.5, maxScale: 2.5, scaleStep: 0.1 });
      return React.createElement('div', {
        id: 'test-canvas',
        style: hookState.transformStyle,
      });
    }

    const html = renderToString(React.createElement(TestComponent));
    expect(html).toContain('scale(1)');
    expect(html).toContain('translate(0px, 0px)');
    expect(hookState).not.toBeNull();
    expect(hookState!.zoomScale).toBe(1);
    expect(hookState!.panOffset).toEqual({ x: 0, y: 0 });
    expect(hookState!.isPanning).toBe(false);
  });

  it('2. applySvgDynamicDimensions calculates width dynamically for 50+ node graphs', () => {
    const dummyContainer = { clientWidth: 900 } as HTMLElement;
    const dummySvg = {
      getAttribute: (attr: string) => (attr === 'viewBox' ? '0 0 2400 1600' : null),
      style: {} as any,
    } as unknown as SVGSVGElement;

    applySvgDynamicDimensions(dummyContainer, dummySvg);

    expect(dummySvg.style.minWidth).toBe('2400px');
    expect(dummySvg.style.maxWidth).toBe('none');
    expect(dummySvg.style.width).toBe('100%');
    expect(dummySvg.style.display).toBe('block');
  });

  it('3. applySvgDynamicDimensions falls back to container width when graph is smaller than container', () => {
    const dummyContainer = { clientWidth: 1200 } as HTMLElement;
    const dummySvg = {
      getAttribute: (attr: string) => (attr === 'viewBox' ? '0 0 500 300' : null),
      style: {} as any,
    } as unknown as SVGSVGElement;

    applySvgDynamicDimensions(dummyContainer, dummySvg);

    expect(dummySvg.style.minWidth).toBe('1200px');
    expect(dummySvg.style.maxWidth).toBe('none');
  });

  it('4. Gracefully handles null container or svg elements without throwing', () => {
    expect(() => applySvgDynamicDimensions(null, null)).not.toThrow();
    expect(() =>
      applySvgDynamicDimensions(null, { getAttribute: () => null, style: {} } as any)
    ).not.toThrow();
  });
});
