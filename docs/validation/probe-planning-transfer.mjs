import { mkdtemp, cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { FileStorage, WorkspaceGuard, ProjectStateEngine, ProjectForkService, ProjectExportImportService, StateCommitManager } from '../../packages/core/dist/index.js';

const source = resolve('docs/validation/agy-2026-10-04/real-integration/flash-materials-quality-20261005-01/project-records');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function inventory(path, prefix = '') {
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await inventory(join(path, entry.name), relative + '/'));
    else files.push({ relative, sha256: hash(await readFile(join(path, entry.name))) });
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}
const sourceBefore = await inventory(source);
const workspace = await mkdtemp(join(tmpdir(), 'pa-planning-transfer-'));
const guard = new WorkspaceGuard(workspace), storage = new FileStorage(), engine = new ProjectStateEngine(storage, guard);
const metadata = JSON.parse(await readFile(join(source, 'project.json'), 'utf8'));
const copy = guard.resolveProjectPath(metadata.projectId);
await mkdir(guard.projectsDir, { recursive: true });
await cp(source, copy, { recursive: true });
const result = { at: new Date().toISOString(), source, workspace, scope: 'Read-only frozen genuine project source; transfer operations use independent temporary copies. This is not a model content or human approval check.', observations: [] };
const before = await engine.loadProject(copy);
result.sourceRevision = before.metadata.stateRevision;
result.sourceBlueprintBlocks = before.planning.blueprint.blocks.length;
result.sourceSnapshotVerified = await new StateCommitManager(storage).verifySnapshot(copy, before.metadata.stateRevision);
try {
  const fork = await ProjectForkService.forkProject({ sourcePath: copy, newName: '规划副本兼容复核', newProjectId: 'probe-planning-fork', storage, guard, engine });
  result.observations.push({ operation: 'fork', status: 'returned', blocks: fork.snapshot.planning.blueprint.blocks.length, revision: fork.snapshot.metadata.stateRevision, snapshotVerified: await new StateCommitManager(storage).verifySnapshot(fork.targetPath, fork.snapshot.metadata.stateRevision) });
} catch (error) { result.observations.push({ operation: 'fork', status: 'failed', error: String(error), code: error.code }); }
const transfer = new ProjectExportImportService(storage), exported = await transfer.exportProject(copy);
result.exportedBytes = exported.zipBuffer.length;
for (const [name, targetId] of [['new-project-id', 'probe-planning-import'], ['same-project-id-collision', undefined]]) {
  try {
    const imported = await transfer.importProject(exported.zipBuffer, guard.projectsDir, targetId);
    result.observations.push({ operation: 'import', name, status: 'returned', path: imported.projectPath, blocks: imported.snapshot.planning.blueprint.blocks.length, revision: imported.snapshot.metadata.stateRevision, snapshotVerified: await new StateCommitManager(storage).verifySnapshot(imported.projectPath, imported.snapshot.metadata.stateRevision) });
  } catch (error) { result.observations.push({ operation: 'import', name, status: 'failed', error: String(error), code: error.code }); }
}
result.sourceOriginalFilesUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(await inventory(source));
result.sourceCopyUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(await inventory(copy));
await writeFile(resolve('docs/validation/planning-transfer-probe.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
