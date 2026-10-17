import React, { useState, useEffect, useMemo, useRef } from 'react';
import mermaid from 'mermaid';
import {
  GitFork,
  Network,
  AlertTriangle,
  CheckCircle2,
  Lock,
  HelpCircle,
  Layers,
  ArrowRight,
  FileText,
  Search,
  RefreshCw,
  Info,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Download,
  Code,
  Maximize2,
  Minimize2,
  Maximize,
  Share2,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import { defaultApiClient } from '../../api/client.js';
import { useCanvasPanZoom, applySvgDynamicDimensions } from '../../components/common/useCanvasPanZoom.js';
import type {
  DecisionGraphView,
  DecisionGraphNode,
  CascadeImpactResult,
} from '@project-architect/contracts';

// Initialize mermaid with accessible neutral theme defaults
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  fontFamily: 'Inter, system-ui, sans-serif',
});

function sanitizeMermaidText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/["\n\r[\]{}()<>\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeNodeId(id: string): string {
  return `dec_${(id || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/**
 * Disambiguates SVG node element IDs to exact DecisionGraphNode matches.
 * Uses length-descending sort and delimiter boundary regex to prevent prefix collisions
 * (e.g. dec-1 incorrectly matching dec-10).
 */
export function matchNodeFromElementId(
  nodes: DecisionGraphNode[],
  elId: string
): DecisionGraphNode | null {
  if (!nodes || nodes.length === 0 || !elId) return null;

  // Sort nodes by safeNodeId length descending to ensure longer IDs (e.g. dec-10)
  // are tested before shorter prefix IDs (e.g. dec-1)
  const sorted = [...nodes].sort(
    (a, b) => safeNodeId(b.id).length - safeNodeId(a.id).length
  );

  for (const node of sorted) {
    const sId = safeNodeId(node.id);
    const escaped = sId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[-_])${escaped}(?:[-_]|$)`);
    if (pattern.test(elId)) {
      return node;
    }
  }

  return null;
}

/**
 * Pure function to generate rich, dynamic Mermaid flowchart DSL from DecisionGraphView.
 * Supports direction (LR / TD), status styles, area clusters, and selection/cascade ripple highlighting.
 */
export function generateDagMermaidCode(
  dag: DecisionGraphView,
  selectedNodeId: string | null,
  impactResult: CascadeImpactResult | null,
  direction: 'LR' | 'TD' = 'LR',
  isDark: boolean = false
): string {
  if (!dag || !dag.nodes || dag.nodes.length === 0) {
    return `flowchart ${direction}\n  Empty["当前项目尚未沉淀任何架构决策"]`;
  }

  const lines: string[] = [];
  lines.push(`flowchart ${direction}`);

  // Define semantic node classes with WCAG AA compliant contrast
  if (isDark) {
    lines.push('  classDef default fill:#18181b,stroke:#3f3f46,stroke-width:1px,color:#f4f4f5,rx:8,ry:8;');
    lines.push('  classDef locked fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#e0e7ff,rx:8,ry:8;');
    lines.push('  classDef confirmed fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ecfdf5,rx:8,ry:8;');
    lines.push('  classDef candidate fill:#451a03,stroke:#fbbf24,stroke-width:1px,color:#fef3c7,rx:8,ry:8;');
    lines.push('  classDef cycle fill:#450a0a,stroke:#f87171,stroke-width:2px,color:#fee2e2,rx:8,ry:8;');
    lines.push('  classDef selected stroke:#818cf8,stroke-width:3px,fill:#312e81,color:#ffffff,rx:8,ry:8;');
    lines.push('  classDef downstream fill:#78350f,stroke:#fbbf24,stroke-width:2px,color:#fef3c7,rx:8,ry:8;');
    lines.push('  classDef upstream fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#eff6ff,rx:8,ry:8;');
  } else {
    lines.push('  classDef default fill:#ffffff,stroke:#cbd5e1,stroke-width:1px,color:#1e293b,rx:8,ry:8;');
    lines.push('  classDef locked fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#312e81,rx:8,ry:8;');
    lines.push('  classDef confirmed fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b,rx:8,ry:8;');
    lines.push('  classDef candidate fill:#fffbeb,stroke:#f59e0b,stroke-width:1px,color:#78350f,rx:8,ry:8;');
    lines.push('  classDef cycle fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#991b1b,rx:8,ry:8;');
    lines.push('  classDef selected stroke:#4f46e5,stroke-width:3px,fill:#e0e7ff,color:#1e1b4b,rx:8,ry:8;');
    lines.push('  classDef downstream fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f,rx:8,ry:8;');
    lines.push('  classDef upstream fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a,rx:8,ry:8;');
  }

  // Selected node context
  const selectedNode = selectedNodeId ? dag.nodes.find((n) => n.id === selectedNodeId) : null;
  const upstreamIds = new Set(selectedNode?.dependsOn || []);
  const downstreamIds = new Set(impactResult?.allTransitiveDependents || []);

  // Group nodes by Area cluster
  const areaMap = new Map<string, DecisionGraphNode[]>();
  for (const node of dag.nodes) {
    const area = node.area || '通用架构';
    if (!areaMap.has(area)) areaMap.set(area, []);
    areaMap.get(area)!.push(node);
  }

  for (const [area, nodes] of areaMap.entries()) {
    const safeAreaId = `area_${area.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    lines.push(`  subgraph ${safeAreaId}[" 🏷️ ${sanitizeMermaidText(area)} "]`);
    lines.push('    direction TB');
    for (const n of nodes) {
      const sId = safeNodeId(n.id);
      const icon = n.status === 'locked' ? '🔒' : n.status === 'confirmed' ? '✅' : '💡';
      const cleanStmt = sanitizeMermaidText(n.statement);
      const shortStmt = cleanStmt.length > 22 ? `${cleanStmt.slice(0, 20)}...` : cleanStmt;
      lines.push(`    ${sId}["${icon} <b>${sanitizeMermaidText(n.id)}</b><br/>${shortStmt}"]`);
    }
    lines.push('  end');
  }

  // Edges - filter to ensure both source and target exist in dag.nodes
  const validNodeIds = new Set(dag.nodes.map((n) => n.id));
  for (const edge of dag.edges) {
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) {
      continue;
    }
    const s = safeNodeId(edge.source);
    const t = safeNodeId(edge.target);
    if (edge.type === 'inferred') {
      lines.push(`  ${s} -.->|推断| ${t}`);
    } else {
      lines.push(`  ${s} --> ${t}`);
    }
  }

  // Assign classes to nodes
  for (const n of dag.nodes) {
    const sId = safeNodeId(n.id);
    if (n.id === selectedNodeId) {
      lines.push(`  class ${sId} selected;`);
    } else if (downstreamIds.has(n.id)) {
      lines.push(`  class ${sId} downstream;`);
    } else if (upstreamIds.has(n.id)) {
      lines.push(`  class ${sId} upstream;`);
    } else if (n.isCycleParticipant) {
      lines.push(`  class ${sId} cycle;`);
    } else if (n.status === 'locked') {
      lines.push(`  class ${sId} locked;`);
    } else if (n.status === 'confirmed') {
      lines.push(`  class ${sId} confirmed;`);
    } else {
      lines.push(`  class ${sId} candidate;`);
    }
  }

  return lines.join('\n');
}

export const DecisionDAGExplorer: React.FC = () => {
  const { state, setActiveTab } = useProjectSession();
  const projectId = state.activeProjectId;
  const stateRevision = state.stateRevision;
  const isDark = state.uiState.theme === 'dark';

  const [dag, setDag] = useState<DecisionGraphView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');

  // P2-1: Dual-view toggle state ('canvas' | 'cards')
  const [viewMode, setViewMode] = useState<'canvas' | 'cards'>('canvas');
  const [direction, setDirection] = useState<'LR' | 'TD'>('LR');

  // Unified Canvas Pan & Zoom engine (exposes setZoomScale, setPanOffset, transformStyle)
  const {
    zoomScale,
    panOffset,
    isPanning,
    hasDraggedRef,
    containerRef: viewportRef,
    contentWrapperRef: svgWrapperRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetTransform: handleResetTransform,
    fitToWindow: handleFitToWindow,
  } = useCanvasPanZoom({ minScale: 0.3, maxScale: 3.0, scaleStep: 0.15 });

  const [showRawCode, setShowRawCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Keyboard shortcut: Escape exits fullscreen DAG view
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

  // Cascade Impact Inspection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [impactResult, setImpactResult] = useState<CascadeImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ hasDragged: boolean } | null>(null);
  const currentInspectNodeIdRef = useRef<string | null>(null);

  const fetchDag = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await defaultApiClient.getProjectDag(projectId);
      setDag(data);
    } catch (err: any) {
      setError(err.message || '加载决策依赖图失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    currentInspectNodeIdRef.current = null;
    setSelectedNodeId(null);
    setImpactResult(null);
    setImpactLoading(false);
    handleResetTransform();
    fetchDag();
  }, [projectId, stateRevision]);

  // Handle node selection for cascade impact (with race condition protection)
  const handleSelectNode = async (node: DecisionGraphNode) => {
    if (!projectId) return;
    if (selectedNodeId === node.id) {
      currentInspectNodeIdRef.current = null;
      setSelectedNodeId(null);
      setImpactResult(null);
      setImpactLoading(false);
      return;
    }

    currentInspectNodeIdRef.current = node.id;
    setSelectedNodeId(node.id);
    setImpactLoading(true);
    try {
      const impact = await defaultApiClient.getDecisionCascadeImpact(projectId, node.id);
      if (currentInspectNodeIdRef.current === node.id) {
        setImpactResult(impact);
      }
    } catch (err) {
      if (currentInspectNodeIdRef.current === node.id) {
        console.error('Failed to compute cascade impact:', err);
      }
    } finally {
      if (currentInspectNodeIdRef.current === node.id) {
        setImpactLoading(false);
      }
    }
  };

  const filteredNodes = useMemo(() => {
    if (!dag) return [];
    return dag.nodes.filter((node) => {
      const matchesSearch =
        node.statement.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.decisionKey && node.decisionKey.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = selectedStatus === 'all' || node.status === selectedStatus;
      const matchesArea = selectedArea === 'all' || node.area === selectedArea;

      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [dag, searchQuery, selectedStatus, selectedArea]);

  const uniqueAreas = useMemo(() => {
    if (!dag) return [];
    return Array.from(new Set(dag.nodes.map((n) => n.area))).sort();
  }, [dag]);

  // Mermaid DSL code generation
  const mermaidCode = useMemo(() => {
    if (!dag) return '';
    return generateDagMermaidCode(dag, selectedNodeId, impactResult, direction, isDark);
  }, [dag, selectedNodeId, impactResult, direction, isDark]);

  // Render Mermaid SVG and attach interactive click listeners to nodes
  useEffect(() => {
    if (viewMode !== 'canvas' || !mermaidCode || !svgWrapperRef.current) return;
    let isCancelled = false;

    const renderCanvas = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'neutral',
          fontFamily: 'Inter, system-ui, sans-serif',
        });

        const uniqueId = `mermaid-dag-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, mermaidCode);

        if (!isCancelled && svgWrapperRef.current) {
          svgWrapperRef.current.innerHTML = svg;
          const svgElement = svgWrapperRef.current.querySelector('svg');
          if (svgElement) {
            applySvgDynamicDimensions(viewportRef.current, svgElement);

            // Bind click handlers to nodes in SVG with boundary disambiguation
            const nodeEls = svgElement.querySelectorAll('.node');
            nodeEls.forEach((el) => {
              (el as HTMLElement).style.cursor = 'pointer';
              el.addEventListener('click', (e) => {
                e.stopPropagation();
                // If user dragged/panned canvas, do not trigger node selection
                if (hasDraggedRef.current || panStartRef.current?.hasDragged) return;
                if (!dag) return;
                const matched = matchNodeFromElementId(dag.nodes, el.id);
                if (matched) {
                  handleSelectNode(matched);
                }
              });
            });
          }
        }
      } catch (err) {
        console.error('Mermaid render error in DAG canvas:', err);
        if (!isCancelled && svgWrapperRef.current) {
          svgWrapperRef.current.innerHTML = `
            <div class="p-6 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-center">
              图表拓扑渲染引擎准备中，或 Mermaid 语法解析受限。您可以查看下方卡片列表或 Mermaid DSL。
            </div>
          `;
        }
      }
    };

    renderCanvas();

    return () => {
      isCancelled = true;
    };
  }, [mermaidCode, viewMode, isDark, dag]);

  const handleCopyCode = async () => {
    if (!mermaidCode) return;
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy DAG code:', err);
    }
  };

  const handleDownloadSvg = () => {
    if (!svgWrapperRef.current) return;
    const svgEl = svgWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `decision-dag-${projectId || 'project'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading && !dag) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
        <p className="text-sm font-medium">正在实时构建决策因果依赖图谱...</p>
      </div>
    );
  }

  if (error && !dag) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300">
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span>依赖图构建失败</span>
        </div>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchDag}
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
        isFullscreen ? 'fixed inset-0 z-50 bg-canvas p-8 overflow-y-auto' : ''
      }`}
    >
      {/* Top Header & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                决策依赖有向无环图 (Decision Dependency DAG)
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                实时追踪架构决策的前置因果依赖，计算任何决策变动时的下游级联波及闭包与规约影响
              </p>
            </div>
          </div>
        </div>

        {dag && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">决策总计:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{dag.summary.totalNodes}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>已确认: {dag.summary.confirmedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300">
              <Lock className="w-3.5 h-3.5" />
              <span>已锁定: {dag.summary.lockedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-300">
              <Layers className="w-3.5 h-3.5" />
              <span>最大层深: {dag.summary.maxDepth + 1}</span>
            </div>
          </div>
        )}
      </div>

      {/* Cyclic Dependency Alert */}
      {dag?.hasCycles && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-red-800 dark:text-red-200">
            <p className="font-bold">⚠️ 检测到循环依赖 (Circular Dependency Detected)!</p>
            <p className="text-red-700 dark:text-red-300">
              发现环路依赖链：{dag.cycles.map((c) => c.join(' ➔ ')).join(' | ')}。请审查并解除因果互锁。
            </p>
          </div>
        </div>
      )}

      {/* Toolbar: View Switcher + Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* P2-1: Dual-View Switcher Segmented Control */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'canvas'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>拓扑连线画布</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>层级卡片列表</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 md:justify-end">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500 dark:text-zinc-400" />
            <input
              type="text"
              placeholder="搜索决策声明、ID 或决策 Key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0 w-full sm:w-auto"
          >
            <option value="all">所有状态 (All Status)</option>
            <option value="confirmed">已确认 (Confirmed)</option>
            <option value="locked">已锁定 (Locked)</option>
            <option value="candidate">候选建议 (Candidate)</option>
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0 w-full sm:w-auto"
          >
            <option value="all">所有架构领域 (All Areas)</option>
            {uniqueAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Layout: Graph Canvas / Node Cards + Cascade Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Canvas or Cards View */}
        <div className="lg:col-span-2 space-y-4">
          {dag?.nodes.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl bg-white/40 dark:bg-zinc-900/30 text-zinc-500 space-y-3">
              <Network className="w-10 h-10 mx-auto text-indigo-400 opacity-60" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  当前项目尚未沉淀任何架构决策
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                  决策依赖有向无环图将在您通过 AI 澄清对话确认第一条架构决策，或通过逆向扫描导入存量工程时自动生成。
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>前往构思与澄清对话</span>
                </button>
              </div>
            </div>
          ) : viewMode === 'canvas' ? (
            /* P2-1: Interactive Mermaid / SVG Topological Canvas */
            <div className="space-y-3">
              {/* Canvas Controls Header */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>拓扑连线画布</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDirection((prev) => (prev === 'LR' ? 'TD' : 'LR'))}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[11px] cursor-pointer"
                    title="切换流向：水平 (LR) / 纵向 (TD)"
                  >
                    流向: {direction === 'LR' ? '水平 LR ➔' : '纵向 TD ⬇'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={zoomOut}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="缩小画布 (Ctrl+滚轮向下)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500 min-w-[42px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    onClick={zoomIn}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="放大画布 (Ctrl+滚轮向上)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleResetTransform}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="重置居中"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleFitToWindow}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="适合窗口 (Fit to Window)"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-zinc-200 dark:border-zinc-700 mx-1" />

                  <button
                    onClick={handleCopyCode}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    title="复制 Mermaid 脚本"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? '已复制' : '复制 DSL'}</span>
                  </button>

                  <button
                    onClick={handleDownloadSvg}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    title="导出为 SVG 矢量图"
                  >
                    <Download className="w-3 h-3" />
                    <span>导出 SVG</span>
                  </button>

                  <button
                    onClick={() => setShowRawCode((prev) => !prev)}
                    className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                      showRawCode
                        ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                    title="查看 Mermaid DSL 源码"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsFullscreen((prev) => !prev)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
                    title={isFullscreen ? '退出全屏 (Escape)' : '全屏连线画布'}
                    aria-label={isFullscreen ? '退出全屏' : '全屏连线画布'}
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Canvas Viewport with Pan & Zoom */}
              <div
                ref={viewportRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className={`relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xs overflow-hidden min-h-[500px] flex items-center justify-center p-6 select-none ${
                  isPanning ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                {/* Pan/Zoom Indicator and quick reset */}
                {(panOffset.x !== 0 || panOffset.y !== 0 || zoomScale !== 1) && (
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 dark:bg-zinc-800/80 backdrop-blur-sm text-white text-xs font-mono shadow-xs">
                    <span>{Math.round(zoomScale * 100)}%</span>
                    <span className="text-zinc-400">
                      ({panOffset.x > 0 ? `+${Math.round(panOffset.x)}` : Math.round(panOffset.x)}, {panOffset.y > 0 ? `+${Math.round(panOffset.y)}` : Math.round(panOffset.y)})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetTransform();
                      }}
                      className="ml-1 text-indigo-300 hover:text-white cursor-pointer underline"
                      title="复位视口"
                    >
                      复位
                    </button>
                  </div>
                )}
                <div
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.12s ease-out',
                  }}
                  className="w-full flex items-center justify-center"
                >
                  <div ref={svgWrapperRef} className="w-full flex items-center justify-center pointer-events-auto" />
                </div>
              </div>

              {/* Canvas Legend Bar */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">连线图例:</span>
                  <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" />
                    <span>🔒 已锁定 (Locked)</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                    <span>✅ 已确认 (Confirmed)</span>
                  </span>
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                    <span>💡 建议 (Candidate)</span>
                  </span>
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full ring-2 ring-indigo-500" />
                    <span>🎯 当前聚焦</span>
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
                    <span>🌊 级联波及 (Ripple)</span>
                  </span>
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-400" />
                    <span>⬆️ 前置输入 (Dependency)</span>
                  </span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  提示：按住鼠标拖动画布平移、滚轮滑动/Ctrl+滚轮缩放，点击图上决策节点联动波及分析
                </span>
              </div>

              {/* Raw Mermaid DSL Drawer */}
              {showRawCode && (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400 pb-1.5 border-b border-zinc-800">
                    <span>Mermaid 拓扑流程图 DSL</span>
                    <button
                      onClick={handleCopyCode}
                      className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                    >
                      复制全部
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-3 rounded-lg bg-zinc-900/80 leading-relaxed text-emerald-400 text-[11px]">
                    {mermaidCode}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* Cards View: Hierarchical Decision Card List */
            <div className="space-y-3">
              {filteredNodes.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl text-zinc-500">
                  <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">没有匹配筛选条件的决策节点</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedStatus('all');
                      setSelectedArea('all');
                    }}
                    className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 underline cursor-pointer"
                  >
                    重置搜索与筛选
                  </button>
                </div>
              ) : (
                filteredNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isDownstreamOfSelected =
                    impactResult?.allTransitiveDependents.includes(node.id);

                  return (
                    <div
                      key={node.id}
                      onClick={() => handleSelectNode(node)}
                      className={`p-4 rounded-xl border transition cursor-pointer select-none ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                          : isDownstreamOfSelected
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60'
                          : node.isCycleParticipant
                          ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                              {node.id}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {node.area}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                node.status === 'locked'
                                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                  : node.status === 'confirmed'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {node.status}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">层深: {node.depth}</span>
                            {node.isCycleParticipant && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">
                                环路参与者
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                            {node.statement}
                          </p>

                          {/* Dependencies Badge & Downstream Count */}
                          <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {node.dependsOn.length > 0 ? (
                              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                <GitFork className="w-3 h-3" />
                                前置依赖: {node.dependsOn.join(', ')}
                              </span>
                            ) : (
                              <span className="text-zinc-500 dark:text-zinc-400">根决策 (Root)</span>
                            )}
                            <span>•</span>
                            <span>下游直接影响: {node.outDegree} 项</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectNode(node);
                          }}
                          className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium shrink-0 transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {isSelected ? '取消聚焦' : '级联影响'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right 1 Column: Cascade Impact Inspector */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <GitFork className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  级联波及分析器 (Cascade Impact)
                </h3>
              </div>
              {selectedNodeId && (
                <button
                  onClick={() => {
                    setSelectedNodeId(null);
                    setImpactResult(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  清除
                </button>
              )}
            </div>

            {impactLoading ? (
              <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                正在计算传递闭包与受影响领域...
              </div>
            ) : !selectedNodeId ? (
              <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 space-y-2">
                <Info className="w-6 h-6 mx-auto opacity-50 text-indigo-400" />
                <p className="text-xs leading-relaxed">
                  点击画布或列表中的任意决策节点，可立即透视该决策若发生修改或撤回时，将级联波及哪些下游决策与规范文档。
                </p>
              </div>
            ) : impactResult ? (
              <div className="space-y-4 text-xs">
                {/* Target Decision Summary */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">分析目标</span>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {impactResult.targetDecisionId}: {impactResult.targetStatement}
                  </p>
                </div>

                {/* Cyclic Risk Warning (if cycle detected in closure) */}
                {impactResult.hasCycleRisk && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>存在环路依赖风险 (Cyclic Dependency Risk)</span>
                    </div>
                    <p className="text-xs leading-relaxed text-red-600 dark:text-red-400">
                      该决策的依赖闭包中包含环路或互锁节点{impactResult.cycleNodes && impactResult.cycleNodes.length > 0 ? `：${impactResult.cycleNodes.join(', ')}` : ''}，修改或撤销时需注意解除依赖死锁。
                    </p>
                  </div>
                )}

                {/* Direct Dependents */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>直接下游依赖 ({impactResult.directDependents.length})</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">第一层传递</span>
                  </span>
                  {impactResult.directDependents.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">无直接下游决策</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {impactResult.directDependents.map((id) => (
                        <span
                          key={id}
                          className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* All Transitive Dependents */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                    <span>全量级联波及决策 ({impactResult.allTransitiveDependents.length})</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">传递闭包</span>
                  </span>
                  {impactResult.allTransitiveDependents.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">该决策为终端叶子节点，无传递涟漪</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {impactResult.allTransitiveDependents.map((id) => (
                        <span
                          key={id}
                          className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-mono text-xs"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Impacted Areas */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    波及架构领域 ({impactResult.impactedAreas.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {impactResult.impactedAreas.map((area) => (
                      <span
                        key={area}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Impacted Document Specs */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    需联动重新编译的规格文档 ({impactResult.impactedDocuments.length})
                  </span>
                  <div className="space-y-1 mt-1">
                    {impactResult.impactedDocuments.map((doc) => (
                      <div
                        key={doc}
                        className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-[11px] text-zinc-700 dark:text-zinc-300"
                      >
                        <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="font-mono">{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
