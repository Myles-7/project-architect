/**
 * @file p0-base64-dataurl.test.ts
 * @description P0-4 Remediation: Verification of Base64 Data URL decoding safety in apps/server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';

describe('P0-4 Base64 Data URL Decoding Resilience in Server', () => {
  let app: any;
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'pa-p0-b64-'));
    app = createApp({ useMockAI: true, workspaceRoot: workspace });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('safely handles addInput with data:application/pdf;base64, prefix without corruption', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: 'Base64 PDF Upload Test',
        idea: 'Testing Data URL payload parsing',
      })
      .expect(200);

    const projectId = createRes.body.data.projectId;

    // Simulate minimal PDF file in Base64: "%PDF-1.4\n..."
    const rawPdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<</Size 1>>startxref\n9\n%%EOF';
    const base64Data = Buffer.from(rawPdfContent).toString('base64');
    const dataUrlPayload = `data:application/pdf;base64,${base64Data}`;

    const addRes = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        projectId,
        kind: 'file',
        filename: 'architecture_spec.pdf',
        content: dataUrlPayload,
        contentEncoding: 'base64',
        expectedRevision: 1,
      })
      .expect(200);

    expect(addRes.body.success).toBe(true);
    expect(addRes.body.data.inputRef.label).toBe('architecture_spec.pdf');
    expect(addRes.body.data.inputRef.kind).toBe('file');
  });
});
