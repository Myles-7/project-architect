import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';

describe('B3 question dismissal API', () => {
  let workspace: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'pa-b3-dismiss-'));
    app = createApp({ workspaceRoot: workspace, useMockAI: true });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('dismisses advisory questions atomically without creating a decision', async () => {
    const created = await request(app).post('/api/projects').send({ name: 'B3', idea: 'A vague local tool' }).expect(200);
    const projectId = created.body.data.projectId;
    const discovered = await request(app).post(`/api/projects/${projectId}/discovery`).send({ expectedRevision: 1 }).expect(200);
    const snapshot = discovered.body.data.snapshot;
    const active = snapshot.questions.items.filter((question: any) => question.status === 'proposed');
    expect(active.length).toBeGreaterThan(0);
    const decisionCount = snapshot.decisions.items.length;

    const dismissed = await request(app).post(`/api/projects/${projectId}/questions/dismiss`).send({
      questionRefs: active.map((question: any) => `question:${question.id}`),
      expectedRevision: discovered.body.stateRevision,
    }).expect(200);

    expect(dismissed.body.data.snapshot.questions.items.filter((question: any) => question.status === 'dismissed')).toHaveLength(active.length);
    expect(dismissed.body.data.snapshot.decisions.items).toHaveLength(decisionCount);
  });
});
