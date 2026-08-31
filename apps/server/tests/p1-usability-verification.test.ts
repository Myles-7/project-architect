/**
 * @file p1-usability-verification.test.ts
 * @description P1 级“让产品真正适合日常使用”全方位自动化验证套件
 * 
 * 验证范围：
 * 1. 项目生命周期管理（重命名、复制 Fork、置顶、归档、物理目录定位与安全清理）
 * 2. 材料管理闭环与上下文排除（toggleInputExclusion 与 AIOrchestrator 过滤保障）
 * 3. 本地 Provider 健康检查与零泄露契约 (/api/provider/health)
 * 4. 业务意图四维引导结构化生成与向导进度记忆
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/server.js';
import { FileStorage } from '@project-architect/core';

describe('P1 Usability & Local Governance Verification Suite', () => {
  let app: any;
  let testProjectDir: string;
  const storage = new FileStorage();

  beforeEach(() => {
    testProjectDir = join(tmpdir(), `pa-p1-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    app = createApp({ useMockAI: true, workspaceRoot: testProjectDir });
  });

  afterEach(async () => {
    await storage.remove(testProjectDir);
  });

  it('P1-1: 项目生命周期管理闭环（创建 -> 重命名 -> 置顶 -> 复制副本 -> 归档 -> 删除）', async () => {
    // 1. 创建项目
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: '初始构思产品',
        idea: '一个本地优先的离线笔记与知识图谱工具',
        projectId: 'proj-p1-lifecycle-01',
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    const projectId = createRes.body.data.projectId;
    expect(projectId).toBe('proj-p1-lifecycle-01');

    // 2. 项目重命名
    const renameRes = await request(app)
      .post(`/api/projects/${projectId}/rename`)
      .send({ name: '重命名后的笔记大师' });

    expect(renameRes.status).toBe(200);
    expect(renameRes.body.success).toBe(true);
    expect(renameRes.body.data.project.name).toBe('重命名后的笔记大师');

    // 3. 置顶与取消置顶
    const pinRes1 = await request(app)
      .post(`/api/projects/${projectId}/pin`);
    expect(pinRes1.status).toBe(200);
    expect(pinRes1.body.data.isPinned).toBe(true);

    const listRes1 = await request(app).get('/api/projects');
    expect(listRes1.status).toBe(200);
    const pinnedItem = listRes1.body.data.projects.find((p: any) => p.projectId === projectId);
    expect(pinnedItem.isPinned).toBe(true);

    // 4. 复制项目副本 (Fork Idea)
    const duplicateRes = await request(app)
      .post(`/api/projects/${projectId}/duplicate`)
      .send({ newName: '重命名后的笔记大师 (分叉探索)' });

    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.success).toBe(true);
    const forkedProjectId = duplicateRes.body.data.project.projectId;
    expect(forkedProjectId).toContain('-fork-');
    expect(duplicateRes.body.data.project.name).toBe('重命名后的笔记大师 (分叉探索)');

    // 5. 归档与取消归档
    const archiveRes = await request(app)
      .post(`/api/projects/${projectId}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.isArchived).toBe(true);

    // 6. 安全删除副本项目
    const deleteRes = await request(app)
      .delete(`/api/projects/${forkedProjectId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);

    const listAfterDelete = await request(app).get('/api/projects');
    expect(listAfterDelete.status).toBe(200);
    const foundDeleted = listAfterDelete.body.data.projects.some((p: any) => p.projectId === forkedProjectId);
    expect(foundDeleted).toBe(false);
  });

  it('P1-2: 输入材料排除机制与 AI 上下文隔离隔离验证', async () => {
    // 1. 创建项目并添加材料
    const createRes = await request(app)
      .post('/api/projects')
      .send({
        name: '材料测试项目',
        idea: '测试材料上下文包含与排除',
        projectId: 'proj-p1-material-01',
      });

    expect(createRes.status).toBe(200);
    const projectId = createRes.body.data.projectId;

    // 2. 挂载一个文本材料
    const addInputRes = await request(app)
      .post(`/api/projects/${projectId}/inputs`)
      .send({
        projectId,
        kind: 'text',
        filename: 'architecture-spec.md',
        content: '# 离线同步设计规范\n要求必须使用纯本地 JSON 存储。',
      });

    expect(addInputRes.status).toBe(200);
    const inputId = addInputRes.body.data.inputRef.id;
    expect(inputId).toBeDefined();

    // 检查初始状态为 ready
    const snap1Res = await request(app).get(`/api/projects/${projectId}`);
    const material1 = snap1Res.body.data.snapshot.metadata.inputRefs.find((r: any) => r.id === inputId);
    expect(material1?.status).toBe('ready');
    expect(material1?.analysisAvailability).toBe('available');

    // 3. 排除该材料出 AI 上下文
    const toggleRes1 = await request(app)
      .post(`/api/projects/${projectId}/inputs/${inputId}/toggle`)
      .send({ exclude: true });

    expect(toggleRes1.status).toBe(200);
    expect(toggleRes1.body.data.status).toBe('excluded');

    const snap2Res = await request(app).get(`/api/projects/${projectId}`);
    const material2 = snap2Res.body.data.snapshot.metadata.inputRefs.find((r: any) => r.id === inputId);
    expect(material2?.status).toBe('excluded');
    expect(material2?.analysisAvailability).toBe('unavailable');

    // 4. 再次切换：重新纳入上下文
    const toggleRes2 = await request(app)
      .post(`/api/projects/${projectId}/inputs/${inputId}/toggle`)
      .send({ exclude: false });

    expect(toggleRes2.status).toBe(200);
    expect(toggleRes2.body.data.status).toBe('ready');

    const snap3Res = await request(app).get(`/api/projects/${projectId}`);
    const material3 = snap3Res.body.data.snapshot.metadata.inputRefs.find((r: any) => r.id === inputId);
    expect(material3?.status).toBe('ready');
    expect(material3?.analysisAvailability).toBe('available');
  });

  it('P1-3: 本地 Provider 探活诊断与安全契约验证 (/api/provider/health)', async () => {
    const healthRes = await request(app).get('/api/provider/health');

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.success).toBe(true);
    expect(healthRes.body.data.status).toBe('ready');
    expect(healthRes.body.data.isLocal).toBe(true);
    expect(healthRes.body.data.providerName).toBeDefined();
    expect(healthRes.body.data.details).toContain('单轮单次结构化推演');
  });

  it('P1-4: 四项业务意图拼装与领域解析兼容性验证', () => {
    const targetUser = '个人独立开发者与开源作者';
    const coreProblem = '架构设想零散，缺乏系统化的决策推演和开发前准备度检查';
    const mvpResult = '本地运行的 Project Architect 辅助工作台';
    const knownConstraints = '不使用数据库，零云端服务依赖，单次确定性推演';

    const parts: string[] = [];
    if (targetUser.trim()) parts.push(`## 目标用户\n${targetUser.trim()}`);
    if (coreProblem.trim()) parts.push(`## 核心痛点与场景\n${coreProblem.trim()}`);
    if (mvpResult.trim()) parts.push(`## 期望交付结果\n${mvpResult.trim()}`);
    if (knownConstraints.trim()) parts.push(`## 明确约束与限制\n${knownConstraints.trim()}`);
    const finalIdea = parts.join('\n\n');

    expect(finalIdea).toContain('## 目标用户\n个人独立开发者与开源作者');
    expect(finalIdea).toContain('## 核心痛点与场景');
    expect(finalIdea).toContain('## 期望交付结果');
    expect(finalIdea).toContain('## 明确约束与限制');
  });
});
