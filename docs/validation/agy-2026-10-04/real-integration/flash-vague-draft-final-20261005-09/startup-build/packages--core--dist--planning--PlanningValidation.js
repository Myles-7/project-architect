import { PLANNING_TASK_SCHEMA } from '@project-architect/contracts';
import { Ajv } from 'ajv';
import { planningDependencyCycles } from './PlanningDependencyGraph.js';
const validateResult = new Ajv({ allErrors: true, strict: false }).compile(PLANNING_TASK_SCHEMA);
export function validateQuestionSet(questions, state) {
    const issues = [];
    if (questions.length > 3)
        issues.push('同批问题超过三题');
    const keys = new Set();
    const canonical = (key) => state.topics.find(t => t.key === key || t.aliases.includes(key))?.key ?? key;
    const allKeys = new Set(questions.map(q => canonical(q.decisionKey ?? '')));
    for (const q of questions) {
        if (!q.decisionKey || keys.has(canonical(q.decisionKey)))
            issues.push('决策键缺失或重复');
        keys.add(canonical(q.decisionKey ?? ''));
        if (!q.question?.trim() || !(q.whyNow || q.reason)?.trim() || !q.recommendationReason?.trim())
            issues.push(`问题 ${q.id} 缺少原因或推荐理由`);
        const optionKeys = new Set(q.options?.map(o => o.key));
        if (!q.options || q.options.length < 2 || q.options.length > 4 || optionKeys.size !== q.options.length)
            issues.push(`问题 ${q.id} 选项数量或键无效`);
        if (!optionKeys.has(q.recommendedOptionKey ?? ''))
            issues.push(`问题 ${q.id} 推荐选项不存在`);
        for (const option of q.options ?? []) {
            if (![option.label, option.approach, option.gain, option.sacrifice, option.impact, option.reversibility].every(v => typeof v === 'string' && v.trim()))
                issues.push(`问题 ${q.id} 选项 ${option.key} 缺少具体取舍`);
        }
        const topic = state.topics.find(t => t.key === q.decisionKey || t.aliases.includes(q.decisionKey ?? ''));
        if ((topic?.effectiveDecisionId || topic?.lastAnsweredQuestionId) && !q.reopenReason?.trim())
            issues.push(`主题 ${q.decisionKey} 已回答或委托，缺少重问原因`);
        const seen = new Set();
        const walk = (key) => {
            if (seen.has(key))
                return;
            seen.add(key);
            if (allKeys.has(canonical(key)))
                issues.push(`问题 ${q.id} 与同批主题 ${key} 存在依赖`);
            const dependency = state.blueprint.blocks.find(b => b.id === key);
            dependency?.dependsOn.forEach(walk);
            const depQuestion = questions.find(item => item.decisionKey === key);
            depQuestion?.dependsOn?.forEach(walk);
        };
        q.dependsOn?.forEach(walk);
        for (const dependency of q.dependsOn ?? []) {
            if (!state.topics.some(t => (t.key === dependency || t.aliases.includes(dependency)) && t.effectiveDecisionId) && !state.blueprint.blocks.some(b => b.id === dependency))
                issues.push(`问题 ${q.id} 依赖未批准主题 ${dependency}`);
        }
    }
    return [...new Set(issues)];
}
const requirements = {
    product: ['target', 'problem', 'outcomes', 'scope', 'non_goals', 'feature', 'flow', 'page'],
    technical: ['technology', 'module', 'data_model', 'interface', 'error', 'deployment'],
    delivery: ['task', 'acceptance'],
};
const requiredText = (value) => typeof value === 'string' && Boolean(value.trim());
const requiredTextList = (value) => Array.isArray(value) && value.length > 0 && value.every(requiredText);
export function blueprintCoverage(blocks, stage) {
    const issues = [];
    const stages = stage ? [stage] : Object.keys(requirements);
    for (const current of stages)
        for (const kind of requirements[current]) {
            if (!blocks.some(b => b.stage === current && b.kind === kind && b.content.trim().length >= 15))
                issues.push(`${current} 缺少具体的 ${kind}`);
        }
    const ids = new Set(blocks.map(b => b.id));
    if (ids.size !== blocks.length)
        issues.push('蓝图块 ID 重复');
    for (const id of planningDependencyCycles(blocks))
        issues.push(`任务或蓝图存在循环依赖：${id}`);
    for (const block of blocks) {
        for (const dep of block.dependsOn)
            if (!ids.has(dep))
                issues.push(`${block.id} 依赖不存在：${dep}`);
        if (block.kind === 'task' || block.kind === 'validation') {
            const task = block.task;
            if (!task || ![task.goal, task.scope, task.exclusions, task.normalBehavior, task.failureBehavior].every(requiredText) || ![task.modules, task.verification, task.completionCriteria, block.requirementIds].every(requiredTextList))
                issues.push(`任务 ${block.id} 缺少范围、行为、关联或验收`);
            if (task?.completionCriteria.some(c => /^(满足|符合|遵守).*(决定|需求|要求)[。.]?$/.test(c.trim())))
                issues.push(`任务 ${block.id} 验收过于空泛`);
            if (block.kind === 'validation' && (!requiredText(task?.environment) || !requiredText(task?.onFailure) || ![task?.steps, task?.passCriteria, task?.evidenceRequired].every(requiredTextList)))
                issues.push(`验证任务 ${block.id} 缺少环境、步骤、证据或失败处理`);
        }
    }
    if (stages.includes('product') || stages.includes('delivery')) {
        for (const feature of blocks.filter(b => b.kind === 'feature')) {
            if (!blocks.some(b => b.kind === 'flow' && b.requirementIds.includes(feature.id)))
                issues.push(`功能 ${feature.id} 缺少流程`);
            if (stages.includes('delivery')) {
                if (!blocks.some(b => b.kind === 'task' && b.requirementIds.includes(feature.id)))
                    issues.push(`功能 ${feature.id} 缺少开发任务`);
                if (!blocks.some(b => b.kind === 'acceptance' && b.requirementIds.includes(feature.id)))
                    issues.push(`功能 ${feature.id} 缺少验收场景`);
            }
        }
    }
    for (const b of blocks)
        for (const id of b.requirementIds)
            if (!ids.has(id))
                issues.push(`${b.id} 关联了不存在的需求 ${id}`);
    return [...new Set(issues)];
}
export function assertTaskResult(value) {
    if (!validateResult(value))
        throw new Error(`INVALID_STRUCTURED_RESULT: ${validateResult.errors?.map(e => `${e.instancePath} ${e.message}`).join('；')}`);
    if (!value || typeof value !== 'object')
        throw new Error('INVALID_STRUCTURED_RESULT: 结果不是对象');
    const v = value;
    if (typeof v.summary !== 'string' || !['groups', 'questions', 'evidence', 'blockers', 'followUp'].every(k => Array.isArray(v[k])))
        throw new Error('INVALID_STRUCTURED_RESULT: 缺少任务结果字段');
    for (const group of v.groups) {
        if (![group.id, group.title, group.impact].every(x => typeof x === 'string' && x.trim()) || !['blocks', 'decisions', 'dependsOn', 'removeBlockIds'].every(k => Array.isArray(group[k])))
            throw new Error('INVALID_STRUCTURED_RESULT: 变更组无效');
        for (const b of group.blocks)
            if (![b.id, b.title, b.content].every(x => typeof x === 'string' && x.trim()) || !['product', 'technical', 'delivery'].includes(b.stage) || !['target', 'problem', 'outcomes', 'scope', 'non_goals', 'feature', 'flow', 'page', 'technology', 'module', 'data_model', 'interface', 'error', 'deployment', 'task', 'acceptance', 'validation'].includes(b.kind) || ![b.dependsOn, b.requirementIds, b.evidenceIds].every(Array.isArray))
                throw new Error('INVALID_STRUCTURED_RESULT: 蓝图片段无效');
        for (const d of group.decisions)
            if (![d.decisionKey, d.area, d.statement, d.rationale].every(x => typeof x === 'string' && x.trim()) || !Array.isArray(d.evidenceIds))
                throw new Error('INVALID_STRUCTURED_RESULT: 决定建议无效');
    }
    for (const e of v.evidence)
        if (![e.id, e.content, e.source, e.obtainedAt, e.applicability].every(x => typeof x === 'string' && x.trim()) || !['user', 'material', 'official-source', 'experiment'].includes(e.kind) || Number.isNaN(Date.parse(e.obtainedAt)))
            throw new Error('INVALID_STRUCTURED_RESULT: 证据无效');
    for (const q of v.questions)
        if (!q || !Array.isArray(q.options) || typeof q.question !== 'string')
            throw new Error('INVALID_STRUCTURED_RESULT: 问题无效');
}
//# sourceMappingURL=PlanningValidation.js.map