import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { DEFAULT_PLANNING_CONFIG } from '@project-architect/contracts';
import { PlanningService, FileStorage, WorkspaceGuard, planningBasis, planningInputHash, hashValue, effectiveDecisionHash, assertTaskResult, validateQuestionSet, blueprintCoverage, PlanningError } from '@project-architect/core';
import { preparePlanningWorkspace, planningReasoningEffort } from '@project-architect/agent';
import { PLANNING_TASK_SCHEMA } from './PlanningSchema.js';
import { planningPrompt } from './PlanningPrompt.js';
import { semanticProgressSignature } from './PlanningProgress.js';
import { verifyTaskEvidence } from './PlanningEvidence.js';
import { normalizePlanningConfig } from './PlanningConfig.js';
import { planningWorkerContext } from './PlanningContext.js';
import { planningAnswerContext } from './PlanningAnswerContext.js';
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
        for (const task of run.tasks) {
            const directory = join(this.directory(path, id), 'tasks', task.id);
            const outputRef = `tasks/${task.id}/result.json`;
            if (await this.storage.exists(join(directory, 'result.json'))) {
                const result = await this.storage.readJson(join(directory, 'result.json'));
                assertTaskResult(result);
                const receipt = await this.storage.readJson(join(directory, 'result-receipt.json')).catch(() => undefined);
                if (!receipt || receipt.taskId !== task.id || hashValue(result) !== receipt.hash || (task.outputHash && task.outputHash !== receipt.hash))
                    throw new PlanningError('RESULT_MODIFIED', '保存的任务产物缺少有效哈希或已被修改，请保留诊断并重新运行');
                task.status = 'completed';
                task.outputRef = outputRef;
                task.outputHash = receipt.hash;
                task.basisHash ??= receipt.basisHash;
                active.results.set(task.id, result);
            }
        }
        run.status = 'queued';
        run.error = undefined;
        run.deliveryGeneration = (run.deliveryGeneration ?? 0) + 1;
        if (answeredContinuation)
            this.task(active, run.stage === 'clarify' ? 'clarification' : 'revision', '依据本轮已明确回答或委托继续当前阶段，保留此前成果，不重复已经处理的问题。');
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
    task(active, kind, goal, dependsOn = []) { const config = active.run.effectiveConfig ?? this.config; const t = { id: `task-${randomUUID()}`, kind, goal, dependsOn, status: 'queued', model: ['research', 'validation', 'review'].includes(kind) ? config.reviewModel : config.designModel, attempts: 0, basisHash: active.run.basis.hash, inputRefs: active.run.request?.inputRefs ?? [] }; active.run.tasks.push(t); return t; }
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
        const text = JSON.stringify({ projectName: snapshot.metadata.name, stage: active.run.stage, basis: active.run.basis, constraints: snapshot.metadata.constraints, approvedDecisions: snapshot.decisions.items.filter(d => ['confirmed', 'locked'].includes(d.status)), blueprint: snapshot.planning.blueprint, decisionTopics: snapshot.planning.topics, rawInputs: snapshot.planning.inputs, answers: planningAnswerContext(snapshot.questions.items), materialIndex: snapshot.metadata.inputRefs, discoveryContext: discovery ? { summary: discovery.summary, clarification: discovery.clarification, deferredWork: discovery.deferredWork ?? [] } : undefined, ...workerContext }, null, 2);
        return { snapshot, text, tools };
    }
    async work(active, task) {
        if (task.status === 'completed')
            return active.results.get(task.id);
        if (active.abort.signal.aborted)
            throw new Error('Cancelled');
        if (task.dependsOn.some(id => !active.results.has(id)))
            throw new Error('Task dependency missing');
        const release = await this.takeSlot(active.abort.signal);
        try {
            const context = await this.context(active, task);
            const directory = join(this.directory(active.path, active.run.id), 'tasks', task.id);
            await mkdir(directory, { recursive: true });
            const schemaPath = join(directory, 'result.schema.json');
            await writeFile(schemaPath, JSON.stringify(PLANNING_TASK_SCHEMA));
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
                const result = await this.provider.complete({ requestId: `${task.id}-${task.attempts}`, task: 'planning-task', prompt: planningPrompt(active.run.stage, task.kind, task.goal), contextText: context.text, schemaPath, cwd: directory, logPath: join(directory, `call-${task.attempts}.ndjson`), model: task.model, reasoningEffort, abortSignal: active.abort.signal });
                await this.storage.writeJson(join(directory, `call-${task.attempts}.json`), { status: result.status, durationMs: result.durationMs, usage: result.usage, exitCode: result.exitCode, error: result.stderr, model: task.model, reasoningEffort: reasoningEffort ?? 'model-native-thinking' });
                if (active.abort.signal.aborted || result.status === 'cancelled')
                    throw new Error('Cancelled');
                if (result.structuredSuccess && result.structuredOutput) {
                    assertTaskResult(result.structuredOutput);
                    const output = result.structuredOutput;
                    await verifyTaskEvidence(output, context.snapshot, context.tools);
                    output.groups = output.groups.map(g => ({ ...g, status: 'pending' }));
                    task.completedAt = new Date().toISOString();
                    task.error = undefined;
                    task.outputRef = `tasks/${task.id}/result.json`;
                    task.outputHash = hashValue(output);
                    await this.storage.writeJson(join(directory, 'result.json'), output);
                    await this.storage.writeJson(join(directory, 'result-receipt.json'), { taskId: task.id, hash: task.outputHash, basisHash: active.run.basis.hash });
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
            if (active.run.stage === 'clarify') {
                const task = [...active.run.tasks].reverse().find(t => t.kind === 'clarification') ?? this.task(active, 'clarification', '理解全部材料与有效决定，只澄清重大未决需求。');
                draft = await this.work(active, task);
            }
            else {
                const existingDesign = active.run.tasks.filter(t => t.kind === 'design' || t.kind === 'research');
                const tasks = existingDesign.length ? existingDesign : [this.task(active, 'design', '生成本阶段完整设计，保持稳定 ID 和关联；普通细节由你拟定。'), this.task(active, 'research', active.run.stage === 'technical' ? '查证设计依赖、平台能力与官方接口；未验证事项提供前置验证任务。' : '独立分析材料中的约束、异常使用场景与可行性风险；只返回证据和建议。')];
                const outcomes = await Promise.allSettled(tasks.map(task => this.work(active, task)));
                const failed = outcomes.find(o => o.status === 'rejected');
                if (failed?.status === 'rejected')
                    throw failed.reason;
                const integration = active.run.tasks.find(t => t.kind === 'integration') ?? this.task(active, 'integration', '整合当前工作者产物，交付本阶段完整、自洽的待批准变更包。', tasks.map(t => t.id));
                draft = await this.work(active, integration);
            }
            const latestCompletedDraft = [...active.run.tasks].reverse().find(t => ['clarification', 'integration', 'revision'].includes(t.kind) && t.status === 'completed');
            if (latestCompletedDraft)
                draft = active.results.get(latestCompletedDraft.id);
            const pendingRevision = active.run.tasks.find(t => t.kind === 'revision' && t.status !== 'completed');
            if (pendingRevision)
                draft = await this.work(active, pendingRevision);
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
                    const repair = active.run.tasks.find(t => t.kind === 'revision' && t.status !== 'completed') ?? this.task(active, 'revision', `修订最新草案，解决这些确定性或评审问题：${issues.join('；')}。保留完整产物和真实证据。`);
                    draft = await this.work(active, repair);
                    continue;
                }
                const followUps = [...new Map(draft.followUp.map(f => [JSON.stringify([f.kind, f.goal]), f])).values()];
                // A user's choice may determine these follow-ups. Deliver valid questions
                // first; answer continuation reevaluates work against the new basis.
                const clarificationReady = active.run.stage === 'clarify' && clarificationComplete(draft.clarification);
                if (followUps.length && !draft.questions.length && !clarificationReady) {
                    const outcomes = await Promise.allSettled(followUps.map(f => this.work(active, active.run.tasks.find(t => t.kind === f.kind && t.goal === f.goal && t.basisHash === active.run.basis.hash) ?? this.task(active, f.kind, f.goal))));
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