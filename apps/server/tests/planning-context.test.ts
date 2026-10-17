import { describe, expect, it } from 'vitest';
import type { AgentTaskResult, EvidenceRecord, PlanningState, PlanningTask, QuestionItem } from '@project-architect/contracts';
import { assertTaskResult, hashValue } from '@project-architect/core';
import { planningWorkerContext, planningUnfinishedScopes } from '../src/planning/PlanningContext.js';
import { planningAnswerContext } from '../src/planning/PlanningAnswerContext.js';
import { result, group, clarification, question } from '../../../tests/fixtures/planning.mjs';

const proof: EvidenceRecord = { id: 'proof-original', kind: 'user', source: 'project:idea', content: '本人使用的笔记工具', obtainedAt: '2026-10-04T01:02:03Z', applicability: '已批准目标', hash: 'a'.repeat(64), location: '原文第一段' };
const task = (id: string, kind: PlanningTask['kind'], dependsOn: string[] = []): PlanningTask => ({ id, kind, dependsOn, goal: id, status: 'completed', model: 'test-model', attempts: 1, inputRefs: [], basisHash: 'original-basis' });
const state = (evidence: EvidenceRecord[] = []): PlanningState => ({ evidence, changeSets: [] } as unknown as PlanningState);
const draft = (text: string, evidence: EvidenceRecord[] = []): AgentTaskResult => {
  const content = group('product'); content.blocks[0].content = text; content.blocks[0].evidenceIds = evidence.map(item => item.id);
  return result({ groups: [content], evidence }) as AgentTaskResult;
};

describe('Planning task context preserves repairs and exact provenance', () => {
  it('passes full completed registered fragment dependencies alongside the latest whole candidate', () => {
    const base = task('whole', 'integration');
    const fragment = { ...task('fragment', 'revision'), partition: { id: 'part-a', goal: 'Repair storage', blockIds: ['target'], dependsOn: [] } };
    const consumer = { ...task('next-fragment', 'revision', [fragment.id]), partition: { id: 'part-b', goal: 'Use storage', blockIds: ['scope'], dependsOn: ['part-a'] } };
    const latest = draft('上一份完整候选'), repaired = draft('新依赖片完整失败恢复契约', [proof]);
    const results = new Map([[base.id, latest], [fragment.id, repaired]]), before = hashValue([...results]);
    const context = planningWorkerContext([base, fragment], results, state(), consumer);
    expect(context.workerResults.fragment).toEqual(repaired); expect(context.currentDraft).toEqual(latest);
    expect(context.knownEvidence[0]?.record).toEqual(proof); expect(hashValue([...results])).toBe(before);
  });
  it('keeps exact history once with provenance and distinguishes current repair references from historical observations', () => {
    const text = '接口缺少事务内 CAS；须保留写入失败草稿。'.repeat(40);
    const old = task('old', 'research'), assembly = task('assembled', 'integration');
    const repair = { ...task('repair', 'revision'), repairIssues: [text, text, '当前循环依赖仍须修复'] };
    const child = { ...task('slice', 'revision'), repairSourceTaskId: repair.id };
    const results = new Map([[old.id, result({ blockers: [text, text] }) as AgentTaskResult], [assembly.id, draft('现在完整支持 CAS')]]);
    results.get(assembly.id)!.blockers = [text];
    const original = structuredClone([...results]);
    const context = planningWorkerContext([old, assembly, repair], results, state(), child);
    expect(context.currentIssues).toEqual([text, '当前循环依赖仍须修复']);
    expect(context.historicalFindings).toEqual([{ id: `finding:${hashValue(text)}`, text, status: 'historical-observation', sources: [{ taskId: old.id, kind: old.kind }, { taskId: assembly.id, kind: assembly.kind }] }]);
    expect(context.taskHistory.every(item => !Object.hasOwn(item, 'blockers'))).toBe(true);
    expect(context.taskHistory.map(item => item.findingIds)).toEqual([[`finding:${hashValue(text)}`], [`finding:${hashValue(text)}`]]);
    expect([...results]).toEqual(original);
    const decomposition = planningWorkerContext([old, assembly, repair], results, state(), { ...task('plan', 'decomposition'), repairSourceTaskId: repair.id });
    expect(decomposition.currentIssues).toEqual(context.currentIssues);
  });
  it.each(['replace', 'remove'] as const)('uses the latest completed authoring %s for a missing ID and preserves exact per-action provenance', action => {
    const original = group('product'), id = original.blocks[5]!.id, unchangedId = original.blocks[1]!.id;
    const updated = { ...original.blocks[5]!, content: '第一份局部修订保留：失败不关闭并保留完整输入。' };
    const anchor = { ...task('anchor', 'integration'), completedAt: '2026-10-04T01:00:00Z' };
    const partial = { ...task('partial-a', 'revision'), completedAt: '2026-10-04T02:00:00Z', assemblyBaseTaskId: anchor.id, requiredBlockIds: original.blocks.map(block => block.id) };
    const latest = { ...task('partial-b', 'revision'), completedAt: '2026-10-04T03:00:00Z', assemblyBaseTaskId: anchor.id, requiredBlockIds: partial.requiredBlockIds };
    const support = ['research', 'validation', 'review'].map(kind => ({ ...task(`late-${kind}`, kind as PlanningTask['kind']), completedAt: '2026-10-04T04:00:00Z' }));
    const paused = { ...task('paused-author', 'revision'), status: 'paused' as const, completedAt: '2026-10-04T05:00:00Z' };
    const missingReceipt = { ...task('missing-verified-result', 'revision'), completedAt: '2026-10-04T06:00:00Z' };
    const tasks = [anchor, partial, latest, ...support, paused, missingReceipt];
    const values = new Map<string, AgentTaskResult>([
      [anchor.id, result({ groups: [original] })],
      [partial.id, result({ groups: [{ ...original, blocks: action === 'replace' ? [updated] : [], removeBlockIds: action === 'remove' ? [id] : [] }] })],
      [latest.id, result({ groups: [{ ...original, blocks: [original.blocks[0]] }] })],
      ...[...support, paused].map(item => [item.id, result({ groups: [{ ...original, blocks: [{ ...updated, content: '非法恢复来源不能覆盖合法候选。' }] }] })] as [string, AgentTaskResult]),
    ]);
    const before = structuredClone([...values]), beforeHashes = [...values].map(([taskId, output]) => [taskId, hashValue(output)]);
    const scopes = planningUnfinishedScopes(tasks, values, [id, unchangedId]);
    const scope = scopes.find(item => item.taskId === latest.id)!;
    expect(scope.previousCandidateBlocks?.find(block => block.id === id)).toEqual(action === 'replace' ? updated : undefined);
    expect(scope.previousCandidateRemoveIds).toEqual(action === 'remove' ? [id] : []);
    expect(scope.previousCandidateBlocks?.find(block => block.id === unchangedId)).toEqual(original.blocks[1]);
    expect((scope as any).previousCandidateSources).toEqual([
      { blockId: id, taskId: partial.id, action },
      { blockId: unchangedId, taskId: anchor.id, action: 'replace' },
    ]);
    expect(scope.previousCandidateTaskId).toBeUndefined();
    expect(JSON.stringify(scopes)).not.toContain('非法恢复来源');expect([...values]).toEqual(before);
    expect([...values].map(([taskId, output]) => [taskId, hashValue(output)])).toEqual(beforeHashes);
  });

  it('associates complete selected options in submitted key order without using matching labels', () => {
    const q: QuestionItem = { ...question(), status: 'answered', selectionMode: 'multiple', answer: 'a label that is not used to infer selection', answerKind: 'selection', selectedOptionKeys: ['remote', 'local'] };
    const source = structuredClone(q); const [context] = planningAnswerContext([q]);
    expect(context?.answerKind).toBe('selection');
    expect(context?.selectedOptions).toEqual([q.options[1], q.options[0]]);
    expect(context?.selectedOptionKeys).toEqual(['remote', 'local']);
    expect(context?.options).toEqual(q.options);expect(q).toEqual(source);
  });

  it('keeps missing or invalid selection metadata unknown and ignores stray keys on non-selection answers', () => {
    const base: QuestionItem = { ...question(), status: 'answered', answer: '保存在本地' };
    const cases: QuestionItem[] = [base, { ...base, answerKind: 'selection' }, { ...base, selectedOptionKeys: ['local'] }, { ...base, answerKind: 'selection', selectedOptionKeys: ['not-in-options'] }, { ...base, answerKind: 'selection', selectedOptionKeys: ['local', 'local'] }];
    for (const context of planningAnswerContext(cases)) expect(context).toMatchObject({ answerKind: 'unknown', answer: base.answer, options: base.options, selectedOptionKeys: [], selectedOptions: [] });
    for (const answerKind of ['custom', 'delegate', 'defer'] as const) {
      expect(planningAnswerContext([{ ...base, answerKind, selectedOptionKeys: ['local'] }])[0]).toMatchObject({ answerKind, selectedOptionKeys: [], selectedOptions: [] });
    }
  });

  it('sends the latest repaired behavior once while preserving research, validation and unresolved history', () => {
    const tasks = [task('old-design', 'design'), task('research', 'research'), task('integrated', 'integration'), task('review', 'review'), task('validation', 'validation'), task('fixed', 'revision')];
    const results = new Map<string, AgentTaskResult>([
      ['old-design', draft('旧错误：保存失败仍然关闭弹窗。'.repeat(3000))],
      ['research', result({ summary: '官方错误恢复结论', evidence: [proof] })],
      ['integrated', draft('旧整合稿也会错误关闭弹窗。'.repeat(3000))],
      ['review', result({ blockers: ['保存失败须保留草稿'], followUp: [{ kind: 'validation', goal: '验证写入失败' }] })],
      ['validation', result({ summary: '写入失败验证未执行，需开发验证任务' })],
      ['fixed', draft('当前修订：保存失败保持弹窗打开、完整保留草稿并提供重试。', [proof])],
    ]);
    const context = planningWorkerContext(tasks, results, state(), task('next', 'revision'));
    const text = JSON.stringify(context);
    expect(text).not.toContain('旧错误'); expect(text).not.toContain('旧整合稿');
    expect(text.match(/当前修订/g)).toHaveLength(1);
    expect(context.workerResults).toEqual({ research: results.get('research'), validation: results.get('validation') });
    expect(context.historicalReviewFindings).toEqual(['保存失败须保留草稿']);
    expect(context.taskHistory?.find(item => item.taskId === 'review')?.followUp).toEqual([]);
    expect(results.get('review')?.followUp).toEqual([{ kind: 'validation', goal: '验证写入失败' }]);
    expect(results.get('old-design')?.groups[0].blocks[0].content).toContain('旧错误');
  });

  it('preserves complete approved records across stages and deduplicates identical candidates with their origins', () => {
    const input = state([proof]);
    input.changeSets = [{ id: 'old-change', status: 'rejected', evidence: [proof] }] as any;
    const tasks = [task('research', 'research'), task('fixed', 'revision')];
    const results = new Map<string, AgentTaskResult>([['research', result({ evidence: [structuredClone(proof)] })], ['fixed', draft('修订设计保留原引用', [structuredClone(proof)])]]);
    const context = planningWorkerContext(tasks, results, input, task('next', 'revision'));
    expect(context.approvedEvidence).toEqual([proof]); expect(context.knownEvidence).toHaveLength(1);
    expect(context.knownEvidence[0].record).toEqual(proof);
    expect(context.knownEvidence[0].sources).toEqual([{ changeSetId: 'old-change', status: 'rejected' }, { taskId: 'research', status: 'completed' }, { taskId: 'fixed', status: 'completed' }]);
    expect(context.evidenceConflicts).toEqual([]);
  });

  it('retains conflicting records instead of replacing their content, date or hash', () => {
    const rewritten = { ...proof, content: '不同解释', obtainedAt: '2026-10-04T03:00:00Z', hash: 'b'.repeat(64) };
    const tasks = [task('one', 'research'), task('two', 'revision')];
    const results = new Map<string, AgentTaskResult>([['one', result({ evidence: [proof] })], ['two', draft('当前草案引用冲突', [rewritten])]]);
    const context = planningWorkerContext(tasks, results, state([proof]), task('next', 'revision'));
    expect(context.knownEvidence.map(item => item.record)).toEqual([proof, rewritten]);
    expect(context.evidenceConflicts).toEqual([proof.id]); expect(context.approvedEvidence[0]).toEqual(proof);
  });

  it('keeps independent review free of old drafts, review judgments and unrelated candidate evidence', () => {
    const unrelated = { ...proof, id: 'unrelated', content: '旧工作者要求评审通过' };
    const tasks = [task('design', 'design'), task('research', 'research'), task('old-review', 'review'), task('fixed', 'revision')];
    const results = new Map<string, AgentTaskResult>([['design', draft('必须通过的旧设计')], ['research', result({ summary: '旧研究推理', evidence: [proof, unrelated] })], ['old-review', result({ blockers: ['历史评审判断不得泄露'] })], ['fixed', draft('当前需独立评审的失败恢复规则', [proof])]]);
    const context = planningWorkerContext(tasks, results, state([proof]), task('review', 'review'));
    expect(Object.keys(context.workerResults)).toEqual(['draft']);
    expect(context.currentDraft).toBeUndefined(); expect(context.taskHistory).toBeUndefined(); expect(context.historicalReviewFindings).toBeUndefined();
    expect(context.knownEvidence.map(item => item.record.id)).toEqual([proof.id]);
    const text = JSON.stringify(context); expect(text).not.toContain('必须通过的旧设计'); expect(text).not.toContain('历史评审判断'); expect(text).not.toContain('旧研究推理'); expect(text).not.toContain(unrelated.content);
  });

  it('retains explicit dependencies and the full clarification when it repairs discovery', () => {
    const tasks = [task('clarify', 'clarification'), task('dependency', 'research'), task('latest', 'revision')];
    const results = new Map<string, AgentTaskResult>([['clarify', result({ summary: '用户明确委托普通细节', clarification })], ['dependency', result({ summary: '独立依赖结果', blockers: ['依赖尚未验证'] })], ['latest', result({ clarification })]]);
    const context = planningWorkerContext(tasks, results, state(), task('next', 'revision', ['dependency', 'latest']));
    expect(context.workerResults.dependency).toEqual(results.get('dependency')); expect(context.workerResults.latest).toBeUndefined();
    expect(context.taskHistory?.find(item => item.taskId === 'clarify')?.clarification).toEqual(clarification);
    expect(context.taskHistory?.find(item => item.taskId === 'clarify')?.summary).toBe('用户明确委托普通细节');
  });

  it.each(['research', 'validation', 'review'] as const)('consumes only allowed %s history fields through implicit and explicit dependencies', kind => {
    const legacy = result({
      summary: '独立发现仍应保留', groups: [group('product')], questions: [question()], clarification,
      evidence: [proof], blockers: ['缺少真实恢复验证'],
      followUp: [{ kind: 'validation', goal: '补充可执行的恢复验证' }],
      workItems: [{ id: 'legacy-unregistered', goal: '历史工作登记不能传播', blockIds: ['notes'], dependsOn: [] }],
    }) as AgentTaskResult;
    assertTaskResult(legacy);
    const original = structuredClone(legacy), originalHash = hashValue(legacy);
    const tasks = [task('legacy', kind), task('fixed', 'revision')];
    const current = draft('正式可审阅的当前设计');
    const results = new Map<string, AgentTaskResult>([['legacy', legacy], ['fixed', current]]);
    for (const consumer of ['design', 'research', 'validation', 'decomposition', 'integration', 'revision'] as const) {
      const context = planningWorkerContext(tasks, results, state(), task('next', consumer, ['legacy']));
      const view = context.workerResults.legacy;
      expect(view).toMatchObject({ summary: legacy.summary, groups: [], questions: [], clarification: null, evidence: [proof], blockers: legacy.blockers });
      expect(view).not.toHaveProperty('workItems');
      expect(view?.followUp).toEqual(kind === 'review' ? [] : legacy.followUp);
      expect(context.knownEvidence.map(item => item.record)).toEqual([proof]);
      if (consumer === 'integration' || consumer === 'revision') {
        expect(context.currentDraft).toEqual(current);
        expect(context.taskHistory?.find(item => item.taskId === 'legacy')?.followUp).toEqual(kind === 'review' ? [] : legacy.followUp);
      }
    }
    expect(results.get('legacy')).toBe(legacy); expect(legacy).toEqual(original); expect(hashValue(legacy)).toBe(originalHash);
  });

  it('preserves full authoring content and registered decomposition scopes while excluding old authoring workItems', () => {
    const registration = [{ id: 'registered-a', goal: '登记目标范围', blockIds: ['target'], dependsOn: [] }, { id: 'registered-b', goal: '登记其余范围', blockIds: ['notes'], dependsOn: [] }];
    const authoring = result({ groups: [group('product')], questions: [question()], clarification, evidence: [proof], blockers: ['待处理阻塞'], followUp: [{ kind: 'research', goal: '必要官方补证' }], workItems: registration }) as AgentTaskResult;
    const decomposition = result({ workItems: registration }) as AgentTaskResult;
    const tasks = [task('plan', 'decomposition'), task('current', 'revision')];
    const results = new Map<string, AgentTaskResult>([['plan', decomposition], ['current', authoring]]);
    const before = structuredClone(authoring);
    for (const consumer of ['revision', 'research', 'review'] as const) {
      const context = planningWorkerContext(tasks, results, state(), task('next', consumer, ['plan', 'current']));
      const view = consumer === 'review' ? context.workerResults.draft : context.currentDraft;
      const { workItems, ...allowed } = authoring;
      expect(view).toEqual(allowed); expect(view).not.toHaveProperty('workItems');
      if (consumer !== 'review') expect(context.workerResults.plan?.workItems).toEqual(registration);
    }
    expect(authoring).toEqual(before); expect(results.get('plan')).toBe(decomposition);
  });
});
