import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectStateEngine, FileStorage, WorkspaceGuard, StateCommitManager } from '@project-architect/core';
import { question } from './planning.mjs';

/** A frozen old-format project: no planning ledger, blueprint or changesets.
 * The fixture contains synthetic records only, never the user's project. */
export async function seedLegacyPlanningProject(root) {
  const engine = new ProjectStateEngine(new FileStorage(), new WorkspaceGuard(root));
  const created = await engine.createProject({ name: '旧项目格式源', idea: '个人笔记', projectPath: join(root, 'modern-seed') });
  const s = created.snapshot, path = join(root, 'legacy-source');
  const at = '2026-10-01T00:00:00Z', projectId = 'proj-legacy-planning-copy';
  const metadata = { ...s.metadata, projectId, name: '旧项目迁移副本', inputRefs: [], stateRevision: 1 };
  const record = (id, statement, extra = {}) => ({ id, statement, area: 'technical_boundary', status: 'confirmed', origin: 'user', confirmedBy: 'user', evidenceRefs: [], createdAt: at, updatedAt: at, ...extra });
  const items = [
    record('legacy-linked', '数据保存在本地文件。', { evidenceRefs: ['question:legacy-storage-question'] }),
    record('legacy-locked', '数据使用远程服务。', { status: 'locked', decisionKey: 'storage:location' }),
    record('legacy-research-question', '有没有 GitHub 项目能实现？', { decisionKey: 'research:alternatives' }),
    record('legacy-unlinked', '支持文件备份导出。'),
  ];
  const q = { ...question('storage:location'), id: 'legacy-storage-question', issueRef: 'gap:legacy-storage-gap', status: 'answered', answer: '保存到本地文件', answeredAt: at };
  delete q.decisionKey; delete q.dependsOn;
  const gaps = { ...s.gaps, projectId, schemaVersion: 1, gaps: [{ id: 'legacy-storage-gap', area: 'technical_boundary', decisionKey: 'storage:location', severity: 'high', reason: '需要选择保存位置', impact: '影响离线使用', shouldAskUser: true, status: 'addressed' }] };
  const ready = { ...s.readiness.current, id: 'legacy-ready', status: 'ready', userDisposition: 'approved', warnings: [], issues: [], credibilityScore: 100, coverage: { total: 6, satisfied: 6, ratio: 1 } };
  const document = '# 历史方案\n\n这段手工说明必须按原字节保留。\n';
  const doc = { id: 'legacy-document', type: 'project', path: 'documents/OLD_PROJECT.md', title: '历史方案', status: 'approved', generatedAt: at, sourceRevision: 1, contentHash: createHash('sha256').update(document).digest('hex') };
  await new StateCommitManager().commit(path, 1, {
    metadata, overview: { ...s.overview, projectId }, decisions: { ...s.decisions, projectId, items, traces: [] },
    assumptions: { ...s.assumptions, projectId }, gaps, risks: { ...s.risks, projectId },
    questions: { ...s.questions, projectId, schemaVersion: 1, items: [q] },
    readiness: { ...s.readiness, projectId, current: ready, history: [ready] },
    documents: { ...s.documents, projectId, items: [doc] },
  });
  await mkdir(join(path, 'documents'), { recursive: true });
  await writeFile(join(path, doc.path), document);
  return { path, projectId, originalItems: items, document, documentReference: doc };
}

export async function directoryFileHashes(root) {
  const files = {};
  const visit = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files[relative(root, path)] = createHash('sha256').update(await readFile(path)).digest('hex');
    }
  };
  await visit(root);
  return files;
}
