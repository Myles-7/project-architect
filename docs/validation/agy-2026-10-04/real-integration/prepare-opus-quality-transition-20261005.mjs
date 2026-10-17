import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sha256, treeSha256, frozenRunInventory, latestStoredPendingDraft } from './model-transition.mjs';
const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const probePath = resolve('docs/validation/agy-2026-10-04/account-probes/claude-opus-4-6-thinking-1791169666419/result.json');
const probeBytes = await readFile(probePath), probe = JSON.parse(probeBytes), model = 'claude-opus-4-6-thinking';
if (probe.model !== model || probe.status !== 'success' || !probe.structuredSuccess) throw new Error('New actual Opus availability probe required');
const definitions = [
  { mode: 'vague', sourceLabel: 'flash-vague-draft-final-20261005-03', operation: 'draft-from', qualityFile: join(root, 'quality-feedback-vague-round2.txt') },
  { mode: 'materials', sourceLabel: 'flash-materials-final-20261005-04', operation: 'quality-from', qualityFile: join(root, 'quality-feedback-materials-round9-opus.txt') },
];
const originalFeedback = await readFile(join(root, 'quality-feedback-materials-round8.txt'), 'utf8');
await writeFile(definitions[1].qualityFile, `${originalFeedback}\n\n补充独立质量判据（自动验收反馈，不是真人新增需求）：精简内部源码时，必须保留原已批准方案的公共方法契约。逐项对照原 blk-tech-module、blk-tech-interface 的方法名、参数、返回值、初始化依赖与装配顺序，恢复被精简时静默删除的 ValidatorModule.validate、ResetController.captureSnapshot/rollback 及 FeedbackBanner 的正常/失败行为契约，或提出明确理由且同步接口/流程/任务/验收的自洽替代；短非执行示意不替代这些公共契约。此补充不要求复制内部实现代码，也不扩展目标范围。原18无关区块及全部原证据保持；未验证平台/性能仍为未执行。\n`, { flag: 'wx' });
const controls = [];
for (const definition of definitions) {
  const source = join(root, definition.sourceLabel), bytes = await readFile(join(source, 'manifest.json')), manifest = JSON.parse(bytes);
  if (manifest.activeCallsAtShutdown !== 0 || !['completed', 'failed', 'blocked'].includes(manifest.status) || (manifest.sharedProviderSlots?.ownedLeasesAtShutdown?.length ?? 0)) throw new Error('Source is not stopped');
  const before = await treeSha256(source), projectTree = await treeSha256(join(source, 'project-records'));
  const inheritedRuns = await frozenRunInventory(join(source, 'project-records'));
  const draft = definition.operation === 'draft-from' ? await latestStoredPendingDraft(join(source, 'project-records')) : undefined;
  const feedback = await readFile(definition.qualityFile);
  if ((await treeSha256(source)).sha256 !== before.sha256) throw new Error('Frozen source changed during preparation');
  controls.push({ ...definition, sourceConfig: manifest.requestedConfig, sourceManifestSha256: sha256(bytes), sourceTreeSha256: before.sha256, sourceFileCount: before.fileCount, projectRecordsTreeSha256: projectTree.sha256, inheritedRuns, qualityFileSha256: sha256(feedback),
    ...(draft ? { draftReference: { strategy: 'new-feedback-with-full-unapproved-reference', changeSetId: draft.candidate.id, candidateSha256: draft.candidateSha256, sourceStateRevision: draft.sourceStateRevision, reason: 'Original model has service quota failures. The stored candidate remains unapproved reference input; create a new Run under the already approved Opus model, without re-modeling old tasks or claiming reuse of execution fragments.' } } : {}) });
}
const output = join(root, 'approved-model-transition-opus-quality-20261005.json');
await writeFile(output, JSON.stringify({ schemaVersion: 1, kind: 'approved-model-transition', recordedAt: new Date().toISOString(), authorization: { status: 'authorized', authority: 'delegated-user-authorization', instruction: 'The user approved the original Opus design model, explicit model configuration, continued development and unrestricted design/review effort. Gemini now reports service quota failures. Parent /root explicitly selects the originally approved Opus model for new design and isolated independent review Runs, retaining all old models, Run/task/receipt bytes and the stored unapproved candidate. This is execution authorization, not human content review or approval.' }, targetConfig: { concurrency: 4, designModel: model, reviewModel: model }, availabilityProbe: { path: probePath, sha256: sha256(probeBytes), model, checkedAt: probe.checkedAt, scope: probe.scope }, controls }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ output, model, providerInvoked: false, controls: controls.map(control => ({ mode: control.mode, sourceLabel: control.sourceLabel, operation: control.operation, sourceTreeSha256: control.sourceTreeSha256 })) }));
