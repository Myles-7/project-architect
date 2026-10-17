/**
 * @file p1-audit-features.test.ts
 * @description Phase P1 Optimization Features Verification Suite
 * 
 * Verifies:
 * 1. POST /api/projects/:id/questions/retract (4-way cascading retract protocol)
 * 2. Assumption deprecation upon retracting assumption answers
 * 3. GET /api/fs/directories (directory tree listing & Windows drives)
 * 4. POST /api/fs/validate-path (directory path validation)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';
import type { QuestionItem, DecisionItem } from '@project-architect/contracts';
import { FileStorage, WorkspaceGuard, ProjectStateEngine, PlanningService, planningBasis } from '@project-architect/core';
import { question } from '../../../tests/fixtures/planning.mjs';

describe('Phase P1 Audit Features Verification', () => {
  let app: any;
  let workspace: string;
  let engine: ProjectStateEngine;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'pa-p1-audit-'));
    engine=new ProjectStateEngine(new FileStorage(),new WorkspaceGuard(workspace));
    app = createApp({ useMockAI: true, workspaceRoot: workspace, engine });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  describe('Question Retract Protocol (方案 5)', () => {
    it('successfully retracts an answered question and restores 4-way consistency', async () => {
      // 1. Create a project
      const createRes = await request(app)
        .post('/api/projects')
        .send({
          name: 'Retract Test Project',
          idea: 'Testing question retract cascade',
          projectId: 'proj-retract-01',
        })
        .expect(200);

      const projectId = createRes.body.data.projectId;

      // 2. Install a complete question; this test verifies explicit answer/retract, not generation.
      const path=new WorkspaceGuard(workspace).resolveProjectPath(projectId);
      const service=new PlanningService(engine);const base=await service.get(path);
      const installed=await service.installQuestions(path,planningBasis(base),[question() as QuestionItem],'run-retract');
      const questions = installed.questions.items;
      const targetQuestion = questions.find((q: QuestionItem) => q.status === 'shown');
      expect(targetQuestion).toBeDefined();

      const qRef = `question:${targetQuestion.id}`;
      let revision = installed.metadata.stateRevision;

      // 3. Answer the question
      const answerRes = await request(app)
        .post(`/api/projects/${projectId}/questions/answer`)
        .send({
          questionRef: qRef,
          answer: targetQuestion.options[0].label,
          expectedRevision: revision,
        })
        .expect(200);

      revision = answerRes.body.stateRevision;
      const snapshotAfterAnswer = answerRes.body.data.snapshot;
      const answeredQ = snapshotAfterAnswer.questions.items.find(
        (q: QuestionItem) => q.id === targetQuestion.id
      );
      expect(answeredQ.status).toBe('answered');
      expect(answeredQ.answer).toBe(targetQuestion.options[0].label);

      // 4. Retract the question (Simulate 10s undo toast action)
      const retractRes = await request(app)
        .post(`/api/projects/${projectId}/questions/retract`)
        .send({
          questionRef: qRef,
          expectedRevision: revision,
        })
        .expect(200);

      expect(retractRes.body.success).toBe(true);
      expect(retractRes.body.data.retractedQuestionId).toBe(qRef);

      // 5. Verify snapshot state after retract
      const snapshotAfterRetract = retractRes.body.data.snapshot;
      expect(snapshotAfterRetract.metadata.stateRevision).toBe(revision + 1);

      // Question status must revert to 'shown'
      const questionAfter = snapshotAfterRetract.questions.items.find(
        (q: QuestionItem) => q.id === targetQuestion.id
      );
      expect(questionAfter.status).toBe('shown');
      expect(questionAfter.answer).toBeUndefined();

      // Associated decisions must be marked 'rejected'
      const rejectedDecisions = snapshotAfterRetract.decisions.items.filter(
        (d: DecisionItem) => d.status === 'rejected'
      );
      expect(rejectedDecisions.length).toBeGreaterThanOrEqual(1);
    });

    it('retracting an assumption answer deprecates the created assumption', async () => {
      // 1. Create a project and run discovery
      const createRes = await request(app)
        .post('/api/projects')
        .send({
          name: 'Assumption Retract Project',
          idea: 'Testing assumption answer retraction',
          projectId: 'proj-asm-retract-01',
        })
        .expect(200);

      const projectId = createRes.body.data.projectId;
      const discRes = await request(app)
        .post(`/api/projects/${projectId}/discovery`)
        .send({ expectedRevision: 1 })
        .expect(200);

      const questions = discRes.body.data.snapshot.questions.items;
      const targetQuestion = questions.find((q: QuestionItem) => q.status === 'proposed');
      expect(targetQuestion).toBeDefined();

      const qRef = `question:${targetQuestion.id}`;
      let revision = discRes.body.stateRevision;

      // 2. Answer question as assumption
      const answerAsmRes = await request(app)
        .post(`/api/projects/${projectId}/questions/answer-assumption`)
        .send({
          questionRef: qRef,
          assumptionStatement: '假定首期用户不超过 1000 人',
          rationale: '早期内测阶段',
          expectedRevision: revision,
        })
        .expect(200);

      revision = answerAsmRes.body.stateRevision;
      const asmCountBefore = answerAsmRes.body.data.snapshot.assumptions.items.filter(
        (a: any) => a.status === 'active'
      ).length;
      expect(asmCountBefore).toBeGreaterThan(0);

      // 3. Retract the question
      const retractRes = await request(app)
        .post(`/api/projects/${projectId}/questions/retract`)
        .send({
          questionRef: qRef,
          expectedRevision: revision,
        })
        .expect(200);

      const snapshotAfterRetract = retractRes.body.data.snapshot;
      const deprecatedAsm = snapshotAfterRetract.assumptions.items.find(
        (a: any) => a.statement === '假定首期用户不超过 1000 人'
      );
      expect(deprecatedAsm?.status).toBe('deprecated');
    });
  });

  describe('Directory Browser & Path Validation API (方案 7)', () => {
    it('GET /api/fs/directories lists directory contents', async () => {
      const res = await request(app)
        .get('/api/fs/directories')
        .query({ path: workspace })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.currentPath).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/fs/directories with empty path returns root/drives', async () => {
      const res = await request(app)
        .get('/api/fs/directories')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /api/fs/validate-path returns validation details for an existing directory', async () => {
      const res = await request(app)
        .post('/api/fs/validate-path')
        .send({ path: workspace })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.exists).toBe(true);
      expect(res.body.data.isDirectory).toBe(true);
    });

    it('POST /api/fs/validate-path returns exists=false for non-existent path', async () => {
      const fakePath = join(workspace, 'non_existent_folder_xyz_123');
      const res = await request(app)
        .post('/api/fs/validate-path')
        .send({ path: fakePath })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.exists).toBe(false);
    });
  });
});
