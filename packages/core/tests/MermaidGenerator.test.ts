import { describe, it, expect } from 'vitest';
import type { ProjectSnapshot } from '@project-architect/contracts';
import { MermaidGenerator, formatSafeName } from '../src/diagrams/MermaidGenerator.js';

describe('MermaidGenerator', () => {
  const mockSnapshot: ProjectSnapshot = {
    metadata: {
      schemaVersion: 1,
      projectId: 'proj-mermaid-test',
      name: 'CloudSync Studio',
      stage: 'broad-pass',
      stateRevision: 4,
      projectTags: ['cloud', 'sync'],
      inputRefs: [],
      createdAt: '2026-09-24T10:00:00Z',
      updatedAt: '2026-09-24T10:00:00Z',
    },
    overview: {
      schemaVersion: 1,
      projectId: 'proj-mermaid-test',
      sections: [
        { id: 'project_overview', title: 'Overview', kind: 'fixed', maturity: 'clear', itemRefs: [] },
        { id: 'mvp_scope', title: 'MVP Scope', kind: 'fixed', maturity: 'mostly-clear', itemRefs: [] },
        { id: 'technical_boundary', title: 'Tech Boundary', kind: 'fixed', maturity: 'locked', itemRefs: [] },
      ],
      updatedAt: '2026-09-24T10:00:00Z',
    },
    decisions: {
      schemaVersion: 1,
      projectId: 'proj-mermaid-test',
      items: [
        {
          id: 'dec-1',
          area: 'technical_boundary',
          statement: 'Use SQLite WAL mode',
          status: 'confirmed',
          origin: 'user',
          evidenceRefs: [],
          createdAt: '2026-09-24T10:00:00Z',
          updatedAt: '2026-09-24T10:00:00Z',
        },
      ],
      updatedAt: '2026-09-24T10:00:00Z',
    },
    assumptions: { schemaVersion: 1, projectId: 'proj-mermaid-test', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    gaps: { schemaVersion: 1, projectId: 'proj-mermaid-test', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    risks: { schemaVersion: 1, projectId: 'proj-mermaid-test', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    questions: { schemaVersion: 1, projectId: 'proj-mermaid-test', items: [], updatedAt: '2026-09-24T10:00:00Z' },
    readiness: {
      schemaVersion: 1,
      projectId: 'proj-mermaid-test',
      stage: 'broad-pass',
      overallScore: 80,
      areas: [],
      checklists: [],
      blockers: [],
      updatedAt: '2026-09-24T10:00:00Z',
    },
  };

  it('generates 4 valid diagrams with proper titles and non-empty mermaidCode', () => {
    const result = MermaidGenerator.generateDiagrams(mockSnapshot);

    expect(result.projectId).toBe('proj-mermaid-test');
    expect(result.diagrams.length).toBe(4);

    const contextDiag = result.diagrams.find((d) => d.type === 'system-context')!;
    const flowDiag = result.diagrams.find((d) => d.type === 'component-flow')!;
    const seqDiag = result.diagrams.find((d) => d.type === 'sequence-interaction')!;
    const govDiag = result.diagrams.find((d) => d.type === 'boundary-governance')!;

    expect(contextDiag.mermaidCode).toContain('flowchart TD');
    expect(contextDiag.mermaidCode).toContain('CloudSync Studio Architecture Boundary');
    expect(contextDiag.mermaidCode).toContain('Use SQLite WAL mode');
    expect(contextDiag.mermaidCode).not.toContain('Two-Stage Commits');
    expect(contextDiag.mermaidCode).not.toContain('Atomic State Commit');
    expect(contextDiag.mermaidCode).not.toContain('Projection Layer');

    expect(flowDiag.mermaidCode).toContain('flowchart LR');
    expect(flowDiag.mermaidCode).toContain('ClientLayer');
    expect(flowDiag.mermaidCode).toContain('DataLayer');

    expect(seqDiag.mermaidCode).toContain('sequenceDiagram');
    expect(seqDiag.mermaidCode).toContain('User / Client');
    expect(seqDiag.mermaidCode).toContain('Use SQLite WAL mode');
    expect(seqDiag.mermaidCode).not.toContain('Discovery Agent');
    expect(seqDiag.mermaidCode).not.toContain('Single Structured Discovery Call');
    expect(seqDiag.mermaidCode).not.toContain('Phase 1: Write State to .tmp');

    expect(govDiag.mermaidCode).toContain('flowchart TD');
    expect(govDiag.mermaidCode).toContain('BoundaryRules');
    expect(govDiag.mermaidCode).toContain('Use SQLite WAL mode');
    expect(govDiag.mermaidCode).not.toContain('Zero Centralized DB');
    expect(govDiag.mermaidCode).not.toContain('B3 Single Structured Turn');
  });

  it('P1-1 & P1-2: models component flow from explicit dependsOn and extracts metadata constraints', () => {
    const dagSnapshot: ProjectSnapshot = {
      ...mockSnapshot,
      metadata: {
        ...mockSnapshot.metadata,
        name: 'Distributed Mesh',
        constraints: 'Zero cloud leaks; End-to-end encryption required',
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-mermaid-test',
        items: [
          {
            id: 'dec-ui',
            area: 'frontend',
            statement: 'React 19 Spatial Workspace',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            dependsOn: ['dec-gateway'],
            createdAt: '2026-09-24T10:00:00Z',
            updatedAt: '2026-09-24T10:00:00Z',
          },
          {
            id: 'dec-gateway',
            area: 'gateway',
            statement: 'Local Fastify Gateway',
            status: 'locked',
            origin: 'user',
            evidenceRefs: [],
            createdAt: '2026-09-24T10:00:00Z',
            updatedAt: '2026-09-24T10:00:00Z',
          },
        ],
        updatedAt: '2026-09-24T10:00:00Z',
      },
    };

    const result = MermaidGenerator.generateDiagrams(dagSnapshot);
    const flowDiag = result.diagrams.find((d) => d.type === 'component-flow')!;
    const govDiag = result.diagrams.find((d) => d.type === 'boundary-governance')!;

    // P1-2: Component flow correctly links dec-gateway -> dec-ui based on dependsOn
    expect(flowDiag.mermaidCode).toContain('Dec_dec_gateway -->|依赖/调用| Dec_dec_ui');
    expect(flowDiag.mermaidCode).not.toContain('Area_project_overview --> Area_mvp_scope');

    // P1-1: Boundary governance contains metadata constraints and no host meta rules
    expect(govDiag.mermaidCode).toContain('Zero cloud leaks');
    expect(govDiag.mermaidCode).toContain('End-to-end encryption required');
    expect(govDiag.mermaidCode).not.toContain('Zero Centralized DB');
    expect(govDiag.mermaidCode).not.toContain('B3 Single Structured Turn');
  });

  it('intelligently truncates excessively long project names in diagram boundaries (P1-4)', () => {
    const longSnapshot: ProjectSnapshot = {
      ...mockSnapshot,
      metadata: {
        ...mockSnapshot.metadata,
        name: '双人实时互动同居室(包含情侣空间/房产虚拟搭建/同步影音/远程桌面等扩展)',
      },
    };

    const result = MermaidGenerator.generateDiagrams(longSnapshot);
    const contextDiag = result.diagrams.find((d) => d.type === 'system-context')!;

    // Must be safely truncated with '...' and not exceed reasonable width
    expect(contextDiag.mermaidCode).toContain('...');
    expect(contextDiag.mermaidCode).toContain('Architecture Boundary');
    expect(contextDiag.mermaidCode).not.toContain('远程桌面等扩展');
  });

  it('handles edge cases: null/undefined, surrogate pairs, emojis and backslashes', () => {
    // Null, undefined, empty safety
    expect(formatSafeName(undefined as any)).toBe('');
    expect(formatSafeName(null as any)).toBe('');
    expect(formatSafeName('')).toBe('');

    // Emojis and surrogate pairs: must not split emoji in half
    const emojiName = '123456789012345🚀extra';
    const truncatedEmoji = formatSafeName(emojiName, 16);
    expect(truncatedEmoji).toBe('123456789012345🚀...');
    // Ensure no orphan surrogate (code point range D800-DFFF) at the end of truncated base
    const baseWithoutDots = truncatedEmoji.slice(0, -3);
    const lastCode = baseWithoutDots.charCodeAt(baseWithoutDots.length - 1);
    expect(lastCode).not.toBe(0xd83d); // High surrogate of 🚀

    // Backslash stripping and special characters
    const backslashSnapshot: ProjectSnapshot = {
      ...mockSnapshot,
      metadata: {
        ...mockSnapshot.metadata,
        name: 'Windows\\Path\\Project\\',
      },
      decisions: {
        schemaVersion: 1,
        projectId: 'proj-mermaid-test',
        items: [
          {
            id: 'dec-1',
            area: 'technical_boundary',
            statement: 'Root path is C:\\App\\',
            status: 'confirmed',
            origin: 'user',
            evidenceRefs: [],
            createdAt: '2026-09-24T10:00:00Z',
            updatedAt: '2026-09-24T10:00:00Z',
          },
        ],
        updatedAt: '2026-09-24T10:00:00Z',
      },
    };

    const diag = MermaidGenerator.generateDiagrams(backslashSnapshot);
    const contextDiag = diag.diagrams.find((d) => d.type === 'system-context')!;
    // Trailing backslash in boundary name or statement must NOT escape Mermaid quotes
    expect(contextDiag.mermaidCode).not.toContain('\\"');
    expect(contextDiag.mermaidCode).toContain('Windows Path Pro...');
    expect(contextDiag.mermaidCode).toContain('Root path is C: App');
  });
});
