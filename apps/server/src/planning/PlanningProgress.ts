import type { AgentTaskResult } from '@project-architect/contracts';
import { hashValue } from '@project-architect/core';

/** IDs and output order are transport details; dependency topology is semantic. */
export function semanticProgressSignature(draft: AgentTaskResult, issues: string[]): string {
  const blocks = draft.groups.flatMap(g => g.blocks);
  const semanticId = new Map(blocks.map(b => [b.id, `${b.stage}:${b.kind}:${b.title}`]));
  const groupId = new Map(draft.groups.map(g => [g.id, g.title]));
  const evidenceId = new Map(draft.evidence.map(e=>[e.id,`${e.kind}:${e.content}:${e.applicability}`]));
  const questionId = new Map(draft.questions.map(q=>[q.id,q.decisionKey??q.question]));
  const ref = (id: string) => semanticId.get(id) ?? groupId.get(id) ?? id;
  const sort = <T>(values: T[]): T[] => [...values].sort((a,b) => hashValue(a).localeCompare(hashValue(b)));
  return hashValue({
    groups: sort(draft.groups.map(g => ({ title:g.title, impact:g.impact,
      dependsOn:sort(g.dependsOn.map(ref)), removeBlockIds:sort(g.removeBlockIds.map(ref)),
      blocks:sort(g.blocks.map(b => ({ stage:b.stage, kind:b.kind, title:b.title, content:b.content,
        dependsOn:sort(b.dependsOn.map(ref)), requirementIds:sort(b.requirementIds.map(ref)), task:b.task?{...b.task,modules:sort(b.task.modules),verification:sort(b.task.verification),completionCriteria:sort(b.task.completionCriteria),assumptions:sort(b.task.assumptions),passCriteria:b.task.passCriteria?sort(b.task.passCriteria):undefined,evidenceRequired:b.task.evidenceRequired?sort(b.task.evidenceRequired):undefined}:undefined, locked:b.locked }))),
      decisions:sort(g.decisions.map(({evidenceIds,...d}) => ({...d,aliases:sort(d.aliases??[]),replaces:sort((d.replaces??[]).map(ref))}))),
    }))),
    questions:sort(draft.questions.map(q => ({key:q.decisionKey,question:q.question,reason:q.reason,
      options:sort(q.options.map(({key,...o})=>o)),recommendation:q.options.find(o=>o.key===q.recommendedOptionKey)?.label,reopenReason:q.reopenReason,dependsOn:sort(q.dependsOn??[])}))),
    evidence:sort(draft.evidence.map(e => ({kind:e.kind,source:e.kind==='experiment'?'registered-experiment':e.source,content:e.content,hash:e.kind==='experiment'?undefined:e.hash,environment:e.environment,outcome:e.outcome,applicability:e.applicability}))),
    issues:sort([...new Set(issues)].map(issue => {let normalized=issue;for(const [id,key] of [...semanticId,...evidenceId,...questionId])normalized=normalized.split(id).join(key);return normalized.replace(/(?:experiment|evidence)-[a-f0-9-]{36}/gi,'generated-evidence');})),
    followUp:sort(draft.followUp), clarification:draft.clarification,
  });
}
