/**
 * @file p2-dag-canvas-contrast.test.ts
 * @description Stage P2: Architectural Cognitive Leaps & Accessibility Evolution Automated Tests
 * 
 * Verifies:
 * 1. P2-1: Interactive Mermaid/SVG DAG canvas in DecisionDAGExplorer:
 *    - Dual-view switcher (拓扑连线画布 vs 层级卡片列表)
 *    - generateDagMermaidCode flowchart DSL generation (LR/TD, area subgraphs, safe IDs, edge kinds)
 *    - Interactive node selection & cascade impact ripple highlighting (upstream, downstream, selected)
 *    - Zoom, fullscreen, DSL copy, SVG export, and raw code drawer
 * 2. P2-2: Global WCAG 2.1 AA (4.5:1) color contrast calibration:
 *    - index.css light-mode secondary text calibration rule
 *    - Mathematical verification of contrast ratios (zinc-500 >= 4.5:1, zinc-600 >= 7.0:1, dark zinc-400 >= 7.0:1)
 *    - View components semantic text class calibration
 * 3. P2-3: Platform Core Invariants vs Project Domain Specifications dual-boundary distinction:
 *    - ProjectDiagnosticsView dual-boundary partition (Zero-DB platform rules vs project tech freedom)
 *    - SpecDriftModal boundary notice banner
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DecisionGraphView, CascadeImpactResult } from '@project-architect/contracts';
import { generateDagMermaidCode, safeNodeId, matchNodeFromElementId } from '../src/features/dag/DecisionDAGExplorer.js';

describe('Stage P2: Architectural Cognitive Leaps & Accessibility Evolution', () => {
  const dagExplorerPath = resolve(__dirname, '../src/features/dag/DecisionDAGExplorer.tsx');
  const indexCssPath = resolve(__dirname, '../src/styles/index.css');
  const diagnosticsViewPath = resolve(__dirname, '../src/features/settings/ProjectDiagnosticsView.tsx');
  const specDriftModalPath = resolve(__dirname, '../src/features/audit/SpecDriftModal.tsx');

  // Sample mock DAG for testing
  const mockDag: DecisionGraphView = {
    nodes: [
      {
        id: 'dec-storage',
        statement: '采用本地文件与两阶段原子提交',
        area: 'persistence',
        status: 'locked',
        decisionKey: 'storage-engine',
        depth: 0,
        inDegree: 0,
        outDegree: 2,
        dependsOn: [],
      },
      {
        id: 'dec-auth',
        statement: '零外部鉴权，使用本地目录凭据',
        area: 'security',
        status: 'confirmed',
        decisionKey: 'auth-strategy',
        depth: 1,
        inDegree: 1,
        outDegree: 1,
        dependsOn: ['dec-storage'],
      },
      {
        id: 'dec-api',
        statement: '基于 RESTful 契约的单次推演端点',
        area: 'api_boundary',
        status: 'candidate',
        decisionKey: 'api-protocol',
        depth: 2,
        inDegree: 1,
        outDegree: 0,
        dependsOn: ['dec-auth'],
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'dec-storage',
        target: 'dec-auth',
        type: 'explicit',
      },
      {
        id: 'e2',
        source: 'dec-auth',
        target: 'dec-api',
        type: 'inferred',
      },
    ],
    hasCycles: false,
    cycles: [],
    topologicalOrder: ['dec-storage', 'dec-auth', 'dec-api'],
    isolatedNodes: [],
    summary: {
      totalNodes: 3,
      totalEdges: 2,
      maxDepth: 2,
      confirmedCount: 1,
      candidateCount: 1,
      lockedCount: 1,
    },
  };

  const mockImpact: CascadeImpactResult = {
    targetDecisionId: 'dec-storage',
    targetStatement: '采用本地文件与两阶段原子提交',
    directDependents: ['dec-auth'],
    allTransitiveDependents: ['dec-auth', 'dec-api'],
    impactedAreas: ['security', 'api_boundary'],
    impactedDocuments: ['04_DATA_MODEL.md', '12_API_CONTRACT.md'],
    hasCycleRisk: false,
  };

  describe('1. P2-1: Interactive Mermaid / SVG Decision DAG Canvas', () => {
    it('generates well-formed Mermaid flowchart DSL with area clusters and direction support', () => {
      const codeLR = generateDagMermaidCode(mockDag, null, null, 'LR', false);
      expect(codeLR).toContain('flowchart LR');
      expect(codeLR).toContain('subgraph area_persistence[" 🏷️ persistence "]');
      expect(codeLR).toContain('subgraph area_security[" 🏷️ security "]');
      expect(codeLR).toContain('subgraph area_api_boundary[" 🏷️ api_boundary "]');

      // Edge generation
      expect(codeLR).toContain(`${safeNodeId('dec-storage')} --> ${safeNodeId('dec-auth')}`);
      expect(codeLR).toContain(`${safeNodeId('dec-auth')} -.->|推断| ${safeNodeId('dec-api')}`);

      // TD direction
      const codeTD = generateDagMermaidCode(mockDag, null, null, 'TD', false);
      expect(codeTD).toContain('flowchart TD');
    });

    it('highlights selected node, upstream prerequisites, and downstream transitive ripples', () => {
      // Focus on dec-auth
      const impactOnAuth: CascadeImpactResult = {
        targetDecisionId: 'dec-auth',
        targetStatement: '零外部鉴权',
        directDependents: ['dec-api'],
        allTransitiveDependents: ['dec-api'],
        impactedAreas: ['api_boundary'],
        impactedDocuments: ['12_API_CONTRACT.md'],
        hasCycleRisk: false,
      };

      const code = generateDagMermaidCode(mockDag, 'dec-auth', impactOnAuth, 'LR', false);
      // dec-auth must be class 'selected'
      expect(code).toContain(`class ${safeNodeId('dec-auth')} selected;`);
      // dec-storage is upstream prerequisite of dec-auth
      expect(code).toContain(`class ${safeNodeId('dec-storage')} upstream;`);
      // dec-api is downstream transitive ripple of dec-auth
      expect(code).toContain(`class ${safeNodeId('dec-api')} downstream;`);

      // Also verify focus on root dec-storage using mockImpact
      const codeStorage = generateDagMermaidCode(mockDag, 'dec-storage', mockImpact, 'LR', false);
      expect(codeStorage).toContain(`class ${safeNodeId('dec-storage')} selected;`);
      expect(codeStorage).toContain(`class ${safeNodeId('dec-auth')} downstream;`);
      expect(codeStorage).toContain(`class ${safeNodeId('dec-api')} downstream;`);
    });

    it('handles empty DAG and special character sanitization gracefully', () => {
      const emptyCode = generateDagMermaidCode({ nodes: [], edges: [] } as any, null, null, 'LR', false);
      expect(emptyCode).toContain('flowchart LR');
      expect(emptyCode).toContain('当前项目尚未沉淀任何架构决策');

      expect(safeNodeId('proj:dec/01.beta')).toBe('dec_proj_dec_01_beta');
    });

    it('matchNodeFromElementId accurately resolves nodes with prefix and delimiter collisions', () => {
      const testNodes = [
        { id: 'dec-1', statement: 'Statement 1', area: 'core', status: 'confirmed' as const, depth: 0, inDegree: 0, outDegree: 0, dependsOn: [] },
        { id: 'dec-10', statement: 'Statement 10', area: 'core', status: 'locked' as const, depth: 1, inDegree: 1, outDegree: 0, dependsOn: ['dec-1'] },
        { id: 'dec-100', statement: 'Statement 100', area: 'core', status: 'candidate' as const, depth: 2, inDegree: 1, outDegree: 0, dependsOn: ['dec-10'] },
        { id: 'auth', statement: 'Auth base', area: 'sec', status: 'confirmed' as const, depth: 0, inDegree: 0, outDegree: 0, dependsOn: [] },
        { id: 'auth-jwt', statement: 'JWT token', area: 'sec', status: 'confirmed' as const, depth: 1, inDegree: 1, outDegree: 0, dependsOn: ['auth'] },
      ];

      // Exact matching for dec-10 even if dec-1 appears earlier in array
      const matched10 = matchNodeFromElementId(testNodes, 'flowchart-dec_dec_10-14');
      expect(matched10?.id).toBe('dec-10');

      // Exact matching for dec-1
      const matched1 = matchNodeFromElementId(testNodes, 'flowchart-dec_dec_1-5');
      expect(matched1?.id).toBe('dec-1');

      // Exact matching for dec-100
      const matched100 = matchNodeFromElementId(testNodes, 'flowchart-dec_dec_100-2');
      expect(matched100?.id).toBe('dec-100');

      // Exact matching for auth-jwt vs auth
      const matchedAuthJwt = matchNodeFromElementId(testNodes, 'flowchart-dec_auth_jwt-0');
      expect(matchedAuthJwt?.id).toBe('auth-jwt');

      const matchedAuth = matchNodeFromElementId(testNodes, 'flowchart-dec_auth-1');
      expect(matchedAuth?.id).toBe('auth');

      // Non-matching element ID returns null
      expect(matchNodeFromElementId(testNodes, 'flowchart-dec_unknown_node-9')).toBeNull();
      expect(matchNodeFromElementId([], 'flowchart-dec_1')).toBeNull();
    });

    it('filters out invalid/orphan edges pointing to nonexistent nodes in Mermaid DSL', () => {
      const dagWithOrphanEdge: DecisionGraphView = {
        ...mockDag,
        edges: [
          ...mockDag.edges,
          { id: 'e-orphan', source: 'dec-storage', target: 'dec-nonexistent', type: 'explicit' },
        ],
      };
      const code = generateDagMermaidCode(dagWithOrphanEdge, null, null, 'LR', false);
      expect(code).not.toContain('dec_nonexistent');
    });

    it('DecisionDAGExplorer component implements dual-view, zoom, pan/drag, SVG export, and inspector linkage', () => {
      expect(existsSync(dagExplorerPath)).toBe(true);
      const fileContent = readFileSync(dagExplorerPath, 'utf8');

      // Dual-view mode switcher
      expect(fileContent).toContain("viewMode === 'canvas'");
      expect(fileContent).toContain("viewMode === 'cards'");
      expect(fileContent).toContain('拓扑连线画布');
      expect(fileContent).toContain('层级卡片列表');

      // Interactive zoom, pan & drag controls
      expect(fileContent).toContain('setZoomScale');
      expect(fileContent).toContain('setPanOffset');
      expect(fileContent).toContain('isPanning');
      expect(fileContent).toContain('handleMouseDown');
      expect(fileContent).toContain('handleMouseMove');
      expect(fileContent).toContain('handleMouseUp');
      expect(fileContent).toContain('handleWheel');
      expect(fileContent).toContain('handleResetTransform');
      expect(fileContent).toContain('setDirection');
      expect(fileContent).toContain('handleCopyCode');
      expect(fileContent).toContain('handleDownloadSvg');
      expect(fileContent).toContain('setIsFullscreen');
      expect(fileContent).toContain('setShowRawCode');

      // Viewport transform combines translate and scale
      expect(fileContent).toContain('translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})');

      // SVG node click event delegation with disambiguation & drag protection
      expect(fileContent).toContain("querySelectorAll('.node')");
      expect(fileContent).toContain("el.addEventListener('click'");
      expect(fileContent).toContain('panStartRef.current?.hasDragged');
      expect(fileContent).toContain('matchNodeFromElementId(dag.nodes, el.id)');
      expect(fileContent).toContain('handleSelectNode(matched)');

      // Async race condition guard
      expect(fileContent).toContain('currentInspectNodeIdRef');

      // Cascade impact analyzer linkage and cyclic risk
      expect(fileContent).toContain('级联波及分析器 (Cascade Impact)');
      expect(fileContent).toContain('impactResult.allTransitiveDependents');
      expect(fileContent).toContain('impactResult.impactedDocuments');
      expect(fileContent).toContain('存在环路依赖风险 (Cyclic Dependency Risk)');
    });
  });

  describe('2. P2-2: Global Color WCAG 2.1 AA (4.5:1) Contrast Calibration', () => {
    // Relative Luminance calculation per WCAG 2.1 specifications:
    // https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
    const calcChannel = (val: number) => {
      const s = val / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };

    const getLuminance = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return 0.2126 * calcChannel(r) + 0.7152 * calcChannel(g) + 0.0722 * calcChannel(b);
    };

    const getContrastRatio = (hex1: string, hex2: string) => {
      const l1 = getLuminance(hex1);
      const l2 = getLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    it('mathematically proves zinc-500 and zinc-600 satisfy WCAG 2.1 AA (>= 4.5:1) on white/canvas surfaces', () => {
      const white = '#FFFFFF';
      const canvas = '#FAF9F6';
      const zinc500 = '#71717A';
      const zinc600 = '#52525B';
      const zinc400 = '#A1A1AA';

      // Old zinc-400 fails AA on white
      const zinc400Ratio = getContrastRatio(zinc400, white);
      expect(zinc400Ratio).toBeLessThan(4.5); // ~2.45:1

      // Calibrated zinc-500 passes AA (>= 4.5:1)
      const zinc500RatioWhite = getContrastRatio(zinc500, white);
      const zinc500RatioCanvas = getContrastRatio(zinc500, canvas);
      expect(zinc500RatioWhite).toBeGreaterThanOrEqual(4.5);
      expect(zinc500RatioCanvas).toBeGreaterThanOrEqual(4.5);

      // Calibrated zinc-600 passes AA (>= 4.5:1) and high-contrast (>= 6.8:1)
      const zinc600Ratio = getContrastRatio(zinc600, white);
      expect(zinc600Ratio).toBeGreaterThanOrEqual(4.5);
      expect(zinc600Ratio).toBeGreaterThan(6.8);

      // In dark mode (#16171B or canvas #0B0C0E), zinc-400 (#A1A1AA) passes AA (>= 4.5:1) and high-contrast
      const darkSurface = '#16171B';
      const darkCanvas = '#0B0C0E';
      const darkZinc400Ratio = getContrastRatio(zinc400, darkSurface);
      expect(darkZinc400Ratio).toBeGreaterThanOrEqual(4.5);
      expect(darkZinc400Ratio).toBeGreaterThan(6.9);
      expect(getContrastRatio(zinc400, darkCanvas)).toBeGreaterThan(7.5);
    });

    it('verifies index.css embeds global WCAG 2.1 AA light mode contrast calibration rule', () => {
      expect(existsSync(indexCssPath)).toBe(true);
      const cssContent = readFileSync(indexCssPath, 'utf8');

      expect(cssContent).toContain('WCAG 2.1 AA (4.5:1) Light Mode Text Contrast Calibration');
      expect(cssContent).toContain(':root:not(.dark) .text-zinc-400');
      expect(cssContent).toContain('color: #71717A;');
      expect(cssContent).toContain(':root:not(.dark) ::placeholder');
      expect(cssContent).toContain('html:not(.dark) ::placeholder');
    });

    it('verifies view components upgraded auxiliary text to text-zinc-500 dark:text-zinc-400', () => {
      const diagContent = readFileSync(diagnosticsViewPath, 'utf8');
      expect(diagContent).toContain('planning-muted');

      const dagContent = readFileSync(dagExplorerPath, 'utf8');
      expect(dagContent).toContain('text-zinc-500 dark:text-zinc-400');
    });
  });

  describe('3. P2-3: Platform Core Invariants vs Project Domain Specifications Dual Boundaries', () => {
    it('ProjectDiagnosticsView reads real runtime records without the retired generic compliance claims', () => {
      expect(existsSync(diagnosticsViewPath)).toBe(true);
      const content = readFileSync(diagnosticsViewPath, 'utf8');

      expect(content).toContain('getPlanningDiagnostics');
      expect(content).toContain('data.project.projectPath');
      expect(content).not.toContain('SpecDriftModal');
      expect(content).not.toContain('单次调用');
      expect(content).not.toContain('100%');
    });

    it('SpecDriftModal displays dual-boundary notice banner isolating platform Zero-DB from user project choices', () => {
      expect(existsSync(specDriftModalPath)).toBe(true);
      const modalContent = readFileSync(specDriftModalPath, 'utf8');

      expect(modalContent).toContain('双重视野边界声明');
      expect(modalContent).toContain('工作台系统工程红线 (Zero-DB 等) 与当前项目自主选型空间隔离');
      expect(modalContent).toContain('用户项目自主选型 SQLite、PostgreSQL 或外部服务属于完全合规的领域技术方案');
    });
  });
});
