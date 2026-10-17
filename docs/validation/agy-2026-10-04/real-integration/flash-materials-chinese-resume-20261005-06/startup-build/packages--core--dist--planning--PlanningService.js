import { randomUUID } from 'node:crypto';
import { classifyInput, emptyPlanningState, effectiveDecisionHash, hashValue, planningBasis, planningInputHash } from './PlanningState.js';
import { assertTaskResult, blueprintCoverage, validateQuestionSet } from './PlanningValidation.js';
import { ProjectStateMigration } from '../migrations/ProjectStateMigration.js';
import { planningDependencyCycles } from './PlanningDependencyGraph.js';
export class PlanningError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
function fail(code, message) { throw new PlanningError(code, message); }
function reflectDecisionChanges(s) {
    const hash = effectiveDecisionHash(s);
    if (s.planning.blueprint.decisionBasisHash && s.planning.blueprint.decisionBasisHash !== hash) {
        for (const stage of ['product', 'technical', 'delivery'])
            if (s.planning.blueprint.stages[stage] === 'approved')
                s.planning.blueprint.stages[stage] = 'needs-revision';
    }
    else if (!s.planning.blueprint.decisionBasisHash)
        s.planning.blueprint.decisionBasisHash = hash;
}
export class PlanningService {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    async get(projectPath) {
        const s = await this.engine.loadProject(projectPath);
        s.planning ??= emptyPlanningState();
        reflectDecisionChanges(s);
        // Older partial feedback records may already have marked all input reviewed.
        // Project their remaining review back into the gate without accepting it.
        const legacyHash = planningBasis(s).hash;
        for (const c of s.planning.changeSets)
            if (c.stage === 'feedback' && c.status === 'partially-approved' && !c.feedbackReview && c.basis.hash === legacyHash) {
                const review = this.feedbackReview(s, c);
                const approved = c.groups.filter(g => g.status === 'approved');
                review.affectedStages = [...new Set(approved.flatMap(g => g.blocks.map(b => b.stage)))];
                review.decisionChanges = approved.some(g => g.decisions.length || (g.rejectDecisionIds?.length ?? 0));
                delete s.planning.blueprint.approvedInputHash;
                this.updateFeedbackReview(s, review);
                c.basis = { ...planningBasis(s), revision: s.metadata.stateRevision };
            }
        const currentHash = planningBasis(s).hash;
        for (const c of s.planning.changeSets)
            if (['pending', 'partially-approved'].includes(c.status) && c.basis.hash !== currentHash)
                c.status = 'stale';
        const legacy = s.decisions.items.filter(d => !d.approvalSource && ['confirmed', 'locked'].includes(d.status));
        const suspect = legacy.filter(d => ['question', 'uncertainty', 'delegation'].includes(classifyInput(d.statement)) || legacy.some(other => other.id !== d.id && ((d.decisionKey && other.decisionKey === d.decisionKey) || (d.area === other.area && d.statement.trim() === other.statement.trim()))));
        const cleanupId = `legacy-cleanup-${planningBasis(s).hash.slice(0, 16)}`;
        for (const c of s.planning.changeSets)
            if (c.runId === 'migration' && c.basis.hash !== planningBasis(s).hash && ['pending', 'partially-approved'].includes(c.status))
                c.status = 'stale';
        const migrationChanges = s.planning.changeSets.filter(c => c.runId === 'migration');
        const unreviewed = suspect.filter(decision => !migrationChanges.some(change => change.groups.some(group => {
            if (group.title !== decision.statement || !group.rejectDecisionIds?.includes(decision.id))
                return false;
            // Rejecting cleanup explicitly retains this record text, even after unrelated input.
            if (group.status === 'rejected')
                return true;
            return group.status === 'pending' && ['pending', 'partially-approved'].includes(change.status) && change.basis.hash === currentHash;
        })));
        if (unreviewed.length && !s.planning.changeSets.some(c => c.id === cleanupId))
            s.planning.changeSets.push({
                id: cleanupId, runId: 'migration', stage: 'feedback', basis: planningBasis(s), summary: '审阅旧记录中可能误确认、重复或主题冲突的内容，选择需要退出当前方案的记录。', status: 'pending', createdAt: new Date().toISOString(), approvals: [], evidence: [],
                groups: unreviewed.map(d => ({ id: `cleanup-${d.id}`, title: d.statement, impact: '批准此分组会移除此条有效决定并保留历史；拒绝分组表示保留该条原文，不再重复推送相同记录的清理。相关方案将待修订。', dependsOn: [], blocks: [], removeBlockIds: [], decisions: [], rejectDecisionIds: [d.id], status: 'pending' })),
            });
        return s;
    }
    operation(s, id, payload, expectedRevision) {
        if (typeof id !== 'string' || !id.trim() || !Number.isInteger(expectedRevision))
            fail('INVALID_INTENT', '缺少操作 ID 或版本');
        const old = s.planning.operations.find(o => o.id === id);
        if (old) {
            if (old.fingerprint !== hashValue(payload))
                fail('IDEMPOTENCY_CONFLICT', '同一操作 ID 不能用于不同内容');
            return true;
        }
        if (s.metadata.stateRevision !== expectedRevision)
            fail('STATE_REVISION_CONFLICT', '方案版本已变化，请刷新后重试');
        return false;
    }
    async commit(path, s, id, payload, revision) {
        s.planning.operations.push({ id, fingerprint: hashValue(payload), revision: revision + 1 });
        try {
            return await this.engine.commitPlanningState(path, s, revision);
        }
        catch (error) {
            const current = await this.get(path);
            const old = current.planning.operations.find(o => o.id === id);
            if (old?.fingerprint === hashValue(payload))
                return current;
            throw error;
        }
    }
    async recordInput(path, raw, revision, operationId, kind) {
        const s = await this.get(path), payload = { raw, kind };
        if (this.operation(s, operationId, payload, revision))
            return s;
        if (typeof raw !== 'string' || !raw.trim() || (kind !== undefined && kind !== 'feedback'))
            fail('INVALID_INTENT', '输入不能为空，类型必须为反馈或省略');
        for (const q of s.questions.items)
            if (['shown', 'proposed'].includes(q.status))
                q.status = 'superseded';
        s.planning.inputs.push({ id: randomUUID(), raw, kind: kind ?? classifyInput(raw), createdAt: new Date().toISOString() });
        return this.commit(path, s, operationId, payload, revision);
    }
    async propose(path, proposal) {
        const s = await this.get(path);
        if (s.planning.changeSets.some(c => c.id === proposal.id)) {
            const operation = s.planning.operations.find(o => o.id === `proposal:${proposal.id}`);
            const normalized = { ...proposal, feedbackReview: undefined, status: 'pending', approvals: [], groups: proposal.groups.map(g => ({ ...g, status: 'pending' })) };
            if (operation?.fingerprint !== hashValue(normalized))
                fail('IDEMPOTENCY_CONFLICT', '同一变更包 ID 的内容已经不同');
            return s;
        }
        if (planningBasis(s).hash !== proposal.basis.hash)
            fail('STALE_BASIS', '本轮依据已经变化');
        proposal = { ...proposal, feedbackReview: undefined, status: 'pending', approvals: [], groups: proposal.groups.map(g => ({ ...g, status: 'pending' })) };
        this.validateGroups(s, proposal.groups);
        this.validateEvidence(s, proposal.evidence);
        const knownEvidence = new Map(s.planning.evidence.map(e => [e.id, e]));
        for (const e of proposal.evidence) {
            if (knownEvidence.has(e.id) && hashValue(knownEvidence.get(e.id)) !== hashValue(e))
                fail('INVALID_EVIDENCE', '证据 ID 已属于不同内容');
            knownEvidence.set(e.id, e);
        }
        s.planning.changeSets.push(proposal);
        return this.commit(path, s, `proposal:${proposal.id}`, proposal, s.metadata.stateRevision);
    }
    async installQuestions(path, basis, questions, runId) {
        const s = await this.get(path);
        const oldOperation = s.planning.operations.find(o => o.id === `questions:${runId}`);
        if (oldOperation) {
            if (oldOperation.fingerprint !== hashValue(questions))
                fail('IDEMPOTENCY_CONFLICT', '同一问题运行的内容已经不同');
            return s;
        }
        if (planningBasis(s).hash !== basis.hash)
            fail('STALE_BASIS', '本轮依据已经变化');
        const issues = validateQuestionSet(questions, s.planning);
        if (issues.length)
            fail('QUESTION_QUALITY_FAILED', issues.join('；'));
        for (const old of s.questions.items)
            if (old.status === 'proposed' || old.status === 'shown')
                old.status = 'superseded';
        const timestamp = new Date().toISOString();
        s.questions.items.unshift(...questions.map(q => ({ ...q, id: `${runId}-${q.id}`, status: 'shown', batchId: runId, basisRevision: s.metadata.stateRevision + 1, basisHash: basis.hash, createdAt: timestamp })));
        return this.commit(path, s, `questions:${runId}`, questions, s.metadata.stateRevision);
    }
    async answer(path, answers, revision, operationId) {
        const s = await this.get(path), payload = { answers };
        if (this.operation(s, operationId, payload, revision))
            return s;
        if (!Array.isArray(answers) || answers.length < 1 || answers.length > 3 || answers.some(a => !a || typeof a !== 'object' || typeof a.questionId !== 'string') || new Set(answers.map(a => a.questionId)).size !== answers.length)
            fail('INVALID_INTENT', '一次提交一至三道不同问题');
        const now = new Date().toISOString();
        const originalHash = planningBasis(s).hash;
        const answeredBatches = new Set();
        const answerKeys = new Set();
        for (const answer of answers) {
            const q = s.questions.items.find(q => q.id === answer.questionId);
            if (!q || !['shown', 'proposed'].includes(q.status))
                fail('INVALID_INTENT', '问题不存在或已经处理');
            if (q.basisHash && q.basisHash !== originalHash)
                fail('STALE_BASIS', '问题依据已变化，请重新澄清');
            const canonicalKey = s.planning.topics.find(t => t.key === q.decisionKey || t.aliases.includes(q.decisionKey ?? ''))?.key ?? q.decisionKey;
            if (!canonicalKey || answerKeys.has(canonicalKey))
                fail('TOPIC_CONFLICT', '同次回答包含重复主题');
            answerKeys.add(canonicalKey);
            if (q.batchId)
                answeredBatches.add(q.batchId);
            if (!['selection', 'custom', 'delegate', 'defer'].includes(answer.kind))
                fail('INVALID_INTENT', '回答类型无效');
            q.status = answer.kind === 'defer' ? 'dismissed' : 'answered';
            q.answeredAt = now;
            if (answer.kind !== 'selection') {
                if (answer.text !== undefined && typeof answer.text !== 'string')
                    fail('INVALID_INTENT', '答案必须为文字');
                const raw = answer.text?.trim() ? answer.text : (answer.kind === 'delegate' ? '交给 AI 拟定' : answer.kind === 'defer' ? '暂不决定' : '');
                if (!raw.trim())
                    fail('INVALID_INTENT', '自定义答案不能为空');
                q.answer = raw;
                q.answerKind = answer.kind;
                delete q.selectedOptionKeys;
                let topic = s.planning.topics.find(t => t.key === canonicalKey || t.aliases.includes(canonicalKey));
                if (!topic)
                    s.planning.topics.push(topic = { key: canonicalKey, aliases: [], history: [] });
                topic.lastAnswerKind = answer.kind;
                topic.lastAnsweredQuestionId = q.id;
                s.planning.inputs.push({ id: randomUUID(), raw, questionId: q.id, kind: answer.kind === 'delegate' ? 'delegation' : answer.kind === 'defer' ? 'uncertainty' : classifyInput(raw), createdAt: now });
                continue;
            }
            const keys = answer.optionKeys ?? [];
            if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length || (q.selectionMode !== 'multiple' && keys.length !== 1) || keys.some(k => !q.options.some(o => o.key === k)))
                fail('INVALID_INTENT', '选择项不存在或数量错误');
            const selected = q.options.filter(o => keys.includes(o.key));
            q.answerKind = 'selection';
            q.selectedOptionKeys = [...keys];
            const statement = `${q.question}\n${selected.map(o => `${o.label}：${o.approach ?? o.label}`).join('\n')}`;
            q.answer = selected.map(o => o.label).join('、');
            const id = `dec-${randomUUID()}`;
            let topic = s.planning.topics.find(t => t.key === q.decisionKey || t.aliases.includes(q.decisionKey ?? ''));
            if (s.decisions.items.some(d => d.status === 'locked' && (d.decisionKey === canonicalKey || topic?.aliases.includes(d.decisionKey ?? ''))))
                fail('LOCKED_CONFLICT', '主题有锁定决定，请先解除锁定');
            if (topic?.effectiveDecisionId) {
                const prior = s.decisions.items.find(d => d.id === topic.effectiveDecisionId);
                if (prior?.status === 'locked')
                    fail('LOCKED_CONFLICT', '请先解除原决定的锁定');
                if (prior) {
                    prior.status = 'superseded';
                    prior.supersededBy = `decision:${id}`;
                }
            }
            s.decisions.items.push({ id, area: q.area ?? 'general', decisionKey: topic?.key ?? q.decisionKey, statement, rationale: selected.map(o => o.impact).join('\n'), status: 'confirmed', origin: 'user', confirmedBy: 'user', approvalSource: `answer:${operationId}`, evidenceRefs: [`question:${q.id}`], createdAt: now, updatedAt: now });
            if (!topic)
                s.planning.topics.push(topic = { key: q.decisionKey, aliases: [], history: [] });
            topic.effectiveDecisionId = id;
            topic.history.push(id);
            topic.lastAnswerKind = 'selection';
            topic.lastAnsweredQuestionId = q.id;
            s.planning.evidence.push({ id: `answer-${id}`, kind: 'user', content: q.answer, source: `question:${q.id}`, obtainedAt: now, applicability: q.decisionKey });
            const gap = s.gaps.gaps.find(g => `gap:${g.id}` === q.issueRef);
            if (gap)
                gap.status = 'addressed';
            s.decisions.traces ??= [];
            s.decisions.traces.push({ id: randomUUID(), questionRef: `question:${q.id}`, userAnswer: q.answer, decisionRef: `decision:${id}`, stateChanges: [{ ref: `question:${q.id}`, action: 'question-answered' }, { ref: `decision:${id}`, action: 'decision-created' }, ...(gap ? [{ ref: `gap:${gap.id}`, action: 'gap-addressed' }] : [])], createdAt: now });
        }
        ProjectStateMigration.migrateInMemory(s);
        reflectDecisionChanges(s);
        const nextHash = planningBasis(s).hash;
        for (const q of s.questions.items)
            if (q.batchId && answeredBatches.has(q.batchId) && ['shown', 'proposed'].includes(q.status))
                q.basisHash = nextHash;
        return this.commit(path, s, operationId, payload, revision);
    }
    validateGroups(s, groups, allowUserLockIntent = false) {
        if (!Array.isArray(groups))
            fail('INVALID_CHANGESET', '变更分组必须为数组');
        try {
            const checked = groups.map(g => ({ ...g, status: 'pending', blocks: !allowUserLockIntent ? g.blocks : g.blocks.map(block => {
                    // Only a user's explicit editor intent may carry this metadata. All
                    // other properties still pass the strict Provider content contract.
                    if (Object.hasOwn(block, 'locked') && typeof block.locked !== 'boolean')
                        throw new Error('锁定意图必须为布尔值');
                    const { locked, ...content } = block;
                    void locked;
                    return content;
                }) }));
            assertTaskResult({ summary: '编辑验证', groups: checked, questions: [], evidence: [], blockers: [], followUp: [], clarification: null });
        }
        catch {
            fail('INVALID_CHANGESET', '变更分组结构无效');
        }
        if (new Set(groups.map(g => g.id)).size !== groups.length)
            fail('INVALID_CHANGESET', '变更组 ID 重复');
        if (planningDependencyCycles(groups).length)
            fail('DEPENDENCY_CONFLICT', '变更分组存在循环依赖');
        const groupIds = new Set(groups.map(group => group.id));
        const ids = new Set([...s.planning.blueprint.blocks.map(b => b.id), ...groups.flatMap(g => g.blocks.map(b => b.id))]);
        for (const group of groups) {
            if (group.dependsOn.some(id => !groupIds.has(id)))
                fail('INVALID_CHANGESET', '变更组依赖不存在');
            for (const b of group.blocks)
                if (b.dependsOn.some(id => !ids.has(id)))
                    fail('INVALID_CHANGESET', `${b.id} 的依赖不存在`);
            const evidenceIds = new Set([...s.planning.evidence.map(e => e.id), ...s.planning.changeSets.flatMap(c => c.evidence.map(e => e.id))]);
            // Evidence supplied by this proposal is checked by approve against the proposal's own records.
            for (const d of group.decisions)
                if (!d.decisionKey?.trim() || !d.statement?.trim())
                    fail('INVALID_CHANGESET', '决定建议缺少主题或内容');
            void evidenceIds;
        }
    }
    validateEvidence(s, incoming) {
        const records = [...s.planning.evidence, ...s.planning.changeSets.flatMap(c => c.evidence), ...incoming];
        const known = new Map();
        const conflicts = new Set();
        for (const e of records) {
            const hash = hashValue(e);
            if (known.has(e.id) && known.get(e.id) !== hash)
                conflicts.add(e.id);
            else
                known.set(e.id, hash);
        }
        if (conflicts.size)
            fail('INVALID_EVIDENCE', `证据 ID 已属于不同内容：${[...conflicts].join('、')}。复用不可变原记录，或为新证据使用新 ID 并更新引用。`);
    }
    /** Reuse authoritative commit checks before sending a draft to review/repair. */
    draftIssues(s, draft) {
        const issues = [];
        for (const validate of [() => this.validateGroups(s, draft.groups), () => this.validateEvidence(s, draft.evidence)]) {
            try {
                validate();
            }
            catch (error) {
                if (error instanceof PlanningError)
                    issues.push(`${error.code}: ${error.message}`);
                else
                    throw error;
            }
        }
        return issues;
    }
    async edit(path, id, groups, revision, operationId) {
        const s = await this.get(path), payload = { id, groups };
        if (this.operation(s, operationId, payload, revision))
            return s;
        const c = s.planning.changeSets.find(c => c.id === id);
        if (!c || !['pending', 'partially-approved'].includes(c.status))
            fail('INVALID_CHANGESET', '变更包不可编辑');
        if (planningBasis(s).hash !== c.basis.hash)
            fail('STALE_BASIS', '方案依据已变化，请重新规划');
        this.validateGroups(s, groups, true);
        this.validateEvidence(s, c.evidence);
        for (const old of c.groups.filter(g => g.status === 'approved'))
            if (hashValue(old) !== hashValue(groups.find(g => g.id === old.id)))
                fail('INVALID_CHANGESET', '不能编辑已批准内容');
        c.groups = groups.map(g => ({ ...g, status: c.groups.find(old => old.id === g.id)?.status ?? 'pending' }));
        return this.commit(path, s, operationId, payload, revision);
    }
    feedbackReview(s, c) {
        if (c.stage !== 'feedback')
            return undefined;
        if (c.feedbackReview)
            return c.feedbackReview;
        const current = planningBasis(s).hash;
        if (c.status === 'stale' || c.basis.hash !== current)
            return undefined;
        const inputHash = planningInputHash(s);
        const previous = s.planning.changeSets.find(sibling => sibling.stage === 'feedback' && ['pending', 'partially-approved'].includes(sibling.status) && sibling.basis.hash === current && sibling.feedbackReview?.currentBasisHash === current && sibling.feedbackReview.inputHash === inputHash)?.feedbackReview;
        const review = previous ? structuredClone(previous) : { sourceBasisHash: current, inputHash, currentBasisHash: current, baselineStages: { ...s.planning.blueprint.stages }, affectedStages: [], decisionChanges: false };
        // Keep same-basis siblings in this review even when approval later makes
        // their drafts stale. Their approval basis itself is never advanced.
        for (const sibling of s.planning.changeSets)
            if (sibling.stage === 'feedback' && ['pending', 'partially-approved'].includes(sibling.status) && sibling.basis.hash === current && !sibling.feedbackReview)
                sibling.feedbackReview = structuredClone(review);
        return c.feedbackReview;
    }
    updateFeedbackReview(s, review) {
        const cohort = s.planning.changeSets.filter(c => c.stage === 'feedback' && c.feedbackReview?.sourceBasisHash === review.sourceBasisHash && c.feedbackReview.inputHash === review.inputHash);
        const affected = new Set(cohort.flatMap(c => c.feedbackReview.affectedStages));
        const decisionChanges = cohort.some(c => c.feedbackReview.decisionChanges);
        const pending = cohort.some(c => c.groups.some(g => g.status === 'pending'));
        const stages = { ...review.baselineStages };
        for (const stage of ['product', 'technical', 'delivery']) {
            if (affected.has(stage))
                stages[stage] = blueprintCoverage(s.planning.blueprint.blocks, stage).length ? 'needs-revision' : 'approved';
            else if (decisionChanges && stages[stage] === 'approved')
                stages[stage] = 'needs-revision';
        }
        if (affected.has('product') && !affected.has('technical') && stages.technical === 'approved')
            stages.technical = 'needs-revision';
        if ((affected.has('product') || affected.has('technical')) && !affected.has('delivery') && stages.delivery === 'approved')
            stages.delivery = 'needs-revision';
        if (pending)
            for (const stage of ['product', 'technical', 'delivery'])
                if (stages[stage] === 'approved')
                    stages[stage] = 'needs-revision';
        s.planning.blueprint.stages = stages;
        if (!pending)
            s.planning.blueprint.approvedInputHash = review.inputHash;
        const currentBasisHash = planningBasis(s).hash;
        for (const c of cohort)
            c.feedbackReview = { ...c.feedbackReview, affectedStages: [...affected], decisionChanges, currentBasisHash };
    }
    async approve(path, id, request) {
        const s = await this.get(path), payload = { id, groupIds: request.groupIds, unlockIds: request.unlockIds ?? [] };
        if (this.operation(s, request.operationId, payload, request.expectedRevision))
            return s;
        const c = s.planning.changeSets.find(c => c.id === id);
        if (c?.status === 'stale')
            fail('STALE_BASIS', '方案依据已经变化，请重新规划');
        if (!c || !['pending', 'partially-approved'].includes(c.status))
            fail('INVALID_CHANGESET', '变更包不可批准');
        if (planningBasis(s).hash !== c.basis.hash)
            fail('STALE_BASIS', '本轮依据已经变化，请重新规划');
        if (!Array.isArray(request.groupIds) || !request.groupIds.length || new Set(request.groupIds).size !== request.groupIds.length || request.groupIds.some(id => typeof id !== 'string') || (request.unlockIds !== undefined && (!Array.isArray(request.unlockIds) || request.unlockIds.some(id => typeof id !== 'string'))))
            fail('INVALID_INTENT', '需要选择有效分组和解锁 ID');
        const selected = c.groups.filter(g => request.groupIds.includes(g.id));
        if (selected.length !== request.groupIds.length || selected.some(g => g.status !== 'pending'))
            fail('INVALID_INTENT', '分组不存在或已经处理');
        const touched = new Set();
        for (const group of selected) {
            for (const blockId of new Set([...group.removeBlockIds, ...group.blocks.map(b => b.id)])) {
                if (touched.has(blockId))
                    fail('INVALID_CHANGESET', '多个所选分组修改同一蓝图块，请先整合');
                touched.add(blockId);
            }
        }
        const selectedKeys = selected.flatMap(g => g.decisions.map(d => s.planning.topics.find(t => t.key === d.decisionKey || t.aliases.includes(d.decisionKey))?.key ?? d.decisionKey));
        if (new Set(selectedKeys).size !== selectedKeys.length)
            fail('TOPIC_CONFLICT', '所选变更包含同一主题的多个决定，请先整合');
        const declared = new Map();
        for (const p of selected.flatMap(g => g.decisions)) {
            const canonical = s.planning.topics.find(t => t.key === p.decisionKey || t.aliases.includes(p.decisionKey))?.key ?? p.decisionKey;
            for (const name of [p.decisionKey, ...(p.aliases ?? [])]) {
                const key = s.planning.topics.find(t => t.key === name || t.aliases.includes(name))?.key ?? name;
                if (declared.has(key) && declared.get(key) !== canonical)
                    fail('TOPIC_CONFLICT', '新增主题与别名存在冲突，请先整合');
                declared.set(key, canonical);
            }
        }
        this.validateEvidence(s, c.evidence);
        const allowed = new Set([...request.groupIds, ...c.groups.filter(g => g.status === 'approved').map(g => g.id)]);
        if (selected.some(g => g.dependsOn.some(dep => !allowed.has(dep))))
            fail('DEPENDENCY_CONFLICT', '所选分组依赖尚未批准内容');
        const unlocked = new Set(request.unlockIds ?? []), now = new Date().toISOString();
        const touchedIds = new Set(selected.flatMap(g => [...g.removeBlockIds, ...g.blocks.map(b => b.id)]));
        const affectedStages = new Set([...s.planning.blueprint.blocks.filter(b => touchedIds.has(b.id)), ...selected.flatMap(g => g.blocks)].map(b => b.stage));
        const feedbackReview = this.feedbackReview(s, c);
        const evidence = new Map([...s.planning.evidence, ...c.evidence].map(e => [e.id, e]));
        let blocks = [...s.planning.blueprint.blocks];
        for (const group of selected) {
            for (const blockId of [...group.removeBlockIds, ...group.blocks.map(b => b.id)])
                if (blocks.find(b => b.id === blockId)?.locked && !unlocked.has(blockId))
                    fail('LOCKED_CONFLICT', `蓝图 ${blockId} 已锁定`);
            blocks = blocks.filter(b => !group.removeBlockIds.includes(b.id) && !group.blocks.some(next => next.id === b.id));
            for (const b of group.blocks) {
                if (b.evidenceIds.some(id => !evidence.has(id)))
                    fail('INVALID_EVIDENCE', `蓝图 ${b.id} 引用了缺失证据`);
                blocks.push({ ...b, approvedBy: request.operationId, approvedAt: now });
            }
            for (const id of group.rejectDecisionIds ?? []) {
                const d = s.decisions.items.find(d => d.id === id);
                if (!d)
                    fail('INVALID_CHANGESET', '旧决定不存在');
                if (d.status === 'locked' && !unlocked.has(id))
                    fail('LOCKED_CONFLICT', '旧决定需要明确解锁');
                d.status = 'rejected';
                d.rejectionReason = `approved-cleanup:${c.id}`;
                d.updatedAt = now;
                const topic = s.planning.topics.find(t => t.effectiveDecisionId === id);
                if (topic)
                    topic.effectiveDecisionId = undefined;
            }
            for (const proposal of group.decisions) {
                if (proposal.evidenceIds.some(id => !evidence.has(id)))
                    fail('INVALID_EVIDENCE', '决定引用的证据不存在');
                let topic = s.planning.topics.find(t => t.key === proposal.decisionKey || t.aliases.includes(proposal.decisionKey));
                if (!topic)
                    s.planning.topics.push(topic = { key: proposal.decisionKey, aliases: [], history: [] });
                const replaces = new Set([...(proposal.replaces ?? []), ...s.decisions.items.filter(d => ['confirmed', 'locked'].includes(d.status) && (d.decisionKey === topic.key || topic.aliases.includes(d.decisionKey ?? ''))).map(d => d.id)]);
                const newId = `dec-${randomUUID()}`;
                for (const oldId of replaces) {
                    const old = s.decisions.items.find(d => d.id === oldId);
                    if (!old)
                        fail('INVALID_CHANGESET', '被替代决定不存在');
                    if (old.status === 'locked' && !unlocked.has(oldId))
                        fail('LOCKED_CONFLICT', '原决定需要明确解锁');
                    old.status = 'superseded';
                    old.supersededBy = `decision:${newId}`;
                    old.updatedAt = now;
                    for (const oldTopic of s.planning.topics)
                        if (oldTopic.effectiveDecisionId === oldId)
                            oldTopic.effectiveDecisionId = undefined;
                }
                for (const alias of proposal.aliases ?? [])
                    if (s.planning.topics.some(t => t !== topic && (t.key === alias || t.aliases.includes(alias))))
                        fail('TOPIC_CONFLICT', '别名已经属于另一个主题');
                topic.aliases = [...new Set([...topic.aliases, ...(proposal.aliases ?? [])])];
                topic.history.push(newId);
                topic.effectiveDecisionId = newId;
                s.decisions.items.push({ id: newId, area: proposal.area, statement: proposal.statement, decisionKey: topic.key, rationale: proposal.rationale, status: 'confirmed', origin: 'agent', confirmedBy: 'user', evidenceRefs: [], evidenceIds: proposal.evidenceIds, createdAt: now, updatedAt: now, approvalSource: `${c.id}:${request.operationId}` });
            }
            group.status = 'approved';
        }
        if (blocks.some(b => b.dependsOn.some(dep => !blocks.some(other => other.id === dep))))
            fail('DEPENDENCY_CONFLICT', '批准会留下缺失的蓝图依赖');
        const structuralIssues = blueprintCoverage(blocks).filter(issue => /循环依赖|ID 重复|关联了不存在/.test(issue));
        if (structuralIssues.length)
            fail('DEPENDENCY_CONFLICT', structuralIssues.join('；'));
        s.planning.blueprint.blocks = blocks;
        const usedEvidence = new Set(selected.flatMap(g => [...g.blocks.flatMap(b => b.evidenceIds), ...g.decisions.flatMap(d => d.evidenceIds)]));
        s.planning.evidence = [...new Map([...s.planning.evidence, ...c.evidence.filter(e => usedEvidence.has(e.id))].map(e => [e.id, e])).values()];
        c.status = c.groups.every(g => g.status !== 'pending') ? 'approved' : 'partially-approved';
        if (['product', 'technical', 'delivery'].includes(c.stage)) {
            const stage = c.stage;
            if (c.status === 'approved' && !blueprintCoverage(blocks, stage).length)
                s.planning.blueprint.stages[stage] = 'approved';
            else
                s.planning.blueprint.stages[stage] = 'needs-revision';
            if (stage === 'product' && s.planning.blueprint.stages.technical === 'approved')
                s.planning.blueprint.stages.technical = 'needs-revision';
            if (stage !== 'delivery' && s.planning.blueprint.stages.delivery === 'approved')
                s.planning.blueprint.stages.delivery = 'needs-revision';
        }
        else if (feedbackReview) {
            feedbackReview.affectedStages = [...new Set([...feedbackReview.affectedStages, ...affectedStages])];
            feedbackReview.decisionChanges ||= selected.some(g => g.decisions.length || (g.rejectDecisionIds?.length ?? 0));
        }
        c.approvals.push({ operationId: request.operationId, groupIds: request.groupIds, at: now, revision: request.expectedRevision + 1 });
        ProjectStateMigration.migrateInMemory(s);
        s.planning.blueprint.decisionBasisHash = effectiveDecisionHash(s);
        if (feedbackReview)
            this.updateFeedbackReview(s, feedbackReview);
        else if (c.status === 'approved')
            s.planning.blueprint.approvedInputHash = planningInputHash(s);
        c.basis = { ...planningBasis(s), revision: request.expectedRevision + 1 };
        return this.commit(path, s, request.operationId, payload, request.expectedRevision);
    }
    async reject(path, id, groupIds, revision, operationId) {
        const s = await this.get(path), payload = { id, groupIds };
        if (this.operation(s, operationId, payload, revision))
            return s;
        const c = s.planning.changeSets.find(c => c.id === id);
        if (!c || !Array.isArray(groupIds) || !groupIds.length || new Set(groupIds).size !== groupIds.length || groupIds.some(id => !c.groups.some(g => g.id === id && g.status === 'pending')))
            fail('INVALID_CHANGESET', '分组不可拒绝');
        const review = this.feedbackReview(s, c);
        const currentReview = review && review.currentBasisHash === planningBasis(s).hash && review.inputHash === planningInputHash(s);
        const currentDraft = c.status !== 'stale' && c.basis.hash === planningBasis(s).hash;
        for (const g of c.groups)
            if (groupIds.includes(g.id))
                g.status = 'rejected';
        c.status = c.groups.every(g => g.status === 'rejected') ? 'rejected' : c.groups.some(g => g.status === 'pending') ? 'partially-approved' : 'approved';
        if (c.status === 'approved' && c.basis.hash === planningBasis(s).hash && ['product', 'technical', 'delivery'].includes(c.stage)) {
            const stage = c.stage;
            s.planning.blueprint.stages[stage] = blueprintCoverage(s.planning.blueprint.blocks, stage).length ? 'needs-revision' : 'approved';
            s.planning.blueprint.approvedInputHash = planningInputHash(s);
        }
        if (currentReview) {
            this.updateFeedbackReview(s, review);
            if (currentDraft)
                c.basis = { ...planningBasis(s), revision: revision + 1 };
        }
        return this.commit(path, s, operationId, payload, revision);
    }
    async publishPackage(path, manifest, expectedRevision) {
        const s = await this.get(path), payload = { manifest };
        if (this.operation(s, manifest.operationId, payload, expectedRevision))
            return s;
        if (planningBasis(s).hash !== manifest.basisHash)
            fail('STALE_BASIS', '编译依据已变化');
        s.planning.package = manifest;
        return this.commit(path, s, manifest.operationId, payload, expectedRevision);
    }
    async invalidateRun(path, runId) {
        const s = await this.get(path);
        const changes = s.planning.changeSets.filter(c => c.runId === runId && ['pending', 'partially-approved'].includes(c.status));
        const questions = s.questions.items.filter(q => q.batchId?.startsWith(runId) && ['shown', 'proposed'].includes(q.status));
        if (!changes.length && !questions.length)
            return;
        changes.forEach(c => c.status = 'stale');
        questions.forEach(q => q.status = 'superseded');
        await this.commit(path, s, `cancel:${runId}:${s.metadata.stateRevision}`, { runId }, s.metadata.stateRevision);
    }
}
//# sourceMappingURL=PlanningService.js.map