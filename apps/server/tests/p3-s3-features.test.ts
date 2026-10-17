import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/server.js';
import { FileStorage } from '@project-architect/core';

describe('Stage S3 Server Endpoints (Brownfield Ingestion & Spec-Drift Verification)', () => {
  let testDir: string;
  let externalRepoDir: string;
  let app: any;
  const storage = new FileStorage();

  beforeEach(async () => {
    testDir = join(tmpdir(), `pa-s3-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    externalRepoDir = join(tmpdir(), `pa-repo-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fsp.mkdir(testDir, { recursive: true });
    await fsp.mkdir(externalRepoDir, { recursive: true });

    // Mock an external codebase to reverse scan
    const externalPkg = {
      name: 'legacy-web-app',
      dependencies: {
        react: '^19.0.0',
        tailwindcss: '^4.0.0',
        zustand: '^5.0.0',
      },
      devDependencies: {
        vite: '^6.0.0',
        typescript: '^5.0.0',
      },
    };
    await fsp.writeFile(join(externalRepoDir, 'package.json'), JSON.stringify(externalPkg, null, 2), 'utf8');

    app = createApp({
      workspaceRoot: testDir,
      projectsDir: join(testDir, 'projects'),
      useMockAI: true,
    });
  });

  afterEach(async () => {
    await storage.remove(testDir);
    await storage.remove(externalRepoDir);
  });

  it('1. POST /api/projects/:id/brownfield/scan scans external codebase and returns analysis', async () => {
    // 1. Create a project
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Brownfield Host Project', idea: 'A brownfield test idea' });
    expect(createRes.status).toBe(200);
    const { projectId } = createRes.body.data;

    // 2. Scan external repository
    const scanRes = await request(app)
      .post(`/api/projects/${projectId}/brownfield/scan`)
      .send({ path: externalRepoDir });

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.success).toBe(true);
    const analysis = scanRes.body.data;
    expect(analysis.detectedProjectName).toBe('legacy-web-app');
    expect(analysis.technologies.some((t: any) => t.name === 'React')).toBe(true);
    expect(analysis.technologies.some((t: any) => t.name === 'Tailwind CSS')).toBe(true);
    expect(analysis.candidateDecisions.length).toBeGreaterThan(0);
  });

  it('2. POST /api/projects/:id/brownfield/apply ingests candidates with user authority protection', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Candidate Ingestion Project', idea: 'Candidate ingestion idea' });
    const { projectId } = createRes.body.data;

    const mockCandidates = [
      {
        areaId: 'technical_boundary',
        decisionKey: 'tech-stack.framework',
        title: '前端框架：React 19',
        summary: '检测到 React 依赖',
        details: '版本 ^19.0.0',
        evidence: ['package.json'],
        suggestedTags: ['react', 'spa'],
        confidence: 'high',
      },
    ];

    const applyRes = await request(app)
      .post(`/api/projects/${projectId}/brownfield/apply`)
      .send({ candidateDecisions: mockCandidates });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.success).toBe(true);
    expect(applyRes.body.data.appliedCount).toBe(1);

    // Verify decision exists in snapshot as CANDIDATE status (NEVER locked or confirmed)
    const snapshot = applyRes.body.data.snapshot;
    const addedDecision = snapshot.decisions.items.find(
      (d: any) => d.decisionKey === 'tech-stack.framework'
    );
    expect(addedDecision).toBeDefined();
    expect(addedDecision.status).toBe('candidate');
    expect(addedDecision.origin).toBe('agent');
    expect(snapshot.metadata.projectTags).toContain('react');
  });

  it('3. POST /api/projects/:id/verify-drift refuses retired inferred compliance', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Drift Audit Project',
        presetId: 'local-first-desktop',
      });
    const { projectId } = createRes.body.data;

    // Run drift audit against project path
    const auditRes = await request(app)
      .post(`/api/projects/${projectId}/verify-drift`)
      .send({});

    expect(auditRes.status).toBe(410);
    expect(auditRes.body.error.code).toBe('LEGACY_WORKFLOW_RETIRED');
    expect(auditRes.body.data).toBeUndefined();
  });

  it('4. POST /api/brownfield/scan performs stateless reverse scan without requiring existing project', async () => {
    const scanRes = await request(app)
      .post('/api/brownfield/scan')
      .send({ path: externalRepoDir });

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.success).toBe(true);
    const data = scanRes.body.data;
    expect(data.detectedProjectName).toBe('legacy-web-app');
    expect(data.primaryLanguage).toBe('TypeScript');
    expect(data.technologies.some((t: any) => t.name === 'React')).toBe(true);
    expect(data.candidateDecisions.length).toBeGreaterThan(0);
  });
});
