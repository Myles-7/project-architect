import { describe, it, expect } from 'vitest';
import type { ProjectSnapshot } from '@project-architect/contracts';
import { StandaloneHtmlExporter } from '../src/export/StandaloneHtmlExporter.js';

describe('StandaloneHtmlExporter', () => {
  const mockSnapshot: ProjectSnapshot = {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-offline-export',
      name: 'AirGapped System Architect',
      stage: 'approved',
      stateRevision: 5,
      projectTags: ['offline', 'defense', 'local-first'],
      inputRefs: [],
      createdAt: '2026-09-24T10:00:00Z',
      updatedAt: '2026-09-24T10:00:00Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-offline-export',
      sections: [],
      updatedAt: '2026-09-24T10:00:00Z',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-offline-export',
      items: [
        {
          id: 'dec-1',
          area: 'technical_boundary',
          statement: 'Zero external telemetry or CDN dependencies.',
          status: 'locked',
          origin: 'user',
          evidenceRefs: [],
          rationale: 'Defense & privacy compliance.',
          createdAt: '2026-09-24T10:00:00Z',
          updatedAt: '2026-09-24T10:00:00Z',
        },
      ],
      updatedAt: '2026-09-24T10:00:00Z',
    },
    assumptions: { schemaVersion: 1, projectId: 'proj-offline-export', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    gaps: { schemaVersion: 1, projectId: 'proj-offline-export', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    risks: { schemaVersion: 1, projectId: 'proj-offline-export', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    questions: { schemaVersion: 1, projectId: 'proj-offline-export', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-offline-export',
      stage: 'approved',
      overallScore: 100,
      areas: [],
      checklists: [],
      blockers: [],
      updatedAt: '2026-09-24T10:00:00Z',
    },
  };

  const sampleDocs = [
    {
      title: 'AGENTS.md',
      path: 'AGENTS.md',
      content: '# AGENTS.md\n\n## 1. Absolute Rules\n\n- No external databases\n- Local file commits\n',
    },
    {
      title: 'PROJECT.md',
      path: 'docs/PROJECT.md',
      content: '# PROJECT.md\n\n| Item | Value |\n|---|---|\n| Target | Air-Gapped Architect |\n',
    },
  ];

  it('generates a single self-contained HTML file with embedded styling and search', () => {
    const result = StandaloneHtmlExporter.export({
      snapshot: mockSnapshot,
      documents: sampleDocs,
      diagrams: [
        {
          id: 'diag-1',
          type: 'system-context',
          title: 'System Context',
          description: 'Context diagram',
          mermaidCode: 'flowchart TD\nUser --> App',
          generatedAt: '2026-09-24T10:00:00Z',
        },
      ],
    });

    expect(result.filename).toBe('proj-offline-export-spec-bundle.html');
    expect(result.totalDocuments).toBe(2);
    expect(result.sizeBytes).toBeGreaterThan(1000);

    const html = result.html;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AirGapped System Architect');
    expect(html).toContain('AGENTS.md');
    expect(html).toContain('PROJECT.md');
    expect(html).toContain('Zero external telemetry');
    expect(html).toContain('flowchart TD');
    expect(html).toContain('filterContent()');
    expect(html).toContain('switchDoc(');

    // Verify CDN priority and offline fallback degradation
    expect(html).toContain('https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js');
    expect(html).toContain('dsl-fallback');
    expect(html).toContain('dsl-fallback-notice');
    expect(html).toContain('已降级为 Mermaid DSL 源码');
    expect(html).toContain('copyDslCode');
    expect(html).toContain('renderMermaidDiagrams()');
    expect(html).toContain('showDiagramsView(event)');
    expect(html).toContain('showDecisionsView(event)');

    // Ensure artifact remains ultra-lightweight (< 400KB)
    expect(result.sizeBytes).toBeLessThan(400 * 1024);
  });

  it('safely escapes </script> tags and HTML special chars in decision statements to prevent XSS and broken bundles', () => {
    const dangerousSnapshot: ProjectSnapshot = {
      ...mockSnapshot,
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-offline-export',
        items: [
          {
            id: 'dec-xss',
            area: 'security',
            statement: 'Test </script><script>alert("xss")</script> & Map<String, Object>',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            rationale: '<b>Bold Tradeoff</b> & quotes "test"',
            createdAt: '2026-09-24T10:00:00Z',
            updatedAt: '2026-09-24T10:00:00Z',
          },
        ],
        updatedAt: '2026-09-24T10:00:00Z',
      },
    };

    const result = StandaloneHtmlExporter.export({
      snapshot: dangerousSnapshot,
      documents: sampleDocs,
    });

    const html = result.html;
    // The literal unescaped closing script tag should NOT exist inside the embedded JSON data
    expect(html).not.toContain('</script><script>alert');
    // It should be safely escaped as <\/script
    expect(html).toContain('<\\/script><script>alert');
    // Function escapeHtml must be defined in the script
    expect(html).toContain('function escapeHtml(str)');
  });
});
