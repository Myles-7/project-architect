import { hashValue } from '@project-architect/core';
/** Recover pending scope intent only from validated candidates in the result map. */
export function planningUnfinishedScopes(tasks, results, unfinishedBlockIds = []) {
    const unfinished = new Set(unfinishedBlockIds);
    return tasks.filter(item => item.requiredBlockIds?.some(id => unfinished.has(id))).map(item => {
        const required = new Set(item.requiredBlockIds?.filter(id => unfinished.has(id)));
        let ancestor = item;
        const visited = new Set();
        while (ancestor && !visited.has(ancestor.id)) {
            visited.add(ancestor.id);
            const source = tasks.find(candidate => candidate.id === ancestor.assemblyBaseTaskId);
            const previous = source?.status === 'completed' && ['design', 'integration', 'revision'].includes(source.kind) ? results.get(source.id) : undefined;
            const previousCandidateBlocks = previous?.groups.flatMap(group => group.blocks).filter(block => required.has(block.id)) ?? [];
            const previousCandidateRemoveIds = previous?.groups.flatMap(group => group.removeBlockIds).filter(id => required.has(id)) ?? [];
            if (previousCandidateBlocks.length || previousCandidateRemoveIds.length)
                return {
                    taskId: item.id, goal: item.goal, partition: item.partition, requiredBlockIds: item.requiredBlockIds,
                    previousCandidateTaskId: source.id, previousCandidateBlocks, previousCandidateRemoveIds,
                };
            const parentId = ancestor.id;
            ancestor = tasks.find(parent => parent.partitionTaskIds?.includes(parentId));
        }
        return { taskId: item.id, goal: item.goal, partition: item.partition, requiredBlockIds: item.requiredBlockIds };
    });
}
/** Preserve exact evidence identity without letting an older draft replace a repair. */
export function planningWorkerContext(tasks, results, state, task) {
    // A fragment is not a complete draft. The assembly parent can occur earlier
    // in registration order than the children that finish it.
    const latest = tasks.filter(item => !item.partition && item.status === 'completed' && ['design', 'integration', 'revision', 'clarification'].includes(item.kind) && results.has(item.id)).sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || tasks.indexOf(a) - tasks.indexOf(b)).at(-1);
    const draft = latest ? results.get(latest.id) : null;
    const approvedEvidence = state.evidence;
    const known = new Map();
    const add = (record, source) => {
        const hash = hashValue(record), existing = known.get(hash);
        if (existing)
            existing.sources.push(source);
        else
            known.set(hash, { record, sources: [source] });
    };
    for (const change of state.changeSets)
        for (const record of change.evidence)
            add(record, { changeSetId: change.id, status: change.status });
    for (const item of tasks)
        for (const record of results.get(item.id)?.evidence ?? [])
            add(record, { taskId: item.id, status: item.status });
    let knownEvidence = [...known.values()];
    if (task?.kind === 'review') {
        const referenced = new Set(draft?.groups.flatMap(group => [...group.blocks.flatMap(block => block.evidenceIds), ...group.decisions.flatMap(decision => decision.evidenceIds)]) ?? []);
        for (const record of draft?.evidence ?? [])
            referenced.add(record.id);
        knownEvidence = knownEvidence.filter(item => referenced.has(item.record.id));
    }
    const identities = new Map();
    for (const record of [...approvedEvidence, ...knownEvidence.map(item => item.record)]) {
        const versions = identities.get(record.id) ?? new Set();
        versions.add(hashValue(record));
        identities.set(record.id, versions);
    }
    const evidenceConflicts = [...identities].filter(([, hashes]) => hashes.size > 1).map(([id]) => id);
    const evidenceContext = { approvedEvidence, knownEvidence, evidenceConflicts };
    if (task?.kind === 'review')
        return { workerResults: { draft }, ...evidenceContext };
    if (!task || !['integration', 'revision'].includes(task.kind)) {
        return { workerResults: Object.fromEntries((task?.dependsOn ?? []).filter(id => results.has(id)).map(id => [id, results.get(id)])), ...(['research', 'validation', 'decomposition'].includes(task?.kind ?? '') ? { currentDraft: draft } : {}), ...evidenceContext };
    }
    const dependencies = new Set(task.dependsOn);
    const workerResults = Object.fromEntries(tasks.filter(item => !item.partition && item.id !== latest?.id && item.status === 'completed' && results.has(item.id) && (['research', 'validation'].includes(item.kind) || dependencies.has(item.id))).map(item => [item.id, results.get(item.id)]));
    const taskHistory = tasks.filter(item => item.status === 'completed' && results.has(item.id)).map(item => {
        const result = results.get(item.id);
        return { taskId: item.id, kind: item.kind, basisHash: item.basisHash, blockers: result.blockers, followUp: result.followUp, ...(item.kind === 'clarification' ? { clarification: result.clarification, summary: result.summary } : {}) };
    });
    const historicalReviewFindings = [...new Set(tasks.filter(item => item.kind === 'review' && item.status === 'completed').flatMap(item => results.get(item.id)?.blockers ?? []))];
    return { workerResults, currentDraft: draft, taskHistory, historicalReviewFindings, ...evidenceContext };
}
//# sourceMappingURL=PlanningContext.js.map