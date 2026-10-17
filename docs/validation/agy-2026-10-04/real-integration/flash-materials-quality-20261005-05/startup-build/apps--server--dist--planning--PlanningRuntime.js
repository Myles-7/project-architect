import { appendFile, mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { DEFAULT_PLANNING_CONFIG } from '@project-architect/contracts';
import { PlanningService, FileStorage, WorkspaceGuard, planningBasis, planningInputHash, hashValue, effectiveDecisionHash, assertTaskResult, validateQuestionSet, blueprintCoverage, PlanningError } from '@project-architect/core';
import { preparePlanningWorkspace, planningReasoningEffort } from '@project-architect/agent';
import { planningTaskSchema, assertPlanningTaskRole } from './PlanningSchema.js';
import { planningPrompt } from './PlanningPrompt.js';
import { semanticProgressSignature } from './PlanningProgress.js';
import { verifyTaskEvidence } from './PlanningEvidence.js';
import { normalizePlanningConfig } from './PlanningConfig.js';
import { planningWorkerContext, planningUnfinishedScopes } from './PlanningContext.js';
import { planningBlueprintContext } from './PlanningBlueprintContext.js';
import { planningAnswerContext } from './PlanningAnswerContext.js';
import { assemblePartitions, batchAssembledQuestions, isPlanningOutputLimit, partitionPrompt, partitionSchema, validatePartitionResult, validatePartitions } from './PlanningTaskPartition.js';
const clarificationComplete = (clarification) => Boolean(clarification) && ['target', 'problem', 'outcomes', 'scope', 'constraints'].every(k => Boolean(clarification[k]?.trim()) || clarification.delegated.includes(k));
export class PlanningRuntime extends EventEmitter {
    engine;
    provider;
    retryDelays;
    service;
    active = new Map();
    config;
    runningCalls = 0;
    waiters = [];
    operationLocks = new Map();
    storage = new FileStorage();
    constructor(engine, provider, config = {}, retryDelays = [5000, 20000]) {
        super();
        this.engine = engine;
        this.provider = provider;
        this.retryDelays = retryDelays;
        this.service = new PlanningService(engine);
        this.config = normalizePlanningConfig({ ...DEFAULT_PLANNING_CONFIG, ...config });
    }
    getConfig() { return structuredClone(this.config); }
    productReadiness(snapshot, runs) {
        if (snapshot.questions.items.some(q => ['shown', 'proposed'].includes(q.status)))
            return { ready: false, reason: '先回答或委托当前问题，再继续澄清。' };
        const product = snapshot.planning?.blueprint;
        // An already approved product remains a concrete starting point for revision.
        // The original clarification hash includes the blueprint, so it cannot match
        // after the first approval. New output still requires normal proposal approval.
        if (product && ['approved', 'needs-revision'].includes(product.stages.product) && !blueprintCoverage(product.blocks, 'product').length)
            return { ready: true };
        const clarification = runs.find(r => r.stage === 'clarify' && r.clarification && r.status === 'reviewable' && r.basis.hash === planningBasis(snapshot).hash)?.clarification;
        if (!clarificationComplete(clarification ?? null))
            return { ready: false, reason: '请先澄清目标用户、问题、结果、范围和约束，或明确委托。' };
        return { ready: true };
    }
    async shutdown() { const active = [...this.active.values()]; active.forEach(a => a.abort.abort()); await Promise.allSettled(active.map(a => a.completion)); }
    configure(config) { this.config = normalizePlanningConfig(config); }
    async exclusive(path, fn) { const key = path.toLowerCase(); while (this.operationLocks.has(key))
        await this.operationLocks.get(key); let release; const lock = new Promise(r => release = r); this.operationLocks.set(key, lock); try {
        return await fn();
    }
    finally {
        this.operationLocks.delete(key);
        release();
    } }
    directory(path, id) { if (!/^run-[a-z0-9-]+$/.test(id))
        throw new PlanningError('INVALID_INTENT', '运行 ID 无效'); return join(path, 'runtime', 'planning', id); }
    async write(active, action) { const result = active.writes.then(action); active.writes = result.catch(() => { }); return result; }
    launch(active) { active.completion = this.execute(active).catch(error => { active.run.status = active.abort.signal.aborted ? 'cancelled' : 'paused'; active.run.error = `运行记录写入失败：${String(error)}`; this.emit('diagnostic', { runId: active.run.id, error: active.run.error }); }).finally(() => { if (this.active.get(active.run.id) === active)
        this.active.delete(active.run.id); }); }
    async save(active) { active.run.updatedAt = new Date().toISOString(); const copy = structuredClone(active.run); await this.write(active, () => this.storage.writeJson(join(this.directory(active.path, copy.id), 'run.json'), copy)); }
    async event(active, type, message, taskId) { const event = { seq: active.run.nextEventSeq++, at: new Date().toISOString(), type, message, ...(taskId ? { taskId } : {}) }; const path = join(this.directory(active.path, active.run.id), 'events.ndjson'); await this.write(active, async () => { await mkdir(dirname(path), { recursive: true }); await appendFile(path, JSON.stringify(event) + '\n'); }); await this.save(active); this.emit(active.run.id, event); }
    async list(path) {
        let names;
        try {
            names = await readdir(join(path, 'runtime', 'planning'));
        }
        catch {
            return [];
        }
        const runs = await Promise.all(names.filter(n => /^run-[a-z0-9-]+$/.test(n)).map(async (n) => (await this.storage.exists(join(this.directory(path, n), 'run.json'))) ? this.get(path, n) : null));
        return runs.filter((r) => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    async get(path, id) {
        const active = this.active.get(id);
        if (active && active.path === path)
            return structuredClone(active.run);
        const run = await this.storage.readJson(join(this.directory(path, id), 'run.json'));
        const journal = await this.events(path, id);
        run.nextEventSeq = Math.max(run.nextEventSeq, ...journal.map(e => e.seq + 1));
        if (run.status === 'running' || run.status === 'queued') {
            run.status = 'paused';
            run.error = '服务重启中断了运行，成功产物已保留，可继续。';
            run.tasks.forEach(t => { if (t.status === 'running') {
                t.status = 'paused';
                t.error = '运行被服务重启中断';
            } });
            await this.storage.writeJson(join(this.directory(path, id), 'run.json'), run);
        }
        return run;
    }
    async events(path, id, after = 0) { try {
        return (await readFile(join(this.directory(path, id), 'events.ndjson'), 'utf8')).split('\n').filter(Boolean).flatMap(line => { try {
            const e = JSON.parse(line);
            return e.seq > after ? [e] : [];
        }
        catch {
            return [];
        } });
    }
    catch {
        return [];
    } }
    async start(path, request) { return this.exclusive(path, () => this.startLocked(path, request)); }
    async startLocked(path, request) {
        if (!request || !['clarify', 'product', 'technical', 'delivery', 'feedback'].includes(request.stage) || typeof request.operationId !== 'string' || !request.operationId.trim() || !Number.isInteger(request.expectedRevision) || (request.feedback !== undefined && typeof request.feedback !== 'string') || (request.inputRefs !== undefined && (!Array.isArray(request.inputRefs) || request.inputRefs.some(id => typeof id !== 'string'))))
            throw new PlanningError('INVALID_INTENT', '阶段、版本和操作 ID 必填，反馈和材料引用必须有效');
        const existing = (await this.list(path)).find(r => r.operationId === request.operationId);
        if (existing) {
            if (hashValue(existing.request) !== hashValue(request))
                throw new PlanningError('IDEMPOTENCY_CONFLICT', '操作 ID 已用于不同请求');
            return existing;
        }
        let snapshot = await this.service.get(path);
        if (snapshot.metadata.stateRevision !== request.expectedRevision)
            throw new PlanningError('STATE_REVISION_CONFLICT', '项目版本已变化');
        if ((await this.list(path)).some(r => ['running', 'queued'].includes(r.status)))
            throw new PlanningError('RUN_CONFLICT', '当前项目已有运行，请取消或等待');
        const feedbackOperation = request.feedback ? snapshot.planning.operations.find(o => o.id === `feedback:${request.operationId}`) : undefined;
        if (request.feedback) {
            if (feedbackOperation && feedbackOperation.fingerprint !== hashValue({ raw: request.feedback, kind: request.stage === 'feedback' ? 'feedback' : undefined }))
                throw new PlanningError('IDEMPOTENCY_CONFLICT', '同一操作 ID 不能用于不同内容');
            if (!request.feedback.trim())
                throw new PlanningError('INVALID_INTENT', '输入不能为空，类型必须为反馈或省略');
        }
        if (request.stage === 'technical' && snapshot.planning.blueprint.stages.product !== 'approved')
            throw new PlanningError('STAGE_NOT_APPROVED', '请先批准产品与体验');
        if (request.stage === 'delivery' && snapshot.planning.blueprint.stages.technical !== 'approved')
            throw new PlanningError('STAGE_NOT_APPROVED', '请先批准技术与接口');
        if (request.stage === 'feedback' && !snapshot.planning.blueprint.blocks.length)
            throw new PlanningError('STAGE_NOT_APPROVED', '尚无正式方案可修订');
        if (request.stage === 'product') {
            let readinessSnapshot = snapshot, clarificationRuns = await this.list(path);
            if (request.feedback && !feedbackOperation) {
                // Preview readiness without committing: new input supersedes pending
                // questions and invalidates all previously completed clarification bases.
                readinessSnapshot = structuredClone(snapshot);
                for (const q of readinessSnapshot.questions.items)
                    if (['shown', 'proposed'].includes(q.status))
                        q.status = 'superseded';
                clarificationRuns = [];
            }
            const readiness = this.productReadiness(readinessSnapshot, clarificationRuns);
            if (!readiness.ready)
                throw new PlanningError('CLARIFICATION_REQUIRED', readiness.reason);
        }
        if (request.feedback)
            snapshot = await this.service.recordInput(path, request.feedback, request.expectedRevision, `feedback:${request.operationId}`, request.stage === 'feedback' ? 'feedback' : undefined);
        const run = { id: `run-${randomUUID()}`, projectId: snapshot.metadata.projectId, stage: request.stage, basis: planningBasis(snapshot), operationId: request.operationId, request, effectiveConfig: this.getConfig(), status: 'queued', tasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pendingQuestions: [], nextEventSeq: 1, progressSignatures: [] };
        const active = { run, path, abort: new AbortController(), results: new Map(), writes: Promise.resolve() };
        this.active.set(run.id, active);
        try {
            await this.storage.writeJson(join(this.directory(path, run.id), 'basis.json'), snapshot);
            await this.save(active);
        }
        catch (error) {
            this.active.delete(run.id);
            throw error;
        }
        this.launch(active);
        return structuredClone(run);
    }
    async cancel(path, id) { return this.exclusive(path, async () => { const active = this.active.get(id); if (active && active.path === path) {
        active.abort.abort();
        active.run.status = 'cancelled';
        active.run.tasks.forEach(t => { if (t.status === 'running' || t.status === 'queued')
            t.status = 'cancelled'; });
        await this.event(active, 'cancelled', '已取消，保留已完成产物。');
        return structuredClone(active.run);
    } const run = await this.get(path, id); run.status = 'cancelled'; await this.service.invalidateRun(path, id); await this.storage.writeJson(join(this.directory(path, id), 'run.json'), run); return run; }); }
    async resume(path, id) { return this.exclusive(path, () => this.resumeLocked(path, id)); }
    async clearRejectedResult(active, task) {
        const runDirectory = this.directory(active.path, active.run.id), directory = join(runDirectory, 'tasks', task.id);
        const archived = new WorkspaceGuard(runDirectory).assertContained(runDirectory, join(runDirectory, task.outputRef));
        const rejection = await this.storage.readJson(join(dirname(archived), 'rejection.json'));
        for (const [name, expected] of [['result.json', rejection.resultBytesHash], ['result-receipt.json', rejection.receiptBytesHash]]) {
            if (expected && hashValue((await readFile(join(dirname(archived), name))).toString('base64')) !== expected)
                throw new PlanningError('RESULT_MODIFIED', '失效产物的诊断副本已修改');
            const current = join(directory, name);
            if (await this.storage.exists(current)) {
                if (!expected || hashValue((await readFile(current)).toString('base64')) !== expected)
                    throw new PlanningError('RESULT_MODIFIED', '失效登记后出现了不同的任务产物');
                await unlink(current);
            }
        }
        task.status = 'paused';
        task.error = rejection.reason;
        task.outputRef = undefined;
        task.outputHash = undefined;
        task.outputOrigin = undefined;
        task.completedAt = undefined;
        await this.save(active);
    }
    async rejectStoredResult(active, task, reason) {
        const directory = join(this.directory(active.path, active.run.id), 'tasks', task.id);
        const resultBytes = await this.storage.exists(join(directory, 'result.json')) ? await readFile(join(directory, 'result.json')) : undefined;
        const receiptBytes = await this.storage.exists(join(directory, 'result-receipt.json')) ? await readFile(join(directory, 'result-receipt.json')) : undefined;
        if (!resultBytes && !receiptBytes) {
            task.status = 'paused';
            task.error = reason;
            task.outputRef = undefined;
            task.outputHash = undefined;
            task.outputOrigin = undefined;
            task.completedAt = undefined;
            await this.save(active);
            return;
        }
        const resultBytesHash = resultBytes ? hashValue(resultBytes.toString('base64')) : undefined, receiptBytesHash = receiptBytes ? hashValue(receiptBytes.toString('base64')) : undefined;
        const suffix = `attempt-${task.attempts}-${hashValue({ resultBytesHash, receiptBytesHash })}`, archive = join(directory, 'scope-rejections', suffix);
        await mkdir(archive, { recursive: true });
        if (resultBytes)
            await writeFile(join(archive, 'result.json'), resultBytes);
        if (receiptBytes)
            await writeFile(join(archive, 'result-receipt.json'), receiptBytes);
        await this.storage.writeJson(join(archive, 'rejection.json'), { reason, resultBytesHash, receiptBytesHash, task: structuredClone(task), at: new Date().toISOString() });
        // Persist the diagnostic reference before removing canonical files. A
        // restart can finish this local transition without accepting those bytes.
        task.outputRef = `tasks/${task.id}/scope-rejections/${suffix}/result.json`;
        task.status = 'paused';
        task.error = reason;
        await this.save(active);
        await this.clearRejectedResult(active, task);
    }
    async resumeLocked(path, id) {
        const previous = this.active.get(id);
        if (previous && previous.path === path) {
            if (!['paused', 'failed', 'cancelled'].includes(previous.run.status))
                throw new PlanningError('RUN_CONFLICT', '此运行仍在执行');
            await previous.completion;
        }
        const run = await this.get(path, id);
        if (!['paused', 'failed', 'cancelled'].includes(run.status))
            throw new PlanningError('INVALID_INTENT', '此运行不能继续');
        if ((await this.list(path)).some(other => other.id !== id && ['running', 'queued'].includes(other.status)))
            throw new PlanningError('RUN_CONFLICT', '此项目已有运行');
        const s = await this.service.get(path);
        let answeredContinuation = false;
        if (planningBasis(s).hash !== run.basis.hash && run.pendingQuestions.length) {
            const questionIds = new Set(run.pendingQuestions.map(q => q.id));
            const original = await this.storage.readJson(join(this.directory(path, id), 'basis.json'));
            const comparison = structuredClone(s);
            const newDecisionIds = new Set(s.decisions.items.filter(d => d.evidenceRefs.some(ref => questionIds.has(ref.replace(/^question:/, '')))).map(d => d.id));
            comparison.decisions.items = comparison.decisions.items.filter(d => !newDecisionIds.has(d.id)).map(d => { const old = original.decisions.items.find(o => o.id === d.id); return d.status === 'superseded' && d.supersededBy && newDecisionIds.has(d.supersededBy.slice(9)) && old ? old : d; });
            comparison.planning.inputs = comparison.planning.inputs.filter(i => !i.questionId || !questionIds.has(i.questionId));
            // get() projects stale stages from decision changes. Compare the persisted
            // blueprint so only this round's answers can be removed from the basis.
            const persisted = await this.engine.loadProject(path);
            if (persisted.planning)
                comparison.planning.blueprint = persisted.planning.blueprint;
            const originalBlueprint = original.planning?.blueprint;
            if (originalBlueprint && effectiveDecisionHash(comparison) === originalBlueprint.decisionBasisHash) {
                const projected = structuredClone(originalBlueprint);
                if (effectiveDecisionHash(s) !== originalBlueprint.decisionBasisHash)
                    for (const stage of ['product', 'technical', 'delivery'])
                        if (projected.stages[stage] === 'approved')
                            projected.stages[stage] = 'needs-revision';
                if (hashValue(comparison.planning.blueprint) === hashValue(projected))
                    comparison.planning.blueprint = originalBlueprint;
            }
            const handled = s.questions.items.filter(q => questionIds.has(q.id));
            if (planningBasis(comparison).hash === run.basis.hash) {
                if (handled.length !== questionIds.size || handled.some(q => !['answered', 'dismissed'].includes(q.status)))
                    throw new PlanningError('INVALID_INTENT', '本轮还有问题未回答，请先提交选择、委托或暂缓，再继续运行。');
                answeredContinuation = true;
                run.basis = planningBasis(s);
                run.pendingQuestions = [];
                run.progressSignatures = [];
                await this.storage.writeJson(join(this.directory(path, id), 'basis.json'), s);
            }
        }
        if (planningBasis(s).hash !== run.basis.hash) {
            run.status = 'stale';
            await this.storage.writeJson(join(this.directory(path, id), 'run.json'), run);
            throw new PlanningError('STALE_BASIS', '运行依据已变化，请重新启动');
        }
        const active = { run, path, abort: new AbortController(), results: new Map(), writes: Promise.resolve() };
        const receipts = new Map(), rebuildAssemblies = new Set(), incompleteScopes = new Set();
        const rejectionPlanPath = join(this.directory(path, id), 'scope-rejection-plan.json');
        const pendingRejections = new Map();
        if (await this.storage.exists(rejectionPlanPath)) {
            const plan = await this.storage.readJson(rejectionPlanPath);
            if (plan.version !== 1 || plan.runId !== id || !Array.isArray(plan.tasks) || !plan.tasks.length)
                throw new PlanningError('RESULT_MODIFIED', '登记范围的失效恢复记录无效');
            for (const entry of plan.tasks) {
                const task = run.tasks.find(task => task.id === entry.taskId);
                if (!task || task.kind === 'decomposition' || task.attempts !== entry.attempts || typeof entry.reason !== 'string' || !entry.reason.trim() || pendingRejections.has(entry.taskId))
                    throw new PlanningError('RESULT_MODIFIED', '登记范围的失效恢复记录与任务不一致');
                pendingRejections.set(entry.taskId, entry);
            }
        }
        for (const task of run.tasks) {
            if (task.partition)
                task.requiredBlockIds = [...task.partition.blockIds];
            if (task.outputRef?.startsWith(`tasks/${task.id}/scope-rejections/`)) {
                incompleteScopes.add(task.id);
                await this.clearRejectedResult(active, task);
                continue;
            }
            const directory = join(this.directory(path, id), 'tasks', task.id);
            const outputRef = `tasks/${task.id}/result.json`;
            const receiptPath = join(directory, 'result-receipt.json'), receiptExists = await this.storage.exists(receiptPath);
            if (!receiptExists && task.outputOrigin === 'assembly') {
                if (!task.partitionTaskIds?.length)
                    throw new PlanningError('RESULT_MODIFIED', '缺收据的汇集任务没有已登记的来源');
                // Artifact bytes without a receipt are never accepted, even when they
                // parse. Rebuild only the registered assembly from verified sources.
                rebuildAssemblies.add(task.id);
                continue;
            }
            if (await this.storage.exists(join(directory, 'result.json'))) {
                const receipt = await this.storage.readJson(receiptPath).catch(() => undefined);
                if (!receipt || receipt.taskId !== task.id)
                    throw new PlanningError('RESULT_MODIFIED', '保存的任务产物缺少有效哈希或已被修改，请保留诊断并重新运行');
                const result = await this.storage.readJson(join(directory, 'result.json'));
                assertTaskResult(result);
                if (hashValue(result) !== receipt.hash || (task.outputHash && task.outputHash !== receipt.hash))
                    throw new PlanningError('RESULT_MODIFIED', '保存的任务产物缺少有效哈希或已被修改，请保留诊断并重新运行');
                if (task.partition) {
                    validatePartitionResult(result, task.partition);
                    const touched = new Set(result.groups.flatMap(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds]));
                    if (!result.questions.length && task.partition.blockIds.some(id => !touched.has(id)))
                        incompleteScopes.add(task.id);
                }
                if (receipt.origin === 'assembly') {
                    if (task.partitionTaskIds && hashValue(task.partitionTaskIds) !== hashValue(receipt.children?.map(child => child.taskId)))
                        throw new PlanningError('RESULT_MODIFIED', '汇集登记范围与收据不一致');
                    if (task.assemblyBaseTaskId && task.assemblyBaseTaskId !== receipt.base?.taskId)
                        throw new PlanningError('RESULT_MODIFIED', '汇集基准与收据不一致');
                    task.partitionTaskIds = receipt.children?.map(child => child.taskId);
                    task.assemblyBaseTaskId = receipt.base?.taskId;
                    task.deferredQuestions = receipt.deferredQuestions ?? [];
                }
                task.outputOrigin = receipt.origin ?? task.outputOrigin;
                task.completedAt ??= receipt.completedAt;
                task.status = 'completed';
                task.outputRef = outputRef;
                task.outputHash = receipt.hash;
                task.basisHash ??= receipt.basisHash;
                active.results.set(task.id, result);
                receipts.set(task.id, receipt);
            }
            else if (receiptExists)
                throw new PlanningError('RESULT_MODIFIED', '任务收据存在但产物丢失');
        }
        if (incompleteScopes.size || pendingRejections.size) {
            const affected = new Set([...incompleteScopes, ...pendingRejections.keys()]);
            let changed = true;
            while (changed) {
                changed = false;
                for (const task of run.tasks) {
                    if (task.kind === 'decomposition' || affected.has(task.id))
                        continue;
                    if ([...(task.partitionTaskIds ?? []), ...(task.assemblyBaseTaskId ? [task.assemblyBaseTaskId] : []), ...task.dependsOn].some(id => affected.has(id))) {
                        affected.add(task.id);
                        changed = true;
                    }
                }
                const staleDrafts = run.tasks.filter(task => affected.has(task.id) && !task.partition && task.completedAt && ['design', 'integration', 'revision'].includes(task.kind));
                for (const task of run.tasks) {
                    if (affected.has(task.id) || !['design', 'integration', 'revision', 'review', 'research', 'validation'].includes(task.kind))
                        continue;
                    // These workers also read currentDraft implicitly. A later completed
                    // result must not resurrect a draft whose source scope was rejected.
                    const at = task.startedAt ?? task.completedAt;
                    if (at && staleDrafts.some(draft => at > draft.completedAt || (at === draft.completedAt && run.tasks.indexOf(task) > run.tasks.indexOf(draft)))) {
                        affected.add(task.id);
                        changed = true;
                    }
                }
            }
            const plan = { version: 1, runId: id, tasks: run.tasks.filter(task => affected.has(task.id)).map(task => pendingRejections.get(task.id) ?? { taskId: task.id, attempts: task.attempts, reason: incompleteScopes.has(task.id) ? '历史成功片遗漏登记范围；保留原产物诊断，重新执行本登记片。' : '依据失责登记片产生的旧草案或评审已失效，重新处理当前候选。' }) };
            // Persist the complete invalidation before clearing any source. The plan
            // survives a restart after one task loses its canonical result/reference.
            await this.storage.writeJson(rejectionPlanPath, plan);
            for (const entry of plan.tasks) {
                const task = run.tasks.find(task => task.id === entry.taskId);
                await this.rejectStoredResult(active, task, entry.reason);
                active.results.delete(task.id);
                receipts.delete(task.id);
                rebuildAssemblies.delete(task.id);
            }
            await unlink(rejectionPlanPath);
        }
        const verifiedAssemblies = new Set(), verifyingAssemblies = new Set();
        const verifyAssembly = async (task) => {
            if (verifiedAssemblies.has(task.id))
                return;
            if (verifyingAssemblies.has(task.id))
                throw new PlanningError('RESULT_MODIFIED', '汇集来源存在循环');
            verifyingAssemblies.add(task.id);
            const children = task.partitionTaskIds?.map(childId => run.tasks.find(child => child.id === childId));
            if (!children?.length || children.some(child => !child))
                throw new PlanningError('RESULT_MODIFIED', '汇集登记的子任务丢失');
            for (const child of children) {
                if (child.outputOrigin === 'assembly')
                    await verifyAssembly(child);
                if (!active.results.has(child.id))
                    throw new PlanningError('RESULT_MODIFIED', '汇集产物的子任务收据不完整或已修改');
            }
            const baseTask = task.assemblyBaseTaskId ? run.tasks.find(item => item.id === task.assemblyBaseTaskId) : undefined;
            if (baseTask?.outputOrigin === 'assembly')
                await verifyAssembly(baseTask);
            const base = task.assemblyBaseTaskId ? active.results.get(task.assemblyBaseTaskId) : undefined;
            if (task.assemblyBaseTaskId && !base)
                throw new PlanningError('RESULT_MODIFIED', '汇集依据的原草案收据不完整或已修改');
            const receipt = receipts.get(task.id);
            if (receipt?.assemblyRoleViewVersion !== undefined && receipt.assemblyRoleViewVersion !== 1)
                throw new PlanningError('RESULT_MODIFIED', '汇集收据的角色视图版本无效');
            let roleViewVersion = receipt?.assemblyRoleViewVersion ?? (rebuildAssemblies.has(task.id) ? 1 : 0);
            let reconstructed = batchAssembledQuestions(assemblePartitions(children, active.results, base, roleViewVersion));
            // Before a receipt exists, the registered hash selects the original
            // algorithm. Never adopt orphan bytes or change a historical output hash.
            if (rebuildAssemblies.has(task.id) && task.outputHash && task.outputHash !== hashValue(reconstructed.output)) {
                roleViewVersion = 0;
                reconstructed = batchAssembledQuestions(assemblePartitions(children, active.results, base, roleViewVersion));
            }
            if (rebuildAssemblies.has(task.id)) {
                if (task.outputHash && task.outputHash !== hashValue(reconstructed.output))
                    throw new PlanningError('RESULT_MODIFIED', '汇集登记哈希不符合有效来源');
                await this.assembleWork(active, task, children, roleViewVersion);
            }
            else {
                const receipt = receipts.get(task.id);
                if (receipt.children?.length !== children.length || children.some(child => !receipt.children?.some(record => record.taskId === child.id && record.hash === hashValue(active.results.get(child.id)))))
                    throw new PlanningError('RESULT_MODIFIED', '汇集产物的子任务收据不完整或已修改');
                if (task.assemblyBaseTaskId && (receipt.base?.taskId !== task.assemblyBaseTaskId || receipt.base.hash !== hashValue(base)))
                    throw new PlanningError('RESULT_MODIFIED', '汇集依据的原草案收据不完整或已修改');
                if (hashValue(reconstructed.output) !== hashValue(active.results.get(task.id)) || hashValue(reconstructed.deferred) !== hashValue(task.deferredQuestions ?? []))
                    throw new PlanningError('RESULT_MODIFIED', '汇集产物不符合原始子任务结果');
            }
            verifyingAssemblies.delete(task.id);
            verifiedAssemblies.add(task.id);
        };
        for (const task of run.tasks.filter(task => task.outputOrigin === 'assembly'))
            await verifyAssembly(task);
        // Recover scope metadata for old ordinary revisions without rewriting their
        // valid Provider results or borrowing blocks from the formal blueprint.
        for (const task of run.tasks)
            this.registerRevisionScope(active, task, false);
        const latestCandidate = run.tasks.filter(task => !task.partition && task.status === 'completed' && ['design', 'integration', 'revision'].includes(task.kind) && active.results.has(task.id)).sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || run.tasks.indexOf(a) - run.tasks.indexOf(b)).at(-1);
        const candidate = latestCandidate ? active.results.get(latestCandidate.id) : undefined;
        run.unfinishedBlockIds = this.unfinishedBlocks(active, candidate);
        run.status = 'queued';
        run.error = undefined;
        run.deliveryGeneration = (run.deliveryGeneration ?? 0) + 1;
        if (answeredContinuation) {
            const kind = run.stage === 'clarify' ? 'clarification' : 'revision';
            const continuation = run.tasks.find(task => !task.partition && task.kind === kind && task.status !== 'completed') ?? this.task(active, kind, '依据本轮已明确回答或委托继续当前阶段，保留此前成果，不重复已经处理的问题。');
            continuation.basisHash = run.basis.hash;
            continuation.requiredBlockIds = [...new Set([...(continuation.requiredBlockIds ?? []), ...(run.unfinishedBlockIds ?? [])])];
        }
        const historicalConfig = !run.effectiveConfig;
        if (historicalConfig)
            run.effectiveConfig = this.getConfig();
        else
            run.effectiveConfig = normalizePlanningConfig(run.effectiveConfig);
        this.active.set(id, active);
        try {
            await this.save(active);
            if (historicalConfig)
                await this.event(active, 'configuration-restored', '历史运行未保存完整模型与资料设置，本次继续已记录当前配置；已有任务仍保留原模型。');
        }
        catch (error) {
            this.active.delete(id);
            throw error;
        }
        this.launch(active);
        return structuredClone(run);
    }
    unfinishedBlocks(active, candidate) {
        const fulfilled = new Set(candidate?.groups.flatMap(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds]) ?? []);
        return [...new Set([...(active.run.unfinishedBlockIds ?? []), ...active.run.tasks.filter(task => active.results.has(task.id)).flatMap(task => task.requiredBlockIds ?? [])])].filter(id => !fulfilled.has(id));
    }
    registerRevisionScope(active, task, inheritUnfinished) {
        if (active.run.stage === 'clarify' || task.kind !== 'revision' || task.partition)
            return;
        const previous = active.run.tasks.slice(0, active.run.tasks.indexOf(task)).filter(item => !item.partition && item.status === 'completed' && ['design', 'integration', 'revision'].includes(item.kind) && active.results.has(item.id)).sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || active.run.tasks.indexOf(a) - active.run.tasks.indexOf(b)).at(-1);
        const scope = (output) => output?.groups.flatMap(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds]) ?? [];
        let anchor = previous;
        const visited = new Set();
        while (anchor?.assemblyBaseTaskId && !visited.has(anchor.id)) {
            visited.add(anchor.id);
            const touched = new Set(scope(active.results.get(anchor.id)));
            if (!(anchor.requiredBlockIds ?? []).some(id => !touched.has(id)))
                break;
            const source = active.run.tasks.find(item => item.id === anchor.assemblyBaseTaskId);
            if (!source || source.partition || source.status !== 'completed' || !['design', 'integration', 'revision'].includes(source.kind) || !active.results.has(source.id))
                break;
            anchor = source;
        }
        task.assemblyBaseTaskId ??= anchor?.id;
        const required = [...new Set([...(task.requiredBlockIds ?? []), ...(previous?.requiredBlockIds ?? []), ...scope(previous ? active.results.get(previous.id) : undefined), ...scope(task.assemblyBaseTaskId ? active.results.get(task.assemblyBaseTaskId) : undefined), ...(inheritUnfinished ? active.run.unfinishedBlockIds ?? [] : [])])];
        if (required.length)
            task.requiredBlockIds = required;
    }
    task(active, kind, goal, dependsOn = [], partition) { const config = active.run.effectiveConfig ?? this.config; const t = { id: `task-${randomUUID()}`, kind, goal, dependsOn, status: 'queued', model: ['research', 'validation', 'review'].includes(kind) ? config.reviewModel : config.designModel, attempts: 0, basisHash: active.run.basis.hash, inputRefs: active.run.request?.inputRefs ?? [], ...(partition ? { partition, requiredBlockIds: [...partition.blockIds] } : {}) }; active.run.tasks.push(t); this.registerRevisionScope(active, t, true); return t; }
    async takeSlot(signal) { while (this.runningCalls >= this.config.concurrency) {
        await new Promise(resolve => { const done = () => { signal.removeEventListener('abort', done); const i = this.waiters.indexOf(done); if (i >= 0)
            this.waiters.splice(i, 1); resolve(); }; this.waiters.push(done); signal.addEventListener('abort', done, { once: true }); });
        if (signal.aborted)
            throw new Error('Cancelled');
    } this.runningCalls++; return () => { this.runningCalls--; this.waiters.splice(0).forEach(w => w()); }; }
    async context(active, task) {
        const snapshot = await this.service.get(active.path);
        if (planningBasis(snapshot).hash !== active.run.basis.hash)
            throw new PlanningError('STALE_BASIS', '本轮依据已变化');
        const materials = snapshot.metadata.inputRefs.filter(i => i.status !== 'excluded' && i.status !== 'failed').map(i => { const source = new WorkspaceGuard(active.path).assertContained(active.path, join(active.path, i.storageRef)); const ext = extname(source).toLowerCase(); return { id: i.id, path: source, mimeType: i.kind === 'image' ? `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}` : ext === '.pdf' ? 'application/pdf' : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain', source: i.storageRef }; });
        const base = join(this.directory(active.path, active.run.id), 'tools');
        const derived = join(base, 'materials');
        await mkdir(derived, { recursive: true });
        for (const item of materials.filter(m => !m.mimeType.startsWith('image/'))) {
            const text = await this.engine.readInputContent(active.path, item.id);
            const file = join(derived, `${item.id.replace(/[^a-z0-9_-]/gi, '_')}.txt`);
            await writeFile(file, text);
            item.extractedTextPath = file;
        }
        const tools = { materialRoots: [join(active.path, 'inputs'), derived], materials, experimentRoot: join(base, 'experiments'), evidenceRoot: join(base, 'evidence'), officialHosts: active.run.effectiveConfig?.officialHosts ?? this.config.officialHosts ?? DEFAULT_PLANNING_CONFIG.officialHosts };
        const workerContext = planningWorkerContext(active.run.tasks, active.results, snapshot.planning, task);
        const discovery = active.run.stage === 'clarify' ? undefined : (await this.list(active.path)).find(r => r.stage === 'clarify' && r.status === 'reviewable' && r.clarificationInputHash === planningInputHash(snapshot) && r.clarificationDecisionHash === effectiveDecisionHash(snapshot));
        const unfinishedScopes = planningUnfinishedScopes(active.run.tasks, active.results, active.run.unfinishedBlockIds);
        const suppliedDraft = 'currentDraft' in workerContext ? workerContext.currentDraft : workerContext.workerResults.draft;
        const suppliedDependencies = Object.values(workerContext.workerResults).filter((result) => result !== null);
        const blueprintContext = planningBlueprintContext(snapshot.planning.blueprint, suppliedDraft, unfinishedScopes, suppliedDependencies);
        const text = JSON.stringify({ projectName: snapshot.metadata.name, stage: active.run.stage, basis: active.run.basis, constraints: snapshot.metadata.constraints, approvedDecisions: snapshot.decisions.items.filter(d => ['confirmed', 'locked'].includes(d.status)), ...blueprintContext, decisionTopics: snapshot.planning.topics, rawInputs: snapshot.planning.inputs, answers: planningAnswerContext(snapshot.questions.items), materialIndex: snapshot.metadata.inputRefs, workPartition: task?.partition, deferredQuestions: active.run.deferredQuestions ?? [], unfinishedScopes, discoveryContext: discovery ? { summary: discovery.summary, clarification: discovery.clarification, deferredWork: discovery.deferredWork ?? [] } : undefined, ...workerContext }, null, 2);
        return { snapshot, text, tools };
    }
    async work(active, task) {
        if (task.status === 'completed')
            return active.results.get(task.id);
        const authoring = ['design', 'integration', 'revision'].includes(task.kind) && active.run.stage !== 'clarify';
        if (task.partitionTaskIds?.length || (authoring && isPlanningOutputLimit(task.error ?? '')))
            return this.splitWork(active, task);
        try {
            return await this.invoke(active, task);
        }
        catch (error) {
            if (authoring && !active.abort.signal.aborted && isPlanningOutputLimit(String(error.message ?? error))) {
                await this.event(active, 'output-limit', '单次产物触及服务输出上限，登记更小工作范围；保留完整需求与失败记录。', task.id);
                return this.splitWork(active, task);
            }
            throw error;
        }
    }
    async splitWork(active, parent) {
        if (active.abort.signal.aborted)
            throw new Error('Cancelled');
        if (!parent.partitionTaskIds?.length) {
            const latest = active.run.tasks.filter(task => task.id !== parent.id && !task.partition && task.status === 'completed' && ['design', 'integration', 'revision'].includes(task.kind)).sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || active.run.tasks.indexOf(a) - active.run.tasks.indexOf(b)).at(-1);
            if (!parent.partition && ['integration', 'revision'].includes(parent.kind) && latest)
                parent.assemblyBaseTaskId ??= latest.id;
            const base = parent.assemblyBaseTaskId ? active.results.get(parent.assemblyBaseTaskId) : undefined;
            const required = [...new Set([...(parent.requiredBlockIds ?? []), ...(!parent.partition ? base?.groups.flatMap(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds]) ?? [] : [])])];
            const plan = active.run.tasks.find(task => task.id === parent.partitionPlanTaskId) ?? this.task(active, 'decomposition', `任务拆分：${parent.goal}\n父范围：${JSON.stringify(parent.partition ?? null)}`, parent.dependsOn);
            parent.partitionPlanTaskId = plan.id;
            await this.save(active);
            const scopes = validatePartitions(await this.work(active, plan), parent.partition, required);
            await this.context(active, parent);
            const children = scopes.map(scope => this.task(active, parent.kind, `${parent.goal}\n本登记范围：${scope.goal}`, parent.dependsOn, scope));
            for (const child of children)
                child.dependsOn = [...new Set([...parent.dependsOn, ...child.partition.dependsOn.map(id => children.find(task => task.partition.id === id).id)])];
            parent.partitionTaskIds = children.map(task => task.id);
            await this.event(active, 'task-partitioned', `已登记 ${children.length} 个工作范围，全部完成后汇集并审阅。`, parent.id);
        }
        const children = parent.partitionTaskIds.map(id => active.run.tasks.find(task => task.id === id));
        if (children.some(task => !task))
            throw new PlanningError('RESULT_MODIFIED', '登记的拆分任务丢失');
        parent.status = 'running';
        parent.error = undefined;
        await this.save(active);
        const pending = new Set(children.filter(task => task.status !== 'completed'));
        while (pending.size) {
            const ready = [...pending].filter(task => task.dependsOn.every(id => active.results.has(id)));
            if (!ready.length)
                throw new PlanningError('INVALID_STRUCTURED_RESULT', '拆分工作依赖无法推进');
            const outcomes = await Promise.allSettled(ready.map(task => this.work(active, task)));
            ready.forEach(task => { if (task.status === 'completed')
                pending.delete(task); });
            const failed = outcomes.find(outcome => outcome.status === 'rejected');
            if (failed?.status === 'rejected')
                throw failed.reason;
        }
        return this.assembleWork(active, parent, children);
    }
    async assembleWork(active, parent, children, roleViewVersion = 1) {
        const base = parent.assemblyBaseTaskId ? active.results.get(parent.assemblyBaseTaskId) : undefined;
        const batched = batchAssembledQuestions(assemblePartitions(children, active.results, base, roleViewVersion)), output = batched.output;
        assertTaskResult(output);
        if (parent.partition)
            validatePartitionResult(output, parent.partition, parent.requiredBlockIds);
        await this.context(active, parent); // Check the frozen basis again before publishing the derived artifact.
        const directory = join(this.directory(active.path, active.run.id), 'tasks', parent.id);
        await mkdir(directory, { recursive: true });
        parent.partitionTaskIds = children.map(task => task.id);
        parent.outputOrigin = 'assembly';
        parent.outputHash = hashValue(output);
        parent.outputRef = `tasks/${parent.id}/result.json`;
        parent.deferredQuestions = batched.deferred;
        const queue = new Map((active.run.deferredQuestions ?? []).map(question => [question.decisionKey, question]));
        batched.deferred.forEach(question => queue.set(question.decisionKey, question));
        active.run.deferredQuestions = [...queue.values()];
        // Persist provenance registration before artifact writes so every crash point
        // can either rebuild the assembly or verify its source receipts.
        await this.save(active);
        await this.storage.writeJson(join(directory, 'result.json'), output);
        parent.completedAt = new Date().toISOString();
        await this.storage.writeJson(join(directory, 'result-receipt.json'), { taskId: parent.id, hash: parent.outputHash, basisHash: active.run.basis.hash, completedAt: parent.completedAt, origin: 'assembly', ...(roleViewVersion === 1 ? { assemblyRoleViewVersion: 1 } : {}), children: children.map(task => ({ taskId: task.id, hash: hashValue(active.results.get(task.id)) })), deferredQuestions: batched.deferred, ...(base ? { base: { taskId: parent.assemblyBaseTaskId, hash: hashValue(base) } } : {}) });
        parent.status = 'completed';
        parent.error = undefined;
        active.results.set(parent.id, output);
        await this.event(active, 'task-assembled', '所有范围已完整汇集；这是应用汇集产物，原失败调用仍保留。', parent.id);
        return output;
    }
    async invoke(active, task) {
        if (active.abort.signal.aborted)
            throw new Error('Cancelled');
        if (task.dependsOn.some(id => !active.results.has(id)))
            throw new Error('Task dependency missing');
        if (task.partition)
            task.requiredBlockIds = [...task.partition.blockIds];
        const release = await this.takeSlot(active.abort.signal);
        try {
            const context = await this.context(active, task);
            const directory = join(this.directory(active.path, active.run.id), 'tasks', task.id);
            await mkdir(directory, { recursive: true });
            const schema = JSON.stringify(task.kind === 'decomposition' ? partitionSchema() : planningTaskSchema(task.kind));
            const legacySchema = join(directory, 'result.schema.json');
            if (!(await this.storage.exists(legacySchema)))
                await writeFile(legacySchema, schema);
            await preparePlanningWorkspace(context.tools, directory);
            task.status = 'running';
            task.startedAt = new Date().toISOString();
            await this.event(active, 'task-started', task.goal, task.id);
            for (let attempt = 0;; attempt++) {
                if (active.abort.signal.aborted)
                    throw new Error('Cancelled');
                task.attempts++;
                await this.save(active);
                const reasoningEffort = planningReasoningEffort(task.model);
                const schemaPath = join(directory, `call-${task.attempts}.schema.json`);
                await writeFile(schemaPath, schema);
                const scopePrompt = task.partition ? `\n本次只输出 workPartition.blockIds 内的块（含删除），不能输出其他范围的正文。本登记范围内全部 blockIds（包括正式蓝图已有 ID）必须在 groups.blocks 返回完整候选块，或在 groups.removeBlockIds 明确提出删除；正式已有 ID 不能豁免本范围职责。必需保留/实现的块：${JSON.stringify(task.requiredBlockIds ?? [])}；其中已修好的当前草案块原样保留，只有实际阻塞涉及的内容才再修改。引用外部块保持其稳定 ID。每个分组 id 用 ${task.id} 为前缀，决定键也必须避免与其他范围重复。仅范围之外已经批准且无变化的块不输出；不得为压缩输出省略本范围的具体任务与验收。有真实未决取舍时返回 questions 暂停相关职责，无问题的空 groups 不能视为完成。跨范围冲突写 blockers，留给全局独立评审。` : task.kind === 'revision' && active.run.stage !== 'clarify' ? `\n本任务目标列出的是待解决的问题，不是完整输出范围；不能只返回 goal 中列出的缺失 ID。
本次完整候选范围 requiredBlockIds：${JSON.stringify(task.requiredBlockIds ?? [])}
必须保留本 Run 已经修好的候选块及明确删除动作；按 currentDraft 与 unfinishedScopes 中最近真实候选和来源补齐范围。在 groups.blocks 返回全部必需 ID 的完整候选块，或在 groups.removeBlockIds 明确提出删除，交付完整、自洽的待批准变更包。正式蓝图已有同 ID 也不能豁免本 Run 候选范围职责。
此范围只继承本 Run 已登记的候选职责；未改变且与本次候选无关的正式块仍不复制。真实未决取舍可返回 questions 等待用户，不能以省略本 Run 必需范围代替完整交付。` : '';
                if (active.abort.signal.aborted)
                    throw new Error('Cancelled');
                const result = await this.provider.complete({ requestId: `${task.id}-${task.attempts}`, task: 'planning-task', prompt: (task.kind === 'decomposition' ? `${partitionPrompt}\n本任务目标：${task.goal}` : planningPrompt(active.run.stage, task.kind, task.goal)) + scopePrompt, contextText: context.text, schemaPath, cwd: directory, logPath: join(directory, `call-${task.attempts}.ndjson`), model: task.model, reasoningEffort, abortSignal: active.abort.signal });
                await this.storage.writeJson(join(directory, `call-${task.attempts}.json`), { status: result.status, durationMs: result.durationMs, usage: result.usage, exitCode: result.exitCode, error: result.stderr, model: task.model, reasoningEffort: reasoningEffort ?? 'model-native-thinking', schemaPath, schemaHash: hashValue(JSON.parse(schema)) });
                if (active.abort.signal.aborted || result.status === 'cancelled')
                    throw new Error('Cancelled');
                if (result.structuredSuccess && result.structuredOutput) {
                    assertPlanningTaskRole(result.structuredOutput, task.kind);
                    const output = result.structuredOutput;
                    if (task.kind === 'decomposition')
                        validatePartitions(output);
                    if (task.partition)
                        validatePartitionResult(output, task.partition, task.requiredBlockIds);
                    const touched = new Set(output.groups.flatMap(group => [...group.blocks.map(block => block.id), ...group.removeBlockIds]));
                    const missing = (task.requiredBlockIds ?? []).filter(id => !touched.has(id));
                    const ordinaryRevision = task.kind === 'revision' && !task.partition && active.run.stage !== 'clarify';
                    if (missing.length && !output.questions.length && !ordinaryRevision)
                        throw new PlanningError('INVALID_STRUCTURED_RESULT', '回答后仍遗漏登记的必需块');
                    const unfinished = new Set(active.run.unfinishedBlockIds ?? []);
                    missing.forEach(id => unfinished.add(id));
                    touched.forEach(id => unfinished.delete(id));
                    active.run.unfinishedBlockIds = [...unfinished];
                    await verifyTaskEvidence(output, context.snapshot, context.tools);
                    output.groups = output.groups.map(g => ({ ...g, status: 'pending' }));
                    task.completedAt = new Date().toISOString();
                    task.error = undefined;
                    task.outputOrigin = 'provider';
                    task.outputRef = `tasks/${task.id}/result.json`;
                    task.outputHash = hashValue(output);
                    await this.storage.writeJson(join(directory, 'result.json'), output);
                    await this.storage.writeJson(join(directory, 'result-receipt.json'), { taskId: task.id, hash: task.outputHash, basisHash: active.run.basis.hash, completedAt: task.completedAt, origin: 'provider' });
                    task.status = 'completed';
                    active.results.set(task.id, output);
                    await this.event(active, 'task-completed', output.summary, task.id);
                    return output;
                }
                const error = result.stderr || '结构化输出缺失';
                const transient = /429|503|502|temporar|rate.?limit|ECONNRESET|unavailable|connection.*(closed|reset)/i.test(error);
                if (!transient || attempt >= this.retryDelays.length) {
                    task.status = 'paused';
                    task.error = error;
                    throw new Error(error);
                }
                await this.event(active, 'retry', `服务暂时失败，${this.retryDelays[attempt] / 1000} 秒后重试。`, task.id);
                await new Promise((resolve, reject) => { const abort = () => { clearTimeout(timer); reject(new Error('Cancelled')); }; const timer = setTimeout(() => { active.abort.signal.removeEventListener('abort', abort); resolve(); }, this.retryDelays[attempt]); active.abort.signal.addEventListener('abort', abort, { once: true }); });
            }
        }
        finally {
            release();
        }
    }
    async execute(active) {
        const reminder = setInterval(() => { const elapsed = Date.now() - Date.parse(active.run.createdAt); if (elapsed >= 60000)
            void this.event(active, 'waiting', `AI 仍在工作，已等待 ${Math.floor(elapsed / 60000)} 分钟，可随时取消。`).catch(error => { active.abort.abort(); active.run.error = String(error); }); }, 60000);
        reminder.unref();
        try {
            active.run.status = 'running';
            await this.event(active, 'run-started', '开始处理本轮规划。');
            if (!(await this.storage.exists(join(this.directory(active.path, active.run.id), 'basis.json'))))
                await this.storage.writeJson(join(this.directory(active.path, active.run.id), 'basis.json'), await this.service.get(active.path));
            let draft;
            const snapshot = await this.service.get(active.path);
            // Topic history does not consume a distinct question with a legal reopen
            // reason. Only this run's exact installed question can be handled/invalid.
            const deferred = (active.run.deferredQuestions ?? []).filter(question => !snapshot.questions.items.some(item => item.batchId?.startsWith(`${active.run.id}-delivery-`) && item.id === `${item.batchId}-${question.id}` && item.decisionKey === question.decisionKey && ['answered', 'dismissed', 'superseded'].includes(item.status)));
            active.run.deferredQuestions = deferred;
            if (deferred.length) {
                draft = { summary: '继续澄清此前已登记的未决事项；每批最多三题。', questions: deferred.slice(0, 3), groups: [], evidence: [], blockers: [], followUp: [], clarification: null };
            }
            else if (active.run.stage === 'clarify') {
                const task = [...active.run.tasks].reverse().find(t => t.kind === 'clarification') ?? this.task(active, 'clarification', '理解全部材料与有效决定，只澄清重大未决需求。');
                draft = await this.work(active, task);
            }
            else {
                const existingDesign = active.run.tasks.filter(t => !t.partition && (t.kind === 'design' || t.kind === 'research'));
                const tasks = existingDesign.length ? existingDesign : [this.task(active, 'design', '生成本阶段完整设计，保持稳定 ID 和关联；普通细节由你拟定。'), this.task(active, 'research', active.run.stage === 'technical' ? '查证设计依赖、平台能力与官方接口；未验证事项提供前置验证任务。' : '独立分析材料中的约束、异常使用场景与可行性风险；只返回证据和建议。')];
                const outcomes = await Promise.allSettled(tasks.map(task => this.work(active, task)));
                const failed = outcomes.find(o => o.status === 'rejected');
                if (failed?.status === 'rejected')
                    throw failed.reason;
                const integration = active.run.tasks.find(t => !t.partition && t.kind === 'integration') ?? this.task(active, 'integration', '整合当前工作者产物，交付本阶段完整、自洽的待批准变更包。', tasks.map(t => t.id));
                // Once authoring was partitioned, combine validated fragments and research
                // locally. A final model rewrite would recreate the same oversized output.
                draft = integration.status !== 'completed' && !integration.partitionTaskIds?.length && tasks.some(task => task.outputOrigin === 'assembly') ? await this.assembleWork(active, integration, tasks) : await this.work(active, integration);
            }
            if (!deferred.length) {
                const latestCompletedDraft = active.run.tasks.filter(t => !t.partition && ['clarification', 'integration', 'revision'].includes(t.kind) && t.status === 'completed').sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || active.run.tasks.indexOf(a) - active.run.tasks.indexOf(b)).at(-1);
                if (latestCompletedDraft)
                    draft = active.results.get(latestCompletedDraft.id);
                const pendingRevision = active.run.tasks.find(t => !t.partition && t.kind === 'revision' && t.status !== 'completed');
                if (pendingRevision)
                    draft = await this.work(active, pendingRevision);
            }
            let reviewing = true;
            while (reviewing) {
                if (active.abort.signal.aborted)
                    throw new Error('Cancelled');
                const { snapshot } = await this.context(active);
                let issues = validateQuestionSet(draft.questions, snapshot.planning);
                if (active.run.stage === 'clarify') {
                    if (draft.groups.length)
                        issues.push('澄清阶段不能提前生成完整设计');
                    if (!draft.questions.length && !draft.followUp.length && !clarificationComplete(draft.clarification))
                        issues.push('澄清尚未完整：目标用户、问题、结果、范围和约束必须明确或明确委托；必要缺口用选择题，不能将不完整摘要标为完成。');
                }
                else if (!draft.questions.length) {
                    issues.push(...this.service.draftIssues(snapshot, draft));
                    const removals = new Set(draft.groups.flatMap(g => g.removeBlockIds));
                    const replacements = new Set(draft.groups.flatMap(g => g.blocks.map(b => b.id)));
                    const proposed = [...snapshot.planning.blueprint.blocks.filter(b => !removals.has(b.id) && !replacements.has(b.id)), ...draft.groups.flatMap(g => g.blocks)];
                    active.run.unfinishedBlockIds = this.unfinishedBlocks(active, draft);
                    for (const id of active.run.unfinishedBlockIds)
                        issues.push(`登记范围尚未完成：${id}`);
                    issues.push(...blueprintCoverage(proposed, active.run.stage === 'feedback' ? undefined : active.run.stage));
                    if (!issues.length) {
                        const reviewTask = active.run.tasks.find(t => t.kind === 'review' && t.status !== 'completed') ?? this.task(active, 'review', '独立检查最新草案与证据，返回具体阻塞；只有全部满足时 blockers=[]。');
                        const review = await this.work(active, reviewTask);
                        issues.push(...review.blockers);
                    }
                }
                issues.push(...draft.blockers);
                const signature = semanticProgressSignature(draft, issues);
                active.run.progressSignatures.push(signature);
                await this.save(active);
                if ((issues.length || draft.followUp.length) && active.run.progressSignatures.slice(-3).length === 3 && active.run.progressSignatures.slice(-3).every(s => s === signature)) {
                    active.run.status = 'paused';
                    active.run.error = `连续三次无进展：${issues.join('；') || '研究任务重复，草案没有变化'}`;
                    await this.event(active, 'stalled', active.run.error);
                    return;
                }
                if (issues.length) {
                    if (active.run.progressSignatures.slice(-3).length === 3 && active.run.progressSignatures.slice(-3).every(s => s === signature)) {
                        active.run.status = 'paused';
                        active.run.error = `连续三次无进展：${issues.join('；')}`;
                        await this.event(active, 'stalled', active.run.error);
                        return;
                    }
                    const repair = active.run.tasks.find(t => !t.partition && t.kind === 'revision' && t.status !== 'completed') ?? this.task(active, 'revision', `修订最新草案，解决这些确定性或评审问题：${issues.join('；')}。保留完整产物和真实证据。`);
                    draft = await this.work(active, repair);
                    continue;
                }
                const followUps = [...new Map(draft.followUp.map(f => [JSON.stringify([f.kind, f.goal]), f])).values()];
                // A user's choice may determine these follow-ups. Deliver valid questions
                // first; answer continuation reevaluates work against the new basis.
                const clarificationReady = active.run.stage === 'clarify' && clarificationComplete(draft.clarification);
                if (followUps.length && !draft.questions.length && !clarificationReady) {
                    const draftTask = active.run.tasks.filter(t => !t.partition && ['clarification', 'design', 'integration', 'revision'].includes(t.kind) && t.status === 'completed').sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || active.run.tasks.indexOf(a) - active.run.tasks.indexOf(b)).at(-1);
                    const outcomes = await Promise.allSettled(followUps.map(f => this.work(active, active.run.tasks.find(t => t.kind === f.kind && t.goal === f.goal && t.basisHash === active.run.basis.hash) ?? this.task(active, f.kind, f.goal, draftTask ? [draftTask.id] : []))));
                    const failed = outcomes.find(o => o.status === 'rejected');
                    if (failed?.status === 'rejected')
                        throw failed.reason;
                    const integrate = this.task(active, 'revision', '整合新增研究与验证，解决其影响；不要重复已经完成的 followUp。');
                    draft = await this.work(active, integrate);
                    continue;
                }
                active.run.summary = draft.summary;
                active.run.clarification = draft.clarification;
                if (clarificationReady && !draft.questions.length) {
                    active.run.deferredWork = followUps;
                    active.run.clarificationInputHash = planningInputHash(snapshot);
                    active.run.clarificationDecisionHash = effectiveDecisionHash(snapshot);
                }
                if (active.abort.signal.aborted)
                    throw new Error('Cancelled');
                const deliveryKey = `${active.run.id}-delivery-${active.run.deliveryGeneration ?? 0}`;
                if (draft.questions.length) {
                    const s = await this.service.installQuestions(active.path, active.run.basis, draft.questions, deliveryKey);
                    if (active.abort.signal.aborted)
                        throw new Error('Cancelled');
                    active.run.pendingQuestions = s.questions.items.filter(q => q.batchId === deliveryKey);
                    active.run.status = 'paused';
                    active.run.error = '需要你回答或委托当前选择题。';
                }
                else if (active.run.stage !== 'clarify') {
                    const proposal = { id: `change-${deliveryKey.slice(4)}`, runId: active.run.id, stage: active.run.stage, basis: active.run.basis, summary: draft.summary, groups: draft.groups, evidence: draft.evidence, status: 'pending', createdAt: new Date().toISOString(), approvals: [] };
                    await this.service.propose(active.path, proposal);
                    if (active.abort.signal.aborted)
                        throw new Error('Cancelled');
                    active.run.changeSetId = proposal.id;
                    active.run.status = 'reviewable';
                }
                else
                    active.run.status = 'reviewable';
                reviewing = false;
                await this.event(active, 'ready', active.run.status === 'paused' ? '等待你的选择。' : '本轮产物已可审阅。');
            }
        }
        catch (error) {
            if (active.abort.signal.aborted)
                active.run.status = 'cancelled';
            else if (error.code === 'STALE_BASIS')
                active.run.status = 'stale';
            else
                active.run.status = 'paused';
            active.run.error = String(error.message ?? error);
            active.run.tasks.forEach(t => { if (t.status === 'running')
                t.status = active.run.status === 'cancelled' ? 'cancelled' : 'paused'; });
            await this.event(active, 'run-stopped', active.run.error);
        }
        finally {
            clearInterval(reminder);
            if (active.abort.signal.aborted)
                active.run.status = 'cancelled';
            if (active.run.status === 'cancelled' || active.run.status === 'stale')
                await this.service.invalidateRun(active.path, active.run.id).catch(error => { active.run.error = String(error); });
            try {
                await this.save(active);
            }
            finally {
                if (this.active.get(active.run.id) === active)
                    this.active.delete(active.run.id);
            }
        }
    }
}
//# sourceMappingURL=PlanningRuntime.js.map