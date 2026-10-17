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
const ajv = new Ajv({ allErrors: true, strict: false });
const roleValidators = {
    research: ajv.compile(roleSchemas.research),
    validation: ajv.compile(roleSchemas.validation),
    review: ajv.compile(roleSchemas.review),
};
/** Constrain supporting work without shrinking clarification or complete design output. */
export function planningTaskSchema(kind) {
    return kind === 'research' || kind === 'validation' || kind === 'review'
        ? roleSchemas[kind]
        : PLANNING_TASK_SCHEMA;
}
/** Provider success does not replace Core and role-specific output validation. */
export function assertPlanningTaskRole(output, kind) {
    assertTaskResult(output);
    if (kind === 'research' || kind === 'validation' || kind === 'review') {
        const validate = roleValidators[kind];
        if (!validate(output))
            throw new Error(`INVALID_STRUCTURED_RESULT: ${kind} 角色输出越过职责边界：${validate.errors?.map(issue => `${issue.instancePath} ${issue.message}`).join('；')}`);
    }
}
//# sourceMappingURL=PlanningSchema.js.map