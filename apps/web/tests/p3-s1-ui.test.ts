/**
 * @file p3-s1-ui.test.ts
 * @description Stage S1 Web UI Verification: Presets, Decision DAG Explorer, Live Mermaid Architecture Diagrams
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultApiClient } from '../src/api/client.js';

describe('Stage S1 Web UI Verification', () => {
  const dagExplorerPath = resolve(__dirname, '../src/features/dag/DecisionDAGExplorer.tsx');
  const diagramsViewPath = resolve(__dirname, '../src/features/diagrams/ArchitectureDiagramsView.tsx');
  const homeViewPath = resolve(__dirname, '../src/app/HomeView.tsx');
  const workspaceViewPath = resolve(__dirname, '../src/app/WorkspaceView.tsx');
  const leftSidebarPath = resolve(__dirname, '../src/components/layout/LeftSidebar.tsx');
  const shortcutsPath = resolve(__dirname, '../src/hooks/useGlobalShortcuts.ts');

  it('1. Verifies DecisionDAGExplorer component exists and implements required DAG features', () => {
    expect(existsSync(dagExplorerPath)).toBe(true);
    const code = readFileSync(dagExplorerPath, 'utf8');

    // API integration
    expect(code).toContain('getProjectDag');
    expect(code).toContain('getDecisionCascadeImpact');

    // UI elements
    expect(code).toContain('决策依赖有向无环图');
    expect(code).toContain('级联波及分析器');
    expect(code).toContain('Circular Dependency Detected');
    expect(code).toContain('summary.maxDepth');
    expect(code).toContain('impactResult.allTransitiveDependents');
    expect(code).toContain('impactResult.impactedDocuments');
  });

  it('2. Verifies ArchitectureDiagramsView component exists and renders dynamic Mermaid diagrams', () => {
    expect(existsSync(diagramsViewPath)).toBe(true);
    const code = readFileSync(diagramsViewPath, 'utf8');

    // Mermaid library & API integration
    expect(code).toContain("import mermaid from 'mermaid'");
    expect(code).toContain('getArchitectureDiagrams');

    // Interactive zoom, copy, download, raw DSL controls
    expect(code).toContain('setZoomScale');
    expect(code).toContain('handleCopyCode');
    expect(code).toContain('handleDownloadSvg');
    expect(code).toContain('showRawCode');
    expect(code).toContain('mermaid.render');
  });

  it('3. Verifies HomeView embeds curated presets selector with preview and tags', () => {
    expect(existsSync(homeViewPath)).toBe(true);
    const code = readFileSync(homeViewPath, 'utf8');

    expect(code).toContain('getPresets');
    expect(code).toContain('selectedPresetId');
    expect(code).toContain('架构参考');
    expect(code).toContain('preset.category');
    expect(code).toContain('onCreateProject');
  });

  it('4. Keeps historical tab aliases but removes dynamic diagram navigation from the formal workspace', () => {
    expect(existsSync(workspaceViewPath)).toBe(true);
    expect(existsSync(leftSidebarPath)).toBe(true);

    const wsCode = readFileSync(workspaceViewPath, 'utf8');
    expect(wsCode).toContain("case 'dag':");
    expect(wsCode).not.toContain('<DecisionDAGExplorer');
    expect(wsCode).toContain("case 'diagrams':");
    expect(wsCode).not.toContain('<ArchitectureDiagramsView');

    const sbCode = readFileSync(leftSidebarPath, 'utf8');
    expect(sbCode).not.toContain("id: 'dag'");
    expect(sbCode).not.toContain("id: 'diagrams'");
  });

  it('5. Limits keyboard workspace switching to four current destinations', () => {
    expect(existsSync(shortcutsPath)).toBe(true);
    const code = readFileSync(shortcutsPath, 'utf8');

    expect(code).toContain("e.key >= '1' && e.key <= '4'");
    expect(code).not.toContain("  'dag',");
    expect(code).not.toContain("  'diagrams',");
  });

  it('6. Verifies defaultApiClient exposes all 5 new Stage S1 endpoints', () => {
    expect(typeof defaultApiClient.getPresets).toBe('function');
    expect(typeof defaultApiClient.getPreset).toBe('function');
    expect(typeof defaultApiClient.getProjectDag).toBe('function');
    expect(typeof defaultApiClient.getDecisionCascadeImpact).toBe('function');
    expect(typeof defaultApiClient.getArchitectureDiagrams).toBe('function');
  });

  it('7. Removes legacy lifecycle and diagram claims from the formal header', () => {
    const topNavPath = resolve(__dirname, '../src/components/layout/TopNav.tsx');
    expect(existsSync(topNavPath)).toBe(true);
    const code = readFileSync(topNavPath, 'utf8');

    expect(code).not.toContain('WorkflowStepper');
    expect(code).not.toContain('StageBadge');
    expect(code).not.toContain('toggleOverview');
  });

  it('8. Verifies DecisionDAGExplorer provides guided empty state for newly created projects', () => {
    const code = readFileSync(dagExplorerPath, 'utf8');
    expect(code).toContain('当前项目尚未沉淀任何架构决策');
    expect(code).toContain('前往构思与澄清对话');
    expect(code).toContain("setActiveTab('chat')");
  });
});
