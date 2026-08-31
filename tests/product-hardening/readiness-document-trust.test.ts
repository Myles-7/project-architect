import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../../apps/server/src/server.js';
import {
  FileStorage,
  WorkspaceGuard,
  ProjectStateEngine,
  ReadinessGate,
  ReadinessActionPolicy,
  readinessProjection,
  DocumentPlanner,
  DocumentCompiler,
  DocumentExportService,
} from '@project-architect/core';
import { CORE_DISCOVERY_AREA_IDS } from '@project-architect/contracts';

describe('Product Hardening Phase 5: Readiness & Document Delivery Trust', () => {
  let tempBaseDir: string;
  let workspaceRoot: string;
  let guard: WorkspaceGuard;
  let storage: FileStorage;
  let stateEngine: ProjectStateEngine;
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-p5-trust-'));
    workspaceRoot = join(tempBaseDir, 'workspace');
    guard = new WorkspaceGuard(workspaceRoot);
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage, guard);

    const app = createApp({
      engine: stateEngine,
      guard,
      workspaceRoot,
      useMockAI: true,
    });

    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server!.close(resolve));
    }
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  describe('5.2 Unified Eight Areas, Coverage vs Credibility', () => {
    it('Readiness areas evaluate strictly CORE_DISCOVERY_AREA_IDS with Chinese titles', async () => {
      const projectPath = join(workspaceRoot, 'projects', 'proj-areas-test');
      await stateEngine.createProject({
        name: 'Area Test App',
        idea: 'Testing areas and Chinese titles',
        projectId: 'proj-areas-test',
        projectPath,
      });

      const snapshot = await stateEngine.loadProject(projectPath);
      const view = readinessProjection(snapshot);

      expect(view.areas).toHaveLength(8);
      const areaIds = view.areas.map((a) => a.areaId);
      expect(areaIds).toEqual([...CORE_DISCOVERY_AREA_IDS]);

      // Check all titles are Chinese
      for (const area of view.areas) {
        expect(area.title).toBeTruthy();
        expect(/[\u4e00-\u9fa5]/.test(area.title)).toBe(true);
      }
    });

    it('Assumptions strictly penalize or maintain credibility, and NEVER increase score', async () => {
      const projectPath = join(workspaceRoot, 'projects', 'proj-cred-test');
      await stateEngine.createProject({
        name: 'Credibility App',
        idea: 'Testing credibility and assumptions',
        projectId: 'proj-cred-test',
        projectPath,
      });

      const baseSnapshot = await stateEngine.loadProject(projectPath);
      const baseView = readinessProjection(baseSnapshot);
      const scoreBeforeAssumption = baseView.credibilityScore;

      // Add active assumption
      await stateEngine.addAssumption(
        projectPath,
        'Assume user has Node.js 20+ installed',
        baseSnapshot.metadata.stateRevision,
        'Needed for runtime'
      );

      const snapshotWithAssumption = await stateEngine.loadProject(projectPath);
      const viewWithAssumption = readinessProjection(snapshotWithAssumption);

      // Score MUST be less than or equal to score before assumption
      expect(viewWithAssumption.credibilityScore).toBeLessThanOrEqual(scoreBeforeAssumption);
      expect(viewWithAssumption.credibilityScore).toBe(scoreBeforeAssumption - 5);
    });
  });

  describe('5.3 Revision Staleness & Old Approval Invalidation', () => {
    it('Modifying any project fact immediately makes existing approval stale and blocks compilation', async () => {
      const projId = 'proj-stale-test';
      const projectPath = join(workspaceRoot, 'projects', projId);
      await stateEngine.createProject({
        name: 'Stale Invariant App',
        idea: 'Full specification for stale test',
        projectId: projId,
        projectPath,
      });

      // Add decisions for all 8 core areas
      let snap = await stateEngine.loadProject(projectPath);
      for (const area of CORE_DISCOVERY_AREA_IDS) {
        snap = await stateEngine.addDecision(
          projectPath,
          area,
          `Confirmed specification for ${area}`,
          snap.metadata.stateRevision,
          'confirmed'
        );
      }

      // 2. Run readiness review and approve
      snap = await stateEngine.evaluateReadiness(projectPath, snap.metadata.stateRevision);
      snap = await stateEngine.setUserDisposition(projectPath, 'approved', snap.metadata.stateRevision);

      expect(snap.metadata.stage).toBe('approved');
      expect(snap.readiness.current.userDisposition).toBe('approved');
      const approvedRev = snap.metadata.stateRevision;
      expect(snap.readiness.current.basisRevision).toBe(approvedRev - 1);

      // Verify that document generation is allowed initially
      const gate = new ReadinessGate();
      const gateCheck1 = gate.canGenerateDocuments(snap);
      expect(gateCheck1.allowed).toBe(true);

      // 3. User modifies a fact (e.g. adds a new decision or updates an area)
      snap = await stateEngine.addDecision(
        projectPath,
        'technical_boundary',
        'Switched from SQLite to PostgreSQL',
        snap.metadata.stateRevision,
        'confirmed'
      );

      // Now stateRevision has evolved, but basisRevision is from before!
      expect(snap.metadata.stateRevision).toBeGreaterThan(approvedRev);
      const viewAfterChange = readinessProjection(snap);
      expect(viewAfterChange.isStale).toBe(true);

      // 4. Document compilation MUST be blocked due to stale approval!
      const gateCheck2 = gate.canGenerateDocuments(snap);
      expect(gateCheck2.allowed).toBe(false);
      expect(gateCheck2.reason).toContain('stale');

      // 5. Server endpoint /documents/generate must reject with 422
      const genRes = await fetch(`${baseUrl}/api/projects/${projId}/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: snap.metadata.stateRevision }),
      });
      expect(genRes.status).toBe(422);
    });
  });

  describe('5.4 Readiness Actions Comparison: not-ready vs ready-with-warnings vs ready', () => {
    it('Returns correct enabled actions for not-ready, ready-with-warnings, and ready projects', () => {
      // 1. Not Ready (missing core areas and open critical gap)
      const notReadySnap: any = {
        metadata: { projectId: 'p1', stateRevision: 1 },
        decisions: { items: [] },
        gaps: {
          gaps: [{ id: 'g1', area: 'target_user', severity: 'critical', status: 'open' }],
          conflicts: [],
        },
        assumptions: { items: [] },
        readiness: {
          current: { basisRevision: 1, warnings: [] },
        },
      };
      const notReadyActions = ReadinessActionPolicy.evaluateActions(notReadySnap);
      const notReadyApproved = notReadyActions.find((a) => a.disposition === 'approved');
      expect(notReadyApproved?.enabled).toBe(false);
      expect(notReadyApproved?.blockedReasons.length).toBeGreaterThan(0);

      // 2. Ready with Warnings (all 8 areas satisfied, but has non-blocking gap or warning)
      const readyWithWarningsSnap: any = {
        metadata: { projectId: 'p2', stateRevision: 1 },
        decisions: {
          items: CORE_DISCOVERY_AREA_IDS.map((area, i) => ({
            id: `dec-${i}`,
            area,
            status: 'confirmed',
          })),
        },
        gaps: {
          gaps: [{ id: 'g2', area: 'ux_ui_direction', severity: 'high', status: 'open' }],
          conflicts: [],
        },
        assumptions: { items: [] },
        readiness: {
          current: { basisRevision: 1, warnings: ['Minor UI layout pending'] },
        },
      };
      const warnActions = ReadinessActionPolicy.evaluateActions(readyWithWarningsSnap);
      const warnAct = warnActions.find((a) => a.disposition === 'approved-with-warnings');
      expect(warnAct?.enabled).toBe(true);

      // 3. Fully Ready (all 8 areas satisfied, zero open critical/high gaps or conflicts)
      const readySnap: any = {
        metadata: { projectId: 'p3', stateRevision: 1 },
        decisions: {
          items: CORE_DISCOVERY_AREA_IDS.map((area, i) => ({
            id: `dec-${i}`,
            area,
            status: 'confirmed',
          })),
        },
        gaps: { gaps: [], conflicts: [] },
        assumptions: { items: [] },
        readiness: {
          current: { basisRevision: 1, warnings: [] },
        },
      };
      const readyActions = ReadinessActionPolicy.evaluateActions(readySnap);
      const readyApproved = readyActions.find((a) => a.disposition === 'approved');
      expect(readyApproved?.enabled).toBe(true);
      expect(readyApproved?.blockedReasons).toHaveLength(0);
    });
  });

  describe('5.5 Document Delivery & Atomic ZIP Packaging', () => {
    it('Plans exactly 8 core documents and generates manifest with SHA-256 hashes and source coverage', async () => {
      const projId = 'proj-docs-e2e';
      const projectPath = join(workspaceRoot, 'projects', projId);
      await stateEngine.createProject({
        name: 'Docs Delivery App',
        idea: 'Verified document delivery with exactly 8 core documents',
        projectId: projId,
        projectPath,
      });

      let snap = await stateEngine.loadProject(projectPath);
      for (const area of CORE_DISCOVERY_AREA_IDS) {
        snap = await stateEngine.addDecision(
          projectPath,
          area,
          `Confirmed specification statement for ${area}`,
          snap.metadata.stateRevision,
          'confirmed'
        );
      }

      // Check planner has exactly 8 core documents
      const planner = new DocumentPlanner();
      const plan = planner.plan(snap);
      const coreDocs = plan.documents.filter((d) => d.required);
      expect(coreDocs).toHaveLength(8);
      expect(coreDocs[0].title).toBe('AGENTS.md');

      // Compile documents
      snap = await stateEngine.evaluateReadiness(projectPath, snap.metadata.stateRevision);
      snap = await stateEngine.setUserDisposition(projectPath, 'approved', snap.metadata.stateRevision);

      const compiler = new DocumentCompiler(storage);
      const compileRes = await compiler.compile(projectPath, snap);

      expect(compileRes.manifest.documents.length).toBeGreaterThanOrEqual(8);
      expect(compileRes.manifest.sourceCoverage).toBeDefined();
      expect(compileRes.manifest.sourceCoverage.confirmed).toBeGreaterThan(0);

      // Check that each document has a valid SHA-256 hash
      for (const doc of compileRes.manifest.documents) {
        expect(doc.contentHash).toMatch(/^[a-f0-9]{64}$/);
        expect(doc.sourceStats).toBeDefined();
      }

      // Test atomic ZIP export via DocumentExportService
      const exportService = new DocumentExportService(storage);
      const exportResult = await exportService.exportZip(projectPath);
      expect(exportResult.filesCount).toBe(compileRes.manifest.documents.length);
      expect(exportResult.totalBytes).toBeGreaterThan(0);

      // Delete one document to simulate partial failure
      const docToDelete = join(projectPath, 'docs', 'PROJECT.md');
      await unlink(docToDelete);

      // Now atomic ZIP MUST fail and report PROJECT.md missing, never returning a partial zip!
      await expect(exportService.exportZip(projectPath)).rejects.toThrow(
        /Atomic Document ZIP export failed/
      );
      try {
        await exportService.exportZip(projectPath);
      } catch (err: any) {
        expect(err.details?.missingFiles).toContain('docs/PROJECT.md');
      }
    });
  });
});
