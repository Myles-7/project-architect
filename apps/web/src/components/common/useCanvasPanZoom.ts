import { useState, useRef, useCallback, useEffect, type MouseEvent, type WheelEvent, type RefObject, type CSSProperties } from 'react';

export interface UseCanvasPanZoomOptions {
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;
  initialScale?: number;
  initialPan?: { x: number; y: number };
}

export interface UseCanvasPanZoomReturn {
  zoomScale: number;
  panOffset: { x: number; y: number };
  isPanning: boolean;
  hasDraggedRef: React.MutableRefObject<boolean>;
  containerRef: RefObject<HTMLDivElement | null>;
  contentWrapperRef: RefObject<HTMLDivElement | null>;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  handleMouseDown: (e: MouseEvent<HTMLElement>) => void;
  handleMouseMove: (e: MouseEvent<HTMLElement>) => void;
  handleMouseUp: () => void;
  handleWheel: (e: WheelEvent<HTMLElement>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  fitToWindow: () => void;
  transformStyle: CSSProperties;
}

/**
 * P1-3: Unified Canvas Pan & Zoom Engine for Architecture Diagrams and Decision DAGs.
 * Supports:
 * - Left-click & middle-click dragging
 * - Cursor-centered wheel zooming (with Ctrl/Cmd or standard pinch)
 * - Free two-finger canvas panning
 * - Instant reset to center and dynamic fit-to-window calculation
 */
export function useCanvasPanZoom(options: UseCanvasPanZoomOptions = {}): UseCanvasPanZoomReturn {
  const {
    minScale = 0.3,
    maxScale = 3.0,
    scaleStep = 0.15,
    initialScale = 1,
    initialPan = { x: 0, y: 0 },
  } = options;

  const [zoomScale, setZoomScale] = useState<number>(initialScale);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>(initialPan);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const hasDraggedRef = useRef<boolean>(false);

  const panStartRef = useRef<{
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLElement>) => {
    // Left click (0) or Middle click (1)
    if (e.button !== 0 && e.button !== 1) return;
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panOffset.x,
      initialPanY: panOffset.y,
    };
    hasDraggedRef.current = false;
    setIsPanning(true);
  }, [panOffset]);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    if (Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }
    setPanOffset({
      x: panStartRef.current.initialPanX + dx,
      y: panStartRef.current.initialPanY + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setTimeout(() => {
      panStartRef.current = null;
      hasDraggedRef.current = false;
    }, 60);
  }, []);

  // Window-level mouse tracking during drag to prevent gesture drops when cursor leaves container (DEF-LC4-08)
  useEffect(() => {
    if (!isPanning) return;

    const onWindowMouseMove = (e: globalThis.MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        hasDraggedRef.current = true;
      }
      setPanOffset({
        x: panStartRef.current.initialPanX + dx,
        y: panStartRef.current.initialPanY + dy,
      });
    };

    const onWindowMouseUp = () => {
      setIsPanning(false);
      setTimeout(() => {
        panStartRef.current = null;
        hasDraggedRef.current = false;
      }, 60);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isPanning]);

  // Non-passive wheel event listener on container to allow e.preventDefault() without passive violations (DEF-LC4-09)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e: globalThis.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const delta = e.deltaY < 0 ? scaleStep : -scaleStep;
        setZoomScale((prevScale) => {
          const newScale = Math.max(minScale, Math.min(maxScale, Number((prevScale + delta).toFixed(2))));
          if (newScale === prevScale) return prevScale;
          const ratio = newScale / prevScale;
          setPanOffset((prevPan) => ({
            x: cursorX - (cursorX - prevPan.x) * ratio,
            y: cursorY - (cursorY - prevPan.y) * ratio,
          }));
          return newScale;
        });
      } else {
        // Natural two-finger scroll or wheel panning
        setPanOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onNativeWheel);
    };
  }, [minScale, maxScale, scaleStep]);

  const handleWheel = useCallback((e: WheelEvent<HTMLElement>) => {
    if (e.ctrlKey || e.metaKey) {
      try {
        e.preventDefault();
      } catch {}
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? scaleStep : -scaleStep;
      const newScale = Math.max(minScale, Math.min(maxScale, Number((zoomScale + delta).toFixed(2))));
      if (newScale === zoomScale) return;

      const ratio = newScale / zoomScale;
      const newPanX = cursorX - (cursorX - panOffset.x) * ratio;
      const newPanY = cursorY - (cursorY - panOffset.y) * ratio;

      setZoomScale(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    } else {
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, [zoomScale, panOffset, minScale, maxScale, scaleStep]);

  const zoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(maxScale, Number((prev + scaleStep).toFixed(2))));
  }, [maxScale, scaleStep]);

  const zoomOut = useCallback(() => {
    setZoomScale((prev) => Math.max(minScale, Number((prev - scaleStep).toFixed(2))));
  }, [minScale, scaleStep]);

  const resetTransform = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const fitToWindow = useCallback(() => {
    const container = containerRef.current;
    const content = contentWrapperRef.current;
    if (!container || !content) return;

    const svgEl = content.querySelector('svg');
    let naturalW = 800;
    let naturalH = 600;

    if (svgEl) {
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          naturalW = parts[2];
          naturalH = parts[3];
        }
      } else {
        const bbox = svgEl.getBoundingClientRect();
        naturalW = bbox.width || 800;
        naturalH = bbox.height || 600;
      }
    }

    const containerW = Math.max(200, container.clientWidth - 64);
    const containerH = Math.max(200, container.clientHeight - 64);

    if (naturalW > 0 && naturalH > 0) {
      const fitScale = Math.min(1.2, Math.max(minScale, Math.min(containerW / naturalW, containerH / naturalH)));
      setZoomScale(Number(fitScale.toFixed(2)));
      setPanOffset({ x: 0, y: 0 });
    }
  }, [minScale]);

  const transformStyle: CSSProperties = {
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
    transformOrigin: 'center center',
    transition: isPanning ? 'none' : 'transform 0.12s ease-out',
  };

  return {
    zoomScale,
    panOffset,
    isPanning,
    hasDraggedRef,
    containerRef,
    contentWrapperRef,
    setZoomScale,
    setPanOffset,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetTransform,
    fitToWindow,
    transformStyle,
  };
}

/**
 * P1-3: Dynamically adjusts rendered Mermaid SVG dimensions to prevent large graphs
 * (e.g., 50+ node DAGs) from being squashed into unreadable 1px lines by hardcoded maxWidth: 100%.
 */
export function applySvgDynamicDimensions(containerEl: HTMLElement | null, svgEl: SVGSVGElement | null) {
  if (!svgEl) return;
  const viewBox = svgEl.getAttribute('viewBox');
  let naturalWidth = 0;
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0) {
      naturalWidth = parts[2];
    }
  }
  const containerWidth = containerEl?.clientWidth || 800;
  const dynamicWidth = Math.max(containerWidth, naturalWidth);
  svgEl.style.minWidth = `${dynamicWidth}px`;
  svgEl.style.width = '100%';
  svgEl.style.maxWidth = 'none';
  svgEl.style.height = 'auto';
  svgEl.style.display = 'block';
  svgEl.style.margin = '0 auto';
}
