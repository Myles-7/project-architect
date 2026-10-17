import React, { useState, useEffect } from 'react';
import mermaid from 'mermaid';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Download,
  Code,
  RefreshCw,
  AlertCircle,
  Maximize2,
  Minimize2,
  Maximize,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { defaultApiClient } from '../../api/client.js';
import { useCanvasPanZoom, applySvgDynamicDimensions } from '../../components/common/useCanvasPanZoom.js';
import type { DiagramsResult } from '@project-architect/contracts';

// Initialize mermaid with accessible neutral theme defaults
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  fontFamily: 'Inter, system-ui, sans-serif',
});

export const ArchitectureDiagramsView: React.FC = () => {
  const { state } = useProjectSession();
  const projectId = state.activeProjectId;
  const stateRevision = state.stateRevision;
  const isDark = state.uiState.theme === 'dark';

  const [diagramsData, setDiagramsData] = useState<DiagramsResult | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState<string>('diag-system-context');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Viewport & Pan/Zoom State via unified useCanvasPanZoom engine (exposes setZoomScale, panOffset)
  const {
    zoomScale,
    isPanning,
    containerRef,
    contentWrapperRef: svgWrapperRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetTransform,
    fitToWindow,
    transformStyle,
  } = useCanvasPanZoom({ minScale: 0.3, maxScale: 3.0, scaleStep: 0.15 });

  const [showRawCode, setShowRawCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Keyboard shortcut: Escape exits fullscreen diagram view
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const fetchDiagrams = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.getArchitectureDiagrams(projectId);
      setDiagramsData(data);
      if (data.diagrams.length > 0 && !data.diagrams.some((d) => d.id === activeDiagramId)) {
        setActiveDiagramId(data.diagrams[0].id);
      }
    } catch (err: any) {
      setError(err.message || '加载架构拓扑图表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, [projectId, stateRevision]);

  const activeDiagram = diagramsData?.diagrams.find((d) => d.id === activeDiagramId);

  // Render Mermaid SVG whenever active diagram or theme changes
  useEffect(() => {
    let isCancelled = false;

    const renderCurrentDiagram = async () => {
      if (!activeDiagram || !svgWrapperRef.current) return;

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'neutral',
          fontFamily: 'Inter, system-ui, sans-serif',
        });

        const uniqueId = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, activeDiagram.mermaidCode);

        if (!isCancelled && svgWrapperRef.current) {
          svgWrapperRef.current.innerHTML = svg;
          // Apply responsive width/height styling to generated SVG with dynamic dimensions
          const svgElement = svgWrapperRef.current.querySelector('svg');
          if (svgElement) {
            applySvgDynamicDimensions(containerRef.current, svgElement);
          }
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (!isCancelled && svgWrapperRef.current) {
          svgWrapperRef.current.innerHTML = `<div class="p-6 text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl">图表渲染解析异常，请检查 Mermaid DSL 语法。</div>`;
        }
      }
    };

    renderCurrentDiagram();

    return () => {
      isCancelled = true;
    };
  }, [activeDiagram, isDark]);

  const handleCopyCode = async () => {
    if (!activeDiagram) return;
    try {
      await navigator.clipboard.writeText(activeDiagram.mermaidCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy diagram code:', err);
    }
  };

  const handleDownloadSvg = () => {
    if (!svgWrapperRef.current || !activeDiagram) return;
    const svgEl = svgWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDiagram.type}-${projectId || 'project'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading && !diagramsData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-500" />
        <p className="text-sm font-medium">正在依据项目当前决策动态绘制架构拓扑与流向图...</p>
      </div>
    );
  }

  if (error && !diagramsData) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300">
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span>无法生成架构图表</span>
        </div>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchDiagrams}
          className="mt-4 px-4 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`space-y-6 max-w-7xl mx-auto pb-12 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#FAF9F6] dark:bg-[#0C0D0F] p-8 overflow-y-auto' : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              交互式 Mermaid 架构拓扑与时序渲染引擎
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              依据已锁定与确认的架构决策、系统边界和领域交互关系纯函数动态推导合成
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs flex items-center gap-1 cursor-pointer"
            title="缩小 (或 Ctrl+滚轮向下)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-zinc-500 px-1 min-w-[45px] text-center">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs flex items-center gap-1 cursor-pointer"
            title="放大 (或 Ctrl+滚轮向上)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetTransform}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs cursor-pointer"
            title="一键居中复位"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={fitToWindow}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs cursor-pointer"
            title="适合窗口 (Fit to Window)"
          >
            <Maximize className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制 Mermaid'}</span>
          </button>

          <button
            onClick={handleDownloadSvg}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 SVG</span>
          </button>

          <button
            onClick={() => setShowRawCode((prev) => !prev)}
            className={`p-2 rounded-xl border text-xs transition ${
              showRawCode
                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900'
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
            title="查看 Mermaid DSL 源码"
          >
            <Code className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs cursor-pointer"
            title={isFullscreen ? '退出全屏 (Escape)' : '全屏透视'}
            aria-label={isFullscreen ? '退出大图全屏' : '全屏透视架构图'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Diagram Selection Tabs */}
      <div className="relative -mx-1 px-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
          {diagramsData?.diagrams.map((diag) => {
            const isActive = diag.id === activeDiagramId;
            return (
              <button
                key={diag.id}
                onClick={() => {
                  setActiveDiagramId(diag.id);
                  resetTransform();
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition select-none flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{diag.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Diagram Description Banner */}
      {activeDiagram && (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
          <p>{activeDiagram.description}</p>
          <span className="font-mono text-xs text-zinc-400 shrink-0 ml-4">
            类别: {activeDiagram.type}
          </span>
        </div>
      )}

      {/* Canvas Viewport with Left-Click Drag and Cursor-Centered Wheel Zoom */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden min-h-[520px] flex items-center justify-center p-8 select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          style={transformStyle}
          className="w-full flex items-center justify-center pointer-events-none"
        >
          <div ref={svgWrapperRef} className="w-full flex items-center justify-center pointer-events-auto" />
        </div>
      </div>

      {/* Optional Raw Mermaid DSL Drawer */}
      {showRawCode && activeDiagram && (
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-200 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-zinc-400 pb-2 border-b border-zinc-800">
            <span>Mermaid DSL 脚本 ({activeDiagram.title})</span>
            <span className="text-xs">纯文本只读</span>
          </div>
          <pre className="overflow-x-auto p-4 rounded-xl bg-zinc-900/80 leading-relaxed text-emerald-400">
            {activeDiagram.mermaidCode}
          </pre>
        </div>
      )}
    </div>
  );
};
