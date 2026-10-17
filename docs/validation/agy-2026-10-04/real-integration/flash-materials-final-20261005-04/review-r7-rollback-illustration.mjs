import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

// Checks only the explicitly non-executable rollback illustration with supplied
// dependencies. It is not a full implementation, target app, or browser test.
const directory = dirname(fileURLToPath(import.meta.url));
const snapshotBytes = readFileSync(join(directory, 'final-snapshot.json'));
const snapshot = JSON.parse(snapshotBytes);
const blocks = new Map(snapshot.planning.blueprint.blocks.map(block => [block.id, block]));
const interfaceContent = blocks.get('blk-tech-interface').content;
const code = [...interfaceContent.matchAll(/```javascript([\s\S]*?)```/g)][0][1];
if (!code.includes('非执行示意')) throw new Error('Expected explicit non-executable illustration marker');

function scenario(draft, hadPendingTimer, failRollback = false) {
  const jobs = [];
  const notifications = [];
  const forwardedFallbacks = [];
  const body = { children: [], contains(node) { return node.parentNode === this; }, replaceChild(next, current) {
    if (failRollback) throw new Error('fixture rollback replacement failure');
    if (current.parentNode !== this) throw new Error('NotFoundError');
    if (next.parentNode) next.parentNode.children.splice(next.parentNode.children.indexOf(next), 1);
    const index = this.children.indexOf(current);
    this.children.splice(index, 1, next); current.parentNode = null; next.parentNode = this;
  }, insertBefore(node, next) {
    if (failRollback) throw new Error('fixture rollback insertion failure');
    const index = next === null ? this.children.length : this.children.indexOf(next);
    if (index < 0) throw new Error('NotFoundError');
    this.children.splice(index, 0, node); node.parentNode = this;
  } };
  const node = value => ({ value, id: 'project-name-input', parentNode: null, focused: false, focus() { this.focused = true; } });
  const oldNode = node(draft), replacement = node(''), nextSibling = { tag: 'sentinel', parentNode: body };
  // This fixture models replaceWith already completed before the commit point:
  // replacement is mounted, while activeInputNode still points to the old node.
  body.children = [replacement, nextSibling]; replacement.parentNode = body;
  const fallbackContainer = { id: 'error-banner-container' };
  const result = { displayed: 'Old displayed value', error: '' };
  const sandbox = {
    document: { body, getElementById(id) { return id === fallbackContainer.id ? fallbackContainer : null; } },
    activeInputNode: oldNode, inputGeneration: 1, schedulerEpoch: 5,
    DebounceScheduler: { schedule(raw, target, generation, callback, delay) { jobs.push({ raw, target, generation, callback, delay }); } },
    handleDebouncedValidateAndDisplay(raw) {
      // Supplied fixture callback: verifies forwarding of the original raw text.
      result.displayed = raw.trim().length === 0 ? '【等待输入核对】' : raw;
      result.error = raw.trim().length === 0 ? '项目名不能为空，请输入有效字符' : '';
    },
    FeedbackBanner: {
      showGlobalError(text) { notifications.push(text); },
      showSevereFallbackDraft(raw, container) { forwardedFallbacks.push({ raw, matchingContainer: container === fallbackContainer }); },
    },
  };
  runInNewContext(code + '\nglobalThis.auditRollback = rollback;', sandbox);
  const state = { activeInputNode: oldNode, inputGeneration: 1, schedulerEpoch: 5, parentNode: body, nextSibling, draft, hadPendingTimer };
  sandbox.auditRollback(state, new Error('fixture reset post-replacement failure'), replacement);
  const scheduled = jobs.map(job => ({ raw: job.raw, targetIsOriginal: job.target === oldNode, generation: job.generation, delay: job.delay }));
  for (const job of jobs) job.callback(job.raw);
  return {
    draft, hadPendingTimer, failRollback,
    inputCount: body.children.filter(item => item.id === 'project-name-input').length,
    originalRestoredToOriginalPosition: body.children[0] === oldNode && body.children[1] === nextSibling,
    replacementStillMounted: replacement.parentNode === body,
    activeIsOriginal: sandbox.activeInputNode === oldNode,
    originalRawPreserved: oldNode.value === draft,
    generation: sandbox.inputGeneration, epoch: sandbox.schedulerEpoch,
    scheduled, result, notifications, forwardedFallbacks,
  };
}
const replacementRecovery = scenario('Keep me', false);
const pendingRecovery = ['', '   ', 'New pending draft'].map(draft => scenario(draft, true));
const originalRaw = '  Critical-Draft\nLine 2   spaced\t末尾  ';
const severeRecovery = scenario(originalRaw, true, true);
const moduleContent = blocks.get('blk-tech-module').content;
const results = {
  kind: 'partial non-executable illustration audit with explicit fixture dependencies; no target app or native browser/IME/performance test',
  sourceSnapshotSha256: createHash('sha256').update(snapshotBytes).digest('hex'),
  blockId: 'blk-tech-interface',
  replacementRecovery, pendingRecovery, severeRecovery,
  illustrationChecks: {
    r6B1ReplacementRemoved: replacementRecovery.inputCount === 1 && !replacementRecovery.replacementStillMounted && replacementRecovery.originalRestoredToOriginalPosition,
    r6B2AllDraftsForwarded: pendingRecovery.every(test => test.scheduled.length === 1 && test.scheduled[0].raw === test.draft),
    severeRawForwardedWithoutChange: severeRecovery.forwardedFallbacks.length === 1 && severeRecovery.forwardedFallbacks[0].raw === originalRaw,
  },
  normativeConflicts: {
    moduleResetSequence: moduleContent.split('\n').find(line => line.includes('handleReset(): void')),
    interfaceResetSequence: interfaceContent.split('\n').find(line => line.includes('handleReset(): void')),
    preservedModuleHasEarlyIncrement: moduleContent.includes('调用 DebounceScheduler.cancel()，递增 inputGeneration，创建全新 input 节点'),
    finalInterfaceHasAppInitSignature: interfaceContent.includes('init(elements:'),
  },
};
writeFileSync(join(directory, 'review-r7-rollback-illustration-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ sourceSnapshotSha256: results.sourceSnapshotSha256, illustrationChecks: results.illustrationChecks, normativeConflicts: results.normativeConflicts }, null, 2));
