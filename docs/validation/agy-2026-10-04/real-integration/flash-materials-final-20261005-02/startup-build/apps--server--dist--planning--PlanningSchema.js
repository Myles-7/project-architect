import { PLANNING_TASK_SCHEMA } from '@project-architect/contracts';
import { assertTaskResult } from '@project-architect/core';
import { Ajv } from 'ajv';
export { PLANNING_TASK_SCHEMA };
const emptyArray = () => ({ type: 'array', items: {}, maxItems: 0 });
function supportSchema(kind) {
    const properties = PLANNING_TASK_SCHEMA.properties;
    return {
        ...PLANNING_TASK_SCHEMA,
        title: `B3 Planning ${kind} result`,
        properties: {
            summary: properties.summary,
            groups: emptyArray(),
            questions: emptyArray(),
            evidence: properties.evidence,
            blockers: properties.blockers,
            followUp: kind === 'review' ? emptyArray() : properties.followUp,
            clarification: { type: 'null' },
            ...(properties.workItems ? { workItems: emptyArray() } : {}),
        },
    };
}
const roleSchemas = {
    research: supportSchema('research'),
    validation: supportSchema('validation'),
    review: supportSchema('review'),
};
const authoringSchema = {
    ...PLANNING_TASK_SCHEMA,
    properties: { ...PLANNING_TASK_SCHEMA.properties, workItems: emptyArray() },
};
const ajv = new Ajv({ allErrors: true, strict: false });
const authoringValidator = ajv.compile(authoringSchema);
const roleValidators = {
    research: ajv.compile(roleSchemas.research),
    validation: ajv.compile(roleSchemas.validation),
    review: ajv.compile(roleSchemas.review),
};
/** Only registered decomposition calls may return work registration. */
export function planningTaskSchema(kind) {
    return kind === 'research' || kind === 'validation' || kind === 'review'
        ? roleSchemas[kind]
        : kind === 'decomposition' ? PLANNING_TASK_SCHEMA : authoringSchema;
}
/** Provider success does not replace Core and role-specific output validation. */
export function assertPlanningTaskRole(output, kind) {
    assertTaskResult(output);
    if (kind === 'decomposition')
        return;
    const validate = kind === 'research' || kind === 'validation' || kind === 'review' ? roleValidators[kind] : authoringValidator;
    if (!validate(output))
        throw new Error(`INVALID_STRUCTURED_RESULT: ${kind} 角色输出越过职责边界：${validate.errors?.map(issue => `${issue.instancePath} ${issue.message}`).join('；')}`);
}
//# sourceMappingURL=PlanningSchema.js.map